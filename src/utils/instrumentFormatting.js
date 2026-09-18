function decimalPlacesFromStep(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const text = String(value).toLowerCase();
  if (text.includes('e-')) {
    const [coefficient, exponentText] = text.split('e-');
    const exponent = Number(exponentText);
    const fractional = coefficient.includes('.') ? coefficient.split('.')[1].length : 0;
    return Number.isFinite(exponent) ? exponent + fractional : null;
  }
  const point = text.indexOf('.');
  return point < 0 ? 0 : text.length - point - 1;
}

export function instrumentDigits(instrument, fallback = 5) {
  const explicit = Number(instrument?.digits);
  if (Number.isInteger(explicit) && explicit >= 0 && explicit <= 12) return explicit;
  const tickDigits = decimalPlacesFromStep(instrument?.tickSize);
  if (Number.isInteger(tickDigits)) return Math.min(12, Math.max(0, tickDigits));
  const pipDigits = decimalPlacesFromStep(instrument?.pipSize);
  if (Number.isInteger(pipDigits)) return Math.min(12, Math.max(0, pipDigits));
  return fallback;
}

export function instrumentTickSize(instrument) {
  const tick = Number(instrument?.tickSize);
  if (Number.isFinite(tick) && tick > 0) return tick;
  const digits = instrumentDigits(instrument);
  return 10 ** -digits;
}

export function instrumentPipSize(instrument) {
  const pip = Number(instrument?.pipSize);
  if (Number.isFinite(pip) && pip > 0) return pip;
  return instrumentTickSize(instrument);
}

export function formatInstrumentPrice(value, instrument, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric.toFixed(instrumentDigits(instrument));
}

export function instrumentForSymbol(markets, symbol) {
  const key = String(symbol || '').toUpperCase();
  return (Array.isArray(markets) ? markets : []).find(item => String(item?.symbol || '').toUpperCase() === key) || null;
}
