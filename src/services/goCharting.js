// ACG Trader V1 GoCharting boundary.
// Vite exposes browser environment variables through import.meta.env.

export const GOCHARTING_DEMO_LICENSE = 'demo-550e8400-e29b-41d4-a716-446655440000';
export const GOCHARTING_LICENSE = import.meta.env.VITE_GOCHARTING_LICENSE || GOCHARTING_DEMO_LICENSE;

export const GOCHARTING_SYMBOLS = {
  AUDCAD: 'AUDCAD', EURUSD: 'EURUSD', GBPUSD: 'GBPUSD', USDJPY: 'USDJPY', XAUUSD: 'XAUUSD', US30: 'US30',
};

// SDK examples use m/h/D resolution notation.
export const GOCHARTING_INTERVALS = {
  M1: '1m', M5: '5m', M15: '15m', H1: '1h', H4: '4h', D1: '1D',
};

export const toGoChartingSymbol = symbol => GOCHARTING_SYMBOLS[symbol] ?? symbol;
export const toGoChartingInterval = timeframe => GOCHARTING_INTERVALS[timeframe] ?? '1m';

export function createGoChartingOptions({ symbol, timeframe, compact = false }) {
  return {
    symbol: toGoChartingSymbol(symbol),
    interval: toGoChartingInterval(timeframe),
    licenseKey: GOCHARTING_LICENSE,
    theme: 'dark',
    autosize: true,
    attribution: true,
    toolbar: !compact,
  };
}
