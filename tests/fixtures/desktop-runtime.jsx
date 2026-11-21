import React from 'react';
import { createRoot } from 'react-dom/client';
import DesktopTerminal from '../../src/components/trading-v2/DesktopTerminal.jsx';
import { AuthContext } from '../../src/auth/AuthProvider.jsx';
import { TradingContext } from '../../src/store/TradingProvider.jsx';
import '../../src/index.css';

// Completely local, read-only fixture; no auth tokens, order creation, or
// real trading data. Reproduce the desktop component tree at wide widths.
const market = {
  symbol:'BTCUSD',displaySymbol:'BTC/USD',name:'Bitcoin / US Dollar',assetClass:'CRYPTO',
  bid:60381.82,ask:60383.82,sessionOpen:true,marketState:'OPEN',isStale:false,
  tickSize:0.01,pipSize:0.01,volumeStep:0.01,minVolume:0.01,maxVolume:2,
  contractSize:1,quoteCurrency:'USD',pnlCurrency:'USD',leverage:2
};
const account = {
  id:'fixture-account',accountCode:'FIXTURE-ONLY',accountType:'DEMO',status:'ACTIVE',
  currency:'USD',balance:100000,equity:100000,freeMargin:100000,margin:0,
  floatingPnl:0,valuationStatus:'LIVE',leverage:2,tradingEnabled:true,
  capabilities:{},tradingPermissions:{},riskPolicy:{},challenge:{}
};
const noop = () => {};
const props = {
  market, tick:{symbol:'BTCUSD',bid:market.bid,ask:market.ask},markets:[market],
  activeSymbol:'BTCUSD',account,accounts:[account],activeAccountId:account.id,
  positions:[],positionHistory:[],pendingOrders:[],journal:[],
  watchlists:{activeList:null,isWatched:()=>false,toggleSymbol:noop,watchedSymbols:[]},
  timeframe:'15m',chartMode:'candles',selectedTool:'cursor',
  lots:0.01,sizingMode:'lots',riskPercent:0.5,orderType:'market',
  exposureAllowed:false,exposureBlockReason:'Fixture: commands always disabled',
  executionCommandPending:false,readOnly:false,
  onManualOrder:()=>{throw new Error('Test fixture must never place trades');},
  onExecutePlan:()=>{throw new Error('Test fixture must never place trades');},
  onClosePosition:()=>{throw new Error('Test fixture must never close trades');}
};
window.__acgDesktopFixtureErrors=[];
createRoot(document.getElementById('root'),{
  onUncaughtError:(error,info)=>{
    window.__acgDesktopFixtureErrors.push({
      message:error?.message||String(error),
      componentStack:info?.componentStack||''
    });
  }
}).render(
  <AuthContext.Provider value={{authenticated:true,accessToken:null,principal:null,logout:noop}}>
    <TradingContext.Provider value={{market:{candlesByKey:{}},connection:{status:'ready'},subscribeMarket:()=>noop}}>
      <DesktopTerminal {...props}/>
    </TradingContext.Provider>
  </AuthContext.Provider>
);
