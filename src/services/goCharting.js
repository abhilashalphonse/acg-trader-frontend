// ACG Trader V1 GoCharting boundary.
// Verified against @gocharting/chart-sdk 1.0.66 and current GoCharting docs.
// The SDK requires a datafeed. UDFCompatibleDatafeed is a UDF client; it does
// not include GoCharting's Forex/CFD market data by itself.

import { UDFCompatibleDatafeed } from '@gocharting/chart-sdk';

export const GOCHARTING_DEMO_LICENSE = 'demo-550e8400-e29b-41d4-a716-446655440000';
export const GOCHARTING_LICENSE = import.meta.env.VITE_GOCHARTING_LICENSE || GOCHARTING_DEMO_LICENSE;

// Set this only when ACG has a documented GoCharting/partner UDF endpoint or
// its own UDF-compatible endpoint. Do not point it at the public demo WS.
export const GOCHARTING_UDF_URL = (import.meta.env.VITE_GOCHARTING_UDF_URL || '').replace(/\/+$/, '');

export const GOCHARTING_SYMBOLS = {
  AUDCAD: 'AUDCAD',
  EURUSD: 'EURUSD',
  GBPUSD: 'GBPUSD',
  USDJPY: 'USDJPY',
  XAUUSD: 'XAUUSD',
  US30: 'US30',
};

// SDK 1.0.66 normalizes these interval forms.
export const GOCHARTING_INTERVALS = {
  M1: '1m',
  M5: '5m',
  M15: '15m',
  H1: '1h',
  H4: '4h',
  D1: '1D',
};

export const toGoChartingSymbol = symbol => GOCHARTING_SYMBOLS[symbol] ?? symbol;
export const toGoChartingInterval = timeframe => GOCHARTING_INTERVALS[timeframe] ?? '1m';

let udfDatafeed;

export function getGoChartingDatafeed() {
  if (!GOCHARTING_UDF_URL) return null;
  if (!udfDatafeed) udfDatafeed = new UDFCompatibleDatafeed(GOCHARTING_UDF_URL);
  return udfDatafeed;
}

export function createGoChartingOptions({ symbol, timeframe, compact = false, datafeed }) {
  if (!datafeed) {
    throw new Error('ACG Trader: GoCharting requires a datafeed. Configure a documented UDF endpoint before mounting the chart.');
  }

  return {
    licenseKey: GOCHARTING_LICENSE,
    symbol: toGoChartingSymbol(symbol),
    interval: toGoChartingInterval(timeframe),
    datafeed,
    theme: 'dark',
    autosize: true,
    toolbar: !compact,
  };
}
