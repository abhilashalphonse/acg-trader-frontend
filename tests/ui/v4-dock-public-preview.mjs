import process from 'node:process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Public, isolated review page. This is a JS-runtime smoke, not just a build
// check: blank roots fail with the browser's first page error in the CI log.
const target=process.env.V4_DOCK_PREVIEW_URL||'http://127.0.0.1:5174/v4-dock-preview.html';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
let checks=0;
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],consoleErrors=[],httpErrors=[];
 page.on('pageerror',error=>errors.push(error.stack||error.message));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForTimeout(1700);
 const pageState=await page.evaluate(()=>({
   title:document.title,
   rootChildren:document.querySelector('#v4-dock-preview-root')?.children.length||0,
   bodyText:document.body?.innerText?.slice(0,300)||'',
   rootHTML:document.querySelector('#v4-dock-preview-root')?.innerHTML?.slice(0,300)||'',
 }));
 console.log('DOCK_PREVIEW_BOOT',JSON.stringify({target,status:response?.status(),...pageState,errors,consoleErrors,httpErrors}));
 assert.equal(response?.status(),200,'HTML must exist in deployed preview');
 assert.ok(pageState.rootChildren>0,'Blank page: React never mounted the public review');
 assert.equal(errors.length,0,'Unexpected browser runtime errors');
 assert.equal(await page.locator('.dock-review-page').count(),1,'Public review shell rendered');checks++;
 const dock=page.locator('[data-v4-positions="true"]');
 assert.equal(await dock.count(),1,'Real V4 Positions dock rendered');checks++;
 assert.equal(await dock.locator('tr[data-v4-position-id]').count(),2,'Two sample trades rendered');checks++;
 const before=await dock.evaluate(el=>{
   const header=el.querySelector('.v4-positions-header').getBoundingClientRect();
   const list=el.querySelector('.v4-positions-scroller').getBoundingClientRect();
   return {header:header.height,visible:[...el.querySelectorAll('tr[data-v4-position-id]')].filter(row=>{
     const bounds=row.getBoundingClientRect();
     return bounds.top>=list.top-1&&bounds.bottom<=list.bottom+1;
   }).length};
 });
 assert.equal(before.header,44,'One toolbar row');checks++;
 assert.equal(before.visible,2,'Two complete rows visible at minimum height');checks++;
 assert.equal(await dock.getByRole('searchbox').count(),0,'Removed search does not return');checks++;
 const overviewButton=dock.getByRole('button',{name:'Account overview and margin details'});
 await overviewButton.click();
 const overview=page.getByRole('dialog',{name:'Account overview'});
 assert.equal(await overview.count(),1,'Account overview accessible from compact dock');checks++;
 const overviewText=await overview.innerText();
 for(const item of ['Equity','Used margin','Free margin','Unrealized P&L','Gross (USD)','Net directional (USD)']){
   assert.ok(overviewText.includes(item),'Missing account/exposure item: '+item);checks++;
 }
 await page.keyboard.press('Escape');
 assert.equal(await overview.count(),0,'Overview dismisses with Escape');checks++;

 await dock.getByRole('button',{name:'Risk',exact:true}).click();
 assert.equal(await dock.getAttribute('data-v4-position-view'),'risk','Risk mode works');checks++;
 await page.getByRole('button',{name:'Laptop · 1024'}).click();
 assert.equal(await dock.locator('.v4-positions-header').evaluate(el=>el.getBoundingClientRect().height),44,'Laptop still single-row');checks++;
 assert.equal(Math.round(await page.locator('.dock-review-screen').evaluate(el=>el.getBoundingClientRect().width)),1024,
  'Laptop preset uses real 1024px layout width');checks++;
 const compactRows=await dock.evaluate(el=>{
   const scroller=el.querySelector('.v4-positions-scroller').getBoundingClientRect();
   return [...el.querySelectorAll('tr[data-v4-position-id]')].filter(row=>{
     const bounds=row.getBoundingClientRect();
     return bounds.top>=scroller.top-1&&bounds.bottom<=scroller.bottom+1;
   }).length;
 });
 assert.equal(compactRows,2,'Two full risk rows fit with horizontal scrollbar at 1024px');checks++;
 await page.getByRole('button',{name:'Wide · 1920'}).click();
 assert.equal(Math.round(await page.locator('.dock-review-screen').evaluate(el=>el.getBoundingClientRect().width)),1920,
  'Wide preset is genuine 1920px, not scaled to the browser');checks++;
 await page.getByRole('button',{name:'Desktop · 1440'}).click();

 await dock.getByRole('button',{name:/Pending/}).click();
 assert.equal(await page.locator('[data-v4-pending="true"]').count(),1,'Pending switches');checks++;
 await page.locator('[data-v4-pending="true"]').getByRole('button',{name:'History',exact:true}).click();
 assert.equal(await page.locator('[data-v4-activity="history"]').count(),1,'History switches');checks++;
 await page.locator('[data-v4-activity="history"]').getByRole('combobox',{name:'History date range'}).selectOption('7D');
 assert.equal(await page.locator('[data-v4-activity="history"]').getAttribute('data-v4-activity-range'),'7D','Range updates');checks++;
 if(target.startsWith('https://')){
   // The original PR channel root URL must lead directly to review, not auth.
   const homepage=await browser.newPage();
   await homepage.goto(new URL('/',target).toString(),{waitUntil:'domcontentloaded',timeout:25000});
   await homepage.waitForURL('**/v4-dock-preview.html',{timeout:15000});
   assert.equal(await homepage.locator('.dock-review-page').count(),1,'PR homepage redirects to public design review');
   await homepage.close();
   checks++;
 }
 console.log('V4_DOCK_PUBLIC_PREVIEW_PASS',JSON.stringify({checks,before}));
 await page.close();
}finally{await browser.close();}
