// Synthetic-only full ticket + chart browser acceptance; NO trading API.
import React, { useState } from 'react';
// Match the actual terminal's production styling in Chromium visual QA.
import './index.css';
import './styles/acg-pure-black.css';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import DesktopOrderTicketV4 from './components/trading-v2/desktop/DesktopOrderTicketV4.jsx';
import { TradePlanOverlay, PendingOrderOverlay, OpenPositionEntryOverlay, OpenPositionProtectionOverlay, OpenPositionGroupGuide } from './components/trading-v2/ChartArea.jsx';
import { createDefaultTradePlan } from './utils/tradePlanExecution.js';

const DEMO=Object.freeze({
 symbol:'BTCUSD',displaySymbol:'BTC/USD',name:'Bitcoin / US Dollar',
 assetClass:'CRYPTO',bid:83001.02,ask:83020.98,tickSize:0.01,pipSize:0.01,
 quoteCurrency:'USD',marginCurrency:'USD',pnlCurrency:'USD',contractSize:1,
 volumeStep:0.01,minVolume:0.01,maxVolume:10,defaultLeverage:10,
 sessionOpen:true,isStale:false,marketState:'ACTIVE',
});
const ACCOUNT=Object.freeze({
 id:'v4-browser-synthetic',status:'ACTIVE',tradingEnabled:true,valuationStatus:'LIVE',
 currency:'USD',equity:100000,balance:100000,freeMargin:20000,leverage:10,
 capabilities:{policyVersion:'ACG_FUNDED_V2',fundedV2Confirmed:true,
   manualLotWithoutStopLoss:true,optionalStopLoss:true},
});
const coordinateApi={
 priceToY:price=>300-(price-83000)/10,
 yToPrice:y=>83000+(300-y)*10,
 subscribe:()=>()=>{},
};
const pendingInstrument={
  symbol:'GBPUSD', tickSize:0.00001, pipSize:0.0001, tickValue:1,
  contractSize:100000, volumeStep:0.01, quoteCurrency:'USD', pnlCurrency:'USD',
};
const pendingCoordinates={
  priceToY:price=>300-(price-1.322)*25000,
  yToPrice:y=>1.322+(300-y)/25000,
  subscribe:()=>()=>{},
};
const pendingOrder={
  id:'pending-smoke-1',symbol:'GBPUSD',side:'sell',orderType:'stop-limit',
  status:'pending',entry:1.32345,limitPrice:1.32038,sl:1.32590,tp:1.31726,
  volume:0.10,expiration:'GTC',
};
const buyPendingOrder={
  id:'pending-smoke-buy',symbol:'GBPUSD',side:'buy',orderType:'limit',status:'pending',
  entry:1.3211,sl:1.3190,tp:1.3240,volume:0.05,expiration:'GTC',
};
const openPositions=[
  {id:'position-smoke-a',symbol:'BTCUSD',side:'sell',entry:83000,sl:83200,tp:82500,volume:0.01,pnl:-1.52,pnlCurrency:'USD'},
  {id:'position-smoke-b',symbol:'BTCUSD',side:'buy',entry:83500,sl:null,tp:83700,volume:0.02,pnl:7.20,pnlCurrency:'USD'},
  {id:'position-smoke-c',symbol:'BTCUSD',side:'buy',entry:83800,sl:null,tp:null,volume:0.01,pnl:0,pnlCurrency:'USD'},
];
function PositionFixture(){
 const [hovered,setHovered]=useState(null);
 const [livePositions,setLivePositions]=useState(openPositions);
 const [edit,setEdit]=useState(null);
 const startEdit=(id,kind,price)=>{
   const position=livePositions.find(item=>item.id===id);
   if(!position)return;
   setEdit({
     positionId:id,source:'open-position',symbol:position.symbol,
     side:position.side,entry:position.entry,sl:position.sl,tp:position.tp,
     activeField:kind,stage:'draft',manualLots:position.volume,
     sizingMode:'lots',pending:false,open:false,
     ...(Number.isFinite(Number(price))?{[kind]:Number(price)}:{}),
   });
 };
 return <>
   <OpenPositionEntryOverlay symbol="BTCUSD" positions={livePositions} coordinateApi={coordinateApi} instrument={DEMO}
     desktopStyle hoveredPositionId={hovered} onHoverPosition={setHovered} onRequestPositionProtection={startEdit} />
   <OpenPositionProtectionOverlay symbol="BTCUSD" positions={livePositions} coordinateApi={coordinateApi} instrument={DEMO}
     desktopStyle hoveredPositionId={hovered} onHoverPosition={setHovered}
     editingProtection={edit}
     onRequestProtectionChange={startEdit}
     onRemoveProtection={(id,field)=>setLivePositions(current=>current.map(p=>p.id===id?{...p,[field]:null}:p))} />
   {edit&&<TradePlanOverlay plan={edit} onChange={patch=>setEdit(old=>old?{...old,...patch}:old)}
     onCancel={()=>setEdit(null)} coordinateApi={coordinateApi} instrument={DEMO}
     account={ACCOUNT} lots={edit.manualLots} accountCurrency="USD" showEntry={false} desktopStyle />}
   <OpenPositionGroupGuide symbol="BTCUSD" positions={livePositions} hoveredPositionId={hovered} coordinateApi={coordinateApi} />
 </>;
}

