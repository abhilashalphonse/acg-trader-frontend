import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import DesktopTerminal from './components/trading-v2/DesktopTerminal.jsx';
import {sampleWorkspaceReport} from '../tests/fixtures/aiWorkspaceReport.js';
import HelpCenter from './help/HelpCenter.jsx';
import {AuthProvider} from './auth/AuthProvider.jsx';
import {TradingProvider} from './store/TradingProvider.jsx';
import './index.css';
import './styles/acg-pure-black.css';

// Deterministic full-terminal fixture, no API calls or executable commands.
const EURO=Object.freeze({symbol:'EURUSD',displaySymbol:'EUR/USD',name:'Euro / US Dollar',assetClass:'FOREX',
 baseCurrency:'EUR',quoteCurrency:'USD',contractSize:100000,defaultLeverage:100,pipSize:0.0001,tickSize:0.00001,
 bid:1.11725,ask:1.11735,price:1.11730,sessionOpen:true,marketState:'LIVE',isStale:false,marketDataAvailable:true});
const BTC=Object.freeze({symbol:'BTCUSD',displaySymbol:'BTC/USD',name:'Bitcoin / US Dollar',assetClass:'CRYPTO',
 baseCurrency:'BTC',quoteCurrency:'USD',contractSize:1,defaultLeverage:2,tickSize:0.01,
 bid:68100,ask:68102,price:68101,sessionOpen:true,marketState:'LIVE',isStale:false,marketDataAvailable:true});
const GOLD=Object.freeze({symbol:'XAUUSD',displaySymbol:'XAUUSD',name:'Gold / US Dollar',assetClass:'METAL',
 baseCurrency:'XAU',quoteCurrency:'USD',contractSize:100,defaultLeverage:50,tickSize:0.01,
 bid:3881.77,ask:3882.05,price:3881.77,changePercent:0.10,
 sessionOpen:true,marketState:'LIVE',isStale:false,marketDataAvailable:true});
const PENDING=Object.freeze([{
 id:'pending-eur-1',accountId:'v4-positions-fixture',symbol:'EURUSD',side:'BUY',
 orderType:'stop-limit',volume:0.03,entry:1.12,stopPrice:1.12,limitPrice:1.1198,
 sl:1.115,tp:1.13,expiration:'GTC',status:'pending',
 raw:{createdAt:'2026-10-13T01:15:22.000Z'}
}]);
const ACCOUNT=Object.freeze({id:'v4-positions-fixture',accountCode:'ACG-V4-POSITIONS',accountType:'TRIAL',type:'TRIAL',status:'ACTIVE',
 currency:'USD',initialBalance:100000,startingBalance:100000,balance:100000,equity:99999.17,
 valuationStatus:'LIVE',tradingEnabled:true,leverage:100,usedMargin:11.16,freeMargin:99988.01,floatingPnl:-0.83});
