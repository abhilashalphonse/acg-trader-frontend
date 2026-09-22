import React from 'react';
import { X } from 'lucide-react';
import ChartControls, { mapTimeframe } from './ChartControls.jsx';
import ChartArea from './ChartArea.jsx';
import ExecutionPanel from './ExecutionPanel.jsx';
import PropRiskStrip from './PropRiskStrip.jsx';
import InstrumentAvatar from './InstrumentAvatar.jsx';

function displaySymbol(symbol = '') {
  if (symbol.length === 6) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}

export default function MobileScalperMode({
  market,
  tick,
  timeframe,
  setTimeframe,
  chartMode,
  setChartMode,
  selectedTool,
  setSelectedTool,
  lots,
  setLots,
  sizingMode,
  setSizingMode,
  riskPercent,
  setRiskPercent,
  orderType,
  setOrderType,
  tradePlan,
  tradePlanLots,
  onStartPlan,
  onCancelPlan,
  onExecutePlan,
  onModifyPlan,
  onManualOrder,
  onTradePlanChange,
  positions = [],
  pendingOrders = [],
  onModifyPending = () => {},
  onCancelPending = () => {},
  onUpdatePosition = () => {},
  onClosePosition = () => {},
  onIndicators = () => {},
  indicators = [],
  account,
  plannedRisk = 0,
  exposureAllowed = true,
  exposureBlockReason = 'New exposure is temporarily unavailable',
  onExit,
}) {
  const pipSize = Number(market?.pipSize);
  const bid = Number(market?.bid);
  const ask = Number(market?.ask);
  const spreadPips = Number.isFinite(pipSize) && pipSize > 0 && Number.isFinite(bid) && Number.isFinite(ask)
    ? Math.abs(ask - bid) / pipSize
    : null;
  const spread = Number.isFinite(spreadPips) ? `${spreadPips.toFixed(1)} pips` : '—';

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-black">
      <header className="acg-mobile-metal-surface shrink-0 bg-[#0b0b0d]/98 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <InstrumentAvatar instrument={market} size={30}/>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <strong className="truncate text-[15px] font-black tracking-[-0.025em] text-[#f5f8fb]">{market?.displaySymbol || displaySymbol(market?.symbol)}</strong>
                <span className="rounded-md border border-white/[0.08] bg-[#101010] px-1.5 py-0.5 text-[9px] font-extrabold text-[#59c8ff]">{timeframe}</span>
                {tradePlan && <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${tradePlan.side === 'buy' ? 'border-[#176347] bg-[#0d2f25] text-[#44dda9]' : 'border-[#6d2934] bg-[#31151d] text-[#ff6975]'}`}>{tradePlan.pending ? String(tradePlan.orderType).toUpperCase() : tradePlan.open ? (tradePlan.stage === 'modifying' ? 'MODIFYING' : 'OPEN') : 'PLANNING'} {tradePlan.side?.toUpperCase()}</span>}
              </div>
              <div className="mt-1 flex items-center gap-2.5 text-[9px] font-semibold text-[#74879c]"><span>Bid <b className="text-[#44dda9]">{market?.bid || '—'}</b></span><span>Ask <b className="text-[#ff6975]">{market?.ask || '—'}</b></span><span>Spread <b className="text-[#aebdcb]">{spread}</b></span></div>
            </div>
          </div>
          <button type="button" onClick={onExit} aria-label="Exit chart focus mode" className="grid size-9 shrink-0 place-items-center rounded-md bg-[#111114] text-[#93a5b7]"><X size={18}/></button>
        </div>
      </header>

      <div className="acg-mobile-metal-surface shrink-0 bg-[#0b0b0d] pt-2">
        <ChartControls timeframe={timeframe} onTimeframe={setTimeframe} chartMode={chartMode} onChartMode={setChartMode} fullscreen onFullscreen={onExit} onIndicators={onIndicators} focusMode disabled={Boolean(tradePlan && !tradePlan.open)} />
      </div>

      <div className="acg-mobile-chart-surface min-h-0 flex-1 bg-[#0b0b0d]">
        <ChartArea symbol={market?.symbol} instrument={market} chartTimeframe={mapTimeframe(timeframe)} tick={tick} price={market?.bid} ask={market?.ask} chartMode={chartMode} selectedTool={selectedTool} onSelectTool={tradePlan && !tradePlan.open ? () => {} : setSelectedTool} focusMode tradePlan={tradePlan} tradePlanLots={tradePlanLots} accountCurrency={account?.currency || 'USD'} onTradePlanChange={onTradePlanChange} indicators={indicators} positions={positions} pendingOrders={pendingOrders} onModifyPending={onModifyPending} onCancelPending={onCancelPending} onUpdatePosition={onUpdatePosition} onClosePosition={onClosePosition} />
      </div>

      <div className="shrink-0"><PropRiskStrip account={account} plannedRisk={plannedRisk} compact /></div>
      <ExecutionPanel market={market} account={account} exposureAllowed={exposureAllowed} exposureBlockReason={exposureBlockReason} lots={lots} onLotsChange={setLots} focusMode sizingMode={sizingMode} onSizingModeChange={setSizingMode} riskPercent={riskPercent} onRiskPercentChange={setRiskPercent} orderType={orderType} onOrderTypeChange={setOrderType} tradePlan={tradePlan} onStartPlan={onStartPlan} onCancelPlan={onCancelPlan} onExecutePlan={onExecutePlan} onModifyPlan={onModifyPlan} onManualOrder={onManualOrder} onTradePlanChange={onTradePlanChange} />
    </div>
  );
}
