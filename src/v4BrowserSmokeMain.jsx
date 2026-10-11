// Synthetic-only full ticket + chart browser acceptance; NO trading API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import DesktopOrderTicketV4 from './components/trading-v2/desktop/DesktopOrderTicketV4.jsx';
import { TradePlanOverlay } from './components/trading-v2/ChartArea.jsx';
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
const counters={manual:0,planned:0,drafts:0,markets:0,notice:''};
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
       riskPercent={percent} accountCurrency="USD"/>,
     document.getElementById('chart-fixture')
   )}
 </>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);

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
 if(!chart.querySelector('[title="Add SL"]'))failed.push('Chart draft entry missing SL shortcut');
 if(!chart.textContent.includes('BUY'))failed.push('Chart draft direction missing');
 if(counters.planned!==0)failed.push('Margin draft unexpectedly submitted an order');

 findMode(ticket,'Risk %')?.click();
 await sleep(180);
 if(findMode(ticket,'Risk %')?.getAttribute('aria-pressed')!=='true')failed.push('Risk % selection failed');
 if(!ticket.querySelector('input[aria-label="Stop Loss value"]'))failed.push('Risk % did not create default SL');
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
 status.textContent=failed.length?'FAIL: '+failed.join(' | ')
   :'V4_SMOKE_PASS 330px chart-draft slider-first Margin Risk SL-TP sync no-execution';
}
run().catch(error=>{document.getElementById('v4-smoke-status').textContent='FAIL: '+error.message;});
