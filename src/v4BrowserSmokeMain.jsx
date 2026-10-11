// Synthetic-only, unauthenticated browser acceptance. NOT an order API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import DesktopOrderTicketV4 from './components/trading-v2/desktop/DesktopOrderTicketV4.jsx';
import { createDefaultTradePlan } from './utils/tradePlanExecution.js';

const DEMO = Object.freeze({
  symbol:'BTCUSD',displaySymbol:'BTC/USD',name:'Bitcoin / US Dollar',
  assetClass:'CRYPTO',bid:83001.02,ask:83020.98,tickSize:0.01,pipSize:0.01,
  quoteCurrency:'USD',marginCurrency:'USD',pnlCurrency:'USD',contractSize:1,
  volumeStep:0.01,minVolume:0.01,maxVolume:10,defaultLeverage:10,
  sessionOpen:true,isStale:false,marketState:'ACTIVE',
});
const ACCOUNT = Object.freeze({
  id:'v4-browser-synthetic',status:'ACTIVE',tradingEnabled:true,valuationStatus:'LIVE',
  currency:'USD',equity:100000,balance:100000,freeMargin:20000,leverage:10,
  capabilities:{
    policyVersion:'ACG_FUNDED_V2',
    fundedV2Confirmed:true,manualLotWithoutStopLoss:true,optionalStopLoss:true,
  },
});
const counters={manual:0,planned:0,markets:0,notice:''};
function Fixture(){
 const [lots,setLots]=useState(0.1);
 const [sizing,setSizing]=useState('lots');
 const [percent,setPercent]=useState(0.5);
 const [type,setType]=useState('market');
 const [plan,setPlan]=useState(null);
 const [pending,setPending]=useState(false);
 return <DesktopOrderTicketV4
   market={DEMO} account={ACCOUNT} lots={lots} onLotsChange={setLots}
   sizingMode={sizing} onSizingModeChange={setSizing}
   riskPercent={percent} onRiskPercentChange={setPercent}
   orderType={type} onOrderTypeChange={setType}
   tradePlan={plan} onTradePlanChange={patch=>setPlan(p=>p?{...p,...patch}:p)}
   onStartPlan={(side,requestedType,options)=>setPlan(createDefaultTradePlan({
     side,requestedType,market:DEMO,sizingMode:sizing,lots,
     protection:options?.protection||'both',
   }))}
   onCancelPlan={()=>setPlan(null)}
   onExecutePlan={async()=>{counters.planned++;setPending(true);await new Promise(resolve=>setTimeout(resolve,160));setPending(false);}}
   onManualOrder={async()=>{counters.manual++;setPending(true);await new Promise(resolve=>setTimeout(resolve,160));setPending(false);}}
   executionCommandPending={pending} onNotice={message=>{counters.notice=message;}}
   onOpenMarkets={()=>{counters.markets++;}}
   exposureAllowed={true}
 />;
}
createRoot(document.getElementById('root')).render(<Fixture/>);

setTimeout(()=>{
 const status=document.getElementById('v4-smoke-status');
 const failed=[];
 const root=document.getElementById('fixture');
 const ticket=root.querySelector('[aria-label="ACG Trader V4 live execution ticket"]');
 if(!ticket){status.textContent='FAIL: no V4 ticket';return;}
 const body=ticket.querySelector('.v4-ticket-body');
 const footer=ticket.querySelector('.v4-execution-footer');
 const selected=ticket.querySelector('.v4-mainmodes .v4-capsule-button.selected');
 const size=ticket.getBoundingClientRect();
 if(Math.abs(size.width-330)>1)failed.push('ticket not 330px: '+size.width);
 if(!body||!footer)failed.push('missing scroll body/footer');
 else {
   if(body.scrollHeight<=body.clientHeight)failed.push('ticket body should scroll at 620px height');
   const foot=footer.getBoundingClientRect();
   const parent=root.getBoundingClientRect();
   if(foot.bottom>parent.bottom+1 || foot.bottom<parent.bottom-5)failed.push('footer not bottom-pinned');
 }
 if(selected && getComputedStyle(selected).backgroundColor!=='rgb(247, 247, 248)')failed.push('selected capsule not white');
 if(!selected)failed.push('selected Market pill missing');
 const buys=Array.from(ticket.querySelectorAll('button')).filter(b=>b.textContent.includes('BUY')&&b.classList.contains('v4-buy'));
 if(buys.length!==1)failed.push('Buy button missing');
 else {
   buys[0].click();buys[0].click();
 }
 setTimeout(()=>{
   if(counters.manual!==1)failed.push('double-click triggered '+counters.manual+' orders');
   const symbol=ticket.querySelector('[aria-label="Open markets and select instrument"]');
   symbol?.click();
   if(counters.markets!==1)failed.push('symbol click did not open Markets callback');
   const mode=label=>Array.from(ticket.querySelectorAll('.v4-position-modes button'))
     .find(b=>b.textContent.trim()===label);
   const margin=mode('Margin 
},900);
);
   margin?.click();
   setTimeout(()=>{
     const slider=ticket.querySelector('input[aria-label="Position size slider"]');
     const maxBefore=Number(slider?.max);
     const valueBefore=Number(slider?.value);
     ticket.querySelector('button[aria-label="Increase position value"]')?.click();
     setTimeout(()=>{
       const after=ticket.querySelector('input[aria-label="Position size slider"]');
       if(Math.abs(Number(after?.max)-maxBefore)>1e-6)failed.push('Margin slider ceiling changes when budget changes');
       const amount=ticket.querySelector('[aria-label="Edit Position sizing amount"]');
       if(valueBefore>=Number(after?.value))failed.push('Margin budget did not advance independently');
       if(!amount)failed.push('Margin value control missing');
       counters.notice='';
       mode('Risk %')?.click();
       setTimeout(()=>{
         if(!mode('Risk %')?.getAttribute('aria-pressed')?.includes('true'))failed.push('Risk % could not be selected without an SL');
         if(/set a stop loss|set a valid SL/i.test(counters.notice))failed.push('Risk % demanded manual SL');
         ticket.querySelector('button.v4-buy')?.click();
         setTimeout(()=>{
           if(!ticket.querySelector('.v4-exit-card .v4-exit-toggle[aria-pressed="true"]'))failed.push('Buy risk plan did not auto-create an SL');
           if(!ticket.querySelector('input[aria-label="Stop Loss value"]'))failed.push('Automatic SL price not available in editor');
           mode('Risk USD')?.click();
           setTimeout(()=>{
             if(mode('Risk USD')?.getAttribute('aria-pressed')!=='true')failed.push('Risk USD unavailable after risk plan');
             if(failed.length)status.textContent='FAIL: '+failed.join(' | ');
             else status.textContent='V4_SMOKE_PASS 330px-footer single-submit Markets Margin Risk auto-SL';
           },120);
         },160);
       },120);
     },120);
   },120);
 },500);
},900);
