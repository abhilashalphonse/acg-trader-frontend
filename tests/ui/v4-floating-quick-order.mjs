import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
let checks=0;
const eq=(a,b,name)=>{assert.deepEqual(a,b,name);checks++;};
const ok=(value,name)=>{assert.ok(value,name);checks++;};
try {
 await page.addInitScript(()=>{
  localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
   sidebarCollapsed:true,sidebarWidth:360,dockCollapsed:false,dockHeight:300
  }));
 });
 const response=await page.goto('http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1',{waitUntil:'domcontentloaded'});
 eq(response?.status(),200,'Full-terminal opt-in fixture loads');
 const ticket=page.locator('[data-v4-quick-order="true"]');
 await ticket.waitFor({state:'visible'});
 eq(await ticket.count(),1,'Exactly one floating V4 quick ticket');
 eq(await ticket.locator('.acg-exec-sell').count(),1,'Retains existing SELL callback');
 eq(await ticket.locator('.acg-exec-buy').count(),1,'Retains existing BUY callback');
 eq(await ticket.getByRole('button',{name:'Drag execution widget'}).count(),1,'Floating drag handle retained');
 eq(await ticket.getByRole('button',{name:'Open full trade execution panel'}).count(),1,'Full trade action retained');
 eq(await ticket.getByRole('button',{name:'Toggle risk sizing'}).count(),1,'Risk sizing retains existing control');
 eq(await ticket.getByRole('button',{name:'Add or edit stop loss'}).count(),1,'SL retains existing workflow');
 eq(await ticket.getByRole('button',{name:'Add or edit take profit'}).count(),1,'TP retains existing workflow');
 eq(await ticket.getByRole('button',{name:'Increase lot size'}).count(),1,'Existing lot increment control remains');
 eq(await ticket.getByRole('button',{name:'Decrease lot size'}).count(),1,'Existing lot decrement control remains');
 const appearance=await ticket.evaluate(el=>{
   const box=el.getBoundingClientRect(),header=el.firstElementChild;
   const headerBox=header.getBoundingClientRect();
   const mode=header.querySelector('button[aria-label^="Market order"],button[aria-label^="Pending order"]');
   const risk=header.querySelector('button[aria-label="Toggle risk sizing"]');
   const exit=header.querySelector('button[aria-label="Add or edit stop loss"]');
   const open=header.querySelector('button[aria-label="Open full trade execution panel"]');
   const logo=header.querySelector('div');
   const seller=el.querySelector('.acg-exec-sell');
   const buyer=el.querySelector('.acg-exec-buy');
   return {
    width:box.width,height:box.height,
    headerHeight:headerBox.height,background:getComputedStyle(el).backgroundColor,
    modeY:mode.getBoundingClientRect().top,riskY:risk.getBoundingClientRect().top,
    protectionY:exit.getBoundingClientRect().top,
    titleY:logo.getBoundingClientRect().top,expandY:open.getBoundingClientRect().top,
    sellBg:getComputedStyle(seller).backgroundColor,
    buyBg:getComputedStyle(buyer).backgroundColor,
    horizontalOverflow:el.scrollWidth-el.clientWidth,
    verticalOverflow:el.scrollHeight-el.clientHeight,
    font:getComputedStyle(header).fontFamily,
   };
 });
 ok(appearance.width>=342&&appearance.width<=346,'344px compact ticket footprint retained');
 ok(appearance.height<200,'Quick ticket stays below 200px high');
 ok(appearance.headerHeight>=65,'Header controls have their own row, no more crowded single line');
 ok(appearance.modeY>appearance.titleY+20,'Order family control is below symbol header');
 ok(Math.abs(appearance.modeY-appearance.riskY)<3&&Math.abs(appearance.riskY-appearance.protectionY)<3,
   'Market/Risk/SL/TP aligned in a single row');
 ok(Math.abs(appearance.titleY-appearance.expandY)<6,'Expand stays aligned with instrument header');
 eq(appearance.background,'rgb(9, 9, 11)','Matches V4 pure-black surface');
 ok(appearance.font.startsWith('Inter'), 'Uses the same Inter typography as the full V4 execution ticket');
 eq(appearance.sellBg,'rgb(200, 50, 66)','SELL keeps established execution red');
 eq(appearance.buyBg,'rgb(25, 91, 225)','BUY keeps established execution blue');
 eq(appearance.horizontalOverflow,0,'No horizontal clipping');
 eq(appearance.verticalOverflow,0,'No vertical clipping');
 ok((await ticket.innerText()).includes('Est. margin'),'Margin labeled as estimate');
 ok((await ticket.innerText()).includes('Free after'),'Free-after projection shown');
 await ticket.getByRole('button',{name:'Increase lot size'}).click();
 eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,
  'Quantity controls do not send trading commands');
 await ticket.getByRole('button',{name:'Add or edit stop loss'}).click();
 eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,
  'SL shortcut never submits execution command');
 console.log('V4_FLOATING_QUICK_ORDER_PASS',JSON.stringify({checks,appearance}));
} catch(error) { console.error('V4_FLOATING_QUICK_ORDER_FAIL',error);throw error;}
finally {await browser.close();}
