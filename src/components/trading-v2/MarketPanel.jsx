import React from 'react';
import InstrumentHeader from './InstrumentHeader.jsx';
import ChartControls, { mapTimeframe } from './ChartControls.jsx';
import ChartArea from './ChartArea.jsx';

export default function MarketPanel({
  market,
  tick,
  timeframe,
  setTimeframe,
  chartMode,
  setChartMode,
  selectedTool,
  setSelectedTool,
  favorite,
  setFavorite,
  fullscreen,
  onFullscreen,
  tradePlan,
  onTradePlanChange,
  indicators = [],
  onSelectInstrument = () => {},
  onIndicators = () => {},
  positions = [],
  onUpdatePosition = () => {},
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#182938] bg-gradient-to-b from-[#0a141e] to-[#071019] shadow-[0_16px_45px_rgba(0,0,0,0.26)]">
      <InstrumentHeader market={market} favorite={favorite} onFavorite={() => setFavorite(v => !v)} onSelectInstrument={onSelectInstrument} />
      <ChartControls
        timeframe={timeframe}
        onTimeframe={setTimeframe}
        chartMode={chartMode}
        onChartMode={setChartMode}
        fullscreen={fullscreen}
        onFullscreen={onFullscreen}
        onIndicators={onIndicators}
        disabled={Boolean(tradePlan && !tradePlan.open)}
      />
      <ChartArea
        symbol={market.symbol}
        chartTimeframe={mapTimeframe(timeframe)}
        tick={tick}
        price={market.bid}
        ask={market.ask}
        chartMode={chartMode}
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
        tradePlan={tradePlan}
        onTradePlanChange={onTradePlanChange}
        onUpdatePosition={onUpdatePosition}
        indicators={indicators}
        positions={positions}
      />
    </section>
  );
}
