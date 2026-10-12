import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/acg-pure-black.css';
import V4ChartOrderLayer from './components/trading-v2/v4/V4ChartOrderLayer.jsx';

// Design-review preview ONLY. Uses synthetic positions, never network,
// credentials, or an actual trading API. Not a production readiness test.
const DEMO_ACCOUNT = 'synthetic-review-only';
const DEMO_SYMBOL = 'BTCUSD';
const VIEW_HEIGHT = 580;
const toY = price => 50 + (86000 - Number(price)) / 10;
const initialPositions = [
  { id:'sell-001', symbol:DEMO_SYMBOL, status:'OPEN',side:'SELL',entry:83671,sl:85606.1,tp:81741.1,volume:0.01,pnl:-2.06 },
  { id:'buy-002', symbol:DEMO_SYMBOL, status:'OPEN',side:'BUY',entry:83800,sl:null,tp:84900,volume:0.02,pnl:3.42 },
  { id:'buy-003', symbol:DEMO_SYMBOL, status:'OPEN',side:'BUY',entry:83680,sl:null,tp:null,volume:0.01,pnl:0.85 },
];
const initialOrders = [
  { id:'order-001',symbol:DEMO_SYMBOL,status:'PENDING',side:'SELL',orderType:'limit',entry:84400,volume:0.01 },
];

