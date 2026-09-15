// ACG Trader V1 GoCharting boundary.
//
// V1 deliberately keeps GoCharting attribution visible and uses the public
// demo license while we validate the free attributed integration. The SDK
// still requires a Datafeed object, so market-data wiring stays isolated in
// goChartingDatafeed.js instead of leaking into the ACG terminal UI.

import { createGoChartingDatafeed } from './goChartingDatafeed.js';

export const GOCHARTING_DEMO_LICENSE = 'demo-550e8400-e29b-41d4-a716-446655440000';
export const GOCHARTING_LICENSE = import.meta.env.VITE_GOCHARTING_LICENSE || GOCHARTING_DEMO_LICENSE;

export const GOCHARTING_SYMBOLS = {
  AUDCAD: 'FOREX:CFD:AUDCAD',
  EURUSD: 'FOREX:CFD:EURUSD',
  GBPUSD: 'FOREX:CFD:GBPUSD',
  USDJPY: 'FOREX:CFD:USDJPY',
  XAUUSD: 'FOREX:CFD:XAUUSD',
  US30: 'FOREX:CFD:US30',
};

// Match the resolution strings used by GoCharting's official SDK demo datafeed.
export const GOCHARTING_INTERVALS = {
  M1: '1',
  M5: '5',
  M15: '15',
  H1: '60',
  H4: '240',
  D1: '1D',
};

export const toGoChartingSymbol = symbol => GOCHARTING_SYMBOLS[symbol] ?? symbol;
export const toGoChartingInterval = timeframe => GOCHARTING_INTERVALS[timeframe] ?? '1';

export function getGoChartingDatafeed() {
  return createGoChartingDatafeed();
}

export function createGoChartingOptions({ symbol, timeframe, compact = false, datafeed }) {
  if (!datafeed) throw new Error('ACG Trader: GoCharting requires a datafeed.');

  return {
    licenseKey: GOCHARTING_LICENSE,
    symbol: toGoChartingSymbol(symbol),
    interval: toGoChartingInterval(timeframe),
    datafeed,
    theme: 'dark',
    toolbar: !compact,
    // Keep GoCharting branding/attribution enabled for the free V1 path.
    attribution: true,
    debugLog: import.meta.env.DEV,
  };
}
