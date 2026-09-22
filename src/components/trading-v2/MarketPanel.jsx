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
  pendingOrders = [],
  onModifyPending = () => {},
  onCancelPending = () => {},
  onUpdatePosition = () => {},
  showInstrumentHeader = true,
}) {
  return (
    <section className="overflow-hidden border-y border-white/[0.08] bg-black">
      {showInstrumentHeader && <InstrumentHeader market={market} favorite={favorite} onFavorite={() => setFavorite(v => !v)} onSelectInstrument={onSelectInstrument} />}
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
        instrument={market}
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
        pendingOrders={pendingOrders}
        onModifyPending={onModifyPending}
        onCancelPending={onCancelPending}
      />
    </section>
  );
}
