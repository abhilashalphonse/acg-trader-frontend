import { apiRequest } from './client.js';

function auth(token, options = {}) { return { ...options, token }; }
function queryString(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') params.set(key, String(value)); });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const tradingApi = Object.freeze({
  status(signal) { return apiRequest('/v1/trading/status', { signal }); },
  accountValuation(token, accountId, signal) { return apiRequest(`/v1/trading/accounts/${encodeURIComponent(accountId)}/valuation`, auth(token, { signal })); },
  positionValuation(token, positionId, signal) { return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/valuation`, auth(token, { signal })); },
  pendingOrders(token, accountId, signal) { return apiRequest(`/v1/trading/accounts/${encodeURIComponent(accountId)}/orders/pending`, auth(token, { signal })); },
  historyOrders(token, accountId, query, signal) { return apiRequest(`/v1/trading/accounts/${encodeURIComponent(accountId)}/history/orders${queryString(query)}`, auth(token, { signal })); },
  historyDeals(token, accountId, query, signal) { return apiRequest(`/v1/trading/accounts/${encodeURIComponent(accountId)}/history/deals${queryString(query)}`, auth(token, { signal })); },
  historyPositions(token, accountId, query, signal) { return apiRequest(`/v1/trading/accounts/${encodeURIComponent(accountId)}/history/positions${queryString(query)}`, auth(token, { signal })); },
  openMarketOrder(token, command, signal) { return apiRequest('/v1/trading/orders/market', auth(token, { method: 'POST', body: command, signal })); },
  placePendingOrder(token, command, signal) { return apiRequest('/v1/trading/orders/pending', auth(token, { method: 'POST', body: command, signal })); },
  amendPendingOrder(token, orderId, command, signal) { return apiRequest(`/v1/trading/orders/${encodeURIComponent(orderId)}`, auth(token, { method: 'PATCH', body: command, signal })); },
  cancelPendingOrder(token, orderId, command, signal) { return apiRequest(`/v1/trading/orders/${encodeURIComponent(orderId)}/cancel`, auth(token, { method: 'POST', body: command, signal })); },
  updatePositionProtection(token, positionId, command, signal) { return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/protection`, auth(token, { method: 'PATCH', body: command, signal })); },
  movePositionToBreakEven(token, positionId, command, signal) { return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/break-even`, auth(token, { method: 'POST', body: command, signal })); },
  configureTrailingStop(token, positionId, command, signal) { return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/trailing`, auth(token, { method: 'PATCH', body: command, signal })); },
  closePosition(token, positionId, command, signal) { return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/close`, auth(token, { method: 'POST', body: command, signal })); },
  reversePosition(token, positionId, command, signal) { return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/reverse`, auth(token, { method: 'POST', body: command, signal })); },
  closeAllPositions(token, accountId, command, signal) { return apiRequest(`/v1/trading/accounts/${encodeURIComponent(accountId)}/positions/close-all`, auth(token, { method: 'POST', body: command, signal })); },
});
