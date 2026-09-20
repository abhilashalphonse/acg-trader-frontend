import { marketApi } from '../api/market.js';

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

function nullableFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeCandle(candle) {
  const time = Number(candle?.time ?? (Number(candle?.openTimeMs) / 1000));
  const open = Number(candle?.open);
  const high = Number(candle?.high);
  const low = Number(candle?.low);
  const close = Number(candle?.close);
  if (![time, open, high, low, close].every(Number.isFinite)) return null;
  const providerVolume = nullableFiniteNumber(candle?.providerVolume);
  const tickCount = nullableFiniteNumber(candle?.tickCount);
  return {
    time: Math.floor(time),
    open,
    high,
    low,
    close,
    providerVolume,
    tickCount,
    volume: providerVolume,
    volumeSource: providerVolume == null ? null : 'provider',
    complete: Boolean(candle?.complete),
    synthetic: Boolean(candle?.synthetic),
  };
}

export async function fetchCandles(symbol, timeframe, outputsize = 500, signal) {
  const key = cacheKey(symbol, timeframe, outputsize);
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.bars.map(bar => ({ ...bar }));

  const response = await marketApi.candles({
    symbol: String(symbol || '').toUpperCase(),
    timeframe: toBackendTimeframe(timeframe),
    limit: Math.max(1, Math.min(1000, Number(outputsize) || 160)),
  }, signal);

  const bars = (response?.candles || []).map(normalizeCandle).filter(Boolean);
  candleCache.set(key, { savedAt: Date.now(), bars });
  return bars.map(bar => ({ ...bar }));
}

export function mergeLiveBarIntoCache(symbol, timeframe, bar, outputsize = 500) {
  const key = cacheKey(symbol, timeframe, outputsize);
  const cached = candleCache.get(key);
  if (!cached || !bar || !Number.isFinite(Number(bar.time))) return;
  const bars = cached.bars.slice();
  const normalized = { ...bar, time: Number(bar.time) };
  const last = bars[bars.length - 1];
  if (last?.time === normalized.time) bars[bars.length - 1] = normalized;
  else if (!last || normalized.time > last.time) bars.push(normalized);
  while (bars.length > outputsize) bars.shift();
  candleCache.set(key, { savedAt: Date.now(), bars });
}
