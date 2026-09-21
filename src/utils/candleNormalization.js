function nullableNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeEpochSeconds(value) {
  let numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  // Unix milliseconds are ~1e12 while Unix seconds are ~1e9.
  if (Math.abs(numeric) >= 100_000_000_000) numeric /= 1000;
  return Math.floor(numeric);
}

export function normalizeCandle(candle) {
  const time = normalizeEpochSeconds(
    candle?.time ?? (candle?.openTimeMs == null ? null : Number(candle.openTimeMs) / 1000),
  );
  const open = Number(candle?.open);
  const rawHigh = Number(candle?.high);
  const rawLow = Number(candle?.low);
  const close = Number(candle?.close);
  if (time == null || ![open, rawHigh, rawLow, close].every(Number.isFinite)) return null;

  // An inverted provider range is not a valid candle. Small body/range
  // inconsistencies are repaired so the wick always contains open and close.
  if (rawHigh < rawLow) return null;
  const high = Math.max(rawHigh, open, close);
  const low = Math.min(rawLow, open, close);

  const providerVolume = nullableNonNegativeNumber(candle?.providerVolume);
  const providerVolumeBaseline = nullableNonNegativeNumber(candle?.providerVolumeBaseline);
  const providerVolumeLiveAnchor = nullableNonNegativeNumber(candle?.providerVolumeLiveAnchor);
  const tickCount = nullableNonNegativeNumber(candle?.tickCount);
  const hasProviderActivity = providerVolume != null && providerVolume > 0;
  const hasTickActivity = tickCount != null && tickCount > 0;
  const volume = hasProviderActivity
    ? providerVolume
    : hasTickActivity
      ? tickCount
      : providerVolume ?? tickCount;
  const volumeSource = hasProviderActivity
    ? 'provider'
    : hasTickActivity
      ? 'tick'
      : providerVolume != null
        ? 'provider'
        : tickCount != null
          ? 'tick'
          : null;

  return {
    time,
    open,
    high,
    low,
    close,
    providerVolume,
    providerVolumeBaseline,
    providerVolumeLiveAnchor,
    tickCount,
    volume,
    volumeSource,
    complete: Boolean(candle?.complete),
    synthetic: Boolean(candle?.synthetic),
  };
}

export function normalizeCandleSeries(candles = []) {
  const byTime = new Map();
  for (const candle of Array.isArray(candles) ? candles : []) {
    const normalized = normalizeCandle(candle);
    if (normalized) byTime.set(normalized.time, normalized);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
