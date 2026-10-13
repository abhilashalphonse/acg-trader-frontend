import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import DesktopTerminal from './components/trading-v2/DesktopTerminal.jsx';
import './index.css';
import './styles/acg-pure-black.css';

// Deterministic full DesktopTerminal fixture. No credentials or executable orders.
const GBP={symbol:'GBPUSD',displaySymbol:'GBP/USD',assetClass:'FOREX',name:'British Pound / US Dollar',
  marketState:'LIVE',sessionOpen:true,isStale:false,marketDataAvailable:true,
  bid:1.2532,ask:1.2534,mid:1.2533,price:1.2533,pipSize:0.0001,quoteCurrency:'USD'};
const ACCOUNT={id:'qa-header-1',accountCode:'ACG-33E47A598D2F',accountType:'TRIAL',type:'TRIAL',status:'ACTIVE',
  currency:'USD',initialBalance:100000,startingBalance:100000,balance:100000,equity:100000,
  valuationStatus:'LIVE',tradingEnabled:true,leverage:100,freeMargin:100000};
function HeaderQA(){
 const [market,setMarket]=useState(GBP);
 const [timeframe,setTimeframe]=useState('30m');
 const [chartMode,setChartMode]=useState('candles');
 const [account,setAccount]=useState(ACCOUNT);
 const [favorite,setFavorite]=useState(false);
 const [selected,setSelected]=useState([]);
 const watchlists=useMemo(()=>({activeSymbols:favorite?[market.symbol]:[],
    toggleSymbol:()=>setFavorite(v=>!v)}),[favorite,market.symbol]);
 window.v4HeaderQA={
   get timeframe(){return timeframe;},get chartMode(){return chartMode;},
   get account(){return account.accountCode;},get selected(){return selected;},
   setSession(state){setMarket(m=>({...m,marketState:state,sessionOpen:state==='LIVE',
     isStale:state==='WAITING'}));}
 };
 return <DesktopTerminal market={market} tick={market} markets={[market]}
   activeSymbol={market.symbol} account={account} accounts={[account,{...ACCOUNT,id:'qa-header-2',accountCode:'ACG-33E47AD12A9C'}]}
   activeAccountId={account.id} watchlists={watchlists}
   timeframe={timeframe} onTimeframeChange={setTimeframe}
   chartMode={chartMode} onChartModeChange={setChartMode}
   onSelectAccount={id=>{setAccount(a=>({...a,id,accountCode:id==='qa-header-2'?'ACG-33E47AD12A9C':'ACG-33E47A598D2F'}));return true;}}
   onManualOrder={()=>{throw Error('Header QA must not place an order');}}
   onSelectSymbol={symbol=>setSelected(v=>[...v,symbol])}/>;
}
createRoot(document.getElementById('v4-header-fixture')).render(<HeaderQA/>);
