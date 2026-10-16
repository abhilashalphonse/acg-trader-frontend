import { createDefaultTradePlan } from './tradePlanExecution.js';
import { defaultPlannerStopDistance } from './tradingRisk.js';
import { normalizeProtectionPrice } from './tradingCommandNormalization.js';

// Local, unsubmitted chart drafts only. Accepted positions keep their existing
// amendment and confirmation flows in MobileTraderShell.
export function mobileOrderTypePatch(plan, orderType, market) {
  if (!plan || plan.open || plan.editingOrderId || !['market', 'limit', 'stop'].includes(orderType)) return null;
  const next = createDefaultTradePlan({ side: plan.side, requestedType: orderType, market, protection: 'none' });
  if (!next) return null;
  // Keep the trader's protection prices and sizing budget. Existing validation
  // explains invalid geometry after an entry change instead of silently deleting it.
  return { orderType, pending: next.pending, entry: next.entry, marketPrice: next.marketPrice, limitPrice: null, activeField: null };
}

export function mobileProtectionPatch(plan, field, market) {
  if (!plan || plan.open || plan.editingOrderId || !['sl', 'tp'].includes(field)) return null;
  const entry = Number(plan.entry);
  const distance = defaultPlannerStopDistance(market, entry);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(distance) || distance <= 0) return null;
  const direction = plan.side === 'buy' ? 1 : plan.side === 'sell' ? -1 : 0;
  if (!direction) return null;
  const raw = field === 'sl' ? entry - direction * distance : entry + direction * distance * 2;
  const price = normalizeProtectionPrice(raw, market, plan.side.toUpperCase(), field);
  if (!Number.isFinite(price) || price <= 0) return null;
  return { [field]: price, activeField: field };
}
