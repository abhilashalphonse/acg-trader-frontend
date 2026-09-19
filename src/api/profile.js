import { apiRequest } from './client.js';

export const profileApi = Object.freeze({
  get(token, signal) {
    return apiRequest('/v1/profile', { token, signal });
  },

  update(token, profile, signal) {
    return apiRequest('/v1/profile', {
      method: 'PUT',
      token,
      body: profile,
      signal,
      timeoutMs: 20000,
    });
  },
});
