export const INDICATOR_LIBRARY = [
  { id: 'ema', name: 'EMA', category: 'Trend', defaults: { period: 20 }, favorite: true },
  { id: 'sma', name: 'Moving Average', shortName: 'SMA', category: 'Trend', defaults: { period: 20 }, favorite: true },
  { id: 'vwap', name: 'VWAP', category: 'Trend', defaults: {}, favorite: true },
  { id: 'bollinger', name: 'Bollinger Bands', category: 'Volatility', defaults: { period: 20, deviation: 2 }, favorite: false },
  { id: 'rsi', name: 'RSI', category: 'Momentum', defaults: { period: 14 }, favorite: true },
  { id: 'macd', name: 'MACD', category: 'Momentum', defaults: { fast: 12, slow: 26, signal: 9 }, favorite: false },
  { id: 'atr', name: 'ATR', category: 'Volatility', defaults: { period: 14 }, favorite: true },
  { id: 'stochastic', name: 'Stochastic', category: 'Momentum', defaults: { kPeriod: 14, dPeriod: 3 }, favorite: false },
  { id: 'volume', name: 'Volume', category: 'Volume', defaults: {}, favorite: true },
];

export function createIndicator(id, overrides = {}) {
  const definition = INDICATOR_LIBRARY.find(item => item.id === id);
  if (!definition) return null;
  return {
    instanceId: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id,
    name: definition.name,
    visible: true,
    settings: { ...definition.defaults, ...overrides },
  };
}

const closeValues = bars => bars.map(bar => Number(bar.close));
const valid = value => Number.isFinite(value);

function smaValues(values, period) {
  const p = Math.max(1, Math.round(Number(period) || 1));
  const output = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += Number(values[i]) || 0;
    if (i >= p) sum -= Number(values[i - p]) || 0;
    if (i >= p - 1) output[i] = sum / p;
  }
  return output;
}

function emaValues(values, period) {
  const p = Math.max(1, Math.round(Number(period) || 1));
  const alpha = 2 / (p + 1);
  const output = Array(values.length).fill(null);
  let previous = null;
  values.forEach((raw, index) => {
    const value = Number(raw);
    if (!valid(value)) return;
    previous = previous == null ? value : value * alpha + previous * (1 - alpha);
    output[index] = previous;
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
    return Math.max(
      Number(bar.high) - Number(bar.low),
      Math.abs(Number(bar.high) - previousClose),
      Math.abs(Number(bar.low) - previousClose),
    );
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

function vwapValues(bars) {
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  return bars.map(bar => {
    const typical = (Number(bar.high) + Number(bar.low) + Number(bar.close)) / 3;
    const volume = Number(bar.volume);
    if (!Number.isFinite(volume) || volume <= 0) return cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : null;
    cumulativePV += typical * volume;
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

export function calculateIndicatorData(indicator, bars) {
  if (!indicator || !bars?.length) return null;
  const settings = indicator.settings || {};
  const closes = closeValues(bars);

  switch (indicator.id) {
    case 'ema': {
      const values = emaValues(closes, settings.period);
      return { kind: 'overlay', lines: [{ key: 'ema', label: `EMA ${settings.period}`, data: linePoints(bars, values) }] };
    }
    case 'sma': {
      const values = smaValues(closes, settings.period);
      return { kind: 'overlay', lines: [{ key: 'sma', label: `SMA ${settings.period}`, data: linePoints(bars, values) }] };
    }
    case 'vwap': {
      const values = vwapValues(bars);
      return { kind: 'overlay', lines: [{ key: 'vwap', label: 'VWAP', data: linePoints(bars, values) }] };
    }
    case 'bollinger': {
      const period = settings.period || 20;
      const deviation = Number(settings.deviation) || 2;
      const middle = smaValues(closes, period);
      const std = rollingStd(closes, period, middle);
      const upper = middle.map((value, i) => valid(value) && valid(std[i]) ? value + std[i] * deviation : null);
      const lower = middle.map((value, i) => valid(value) && valid(std[i]) ? value - std[i] * deviation : null);
      return { kind: 'overlay', lines: [
        { key: 'bb-upper', label: 'BB Upper', data: linePoints(bars, upper) },
        { key: 'bb-mid', label: `BB ${period}`, data: linePoints(bars, middle) },
        { key: 'bb-lower', label: 'BB Lower', data: linePoints(bars, lower) },
      ] };
    }
    case 'rsi': {
      const values = rsiValues(closes, settings.period || 14);
      return { kind: 'oscillator', min: 0, max: 100, guides: [30, 70], lines: [{ key: 'rsi', label: `RSI ${settings.period || 14}`, data: linePoints(bars, values) }] };
    }
    case 'atr': {
      const values = atrValues(bars, settings.period || 14);
      return { kind: 'oscillator', lines: [{ key: 'atr', label: `ATR ${settings.period || 14}`, data: linePoints(bars, values) }] };
    }
    case 'macd': {
      const fast = emaValues(closes, settings.fast || 12);
      const slow = emaValues(closes, settings.slow || 26);
      const macd = closes.map((_, i) => valid(fast[i]) && valid(slow[i]) ? fast[i] - slow[i] : null);
      const signalInput = macd.map(value => valid(value) ? value : 0);
      const signal = emaValues(signalInput, settings.signal || 9).map((value, i) => valid(macd[i]) ? value : null);
      const histogram = macd.map((value, i) => valid(value) && valid(signal[i]) ? value - signal[i] : null);
      return {
        kind: 'macd',
        lines: [
          { key: 'macd', label: `MACD ${settings.fast || 12}/${settings.slow || 26}`, data: linePoints(bars, macd) },
          { key: 'signal', label: `Signal ${settings.signal || 9}`, data: linePoints(bars, signal) },
        ],
        histogram: bars.flatMap((bar, i) => valid(histogram[i]) ? [{ time: bar.time, value: histogram[i] }] : []),
      };
    }
    case 'stochastic': {
      const values = stochasticValues(bars, settings.kPeriod || 14, settings.dPeriod || 3);
      return { kind: 'oscillator', min: 0, max: 100, guides: [20, 80], lines: [
        { key: 'stoch-k', label: `%K ${settings.kPeriod || 14}`, data: linePoints(bars, values.k) },
        { key: 'stoch-d', label: `%D ${settings.dPeriod || 3}`, data: linePoints(bars, values.d) },
      ] };
    }
    case 'volume':
      return { kind: 'volume' };
    default:
      return null;
  }
}
