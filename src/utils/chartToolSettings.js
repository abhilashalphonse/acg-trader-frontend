import { canonicalTimeframeVisibility } from './drawingTools.js';

export const CHART_TIMEFRAMES = [['S1', '1s'], ['S5', '5s'], ['S15', '15s'], ['S30', '30s'], ['M1', '1m'], ['M5', '5m'], ['M15', '15m'], ['M30', '30m'], ['H1', '1h'], ['H4', '4h'], ['D1', '1D'], ['W1', '1W']];
export const INDICATOR_DETAILS = {
  ema: ['Exponential Moving Average', 'Tracks trend with greater weight on recent prices.'],
  sma: ['Simple Moving Average', 'Smooths price over a fixed number of bars.'],
  vwap: ['Volume Weighted Average Price', 'Average price weighted by available volume.'],
  bollinger: ['Bollinger Bands', 'A moving average surrounded by volatility bands.'],
  rsi: ['Relative Strength Index', 'Momentum on a scale from 0 to 100.'],
  macd: ['Moving Average Convergence Divergence', 'Trend momentum, signal line and histogram.'],
  atr: ['Average True Range', 'Measures volatility in price units.'],
  stochastic: ['Stochastic Oscillator', 'Compares the close with its recent trading range.'],
  volume: ['Volume', 'Volume supplied by the instrument’s data feed.'],
};

export function searchIndicators(library, query, category, favorites = []) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return library.filter(item => {
    if (category === 'Favorites' && !favorites.includes(item.id)) return false;
    if (!['All', 'Favorites'].includes(category) && item.category !== category) return false;
    const searchable = [item.id, item.name, item.shortName, item.category, ...(INDICATOR_DETAILS[item.id] || [])].join(' ').toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
}

export function validateIndicatorSettings(id, settings) {
  const fields = {
    ema: [['period', 1, 500]], sma: [['period', 1, 500]],
    rsi: [['period', 2, 200]], atr: [['period', 2, 200]],
    bollinger: [['period', 2, 200], ['deviation', 0.1, 10, true]],
    macd: [['fast', 1, 100], ['slow', 2, 200], ['signal', 1, 100]],
    stochastic: [['kPeriod', 2, 100], ['dPeriod', 1, 50]],
  }[id] || [];
  for (const [field, min, max, decimal] of fields) {
    const value = settings[field];
    if (value === '' || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max || (!decimal && !Number.isInteger(Number(value)))) {
      return `${field.replace(/([A-Z])/g, ' $1')} must be ${decimal ? 'a number' : 'a whole number'} between ${min} and ${max}.`;
    }
  }
  if (id === 'macd' && Number(settings.fast) >= Number(settings.slow)) return 'Fast length must be shorter than slow length.';
  if (id === 'rsi' || id === 'stochastic') {
    const { lowerGuide: lower, upperGuide: upper } = settings;
    if (lower === '' || upper === '' || !Number.isFinite(Number(lower)) || !Number.isFinite(Number(upper)) || Number(lower) < 0 || Number(upper) > 100 || Number(lower) >= Number(upper)) return 'Guide levels must increase from lower to upper, between 0 and 100.';
  }
  if (Array.isArray(settings.timeframeVisibility) && !settings.timeframeVisibility.length) return 'Select at least one timeframe.';
  return '';
}

export function settingsForSave(settings) {
  const next = { ...settings, timeframeVisibility: canonicalTimeframeVisibility(settings.timeframeVisibility) };
  for (const key of ['period', 'deviation', 'fast', 'slow', 'signal', 'kPeriod', 'dPeriod', 'lowerGuide', 'upperGuide']) {
    if (key in next) next[key] = Number(next[key]);
  }
  return next;
}

// Constraint is in screen space so it stays intuitive at every zoom level.
export function constrainDrawingPoint(anchor, point, enabled) {
  if (!enabled || !anchor || !point) return point;
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const distance = Math.hypot(dx, dy);
  return { x: anchor.x + Math.cos(angle) * distance, y: anchor.y + Math.sin(angle) * distance };
}

export function drawingMagnetMode(mode, modifier) {
  return modifier ? (mode === 'off' ? 'weak' : 'off') : mode;
}

export function indicatorValueAt(points, time) {
  if (!points?.length) return null;
  if (time == null) return points[points.length - 1].value;
  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const point = points[middle];
    if (Number(point.time) === Number(time)) return point.value;
    if (Number(point.time) < Number(time)) low = middle + 1;
    else high = middle - 1;
  }
  // A gap or warmup bar must not display another candle's value.
  return null;
}
