import { marketApi } from '../api/market.js';
import { normalizeCandle, normalizeCandleSeries } from '../utils/candleNormalization.js';
import { mergeLiveCandleIntoSeries } from '../utils/candleMerge.js';
import { prependHistoricalCandles, reconcileLatestCandles } from '../utils/candleHistory.js';

export {
  normalizeCandle,
  normalizeCandleSeries,
  mergeLiveCandleIntoSeries,
  prependHistoricalCandles,
  reconcileLatestCandles,
};

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
const MAX_CACHE_ENTRIES = 64;
const candleCache = new Map();

function normalizedCursor(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
}

function cachePrefix(symbol, timeframe) {
  return `${String(symbol).toUpperCase()}:${String(timeframe).toUpperCase()}:`;
}

function cacheKey(symbol, timeframe, outputsize, before = null) {
  const cursor = normalizedCursor(before);
  return `${cachePrefix(symbol, timeframe)}${outputsize}:${cursor == null ? 'latest' : cursor}`;
}

function clonePage(page) {
  return {
    bars: (page?.bars || []).map(bar => ({ ...bar })),
    pagination: { ...(page?.pagination || {}) },
  };
}

function readCache(key) {
  const cached = candleCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.savedAt >= CACHE_TTL_MS) {
    candleCache.delete(key);
    return null;
  }
  // Map insertion order is the LRU list.
  candleCache.delete(key);
  candleCache.set(key, cached);
  return clonePage(cached);
}

function writeCache(key, page) {
  candleCache.delete(key);
  candleCache.set(key, {
    savedAt: Date.now(),
    bars: (page?.bars || []).map(bar => ({ ...bar })),
    pagination: { ...(page?.pagination || {}) },
  });
  while (candleCache.size > MAX_CACHE_ENTRIES) {
    const oldest = candleCache.keys().next().value;
    if (oldest == null) break;
    candleCache.delete(oldest);
  }
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

export async function fetchCandlePage(
  symbol,
  timeframe,
  outputsize = 500,
  signal,
  { force = false, before = null } = {},
) {
  const safeLimit = Math.max(1, Math.min(1000, Number(outputsize) || 160));
  const cursor = normalizedCursor(before);
  const key = cacheKey(symbol, timeframe, safeLimit, cursor);
  const cached = !force ? readCache(key) : null;
  if (cached) return cached;

  const response = await marketApi.candles({
    symbol: String(symbol || '').toUpperCase(),
    timeframe: toBackendTimeframe(timeframe),
    limit: safeLimit,
    before: cursor,
  }, signal);

  const bars = normalizeCandleSeries(response?.candles || []);
  const rawNextBefore = normalizedCursor(response?.pagination?.nextBefore);
  const cursorProgresses = cursor == null || rawNextBefore == null || rawNextBefore < cursor;
  const pagination = {
    hasMore: Boolean(response?.pagination?.hasMore && rawNextBefore != null && cursorProgresses),
    nextBefore: rawNextBefore,
    limit: safeLimit,
  };
  const page = { bars, pagination };
  writeCache(key, page);
  return clonePage(page);
}

export async function fetchCandles(symbol, timeframe, outputsize = 500, signal, options = {}) {
  const page = await fetchCandlePage(symbol, timeframe, outputsize, signal, options);
  return page.bars;
}

export function invalidateCandleCache(symbol, timeframe) {
  const prefix = cachePrefix(symbol, timeframe);
  for (const key of [...candleCache.keys()]) {
    if (key.startsWith(prefix)) candleCache.delete(key);
  }
}

export function mergeLiveBarIntoCache(symbol, timeframe, bar, outputsize = 500) {
  const safeLimit = Math.max(1, Math.min(1000, Number(outputsize) || 160));
  const key = cacheKey(symbol, timeframe, safeLimit, null);
  const cached = candleCache.get(key);
  if (!cached || !bar) return;
  const bars = mergeLiveCandleIntoSeries(cached.bars, bar, safeLimit);
  writeCache(key, {
    bars,
    pagination: cached.pagination,
  });
}
