import { apiRequest } from './client.js';

export const marketApi = Object.freeze({
  status(signal) {
    return apiRequest('/v1/market/status', { signal });
  },

  instruments(signal) {
    return apiRequest('/v1/instruments', { signal });
  },

  instrument(symbol, signal) {
    return apiRequest(`/v1/instruments/${encodeURIComponent(symbol)}`, { signal });
  },

  instrumentIdentity(symbol, signal) {
    return apiRequest(`/v1/instruments/${encodeURIComponent(symbol)}/identity`, { signal });
  },

  quotes(symbols, signal) {
    return apiRequest('/v1/market/quotes', {
      query: { symbols: Array.isArray(symbols) ? symbols : [symbols] },
      signal,
    });
  },

  refreshQuote(symbol, signal) {
    return apiRequest('/v1/market/quote/refresh', {
      method: 'POST',
      body: { symbol },
      signal,
    });
  },

  candles({ symbol, timeframe, limit = 160 }, signal) {
    return apiRequest('/v1/market/candles', {
      query: { symbol, timeframe, limit },
      signal,
    });
  },
});
