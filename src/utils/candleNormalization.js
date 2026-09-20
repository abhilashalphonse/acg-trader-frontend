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
