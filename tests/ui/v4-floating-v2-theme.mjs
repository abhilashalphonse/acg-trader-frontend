import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
try {
 await page.addInitScript(()=>{
  localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
   sidebarCollapsed:true,sidebarWidth:360,dockCollapsed:false,dockHeight:300
  }));
 });
 const response=await page.goto('http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1',{waitUntil:'domcontentloaded'});
 eq(response?.status(),200,'Opt-in V4 full terminal fixture loads');
 const ticket=page.locator('[data-v2-floating-quick-order="true"]');
 await ticket.waitFor({state:'visible'});
 eq(await ticket.count(),1,'Exactly one V2-themed floating ticket');
 const box=await ticket.evaluate(el=>{
   const r=el.getBoundingClientRect(),header=el.firstElementChild;
   const row=el.children[2],headerButtons=Array.from(header.querySelectorAll('button'));
   const symbol=header.querySelector('div span'),summary=el.children[1];
   const buy=el.querySelector('.acg-exec-buy'),sell=el.querySelector('.acg-exec-sell');
   const geometric=node=>node.getBoundingClientRect();
   return {
     width:r.width,height:r.height,
     font:getComputedStyle(el).fontFamily,
     familyPill:{
       text:headerButtons[1].textContent.trim(),
       active:headerButtons[1].getAttribute('data-v2-pill-active'),
       bg:getComputedStyle(headerButtons[1]).backgroundColor,
       color:getComputedStyle(headerButtons[1]).color,
       radius:getComputedStyle(headerButtons[1]).borderTopLeftRadius
     },
     riskPill:{
       active:headerButtons[2].getAttribute('data-v2-pill-active'),
       bg:getComputedStyle(headerButtons[2]).backgroundColor,
       radius:getComputedStyle(headerButtons[2]).borderTopLeftRadius
     },
     stopPill:{
       active:headerButtons[3].getAttribute('data-v2-pill-active'),
       radius:getComputedStyle(headerButtons[3]).borderTopLeftRadius
     },
     takePill:{
       active:headerButtons[4].getAttribute('data-v2-pill-active'),
       radius:getComputedStyle(headerButtons[4]).borderTopLeftRadius
     },
     headerHeight:geometric(header).height,summaryHeight:geometric(summary).height,
     headerBg:getComputedStyle(header).backgroundColor,
     mainBg:getComputedStyle(el).backgroundColor,
     line:getComputedStyle(el).borderTopColor,
     headerButtons:headerButtons.length,
     symbolY:geometric(symbol).top,
     marketY:geometric(headerButtons[1]).top,
     riskY:geometric(headerButtons[2]).top,
     stopY:geometric(headerButtons[3]).top,
     takeY:geometric(headerButtons[4]).top,
     closeY:geometric(headerButtons[5]).top,
     sellBg:getComputedStyle(sell).backgroundColor,
     buyBg:getComputedStyle(buy).backgroundColor,
     actionHeight:geometric(row.querySelector('.acg-exec-buy')).height,
     scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
     scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,
   };
 });
 ok(box.width>=342&&box.width<=346,'Original 344px ticket width retained');
 ok(box.height>=118&&box.height<=145,'Original one-row compact ticket height retained');
 eq(box.headerHeight,36,'Original 36px header unchanged');
 eq(box.summaryHeight,30,'Original 30px financial strip unchanged');
 eq(box.actionHeight,42,'Original 42px trade action heights unchanged');
 eq(box.headerButtons,6,'All original six quick-ticket header buttons retained');
 ok(Math.abs(box.symbolY-box.marketY)<12,'Symbol and Market share original single-row header');
 ok(Math.abs(box.marketY-box.riskY)<2&&Math.abs(box.riskY-box.stopY)<2
    &&Math.abs(box.stopY-box.takeY)<2&&Math.abs(box.takeY-box.closeY)<2,
    'Market, Risk, SL, TP and fullscreen align in same header row');
 eq(box.mainBg,'rgb(9, 9, 11)','V2 canvas is near-black');
 ok(box.font.startsWith('Inter'),'Original floating Quick Order uses the same Inter font');
 eq(box.familyPill.active,'true','Selected order mode has active pill state');
 eq(box.familyPill.bg,'rgb(244, 244, 245)','Selected MARKET/PENDING pill is V2 white');
 eq(box.familyPill.color,'rgb(17, 17, 19)','White pill uses dark readable text');
 eq(box.familyPill.radius,'999px','Market/Pending control is a white pill');
 eq(box.riskPill.active,'false','Inactive Risk pill has correct state');
 eq(box.riskPill.bg,'rgb(32, 32, 35)','Inactive Risk pill stays graphite');
 eq(box.riskPill.radius,'999px','Risk uses pill geometry');
 eq(box.stopPill.radius,'999px','SL uses pill geometry');
 eq(box.takePill.radius,'999px','TP uses pill geometry');
 eq(box.headerBg,'rgb(16, 16, 18)','V2 controls use distinct graphite header');
 eq(box.line,'rgb(38, 38, 40)','V2 neutral border');
 eq(box.sellBg,'rgb(200, 50, 66)','SELL uses existing V2 execution red');
 eq(box.buyBg,'rgb(25, 91, 225)','BUY uses existing V2 execution blue');
 eq(box.scrollWidth,box.clientWidth,'No horizontal overflow');
 eq(box.scrollHeight,box.clientHeight,'No vertical overflow');
 eq(await ticket.getByRole('button',{name:'Drag execution widget'}).count(),1,'Existing drag handler retained');
 eq(await ticket.getByRole('button',{name:'Open full trade execution panel'}).count(),1,'Existing expand handler retained');
 eq(await ticket.getByRole('button',{name:'Increase lot size'}).count(),1,'Existing lot increment retained');
 eq(await ticket.getByRole('button',{name:'Decrease lot size'}).count(),1,'Existing lot decrement retained');
 eq(await ticket.locator('button.acg-exec-buy').count(),1,'Same BUY action component');
 eq(await ticket.locator('button.acg-exec-sell').count(),1,'Same SELL action component');
 await ticket.getByRole('button',{name:'Increase lot size'}).click();
 eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,'Sizing interaction never submits a trade');
 await ticket.getByRole('button',{name:'Decrease lot size'}).click();
 eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,'Decrement interaction never submits a trade');
 console.log('V4_FLOATING_V2_THEME_PASS',JSON.stringify({checks,box}));
}catch(error){console.error('V4_FLOATING_V2_THEME_FAIL',error);throw error;}
finally{await browser.close();}
