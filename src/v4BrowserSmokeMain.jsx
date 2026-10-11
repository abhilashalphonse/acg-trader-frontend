// Synthetic-only, unauthenticated browser acceptance. NOT an order API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import DesktopOrderTicketV4 from './components/trading-v2/desktop/DesktopOrderTicketV4.jsx';
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
   executionCommandPending={pending}
   onNotice={message=>{counters.notice=message;}}
   onOpenMarkets={()=>{counters.markets++;}}
   exposureAllowed={true}
 />;
}
createRoot(document.getElementById('root')).render(<Fixture/>);

const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const findMode=(ticket,text)=>Array.from(ticket.querySelectorAll('.v4-position-modes button'))
  .find(button=>button.textContent.trim()===text);
async function run(){
 await sleep(900);
 const failed=[];
 const status=document.getElementById('v4-smoke-status');
 const root=document.getElementById('fixture');
 const ticket=root.querySelector('[aria-label="ACG Trader V4 live execution ticket"]');
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
 await sleep(500);
 if(counters.manual!==1)failed.push('double-click created '+counters.manual+' orders');

 ticket.querySelector('[aria-label="Open markets and select instrument"]')?.click();
 if(counters.markets!==1)failed.push('instrument title did not open Markets');

 const margin=findMode(ticket,'Margin $');
 if(!margin){failed.push('Margin tab missing');status.textContent='FAIL: '+failed.join(' | ');return;}
 margin.click();
 await sleep(150);
 const initialSlider=ticket.querySelector('input[aria-label="Position size slider"]');
 const marginMax=Number(initialSlider?.max);
 const marginBefore=Number(initialSlider?.value);
 ticket.querySelector('button[aria-label="Increase position value"]')?.click();
 await sleep(150);
 const marginSlider=ticket.querySelector('input[aria-label="Position size slider"]');
 if(!Number.isFinite(marginMax)||Math.abs(Number(marginSlider?.max)-marginMax)>1e-6)failed.push('Margin slider max shifted');
 if(Number(marginSlider?.value)<=marginBefore)failed.push('Margin budget did not advance');

 counters.notice='';
 findMode(ticket,'Risk %')?.click();
 await sleep(150);
 if(findMode(ticket,'Risk %')?.getAttribute('aria-pressed')!=='true')failed.push('Risk % selection failed');
 if(/set a stop loss|set a valid SL/i.test(counters.notice))failed.push('Risk % demanded manual SL');
 buy.click();
 await sleep(200);
 if(!ticket.querySelector('.v4-exit-card .v4-exit-toggle[aria-pressed="true"]'))failed.push('risk Buy did not create default SL');
 if(!ticket.querySelector('input[aria-label="Stop Loss value"]'))failed.push('auto SL input absent');
 findMode(ticket,'Risk USD')?.click();
 await sleep(160);
 if(findMode(ticket,'Risk USD')?.getAttribute('aria-pressed')!=='true')failed.push('Risk USD selection failed');

 status.textContent=failed.length?'FAIL: '+failed.join(' | ')
   :'V4_SMOKE_PASS 330px footer single-submit Markets Margin Risk auto-SL';
}
run().catch(error=>{document.getElementById('v4-smoke-status').textContent='FAIL: '+error.message;});
