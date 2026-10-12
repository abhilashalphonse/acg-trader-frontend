import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import V4FullTerminalOrders from './components/trading-v2/v4/V4FullTerminalOrders.jsx';
import DesktopManagePositionV4 from './components/trading-v2/desktop/DesktopManagePositionV4.jsx';
import DesktopManagePendingV4 from './components/trading-v2/desktop/DesktopManagePendingV4.jsx';
import DesktopWatchlist from './components/trading-v2/desktop/DesktopWatchlist.jsx';
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
 {id:'p2',symbol:'EURUSD',status:'OPEN',side:'SELL',entry:1.116,volume:0.01,pnl:0.15,sl:null,tp:null},
];
const originalOrders=[
 {id:'o1',symbol:SYMBOL,status:'ACCEPTED',side:'SELL',orderType:'limit',
  entry:84400,volume:0.01,sl:null,tp:82100},
 {id:'o2',symbol:SYMBOL,status:'TRIGGERED',side:'SELL',orderType:'stop-limit',
  entry:81600,limitPrice:81400,volume:0.02,sl:null,tp:null},
];
const toY=price=>50+(86000-Number(price))/12;
const fromY=y=>86000-(Number(y)-50)*12;
function App(){
 const [positions,setPositions]=useState(originalPositions);
 const [orders,setOrders]=useState(originalOrders);
 const [parentDraft,setParentDraft]=useState(null);
 const [selectedPositionId,setSelectedPositionId]=useState(null);
 const [selectedPendingId,setSelectedPendingId]=useState(null);
 const [pendingDraft,setPendingDraft]=useState(null);
 const [actionCommands,setActionCommands]=useState([]);
 const selectPosition=id=>{setSelectedPositionId(id);setSelectedPendingId(null);setPendingDraft(null);};
 const selectPending=id=>{setSelectedPendingId(id);setSelectedPositionId(null);};
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
 const beginProtection=(id,kind,initialPrice=null)=>{
   const position=positions.find(x=>x.id===id);
   if(!position)return false;
   selectPosition(id);
   setParentDraft(previous=>{
     const base=previous?.positionId===id?previous:{
       positionId:id,symbol:SYMBOL,side:position.side.toLowerCase(),entry:position.entry,
       sl:position.sl,tp:position.tp,manualLots:position.volume,
       sizingMode:'lots',pending:false,source:'open-position',
     };
     return {...base,activeField:kind,
       [kind]:initialPrice??base[kind]??Number(position.entry)+(kind==='tp'?500:-500)};
   });
   return true;
 };
 window.v4QA={get commands(){return commands;},get positions(){return positions;},
  get orders(){return orders;},get parentDraft(){return parentDraft;},get planning(){return planning;},
  get selectedPositionId(){return selectedPositionId;},
  get selectedPendingId(){return selectedPendingId;},get pendingDraft(){return pendingDraft;},
  get actionCommands(){return actionCommands;},
  get removalCalls(){return removalCalls.current;},
  rejectOneRemoval(){rejectNextRemoval.current=true;}};
 return <div className="min-h-screen bg-black p-4 text-white">
  <div className="mb-3 text-sm font-semibold">V4 full-terminal chart integration — deterministic acceptance fixture</div>
  <div className="mb-3 flex gap-2">
    <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs" onClick={()=>setPlanning(true)}>Start new limit plan</button>
    <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs" onClick={()=>setPlanning(false)}>Finish planning</button>
    <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs" onClick={()=>selectPosition('p1')}>Select open position</button>
    <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs" onClick={()=>selectPosition('p2')}>Select EUR/USD position</button>
    <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs" onClick={()=>selectPending('o1')}>Select Limit order</button>
    <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs" onClick={()=>selectPending('o2')}>Select Stop-Limit order</button>
   </div>
  <div className="relative w-full overflow-hidden rounded border border-[#444]" style={{height:580}}
    data-v4-full-terminal-fixture>
    <V4FullTerminalOrders isNewOrderPlanning={planning} hoveredPositionId={hoveredPositionId}
      renderPositionEntries={(chartEditActions, requestProtection) => (
        <OpenPositionEntryOverlay symbol={SYMBOL} positions={positions} coordinateApi={coordinateApi}
          instrument={{tickSize:1,tickValue:1,quoteCurrency:'USD',displaySymbol:'BTCUSD',sessionOpen:true,marketDataAvailable:true}}
          selectedPositionId={selectedPositionId} onSelectPosition={selectPosition} onClosePosition={()=>{}}
          onRequestPositionProtection={planning ? null : requestProtection}
          chartEditActions={chartEditActions}
          hoveredPositionId={hoveredPositionId} onHoverPosition={setHoveredPositionId} desktopStyle/>
      )}
      account={ACCOUNT} symbol={SYMBOL} instrument={{tickSize:1,tickValue:1,quoteCurrency:'USD',displaySymbol:'BTCUSD'}}
      positions={positions} pendingOrders={orders}
      coordinateApi={coordinateApi} height={580}
      positionProtectionDraft={parentDraft} pendingOrderDraft={pendingDraft}
      onPendingOrderDraftChange={setPendingDraft} onCancelPendingOrderDraft={()=>setPendingDraft(null)}
      onUpdatePosition={modifyPosition}
      onRemovePositionProtection={removeProtection}
      onMovePending={movePending} onRequestPositionProtection={beginProtection}
      onCancelPositionProtection={()=>setParentDraft(null)}
      onPositionProtectionDraftChange={patch=>setParentDraft(current=>current?{...current,...patch}:current)}
      onSelectPosition={selectPosition} onSelectPending={selectPending}
      onClosePosition={()=>{}} onCancelPending={async id=>{setActionCommands(v=>[...v,{kind:'cancel',id}]);setOrders(v=>v.filter(x=>x.id!==id));return true;}}/>
  </div>
  {selectedPositionId&&positions.some(position=>position.id===selectedPositionId)&&<div
    data-qa-unified-position-sidebar className="mt-3 w-[340px]" style={{height:520}}>
    <DesktopManagePositionV4 position={positions.find(position=>position.id===selectedPositionId)}
      instrument={selectedPositionId==='p2'
        ? {symbol:'EURUSD',assetClass:'FOREX',baseCurrency:'EUR',quoteCurrency:'USD',
          tickSize:0.00001,tickValue:1,contractSize:100000,displaySymbol:'EUR/USD',bid:1.11597,ask:1.11599}
        : {symbol:'BTCUSD',assetClass:'CRYPTO',baseCurrency:'BTC',quoteCurrency:'USD',
          tickSize:1,tickValue:1,contractSize:1,displaySymbol:'BTCUSD',bid:84000,ask:84001}}
      account={{...ACCOUNT,equity:100000,balance:100000}}
      protectionDraft={parentDraft}
      onBeginProtection={kind=>beginProtection(selectedPositionId,kind)}
      onProtectionDraftChange={patch=>setParentDraft(current=>current?{...current,...patch}:current)}
      onApplyProtection={async patch=>{const ok=await modifyPosition(selectedPositionId,patch);if(ok)setParentDraft(null);return ok;}}
      onCancelProtection={()=>setParentDraft(null)}
      onUpdateProtection={modifyPosition}
      onClosePosition={async(id,percent)=>{setActionCommands(v=>[...v,{kind:'close',id,percent}]);return true;}}
      onBreakEven={async id=>{setActionCommands(v=>[...v,{kind:'breakEven',id}]);return true;}}
      onSetTrailing={async(id,enabled,pips)=>{setActionCommands(v=>[...v,{kind:'trail',id,enabled,pips}]);return true;}}
      onDismiss={()=>{setSelectedPositionId(null);setParentDraft(null);}}/>
  </div>}
  {selectedPendingId&&orders.some(order=>order.id===selectedPendingId)&&<div
    data-qa-unified-pending-sidebar className="mt-3 w-[340px]" style={{height:540}}>
    <DesktopManagePendingV4 order={orders.find(order=>order.id===selectedPendingId)}
      instrument={{symbol:SYMBOL,assetClass:'CRYPTO',baseCurrency:'BTC',quoteCurrency:'USD',
        tickSize:1,tickValue:1,contractSize:1,displaySymbol:'BTCUSD',bid:84000,ask:84001}}
      account={{...ACCOUNT,balance:100000,equity:100000}} draft={pendingDraft}
      onDraftChange={setPendingDraft} onDiscard={()=>setPendingDraft(null)}
      onMovePending={movePending}
      onCancelPending={async id=>{setActionCommands(v=>[...v,{kind:'cancel',id}]);setOrders(v=>v.filter(x=>x.id!==id));return true;}}
      onDismiss={()=>{setSelectedPendingId(null);setPendingDraft(null);}}/>
  </div>}
  <div data-qa-command-count className="mt-2 text-xs">{commands.length} commands</div>
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);

