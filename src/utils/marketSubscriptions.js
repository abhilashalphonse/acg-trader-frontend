const ACTIVE_PENDING_ORDER_STATUSES = new Set(['PENDING', 'ACCEPTED', 'TRIGGERED']);

export function riskCriticalMarketSymbols({
  positionsById = {},
  ordersById = {},
  grantedAccountIds = [],
} = {}) {
  const granted = new Set((grantedAccountIds || []).map(String));
  const symbols = [];

  for (const position of Object.values(positionsById || {})) {
    if (String(position?.status || '').toUpperCase() !== 'OPEN') continue;
    if (granted.size && !granted.has(String(position?.accountId || ''))) continue;
    if (position?.symbol) symbols.push(String(position.symbol).toUpperCase());
  }

  for (const order of Object.values(ordersById || {})) {
    const status = String(order?.status || '').toUpperCase();
    const type = String(order?.type || '').toUpperCase();
    if (!ACTIVE_PENDING_ORDER_STATUSES.has(status) || type === 'MARKET') continue;
    if (granted.size && !granted.has(String(order?.accountId || ''))) continue;
    if (order?.symbol) symbols.push(String(order.symbol).toUpperCase());
  }

  return [...new Set(symbols)];
}
