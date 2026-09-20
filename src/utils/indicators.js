const BASE_STYLE = { color: '#53c7ff', width: 2, lineStyle: 'solid' };

export const INDICATOR_LIBRARY = [
  { id: 'ema', name: 'EMA', category: 'Trend', defaults: { period: 20, source: 'close', style: { ...BASE_STYLE, color: '#54c8ff' }, timeframeVisibility: 'all' }, favorite: true },
  { id: 'sma', name: 'Moving Average', shortName: 'SMA', category: 'Trend', defaults: { period: 20, source: 'close', style: { ...BASE_STYLE, color: '#f0c35c' }, timeframeVisibility: 'all' }, favorite: true },
  { id: 'vwap', name: 'VWAP', category: 'Trend', defaults: { source: 'hlc3', sessionReset: 'utc-day', style: { ...BASE_STYLE, color: '#b38cff' }, timeframeVisibility: 'all' }, favorite: true },
  { id: 'bollinger', name: 'Bollinger Bands', category: 'Volatility', defaults: { period: 20, deviation: 2, source: 'close', style: { ...BASE_STYLE, color: '#65b6df' }, midStyle: { ...BASE_STYLE, color: '#7f91a4', width: 1, lineStyle: 'dotted' }, timeframeVisibility: 'all' }, favorite: false },
  { id: 'rsi', name: 'RSI', category: 'Momentum', defaults: { period: 14, source: 'close', upperGuide: 70, lowerGuide: 30, style: { ...BASE_STYLE, color: '#b68cff' }, timeframeVisibility: 'all' }, favorite: true },
  { id: 'macd', name: 'MACD', category: 'Momentum', defaults: { fast: 12, slow: 26, signal: 9, source: 'close', style: { ...BASE_STYLE, color: '#55c8ff' }, signalStyle: { ...BASE_STYLE, color: '#ffb55f' }, timeframeVisibility: 'all' }, favorite: false },
  { id: 'atr', name: 'ATR', category: 'Volatility', defaults: { period: 14, style: { ...BASE_STYLE, color: '#f0ad5c' }, timeframeVisibility: 'all' }, favorite: true },
  { id: 'stochastic', name: 'Stochastic', category: 'Momentum', defaults: { kPeriod: 14, dPeriod: 3, upperGuide: 80, lowerGuide: 20, style: { ...BASE_STYLE, color: '#58d5ff' }, signalStyle: { ...BASE_STYLE, color: '#ff7fbd' }, timeframeVisibility: 'all' }, favorite: false },
  { id: 'volume', name: 'Volume', category: 'Volume', defaults: { timeframeVisibility: 'all' }, favorite: true },
];

function mergeSettings(definition, overrides = {}) {
  const defaults = definition?.defaults || {};
  return {
    ...defaults,
    ...overrides,
    style: { ...(defaults.style || {}), ...(overrides.style || {}) },
    midStyle: { ...(defaults.midStyle || {}), ...(overrides.midStyle || {}) },
    signalStyle: { ...(defaults.signalStyle || {}), ...(overrides.signalStyle || {}) },
  };
}

export function createIndicator(id, overrides = {}) {
  const definition = INDICATOR_LIBRARY.find(item => item.id === id);
  if (!definition) return null;
  return {
    instanceId: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id,
    name: definition.name,
    visible: true,
    settings: mergeSettings(definition, overrides),
  };
}

export function normalizeIndicator(indicator) {
  if (!indicator?.id) return null;
  const definition = INDICATOR_LIBRARY.find(item => item.id === indicator.id);
  if (!definition) return null;
  return {
    ...indicator,
    name: indicator.name || definition.name,
    visible: indicator.visible !== false,
    settings: mergeSettings(definition, indicator.settings || {}),
  };
}

export function indicatorVisibleOnTimeframe(indicator, timeframe) {
  if (!indicator || indicator.visible === false) return false;
  const visibility = indicator.settings?.timeframeVisibility ?? 'all';
  if (visibility === 'all' || visibility == null) return true;
  if (Array.isArray(visibility)) return visibility.includes(timeframe);
  return visibility === timeframe;
}

const valid = value => Number.isFinite(value);

export function sourceValues(bars, source = 'close') {
  return bars.map(bar => {
    const open = Number(bar.open);
    const high = Number(bar.high);
    const low = Number(bar.low);
    const close = Number(bar.close);
    if (source === 'open') return open;
    if (source === 'high') return high;
    if (source === 'low') return low;
    if (source === 'hl2') return (high + low) / 2;
    if (source === 'hlc3') return (high + low + close) / 3;
    if (source === 'ohlc4') return (open + high + low + close) / 4;
    return close;
  });
}

function smaValues(values, period) {
  const p = Math.max(1, Math.round(Number(period) || 1));
  const output = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const current = Number(values[i]);
    if (!valid(current)) continue;
    sum += current;
    if (i >= p) sum -= Number(values[i - p]) || 0;
    if (i >= p - 1) output[i] = sum / p;
  }
  return output;
}

