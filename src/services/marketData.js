import { marketApi } from '../api/market.js';
import { normalizeCandle, normalizeCandleSeries } from '../utils/candleNormalization.js';

export { normalizeCandle, normalizeCandleSeries };

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

export function mergeLiveCandleIntoSeries(series = [], bar, outputsize = 500) {
  const normalized = normalizeCandle(bar);
  const bars = normalizeCandleSeries(series);
  if (!normalized) return bars.slice(-outputsize);

  const last = bars[bars.length - 1];
  if (last?.time === normalized.time) {
    const providerCandidates = [last.providerVolume, normalized.providerVolume]
      .map(Number)
      .filter(value => Number.isFinite(value) && value > 0);
    const tickCandidates = [last.tickCount, normalized.tickCount]
      .map(Number)
      .filter(value => Number.isFinite(value) && value > 0);
    const providerVolume = providerCandidates.length ? Math.max(...providerCandidates) : null;
    const tickCount = tickCandidates.length ? Math.max(...tickCandidates) : 0;
    const volume = providerVolume ?? (tickCount > 0 ? tickCount : 0);
    const volumeSource = providerVolume != null ? 'provider' : tickCount > 0 ? 'tick' : null;

    bars[bars.length - 1] = {
      ...last,
      ...normalized,
      open: last.open,
      high: Math.max(last.high, normalized.high, normalized.open, normalized.close),
      low: Math.min(last.low, normalized.low, normalized.open, normalized.close),
      close: normalized.close,
      providerVolume,
      tickCount,
      volume,
      volumeSource,
      complete: false,
      synthetic: Boolean(last.synthetic && normalized.synthetic),
    };
  } else if (!last || normalized.time > last.time) {
    bars.push(normalized);
  }

  return bars.slice(-outputsize);
}

export function mergeLiveBarIntoCache(symbol, timeframe, bar, outputsize = 500) {
  const key = cacheKey(symbol, timeframe, outputsize);
  const cached = candleCache.get(key);
  if (!cached || !bar) return;
  const bars = mergeLiveCandleIntoSeries(cached.bars, bar, outputsize);
  candleCache.set(key, { savedAt: Date.now(), bars });
}
