const TIMEFRAME_SECONDS = Object.freeze({
  S1: 1, S5: 5, S15: 15, S30: 30,
  M1: 60, M5: 300, M15: 900, M30: 1800,
  H1: 3600, H4: 14400, D1: 86400, W1: 604800,
  '1s': 1, '5s': 5, '15s': 15, '30s': 30,
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
  '1H': 3600, '4H': 14400, '1D': 86400, '1W': 604800,
});

export function drawingTimeframeSeconds(value) {
  return TIMEFRAME_SECONDS[String(value || '')] || 60;
}

function numericBars(bars = []) {
  return (Array.isArray(bars) ? bars : [])
    .map(bar => ({ ...bar, time: Number(bar?.time) }))
    .filter(bar => Number.isFinite(bar.time));
}

export function logicalToDrawingTime(logical, bars = [], timeframe = 'M1') {
  const index = Number(logical);
  if (!Number.isFinite(index)) return null;

  const series = numericBars(bars);
  if (!series.length) return null;

  const step = drawingTimeframeSeconds(timeframe);
  const lastIndex = series.length - 1;

  if (index <= 0) return series[0].time + index * step;
  if (index >= lastIndex) return series[lastIndex].time + (index - lastIndex) * step;

  const leftIndex = Math.floor(index);
  const rightIndex = Math.min(lastIndex, Math.ceil(index));
  if (leftIndex === rightIndex) return series[leftIndex].time;

  const left = series[leftIndex].time;
  const right = series[rightIndex].time;
  const fraction = index - leftIndex;
  return left + (right - left) * fraction;
}

export function drawingTimeToLogical(time, bars = [], timeframe = 'M1') {
  const target = Number(time);
  if (!Number.isFinite(target)) return null;

  const series = numericBars(bars);
  if (!series.length) return null;

  const step = drawingTimeframeSeconds(timeframe);
  const lastIndex = series.length - 1;
  const first = series[0].time;
  const last = series[lastIndex].time;

  if (target <= first) return (target - first) / step;
  if (target >= last) return lastIndex + (target - last) / step;

  let low = 0;
  let high = lastIndex;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value = series[mid].time;
    if (value === target) return mid;
    if (value < target) low = mid + 1;
    else high = mid - 1;
  }

  const leftIndex = Math.max(0, high);
  const rightIndex = Math.min(lastIndex, low);
  const left = series[leftIndex].time;
  const right = series[rightIndex].time;
  if (right <= left) return leftIndex;
  return leftIndex + (target - left) / (right - left);
}
