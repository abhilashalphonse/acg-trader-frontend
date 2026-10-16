import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { TradePlanOverlay } from './components/trading-v2/ChartArea.jsx';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import TradingChart from './components/TradingChart.jsx';
import { AuthContext } from './auth/AuthProvider.jsx';
import { TradingContext } from './store/TradingProvider.jsx';
import { mobileChartReadout } from './utils/mobileChartReadout.js';
import V4FullTerminalOrders from './components/trading-v2/v4/V4FullTerminalOrders.jsx';
import MobileAuditManageDock from './components/trading-v2/MobileAuditManageDock.jsx';
import { mobileProtectionPatch } from './utils/mobileAuditDraft.js';
import { buildChartPendingAmendment } from './utils/pendingOrderChartMove.js';
import './styles/mobileAuditSurfaces.css';
import MobileInstrumentSheet from './components/trading-v2/MobileInstrumentSheet.jsx';
import MobileTradesSheet from './components/trading-v2/MobileTradesSheet.jsx';
import MobileAccountSheet from './components/trading-v2/MobileAccountSheet.jsx';
import FrontendSheet from './components/trading-v2/FrontendSheet.jsx';
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
    {typeof children === 'function' ? children(coordinates, chartRef.current?.clientHeight || 480) : children}
  </>;
}
function Demo() {
  const [market, setMarket] = useState(initialMarket);
  const [chartMode,setChartMode]=useState('candles');
  const [managed,setManaged]=useState(false);
  const [recovery,setRecovery]=useState(false);
  const [checks,setChecks]=useState(0);
  const [fitCount,setFitCount]=useState(0);
  const [timeframe, setTimeframe] = useState('15m');
  const [plan, setPlan] = useState(null);
  const [pending, setPending] = useState(false);
  const [commands, setCommands] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [selectedTool, setSelectedTool] = useState('cursor');
  const [lastDestination, setLastDestination] = useState(null);
  const [readout, setReadout] = useState(() => mobileChartReadout({symbol:'EURUSD', timeframe:'M15', bar:{open:1.1208,close:1.12099}}));
  const locked = useRef(false);
  const withPlan = plan ? effectiveTradePlan(plan, market) : null;
  window.mobileAuditQA = {
    chartMode,fitCount,checks,setManaged,setRecovery,
    commands, attempts, stage: withPlan?.stage || 'idle', lastDestination, setReadout,
    chartChrome: auditMobile => renderToStaticMarkup(<AuthContext.Provider value={{authenticated:false}}><TradingContext.Provider value={{market:{candlesByKey:{}},connection:{status:'connected'}}}><TradingChart instrument={market} symbol={market.symbol} timeframe="M15" mobileReference auditMobile={auditMobile}/></TradingContext.Provider></AuthContext.Provider>),
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
    <MobileAuditHeader market={market} account={account} timeframe={timeframe} onTimeframe={setTimeframe} chartReadout={readout}
      positionsCount={3} onSelectInstrument={() => setLastDestination('markets')} onOpenTrades={() => setLastDestination('trades')} onOpenAccount={() => setLastDestination('account')}
      onOpenIndicators={() => setLastDestination('indicators')} onOpenSettings={() => setLastDestination('platform')} onOpenHelp={() => setLastDestination('help')}/>
    <div className="acg-mobile-reference-content flex min-h-0 flex-1 flex-col">
      <div data-audit-fixture-chart className="relative min-h-0 flex-1 bg-[#09090b]">
        <FixtureChart market={market} account={account} plan={withPlan} onChange={onChange}>
          <MobileAuditDrawingPalette tradePlanActive={Boolean(plan)} chartMode={chartMode} onChartMode={setChartMode} onFitView={()=>setFitCount(n=>n+1)} onResetView={()=>setFitCount(n=>n+1)} selectedTool={selectedTool} onSelectTool={setSelectedTool}/>
        </FixtureChart>
      </div>
      <div className="acg-mobile-reference-order-wrap relative z-50 shrink-0 bg-[#101114] pb-[max(5px,env(safe-area-inset-bottom))]">
        <div hidden={managed}><MobileAuditExecutionDock recoveryRequired={recovery} onCheckStatus={()=>setChecks(n=>n+1)} market={market} account={account} tradePlan={withPlan}
          onStartPlan={onStartPlan} onCancelPlan={() => setPlan(null)}
          onExecutePlan={onSubmit} onTradePlanChange={onChange}
          exposureAllowed commandPending={pending}/></div>{managed&&<div data-fixture-managed className="h-[118px]">Managing position</div>}
      </div>
    </div>
  </div>;
}
function ManagedDemo() {
  const [positions, setPositions] = useState([{id:'p1',symbol:'EURUSD',side:'SELL',volume:0.1,entry:1.122,sl:1.124,tp:1.118,pnl:12.34}]);
  const [orders, setOrders] = useState([{id:'o1',symbol:'EURUSD',side:'BUY',volume:0.2,entry:1.1189,limitPrice:1.1192,orderType:'stop-limit',status:'PENDING',sl:null,tp:null}]);
  const [draft, setDraft] = useState(null);
  const [management, setManagement] = useState(null);
  const [commands, setCommands] = useState([]);
  const [accountId, setAccountId] = useState(account.id);
  const [disabled, setDisabled] = useState(false);
  const [failure, setFailure] = useState(false);
  const [statusChecks,setStatusChecks]=useState(0);
  const [ack, setAck] = useState(null);
  const change = async (type, id, patch) => {
    if (failure==='unknown') {setAck({type,id,patch});const error=new Error('timeout');error.code='REQUEST_TIMEOUT';throw error;}
    if (failure) return false;
    setCommands(prev=>[...prev,{type,id,patch}]);
    setAck({type,id,patch});
    return true;
  };
  window.mobileManageQA = {positions,orders,commands,draft,management:management ? {objectType:management.objectType,id:management.owner.id,edit:management.edit} : null,
    setAccountId,setDisabled,setFailure,statusChecks,setPositions,setOrders,
    acknowledge:()=>{
      if (!ack) return;
      if (ack.type==='position') setPositions(prev=>prev.map(p=>p.id===ack.id?{...p,...ack.patch}:p));
      if (ack.type==='pending') setOrders(prev=>prev.map(p=>p.id===ack.id?{...p,entry:ack.patch.entry,limitPrice:ack.patch.limitPrice ?? p.limitPrice,sl:ack.patch.stopLoss,tp:ack.patch.takeProfit}:p));
      if (ack.type==='close') setPositions(prev=>ack.patch.percentage < 100 ? prev.map(p=>p.id===ack.id?{...p,volume:p.volume*(1-ack.patch.percentage/100)}:p) : prev.filter(p=>p.id!==ack.id));
      if (ack.type==='cancel') setOrders(prev=>prev.filter(p=>p.id!==ack.id));
      setAck(null);
    },
    removePosition:()=>setPositions([]),
  };
  return <div className="flex h-dvh flex-col overflow-hidden bg-black text-white">
    <div className="flex h-12 shrink-0 items-center px-4 text-[12px] font-semibold">EUR/USD · 15m <span className="ml-auto text-[10px] text-[#aab6c2]">Chart management</span></div>
    <div className="relative min-h-0 flex-1">
      <FixtureChart market={initialMarket} account={account} plan={null} onChange={()=>{}}>
        {(coordinateApi,height)=><V4FullTerminalOrders mobile account={{...account,id:accountId}} symbol="EURUSD" instrument={initialMarket} positions={positions} pendingOrders={orders} coordinateApi={coordinateApi} height={height}
          onMobileManagementChange={setManagement} managementDisabled={disabled}
          onCheckStatus={()=>setStatusChecks(n=>n+1)}
          onBreakEven={id=>change('position',id,{sl:positions.find(p=>p.id===id).entry})}
          onSetTrailing={(id,enabled,pips)=>change('position',id,{trailingEnabled:enabled,trailingPips:pips})}
          positionProtectionDraft={draft}
          onRequestPositionProtection={(id,field,price)=>{
            const owner=positions.find(p=>p.id===id);
            const base={...owner,positionId:id,side:owner.side.toLowerCase(),manualLots:owner.volume};
            setDraft({...base,...(price==null?mobileProtectionPatch(base,field,initialMarket):{[field]:price}),activeField:field});
          }}
          onPositionProtectionDraftChange={patch=>setDraft(prev=>({...prev,...patch}))}
          onCancelPositionProtection={()=>setDraft(null)}
          onUpdatePosition={(id,patch)=>change('position',id,patch)}
          onRemovePositionProtection={(id,field)=>change('position',id,{[field]:null})}
          onMovePending={(id,price,field)=>change('pending',id,buildChartPendingAmendment(orders.find(o=>o.id===id),price,field))}
          onClosePosition={(id,percentage)=>change('close',id,{percentage})} onCancelPending={id=>change('cancel',id,{})}/>}
      </FixtureChart>
    </div>
    <div className="shrink-0 bg-[#101114] pb-[5px]">{management ? <MobileAuditManageDock management={management} market={initialMarket} account={account}/> : <div data-manage-idle className="flex h-[118px] items-center justify-center text-[11px] text-[#aab6c2]">Tap a position or pending order on chart</div>}</div>
  </div>;
}
function SurfaceDemo({surface}) {
  const [chartMode,setChartMode]=useState('candles');
  const [timeframe,setTimeframe]=useState('15m');
  const [selected,setSelected]=useState(account.id);
  const [closed,setClosed]=useState(false);
  const [watched,setWatched]=useState([]);
  const [symbol,setSymbol]=useState(initialMarket.symbol);
  const [positions,setPositions]=useState([{id:'p1',symbol:'EURUSD',side:'BUY',volume:0.1,entry:1.12,pnl:4.32,sl:1.118,tp:1.124,margin:112,commission:0.5,swap:0,openedAtIso:new Date().toISOString()},{id:'p2',symbol:'GBPUSD',side:'SELL',volume:0.2,entry:1.31,pnl:-2.5,sl:null,tp:null,openedAtIso:new Date().toISOString()}]);
  const [pendingOrders,setPendingOrders]=useState([{id:'o1',symbol:'GBPUSD',side:'SELL',orderType:'limit',volume:0.2,entry:1.31,sl:1.32,tp:1.29,status:'PENDING',expiration:'GTC'}]);
  const [historyLoaded,setHistoryLoaded]=useState(true);
  const [historyError,setHistoryError]=useState(null);
  const [readOnly,setReadOnly]=useState(false);
  const [commands,setCommands]=useState([]);
  const [ack,setAck]=useState(null);
  const [destination,setDestination]=useState(null);
  const [failure,setFailure]=useState(false);
  const [checks,setChecks]=useState(0);
  const positionHistory=[{id:'h1',symbol:'EURUSD',side:'BUY',volume:0.1,entry:1.119,closePrice:1.12,pnl:12.34,commission:0.5,swap:-0.1,closedAtIso:new Date().toISOString(),openedAtIso:new Date(Date.now()-3600000).toISOString()},{id:'h2',symbol:'GBPUSD',side:'SELL',volume:0.2,entry:1.31,closePrice:1.32,pnl:-2.5,commission:0.4,swap:0,closedAtIso:new Date(Date.now()-35*86400000).toISOString()}];
  const historyOrders=[{id:'ho1',symbol:'EURUSD',side:'BUY',orderType:'limit',volume:0.02,entry:1.11,status:'CANCELLED',createdAt:new Date().toISOString(),cancelledAt:new Date().toISOString()}];
  const change=async(kind,id,percentage=100)=>{setCommands(prev=>[...prev,{kind,id,percentage}]);if(failure)return false;setAck({kind,id,percentage});return true;};
  const overview={...account,accountCode:'ACG-598D2F',accountType:'CHALLENGE',usedMargin:112,marginLevel:89274.99};
  window.mobileSurfacesQA={chartMode,timeframe,selected,closed,watched,symbol,commands,destination,checks,setHistoryLoaded,setHistoryError,setReadOnly,setFailure,positions,pendingOrders,
    acknowledge:()=>{if(!ack)return;if(ack.kind==='close')setPositions(prev=>ack.percentage===100?prev.filter(p=>p.id!==ack.id):prev.map(p=>p.id===ack.id?{...p,volume:p.volume*(1-ack.percentage/100)}:p));if(ack.kind==='cancel')setPendingOrders(prev=>prev.filter(o=>o.id!==ack.id));if(ack.kind==='be')setPositions(prev=>prev.map(p=>p.id===ack.id?{...p,sl:p.entry}:p));setAck(null);}};
  const markets=[{...initialMarket,name:'Euro / US Dollar',marketDataAvailable:true},{...initialMarket,symbol:'GBPUSD',displaySymbol:'GBP/USD',name:'British Pound / US Dollar',bid:1.3,ask:1.3001}];
  const prefs={chartMode,timeframe,lots:0.1,sizingMode:'riskPercent',sizingAmount:'0.5',orderType:'market'};
  if(closed)return <div data-surface-closed>Back on chart</div>;
  if(surface==='markets')return <MobileInstrumentSheet auditMobile markets={markets} activeSymbol={symbol} onSelectSymbol={setSymbol} onClose={()=>setClosed(true)} watchlists={{activeSymbols:watched,toggleSymbol:id=>setWatched(prev=>prev.includes(id)?prev.filter(v=>v!==id):[...prev,id])}}/>;
  if(surface==='trades')return <MobileTradesSheet auditMobile account={overview} positions={positions} pendingOrders={pendingOrders} positionHistory={positionHistory} historyOrders={historyOrders} historyLoaded={historyLoaded} historyError={historyError} readOnly={readOnly} markets={markets} onClose={()=>setClosed(true)} onRetryHistory={()=>{setHistoryError(null);setHistoryLoaded(true);}} onCheckStatus={()=>setChecks(n=>n+1)} onEditPositionOnChart={p=>setDestination({kind:'manage',id:p.id})} onModifyPending={id=>setDestination({kind:'pending',id})} onViewClosedPositionChart={p=>setDestination({kind:'history',id:p.id})} onOpenChart={s=>setDestination({kind:'chart',symbol:s})} onClosePosition={(id,pct)=>change('close',id,pct)} onCancelPending={id=>change('cancel',id)} onBreakEven={id=>change('be',id)}/>;
  if(surface==='accounts')return <MobileAccountSheet auditMobile account={overview} accounts={[overview,{...account,id:'second',accountCode:'ACG-SECOND',accountType:'DEMO'}]} activeAccountId={selected} onSelectAccount={setSelected} onPlatformSettings={()=>setDestination({kind:'settings'})} onHelp={()=>setDestination({kind:'help'})} onClose={()=>setClosed(true)}/>;
  return <FrontendSheet auditMobile type="platform" account={account} terminalPrefs={prefs} onChartModeChange={setChartMode} onTimeframeChange={setTimeframe} onClose={()=>setClosed(true)}/>;
}
const fixtureParams=new URLSearchParams(location.search);
createRoot(document.getElementById('root')).render(fixtureParams.has('surface') ? <SurfaceDemo surface={fixtureParams.get('surface')}/> : fixtureParams.has('manage') ? <ManagedDemo/> : <Demo/>);
