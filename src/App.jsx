import React, { useMemo, useState } from 'react';
import TradingTerminalV2 from './pages/TradingTerminalV2.jsx';
import { useMarketData } from './hooks/useMarketData.js';

const seedMarkets = [
  { symbol: 'AUDCAD', bid: '0.99368', ask: '0.99373', change: '+0.05%' },
  { symbol: 'EURUSD', bid: '1.08421', ask: '1.08424', change: '+0.06%' },
  { symbol: 'GBPUSD', bid: '1.26903', ask: '1.26907', change: '-0.12%' },
  { symbol: 'USDJPY', bid: '156.284', ask: '156.291', change: '+0.21%' },
  { symbol: 'XAUUSD', bid: '2648.30', ask: '2648.60', change: '+0.34%' },
  { symbol: 'US30', bid: '42,910', ask: '42,915', change: '+0.08%' },
];

export default function App() {
  const [activeSymbol, setActiveSymbol] = useState('AUDCAD');
  const { markets, activeTick } = useMarketData(seedMarkets, activeSymbol);
  const market = useMemo(
    () => markets.find(item => item.symbol === activeSymbol) || seedMarkets[0],
    [markets, activeSymbol],
  );

  return (
    <TradingTerminalV2
      market={market}
      tick={activeTick}
      markets={markets}
      activeSymbol={activeSymbol}
      onSelectSymbol={setActiveSymbol}
    />
  );
}