const POSITIONS=Object.freeze([
 {id:'position-eur-1',positionId:'position-eur-1',symbol:'EURUSD',side:'SELL',volume:0.01,entry:1.11652,closePrice:1.11735,
  pnl:-0.83,pnlCurrency:'USD',sl:null,tp:null,valuationStatus:'LIVE',source:'live-account-currency',
  raw:{margin:'11.16',commissionPaid:'2.50',swapPaid:'-0.45',realizedPnl:'4.00',contractSize:'100000',openedAt:new Date(Date.now()-2*86400000).toISOString(),metadata:{executionSource:'Manual'},sourceOrderId:'order-eur-1'}},
 {id:'position-btc-2',positionId:'position-btc-2',symbol:'BTCUSD',side:'BUY',volume:0.02,entry:67800,closePrice:68100,
  pnl:6,pnlCurrency:'USD',sl:67000,tp:70000,source:'server-position-valuation',
  raw:{margin:'678.00',contractSize:'1',openedAt:new Date(Date.now()-2*86400000).toISOString(),sourceOrderId:'order-btc-2'}},
]);
const fixtureDaysAgo=days=>new Date(Date.now()-days*86400000).toISOString();
const HISTORY_FIXTURE=[
  {id:'closed-recent',symbol:'EURUSD',side:'BUY',volume:0.05,entry:1.10,closePrice:1.11,pnl:50,commission:2.0,swap:0,
    pnlCurrency:'USD',closeType:'CLOSED',raw:{closedAt:fixtureDaysAgo(3),openedAt:fixtureDaysAgo(4),commissionPaid:2.0,swapPaid:0}},
  {id:'closed-25d',symbol:'BTCUSD',side:'SELL',volume:0.02,entry:67000,closePrice:66900,pnl:2,
    pnlCurrency:'USD',closeType:'CLOSED',raw:{closedAt:fixtureDaysAgo(25),openedAt:fixtureDaysAgo(26)}},
  {id:'closed-old',symbol:'EURUSD',side:'SELL',volume:0.03,entry:1.12,closePrice:1.10,pnl:60,
    pnlCurrency:'USD',closeType:'CLOSED',raw:{closedAt:fixtureDaysAgo(50),openedAt:fixtureDaysAgo(51)}},
];
const JOURNAL_FIXTURE=[
 {id:'journal-current',type:'modify',timestamp:fixtureDaysAgo(2),time:'09:12:15',symbol:'EURUSD',
  message:'SL modification requested',positionId:'position-eur-1'},
 {id:'journal-old',type:'order',timestamp:fixtureDaysAgo(55),time:'07:44:19',
  message:'Old browser journal item',orderId:'old-order'}
];
const publicReview=new URLSearchParams(window.location.search).get('public_review')==='1';
// Browser-only acceptance fixture. Never provide staff capability in a built bundle.
const agentDrawingReview=import.meta.env.DEV&&publicReview&&new URLSearchParams(window.location.search).get('agent_drawing_review')==='1';
const drawingRuntime=agentDrawingReview?Object.freeze({runtimeMode:'WORKSPACE_CHAT',token:'synthetic-browser-only',sessionId:'b'.repeat(24),accountId:ACCOUNT.id}):null;
const accountReview=publicReview && new URLSearchParams(window.location.search).get('account_review')==='1';
// Synthetic account-switch test data; no API calls or real account mutations.
const ACCOUNT_REVIEW_EXTRA=Object.freeze([
  {id:'account-review-other',accountCode:'ACG-886426',accountType:'CHALLENGE',status:'ACTIVE',
   challenge:{phase:2},currency:'USD',initialBalance:50000,balance:50050,equity:50045,
   floatingPnl:-5,valuationStatus:'LIVE',tradingEnabled:true},
  {id:'account-review-breached',accountCode:'ACG-ARCHIVE-001',accountType:'TRIAL',status:'BREACHED',
   challenge:{phase:1},currency:'USD',initialBalance:100000,balance:94400,equity:94400,
   floatingPnl:0,valuationStatus:'STALE',tradingEnabled:false},
  {id:'account-review-closed',accountCode:'ACG-ARCHIVE-002',accountType:'CHALLENGE',status:'CLOSED',
   currency:'USD',initialBalance:5000,balance:4900,equity:4900,
   floatingPnl:0,valuationStatus:'STALE',tradingEnabled:false},
]);
function PositionsQA(){
 const [positions,setPositions]=useState(POSITIONS);
 const [pending,setPending]=useState(PENDING);
 const [history,setHistory]=useState(HISTORY_FIXTURE);
 const [journal,setJournal]=useState(JOURNAL_FIXTURE);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [historyError,setHistoryError]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState(null);
 const [account,setAccount]=useState(ACCOUNT);
 const [symbol,setSymbol]=useState('EURUSD');
 const [orderType,setOrderType]=useState('market');
 const [lots,setLots]=useState(0.01);
 const [sizingMode,setSizingMode]=useState('lots');
 const [riskPercent,setRiskPercent]=useState(0.5);
 const [commands,setCommands]=useState([]);
 const [retries,setRetries]=useState(0);
 const [protectionDraft,setProtectionDraft]=useState(null);
 const [showHelp,setShowHelp]=useState(false);
 const market=symbol==='BTCUSD'?BTC:symbol==='XAUUSD'?GOLD:EURO;
 const accountOptions=accountReview?[ACCOUNT,...ACCOUNT_REVIEW_EXTRA]:[account];
 const markets=useMemo(()=>[EURO,BTC,GOLD],[]);
 if(!publicReview)window.v4PositionsQA={
  get commands(){return commands;},
  get retries(){return retries;},
  get positions(){return positions;},
  setPnl(id,pnl){setPositions(current=>current.map(p=>p.id===id?{...p,pnl}:p));},
  setLoading(value){setLoading(Boolean(value));},
  setError(value){setError(value);},
  setPositions(value){setPositions(value);},
  setPending(value){setPending(value);},
  setHistory(value){setHistory(value);},
  setJournal(value){setJournal(value);},
  setHistoryLoading(value){setHistoryLoading(Boolean(value));},
  setHistoryError(value){setHistoryError(value);},
  olderHistory(){return HISTORY_FIXTURE[2];},
  olderJournal(){return JOURNAL_FIXTURE[1];},
  setAccount(value){setAccount(current=>({...current,...value}));},
  setSymbol(value){setSymbol(value);},
 };
 return <>
 {publicReview&&<div role="status" style={{position:'relative',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',height:30,background:'#191B20',borderBottom:'1px solid #43464D',color:'#E5E6EA',font:'500 11px Inter,system-ui,sans-serif'}}>
  ACG Trader V4 · FULL TERMINAL DESIGN REVIEW · Simulated account · No real market data · Actions affect mock data only
 </div>}
 <DesktopTerminal staffAiPreview={agentDrawingReview} staffAiRuntime={drawingRuntime} aiReportFixture={import.meta.env.DEV?sampleWorkspaceReport:null} onOpenHelp={()=>setShowHelp(true)} readOnly={['BREACHED','CLOSED','DISABLED'].includes(account?.status)} market={market} tick={market} markets={markets} activeSymbol={symbol}
  onSelectSymbol={setSymbol} account={account} accounts={accountOptions} activeAccountId={account.id}
  onSelectAccount={id=>{
    if(!accountReview)return false;
    const next=accountOptions.find(item=>String(item.id)===String(id));
    if(!next)return false;
    setAccount({...next});
    return true;
  }}
   orderType={orderType} onOrderTypeChange={setOrderType}
   lots={lots} onLotsChange={setLots}
   sizingMode={sizingMode} onSizingModeChange={setSizingMode}
   riskPercent={riskPercent} onRiskPercentChange={setRiskPercent}
  positions={positions} pendingOrders={pending} positionHistory={history} journal={journal}
  historyLoading={historyLoading} historyError={historyError} onRetryHistory={()=>setHistoryError(null)}
  positionActivityOrders={[{id:'order-eur-1',positionId:'position-eur-1',createdAt:new Date(Date.now()-2*86400000).toISOString(),side:'SELL',requestedVolume:'0.01',type:'MARKET'}]}
  positionActivityDeals={[{id:'deal-eur-1',positionId:'position-eur-1',executedAt:new Date(Date.now()-2*86400000).toISOString(),price:'1.11652',volume:'0.01',type:'OPEN'}]}
  positionsLoading={loading} positionsError={error}
  onRetryPositions={()=>{setRetries(v=>v+1);setError(null);}}
  positionProtectionDraft={protectionDraft}
  onBeginPositionProtection={()=>true}
  onPositionProtectionDraftChange={patch=>setProtectionDraft(v=>({...v,...patch}))}
  onCancelPositionProtection={()=>setProtectionDraft(null)}
  onApplyPositionProtection={async()=>true}
  onClosePosition={async(id,percentage)=>{
   setCommands(v=>[...v,{id,percentage}]);
   setPositions(v=>v.filter(p=>p.id!==id));
   return true;
  }}
  onCancelPending={async id=>{
    if(publicReview)return false;
    const exists=pending.some(order=>String(order.id)===String(id));
    if(!exists)return false;
    setCommands(previous=>[...previous,{kind:'cancel-pending',id:String(id)}]);
    setPending(previous=>previous.filter(order=>String(order.id)!==String(id)));
    return true;
  }}
  onManualOrder={()=>{if(publicReview)return false;throw Error('Fixture must never place an order');}}
 />
 {showHelp && <HelpCenter desktop onClose={()=>setShowHelp(false)} symbol={symbol} timeframe="30m"/>}
 </>;
}
createRoot(document.getElementById('v4-positions-fixture')).render(
 <AuthProvider><TradingProvider><PositionsQA/></TradingProvider></AuthProvider>
);
