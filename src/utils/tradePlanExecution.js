import {
  normalizePriceToTick,
  normalizeProtectionPrice,
  pendingPriceDirection,
} from './tradingCommandNormalization.js';
import { defaultPlannerStopDistance } from './tradingRisk.js';
import { instrumentPipSize } from './instrumentFormatting.js';

function finitePositive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizedSide(side) {
  const value = String(side || '').toLowerCase();
  return value === 'buy' || value === 'sell' ? value : null;
}

export function executableMarketEntry(side, market) {
  const normalized = normalizedSide(side);
  if (!normalized) return null;
  return finitePositive(normalized === 'buy' ? market?.ask : market?.bid);
}

export function effectiveTradePlan(plan, market) {
  if (!plan || plan.pending) return plan;
  const entry = executableMarketEntry(plan.side, market);
  if (!entry) return plan;
  return { ...plan, entry: normalizePriceToTick(entry, market, 'nearest'), marketPrice: entry };
}

export function createDefaultTradePlan({
  side,
  requestedType = 'market',
  market,
  sizingMode = 'lots',
  lots = 0.1,
  protection = 'both',
}) {
  const normalized = normalizedSide(side);
  const marketPrice = executableMarketEntry(normalized, market);
  if (!normalized || !marketPrice || !market?.symbol) return null;

  const type = String(requestedType || 'market').toLowerCase();
  const pending = type !== 'market';
  const sideUpper = normalized.toUpperCase();
  const pip = finitePositive(instrumentPipSize(market)) || finitePositive(market?.tickSize) || marketPrice * 0.0001;

  let entry = marketPrice;
  if (type === 'limit') entry = normalized === 'buy' ? marketPrice - 5 * pip : marketPrice + 5 * pip;
  if (type === 'stop' || type === 'stop-limit') entry = normalized === 'buy' ? marketPrice + 5 * pip : marketPrice - 5 * pip;
  entry = normalizePriceToTick(entry, market, pendingPriceDirection(type, sideUpper, 'entry'));

  const stopDistance = defaultPlannerStopDistance(market, entry) || 10 * pip;
  const defaultSl = normalizeProtectionPrice(
    normalized === 'buy' ? entry - stopDistance : entry + stopDistance,
    market,
    sideUpper,
    'sl',
  );
  const defaultTp = normalizeProtectionPrice(
    normalized === 'buy' ? entry + stopDistance * 2 : entry - stopDistance * 2,
    market,
    sideUpper,
    'tp',
  );
  const sl = protection === 'tp' || protection === 'none' ? null : defaultSl;
  const tp = protection === 'sl' || protection === 'none' ? null : defaultTp;
  const limitPrice = type === 'stop-limit'
    ? normalizePriceToTick(
      normalized === 'buy' ? entry + 1.5 * pip : entry - 1.5 * pip,
      market,
      pendingPriceDirection(type, sideUpper, 'limit'),
    )
    : null;

  return {
    symbol: market.symbol,
    side: normalized,
    entry,
    sl,
    tp,
    limitPrice,
    marketPrice,
    orderType: type,
    pending,
    sizingMode: sizingMode === 'risk' ? 'risk' : 'lots',
    manualLots: Number(lots) || 0.1,
    expiration: 'GTC',
    stage: 'planning',
    open: false,
  };
}

export function validateTradePlanForExecution(plan, market, { preserveEntry = false } = {}) {
  if (!plan) return { valid: true, code: 'NO_PLAN', message: null };
  const side = normalizedSide(plan.side);
  if (!side) return { valid: false, code: 'INVALID_SIDE', message: 'Select Buy or Sell.' };

  const bid = finitePositive(market?.bid);
  const ask = finitePositive(market?.ask);
  if (!bid || !ask || ask < bid) return { valid: false, code: 'INVALID_QUOTE', message: 'Executable bid/ask is unavailable.' };

  const type = String(plan.orderType || 'market').toLowerCase();
  const effective = preserveEntry ? plan : effectiveTradePlan(plan, market);
  const entry = finitePositive(effective?.entry);
  if (!entry) return { valid: false, code: 'INVALID_ENTRY', message: 'Entry price is unavailable.' };

  if (plan.pending) {
    if (type === 'limit') {
      const valid = side === 'buy' ? entry < ask : entry > bid;
      if (!valid) return { valid: false, code: 'INVALID_PENDING_ENTRY', message: side === 'buy' ? 'Buy Limit must be below the current Ask.' : 'Sell Limit must be above the current Bid.' };
    } else if (type === 'stop' || type === 'stop-limit') {
      const valid = side === 'buy' ? entry > ask : entry < bid;
      if (!valid) return { valid: false, code: 'INVALID_PENDING_ENTRY', message: side === 'buy' ? 'Buy Stop must be above the current Ask.' : 'Sell Stop must be below the current Bid.' };
    }

    if (type === 'stop-limit') {
      const limitPrice = finitePositive(plan.limitPrice);
      if (!limitPrice) return { valid: false, code: 'MISSING_STOP_LIMIT_PRICE', message: 'Stop Limit requires a limit price.' };
      const validLimit = side === 'buy' ? limitPrice >= entry : limitPrice <= entry;
      if (!validLimit) return { valid: false, code: 'INVALID_STOP_LIMIT_PRICE', message: side === 'buy' ? 'Buy Stop Limit price must be at or above the stop trigger.' : 'Sell Stop Limit price must be at or below the stop trigger.' };
    }

    if (String(plan.expiration || '').toUpperCase() === 'SPECIFIED') {
      const expiresAt = new Date(plan.expirationAt || plan.expiresAt || '').getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { valid: false, code: 'INVALID_EXPIRY', message: 'Specified expiry must be in the future.' };
    }
  }

  const reference = plan.pending && type === 'stop-limit'
    ? finitePositive(plan.limitPrice)
    : entry;
  const sl = plan.sl == null ? null : finitePositive(plan.sl);
  const tp = plan.tp == null ? null : finitePositive(plan.tp);
  if (plan.sl != null && !sl) return { valid: false, code: 'INVALID_SL', message: 'Stop loss price is invalid.' };
  if (plan.tp != null && !tp) return { valid: false, code: 'INVALID_TP', message: 'Take profit price is invalid.' };

  if (side === 'buy') {
    if (sl != null && sl >= reference) return { valid: false, code: 'INVALID_SL_GEOMETRY', message: 'Buy stop loss must be below entry.' };
    if (tp != null && tp <= reference) return { valid: false, code: 'INVALID_TP_GEOMETRY', message: 'Buy take profit must be above entry.' };
  } else {
    if (sl != null && sl <= reference) return { valid: false, code: 'INVALID_SL_GEOMETRY', message: 'Sell stop loss must be above entry.' };
    if (tp != null && tp >= reference) return { valid: false, code: 'INVALID_TP_GEOMETRY', message: 'Sell take profit must be below entry.' };
  }

  return { valid: true, code: 'READY', message: null };
}
