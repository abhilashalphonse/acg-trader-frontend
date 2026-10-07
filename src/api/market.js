import { apiRequest } from './client.js';

const CANDLE_REQUEST_TIMEOUT_MS = 20_000;

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

  refreshQuote(symbol, token, signal) {
    return apiRequest('/v1/market/quote/refresh', {
      method: 'POST',
      token,
      body: { symbol },
      signal,
    });
  },

  candles({ symbol, timeframe, limit = 160, before = null }, signal) {
    return apiRequest('/v1/market/candles', {
      query: {
        symbol,
        timeframe,
        limit,
        ...(before == null ? {} : { before }),
      },
      // Candle history may require one provider REST round-trip on a cold
      // cache. Keep the global 10s trading/API deadline unchanged and give
      // history its own guardrail so the browser does not abort just before
      // the backend can return or fall back.
      timeoutMs: CANDLE_REQUEST_TIMEOUT_MS,
      signal,
    });
  },
});
