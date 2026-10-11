/**
 * Precision conversions for the V4 Stop Loss / Take Profit value + dropdown.
 * Canonical SL/TP state is always a normalized *price*, not a distance
 * or a USD figure. No orders are sent from this module.
 *
 * SL account-currency "Risk USD" includes estimated entry + exit fees.
 * TP "Profit USD" is a gross price-move projection (current engine
 * semantics). Both fail safely if P&L currency cannot be verified.
 */
import { effectiveTradePlan } from './tradePlanExecution.js';
import { normalizeProtectionPrice } from './tradingCommandNormalization.js';
import { estimateLossAtStopWithCosts, estimateStopRisk, riskSizingSupported } from './tradingRisk.js';

export const V4_EXIT_UNITS = Object.freeze(['price', 'ticks', 'percent', 'usd', 'balance']);
const positive = v => v !== null && v !== undefined && v !== ''
  && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
const fail = (code, message) => ({ valid: false, code, message, price: null });

function resolveContext({ field, plan, instrument, lots, account }) {
  if (!['sl', 'tp'].includes(field)) return { error: fail('INVALID_FIELD', 'Invalid protection field.') };
  const side = String(plan?.side || '').toLowerCase();
  if (!['buy','sell'].includes(side)) return { error: fail('SIDE_REQUIRED', 'Select Buy or Sell.') };
  const effective = effectiveTradePlan(plan, instrument);
  const stopLimit = effective?.pending && String(effective?.orderType || '').replace('_','-').toLowerCase() === 'stop-limit';
  const entry = positive(stopLimit ? effective.limitPrice : effective?.entry);
  if (!entry) return { error: fail('ENTRY_UNAVAILABLE', 'Valid executable entry price is unavailable.') };
  const tick = positive(instrument?.tickSize);
  if (!tick) return { error: fail('TICK_UNKNOWN', 'Instrument tick size is unavailable.') };
  const direction = side === 'buy' ? (field === 'sl' ? -1 : 1) : (field === 'sl' ? 1 : -1);
  const volume = positive(lots);
  const pnlSupported = riskSizingSupported(instrument, account?.currency);
  return { side, entry, tick, direction, volume, pnlSupported, effective, stopLimit };
}

function amountAt(price, c, field, instrument, account) {
  if (!c.pnlSupported || !c.volume) return null;
  const p = { ...c.effective, entry: c.entry, sl: price };
  return field === 'sl'
    ? estimateLossAtStopWithCosts(p, c.volume, instrument, account)
    : estimateStopRisk(p, c.volume, instrument, account?.currency);
}

function validGeometry(price, c) {
  return Number.isFinite(price) && price > 0 && (price - c.entry) * c.direction > 0;
}

function priceForTicks(n, c, field, instrument) {
  if (!Number.isSafeInteger(n) || n < 1) return null;
  const proposed = c.entry + c.direction * n * c.tick;
  const normalized = normalizeProtectionPrice(proposed, instrument, c.side, field);
  return validGeometry(normalized, c) ? normalized : null;
}

function priceForMoney(budget, c, field, instrument, account) {
  // Find the maximum legal tick distance whose projected cash impact is at
  // most the requested amount. Never round away and exceed a loss budget.
  // For TP, this is a gross target, not guaranteed realized profit.
  const hardMax = c.direction < 0
    ? Math.max(0, Math.floor((c.entry - c.tick) / c.tick + 1e-8))
    : 1_000_000_000_000;
  const maxTicks = Math.min(hardMax, 1_000_000_000_000);
  if (maxTicks < 1) return null;

  const cashAt = ticks => {
    const price = priceForTicks(ticks, c, field, instrument);
    if (price == null) return null;
    return amountAt(price, c, field, instrument, account);
  };
  let lo = 1, hi = 1;
  let first = cashAt(1);
  if (!Number.isFinite(first) || first > budget + 1e-8) return null;
  while (hi < maxTicks && Number.isFinite(cashAt(hi)) && cashAt(hi) <= budget + 1e-8) {
    const next = Math.min(maxTicks, hi * 2);
    if (next === hi) break;
    hi = next;
  }
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const cash = cashAt(mid);
    if (Number.isFinite(cash) && cash <= budget + 1e-8) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best ? priceForTicks(best, c, field, instrument) : null;
}

