// Synthetic-only full ticket + chart browser acceptance; NO trading API.
import React, { useState } from 'react';
// Match the actual terminal's production styling in Chromium visual QA.
import './index.css';
import './styles/acg-pure-black.css';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import DesktopOrderTicketV4 from './components/trading-v2/desktop/DesktopOrderTicketV4.jsx';
import { TradePlanOverlay, PendingOrderOverlay } from './components/trading-v2/ChartArea.jsx';
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
    orders={[pendingOrder]}
    desktopStyle
    account={ACCOUNT}
    accountCurrency="USD"
    onMove={(orderId, nextPrice, field) => { counters.pendingMoves.push({ orderId, nextPrice, field }); }}
  />
);


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
