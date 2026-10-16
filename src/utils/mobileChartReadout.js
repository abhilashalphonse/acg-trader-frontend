// Candle change is the selected interval's open-to-close move, never day P&L.
export function mobileChartReadout({ symbol, timeframe, bar, inspecting = false }) {
  const valid = value => value != null && Number.isFinite(Number(value)) && Number(value) > 0;
  if (!bar || !valid(bar.open) || !valid(bar.close)) return null;
  return {
    symbol: String(symbol || '').toUpperCase(), timeframe,
    close: Number(bar.close),
    changePercent: (Number(bar.close) - Number(bar.open)) / Number(bar.open) * 100,
    inspecting,
  };
}
