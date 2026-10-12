// Canonical desktop-V4 chart presentation model.
// Server snapshots supply accepted levels. Local edits never mutate them.
// This module contains no React or legacy chart overlay dependencies.
const positive = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const sameSymbol = (item, symbol) =>
  String(item?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase();

export const V4_LEVEL_COLORS = Object.freeze({
  buy: '#12b996',
  sell: '#ef5664',
  sl: '#ef5664',
  tp: '#12b996',
  limitPrice: '#ad91e5',
  draft: '#acb9c7',
});

export function v4LevelKey(owner, id, field) {
  return [owner, String(id), field].join(':');
}

export function v4AcceptedLevels({ positions = [], pendingOrders = [], symbol } = {}) {
  const levels = [];
  (Array.isArray(positions) ? positions : []).forEach(position => {
    if (!sameSymbol(position, symbol)) return;
    const id = position.id;
    if (id === null || id === undefined) return;
    const entry = positive(position.entry ?? position.entryPrice);
    if (entry == null) return;
    const side = String(position.side || '').toLowerCase();
    const add = (field, price) => {
      if (price == null) return;
      levels.push({
        key: v4LevelKey('position', id, field),
        owner: 'position', ownerId: String(id), field, price,
        side, accepted: true, position,
        color: V4_LEVEL_COLORS[field] || V4_LEVEL_COLORS[side] || V4_LEVEL_COLORS.draft,
      });
    };
    add('entry', entry);
    add('sl', positive(position.sl));
    add('tp', positive(position.tp));
  });
  (Array.isArray(pendingOrders) ? pendingOrders : []).forEach(order => {
    if (!sameSymbol(order, symbol)) return;
    const id = order.id;
    if (id === null || id === undefined) return;
    if (!['PENDING', 'PLACED', 'ACTIVE', ''].includes(String(order.status || '').toUpperCase())) return;
    const entry = positive(order.entry);
    if (entry == null) return;
    const side = String(order.side || '').toLowerCase();
    const kind = String(order.orderType || '').toLowerCase();
    const add = (field, price) => {
      if (price == null) return;
      levels.push({
        key: v4LevelKey('pending', id, field),
        owner: 'pending', ownerId: String(id), field, price,
        side, orderType: kind, accepted: true, order,
        color: V4_LEVEL_COLORS[field] || V4_LEVEL_COLORS[side] || V4_LEVEL_COLORS.draft,
      });
    };
    add('entry', entry);
    if (kind === 'stop-limit') add('limitPrice', positive(order.limitPrice));
    add('sl', positive(order.sl ?? order.stopLoss));
    add('tp', positive(order.tp ?? order.takeProfit));
  });
  return levels;
}

export function v4DraftLevels({ tradePlan = null, positionProtectionDraft = null, symbol, effectiveEntry = null } = {}) {
  const levels = [];
  if (tradePlan && !tradePlan.open && sameSymbol(tradePlan, symbol)) {
    const fields = ['entry', 'sl', 'tp', ...(String(tradePlan.orderType).toLowerCase() === 'stop-limit' ? ['limitPrice'] : [])];
    const ownerId = String(tradePlan.editingOrderId || 'new');
    fields.forEach(field => {
      const price = field === 'entry' && !tradePlan.pending && positive(effectiveEntry) != null
        ? positive(effectiveEntry) : positive(tradePlan[field]);
      if (price == null) return;
      levels.push({
        key: v4LevelKey('draft', ownerId, field), owner:'draft',
        ownerId, field, price, accepted:false, plan:tradePlan,
        side:String(tradePlan.side || '').toLowerCase(),
        color:V4_LEVEL_COLORS[field] || V4_LEVEL_COLORS.draft,
      });
    });
  }
  if (positionProtectionDraft && sameSymbol(positionProtectionDraft, symbol)
    && positionProtectionDraft.source === 'open-position') {
    const field = positionProtectionDraft.activeField;
    if (!['sl','tp'].includes(field)) return levels;
    const price = positive(positionProtectionDraft[field]);
    if (price != null) {
      levels.push({
        key:v4LevelKey('protection-draft',positionProtectionDraft.positionId,field),
        owner:'protection-draft',ownerId:String(positionProtectionDraft.positionId),field,price,
        accepted:false,plan:positionProtectionDraft,
        side:String(positionProtectionDraft.side || '').toLowerCase(),
        color:V4_LEVEL_COLORS[field],
      });
    }
  }
  return levels;
}

// One complete badge per accepted level. Its accepted solid price line remains
// separately visible while the user drags/edits that level.
export function v4ShowAcceptedBadge(level, { edit = null, tradePlan = null, positionProtectionDraft = null } = {}) {
  if (!level?.accepted) return false;
  if (edit && edit.owner === level.owner && String(edit.ownerId) === level.ownerId && edit.field === level.field) return false;
  if (level.owner === 'pending' && tradePlan?.editingOrderId != null
    && String(tradePlan.editingOrderId) === level.ownerId) return false;
  if (level.owner === 'position' && positionProtectionDraft?.positionId != null
    && String(positionProtectionDraft.positionId) === level.ownerId
    && positionProtectionDraft.activeField === level.field) return false;
  return true;
}

// Arrange individual badges only. Financial price-line Y coordinates are never
// changed. Displaced badges obtain a thin leader back to their real price line.
export function v4LayoutBadges(entries, chartHeight, { rowHeight = 28, gap = 6, inset = 14 } = {}) {
  if (!Array.isArray(entries) || !entries.length) return [];
  const height = Math.max(0, Number(chartHeight) || 0);
  const half = rowHeight / 2;
  const minY = inset + half;
  const maxY = height - inset - half;
  const step = rowHeight + gap;
  const sorted = entries.filter(item => Number.isFinite(Number(item.y)))
    .slice().sort((a,b) => Number(a.y) - Number(b.y) || String(a.key).localeCompare(String(b.key)));
  // Least-squares collision placement. Isotonic regression on
  // (priceY - index*step) distributes displacement above and below the
  // cluster rather than pushing every subsequent badge down the chart.
  const blocks = [];
  sorted.forEach((item,index) => {
    const target = Number(item.y) - index*step;
    blocks.push({ start:index, end:index, total:target, count:1, mean:target });
    while (blocks.length>1 && blocks[blocks.length-2].mean>blocks[blocks.length-1].mean) {
      const right=blocks.pop(),left=blocks.pop();
      const total=left.total+right.total, count=left.count+right.count;
      blocks.push({start:left.start,end:right.end,total,count,mean:total/count});
    }
  });
  const badgeY = Array(sorted.length);
  for(const block of blocks)for(let index=block.start;index<=block.end;index++)
    badgeY[index]=block.mean+index*step;
  if (badgeY.length && maxY>=minY && (sorted.length-1)*step<=maxY-minY) {
    const low=badgeY[0],high=badgeY[badgeY.length-1];
    const shift=low<minY ? minY-low : high>maxY ? maxY-high : 0;
    for(let index=0;index<badgeY.length;index++)badgeY[index]+=shift;
  }
  return sorted.map((item,index)=>({
    ...item,badgeY:badgeY[index],deltaY:badgeY[index]-Number(item.y),
  }));
}

export function v4ValidEditPrice(value) { return positive(value); }
