// ACG Trader V1 GoCharting boundary.
// The free attributed GoCharting chart owns its native market-data pipeline.
// Keep this module deliberately small so execution/account data remains separate.

export const GOCHARTING_SYMBOLS = {
  AUDCAD: 'AUDCAD',
  EURUSD: 'EURUSD',
  GBPUSD: 'GBPUSD',
  USDJPY: 'USDJPY',
  XAUUSD: 'XAUUSD',
  US30: 'US30',
};

export const GOCHARTING_INTERVALS = {
  M1: '1',
  M5: '5',
  M15: '15',
  H1: '60',
  H4: '240',
  D1: '1D',
};

export function toGoChartingSymbol(symbol) {
  return GOCHARTING_SYMBOLS[symbol] ?? symbol;
}

export function toGoChartingInterval(timeframe) {
  return GOCHARTING_INTERVALS[timeframe] ?? '1';
}

export function createGoChartingOptions({ symbol, timeframe, compact = false }) {
  return {
    symbol: toGoChartingSymbol(symbol),
    interval: toGoChartingInterval(timeframe),
    theme: 'dark',
    autosize: true,
    attribution: true,
    // No ACG datafeed is injected here. V1 intentionally uses GoCharting's
    // provided chart/data path wherever the SDK supports it.
    toolbar: !compact,
  };
}
