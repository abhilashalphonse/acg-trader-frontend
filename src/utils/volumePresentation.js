export function volumePoint(bar) {
  const value = bar?.volume;
  if (!Number.isFinite(value) || value < 0) return { time: bar.time };
  return {
    time: bar.time,
    value,
    color: bar.close >= bar.open ? 'rgba(45,211,155,0.65)' : 'rgba(255,95,105,0.65)',
  };
}

export function volumeLabel(bar) {
  const source = bar?.volumeSource || bar?.volumeMode;
  if (!Number.isFinite(bar?.volume) || source === 'unavailable') return 'Volume unavailable';
  if (source === 'tick') return 'Tick volume (price updates)';
  if (source === 'provider') return 'Provider volume';
  return 'Volume';
}

export function volumeValue(bar) {
  return Number.isFinite(bar?.volume) && bar.volume >= 0
    ? new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(bar.volume)
    : '—';
}
