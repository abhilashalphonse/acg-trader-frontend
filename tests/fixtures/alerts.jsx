import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthContext} from '../../src/auth/AuthProvider.jsx';
import {TradingContext} from '../../src/store/TradingProvider.jsx';
import {AlertsProvider,useAlerts} from '../../src/components/alerts/AlertsWorkspace.jsx';
import DesktopTerminal from '../../src/components/trading-v2/DesktopTerminal.jsx';
import MobileInstrumentSheet from '../../src/components/trading-v2/MobileInstrumentSheet.jsx';
import '../../src/index.css';
let rules=[];
const noop=()=>{};
const auth={authenticated:true,accessToken:null,principal:{tenantId:'fixture',ownerExternalRef:'fixture'},ensureFreshAccessToken:async()=>'fixture-only',logout:noop};
const markets=[
  {symbol:'EURUSD',displaySymbol:'EUR/USD',name:'Euro / US Dollar',assetClass:'FOREX',provider:'twelve-data',bid:1.10,ask:1.1002,last:1.1001,digits:5,tickSize:.00001,pipSize:.0001,volumeStep:.01,minVolume:.01,maxVolume:100,contractSize:100000,quoteCurrency:'USD',pnlCurrency:'USD',leverage:100,sessionOpen:true,marketState:'LIVE',live:true,isStale:false,chartEnabled:true,status:'ACTIVE'},
  {symbol:'BTCUSD',displaySymbol:'BTC/USD',name:'Bitcoin / US Dollar',assetClass:'CRYPTO',provider:'twelve-data',bid:60000,ask:60002,last:60001,digits:2,tickSize:.01,pipSize:.01,volumeStep:.01,minVolume:.01,maxVolume:2,contractSize:1,quoteCurrency:'USD',pnlCurrency:'USD',leverage:2,sessionOpen:true,marketState:'LIVE',live:true,isStale:false,chartEnabled:true,status:'ACTIVE'}
];
const account={id:'fixture',accountCode:'FIXTURE',accountType:'DEMO',status:'ACTIVE',currency:'USD',balance:100000,equity:100000,freeMargin:100000,margin:0,floatingPnl:0,valuationStatus:'LIVE',leverage:100,tradingEnabled:true,capabilities:{},tradingPermissions:{},riskPolicy:{},challenge:{}};
const watchlists={activeList:{id:'fixture',name:'Watchlist'},activeSymbols:['EURUSD','BTCUSD'],isWatched:()=>true,toggleSymbol:noop,watchedSymbols:['EURUSD','BTCUSD']};
const candles=Array.from({length:120},(_,n)=>({time:Math.floor(Date.now()/60000)*60-(120-n)*60,open:1.1,high:1.101,low:1.099,close:1.1001}));
const history=Array.from({length:60},(_,i)=>({id:(1000-i).toString(16).padStart(24,'0'),alertId:'past',readAt:i===55?null:new Date().toISOString(),createdAt:new Date().toISOString(),evidence:{symbol:'EURUSD',streamId:'twelve-data:EURUSD',condition:{type:'crosses_above',level:'1.10'},marketTimeMs:Date.now()-i*1000,priceSource:'last',observedPrice:'1.11',soundEnabled:true}}));
window.fetch=async(input,options={})=>{
  const url=new URL(input,location.href),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
  let data={};
  if(url.pathname==='/v1/alerts/config')data={enabled:true,maxAlerts:100,pushPublicKey:null};
  else if(url.pathname==='/v1/alerts/history/read'){for(const row of history)if(body.ids.includes(row.id))row.readAt=new Date().toISOString();}
  else if(url.pathname==='/v1/alerts/history'){const older=url.searchParams.has('before');data={events:older?history.slice(50):history.slice(0,50),gaps:[],nextBefore:older?null:history[49].id};}
  else if(url.pathname==='/v1/alerts'&&method==='GET')data={alerts:rules};
  else if(url.pathname==='/v1/alerts'&&method==='POST'){const r={...body,id:crypto.randomUUID(),status:'STARTING',monitoring:'STARTING',version:1};rules.push(r);data={alert:r};}
  else if(url.pathname.startsWith('/v1/alerts/')){const id=url.pathname.split('/')[3];if(method==='DELETE')rules=rules.filter(r=>r.id!==id);else{rules=rules.map(r=>r.id===id?{...r,...body,version:r.version+1}:r);data={alert:rules.find(r=>r.id===id)};}}
  else if(url.pathname.includes('/candles'))data={candles,pagination:{hasMore:false}};
  else if(url.pathname.includes('/quotes'))data={quotes:markets};
  else if(url.pathname.includes('/orders')&&method!=='GET')throw new Error('Fixture must never submit trades');
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
};
function MobileLauncher(){const a=useAlerts(),[open,setOpen]=useState(false);return <><button onClick={()=>a.open()} disabled={!a.enabled}>Open alerts</button><button onClick={()=>setOpen(true)}>Open watchlist</button>{open&&<MobileInstrumentSheet auditMobile markets={markets} activeSymbol="EURUSD" watchlists={watchlists} onClose={()=>setOpen(false)}/>}</>;}
function Fixture(){
  const [symbol,setSymbol]=useState('EURUSD'),mobile=new URLSearchParams(location.search).has('mobile');
  const market=markets.find(m=>m.symbol===symbol);
  return <AuthContext.Provider value={auth}><TradingContext.Provider value={{market:{candlesByKey:{}},connection:{status:'ready'},subscribeMarket:()=>noop}}>
    <AlertsProvider markets={markets} symbol={symbol} onSelectSymbol={setSymbol}>
      {mobile?<MobileLauncher/>:<DesktopTerminal market={market} tick={market} markets={markets} activeSymbol={symbol} onSelectSymbol={setSymbol} account={account} accounts={[account]} activeAccountId={account.id} watchlists={watchlists}
        exposureAllowed={false} exposureBlockReason="Fixture: trading disabled" onManualOrder={()=>{throw new Error('Trading forbidden');}}/>}
    </AlertsProvider>
  </TradingContext.Provider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
