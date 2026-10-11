/**
 * ACG Trader V4 sizing adapter.
 *
 * The four V4 display modes map into EXISTING trading contracts:
 *   Lots / Margin amount -> sizingMode 'lots', manualLots
 *   Risk % / Risk amount -> sizingMode 'risk', riskPercent
 *
 * This module NEVER sends orders. The terminal remains authoritative for
 * plan validation, account policy, quotes, submission and reconciliation.
 * Do not use the synthetic V4 design-preview financial formulas in production.
 */
import { estimateExecutionPrice, resolveExecutionPreview } from './executionPricing.js';
import { effectiveTradePlan } from './tradePlanExecution.js';
import { estimateOpeningRequirement, estimateRequiredMargin, estimateLossAtStopWithCosts, estimateStopRisk, riskSizingSupported } from './tradingRisk.js';
import { normalizeVolumeToStep } from './tradingCommandNormalization.js';

export const V4_POSITION_MODES = Object.freeze(['lots', 'margin', 'riskPercent', 'riskUSD']);
const finitePositive = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
const currency = v => String(v || '').trim().toUpperCase();
const fail = (code, message, extra = {}) => ({ canExecute: false, code, message, lots: null, ...extra });

function instrumentVolumeSpec(instrument) {
  const step = finitePositive(instrument?.volumeStep);
  const minimum = finitePositive(instrument?.minVolume);
  const maximum = finitePositive(instrument?.maxVolume);
  if (!step || !minimum || !maximum || maximum < minimum || minimum < step - 1e-9) return null;
  return { step, min: minimum, max: maximum };
}

function orderReference(plan, instrument) {
  if (!plan || !['buy', 'sell'].includes(String(plan.side || '').toLowerCase())) return null;
  const resolved = effectiveTradePlan(plan, instrument);
  const stopLimit = resolved?.pending && String(resolved.orderType || '').replace('_', '-').toLowerCase() === 'stop-limit';
  const price = finitePositive(stopLimit ? resolved.limitPrice : resolved.entry);
  return price ? { plan: resolved, reference: price, stopLimit } : null;
}

