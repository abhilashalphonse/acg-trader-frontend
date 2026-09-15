// ACG Trader V1 GoCharting boundary.
// The free attributed GoCharting chart owns its native market-data pipeline.

export const GOCHARTING_SYMBOLS = {
  AUDCAD: 'AUDCAD', EURUSD: 'EURUSD', GBPUSD: 'GBPUSD', USDJPY: 'USDJPY', XAUUSD: 'XAUUSD', US30: 'US30',
};
export const GOCHARTING_INTERVALS = { M1:'1', M5:'5', M15:'15', H1:'60', H4:'240', D1:'1D' };
export const toGoChartingSymbol = symbol => GOCHARTING_SYMBOLS[symbol] ?? symbol;
export const toGoChartingInterval = timeframe => GOCHARTING_INTERVALS[timeframe] ?? '1';

export function createGoChartingOptions({ symbol, timeframe, compact = false }) {
  return {
    symbol: toGoChartingSymbol(symbol),
    interval: toGoChartingInterval(timeframe),
    theme: 'dark',
    autosize: true,
    attribution: true,
    toolbar: !compact,
  };
}
