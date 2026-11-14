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
 const errors=[],httpErrors=[];
 page.on('pageerror',error=>errors.push(error.stack||error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push('CONSOLE: '+message.text());});
 page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForTimeout(1700);
 const pageState=await page.evaluate(()=>({
   title:document.title,
   rootChildren:document.querySelector('#v4-dock-preview-root')?.children.length||0,
   bodyText:document.body?.innerText?.slice(0,300)||'',
   rootHTML:document.querySelector('#v4-dock-preview-root')?.innerHTML?.slice(0,300)||'',
 }));
 console.log('DOCK_PREVIEW_BOOT',JSON.stringify({target,status:response?.status(),...pageState,errors,httpErrors}));
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
 await dock.getByRole('button',{name:'Risk',exact:true}).click();
 assert.equal(await dock.getAttribute('data-v4-position-view'),'risk','Risk mode works');checks++;
 await page.getByRole('button',{name:'Laptop · 1024'}).click();
 assert.equal(await dock.locator('.v4-positions-header').evaluate(el=>el.getBoundingClientRect().height),44,'Laptop still single-row');checks++;
 await dock.getByRole('button',{name:/Pending/}).click();
 assert.equal(await page.locator('[data-v4-pending="true"]').count(),1,'Pending switches');checks++;
 await page.locator('[data-v4-pending="true"]').getByRole('button',{name:'History',exact:true}).click();
 assert.equal(await page.locator('[data-v4-activity="history"]').count(),1,'History switches');checks++;
 await page.locator('[data-v4-activity="history"]').getByRole('combobox',{name:'History date range'}).selectOption('7D');
 assert.equal(await page.locator('[data-v4-activity="history"]').getAttribute('data-v4-activity-range'),'7D','Range updates');checks++;
 console.log('V4_DOCK_PUBLIC_PREVIEW_PASS',JSON.stringify({checks,before}));
 await page.close();
}finally{await browser.close();}
