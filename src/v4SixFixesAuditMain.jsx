import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import V4FullTerminalOrders from './components/trading-v2/v4/V4FullTerminalOrders.jsx';
import { OpenPositionEntryOverlay } from './components/trading-v2/ChartArea.jsx';
import { buildChartPendingAmendment } from './utils/pendingOrderChartMove.js';
import './index.css';
import './styles/acg-pure-black.css';

// Full-terminal chart connector exercised with deterministic backend stand-ins.
// It never imports the real auth or trading API and makes no network commands.
const ACCOUNT={id:'qa-account',currency:'USD'};
const SYMBOL='BTCUSD';
const originalPositions=[
 {id:'p1',symbol:SYMBOL,status:'OPEN',side:'BUY',entry:83900,volume:0.01,pnl:3.5,sl:null,tp:null},
];
const originalOrders=[
 {id:'o1',symbol:SYMBOL,status:'PENDING',side:'SELL',orderType:'limit',
  entry:84400,volume:0.01,sl:null,tp:82100},
 {id:'o2',symbol:SYMBOL,status:'PENDING',side:'SELL',orderType:'stop-limit',
  entry:81600,limitPrice:81400,volume:0.02,sl:null,tp:null},
];
const toY=price=>50+(86000-Number(price))/12;
const fromY=y=>86000-(Number(y)-50)*12;
function App(){
 const [positions,setPositions]=useState(originalPositions);
 const [orders,setOrders]=useState(originalOrders);
 const [parentDraft,setParentDraft]=useState(null);
 const [planning,setPlanning]=useState(false);
 const [hoveredPositionId,setHoveredPositionId]=useState(null);
 const [commands,setCommands]=useState([]);
 const rejectNextRemoval=useRef(false);
 const removalCalls=useRef(0);
 const coordinateApi=useMemo(()=>({priceToY:toY,yToPrice:fromY,subscribe:()=>()=>{}}),[]);
 const record=(kind,id,field,price)=>setCommands(c=>[...c,{kind,id,field,price}]);
 const modifyPosition=async(id,patch)=>{
   record('position',id,Object.keys(patch)[0],Object.values(patch)[0]);
   await new Promise(resolve=>setTimeout(resolve,80));
   setPositions(values=>values.map(v=>v.id===id?{...v,...patch}:v));
   return true;
 };
 const movePending=async(id,price,field)=>{
   const current=orders.find(v=>v.id===id);
   const patch=buildChartPendingAmendment(current,price,field);
   if(!patch) return false;
   record('pending',id,field,price);
   await new Promise(resolve=>setTimeout(resolve,80));
   setOrders(values=>values.map(v=>v.id===id?{
     ...v,entry:patch.entry,limitPrice:patch.limitPrice ?? v.limitPrice,
     sl:patch.stopLoss,tp:patch.takeProfit,
   }:v));
   return true;
 };
 const removeProtection=async(id,kind)=>{
   removalCalls.current += 1;
   if(rejectNextRemoval.current){
     rejectNextRemoval.current=false;
     await new Promise(resolve=>setTimeout(resolve,80));
     return false;
   }
   return modifyPosition(id,{[kind]:null});
 };
 const beginProtection=(id,kind)=>{
   const position=positions.find(x=>x.id===id);
   if(!position)return false;
   setParentDraft({positionId:id,symbol:SYMBOL,activeField:kind,
    [kind]:Number(position.entry)+(kind==='tp'?500:-500)});
   return true;
 };
 window.v4QA={get commands(){return commands;},get positions(){return positions;},
  get orders(){return orders;},get parentDraft(){return parentDraft;},get planning(){return planning;},
  get removalCalls(){return removalCalls.current;},
  rejectOneRemoval(){rejectNextRemoval.current=true;}};
 return <div className="min-h-screen bg-black p-4 text-white">
  <div className="mb-3 text-sm font-semibold">V4 full-terminal chart integration — deterministic acceptance fixture</div>
  <div className="mb-3 flex gap-2">
    <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs" onClick={()=>setPlanning(true)}>Start new limit plan</button>
    <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs" onClick={()=>setPlanning(false)}>Finish planning</button>
   </div>
  <div className="relative w-full overflow-hidden rounded border border-[#444]" style={{height:580}}
    data-v4-full-terminal-fixture>
    <V4FullTerminalOrders isNewOrderPlanning={planning} hoveredPositionId={hoveredPositionId}
      renderPositionEntries={(chartEditActions, requestProtection) => (
        <OpenPositionEntryOverlay symbol={SYMBOL} positions={positions} coordinateApi={coordinateApi}
          instrument={{tickSize:1,tickValue:1,quoteCurrency:'USD',displaySymbol:'BTCUSD',sessionOpen:true,marketDataAvailable:true}}
          selectedPositionId={'p1'} onSelectPosition={()=>{}} onClosePosition={()=>{}}
          onRequestPositionProtection={planning ? null : requestProtection}
          chartEditActions={chartEditActions}
          hoveredPositionId={hoveredPositionId} onHoverPosition={setHoveredPositionId} desktopStyle/>
      )}
      account={ACCOUNT} symbol={SYMBOL} instrument={{tickSize:1,tickValue:1,quoteCurrency:'USD',displaySymbol:'BTCUSD'}}
      positions={positions} pendingOrders={orders}
      coordinateApi={coordinateApi} height={580}
      positionProtectionDraft={parentDraft}
      onUpdatePosition={modifyPosition}
      onRemovePositionProtection={removeProtection}
      onMovePending={movePending} onRequestPositionProtection={beginProtection}
      onCancelPositionProtection={()=>setParentDraft(null)}
      onSelectPosition={()=>{}} onClosePosition={()=>{}} onCancelPending={()=>{}}/>
  </div>
  <div data-qa-command-count className="mt-2 text-xs">{commands.length} commands</div>
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
