import { useEffect, useMemo } from 'react';
import { normalizeCandle, toBackendTimeframe } from '../services/marketData.js';
import { useTraderAuth } from './useTraderAuth.js';
import { useTradingStore } from './useTradingStore.js';

export function useChartMarketData(symbol, uiTimeframe) {
  const { authenticated } = useTraderAuth();
  const { market, connection, subscribeMarket } = useTradingStore();
  const backendTimeframe = useMemo(() => {
    try {
      return toBackendTimeframe(uiTimeframe);
    } catch {
      return null;
    }
  }, [uiTimeframe]);
  const key = symbol && backendTimeframe ? `${String(symbol).toUpperCase()}:${backendTimeframe}` : null;

  useEffect(() => {
    if (!authenticated || !symbol || !backendTimeframe) return undefined;
    return subscribeMarket({
      quotes: [String(symbol).toUpperCase()],
      candles: [{ symbol: String(symbol).toUpperCase(), timeframe: backendTimeframe }],
    });
  }, [authenticated, backendTimeframe, subscribeMarket, symbol]);

  const candle = key ? normalizeCandle(market.candlesByKey[key]) : null;
  return {
    candle,
    backendTimeframe,
    realtimeReady: connection.status === 'ready',
  };
}
