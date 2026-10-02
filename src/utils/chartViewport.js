export const DEFAULT_CHART_VIEWPORT = Object.freeze({ top: 0.12, bottom: 0.16, bars: 42 });

export function normalizeChartViewport(value) {
  const bounded = (input, fallback, min, max) => input == null || input === '' || !Number.isFinite(Number(input))
    ? fallback : Math.min(max, Math.max(min, Number(input)));
  return {
    top: bounded(value?.top, DEFAULT_CHART_VIEWPORT.top, 0.02, 0.3),
    bottom: bounded(value?.bottom, DEFAULT_CHART_VIEWPORT.bottom, 0.02, 0.3),
    bars: Math.round(bounded(value?.bars, DEFAULT_CHART_VIEWPORT.bars, 20, 200)),
  };
}

// One authority for initial/reset zoom: bars visible, including the latest bar.
export function initialChartRange(length, bars, rightOffset) {
  const last = Math.max(0, length - 1);
  return { from: Math.max(0, last - bars + 1), to: last + rightOffset };
}