function affordableMarginLots({ target, spec, plan, instrument, account, reference }) {
  // Amount is *required margin*, NOT total opening cost and NOT notional.
  // If same-currency valuation cannot be established, we must not estimate.
  const perLot = estimateRequiredMargin(reference, 1, instrument, account);
  if (!finitePositive(perLot)) return null;

  const steps = Math.floor(spec.max / spec.step + 1e-8);
  if (!Number.isSafeInteger(steps) || steps <= 0) return null;

  const minUnits = Math.ceil(spec.min / spec.step - 1e-8);
  const marginFor = units => {
    const lots = Number((units * spec.step).toPrecision(14));
    const execution = plan.pending ? reference : estimateExecutionPrice(instrument, plan.side, lots)?.price;
    return estimateRequiredMargin(finitePositive(execution) || reference, lots, instrument, account);
  };
  // Price can depend on volume bands, so search using the actual modeled
  // executable price instead of assuming a constant per-lot margin.
  let lo = minUnits, hi = steps, accepted = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const required = marginFor(mid);
    if (!Number.isFinite(required)) return null;
    if (required <= target + 1e-8) { accepted = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (accepted < minUnits) return 0;
  return Number((accepted * spec.step).toPrecision(14));
}

/**
 * Derives V4 values without changing existing executable order schemas.
 *
 * A direction-bearing plan is mandatory. The UX may show indicative sizing
 * before choosing Buy/Sell, but only a real side/plan may produce an executable
 * adapter result. Actual submission must be routed through executePlan/manualOrder.
 */
export function resolveV4PositionSizing({ mode, amount, plan, account, instrument } = {}) {
  if (!V4_POSITION_MODES.includes(mode)) return fail('UNSUPPORTED_MODE', 'Unknown position sizing mode.');
  const value = finitePositive(amount);
  if (!value) return fail('INVALID_AMOUNT', 'Enter a positive sizing value.');
  const spec = instrumentVolumeSpec(instrument);
  if (!spec) return fail('INSTRUMENT_VOLUME_UNKNOWN', 'Instrument volume limits are unavailable.');
  const ref = orderReference(plan, instrument);
  if (!ref) return fail('ENTRY_UNAVAILABLE', 'Choose Buy or Sell and provide a valid entry price.');
  const { reference } = ref;
  const accountCurrency = currency(account?.currency);
  const equity = finitePositive(account?.equity);
  const freeMargin = account?.freeMargin == null ? null : Number(account.freeMargin);
  if (!accountCurrency) return fail('ACCOUNT_CURRENCY_UNKNOWN', 'Account currency is unavailable.');

  let lots;
  let backendMode;
  let riskPercent = null;
  let sizing = null;

  if (mode === 'lots') {
    if (value < spec.min - 1e-8 || value > spec.max + 1e-8) {
      return fail('VOLUME_OUT_OF_RANGE', 'Requested lots are outside the instrument volume limits.');
    }
    lots = normalizeVolumeToStep(value, instrument, { rounding: 'nearest' });
    backendMode = 'lots';
  } else if (mode === 'margin') {
    if (accountCurrency !== currency(instrument?.marginCurrency || instrument?.quoteCurrency)) {
      return fail('MARGIN_CONVERSION_UNKNOWN', 'Account-currency margin conversion is unavailable; use Lots.');
    }
    lots = affordableMarginLots({ target: value, spec, plan: ref.plan, instrument, account, reference });
    if (lots === null) return fail('MARGIN_UNAVAILABLE', 'Instrument margin requirements cannot be verified.');
    if (lots === 0) return fail('MARGIN_BELOW_MIN_VOLUME', 'The margin budget is below minimum executable volume.');
    backendMode = 'lots';
  } else {
    if (!equity) return fail('EQUITY_UNAVAILABLE', 'Account equity is unavailable.');
    if (!riskSizingSupported(instrument, accountCurrency)) {
      return fail('RISK_CONVERSION_UNKNOWN', 'Account-currency risk conversion is unavailable; use Lots.');
    }
    if (!finitePositive(ref.plan.sl)) return fail('STOP_REQUIRED', 'Risk-based sizing requires a valid stop loss.');
    const side = String(ref.plan.side).toLowerCase();
    if (!(side === 'buy' ? Number(ref.plan.sl) < reference : Number(ref.plan.sl) > reference)) {
      return fail('INVALID_STOP_GEOMETRY', 'Stop loss must be on the loss side of entry.');
    }
    riskPercent = mode === 'riskPercent' ? value : value / equity * 100;
    // The existing resolver includes BOTH sides of commission, limits,
    // margin checks and liquidity-adjusted market entry pricing.
    const effective = {
      ...ref.plan,
      sizingMode: 'risk',
      entry: reference,
      manualLots: null,
    };
    sizing = resolveExecutionPreview({
      plan: effective,
      riskPercent,
      manualLots: null,
      account,
      instrument,
    });
    const result = sizing?.sizing;
    if (!result?.canExecute || !finitePositive(result?.lots)) {
      return fail(result?.blockReason || 'RISK_SIZING_UNAVAILABLE', 'Existing risk engine could not size this order.', {
        backendSizingMode: 'risk',
        riskPercent,
        riskSizing: result?.riskSizing || null,
      });
    }
    lots = Number(result.lots);
    backendMode = 'risk';
  }

  if (!finitePositive(lots) || lots < spec.min - 1e-8 || lots > spec.max + 1e-8) {
    return fail('INVALID_VOLUME', 'No valid instrument volume was calculated.');
  }

  const referenceForCalculations = mode.startsWith('risk')
    ? (sizing?.riskPlan?.entry || sizing?.plan?.entry || reference) : reference;
  const margin = estimateRequiredMargin(referenceForCalculations, lots, instrument, account);
  const openingRequirement = estimateOpeningRequirement(referenceForCalculations, lots, instrument, account);

  // Never represent unverified margin as 0 or positive free margin.
  if (!Number.isFinite(margin) || !Number.isFinite(openingRequirement) || !Number.isFinite(freeMargin)) {
    return fail('OPENING_REQUIREMENT_UNKNOWN', 'Opening margin, fees or free margin cannot be verified.');
  }
  if (freeMargin < openingRequirement - 1e-8) {
    return fail('INSUFFICIENT_MARGIN', 'Opening margin and commission exceed free margin.', {
      lots, margin, openingRequirement, freeAfter: freeMargin - openingRequirement,
    });
  }

  const riskPlan = mode.startsWith('risk')
    ? (sizing?.riskPlan || { ...ref.plan, entry: referenceForCalculations })
    : { ...ref.plan, entry: referenceForCalculations };
  const lossAtStop = riskPlan?.sl != null
    ? estimateLossAtStopWithCosts(riskPlan, lots, instrument, account) : null;
  const grossProfitAtTarget = riskPlan?.tp != null
    ? estimateStopRisk({ ...riskPlan, sl: riskPlan.tp }, lots, instrument, accountCurrency) : null;
  const quoteCurrency = currency(instrument?.quoteCurrency);
  const contractSize = finitePositive(instrument?.contractSize);
  const notionalQuote = contractSize ? referenceForCalculations * contractSize * lots : null;
  const notionalAccount = quoteCurrency === accountCurrency ? notionalQuote : null;

  return {
    canExecute: true,
    code: 'READY',
    message: null,
    requestedMode: mode,
    requestedAmount: value,
    backendSizingMode: backendMode,
    manualLots: backendMode === 'lots' ? lots : null,
    riskPercent,
    lots,
    accountCurrency,
    referencePrice: referenceForCalculations,
    margin,
    openingRequirement,
    freeAfter: freeMargin - openingRequirement,
    notionalQuote,
    notionalAccount,
    notionalAccountPercent: notionalAccount != null && equity ? notionalAccount / equity * 100 : null,
    lossAtStop,
    grossProfitAtTarget,
    actualRiskPercent: Number.isFinite(lossAtStop) && equity ? lossAtStop / equity * 100 : null,
    riskSizing: sizing?.sizing?.riskSizing || null,
  };
}