function emaValues(values, period) {
  const p = Math.max(1, Math.round(Number(period) || 1));
  const output = Array(values.length).fill(null);
  if (!values.length) return output;
  if (p === 1) return values.map(value => valid(Number(value)) ? Number(value) : null);

  let seedSum = 0;
  let seedCount = 0;
  let seedIndex = -1;
  for (let i = 0; i < values.length; i += 1) {
    const value = Number(values[i]);
    if (!valid(value)) continue;
    seedSum += value;
    seedCount += 1;
    if (seedCount === p) {
      seedIndex = i;
      output[i] = seedSum / p;
      break;
    }
  }
  if (seedIndex < 0) return output;

  const alpha = 2 / (p + 1);
  let previous = output[seedIndex];
  for (let i = seedIndex + 1; i < values.length; i += 1) {
    const value = Number(values[i]);
    if (!valid(value)) continue;
    previous = value * alpha + previous * (1 - alpha);
    output[i] = previous;
  }
  return output;
}

function emaSparse(values, period) {
  const compact = [];
  const indices = [];
  values.forEach((value, index) => {
    if (valid(value)) {
      compact.push(Number(value));
      indices.push(index);
    }
  });
  const calculated = emaValues(compact, period);
  const output = Array(values.length).fill(null);
  calculated.forEach((value, compactIndex) => {
    if (valid(value)) output[indices[compactIndex]] = value;
  });
  return output;
}

function linePoints(bars, values) {
  return bars.flatMap((bar, index) => valid(values[index]) ? [{ time: bar.time, value: values[index] }] : []);
}

function rollingStd(values, period, means) {
  const p = Math.max(1, Math.round(Number(period) || 1));
  return values.map((_, index) => {
    if (index < p - 1 || !valid(means[index])) return null;
    let total = 0;
    for (let i = index - p + 1; i <= index; i += 1) {
      const diff = Number(values[i]) - means[index];
      total += diff * diff;
    }
    return Math.sqrt(total / p);
  });
}

