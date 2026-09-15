import { useMemo } from 'react';

// Chart candles and realtime ticks come from Twelve Data. The surrounding
// execution quotes remain demo state until they are wired to the broker feed.
export function useMarketData(seedMarkets) {
  const markets = useMemo(() => seedMarkets, [seedMarkets]);
  return { markets, connected: false, source: 'demo-execution-shell' };
}
