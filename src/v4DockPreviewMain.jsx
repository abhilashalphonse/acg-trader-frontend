import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ChevronDown,GripHorizontal,LockKeyhole,Monitor,PanelBottomClose,PanelBottomOpen} from 'lucide-react';
import PositionsDockV4 from './components/trading-v2/PositionsDockV4.jsx';
import PendingDockV4 from './components/trading-v2/PendingDockV4.jsx';
import ActivityDockV4 from './components/trading-v2/ActivityDockV4.jsx';
import './index.css';
import './styles/acg-pure-black.css';
import './v4DockPreview.css';

// Isolated, static, non-trading design review. No auth, fetch, websocket,
// account provisioning, backend commands or production session are present.
const BTC={symbol:'BTCUSD',displaySymbol:'BTC/USD',name:'Bitcoin / US Dollar',assetClass:'CRYPTO',
  baseCurrency:'BTC',quoteCurrency:'USD',contractSize:1,defaultLeverage:2,tickSize:0.01,
  bid:65548.26,ask:65550.26,price:65549.26,sessionOpen:true,marketState:'LIVE',isStale:false};
const GOLD={symbol:'XAUUSD',displaySymbol:'XAU/USD',name:'Gold / US Dollar',assetClass:'COMMODITY',
  baseCurrency:'XAU',quoteCurrency:'USD',contractSize:100,defaultLeverage:50,tickSize:0.01,
  bid:2683.4,ask:2683.75,price:2683.5,sessionOpen:true,marketState:'LIVE',isStale:false};
const MARKETS=[BTC,GOLD];
const ACCOUNT={id:'dock-preview-example',currency:'USD',balance:100000,equity:100432.5,
  usedMargin:3200,freeMargin:97232.5,floatingPnl:432.5,valuationStatus:'LIVE'};
const POSITIONS=[
  {id:'preview-btc',positionId:'preview-btc',symbol:'BTCUSD',side:'BUY',volume:0.01,
    entry:65000,closePrice:65548.26,pnl:287.4,pnlCurrency:'USD',sl:64000,tp:68000,
    valuationStatus:'LIVE',raw:{margin:'327.75',openedAt:'2026-11-14T08:23:00Z',sourceOrderId:'preview-order-btc'}},
  {id:'preview-gold',positionId:'preview-gold',symbol:'XAUUSD',side:'SELL',volume:0.10,
    entry:2698.10,closePrice:2683.4,pnl:145.1,pnlCurrency:'USD',sl:2715,tp:2650,
    valuationStatus:'LIVE',raw:{margin:'536.75',openedAt:'2026-11-14T12:12:00Z',sourceOrderId:'preview-order-gold'}},
];
const PENDING=[{id:'preview-pending',symbol:'BTCUSD',side:'BUY',orderType:'limit',volume:.02,
  entry:65000,limitPrice:65000,sl:64000,tp:67000,expiration:'GTC',status:'pending',
  raw:{createdAt:'2026-11-14T08:23:00Z'}}];
const HISTORY=[
 {id:'preview-closed-btc',symbol:'BTCUSD',side:'BUY',volume:.01,entry:64600,closePrice:65000,
  pnl:40,pnlCurrency:'USD',closeType:'CLOSED',raw:{openedAt:'2026-11-12T10:00:00Z',closedAt:'2026-11-13T10:00:00Z'}},
];
const JOURNAL=[{id:'preview-event',type:'modify',timestamp:'2026-11-14T12:18:00Z',
  time:'12:18:00',symbol:'XAUUSD',message:'Protection reviewed (sample only)',positionId:'preview-gold'}];

