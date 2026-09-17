import { apiRequest } from './client.js';

function auth(token, options = {}) {
  return { ...options, token };
}

export const tradingApi = Object.freeze({
  status(signal) {
    return apiRequest('/v1/trading/status', { signal });
  },

  accountValuation(token, accountId, signal) {
    return apiRequest(`/v1/trading/accounts/${encodeURIComponent(accountId)}/valuation`, auth(token, { signal }));
  },

  positionValuation(token, positionId, signal) {
    return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/valuation`, auth(token, { signal }));
  },

  pendingOrders(token, accountId, signal) {
    return apiRequest(`/v1/trading/accounts/${encodeURIComponent(accountId)}/orders/pending`, auth(token, { signal }));
  },

  openMarketOrder(token, command, signal) {
    return apiRequest('/v1/trading/orders/market', auth(token, { method: 'POST', body: command, signal }));
  },

  placePendingOrder(token, command, signal) {
    return apiRequest('/v1/trading/orders/pending', auth(token, { method: 'POST', body: command, signal }));
  },

  cancelPendingOrder(token, orderId, command, signal) {
    return apiRequest(`/v1/trading/orders/${encodeURIComponent(orderId)}/cancel`, auth(token, { method: 'POST', body: command, signal }));
  },

  updatePositionProtection(token, positionId, command, signal) {
    return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/protection`, auth(token, { method: 'PATCH', body: command, signal }));
  },

  movePositionToBreakEven(token, positionId, command, signal) {
    return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/break-even`, auth(token, { method: 'POST', body: command, signal }));
  },

  configureTrailingStop(token, positionId, command, signal) {
    return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/trailing`, auth(token, { method: 'PATCH', body: command, signal }));
  },

  closePosition(token, positionId, command, signal) {
    return apiRequest(`/v1/trading/positions/${encodeURIComponent(positionId)}/close`, auth(token, { method: 'POST', body: command, signal }));
  },
});
