import { useMemo } from 'react';

// GoCharting owns live chart data in V1. The surrounding terminal quote controls
// remain seed/demo state until a supported same-feed quote subscription is exposed.
export function useMarketData(seedMarkets) {
  const markets = useMemo(() => seedMarkets, [seedMarkets]);
  return { markets, connected: false, source: 'demo-shell' };
}
