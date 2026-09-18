export function decimalPlaces(step) {
  const text = String(step ?? '');
  const point = text.indexOf('.');
  return point < 0 ? 0 : text.length - point - 1;
}

export function normalizeVolumeToStep(value, instrument, { rounding = 'floor' } = {}) {
  const step = Math.max(Number(instrument?.volumeStep) || 0.01, 0.00000001);
  const min = Math.max(Number(instrument?.minVolume) || step, step);
  const max = Math.max(Number(instrument?.maxVolume) || 100, min);
  const numeric = Number(value);
  const requested = Number.isFinite(numeric) && numeric > 0 ? numeric : min;
  const clamped = Math.min(max, Math.max(min, requested));
  const units = clamped / step;
  const snappedUnits = rounding === 'nearest'
    ? Math.round(units)
    : rounding === 'ceil'
      ? Math.ceil(units - 1e-10)
      : Math.floor(units + 1e-10);
  const normalized = Math.min(max, Math.max(min, snappedUnits * step));
  return Number(normalized.toFixed(decimalPlaces(step)));
}

export function normalizePriceToTick(value, instrument, direction = 'nearest') {
  if (value === null || value === undefined || value === '') return value;
  const numeric = Number(value);
  const tick = Number(instrument?.tickSize);
  if (!Number.isFinite(numeric) || !Number.isFinite(tick) || tick <= 0) return value;
  const units = numeric / tick;
  const snappedUnits = direction === 'down'
    ? Math.floor(units + 1e-10)
    : direction === 'up'
      ? Math.ceil(units - 1e-10)
      : Math.round(units);
  return Number((snappedUnits * tick).toFixed(decimalPlaces(instrument?.tickSize ?? tick)));
}

export function protectionDirection(side, field) {
  const isBuy = String(side || '').toUpperCase() === 'BUY';
  if (field === 'sl') return isBuy ? 'down' : 'up';
  if (field === 'tp') return isBuy ? 'up' : 'down';
  return 'nearest';
}

export function normalizeProtectionPrice(value, instrument, side, field) {
  return normalizePriceToTick(value, instrument, protectionDirection(side, field));
}

export function pendingPriceDirection(type, side, field = 'entry') {
  const normalizedType = String(type || '').replace('-', '_').toUpperCase();
  const isBuy = String(side || '').toUpperCase() === 'BUY';

  if (field === 'limit' && normalizedType === 'STOP_LIMIT') return isBuy ? 'up' : 'down';
  if (normalizedType === 'LIMIT') return isBuy ? 'down' : 'up';
  if (normalizedType === 'STOP' || normalizedType === 'STOP_LIMIT') return isBuy ? 'up' : 'down';
  return 'nearest';
}

export function normalizeTimeInForce(value) {
  const normalized = String(value || 'GTC').trim().toUpperCase();
  return ['GTC', 'TODAY', 'SPECIFIED'].includes(normalized) ? normalized : 'GTC';
}

export function normalizeExpiryToIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
