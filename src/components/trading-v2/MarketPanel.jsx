import React, { useState } from 'react';
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
  tradePlanLots,
  accountCurrency = 'USD',
  account = null,
  riskPercent = 0.5,
  onCreateRiskOrder = () => {},
  onTradePlanChange,
  indicators = [],
  onSelectInstrument = () => {},
  onIndicators = () => {},
  positions = [],
  pendingOrders = [],
  onModifyPending = () => {},
  onCancelPending = () => {},
  onUpdatePosition = () => {},
  onRemovePositionProtection = () => {},
  onRequestPositionProtection = null,
  onClosePosition = () => {},
  historicalPosition = null,
  onClearHistoricalPosition = () => {},
  selectedPositionId = null,
  onSelectPosition = () => {},
  positionProtectionDraft = null,
  onPositionProtectionDraftChange = () => {},
  showInstrumentHeader = true,
  compactMobileToolbar = false,
  auditMobile = false,
  onChartReadout,
  onMobileManagementChange,
  mobileTradeSelection,
  managementDisabled = false,
  onMovePending,
  onCancelPositionProtection,
  fillAvailableHeight = false,
}) {
  const [drawingToolbarOpen, setDrawingToolbarOpen] = useState(compactMobileToolbar);

  return (
    <section className={`relative overflow-hidden ${fillAvailableHeight ? 'flex h-full min-h-0 flex-col' : ''} ${auditMobile ? 'bg-black' : compactMobileToolbar ? 'acg-mobile-reference-chart-frame acg-mobile-metal-surface rounded-[14px] border border-white/[0.09] bg-[#081019]' : 'border border-white/[0.08] bg-black'}`}>
      {showInstrumentHeader && <InstrumentHeader market={market} favorite={favorite} onFavorite={() => setFavorite(v => !v)} onSelectInstrument={onSelectInstrument} />}
      {!auditMobile && <ChartControls
        timeframe={timeframe}
        onTimeframe={setTimeframe}
        chartMode={chartMode}
        onChartMode={setChartMode}
        fullscreen={fullscreen}
        onFullscreen={onFullscreen}
        onIndicators={onIndicators}
        drawingsOpen={drawingToolbarOpen}
        onToggleDrawings={() => setDrawingToolbarOpen(value => !value)}
        compactMobile={compactMobileToolbar}
      />}
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
        tradePlanLots={tradePlanLots}
        accountCurrency={accountCurrency}
        account={account}
        riskPercent={riskPercent}
        onCreateRiskOrder={onCreateRiskOrder}
        onTradePlanChange={onTradePlanChange}
        onUpdatePosition={onUpdatePosition}
        onRemovePositionProtection={onRemovePositionProtection}
        onRequestPositionProtection={onRequestPositionProtection}
        onClosePosition={onClosePosition}
        historicalPosition={historicalPosition}
        onClearHistoricalPosition={onClearHistoricalPosition}
        selectedPositionId={selectedPositionId}
        onSelectPosition={onSelectPosition}
        positionProtectionDraft={positionProtectionDraft}
        onPositionProtectionDraftChange={onPositionProtectionDraftChange}
        indicators={indicators}
        positions={positions}
        pendingOrders={pendingOrders}
        onModifyPending={onModifyPending}
        onCancelPending={onCancelPending}
        drawingToolbarOpen={compactMobileToolbar ? drawingToolbarOpen : true}
        drawingToolbarOverlay={compactMobileToolbar}
        mobileOverlayStyle={compactMobileToolbar}
        auditMobile={auditMobile}
        onChartReadout={onChartReadout}
        onMobileManagementChange={onMobileManagementChange}
        mobileTradeSelection={mobileTradeSelection}
        managementDisabled={managementDisabled}
        onMovePending={onMovePending}
        onCancelPositionProtection={onCancelPositionProtection}
        fillAvailableHeight={fillAvailableHeight}
      />
    </section>
  );
}
