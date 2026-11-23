import React from 'react';
import {createRoot} from 'react-dom/client';
import {AuthContext} from '../../src/auth/AuthProvider.jsx';
import {TradingContext} from '../../src/store/TradingProvider.jsx';
import {AlertsProvider,useAlerts} from '../../src/components/alerts/AlertsWorkspace.jsx';
import TradingChart from '../../src/components/TradingChart.jsx';
import '../../src/index.css';
let rules=[];
const auth={authenticated:true,principal:{tenantId:'fixture',ownerExternalRef:'fixture'},ensureFreshAccessToken:async()=>'fixture-only'};
const candles=Array.from({length:120},(_,n)=>({time:Math.floor(Date.now()/60000)*60-(120-n)*60,open:3250+n*.1,high:3255+n*.1,low:3245+n*.1,close:3251+n*.1}));
window.fetch=async(input,options={})=>{
  const url=new URL(input),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
  let data={};
  if(url.pathname==='/v1/alerts/config')data={enabled:true,maxAlerts:100,pushPublicKey:null};
  else if(url.pathname==='/v1/alerts/history')data={events:[],gaps:[]};
  else if(url.pathname==='/v1/alerts'&&method==='GET')data={alerts:rules};
  else if(url.pathname==='/v1/alerts'&&method==='POST'){const r={...body,id:crypto.randomUUID(),status:'STARTING',monitoring:'STARTING',version:1};rules.push(r);data={alert:r};}
  else if(url.pathname.startsWith('/v1/alerts/')){const id=url.pathname.split('/')[3];if(method==='DELETE')rules=rules.filter(r=>r.id!==id);else{rules=rules.map(r=>r.id===id?{...r,...body,version:r.version+1}:r);data={alert:rules.find(r=>r.id===id)};}}
  else if(url.pathname.includes('/candles'))data={candles,pagination:{hasMore:false}};
  else throw new Error('Fixture blocks external requests');
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
};
function Launcher(){const alerts=useAlerts();return <button style={{position:'absolute',right:8,top:12,color:'#eee',padding:12}} disabled={!alerts.enabled} onClick={alerts.open}>Open alerts</button>;}
const instrument={symbol:'XAUUSD',digits:2,tickSize:.01,pipSize:.1};
createRoot(document.getElementById('root')).render(<AuthContext.Provider value={auth}><TradingContext.Provider value={{market:{candlesByKey:{}},connection:{status:'connected'},subscribeMarket:()=>()=>{}}}><AlertsProvider markets={[instrument,{symbol:'BTCUSD'}]} symbol="XAUUSD" onSelectSymbol={()=>{}}><div style={{height:'100dvh',background:'#08080a'}}><div style={{height:50,color:'#999',padding:15,fontFamily:'system-ui'}}>ACG Trader � Alerts test fixture</div><div style={{height:'calc(100dvh - 50px)',position:'relative'}}><TradingChart symbol="XAUUSD" instrument={instrument} timeframe="M1"/></div><Launcher/></div></AlertsProvider></TradingContext.Provider></AuthContext.Provider>);