/** Convert a user edit into a validated canonical protection price. */
export function v4ExitPriceFromInput({
  field, unit, amount, plan, instrument, lots, account, sizingMode = 'lots',
} = {}) {
  if (!V4_EXIT_UNITS.includes(unit)) return fail('INVALID_UNIT', 'Unknown protection unit.');
  const c = resolveContext({field,plan,instrument,lots,account});
  if (c.error) return c.error;
  const value = positive(amount);
  if (!value) return fail('INVALID_AMOUNT', 'Enter a positive protection value.');

  if (field === 'sl' && ['riskPercent','riskUSD'].includes(sizingMode)
      && ['usd','balance'].includes(unit)) {
    return fail('CIRCULAR_SIZING', 'Use a price-based SL unit while sizing volume by risk.');
  }

  if (['usd','balance'].includes(unit) && (!c.pnlSupported || !c.volume)) {
    return fail('PNL_CONVERSION_UNKNOWN', 'Verified account-currency P&L and volume are required.');
  }

  let price;
  if (unit === 'price') price = normalizeProtectionPrice(value, instrument, c.side, field);
  else if (unit === 'ticks') {
    if (!Number.isSafeInteger(value)) return fail('FRACTIONAL_TICK', 'Ticks must be a whole number.');
    price = priceForTicks(value, c, field, instrument);
  } else if (unit === 'percent') {
    price = normalizeProtectionPrice(
      c.entry + c.direction * c.entry * value / 100,
      instrument, c.side, field,
    );
  } else {
    const equity = positive(account?.equity);
    if (unit === 'balance' && !equity) return fail('EQUITY_UNAVAILABLE', 'Account equity is unavailable.');
    const budget = unit === 'usd' ? value : value * equity / 100;
    price = priceForMoney(budget, c, field, instrument, account);
  }

  if (!validGeometry(price, c)) return fail('INVALID_PRICE', 'Protection must be on the correct side of entry and tick-aligned.');
  return {valid:true, code:'READY', message:null, price};
}

/** Read the canonical price in any unit without modifying or rounding it. */
export function v4ExitValueFromPrice({
  field, unit, price, plan, instrument, lots, account,
} = {}) {
  if (!V4_EXIT_UNITS.includes(unit)) return fail('INVALID_UNIT', 'Unknown protection unit.');
  const c = resolveContext({field,plan,instrument,lots,account});
  if (c.error) return c.error;
  const level = positive(price);
  if (!validGeometry(level, c)) return fail('INVALID_PRICE', 'Price is missing or on the wrong side of entry.');

  const delta = Math.abs(level - c.entry);
  const financial = amountAt(level, c, field, instrument, account);
  if (['usd','balance'].includes(unit) && !Number.isFinite(financial)) {
    return fail('PNL_CONVERSION_UNKNOWN', 'Account-currency P&L projection is unavailable.');
  }
  const eq = positive(account?.equity);
  if (unit === 'balance' && !eq) return fail('EQUITY_UNAVAILABLE', 'Account equity is unavailable.');
  const value = unit === 'price' ? level
    : unit === 'ticks' ? delta / c.tick
    : unit === 'percent' ? delta / c.entry * 100
    : unit === 'usd' ? financial : financial / eq * 100;

  return {
    valid:true, code:'READY', message:null, price:level, unit, value,
    entry:c.entry,
    accountCurrencyValue: Number.isFinite(financial) ? financial : null,
    accountPercent: Number.isFinite(financial) && eq ? financial / eq * 100 : null,
    financialBasis:field==='sl'?'LOSS_INCLUDING_ESTIMATED_FEES':'GROSS_PRICE_PROFIT',
  };
}