const counters={manual:0,planned:0,drafts:0,markets:0,pendingMoves:[],notice:''};
function Fixture(){
 const [lots,setLots]=useState(0.1);
 const [sizing,setSizing]=useState('lots');
 const [percent,setPercent]=useState(0.5);
 const [type,setType]=useState('market');
 const [plan,setPlan]=useState(null);
 const [pending,setPending]=useState(false);
 const patch=p=>setPlan(old=>old?{...old,...p}:old);
 return <>
   <DesktopOrderTicketV4
     market={DEMO} account={ACCOUNT} lots={lots} onLotsChange={setLots}
     sizingMode={sizing} onSizingModeChange={setSizing}
     riskPercent={percent} onRiskPercentChange={setPercent}
     orderType={type} onOrderTypeChange={setType}
     tradePlan={plan} onTradePlanChange={patch}
     onStartPlan={(side,requestedType,options)=>{
       counters.drafts++;
       const next=createDefaultTradePlan({
         side,requestedType,market:DEMO,
         sizingMode:options?.sizingMode||sizing,
         lots:options?.manualLots||lots,
         protection:options?.protection||'both',
       });
       setPlan(next?{...next,...(options?.source?{source:options.source}:{})}:null);
     }}
     onCancelPlan={()=>setPlan(null)}
     onExecutePlan={async()=>{counters.planned++;setPending(true);await new Promise(resolve=>setTimeout(resolve,160));setPending(false);}}
     onManualOrder={async()=>{counters.manual++;setPending(true);await new Promise(resolve=>setTimeout(resolve,160));setPending(false);}}
     executionCommandPending={pending}
     onNotice={message=>{counters.notice=message;}}
     onOpenMarkets={()=>{counters.markets++;}}
     exposureAllowed={true}
   />
   {createPortal(
     <TradePlanOverlay plan={plan} onChange={patch}
       onCancel={()=>setPlan(null)} coordinateApi={coordinateApi}
       instrument={DEMO} lots={lots} account={ACCOUNT}
       riskPercent={percent} accountCurrency="USD" desktopStyle/>,
     document.getElementById('chart-fixture')
   )}
 </>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
createRoot(document.getElementById('pending-chart-fixture')).render(
  <PendingOrderOverlay
    symbol="GBPUSD"
    instrument={pendingInstrument}
    coordinateApi={pendingCoordinates}
    orders={[pendingOrder,buyPendingOrder]}
    desktopStyle
    account={ACCOUNT}
    accountCurrency="USD"
    onMove={(orderId, nextPrice, field) => { counters.pendingMoves.push({ orderId, nextPrice, field }); }}
  />
);
createRoot(document.getElementById('position-chart-fixture')).render(<PositionFixture/>);
// When adding/editing protection on an OPEN position, the temporary draft
// should use the same rich V4 badge as an accepted protection, but remain dotted.
const editBase={
  positionId:'position-smoke-a', symbol:'BTCUSD', side:'sell',
  source:'open-position', entry:83000, sl:83200, tp:82500,
  sizingMode:'lots', pending:false, open:false, manualLots:0.01,
};
createRoot(document.getElementById('protection-draft-fixture')).render(<>
  <TradePlanOverlay
    plan={{...editBase,activeField:'tp',tp:82400,stage:'draft'}}
    onChange={()=>{}} coordinateApi={coordinateApi} instrument={DEMO}
    account={ACCOUNT} lots={0.01} accountCurrency="USD"
    showEntry={false} desktopStyle
  />
  <TradePlanOverlay
    plan={{...editBase,activeField:'sl',sl:83300,stage:'draft'}}
    onChange={()=>{}} coordinateApi={coordinateApi} instrument={DEMO}
    account={ACCOUNT} lots={0.01} accountCurrency="USD"
    showEntry={false} desktopStyle
  />
</>);

const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const findMode=(ticket,text)=>Array.from(ticket.querySelectorAll('.v4-position-modes button'))
  .find(button=>button.textContent.trim()===text);
async function run(){
 await sleep(1050);
 const failed=[], status=document.getElementById('v4-smoke-status');
 const root=document.getElementById('fixture');
 const ticket=root.querySelector('[aria-label="ACG Trader V4 live execution ticket"]');
 const chart=document.getElementById('chart-fixture');
 if(!ticket){status.textContent='FAIL: V4 ticket missing';return;}
 // Accepted stop-limit must draw two independent SOLID price levels,
 // and show a temporary DOTTED ghost while its LIMIT leg is dragged.
 const pendingChart=document.getElementById('pending-chart-fixture');
 pendingChart.style.width='435px';
 const liveChart=document.getElementById('position-chart-fixture');
 const protectionDraft=document.getElementById('protection-draft-fixture');
 const draftBadges=Array.from(protectionDraft.querySelectorAll('[data-v4-chart-badge]'));
 const draftTp=draftBadges.find(badge=>badge.textContent.includes('Take profit'));
 const draftSl=draftBadges.find(badge=>badge.textContent.includes('Stop loss'));
 if(draftBadges.length!==2||!draftTp||!draftSl)
   failed.push('Open-position TP/SL edit does not render exactly one full rich badge per active draft');
 for(const [badge,name] of [[draftTp,'TP'],[draftSl,'SL']]){
   if(!badge)continue;
   const caption=badge.textContent;
   if(!/\d{5}\.\d{2}/.test(caption)||!caption.includes('USD')||!caption.includes('%'))
     failed.push(name+' draft badge missing price, estimated P&L or percentage');
   if(!badge.parentElement?.classList.contains('border-dotted'))
     failed.push(name+' open-position draft line was not dotted');
 }
 if(protectionDraft.querySelector('button .rounded-full')||protectionDraft.querySelector('button > .rounded-full'))
   failed.push('Legacy circular TP/SL drag handle still rendered in desktop V4');
 const allLiveRows=Array.from(liveChart.querySelectorAll('[data-v4-chart-badge]'));
 // Read semantic direction and quantity fields rather than relying on
 // incidental whitespace between their separately styled elements.
 const entryBadges=allLiveRows.filter(b=>b.querySelector('[data-v4-position-direction]'));
 const positionEntry=(side,size)=>entryBadges.find(b=>
   b.querySelector('[data-v4-position-direction]')?.textContent===side &&
   b.querySelector('[data-v4-position-size]')?.textContent===size);
 const sellEntry=positionEntry('SELL','0.01');
 const buyEntry=positionEntry('BUY','0.02');
 const unprotectedEntry=positionEntry('BUY','0.01');
 if(!sellEntry||!buyEntry||!unprotectedEntry)failed.push('Three independent live position badges missing');
 if(sellEntry?.querySelector('[data-attached-protection],button[aria-label^="Add "]'))
   failed.push('Fully protected position must leave TP and SL off the entry badge');
 if(buyEntry?.querySelector('[data-attached-protection],button[aria-label="Add TP to BUY position"]'))
   failed.push('Placed TP must leave the original BUY position row');
 if(!buyEntry?.querySelector('button[aria-label="Add SL to BUY position"]'))
   failed.push('TP-only position must offer only +SL');
 if(unprotectedEntry?.querySelector('[data-attached-protection]'))
   failed.push('Unprotected position showed active protection chip');
 if(!unprotectedEntry?.querySelector('button[aria-label="Add SL to BUY position"]')
   ||!unprotectedEntry?.querySelector('button[aria-label="Add TP to BUY position"]'))
   failed.push('Unprotected position must offer +TP and +SL');
 const sellProtection=allLiveRows.find(b=>b.textContent.includes('Stop loss')&&b.textContent.includes('83200'));
 if(!sellProtection)failed.push('Confirmed SL badge missing');
 const showHover=async badge=>{
   badge?.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
   await sleep(90);
 };
 await showHover(sellEntry);
 if(liveChart.querySelector('[data-v4-hover-group]')?.getAttribute('data-v4-hover-group')!=='position-smoke-a')
   failed.push('Hovering open SELL position did not show its connector');
 if(liveChart.querySelectorAll('[data-v4-hover-group] .absolute.right-\\[138px\\]').length<2)
   failed.push('Hover connector did not include linked SL/TP');
 if(sellEntry?.className.includes('ring-white/35')!==true)failed.push('Position hover highlight missing');
 await showHover(buyEntry);
 if(liveChart.querySelector('[data-v4-hover-group]')?.getAttribute('data-v4-hover-group')!=='position-smoke-b')
   failed.push('Hover group leaked across two positions');
 if(liveChart.querySelectorAll('[data-v4-hover-group] .absolute.right-\\[138px\\]').length!==3)
   failed.push('TP-only connector should contain one spine plus two nodes');
 await showHover(unprotectedEntry);
 if(liveChart.querySelector('[data-v4-hover-group]'))
   failed.push('Unprotected entry showed connector');
 const liveProtectionBadge=allLiveRows.find(b=>b.textContent.includes('Stop loss'));
 await showHover(liveProtectionBadge);
 if(liveChart.querySelector('[data-v4-hover-group]')?.getAttribute('data-v4-hover-group')!=='position-smoke-a')
   failed.push('Hovering SL did not highlight parent position');
 liveProtectionBadge?.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:null}));
 await sleep(90);
 if(liveChart.querySelector('[data-v4-hover-group]'))failed.push('Hover connector remained after mouse leave');
 // Drag accepted TP: keep its solid price line, but display exactly one
 // full TP badge while a dotted preview moves, then while the edit awaits save.
 const confirmedTp=Array.from(liveChart.querySelectorAll('[data-v4-chart-badge]'))
   .find(b=>b.textContent.includes('Take profit')&&b.textContent.includes('82500'));
 if(!confirmedTp)failed.push('Accepted SELL TP missing before drag');
 else {
   const bounds=liveChart.getBoundingClientRect();
   const initialY=coordinateApi.priceToY(82500);
   const start={bubbles:true,clientY:bounds.top+initialY,pointerId:4};
   confirmedTp.dispatchEvent(new PointerEvent('pointerdown',start));
   await sleep(80);
   window.dispatchEvent(new PointerEvent('pointermove',{...start,clientY:bounds.top+initialY-8}));
   await sleep(90);
   const duringDrag=Array.from(liveChart.querySelectorAll('[data-v4-chart-badge]'))
     .filter(b=>b.textContent.includes('Take profit')&&b.textContent.includes('82'));
   if(duringDrag.length!==1)failed.push('Dragging TP showed duplicate full badges: '+duringDrag.length);
   window.dispatchEvent(new PointerEvent('pointerup',{...start,clientY:bounds.top+initialY-8}));
   await sleep(170);
   const afterRelease=Array.from(liveChart.querySelectorAll('[data-v4-chart-badge]'))
     .filter(b=>b.textContent.includes('Take profit')&&b.textContent.includes('82'));
   if(afterRelease.length!==1)failed.push('Editing TP showed duplicate accepted and proposed badges');
   if(!liveChart.querySelector('.relative.border-t.border-dotted'))
     failed.push('Proposed TP edit missing dotted price line');
   if(!Array.from(liveChart.querySelectorAll('span')).some(e=>e.textContent.trim()==='82500.00'))
     failed.push('Accepted TP price marker disappeared while editing');
   if(liveChart.textContent.includes('82500.00 ·'))
     failed.push('Y-axis TP label overcrowded with P&L and pips');
   const cancelEdit=liveChart.querySelector('[aria-label="Cancel TP edit"]');
   if(!cancelEdit)failed.push('Draft TP badge missing cancellation X');
   cancelEdit?.click();
   await sleep(90);
   const acceptedAgain=Array.from(liveChart.querySelectorAll('[data-v4-chart-badge]'))
     .find(b=>b.textContent.includes('Take profit')&&b.textContent.includes('82500'));
   if(!acceptedAgain)failed.push('Cancel TP edit did not restore full accepted badge');
   const removeTp=acceptedAgain?.querySelector('[aria-label="Remove Take profit from position"]');
   if(!removeTp)failed.push('Confirmed TP missing removal X');
   if(removeTp && acceptedAgain){
     const buttonBox=removeTp.getBoundingClientRect(),badgeBox=acceptedAgain.getBoundingClientRect();
     if(buttonBox.left<badgeBox.left||buttonBox.right>badgeBox.right+1)
       failed.push('Confirmed TP removal X is visually clipped by compact chart badge');
   }
   removeTp?.click();
   await sleep(90);
   if(Array.from(liveChart.querySelectorAll('[data-v4-chart-badge]'))
     .some(b=>b.textContent.includes('Take profit')&&b.textContent.includes('82500')))
     failed.push('Removing confirmed TP did not clear its badge');
   const sellAfterRemove=Array.from(liveChart.querySelectorAll('[data-v4-chart-badge]'))
     .find(b=>b.querySelector('[data-v4-position-direction]')?.textContent==='SELL' &&
       b.querySelector('[data-v4-position-size]')?.textContent==='0.01');
   if(!sellAfterRemove?.querySelector('[aria-label="Add TP to SELL position"]'))
     failed.push('Removing TP did not restore +TP on position row');
 }
 // Accepted entry and active protection lines remain solid; ghost only on edits.
 const placedSell=pendingChart.querySelector('[data-v4-chart-entry][data-order-state="placed"]');
 const placedBuy=Array.from(pendingChart.querySelectorAll('[data-v4-chart-entry][data-order-state="placed"]')).find(el=>el.textContent.includes('BUY'));
 const sellBadge=Array.from(pendingChart.querySelectorAll('[data-v4-chart-entry]')).find(el=>el.textContent.includes('SELL'));
 const sellRgb=sellBadge?getComputedStyle(sellBadge).borderTopColor:'';
 const buyRgb=placedBuy?getComputedStyle(placedBuy).borderTopColor:'';
 if(!placedSell || !sellBadge || !sellRgb.includes('239, 86, 100'))failed.push('Placed SELL Limit/Stop did not use confirmed sell red');
 if(!placedBuy || !buyRgb.includes('18, 185, 150'))failed.push('Placed BUY Limit did not use confirmed buy green');
 const liveLines=liveChart.querySelectorAll('.relative.border-t:not(.border-dotted):not(.border-dashed)');
 if(liveLines.length<3)failed.push('Live entry lines not solid');
 if(liveChart.querySelector('.relative.border-t-dotted'))failed.push('Confirmed protection drawn as draft');

 // Reproduce the reported 435px chart and reserve the full BID/ASK quote rail.
 // TradingChart paints BID/ASK via Lightweight Charts' canvas, so a DOM-only
 // price-marker check misses that overlap. Reserve a conservative 130px from
 // the right edge (label + title), with at least 14px between it and the badge.
 pendingChart.style.width='435px';
 chart.style.width='435px';
 const checkBidAskClearance=(badge,container,name)=>{
   if(!badge){failed.push(name+' badge missing for quote clearance');return;}
   const quoteRailLeft=container.getBoundingClientRect().right-130;
   const gap=quoteRailLeft-badge.getBoundingClientRect().right;
   if(!Number.isFinite(gap)||gap<14)failed.push(name+' overlaps BID/ASK price-scale corridor: '+gap);
 };
 // Price labels stay on the real chart Y-axis level. V4 badges stay vertically
 // centered on that line but sit to its left with a readable horizontal gap.
 const checkYAxisGap=(badge,name)=>{
   if(!badge){failed.push(name+' badge missing');return;}
   const line=badge.parentElement;
   const priceMarker=Array.from(line?.children||[]).find(el=>el.tagName==='SPAN' && String(el.className).includes('right-[56px]'));
   if(!priceMarker){failed.push(name+' Y-axis price marker missing');return;}
   const badgeBox=badge.getBoundingClientRect();
   const markerBox=priceMarker.getBoundingClientRect();
   const xGap=markerBox.left-badgeBox.right;
   const yDelta=Math.abs((badgeBox.top+badgeBox.bottom)/2-line.getBoundingClientRect().top);
   // The BID/ASK exclusion rail requires more than the former 80px maximum.
   // The order-price marker remains aligned on the exact price line.
   if(!Number.isFinite(xGap)||xGap<12||xGap>130)failed.push(name+' horizontal Y-axis gap invalid: '+xGap);
   if(!Number.isFinite(yDelta)||yDelta>3)failed.push(name+' is no longer vertically aligned with its price line: '+yDelta);
 };
 const acceptedBadges=Array.from(pendingChart.querySelectorAll('[data-v4-chart-badge]'));
 checkYAxisGap(acceptedBadges.find(b=>b.textContent.includes('Stop loss')),'Accepted SL');
 checkYAxisGap(acceptedBadges.find(b=>b.textContent.includes('Take profit')),'Accepted TP');
 checkYAxisGap(pendingChart.querySelector('[data-v4-chart-entry]'),'Accepted entry');
 for(const badge of acceptedBadges)checkBidAskClearance(badge,pendingChart,'Placed '+badge.textContent.slice(0,28));
 checkBidAskClearance(pendingChart.querySelector('[data-v4-chart-entry]'),pendingChart,'Placed entry');
 if(pendingChart.querySelector('[data-chart-level-placement],[data-chart-order-entry-placement]'))
   failed.push('Old vertical badge offsets were not reverted');
 const pendingLines=pendingChart.querySelectorAll('.relative.border-t:not(.border-dotted):not(.border-dashed)');
 if(pendingLines.length<4)failed.push('Accepted stop-limit levels are not all solid: '+pendingLines.length);
 const limitHandle=pendingChart.querySelector('[aria-label="Drag pending stop-limit limit price"]');
 if(!limitHandle)failed.push('Independent stop-limit execution-price handle missing');
 else {
   const rect=pendingChart.getBoundingClientRect();
   const initialY=pendingCoordinates.priceToY(pendingOrder.limitPrice);
   const pointerOptions={bubbles:true,pointerId:1,clientY:rect.top+initialY};
   limitHandle.dispatchEvent(new PointerEvent('pointerdown',pointerOptions));
   await sleep(80);
   window.dispatchEvent(new PointerEvent('pointermove',{...pointerOptions,clientY:rect.top+initialY-22}));
   await sleep(90);
   if(!pendingChart.querySelector('.border-dotted'))failed.push('Dragging accepted limit did not show dotted preview');
   window.dispatchEvent(new PointerEvent('pointerup',{...pointerOptions,clientY:rect.top+initialY-22}));
   await sleep(90);
   const amend=counters.pendingMoves[0];
   if(counters.pendingMoves.length!==1 || amend?.field!=='limitPrice' || amend?.orderId!==pendingOrder.id
      || Math.abs(Number(amend?.nextPrice)-pendingOrder.limitPrice)<0.00001){
     failed.push('Limit drag did not amend the independent stop-limit execution price');
   }
 }
 const body=ticket.querySelector('.v4-ticket-body');
 const footer=ticket.querySelector('.v4-execution-footer');
 const selected=ticket.querySelector('.v4-mainmodes .v4-capsule-button.selected');
 const size=ticket.getBoundingClientRect();
 if(Math.abs(size.width-330)>1)failed.push('ticket not 330px');
 if(!body||!footer)failed.push('scroll body or footer missing');
 else {
   if(body.scrollHeight<=body.clientHeight)failed.push('ticket body cannot scroll');
   const f=footer.getBoundingClientRect(), p=root.getBoundingClientRect();
   if(f.bottom>p.bottom+1||f.bottom<p.bottom-5)failed.push('footer not pinned');
 }
 if(!selected||getComputedStyle(selected).backgroundColor!=='rgb(247, 247, 248)')failed.push('white capsule missing');
 // A single order-type row replaces the old Market/Pending + Pending Type stack.
 const orderRow=ticket.querySelector('[aria-label="Order type"]');
 const orderButtons=Array.from(orderRow?.querySelectorAll('button')||[]);
 if(orderButtons.map(button=>button.textContent.trim()).join('|')!=='Market|Limit|Stop')
   failed.push('Expected one Market / Limit / Stop order selector');
 // The selected Market / Limit / Stop tab should look like the rounded
 // white Lots pill rather than the squared-off white tab regression.
 const assertRoundedOrderType=mode=>{
   const active=orderButtons.find(button=>button.textContent.trim()===mode);
   const radius=parseFloat(active?getComputedStyle(active).borderTopLeftRadius:'');
   if(!Number.isFinite(radius)||radius<15)
     failed.push(mode+' active order tab lost rounded pill corners: '+radius);
 };
 assertRoundedOrderType('Market');
 if(ticket.querySelector('[aria-label="Pending type"]'))failed.push('Legacy nested pending selector still visible');
 if(orderButtons.some(button=>button.textContent.includes('Stop Limit')))
   failed.push('Stop Limit unexpectedly selectable for new orders');
 orderButtons.find(button=>button.textContent.trim()==='Limit')?.click();
 await sleep(100);
 assertRoundedOrderType('Limit');
 if(!ticket.querySelector('input[aria-label="Pending entry price"]'))
   failed.push('Limit mode did not show pending entry price');
 orderButtons.find(button=>button.textContent.trim()==='Stop')?.click();
 await sleep(100);
 assertRoundedOrderType('Stop');
 if(!ticket.querySelector('input[aria-label="Pending entry price"]'))
   failed.push('Stop mode did not show trigger entry price');
 orderButtons.find(button=>button.textContent.trim()==='Market')?.click();
 await sleep(100);
 if(ticket.querySelector('input[aria-label="Pending entry price"]'))
   failed.push('Market mode retained a pending entry input');
 // The instrument's hard 1000-lot cap must not be a direct track axis.
 const slider=ticket.querySelector('input[aria-label="Position size slider"]');
 const ticks=Array.from(ticket.querySelectorAll('.v4-scale span'));
 const affordableCap=Number(ticks[ticks.length-1]?.textContent?.replaceAll(',',''));
 if(slider?.max!=='1000')failed.push('Normalized logarithmic Lots slider range missing');
 if(!(affordableCap>0.1&&affordableCap<10))failed.push('Slider did not use affordable lot cap: '+affordableCap);
 if(!ticket.querySelector('.v4-translation')?.textContent?.includes('BTC'))failed.push('BTC quantity missing');
 if(!ticket.querySelector('.v4-translation')?.textContent?.includes(String.fromCharCode(36)))failed.push('USD exposure missing');
 const buy=ticket.querySelector('button.v4-buy');
 if(!buy){failed.push('Buy button missing');status.textContent='FAIL: '+failed.join(' | ');return;}
 buy.click();buy.click();
 await sleep(470);
 if(counters.manual!==1)failed.push('double-click created '+counters.manual+' orders');
 ticket.querySelector('[aria-label="Open markets and select instrument"]')?.click();
 if(counters.markets!==1)failed.push('instrument title did not open Markets');

 findMode(ticket,'Margin $')?.click();
 await sleep(160);
 const initialSlider=ticket.querySelector('input[aria-label="Position size slider"]');
 const marginMax=Number(initialSlider?.max);
 const marginBefore=Number(initialSlider?.value);
 ticket.querySelector('button[aria-label="Increase position value"]')?.click();
 await sleep(200);
 const marginSlider=ticket.querySelector('input[aria-label="Position size slider"]');
 if(!Number.isFinite(marginMax)||Math.abs(Number(marginSlider?.max)-marginMax)>1e-6)failed.push('Margin slider max shifted');
 if(Number(marginSlider?.value)<=marginBefore)failed.push('Margin budget did not advance');
 if(counters.drafts!==1)failed.push('Margin slider did not create exactly one draft');
 checkYAxisGap(chart.querySelector('[data-v4-chart-entry]'),'Draft entry');
 checkBidAskClearance(chart.querySelector('[data-v4-chart-entry]'),chart,'Draft entry');
 if(!chart.querySelector('[title="Add SL"]'))failed.push('Chart draft entry missing SL shortcut');
 if(!chart.textContent.includes('BUY'))failed.push('Chart draft direction missing');
 if(counters.planned!==0)failed.push('Margin draft unexpectedly submitted an order');
 // TradingView-style lifecycle: tapping SL moves the shortcut to its own
 // draggable protection line. Clearing it restores the entry shortcut.
 chart.querySelector('[title="Add SL"]')?.click();
 await sleep(150);
 if(chart.querySelector('[title="Add SL"]'))failed.push('SL chip remained after activation');
 if(!chart.querySelector('[aria-label="Drag SL"]'))failed.push('SL did not transform into draggable price line');
 if(!ticket.querySelector('input[aria-label="Stop Loss value"]'))failed.push('SL chart activation not synchronized with ticket');
 chart.querySelector('[aria-label="Clear SL"]')?.click();
 await sleep(150);
 if(!chart.querySelector('[title="Add SL"]'))failed.push('SL shortcut not restored after clearing line');
 if(ticket.querySelector('input[aria-label="Stop Loss value"]'))failed.push('SL remained enabled in ticket after clearing');

 findMode(ticket,'Risk %')?.click();
 await sleep(180);
 if(findMode(ticket,'Risk %')?.getAttribute('aria-pressed')!=='true')failed.push('Risk % selection failed');
 if(!ticket.querySelector('input[aria-label="Stop Loss value"]'))failed.push('Risk % did not create default SL');
 checkYAxisGap(Array.from(chart.querySelectorAll('[data-v4-chart-badge]')).find(b=>b.textContent.includes('Stop loss')),'Draft SL');
 checkBidAskClearance(Array.from(chart.querySelectorAll('[data-v4-chart-badge]')).find(b=>b.textContent.includes('Stop loss')),chart,'Draft SL');
 const startRisk=Number(ticket.querySelector('input[aria-label="Position size slider"]')?.value);
 ticket.querySelector('button[aria-label="Increase position value"]')?.click();
 await sleep(180);
 if(Number(ticket.querySelector('input[aria-label="Position size slider"]')?.value)<=startRisk)failed.push('Risk slider did not advance');
 if(counters.planned!==0)failed.push('Risk slider unexpectedly submitted an order');

 // The shared plan is patched by real chart controls, and V4 must reflect it.
 const addTp=chart.querySelector('[title="Add TP"]');
 addTp?.click();
 await sleep(150);
 if(!ticket.querySelector('input[aria-label="Take Profit value"]'))failed.push('Chart TP toggle failed to update ticket');
 if(chart.querySelector('[title="Add TP"]'))failed.push('Activated TP shortcut stayed on entry row');
 if(!chart.querySelector('[aria-label="Clear TP"]'))failed.push('Activated TP has no independent removable price line');
 checkYAxisGap(Array.from(chart.querySelectorAll('[data-v4-chart-badge]')).find(b=>b.textContent.includes('Take profit')),'Draft TP');
 checkBidAskClearance(Array.from(chart.querySelectorAll('[data-v4-chart-badge]')).find(b=>b.textContent.includes('Take profit')),chart,'Draft TP');
 // Removing the independent line returns its entry shortcut and updates
 // the same V4 ticket; this is an edit to a draft, not an execution.
 chart.querySelector('[aria-label="Clear TP"]')?.click();
 await sleep(150);
 if(!chart.querySelector('[title="Add TP"]'))failed.push('Removed TP did not return to entry row');
 if(ticket.querySelector('input[aria-label="Take Profit value"]'))failed.push('Removed TP remained active in ticket');
 if(chart.querySelector('[title="Add SL"]'))failed.push('Active risk SL remained on entry row');
 if(!chart.querySelector('[aria-label="Clear SL"]'))failed.push('Active risk SL line not removable');
 const slDrag=chart.querySelector('[aria-label="Drag SL"]');
 if(!slDrag)failed.push('Chart SL drag handle missing');
 else {
   const rect=chart.getBoundingClientRect();
   const original=ticket.querySelector('input[aria-label="Stop Loss value"]')?.value;
   slDrag.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientY:rect.top+340}));
   await sleep(100);
   window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientY:rect.top+352}));
   window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientY:rect.top+352}));
   await sleep(180);
   const updated=ticket.querySelector('input[aria-label="Stop Loss value"]')?.value;
   if(updated===original)failed.push('Chart SL drag did not update ticket');
 }
 findMode(ticket,'Risk USD')?.click();
 await sleep(120);
 if(findMode(ticket,'Risk USD')?.getAttribute('aria-pressed')!=='true')failed.push('Risk USD selection failed');
 if(counters.planned!==0)failed.push('Chart edit unexpectedly sent trading command');
 // Cancelling a draft must restore a clean ticket and chart, and changing
 // the risk slider alone must rebuild a new, protected chart draft.
 chart.querySelector('[aria-label="Cancel draft"]')?.click();
 await sleep(160);
 if(chart.querySelector('[title="Add TP"]'))failed.push('Cancel did not clear draft');
 const countBeforeRisk=counters.drafts;
 ticket.querySelector('button[aria-label="Increase position value"]')?.click();
 await sleep(180);
 if(counters.drafts!==countBeforeRisk+1)failed.push('Risk USD slider did not create an SL-protected draft');
 if(!ticket.querySelector('input[aria-label="Stop Loss value"]'))failed.push('Risk USD draft lacks SL');
 if(counters.planned!==0)failed.push('Risk USD slider sent order');
 // An opposite-side Buy/Sell click only reverses draft direction,
 // never executes the new side automatically.
 const draftBeforeSide=counters.drafts;
 ticket.querySelector('button.v4-sell')?.click();
 await sleep(160);
 if(counters.drafts!==draftBeforeSide+1)failed.push('Sell did not switch draft side');
 if(!chart.textContent.includes('SELL'))failed.push('Chart direction failed to switch to SELL');
 if(counters.planned!==0)failed.push('Direction switch executed a trade');
 // Pending slider drafts keep their normal draggable entry and same
 // protections; switching order type must not place an order.
 const limitMode=Array.from(ticket.querySelectorAll('[aria-label="Order type"] button'))
   .find(b=>b.textContent.trim()==='Limit');
 limitMode?.click();
 await sleep(170);
 if(limitMode?.getAttribute('aria-pressed')!=='true')failed.push('Limit selector did not activate');
 const countBeforePending=counters.drafts;
 ticket.querySelector('button[aria-label="Increase position value"]')?.click();
 await sleep(200);
 if(counters.drafts!==countBeforePending+1)failed.push('Pending slider did not create chart draft');
 if(!chart.querySelector('[aria-label="Drag pending entry"]'))failed.push('Pending chart entry drag missing');
 if(counters.planned!==0)failed.push('Pending slider unexpectedly sent order');
 // Compare actual computed CSS and content height in the SAME 330x620
 // viewport with SL and TP enabled. This ensures we are shrinking visual
 // density, not trading semantics, and protecting the pinned footer.
 chart.querySelector('[title="Add TP"]')?.click();
 await sleep(160);
 const metrics=()=>{
   const node=selector=>ticket.querySelector(selector);
   const height=selector=>Math.round((node(selector)?.getBoundingClientRect().height||0)*10)/10;
   return {
     ticketWidth:Math.round(ticket.getBoundingClientRect().width),
     amountHeight:height('.v4-amount'),
     heroFont:parseFloat(getComputedStyle(node('.v4-hero-value')).fontSize),
     exitHeight:height('.v4-exit-card'),
     quoteHeight:height('.v4-quote-strip'),
     marginSummaryHeight:height('.v4-margin-summary'),
     footerHeight:height('.v4-execution-footer'),
     bodyScrollHeight:node('.v4-ticket-body')?.scrollHeight||0,
     footerPinned:Math.abs(node('.v4-execution-footer').getBoundingClientRect().bottom-ticket.getBoundingClientRect().bottom)<2,
   };
 };
 // Test the previous compact-density/typography baselines independently
 // of the newly approved terminal normalization rules.
 ticket.classList.add('v4-terminal-type-baseline');
 ticket.classList.add('v4-density-baseline');
 await sleep(80);
 const before=metrics();
 ticket.classList.remove('v4-density-baseline');
 await sleep(80);
 const after=metrics();
 if(before.ticketWidth!==330 || after.ticketWidth!==330)failed.push('V4 width changed during density comparison');
 if(before.amountHeight!==58 || after.amountHeight!==44)failed.push('Sizing control density mismatch');
 if(before.heroFont!==27 || after.heroFont!==21)failed.push('Sizing typography mismatch');
 if(!(after.bodyScrollHeight<before.bodyScrollHeight-55))
   failed.push('Compact ticket did not meaningfully reduce vertical space');
 if(!after.footerPinned)failed.push('Compact execution footer not pinned');
 if(!ticket.querySelector('input[aria-label="Take Profit value"]') || !ticket.querySelector('input[aria-label="Stop Loss value"]'))
   failed.push('Density pass cannot display enabled SL and TP');
 // Typography comparison: same 330px dock and same prices with only
 // the approved font/hierarchy CSS toggled. Ensure the CTA text is not clipped.
 const typography=()=>{
   const value=selector=>{
     const el=ticket.querySelector(selector);
     const c=getComputedStyle(el);
     return {size:parseFloat(c.fontSize),weight:Number(c.fontWeight),lineHeight:c.lineHeight,
       family:c.fontFamily,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth};
   };
   return {
     symbol:value('.v4-symbol strong'),
     subtitle:value('.v4-symbol span'),
     price:value('.v4-trade-actions button strong'),
     label:value('.v4-trade-actions button span'),
     quote:value('.v4-quote-strip strong'),
     sizingTab:value('.v4-position-modes .v4-capsule-button'),
     ticks:value('.v4-scale'),
     footerHeight:Math.round(ticket.querySelector('.v4-execution-footer').getBoundingClientRect().height),
     width:Math.round(ticket.getBoundingClientRect().width),
     footerPinned:Math.abs(ticket.querySelector('.v4-execution-footer').getBoundingClientRect().bottom-ticket.getBoundingClientRect().bottom)<2,
   };
 };
 ticket.classList.add('v4-typography-baseline');
 await sleep(100);
 const oldType=typography();
 ticket.classList.remove('v4-typography-baseline');
 await sleep(120);
 const newType=typography();
 if(oldType.symbol.size!==14||newType.symbol.size!==18)failed.push('Instrument font hierarchy not 14 to 18px');
 if(oldType.label.size!==10||newType.label.size!==13)failed.push('Buy/Sell label not 10 to 13px');
 if(oldType.price.size!==14||newType.price.size!==18)failed.push('Execution price not 14 to 18px');
 if(newType.ticks.size!==10||newType.sizingTab.size!==11)failed.push('Secondary label readability regression');
 if(newType.width!==330||!newType.footerPinned)failed.push('Hierarchy refinement changed dock geometry');
 if(newType.price.scrollWidth>newType.price.clientWidth+1)failed.push('Execution price clipped at 330px');
 if(newType.symbol.scrollWidth>newType.symbol.clientWidth+1)failed.push('Instrument symbol clipped at 330px');
 const fontFaces=[];
 document.fonts.forEach(face=>{if(face.family.toLowerCase().includes('inter'))fontFaces.push({family:face.family,status:face.status,weight:face.weight});});
 const typeEvidence=document.createElement('output');
 typeEvidence.id='v4-typography-metrics';
 typeEvidence.textContent=JSON.stringify({before:oldType,after:newType,fontFaces});
 document.body.appendChild(typeEvidence);
 ticket.classList.remove('v4-terminal-type-baseline');
 // Relative to the full terminal, the previously enlarged 18px
 // symbol and CTA prices should normalize to 15px, with the 330px
 // geometry, visible execution footer and chart draft unchanged.
 const terminalType=()=>{
   const style=selector=>{
     const e=ticket.querySelector(selector);
     const c=getComputedStyle(e);
     return {px:parseFloat(c.fontSize),weight:Number(c.fontWeight),
       width:e.clientWidth,scrollWidth:e.scrollWidth};
   };
   return {
     symbol:style('.v4-symbol strong'),
     hero:style('.v4-hero-value'),
     actionLabel:style('.v4-trade-actions button span'),
     actionPrice:style('.v4-trade-actions button strong'),
     actionHeight:Math.round(ticket.querySelector('.v4-trade-actions button').getBoundingClientRect().height),
     width:Math.round(ticket.getBoundingClientRect().width),
     footerPinned:Math.abs(ticket.querySelector('.v4-execution-footer').getBoundingClientRect().bottom-ticket.getBoundingClientRect().bottom)<2,
   };
 };
 ticket.classList.add('v4-terminal-type-baseline');
 await sleep(75);
 const terminalBefore=terminalType();
 ticket.classList.remove('v4-terminal-type-baseline');
 await sleep(75);
 const terminalAfter=terminalType();
 if(terminalBefore.symbol.px!==18||terminalAfter.symbol.px!==15)failed.push('Symbol not normalized 18→15px');
 if(terminalBefore.hero.px!==21||terminalAfter.hero.px!==19)failed.push('Position value not normalized 21→19px');
 if(terminalBefore.actionLabel.px!==13||terminalAfter.actionLabel.px!==11)failed.push('Action label not normalized 13→11px');
 if(terminalBefore.actionPrice.px!==18||terminalAfter.actionPrice.px!==15)failed.push('Execution price not normalized 18→15px');
 if(terminalBefore.actionHeight<60||terminalAfter.actionHeight!==52)failed.push('Action height not normalized to 52px');
 if(terminalAfter.width!==330||!terminalAfter.footerPinned)failed.push('Terminal typography changed ticket geometry');
 if(terminalAfter.actionPrice.scrollWidth>terminalAfter.actionPrice.width+1)failed.push('Execution price clipped after normalization');
 if(terminalAfter.symbol.scrollWidth>terminalAfter.symbol.width+1)failed.push('Symbol clipped after normalization');
 if(terminalAfter.symbol.weight!==600||terminalAfter.actionLabel.weight!==600)failed.push('Primary label weight not terminal-like');
 const normalizationEvidence=document.createElement('output');
 normalizationEvidence.id='v4-terminal-typography-metrics';
 normalizationEvidence.textContent=JSON.stringify({before:terminalBefore,after:terminalAfter});
 document.body.appendChild(normalizationEvidence);
 // Pending slider drafts initially show side selection. Once SELL is chosen,
 // only Discard + one contextual SELL LIMIT Place button may remain.
 if(!ticket.querySelector('button.v4-sell')||!ticket.querySelector('button.v4-buy'))
   failed.push('Slider-created pending order did not require explicit side selection');
 const countBeforeReview=counters.planned;
 ticket.querySelector('button.v4-sell')?.click();
 await sleep(170);
 if(counters.planned!==countBeforeReview)failed.push('Selecting SELL submitted a pending order');
 const pendingPlace=ticket.querySelector('button.v4-pending-place');
 const pendingDiscard=ticket.querySelector('button.v4-pending-discard');
 if(!pendingPlace||!pendingDiscard)failed.push('Selected SELL LIMIT did not show Place + Discard');
 if(ticket.querySelector('button.v4-buy'))failed.push('BUY button repeated while reviewing SELL LIMIT');
 if(!pendingPlace?.textContent.includes('Place SELL LIMIT'))failed.push('Place CTA lacks correct side and type');
 if(!pendingPlace?.textContent.includes('@'))failed.push('Place CTA lacks entry price');
 if(pendingPlace?.disabled)failed.push('Valid SELL LIMIT Place action unavailable');
 if(!chart.textContent.includes('SELL'))failed.push('Chart did not update to chosen SELL side');
 pendingPlace?.click();pendingPlace?.click();
 await sleep(330);
 if(counters.planned!==countBeforeReview+1)failed.push('Place double-click must execute at most once');
 pendingDiscard?.click();
 await sleep(160);
 if(ticket.querySelector('.v4-pending-review-actions'))failed.push('Discard retained Place/Discard footer');
 if(chart.querySelector('[aria-label="Drag pending entry"]'))failed.push('Discard left a chart draft');
 if(counters.planned!==countBeforeReview+1)failed.push('Discard caused an execution');

 if(new URLSearchParams(window.location.search).get('density')==='before')
   ticket.classList.add('v4-density-baseline');
 const qa=document.createElement('output');
 qa.id='v4-density-metrics';
 qa.textContent=JSON.stringify({before,after});
 document.body.appendChild(qa);
 status.textContent=failed.length?'FAIL: '+failed.join(' | ')
   :'V4_SMOKE_PASS 330px terminal typography 18to15 CTA 52px chart-draft no-execution';
}
run().catch(error=>{document.getElementById('v4-smoke-status').textContent='FAIL: '+error.message;});
