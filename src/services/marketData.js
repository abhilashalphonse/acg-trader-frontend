import { marketApi } from '../api/market.js';
import { normalizeCandle, normalizeCandleSeries } from '../utils/candleNormalization.js';
import { mergeLiveCandleIntoSeries } from '../utils/candleMerge.js';

export { normalizeCandle, normalizeCandleSeries, mergeLiveCandleIntoSeries };

const BACKEND_TIMEFRAMES = Object.freeze({
  M1: '1m',
  M5: '5m',
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
  W1: '1w',
});

const UI_TIMEFRAMES = Object.freeze(Object.fromEntries(
  Object.entries(BACKEND_TIMEFRAMES).map(([ui, backend]) => [backend, ui]),
));

const CACHE_TTL_MS = 30_000;
const candleCache = new Map();

function cacheKey(symbol, timeframe, outputsize) {
  return `${String(symbol).toUpperCase()}:${String(timeframe).toUpperCase()}:${outputsize}`;
}

export function toBackendTimeframe(timeframe) {
  const normalized = String(timeframe || '').toUpperCase();
  const resolved = BACKEND_TIMEFRAMES[normalized];
  if (!resolved) throw new Error(`ACG Trader backend does not support ${normalized || 'this'} timeframe`);
  return resolved;
}

export function toUiTimeframe(timeframe) {
  return UI_TIMEFRAMES[String(timeframe || '').toLowerCase()] || null;
}

export async function fetchCandles(symbol, timeframe, outputsize = 500, signal, { force = false } = {}) {
  const key = cacheKey(symbol, timeframe, outputsize);
  const cached = candleCache.get(key);
  if (!force && cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.bars.map(bar => ({ ...bar }));

  const response = await marketApi.candles({
    symbol: String(symbol || '').toUpperCase(),
    timeframe: toBackendTimeframe(timeframe),
    limit: Math.max(1, Math.min(1000, Number(outputsize) || 160)),
  }, signal);

  const bars = normalizeCandleSeries(response?.candles || []);
  candleCache.set(key, { savedAt: Date.now(), bars });
  return bars.map(bar => ({ ...bar }));
}

export function mergeLiveBarIntoCache(symbol, timeframe, bar, outputsize = 500) {
  const key = cacheKey(symbol, timeframe, outputsize);
  const cached = candleCache.get(key);
  if (!cached || !bar) return;
  const bars = mergeLiveCandleIntoSeries(cached.bars, bar, outputsize);
  candleCache.set(key, { savedAt: Date.now(), bars });
}
