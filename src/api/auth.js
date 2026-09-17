import { apiRequest } from './client.js';

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

  me(token, signal) {
    return apiRequest('/v1/auth/me', { token, signal });
  },

  logout(token, signal) {
    return apiRequest('/v1/auth/logout', {
      method: 'POST',
      token,
      signal,
    });
  },
});
