import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import DesktopTerminal from './components/trading-v2/DesktopTerminal.jsx';
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
const ACCOUNT=Object.freeze({id:'v4-positions-fixture',accountCode:'ACG-V4-POSITIONS',accountType:'TRIAL',type:'TRIAL',status:'ACTIVE',
 currency:'USD',initialBalance:100000,startingBalance:100000,balance:100000,equity:99999.17,
 valuationStatus:'LIVE',tradingEnabled:true,leverage:100,usedMargin:11.16,freeMargin:99988.01,floatingPnl:-0.83});
const POSITIONS=Object.freeze([
 {id:'position-eur-1',positionId:'position-eur-1',symbol:'EURUSD',side:'SELL',volume:0.01,entry:1.11652,closePrice:1.11735,
  pnl:-0.83,pnlCurrency:'USD',sl:null,tp:null,source:'live-account-currency',
  raw:{margin:'11.16',commissionPaid:'2.50',swapPaid:'-0.45',realizedPnl:'4.00',contractSize:'100000',openedAt:'2026-10-13T01:47:53.000Z',metadata:{executionSource:'Manual'},sourceOrderId:'order-eur-1'}},
 {id:'position-btc-2',positionId:'position-btc-2',symbol:'BTCUSD',side:'BUY',volume:0.02,entry:67800,closePrice:68100,
  pnl:6,pnlCurrency:'USD',sl:67000,tp:70000,source:'server-position-valuation',
  raw:{margin:'678.00',contractSize:'1',openedAt:'2026-10-13T02:30:00.000Z',sourceOrderId:'order-btc-2'}},
]);
function PositionsQA(){
 const [positions,setPositions]=useState(POSITIONS);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState(null);
 const [account,setAccount]=useState(ACCOUNT);
 const [symbol,setSymbol]=useState('EURUSD');
 const [commands,setCommands]=useState([]);
 const [retries,setRetries]=useState(0);
 const [protectionDraft,setProtectionDraft]=useState(null);
 const market=symbol==='BTCUSD'?BTC:EURO;
 const markets=useMemo(()=>[EURO,BTC],[]);
 window.v4PositionsQA={
  get commands(){return commands;},
  get retries(){return retries;},
  get positions(){return positions;},
  setPnl(id,pnl){setPositions(current=>current.map(p=>p.id===id?{...p,pnl}:p));},
  setLoading(value){setLoading(Boolean(value));},
  setError(value){setError(value);},
  setPositions(value){setPositions(value);},
  setAccount(value){setAccount(current=>({...current,...value}));},
 };
 return <DesktopTerminal market={market} tick={market} markets={markets} activeSymbol={symbol}
  onSelectSymbol={setSymbol} account={account} accounts={[account]} activeAccountId={account.id}
  positions={positions} journal={[{id:'journal-1',positionId:'position-eur-1',time:'01:47:53',message:'Local journal only'}]}
  positionActivityOrders={[{id:'order-eur-1',positionId:'position-eur-1',createdAt:'2026-10-13T01:47:52.000Z',side:'SELL',requestedVolume:'0.01',type:'MARKET'}]}
  positionActivityDeals={[{id:'deal-eur-1',positionId:'position-eur-1',executedAt:'2026-10-13T01:47:53.000Z',price:'1.11652',volume:'0.01',type:'OPEN'}]}
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
  onManualOrder={()=>{throw Error('Fixture must never place an order');}}
 />;
}
createRoot(document.getElementById('v4-positions-fixture')).render(
 <AuthProvider><TradingProvider><PositionsQA/></TradingProvider></AuthProvider>
);
