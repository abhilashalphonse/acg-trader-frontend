import React from 'react';
import { X } from 'lucide-react';
import ChartControls, { mapTimeframe } from './ChartControls.jsx';
import ChartArea from './ChartArea.jsx';
import ExecutionPanel from './ExecutionPanel.jsx';
import PropRiskStrip from './PropRiskStrip.jsx';

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
  onStartPlan,
  onCancelPlan,
  onExecutePlan,
  onModifyPlan,
  onManualOrder,
  onTradePlanChange,
  positions = [],
  onUpdatePosition = () => {},
  onIndicators = () => {},
  indicators = [],
  account,
  plannedRisk = 0,
  onExit,
}) {
  const spread = Number.isFinite(market?.spread)
    ? `${(market.spread * 10000).toFixed(1)} pips`
    : '0.5 pips';

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#050b12]">
      <header className="shrink-0 border-b border-[#172838] bg-[#071019]/95 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="truncate text-[15px] font-black tracking-[-0.025em] text-[#f5f8fb]">{displaySymbol(market?.symbol)}</strong>
              <span className="rounded-md border border-[#1d3b50] bg-[#0e2638] px-1.5 py-0.5 text-[9px] font-extrabold text-[#59c8ff]">{timeframe}</span>
              {tradePlan && <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${tradePlan.side === 'buy' ? 'border-[#176347] bg-[#0d2f25] text-[#44dda9]' : 'border-[#6d2934] bg-[#31151d] text-[#ff6975]'}`}>{tradePlan.pending ? String(tradePlan.orderType).toUpperCase() : tradePlan.open ? (tradePlan.stage === 'modifying' ? 'MODIFYING' : 'OPEN') : 'PLANNING'} {tradePlan.side?.toUpperCase()}</span>}
            </div>
            <div className="mt-1 flex items-center gap-2.5 text-[9px] font-semibold text-[#74879c]"><span>Bid <b className="text-[#44dda9]">{market?.bid}</b></span><span>Ask <b className="text-[#ff6975]">{market?.ask}</b></span><span>Spread <b className="text-[#aebdcb]">{spread}</b></span></div>
          </div>
          <button type="button" onClick={onExit} aria-label="Exit chart focus mode" className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#1b2c3d] bg-[#0a151f] text-[#93a5b7] shadow-[inset_0_1px_rgba(255,255,255,0.025)]"><X size={18}/></button>
        </div>
      </header>

      <div className="shrink-0 bg-[#061019] pt-2">
        <ChartControls timeframe={timeframe} onTimeframe={setTimeframe} chartMode={chartMode} onChartMode={setChartMode} fullscreen onFullscreen={onExit} onIndicators={onIndicators} focusMode disabled={Boolean(tradePlan && !tradePlan.open)} />
      </div>

      <div className="min-h-0 flex-1 bg-[#061019]">
        <ChartArea symbol={market?.symbol} chartTimeframe={mapTimeframe(timeframe)} tick={tick} price={market?.bid} ask={market?.ask} chartMode={chartMode} selectedTool={selectedTool} onSelectTool={tradePlan && !tradePlan.open ? () => {} : setSelectedTool} focusMode tradePlan={tradePlan} onTradePlanChange={onTradePlanChange} onCommitProtection={onCommitProtection} indicators={indicators} />
      </div>

      <div className="shrink-0"><PropRiskStrip account={account} plannedRisk={plannedRisk} compact /></div>
      <ExecutionPanel market={market} lots={lots} onLotsChange={setLots} focusMode sizingMode={sizingMode} onSizingModeChange={setSizingMode} riskPercent={riskPercent} onRiskPercentChange={setRiskPercent} orderType={orderType} onOrderTypeChange={setOrderType} tradePlan={tradePlan} onStartPlan={onStartPlan} onCancelPlan={onCancelPlan} onExecutePlan={onExecutePlan} onModifyPlan={onModifyPlan} onManualOrder={onManualOrder} onTradePlanChange={onTradePlanChange} />
    </div>
  );
}
