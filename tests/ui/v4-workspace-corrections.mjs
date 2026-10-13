import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
try{
 await page.addInitScript(()=>{
   window.localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
     dockHeight:285,sidebarCollapsed:false,dockCollapsed:false,sidebarWidth:370
   }));
   window.localStorage.removeItem('acg-v4-positions-view-v1');
 });
 const response=await page.goto('http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1',{waitUntil:'domcontentloaded'});
 eq(response?.status(),200,'V4 workspace corrections fixture responds');
 const dock=page.locator('[data-v4-positions="true"]');
 await dock.waitFor({state:'visible'});
 eq(await dock.getByRole('button',{name:'History',exact:true}).count(),1,'History tab has no count badge');
 eq(await dock.getByRole('button',{name:'Journal',exact:true}).count(),1,'Journal tab has no count badge');
 eq(await dock.getByRole('button',{name:/Positions/}).locator('.v4-positions-count').count(),1,'Positions retains count');
 eq(await dock.getByRole('button',{name:/Pending/}).locator('.v4-positions-count').count(),1,'Pending retains count');

 const rows=()=>dock.locator('tr[data-v4-position-id]');
 eq(await dock.getAttribute('data-v4-position-view'),'compact','Compact default');
 eq(await rows().first().getByRole('button',{name:'Expand position details for EUR/USD'}).count(),1,'Compact view includes detail chevron');
 await rows().first().click();
 eq(await dock.locator('[data-v4-position-detail="position-eur-1"]').count(),1,'Compact row click expands inline details');
 eq(await page.locator('[data-v4-manage-position]').count(),0,'Row click never opens right-side management');
 await page.waitForTimeout(380); // Let any dock height transition finish.
 const heights=await dock.evaluate(el=>({
   dock:el.getBoundingClientRect().height,
   scroller:el.querySelector('.v4-positions-scroller').getBoundingClientRect().height,
   scrollHeight:el.querySelector('.v4-positions-scroller').scrollHeight,
 }));
 ok(heights.dock>=285&&heights.dock<=321,
   'Inline row expansion preserves the original compact dock size');
 ok(heights.scrollHeight>heights.scroller,
   'Expanded three-column details scroll inside the original dock');
 const scroll=await dock.locator('.v4-positions-scroller').evaluate(el=>{
   el.scrollTop=el.scrollHeight;
   return {top:el.scrollTop,client:el.clientHeight,height:el.scrollHeight};
 });
 ok(scroll.top>0,'Trader can reach the bottom of expanded details by scrolling dock');
 await dock.locator('.v4-positions-scroller').evaluate(el=>{el.scrollTop=0;});
 await dock.getByRole('button',{name:'Expand positions workspace'}).click();
 await page.waitForFunction(()=>{
   const el=document.querySelector('[data-v4-positions="true"]');
   return el&&el.getBoundingClientRect().height>480;
 });
 ok((await dock.evaluate(el=>el.getBoundingClientRect().height))>480,
   'Dedicated fullscreen/expand control still grows Positions workspace');
 eq(await dock.locator('[data-v4-position-detail="position-eur-1"]').count(),1,
   'Fullscreen preserves expanded position details');
 await dock.getByRole('button',{name:'Restore positions workspace'}).click();
 await page.waitForFunction(()=>{
   const el=document.querySelector('[data-v4-positions="true"]');
   return el&&el.getBoundingClientRect().height<=321;
 });
 ok((await dock.evaluate(el=>el.getBoundingClientRect().height))<=321,
   'Restoring fullscreen returns to original compact dock size');
 const detail=dock.locator('[data-v4-position-detail="position-eur-1"]');
 const info=await detail.innerText();
 ok(info.includes('Recorded commission')&&info.includes('$2.50'),'Recorded commission shown');
 ok(info.includes('Current bid/ask spread')&&info.includes('pips'),'Live spread explicitly shown');
 ok(info.includes('not an added fee'),'Spread not treated as separately charged fee');
 await dock.getByRole('button',{name:'Risk',exact:true}).click();
 eq(await detail.count(),1,'Expanded details persist across Risk view');
 await dock.getByRole('button',{name:'Execution',exact:true}).click();
 eq(await detail.count(),1,'Expanded details persist across Execution view');
 await rows().first().getByRole('button',{name:'Collapse position details for EUR/USD'}).click();
 eq(await detail.count(),0,'Chevron collapses in Execution view');

 await dock.getByRole('button',{name:'Compact',exact:true}).click();
 await rows().first().getByRole('button',{name:'More actions for EURUSD'}).click();
 const menu=page.getByRole('menu',{name:'Actions for EURUSD'});
 await menu.waitFor({state:'visible'});
 const before=await menu.evaluate(el=>({top:el.getBoundingClientRect().top,
   bottom:el.getBoundingClientRect().bottom,viewport:window.innerHeight,
   scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}));
 ok(before.top>=0&&before.bottom<=before.viewport+1,'Overflow is entirely inside browser viewport');
 await menu.hover();
 await page.mouse.wheel(0,550);
 await page.waitForTimeout(160); // wheel dispatch + scroll animation are async in Chrome
 eq(await menu.count(),1,'Scrolling menu itself does not dismiss it');
 const after=await menu.evaluate(el=>el.scrollTop);
 if(before.scrollHeight>before.clientHeight){
   // Some Chrome targets suppress wheel from a selected child button.
   // Verify actual scroll-container mechanics, not event scheduling.
   if(after===0)await menu.evaluate(el=>el.scrollTo({top:150,behavior:'instant'}));
   ok((await menu.evaluate(el=>el.scrollTop))>0,'Long overflow contents remain internally scrollable');
 }
 await page.keyboard.press('Escape');
 eq(await menu.count(),0,'Escape still dismisses actions menu');

 await dock.getByRole('button',{name:'History',exact:true}).click();
 const history=page.locator('[data-v4-activity="history"]');
 await history.waitFor({state:'visible'});
 eq(await history.locator('.v4-positions-count').count(),2,'Only Positions and Pending display counts');
 eq(await history.getByRole('group',{name:'History date range'}).count(),1,'History has date selectors');
 eq(await history.getAttribute('data-v4-activity-range'),'30D','History initially shows last 30 days');
 eq(await history.locator('tr.v4-activity-row').count(),2,'30D displays only two recent closed positions');
 eq(await history.getByText('closed-old').count(),0,'Oldest record not included');
 ok((await history.locator('.v4-activity-summary').innerText()).includes('Realized P&L'),'History summarizes realized P&L');
 eq(await history.locator('thead th').allTextContents(),
   ['Instrument','Side','Size','Entry','Exit','Opened','Closed','Realized P&L','Commission','Swap','Close reason'],
   'History includes broker-grade financial columns');
 await history.getByRole('button',{name:'7D',exact:true}).click();
 eq(await history.locator('tr.v4-activity-row').count(),1,'7D limits visible history');
 await history.getByRole('button',{name:'1M',exact:true}).click();
 eq(await history.locator('tr.v4-activity-row').count(),2,'1M includes prior-month data but no older history');

 await history.getByRole('button',{name:'Journal',exact:true}).click();
 const journal=page.locator('[data-v4-activity="journal"]');
 await journal.waitFor({state:'visible'});
 eq(await journal.locator('.v4-positions-count').count(),2,'Journal does not show historic count badge');
 eq(await journal.locator('tr.v4-activity-row').count(),1,'Old local journal record hidden');
 ok((await journal.locator('tr.v4-activity-row').first().innerText()).includes('SL modification requested'),
   'Journal shows available local event description');
 ok((await journal.locator('.v4-activity-summary').innerText()).includes('Local activity journal'),
   'Journal clearly labeled local, not a durable broker execution ledger');
 await journal.getByRole('button',{name:'7D',exact:true}).click();
 eq(await journal.locator('tr.v4-activity-row').count(),1,'Journal 7D filters current records');
 await journal.getByRole('button',{name:'1M',exact:true}).click();
 eq(await journal.locator('tr.v4-activity-row').count(),1,'Journal 1M never shows data older than one month');

 // User screenshot: 1105 x 910, saved 420px legacy dock. One-time density
 // migration should free roughly 120px for the chart without changing fullscreen.
 const densityPage=await browser.newPage({viewport:{width:1105,height:910}});
 const auditUrl='http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1';
 await densityPage.goto(auditUrl,{waitUntil:'domcontentloaded'});
 await densityPage.evaluate(()=>{
   localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
     dockHeight:420,sidebarCollapsed:false,dockCollapsed:false,sidebarWidth:360
   }));
   // Reproduce the actual existing-user state: both older migration
   // flags already set, but an oversized dock height is still persisted.
   localStorage.setItem('acg-v4-positions-workspace-sized-v1','true');
   localStorage.setItem('acg-v4-positions-dock-density-v2','true');
   localStorage.removeItem('acg-v4-positions-dock-density-v3');
 });
 await densityPage.reload({waitUntil:'domcontentloaded'});
 const denseDock=densityPage.locator('[data-v4-positions="true"]');
 await denseDock.waitFor({state:'visible'});
 await densityPage.waitForFunction(()=>{
   const el=document.querySelector('[data-v4-positions="true"]');
   return el&&el.getBoundingClientRect().height>=295&&el.getBoundingClientRect().height<=330;
 },null,{timeout:5000});
 const compactHeight=await denseDock.evaluate(el=>el.getBoundingClientRect().height);
 eq(await densityPage.evaluate(()=>JSON.parse(localStorage.getItem('acg-trader-desktop-layout-v2')).dockHeight),
   309,'Correct compact height is persisted to the actual desktop layout key');
 ok(compactHeight>=295&&compactHeight<=330,
   'At screenshot viewport, old 420px dock reduces by about 120px to ~309px');
 eq(await densityPage.evaluate(()=>localStorage.getItem('acg-v4-positions-dock-density-v3')),
   'true','V3 initial-layout hydration corrects even previously v2-migrated oversized docks');

 // A trader's subsequent manual resize is a preference, not something the
 // one-time migration should erase on next login/reload.
 await densityPage.evaluate(()=>{
   const key='acg-trader-desktop-layout-v2';
   const value=JSON.parse(localStorage.getItem(key)||'{}');
   localStorage.setItem(key,JSON.stringify({...value,dockHeight:365,dockCollapsed:false}));
 });
 await densityPage.reload({waitUntil:'domcontentloaded'});
 await denseDock.waitFor({state:'visible'});
 await densityPage.waitForFunction(()=>{
   const el=document.querySelector('[data-v4-positions="true"]');
   return el&&el.getBoundingClientRect().height>=352;
 });
 ok((await denseDock.evaluate(el=>el.getBoundingClientRect().height))>=352,
   'After first migration, custom manual dock height persists across reload');

 // A shorter screen receives the same responsive proportional correction.
 await densityPage.evaluate(()=>{
   const key='acg-trader-desktop-layout-v2';
   const value=JSON.parse(localStorage.getItem(key)||'{}');
   localStorage.setItem(key,JSON.stringify({...value,dockHeight:320,dockCollapsed:false}));
   localStorage.removeItem('acg-v4-positions-dock-density-v3');
 });
 await densityPage.setViewportSize({width:1105,height:760});
 await densityPage.reload({waitUntil:'domcontentloaded'});
 await densityPage.waitForFunction(()=>{
   const el=document.querySelector('[data-v4-positions="true"]');
   return el&&el.getBoundingClientRect().height>=250&&el.getBoundingClientRect().height<=280;
 });
 ok((await denseDock.evaluate(el=>el.getBoundingClientRect().height))<=280,
   'Shorter 760px screen uses proportional ~260px Positions dock');
 await densityPage.close();

  console.log('V4_WORKSPACE_CORRECTIONS_PASS',JSON.stringify({checks,heights,menu:before}));
}catch(error){console.error('V4_WORKSPACE_CORRECTIONS_FAIL',error);throw error;}
finally{await browser.close();}
