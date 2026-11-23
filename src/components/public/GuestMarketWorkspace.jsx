import React, {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight, CandlestickChart, ChartNoAxesCombined, ChevronDown, LockKeyhole, Menu, PanelRightClose, PanelRightOpen, X} from 'lucide-react';
import {TradingContext} from '../../store/TradingProvider.jsx';
import ChartArea from '../trading-v2/ChartArea.jsx';
import IndicatorManager from '../trading-v2/IndicatorManager.jsx';
import {createIndicator} from '../../utils/indicators.js';
import {GUEST_MARKETS,GUEST_TIMEFRAMES,makeGuestCandles} from '../../public/guestMarkets.js';
import './GuestMarketWorkspace.css';
import '../../styles/chart-tools.css';

const emptyTradingStore={
  market:{candlesByKey:{},historyRecoveryRevision:0},
  connection:{status:'guest'},
  subscribeMarket:()=>()=>{},
};
const SESSION_KEY='acg-trader-guest-indicators-v1';
const MAX_INDICATORS=12;
const DEFAULT_INDICATORS=['ema'];
const validIds=new Set(['ema','sma','rsi','macd','atr','stochastic','bollinger','vwap','volume']);
const readGuestIndicatorIds=()=>{
  try {
    const value=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
    if(Array.isArray(value))return value.filter(id=>validIds.has(id)).slice(0,MAX_INDICATORS);
  } catch {/* storage may be disabled */}
  return DEFAULT_INDICATORS;
};

