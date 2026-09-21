import { normalizeCandleSeries } from './candleNormalization.js';

export function prependHistoricalCandles(existing = [], older = [], maxBars = 10_000) {
  const current = normalizeCandleSeries(existing);
  const boundedMax = Math.max(1, Number(maxBars) || 1);
  // Existing/live data comes last so it wins on a boundary overlap.
  const merged = normalizeCandleSeries([...(older || []), ...current]);
  const bounded = merged.length > boundedMax ? merged.slice(-boundedMax) : merged;
  return {
    bars: bounded,
    added: Math.max(0, bounded.length - current.length),
  };
}

export function reconcileLatestCandles(existing = [], latest = [], maxBars = 10_000) {
  const boundedMax = Math.max(1, Number(maxBars) || 1);
  // Refreshed authoritative history comes last so it replaces stale overlap.
  const merged = normalizeCandleSeries([...(existing || []), ...(latest || [])]);
  return merged.length > boundedMax ? merged.slice(-boundedMax) : merged;
}
