import {
  normalizePriceToTick,
  normalizeProtectionPrice,
  pendingPriceDirection,
} from './tradingCommandNormalization.js';

export function normalizeTradePlanPatch(plan, patch, instrument) {
  if (!plan || !patch || typeof patch !== 'object') return patch || {};
  const side = String(patch.side ?? plan.side ?? '').toUpperCase();
  const type = String(patch.orderType ?? plan.orderType ?? 'market');
  const normalized = { ...patch };

  if (Object.prototype.hasOwnProperty.call(patch, 'entry')) {
    normalized.entry = normalizePriceToTick(
      patch.entry,
      instrument,
      plan.pending ? pendingPriceDirection(type, side, 'entry') : 'nearest',
    );
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'limitPrice')) {
    normalized.limitPrice = normalizePriceToTick(
      patch.limitPrice,
      instrument,
      pendingPriceDirection(type, side, 'limit'),
    );
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'sl')) {
    normalized.sl = normalizeProtectionPrice(patch.sl, instrument, side, 'sl');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'tp')) {
    normalized.tp = normalizeProtectionPrice(patch.tp, instrument, side, 'tp');
  }

  return normalized;
}

export function normalizeTradePlan(plan, instrument) {
  if (!plan) return plan;
  return {
    ...plan,
    ...normalizeTradePlanPatch(plan, {
      entry: plan.entry,
      limitPrice: plan.limitPrice,
      sl: plan.sl,
      tp: plan.tp,
    }, instrument),
  };
}
