import { apiRequest } from './client.js';

const REFRESH_HEADERS = Object.freeze({ 'X-ACG-Refresh': '1' });

export const authApi = Object.freeze({
  login({ tenant, login, password }, signal) {
    return apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { tenant, login, password },
      signal,
    });
  },

  exchangeFederationTicket(ticket, signal) {
    return apiRequest('/v1/auth/federated/exchange', {
      method: 'POST',
      body: { ticket },
      signal,
    });
  },

  createPersonalDemo(token, signal) {
    // Server selects the first-party demo namespace. No client-supplied
    // tenant ID, account ID, balance or permission.
    return apiRequest('/v1/auth/personal/demo', {
      method: 'POST', token, body: {}, signal,
    });
  },

  refresh(token = null, signal) {
    return apiRequest('/v1/auth/refresh', {
      method: 'POST',
      token,
      headers: REFRESH_HEADERS,
      signal,
    });
  },

  me(token, signal) {
    return apiRequest('/v1/auth/me', { token, signal });
  },

  accounts(token, signal) {
    return apiRequest('/v1/auth/accounts', { token, signal });
  },

  logout(token = null, signal) {
    return apiRequest('/v1/auth/logout', {
      method: 'POST',
      token,
      headers: REFRESH_HEADERS,
      signal,
    });
  },
});
