/**
 * V4 chart-order canonical presentation projection.
 *
 * This module does not import ChartArea or the legacy chart-order overlays.
 * Server snapshots are accepted; local edits are NEVER accepted.
 * See docs/ACG-V4-CHART-ORDER-FROZEN-DESIGN-WORKFLOW.md.
 */
const positive = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
const identity = value => value == null ? null : String(value);
export const V4_ORDER_VISUAL_STATES = Object.freeze({
  DRAFT: 'DRAFT', ACCEPTED: 'ACCEPTED', PREVIEW: 'PREVIEW', SAVING: 'SAVING', CONFIRM_REMOVE: 'CONFIRM_REMOVE',
});

export function v4LevelId({ accountId, objectType, objectId, kind }) {
  const keys = [accountId, objectType, objectId, kind].map(identity);
  return keys.every(Boolean) ? keys.join(':') : null;
}

/** Server-reported levels are authoritative, and retain their prices through edits. */
export function projectV4AcceptedLevels({ accountId, symbol, positions = [], pendingOrders = [] }) {
  if (!identity(accountId) || !identity(symbol)) return [];
  const target = String(symbol).toUpperCase();
  const result = [];
  const add = (objectType, objectId, kind, price, side, extra = {}) => {
    const id = v4LevelId({ accountId, objectType, objectId, kind });
    if (!id || !positive(price)) return;
    result.push(Object.freeze({ id, accountId: String(accountId), objectType, objectId: String(objectId),
      kind, price: Number(price), side: String(side || '').toUpperCase(),
      state: V4_ORDER_VISUAL_STATES.ACCEPTED, lineStyle: 'solid', ...extra }));
  };
  for (const position of positions || []) {
    if (!position || String(position.symbol || '').toUpperCase() !== target) continue;
    if (String(position.status || 'OPEN').toUpperCase() !== 'OPEN') continue;
    const id = position.id ?? position.positionId;
    const side = position.side;
    add('position', id, 'entry', position.entry ?? position.entryPrice, side,
      { volume: position.volume ?? position.lots ?? null, pnl: position.pnl ?? null });
    add('position', id, 'sl', position.sl ?? position.stopLoss, side);
    add('position', id, 'tp', position.tp ?? position.takeProfit, side);
  }
  for (const order of pendingOrders || []) {
    if (!order || String(order.symbol || '').toUpperCase() !== target) continue;
    if (String(order.status || 'PENDING').toUpperCase() !== 'PENDING') continue;
    const id = order.id ?? order.orderId;
    const side = order.side;
    const type = String(order.orderType || order.type || '').toLowerCase().replace('_', '-');
    add('pending', id, 'entry', order.entry ?? order.stopPrice ?? order.limitPrice, side, { orderType: type });
    if (type === 'stop-limit') add('pending', id, 'limitPrice', order.limitPrice, side, { orderType: type });
    add('pending', id, 'sl', order.sl ?? order.stopLoss, side, { orderType: type });
    add('pending', id, 'tp', order.tp ?? order.takeProfit, side, { orderType: type });
  }
  return result;
}

/** An accepted level remains immutable while its unsaved ghost changes. */
export function projectV4Edit(acceptedLevels, edit) {
  const values = Array.isArray(acceptedLevels) ? acceptedLevels : [];
  if (!edit || !values.some(level => level.id === edit.levelId)) return { accepted: values, ghost: null };
  const source = values.find(level => level.id === edit.levelId);
  const valid = positive(edit.proposedPrice);
  if (!valid) return { accepted: values, ghost: null };
  return {
    accepted: values,
    ghost: Object.freeze({ ...source, id: source.id + ':preview', sourceLevelId: source.id,
      price: Number(edit.proposedPrice), state: V4_ORDER_VISUAL_STATES.PREVIEW, lineStyle: 'dotted' }),
  };
}

/** Position entry shows shortcuts only for protections that are not accepted. */
export function v4MissingProtections(levels, positionEntryId) {
  const entry = (levels || []).find(level => level.id === positionEntryId && level.kind === 'entry' && level.objectType === 'position');
  if (!entry) return [];
  const existing = new Set((levels || []).filter(level => level.objectType === 'position'
    && level.objectId === entry.objectId && level.accountId === entry.accountId).map(level => level.kind));
  return ['tp', 'sl'].filter(kind => !existing.has(kind));
}

/** Return a safe explicit action, never a silent direct mutation. */
export function v4ProtectionAction(levels, levelId, type) {
  const level = (levels || []).find(item => item.id === levelId);
  if (!level || level.objectType !== 'position' || !['sl', 'tp'].includes(level.kind)) return null;
  if (type === 'remove') return Object.freeze({ state: V4_ORDER_VISUAL_STATES.CONFIRM_REMOVE,
    accountId: level.accountId, objectId: level.objectId, kind: level.kind, confirmedPrice: level.price });
  if (type === 'edit') return Object.freeze({ state: V4_ORDER_VISUAL_STATES.DRAFT,
    accountId: level.accountId, objectId: level.objectId, levelId, confirmedPrice: level.price });
  return null;
}

/**
 * Layout badge rectangles without altering true price-line coordinates.
 * Input is sorted deterministically by Y and unique stable level identity.
 * Badges can move to avoid other badges, never beyond the provided plot bounds.
 * If the plot cannot physically accommodate all badges, returns overflow ids
 * rather than piling them over the BID/ASK quote rail.
 */
export function placeV4Badges(levels, { minY = 0, maxY, badgeHeight = 28, gap = 5 } = {}) {
  if (!Array.isArray(levels) || !Number.isFinite(maxY) || maxY <= minY || badgeHeight <= 0 || gap < 0)
    return { placements: [], overflow: (levels || []).map(level => level.id) };
  const ordered = [...levels].filter(level => Number.isFinite(level.y) && level.id)
    .sort((a, b) => a.y - b.y || String(a.id).localeCompare(String(b.id)));
  const capacity = Math.max(0, Math.floor((maxY - minY + gap) / (badgeHeight + gap)));
  const included = ordered.slice(0, capacity);
  const maxTop = maxY - badgeHeight;
  const placements = [];
  let last = minY - badgeHeight - gap;
  for (const level of included) {
    const centeredTop = Math.min(maxTop, Math.max(minY, level.y - badgeHeight / 2));
    const top = Math.max(centeredTop, last + badgeHeight + gap);
    placements.push({ id: level.id, priceLineY: level.y, badgeTop: top, displaced: Math.abs(top + badgeHeight / 2 - level.y) > 0.5 });
    last = top;
  }
  // Pull the crowded group up if its trailing edge exceeds the viewport.
  if (placements.length && placements[placements.length - 1].badgeTop > maxTop) {
    const excess = placements[placements.length - 1].badgeTop - maxTop;
    for (const level of placements) {
      level.badgeTop -= excess;
      level.displaced = Math.abs(level.badgeTop + badgeHeight / 2 - level.priceLineY) > 0.5;
    }
  }
  return { placements, overflow: ordered.slice(capacity).map(level => level.id) };
}