const CANDLES=[694,690,688,693,698,693,697,695,692,690,689,691,683,680,678,679,673,670,673,669,665,662,659,660,655,658,655,656,652,655];
const MINI_CANDLES=CANDLES.map((value,i)=>{
  const prev=i===0?value+3:CANDLES[i-1];
  const up=value>prev;
  const open=672-(prev-652)*4.1;
  const close=672-(value-652)*4.1;
  const y=Math.min(open,close),h=Math.max(3,Math.abs(open-close));
  return {x:42+i*30,up,y,h,wick:Math.max(6,h+15),mid:(open+close)/2};
});
function ChartSketch(){
 return <div className="dock-review-chart" aria-label="Decorative sample chart, not live market data">
  <div className="dock-review-chart-label">BTC/USD <span>1H</span><span className="chart-note">ILLUSTRATIVE CHART</span></div>
  <svg viewBox="0 0 950 370" preserveAspectRatio="none" aria-hidden="true">
   {MINI_CANDLES.map(({x,up,y,h,wick,mid},i)=><g key={i}>
     <path d={`M${x} ${mid-wick/2} V${mid+wick/2}`} stroke={up?'#109e8f':'#ed324c'} strokeWidth="1.4"/>
     <rect x={x-8} y={y} width="16" height={h} fill={up?'#109e8f':'#ed324c'}/>
   </g>)}
  </svg>
  <div className="dock-review-chart-watermark">ACG Trader</div>
 </div>;
}
const DEVICE_PRESETS=[['laptop','Laptop · 1024',1024],['desktop','Desktop · 1440',1440],['wide','Wide · 1920',1920]];
function Review(){
 const [tab,setTab]=useState('positions');
 const [preset,setPreset]=useState('desktop');
 const [customHeight,setCustomHeight]=useState(148);
 const [collapsed,setCollapsed]=useState(false);
 const [fullscreen,setFullscreen]=useState(false);
 const [selectedId,setSelectedId]=useState(null);
 const [selectedPending,setSelectedPending]=useState(null);
 const [historyScope,setHistoryScope]=useState(null);
 const drag=useRef(null);
 const chosen=DEVICE_PRESETS.find(item=>item[0]===preset)||DEVICE_PRESETS[1];
 const baseHeight=collapsed?44:customHeight;
 const effectiveHeight=fullscreen?400:baseHeight;
 const counts={positions:POSITIONS.length,orders:PENDING.length};
 const onTabChange=(next,scope)=>{
   setTab(next);setHistoryScope(next==='history'&&scope?scope:null);
 };
 const dragStart=event=>{
   if(collapsed||fullscreen)return;
   event.preventDefault();
   drag.current={y:event.clientY,height:customHeight};
   event.currentTarget.setPointerCapture(event.pointerId);
 };
 const dragMove=event=>{
   if(!drag.current)return;
   const delta=drag.current.y-event.clientY;
   setCustomHeight(Math.max(148,Math.min(420,Math.round(drag.current.height+delta))));
 };
 const dragEnd=()=>{drag.current=null;};
 const toggleExpanded=()=>{setCollapsed(false);setFullscreen(x=>!x);};
 const toggleCollapsed=()=>{setFullscreen(false);setCollapsed(x=>!x);};
 return <div className="dock-review-page">
  <header className="dock-review-top">
    <div className="dock-review-brand"><span className="dock-review-brand-mark">ACG</span>
      <div><strong>Trader</strong><small>V4 Positions workspace · design review</small></div></div>
    <div className="dock-review-notice"><LockKeyhole size={14} aria-hidden="true"/> Public read-only mock data · No sign-in required</div>
  </header>
  <section className="dock-review-settings">
    <div><strong>Responsive desktop preview</strong><p>Change width, switch tabs and views, or drag the top edge of the dock. No trading is enabled.</p></div>
    <div className="dock-review-device-list" aria-label="Review viewport widths">
      {DEVICE_PRESETS.map(([id,label])=><button type="button" key={id} aria-pressed={preset===id}
        className={preset===id?'is-active':''} onClick={()=>setPreset(id)}>{label}</button>)}
    </div>
  </section>
  <main className="dock-review-stage">
    <div className="dock-review-screen" style={{width:chosen[2]+'px',maxWidth:'100%'}}>
      <div className="dock-review-screen-header">
        <strong>BTC/USD</strong><ChevronDown size={13}/><span className="dock-review-market">● Sample market</span>
        <div className="dock-review-times">1m &nbsp; 5m &nbsp; 15m &nbsp; 30m &nbsp; <b>1H</b> &nbsp; 4H &nbsp; 1D</div>
        <span className="dock-review-account">ACG DEMO · REVIEW ONLY</span>
      </div>
      <ChartSketch/>
      {!collapsed&&!fullscreen&&<div className="dock-review-resize" role="separator" aria-label="Resize positions workspace"
        onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}
        tabIndex={0} onKeyDown={event=>{
         if(event.key==='ArrowUp'){event.preventDefault();setCustomHeight(h=>Math.min(420,h+12));}
         if(event.key==='ArrowDown'){event.preventDefault();setCustomHeight(h=>Math.max(148,h-12));}
        }}><GripHorizontal size={17}/></div>}
      <section className="dock-review-dock" style={{height:effectiveHeight}}>
        {tab==='positions'&&<PositionsDockV4 key="positions" positions={POSITIONS} markets={MARKETS}
          account={ACCOUNT} counts={counts} readOnly onTabChange={onTabChange}
          selectedPositionId={selectedId} onSelectPosition={setSelectedId} onToggleExpanded={toggleExpanded}
          expanded={fullscreen} collapsed={collapsed} compactDock={collapsed} />}
        {tab==='orders'&&<PendingDockV4 key="pending" orders={PENDING} markets={MARKETS}
          account={ACCOUNT} counts={counts} readOnly onTabChange={onTabChange}
          selectedOrderId={selectedPending} onInspect={setSelectedPending} onToggleExpanded={toggleExpanded}
          expanded={fullscreen} collapsed={collapsed} compactDock={collapsed} />}
        {(tab==='history'||tab==='journal')&&<ActivityDockV4 key="activity" tab={tab}
          positions={POSITIONS} markets={MARKETS} account={ACCOUNT} counts={counts}
          history={HISTORY} journal={JOURNAL} onTabChange={onTabChange}
          historyPositionFilter={historyScope} onClearHistoryPosition={()=>setHistoryScope(null)}
          expanded={fullscreen} onToggleExpanded={toggleExpanded} collapsed={collapsed} compactDock={collapsed}/>}
      </section>
      <div className="dock-review-bottom-controls">
       <button type="button" onClick={toggleCollapsed} aria-label={collapsed?'Open positions dock':'Collapse positions dock'}>
        {collapsed?<PanelBottomOpen size={15}/>:<PanelBottomClose size={15}/>}
        {collapsed?'Open dock':'Collapse dock'}
       </button>
       <span>Dock {effectiveHeight}px · Toolbar 44px · Positions 34–36px</span>
      </div>
    </div>
  </main>
  <p className="dock-review-footnote">This is the actual V4 Positions/Pending/Activity dock UI rendered with isolated mock data. It is not connected to the authenticated trading terminal, prices or order execution.</p>
 </div>;
}
createRoot(document.getElementById('v4-dock-preview-root')).render(<Review/>);