function rsiValues(values, period) {
  const p = Math.max(2, Math.round(Number(period) || 14));
  const output = Array(values.length).fill(null);
  if (values.length <= p) return output;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= p; i += 1) {
    const delta = Number(values[i]) - Number(values[i - 1]);
    gain += Math.max(0, delta);
    loss += Math.max(0, -delta);
  }
  let avgGain = gain / p;
  let avgLoss = loss / p;
  output[p] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = p + 1; i < values.length; i += 1) {
    const delta = Number(values[i]) - Number(values[i - 1]);
    avgGain = ((avgGain * (p - 1)) + Math.max(0, delta)) / p;
    avgLoss = ((avgLoss * (p - 1)) + Math.max(0, -delta)) / p;
    output[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return output;
}

function atrValues(bars, period) {
  const p = Math.max(2, Math.round(Number(period) || 14));
  const tr = bars.map((bar, index) => {
    if (index === 0) return Number(bar.high) - Number(bar.low);
    const previousClose = Number(bars[index - 1].close);
    return Math.max(Number(bar.high) - Number(bar.low), Math.abs(Number(bar.high) - previousClose), Math.abs(Number(bar.low) - previousClose));
  });
  const output = Array(bars.length).fill(null);
  if (tr.length < p) return output;
  let current = tr.slice(0, p).reduce((sum, value) => sum + value, 0) / p;
  output[p - 1] = current;
  for (let i = p; i < tr.length; i += 1) {
    current = ((current * (p - 1)) + tr[i]) / p;
    output[i] = current;
  }
  return output;
}

function sessionKey(time, reset = 'utc-day') {
  if (reset === 'none') return 'continuous';
  const numeric = Number(time);
  if (!Number.isFinite(numeric)) return String(time);
  const date = new Date(numeric * 1000);
  if (reset === 'utc-week') {
    const day = date.getUTCDay() || 7;
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1));
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function vwapValues(bars, source = 'hlc3', reset = 'utc-day') {
  const prices = sourceValues(bars, source);
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  let activeSession = null;
  return bars.map((bar, index) => {
    const nextSession = sessionKey(bar.time, reset);
    if (nextSession !== activeSession) {
      activeSession = nextSession;
      cumulativePV = 0;
      cumulativeVolume = 0;
    }
    const price = prices[index];
    const volume = Number(bar.volume);
    if (!valid(price) || !Number.isFinite(volume) || volume <= 0) return cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : null;
    cumulativePV += price * volume;
    cumulativeVolume += volume;
    return cumulativePV / cumulativeVolume;
  });
}

function stochasticValues(bars, kPeriod, dPeriod) {
  const kP = Math.max(2, Math.round(Number(kPeriod) || 14));
  const dP = Math.max(1, Math.round(Number(dPeriod) || 3));
  const k = bars.map((bar, index) => {
    if (index < kP - 1) return null;
    const window = bars.slice(index - kP + 1, index + 1);
    const highest = Math.max(...window.map(item => Number(item.high)));
    const lowest = Math.min(...window.map(item => Number(item.low)));
    const range = highest - lowest;
    return range === 0 ? 50 : ((Number(bar.close) - lowest) / range) * 100;
  });
  const d = Array(k.length).fill(null);
  for (let i = 0; i < k.length; i += 1) {
    if (i < dP - 1) continue;
    const window = k.slice(i - dP + 1, i + 1);
    if (window.some(value => !valid(value))) continue;
    d[i] = window.reduce((sum, value) => sum + value, 0) / dP;
  }
  return { k, d };
}

export function calculateIndicatorData(rawIndicator, bars) {
  if (!rawIndicator || !bars?.length) return null;
  const indicator = normalizeIndicator(rawIndicator);
  if (!indicator) return null;
  const settings = indicator.settings || {};
  const source = sourceValues(bars, settings.source || 'close');

  switch (indicator.id) {
    case 'ema': {
      const values = emaValues(source, settings.period);
      return { kind: 'overlay', lines: [{ key: 'ema', label: `EMA ${settings.period}`, data: linePoints(bars, values), style: settings.style }] };
    }
    case 'sma': {
      const values = smaValues(source, settings.period);
      return { kind: 'overlay', lines: [{ key: 'sma', label: `SMA ${settings.period}`, data: linePoints(bars, values), style: settings.style }] };
    }
    case 'vwap': {
      const values = vwapValues(bars, settings.source || 'hlc3', settings.sessionReset || 'utc-day');
      return { kind: 'overlay', lines: [{ key: 'vwap', label: 'VWAP', data: linePoints(bars, values), style: settings.style }] };
    }
    case 'bollinger': {
      const period = settings.period || 20;
      const deviation = Number(settings.deviation) || 2;
      const middle = smaValues(source, period);
      const std = rollingStd(source, period, middle);
      const upper = middle.map((value, i) => valid(value) && valid(std[i]) ? value + std[i] * deviation : null);
      const lower = middle.map((value, i) => valid(value) && valid(std[i]) ? value - std[i] * deviation : null);
      return { kind: 'overlay', lines: [
        { key: 'bb-upper', label: 'BB Upper', data: linePoints(bars, upper), style: settings.style },
        { key: 'bb-mid', label: `BB ${period}`, data: linePoints(bars, middle), style: settings.midStyle },
        { key: 'bb-lower', label: 'BB Lower', data: linePoints(bars, lower), style: settings.style },
      ] };
    }
    case 'rsi': {
      const values = rsiValues(source, settings.period || 14);
      return { kind: 'oscillator', min: 0, max: 100, guides: [Number(settings.lowerGuide ?? 30), Number(settings.upperGuide ?? 70)], lines: [{ key: 'rsi', label: `RSI ${settings.period || 14}`, data: linePoints(bars, values), style: settings.style }] };
    }
    case 'atr': {
      const values = atrValues(bars, settings.period || 14);
      return { kind: 'oscillator', lines: [{ key: 'atr', label: `ATR ${settings.period || 14}`, data: linePoints(bars, values), style: settings.style }] };
    }
    case 'macd': {
      const fast = emaValues(source, settings.fast || 12);
      const slow = emaValues(source, settings.slow || 26);
      const macd = source.map((_, i) => valid(fast[i]) && valid(slow[i]) ? fast[i] - slow[i] : null);
      const signal = emaSparse(macd, settings.signal || 9);
      const histogram = macd.map((value, i) => valid(value) && valid(signal[i]) ? value - signal[i] : null);
      return {
        kind: 'macd',
        lines: [
          { key: 'macd', label: `MACD ${settings.fast || 12}/${settings.slow || 26}`, data: linePoints(bars, macd), style: settings.style },
          { key: 'signal', label: `Signal ${settings.signal || 9}`, data: linePoints(bars, signal), style: settings.signalStyle },
        ],
        histogram: bars.flatMap((bar, i) => valid(histogram[i]) ? [{ time: bar.time, value: histogram[i] }] : []),
      };
    }
    case 'stochastic': {
      const values = stochasticValues(bars, settings.kPeriod || 14, settings.dPeriod || 3);
      return { kind: 'oscillator', min: 0, max: 100, guides: [Number(settings.lowerGuide ?? 20), Number(settings.upperGuide ?? 80)], lines: [
        { key: 'stoch-k', label: `%K ${settings.kPeriod || 14}`, data: linePoints(bars, values.k), style: settings.style },
        { key: 'stoch-d', label: `%D ${settings.dPeriod || 3}`, data: linePoints(bars, values.d), style: settings.signalStyle },
      ] };
    }
    case 'volume':
      return { kind: 'volume' };
    default:
      return null;
  }
}
