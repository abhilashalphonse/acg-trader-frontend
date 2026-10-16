import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { TradePlanOverlay } from './components/trading-v2/ChartArea.jsx';
import { createRoot } from 'react-dom/client';
import MobileAuditHeader from './components/trading-v2/MobileAuditHeader.jsx';
import MobileAuditExecutionDock from './components/trading-v2/MobileAuditExecutionDock.jsx';
import MobileAuditDrawingPalette from './components/trading-v2/MobileAuditDrawingPalette.jsx';
import { createDefaultTradePlan, effectiveTradePlan } from './utils/tradePlanExecution.js';
import { normalizeTradePlanPatch } from './utils/tradePlanNormalization.js';
import { resolveV4PositionSizing } from './utils/v4ExecutionPrecision.js';
import './index.css';
import './styles/acg-pure-black.css';

const account = Object.freeze({
  id: 'fixture-account', status: 'ACTIVE', currency: 'USD',
  balance: 100000, equity: 99987.99, freeMargin: 10000,
  floatingPnl: -12.01, leverage: 100,
});
const initialMarket = {
  symbol: 'EURUSD', displaySymbol: 'EUR/USD', assetClass: 'FOREX',
  sessionOpen: true, live: true, marketState: 'LIVE',
  bid: 1.12091, ask: 1.12092,
  tickSize: 0.00001, pipSize: 0.0001, volumeStep: 0.01,
  minVolume: 0.01, maxVolume: 10, contractSize: 100000,
  quoteCurrency: 'USD', marginCurrency: 'USD', pnlCurrency: 'USD',
  defaultLeverage: 100, commissionPerLotPerSide: 0,
};
// Deterministic chart coordinates exercise the actual mobile draft overlay;
// this fixture has no trading transport or credentials.
function FixtureChart({ market, account, plan, onChange, children }) {
  const chartRef = useRef(null);
  const [coordinates, setCoordinates] = useState(null);
  useEffect(() => {
    const chart = createChart(chartRef.current, { autoSize:true, layout:{ background:{color:'#09090b'}, textColor:'#96969f', fontSize:10 }, grid:{ vertLines:{color:'#141519'}, horzLines:{color:'#141519'} }, rightPriceScale:{minimumWidth:52}, timeScale:{timeVisible:true} });
    const series = chart.addSeries(CandlestickSeries, { upColor:'#2dd39b', downColor:'#f05d68', borderVisible:false, wickUpColor:'#2dd39b', wickDownColor:'#f05d68', priceFormat:{type:'price',precision:5,minMove:0.00001}, autoscaleInfoProvider:() => ({priceRange:{minValue:1.117,maxValue:1.126}}) });
    series.setData(Array.from({length:75}, (_, i) => {
      const close = 1.1208 + Math.sin(i / 8) * 0.0011;
      return {time:1792051200+i*900,open:close-0.00007,high:close+0.00012,low:close-0.00015,close};
    }));
    chart.timeScale().fitContent();
    const listeners = new Set();
    const notify = () => listeners.forEach(fn => fn());
    chart.timeScale().subscribeVisibleLogicalRangeChange(notify);
    const observer = new ResizeObserver(notify);
    observer.observe(chartRef.current);
    setCoordinates({priceToY:price => series.priceToCoordinate(price), yToPrice:y => series.coordinateToPrice(y), subscribe:fn => {listeners.add(fn);return () => listeners.delete(fn);} });
    return () => {observer.disconnect();chart.remove();};
  }, []);
  return <>
    <div ref={chartRef} className="absolute inset-0"/>
    <TradePlanOverlay plan={plan} instrument={market} account={account} accountCurrency={account.currency} coordinateApi={coordinates} onChange={onChange} auditStyle/>
    {children}
  </>;
}
function Demo() {
  const [market, setMarket] = useState(initialMarket);
  const [timeframe, setTimeframe] = useState('15m');
  const [plan, setPlan] = useState(null);
  const [pending, setPending] = useState(false);
  const [commands, setCommands] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [selectedTool, setSelectedTool] = useState('cursor');
  const locked = useRef(false);
  const withPlan = plan ? effectiveTradePlan(plan, market) : null;
  window.mobileAuditQA = {
    commands, attempts, stage: withPlan?.stage || 'idle',
    plan: withPlan, market, account, selectedTool,
    sizing: withPlan ? resolveV4PositionSizing({
      mode: withPlan.auditMode, amount: withPlan.auditValue,
      plan: withPlan, account, instrument: market,
    }) : null,
    updateQuotes: (bid, ask) => setMarket(prev => ({ ...prev, bid, ask })),
    editPlan: patch => setPlan(prev => prev ? {
      ...prev, ...normalizeTradePlanPatch(prev, patch, market), stage: 'planning',
    } : prev),
    closedPositions: 0,
  };
  const onStartPlan = (side, type, auditOptions) => {
    const created = createDefaultTradePlan({
      side, requestedType: type, market, lots: 0.01, protection: 'none',
    });
    setPlan(created ? { ...created, ...auditOptions, stage: 'planning' } : null);
  };
  const onChange = patch => setPlan(prev => prev ? {
    ...prev,
    ...normalizeTradePlanPatch(prev, patch, market),
    stage: patch.stage === 'review' ? 'review' : 'planning',
  } : prev);
  const onSubmit = async () => {
    if (locked.current || pending || !withPlan || withPlan.stage !== 'review') return;
    const sizing = resolveV4PositionSizing({
      mode: withPlan.auditMode, amount: withPlan.auditValue,
      plan: withPlan, account, instrument: market,
    });
    if (!sizing.canExecute) return;
    locked.current = true;
    setPending(true);
    setAttempts(n => n + 1);
    try {
      await new Promise(resolve => setTimeout(resolve, 140));
      setCommands(n => n + 1);
      setPlan(null);
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return <div className="acg-mobile-chart-shell acg-mobile-audit-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-black text-white">
    <MobileAuditHeader market={market} account={account} timeframe={timeframe} onTimeframe={setTimeframe}
      positionsCount={3} onSelectInstrument={() => {}} onOpenTrades={() => {}} onOpenAccount={() => {}}/>
    <div className="acg-mobile-reference-content flex min-h-0 flex-1 flex-col">
      <div data-audit-fixture-chart className="relative min-h-0 flex-1 bg-[#09090b]">
        <FixtureChart market={market} account={account} plan={withPlan} onChange={onChange}>
          <MobileAuditDrawingPalette selectedTool={selectedTool} onSelectTool={setSelectedTool}/>
        </FixtureChart>
      </div>
      <div className="acg-mobile-reference-order-wrap relative z-50 shrink-0 bg-[#101114] pb-[max(5px,env(safe-area-inset-bottom))]">
        <MobileAuditExecutionDock market={market} account={account} tradePlan={withPlan}
          onStartPlan={onStartPlan} onCancelPlan={() => setPlan(null)}
          onExecutePlan={onSubmit} onTradePlanChange={onChange}
          exposureAllowed commandPending={pending}/>
      </div>
    </div>
  </div>;
}
createRoot(document.getElementById('root')).render(<Demo/>);
