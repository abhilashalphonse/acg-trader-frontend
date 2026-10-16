import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import MobileAuditHeader from './components/trading-v2/MobileAuditHeader.jsx';
import MobileAuditExecutionDock from './components/trading-v2/MobileAuditExecutionDock.jsx';
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
function Demo() {
  const [market, setMarket] = useState(initialMarket);
  const [timeframe, setTimeframe] = useState('15m');
  const [plan, setPlan] = useState(null);
  const [pending, setPending] = useState(false);
  const [commands, setCommands] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const locked = useRef(false);
  const withPlan = plan ? effectiveTradePlan(plan, market) : null;
  window.mobileAuditQA = {
    commands, attempts, stage: withPlan?.stage || 'idle',
    plan: withPlan, market, account,
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
  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-black text-white">
    <MobileAuditHeader market={market} account={account} timeframe={timeframe} onTimeframe={setTimeframe}
      positionsCount={3} onSelectInstrument={() => {}} onOpenTrades={() => {}} onOpenAccount={() => {}}/>
    <div data-audit-fixture-chart className="min-h-0 flex-1 bg-[#09090b]">
      <div className="flex h-full items-center justify-center text-[11px] text-[#767e87]">
        Live chart occupies this responsive area
      </div>
    </div>
    <MobileAuditExecutionDock market={market} account={account} tradePlan={withPlan}
      onStartPlan={onStartPlan} onCancelPlan={() => setPlan(null)}
      onExecutePlan={onSubmit} onTradePlanChange={onChange}
      exposureAllowed commandPending={pending}/>
    <div className="h-[max(5px,env(safe-area-inset-bottom))] shrink-0"/>
  </div>;
}
createRoot(document.getElementById('root')).render(<Demo/>);
