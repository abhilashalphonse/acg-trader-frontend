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
 await waitHeight(180,186);
 assert.equal(await dock.locator('tr[data-v4-position-id]').count(),2,'Existing positions have 2 trade rows');
 // A closed final position is reflected in the actual parent layout, not just hidden by CSS.
 await page.evaluate(()=>window.v4PositionsQA.setPositions([]));
 await waitHeight(118,122);
 assert.match((await dock.locator('.v4-positions-tab.is-active').innerText()).replace(/\s+/g,' '),/^Positions 0$/);
 const empty=dock.getByRole('status').filter({hasText:'No open positions'});
 await empty.waitFor({state:'visible'});
 assert.equal(await empty.locator('strong').innerText(),'No open positions');
 assert.equal(await empty.locator('span').innerText(),'Your active positions will appear here.');
 assert.equal(await dock.locator('.v4-positions-scroller').count(),0,'No empty table or horizontal scrollbar');
 assert.equal(await dock.locator('.v4-positions-footer').count(),0,'No footer underneath empty message');
 const background=await empty.evaluate(el=>{
   const bottom=el.getBoundingClientRect().bottom;
   const textBottom=el.querySelector('span').getBoundingClientRect().bottom;
   return {bottom,textBottom};
 });
 assert.ok(background.bottom-background.textBottom>=5,'Leave a plain empty region beneath message');
 await dock.getByRole('button',{name:'Expand positions workspace'}).click();
 await page.waitForTimeout(450);
 assert.equal(await dock.getByRole('status').filter({hasText:'No open positions'}).count(),1,
   'Fullscreen empty workspace retains the message');
 assert.equal(await dock.locator('.v4-positions-footer').count(),0,
   'Fullscreen empty workspace also has no footer');
 await dock.getByRole('button',{name:'Restore positions workspace'}).click();
 await waitHeight(118,122);
 console.log('EMPTY_POSITIONS_NO_FOOTER',JSON.stringify({height:await dockHeight(),background}));
 await dock.getByRole('button',{name:/Pending/}).click();
 await page.locator('[data-v4-pending=true]').waitFor({state:'visible',timeout:12000});
 await waitHeight(180,186);
 assert.equal(await page.locator('[data-v4-pending=true] .v4-position-row').count(),1,
   'Pending order remains accessible after lazy module load');
 await page.locator('[data-v4-pending=true]').getByRole('button',{name:/Positions/}).click();
 await waitHeight(118,122);
 // Loading and errors are visible, never silently collapsed.
 await page.evaluate(()=>window.v4PositionsQA.setLoading(true));
 await waitHeight(180,186);
 await page.evaluate(()=>window.v4PositionsQA.setLoading(false));
 await waitHeight(118,122);
 await page.evaluate(()=>window.v4PositionsQA.setError('Fixture network error'));
 await waitHeight(180,186);
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await waitHeight(118,122);
 // Collapse is explicit: hiding the whole dock is distinct from a short empty state.
 await page.getByRole('button',{name:'Close positions dock'}).click();
 await waitHeight(42,46);
 await page.getByRole('button',{name:'Open positions dock'}).click();
 await waitHeight(118,122);
 // Deliberate drag height must override automatic sizing and survive reload.
 const handle=page.getByRole('button',{name:'Resize chart and positions dock'});
 const rect=await handle.boundingBox();
 assert.ok(rect,'Resize handle is available in the empty state');
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 await page.mouse.down();
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2-90,{steps:6});
 await page.mouse.up();
 await waitHeight(180,260);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('acg-trader-desktop-dock-audit-layout-v1')).dockManuallyResized),true,
   'Manual resizing persists only in audit preferences');
 await page.reload({waitUntil:'domcontentloaded'});
 await waitHeight(180,260);
 const normal=await page.evaluate(()=>localStorage.getItem('acg-trader-desktop-layout-v2'));
 await page.goto(root,{waitUntil:'domcontentloaded'});
 const original=page.locator('[data-v4-positions=true]');
 await original.waitFor({state:'visible'});
 assert.equal(await original.getByRole('searchbox',{name:'Find position'}).count(),1,'Normal customer UI untouched');
 const normalAfter=await page.evaluate(()=>localStorage.getItem('acg-trader-desktop-layout-v2'));
 assert.equal(JSON.parse(normalAfter).dockHeight,JSON.parse(normal).dockHeight,
   'Normal user dock height unchanged (normal terminal can normalize missing defaults)');
 assert.equal(JSON.parse(normalAfter).sidebarWidth,JSON.parse(normal).sidebarWidth,
   'Normal user sidebar width unchanged');
 assert.deepEqual(errors,[],'No page JS exceptions');
 console.log('V4_DOCK_EMPTY_STATE_PASS');
}finally{await browser.close();}
