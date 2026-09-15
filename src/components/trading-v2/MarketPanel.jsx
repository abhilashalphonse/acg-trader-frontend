import React from 'react';
import InstrumentHeader from './InstrumentHeader.jsx';
import ChartControls, { mapTimeframe } from './ChartControls.jsx';
import ChartArea from './ChartArea.jsx';

export default function MarketPanel({ market, tick, timeframe, setTimeframe, selectedTool, setSelectedTool }) {
  return (
    <section className="v2-market-panel">
      <InstrumentHeader market={market}/>
      <ChartControls timeframe={timeframe} onTimeframe={setTimeframe}/>
      <ChartArea
        symbol={market.symbol}
        chartTimeframe={mapTimeframe(timeframe)}
        tick={tick}
        currentPrice={market.bid}
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
      />
    </section>
  );
}
