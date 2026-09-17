import { marketApi } from '../api/market.js';

const BACKEND_TIMEFRAMES = {
  S1: '1s',
  S5: '5s',
  S15: '15s',
  S30: '30s',
  M1: '1m',
  M5: '5m',
  M15: '15m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
};

const INTERVAL_SECONDS = {
  S1: 1,
  S5: 5,
  S15: 15,
  S30: 30,
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
  W1: 604800,
  MN: 2592000,
};

const CACHE_TTL_MS = 30_000;
const candleCache = new Map();

function cacheKey(symbol, timeframe, outputsize) {
  return `${String(symbol).toUpperCase()}:${String(timeframe).toUpperCase()}:${outputsize}`;
}

function backendTimeframe(timeframe) {
  const normalized = String(timeframe || '').toUpperCase();
  const resolved = BACKEND_TIMEFRAMES[normalized];
  if (!resolved) throw new Error(`ACG Trader backend does not support ${normalized || 'this'} timeframe yet`);
  return resolved;
}

function normalizeCandle(candle) {
  const time = Number(candle?.time ?? (Number(candle?.openTimeMs) / 1000));
  const open = Number(candle?.open);
  const high = Number(candle?.high);
  const low = Number(candle?.low);
  const close = Number(candle?.close);
  if (![time, open, high, low, close].every(Number.isFinite)) return null;
  const providerVolume = Number(candle?.providerVolume);
  const tickCount = Number(candle?.tickCount);
  return {
    time: Math.floor(time),
    open,
    high,
    low,
    close,
    volume: Number.isFinite(providerVolume) ? providerVolume : Number.isFinite(tickCount) ? tickCount : null,
  };
}

export function timeframeSeconds(timeframe) {
  return INTERVAL_SECONDS[String(timeframe || '').toUpperCase()] ?? 60;
}

export async function fetchCandles(symbol, timeframe, outputsize = 500, signal) {
  const key = cacheKey(symbol, timeframe, outputsize);
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.bars.map(bar => ({ ...bar }));

  const response = await marketApi.candles({
    symbol: String(symbol || '').toUpperCase(),
    timeframe: backendTimeframe(timeframe),
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
