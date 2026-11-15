import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const root='http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1';
async function dockHeight(){
 return page.locator('.acg-desktop-dock-shell').evaluate(el=>Math.round(el.getBoundingClientRect().height));
}
async function waitHeight(min,max){
 await page.waitForFunction(({min,max})=>{
   const element=document.querySelector('.acg-desktop-dock-shell');
   const height=element?.getBoundingClientRect().height||0;
   return height>=min&&height<=max;
 },{min,max},{timeout:10000});
}
try{
 await page.addInitScript(()=>{
   if(!sessionStorage.getItem('v4-dock-empty-test-seeded')){
     localStorage.removeItem('acg-trader-desktop-dock-audit-layout-v1');
     sessionStorage.setItem('v4-dock-empty-test-seeded','1');
   }
   if(!localStorage.getItem('acg-trader-desktop-layout-v2')){
     localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
       dockHeight:260,dockCollapsed:false,sidebarCollapsed:false,sidebarWidth:360,
     }));
   }
   localStorage.setItem('acg-v4-positions-dock-density-v3','true');
 });
 await page.goto(root+'&acg_dock_audit=1',{waitUntil:'domcontentloaded'});
 const dock=page.locator('[data-acg-dock-audit=true]');
 await dock.waitFor({state:'visible'});
 await dock.getByRole('button',{name:'Account overview and margin details'}).waitFor();
 await waitHeight(160,166);
 assert.equal(await dock.locator('tr[data-v4-position-id]').count(),2,'Existing positions have 2 trade rows');
 // A closed final position is reflected in the actual parent layout, not just hidden by CSS.
 await page.evaluate(()=>window.v4PositionsQA.setPositions([]));
 await waitHeight(42,46);
 assert.match((await dock.locator('.v4-positions-tab.is-active').innerText()).replace(/\s+/g,' '),/^Positions 0$/);
 assert.equal(await dock.locator('.v4-positions-scroller').count(),0,'Empty positions show only toolbar');
 console.log('EMPTY_POSITIONS_AUTO_COMPACT',JSON.stringify({height:await dockHeight()}));
 await dock.getByRole('button',{name:/Pending/}).click();
 await waitHeight(160,166);
 assert.equal(await page.locator('[data-v4-pending=true]').count(),1,'Pending order remains accessible');
 await page.locator('[data-v4-pending=true]').getByRole('button',{name:/Positions/}).click();
 await waitHeight(42,46);
 // Loading and errors are visible, never silently collapsed.
 await page.evaluate(()=>window.v4PositionsQA.setLoading(true));
 await waitHeight(160,166);
 await page.evaluate(()=>window.v4PositionsQA.setLoading(false));
 await waitHeight(42,46);
 await page.evaluate(()=>window.v4PositionsQA.setError('Fixture network error'));
 await waitHeight(160,166);
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await waitHeight(42,46);
 // Explicit Open dock control overrides auto compact while leaving account untouched.
 await page.getByRole('button',{name:'Open positions dock'}).click();
 await waitHeight(160,166);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('acg-trader-desktop-dock-audit-layout-v1')).dockManuallyResized),true,
   'User override is persisted within audit preferences');
 await page.reload({waitUntil:'domcontentloaded'});
 await waitHeight(160,166);
 const normal=await page.evaluate(()=>localStorage.getItem('acg-trader-desktop-layout-v2'));
 await page.goto(root,{waitUntil:'domcontentloaded'});
 const original=page.locator('[data-v4-positions=true]');
 await original.waitFor({state:'visible'});
 assert.equal(await original.getByRole('searchbox',{name:'Find position'}).count(),1,'Normal customer UI untouched');
 assert.equal(await page.evaluate(()=>localStorage.getItem('acg-trader-desktop-layout-v2')),normal,'Normal saved layout untouched');
 assert.deepEqual(errors,[],'No page JS exceptions');
 console.log('V4_DOCK_EMPTY_STATE_PASS');
}finally{await browser.close();}