export default function GuestMarketWorkspace() {
  const [symbol,setSymbol]=useState('EURUSD');
  const [timeframe,setTimeframe]=useState('M30');
  const [chartMode,setChartMode]=useState('candles');
  const [selectedTool,setSelectedTool]=useState('cursor');
  const [libraryOpen,setLibraryOpen]=useState(false);
  const [marketListOpen,setMarketListOpen]=useState(false);
  const [indicators,setIndicators]=useState(()=>readGuestIndicatorIds().map(id=>createIndicator(id)));
  const [favorites,setFavorites]=useState(['ema','rsi']);
  const [focus,setFocus]=useState(null);
  const instrument=GUEST_MARKETS.find(item=>item.symbol===symbol)||GUEST_MARKETS[0];
  const candles=useMemo(()=>makeGuestCandles(symbol,timeframe),[symbol,timeframe]);

  useEffect(()=>{
    document.title=instrument.displaySymbol+' · Explore Markets (sample data) | ACG Trader';
  },[instrument.displaySymbol]);
  useEffect(()=>{
    try{localStorage.setItem(SESSION_KEY,JSON.stringify(indicators.map(i=>i.id)))}catch{/* optional */}
  },[indicators]);
  const remove=id=>setIndicators(current=>current.filter(i=>i.instanceId!==id));
  const toggle=id=>setIndicators(current=>current.map(i=>i.instanceId===id?{...i,visible:i.visible===false}:i));
  const add=id=>setIndicators(current=>current.length>=MAX_INDICATORS?current:[...current,createIndicator(id)]);
  const update=(id,settings)=>setIndicators(current=>current.map(i=>i.instanceId===id?{...i,settings:{...i.settings,...settings}}:i));

  return <TradingContext.Provider value={emptyTradingStore}>
    <div className="acg-guest-workspace" data-acg-guest-workspace="true">
      <header className="acg-guest-header">
        <a href="/" className="acg-guest-brand" aria-label="ACG Trader landing page">
          <img src="/acg-tab-icon.svg?v=1" alt="" width="30" height="30"/>
          <span>ACG <span className="acg-guest-brand-muted">Trader</span></span>
        </a>
        <span className="acg-guest-state" aria-label="Guest workspace">Explore Markets <span>· Guest</span></span>
        <div className="acg-guest-header-actions">
          <a href="/terminal?acg_login=1" className="acg-guest-login">Log in</a>
          <a href="/?acg_auth=signup" className="acg-guest-primary" data-acg-gated="demo">Start Demo <ArrowUpRight size={15}/></a>
        </div>
      </header>
      <div className="acg-guest-disclaimer" role="status">
        <strong>SAMPLE CHART DATA</strong>
        <span>Illustrative prices and candles, not live or historical market quotes. Analysis tools are interactive; trading requires sign-in.</span>
      </div>
      <div className="acg-guest-toolbar">
        <div className="acg-guest-selector">
          <button type="button" className="acg-guest-market-button" aria-expanded={marketListOpen} aria-label="Select market"
            onClick={()=>setMarketListOpen(o=>!o)}>
            <ChartNoAxesCombined size={17}/>
            <strong>{instrument.displaySymbol}</strong><ChevronDown size={15}/>
          </button>
          {marketListOpen&&<div className="acg-guest-markets" role="group" aria-label="Select sample instrument">
            {GUEST_MARKETS.map(item=><button type="button" key={item.symbol} aria-pressed={symbol===item.symbol}
              onClick={()=>{setSymbol(item.symbol);setMarketListOpen(false);setSelectedTool('cursor')}}>{item.displaySymbol}<span>{item.name}</span></button>)}
          </div>}
        </div>
        <div className="acg-guest-timeframes" role="group" aria-label="Chart timeframe">
          {GUEST_TIMEFRAMES.map(item=><button type="button" key={item.key} aria-label={item.label}
            aria-pressed={timeframe===item.key} onClick={()=>setTimeframe(item.key)}>{item.label}</button>)}
        </div>
        <button type="button" className="acg-guest-action" aria-pressed={chartMode==='candles'} onClick={()=>setChartMode(m=>m==='candles'?'line':'candles')}><CandlestickChart size={16}/> <span>{chartMode==='candles'?'Candles':'Line'}</span></button>
        <button type="button" className="acg-guest-action acg-guest-indicators-toggle"
          aria-expanded={libraryOpen} aria-controls="acg-guest-indicator-sidebar"
          onClick={()=>setLibraryOpen(o=>!o)}>{libraryOpen?<PanelRightClose size={17}/>:<PanelRightOpen size={17}/>}<span>Indicators ({indicators.length})</span></button>
      </div>
      <main className="acg-guest-main">
        <section className="acg-guest-chart" aria-label="Interactive sample chart">
          <div className="acg-guest-chart-note">DRAW · EXPLORE · EXPERIMENT <span>Sample · {instrument.displaySymbol} · {GUEST_TIMEFRAMES.find(t=>t.key===timeframe)?.label}</span></div>
          <ChartArea symbol={symbol} drawingStorageSymbol={'GUEST_'+symbol}
            instrument={instrument} chartTimeframe={timeframe} chartMode={chartMode}
            guestCandles={candles} selectedTool={selectedTool} onSelectTool={setSelectedTool}
            indicators={indicators} onToggleIndicator={toggle} onRemoveIndicator={remove}
            onOpenIndicatorSettings={id=>{setFocus(id);setLibraryOpen(true)}}
            positions={[]} pendingOrders={[]} embedded desktopEnhanced
            chartSettings={{theme:'dark',timezone:'UTC'}}/>
        </section>
        {libraryOpen&&<aside className="acg-guest-library" id="acg-guest-indicator-sidebar" aria-label="Indicators">
          <div className="acg-guest-library-header">
            <strong>Indicators</strong>
            <button type="button" aria-label="Close indicators" onClick={()=>setLibraryOpen(false)}><X size={17}/></button>
          </div>
          <IndicatorManager applied={indicators} favorites={favorites} focusInstanceId={focus}
            onAdd={add} onRemove={remove} onToggleVisible={toggle} onUpdate={update}
            onToggleFavorite={id=>setFavorites(items=>items.includes(id)?items.filter(x=>x!==id):[...items,id])}
            onClearFocus={()=>setFocus(null)}/>
        </aside>}
      </main>
      <footer className="acg-guest-footer">
        <span>Guest drawings are saved only in this browser. No market orders or personal account data are available in guest mode.</span>
        <div><a href="/terminal?acg_connect_prop=1" data-acg-gated="account"><LockKeyhole size={13}/> Connect authorized account</a>
          <a href="/terminal?acg_login=1" data-acg-gated="save">Sign in to your account</a></div>
      </footer>
    </div>
  </TradingContext.Provider>;
}