const MARKETS_QA=[
 {symbol:'EURUSD',displaySymbol:'EUR/USD',name:'Euro / US Dollar',assetClass:'FOREX',bid:1.1003,ask:1.1005,mid:1.1004,pipSize:0.0001,changePercent:0.45,volume:100,marketState:'LIVE',live:true,subscribed:true,sessionOpen:true},
 {symbol:'AUDCAD',displaySymbol:'AUD/CAD',name:'Australian Dollar / Canadian Dollar',assetClass:'FOREX',bid:0.99395,ask:0.99401,mid:0.99398,pipSize:0.0001,changePercent:-0.3,volume:20,marketState:'LIVE',live:true,subscribed:true,sessionOpen:true},
 {symbol:'AAPL',displaySymbol:'AAPL',name:'Apple',assetClass:'EQUITY',last:218.25,changePercent:1.25,volume:400,marketState:'LIVE',live:true,subscribed:true,sessionOpen:true},
 {symbol:'BTCUSD',displaySymbol:'BTCUSD',name:'Bitcoin',assetClass:'CRYPTO',last:80000,changePercent:-2.1,volume:300,marketState:'LIVE',live:true,subscribed:true,sessionOpen:true},
 {symbol:'RELIANCE',displaySymbol:'RELIANCE',name:'Reliance Industries',assetClass:'EQUITY',quoteCurrency:'INR',timezone:'Asia/Kolkata',last:1251.25,changePercent:0.81,volume:820,marketState:'CLOSED',sessionOpen:false},
 {symbol:'NIFTY',displaySymbol:'NIFTY',name:'NIFTY 50',assetClass:'INDEX',quoteCurrency:'INR',timezone:'Asia/Kolkata',last:25511.1,changePercent:-0.3,volume:30,marketState:'CLOSED',sessionOpen:false},
];
function V4MarketsQA(){
 const [mode,setMode]=useState('markets');
 const [selected,setSelected]=useState('EURUSD');
 const [saved,setSaved]=useState(['EURUSD']);
 const [viewed,setViewed]=useState([]);
 const [activeSubs,setActiveSubs]=useState([]);
 const searchRef=useRef(null);
 const symbols=useMemo(()=>saved,[saved]);
 const subsChanged=React.useCallback(value=>setActiveSubs(old=>old.join('|')===value.join('|')?old:value),[]);
 const watchlist=useMemo(()=>({
  activeSymbols:symbols,
  activeList:{id:'favorites',name:'Favorites',symbols},
  workspace:{lists:[{id:'favorites',name:'Favorites',symbols}]},
  isWatched:symbol=>symbols.includes(symbol),
  toggleSymbol:symbol=>setSaved(old=>old.includes(symbol)?old.filter(v=>v!==symbol):[...old,symbol]),
  setActiveListId:()=>{},
  moveSymbol:()=>{},
 }),[symbols]);
 window.v4MarketsQA={get selected(){return selected;},get saved(){return saved;},
  get viewed(){return viewed;},get subscribedSymbols(){return activeSubs;},get mode(){return mode;},
  setMode};
 return <DesktopWatchlist markets={MARKETS_QA} activeSymbol={selected} mode={mode}
  onSelectSymbol={symbol=>{setSelected(symbol);setViewed(list=>[...list,symbol]);}}
  onModeChange={setMode} onClose={()=>setMode('watchlist')}
  watchlists={watchlist} searchRef={searchRef} onViewportQuoteSymbolsChange={subsChanged}/>;
}
createRoot(document.getElementById('v4-markets-fixture')).render(<V4MarketsQA/>);