function App() {
  const [positions,setPositions] = useState(initialPositions);
  const [orders] = useState(initialOrders);
  const [edit,setEdit] = useState(null);
  const [notice,setNotice] = useState('Isolated presentation proof. No broker or trading requests.');
  const [showOverlap,setShowOverlap] = useState(false);
  const samples=showOverlap ? positions.map((p,i)=>({...p,entry:83671+i*3})) : positions;
  const formatPrice = price => Number(price).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
  const requestedEdit = payload => {
    if(!payload) return;
    const delta=payload.confirmedPrice*0.004*(payload.levelId.endsWith(':sl')?1:-1);
    setEdit({levelId:payload.levelId,proposedPrice:Number((payload.confirmedPrice+delta).toFixed(1))});
    setNotice('Edit is local. Click Save to update this synthetic preview.');
  };
  const save = draft => {
    const [account,objectType,id,kind]=String(draft.levelId).split(':');
    if(account!==DEMO_ACCOUNT||objectType!=='position'||!['sl','tp'].includes(kind))return;
    setPositions(current=>current.map(p=>p.id===id?{...p,[kind]:Number(draft.proposedPrice)}:p));
    setEdit(null);
    setNotice('Synthetic save confirmed. Real trading integration is not connected yet.');
  };
  const remove = action => {
    if(action?.accountId!==DEMO_ACCOUNT)return;
    setPositions(current=>current.map(p=>p.id===action.objectId?{...p,[action.kind]:null}:p));
    setNotice('Synthetic removal confirmed. No trading API was called.');
  };
  const add=(id,kind)=>{
    const p=positions.find(x=>x.id===id);
    if(!p)return;
    const price=p.entry*(kind==='sl'?(p.side==='BUY'?0.98:1.02):(p.side==='BUY'?1.02:0.98));
    setPositions(current=>current.map(x=>x.id===id?{...x,[kind]:Number(price.toFixed(1))}:x));
    setNotice('Synthetic level added; backend flow still needs wiring.');
  };
  const candles=Array.from({length:34},(_,i)=>{
    const open=83500+Math.sin(i*1.31)*550+Math.cos(i*0.57)*170;
    const close=open+Math.sin(i*2.35)*320;
    const high=Math.max(open,close)+100+(i%4)*24;
    const low=Math.min(open,close)-110-(i%3)*45;
    return {x:27+i*20,top:toY(high),bottom:toY(low),bodyTop:toY(Math.max(open,close)),
      bodyBottom:toY(Math.min(open,close)),up:close>=open};
  });

  return <div className="min-h-screen bg-[#09090b] p-4 font-sans text-[#ecf0f2] lg:p-8">
    <div className="mx-auto max-w-[1200px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[18px] font-semibold tracking-wide">ACG Trader V4 — Chart Order Layer</h1>
          <p className="mt-1 text-xs text-[#9ca5ad]">Foundation preview · original reference remains the visual target</p>
        </div>
        <div className="rounded border border-[#bc864d]/60 bg-[#bc864d]/10 px-3 py-1.5 text-[11px] text-[#ffd1a5]">
          SYNTHETIC DATA — NO REAL ORDERS
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[12px]">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showOverlap} onChange={e=>setShowOverlap(e.target.checked)}/> Simulate overlapping positions</label>
        <span className="text-[#9ca5ad]">{notice}</span>
      </div>
      <div className="relative w-full overflow-hidden rounded-md border border-[#262b30] bg-[#08090b]" style={{height:VIEW_HEIGHT}}>
        <svg width="100%" height={VIEW_HEIGHT} viewBox="0 0 800 580" preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-90" aria-hidden="true">
          {Array.from({length:8},(_,i)=><line key={'h'+i} x1="0" x2="800" y1={i*78+20} y2={i*78+20} stroke="#20262a" strokeWidth=".7"/>)}
          {Array.from({length:13},(_,i)=><line key={'v'+i} x1={i*65} x2={i*65} y1="0" y2="580" stroke="#20262a" strokeWidth=".5"/>)}
          {candles.map((c,i)=><g key={i} stroke={c.up?'#0fa68b':'#e74559'} fill={c.up?'#0fa68b':'#e74559'}>
            <line x1={c.x} x2={c.x} y1={c.top} y2={c.bottom} strokeWidth="1"/>
            <rect x={c.x-4} y={c.bodyTop} width="8" height={Math.max(2,c.bodyBottom-c.bodyTop)}/>
          </g>)}
        </svg>
        <V4ChartOrderLayer accountId={DEMO_ACCOUNT} symbol={DEMO_SYMBOL}
          positions={samples} pendingOrders={orders} coordinateApi={{priceToY:toY}}
          height={VIEW_HEIGHT} edit={edit} onBeginEdit={requestedEdit}
          onSaveEdit={save} onCancelEdit={()=>{setEdit(null);setNotice('Edit canceled. Accepted synthetic price unchanged.');}}
          onConfirmRemoval={remove} onAddProtection={add}
          formatPrice={formatPrice} formatVolume={v=>Number(v).toFixed(2)+' lots'}
          formatPnl={v=>v==null?'—':Number(v).toFixed(2)+' USD'}/>
        {edit&&<div className="pointer-events-auto absolute bottom-4 left-4 z-[60] flex items-center gap-2 rounded border border-[#41484f] bg-[#15191e] p-3 text-xs">
          <span className="text-[#aeb7c1]">Proposed price</span>
          <input type="number" step="0.1" className="w-[112px] rounded bg-[#252b31] px-2 py-1 text-white"
            value={edit.proposedPrice} onChange={e=>setEdit(x=>x?{...x,proposedPrice:e.target.value}:x)}/>
          <button type="button" className="rounded bg-white px-2 py-1 text-black" onClick={()=>save(edit)}>Save</button>
          <button type="button" className="rounded border border-[#56616c] px-2 py-1" onClick={()=>setEdit(null)}>Cancel</button>
        </div>}
      </div>
      <p className="max-w-3xl text-[11px] leading-relaxed text-[#a4afb8]">
        This page verifies isolated rendering, state separation and spacing only. Full badge fidelity,
        actual pointer drag, backend Save/Cancel, real quote rail and authenticated staging tests are
        required before connecting it to the live chart or updating your production V4 audit view.
      </p>
    </div>
  </div>;
}

createRoot(document.getElementById('v4-chart-preview-root')).render(<App/>);
