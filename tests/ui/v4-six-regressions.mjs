import { createRequire } from 'node:module';
import process from 'node:process';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const { chromium }=require('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1320,height:850}});
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
try{
 await page.goto('http://127.0.0.1:5174/v4-six-fixes-audit.html',{waitUntil:'networkidle'});
 const entry=page.locator('[data-v4-badge="qa-account:pending:o1:entry"]');
 const pendingTp=page.locator('[data-v4-badge="qa-account:pending:o1:tp"]');
 await entry.waitFor();
 assert.equal(await page.locator('[data-v4-badge="qa-account:position:p1:entry"]').count(),0,
  'do not render a second prototype market-position entry badge');
 assert.equal(await page.locator('[data-v4-chart-badge]').count(),1,
  'original approved market-position entry badge must be present');
 assert.equal(await page.locator('button[aria-label="Add TP to BUY position"]').count(),1,
  'original inline market TP action must remain available');
 await pendingTp.getByRole('button',{name:'Edit TP'}).click();
 // 1. Exactly one accepted entry badge while TP edit exists.
 assert.equal(await entry.count(),1,'pending accepted entry must never duplicate');
 assert.equal(await page.locator('[data-v4-preview]').count(),1,'one preview only');
 const draftBadge=page.locator('[data-v4-draft-badge]');
 const inlineActions=draftBadge.locator('[data-v4-chart-actions]');
 assert.equal(await inlineActions.count(),1,'Confirm and Discard belong to the active draft badge');
 const badgeBounds=await draftBadge.boundingBox(), actionBounds=await inlineActions.boundingBox();
 assert.ok(actionBounds.x>=badgeBounds.x &&
   actionBounds.x+actionBounds.width<=badgeBounds.x+badgeBounds.width+2,
  'draft actions must be inside their active level, not floating at the position entry');
 assert.equal(await page.locator('[data-v4-draft-connector]').count(),1,'draft TP connector');
 // 2. Pending order accepted solid badge & line remain while editing.
 assert.equal(await page.locator('[data-v4-accepted-line="qa-account:pending:o1:entry"]').count(),1);
 assert.equal(await page.locator('[data-v4-badge="qa-account:pending:o1:tp"]').count(),1);
 // 3. No amendment on Discard, including shade cleanup.
 await page.getByRole('button',{name:'Discard chart edit'}).click();
 assert.equal(await page.locator('[data-v4-preview]').count(),0);
 assert.equal(await page.locator('[data-v4-draft-shade]').count(),0);
 assert.equal(await page.locator('[data-v4-draft-connector]').count(),0);
 assert.equal(await page.evaluate(()=>window.v4QA.commands.length),0);
 // A new limit order is a trade-plan draft. Its Buy/Sell execution is the
 // confirmation; no standalone chart Confirm/Discard is offered.
 await page.getByRole('button',{name:'Start new limit plan'}).click();
 assert.equal(await page.locator('[data-v4-chart-actions]').count(),0,
   'new limit planning may not display chart amendment buttons');
 assert.equal(await page.locator('[data-v4-preview]').count(),0);
 assert.equal(await page.evaluate(()=>window.v4QA.commands.length),0);
 await page.getByRole('button',{name:'Finish planning'}).click();
 // 4. Drag pending entry: original solid level does not move; release doesn't commit.
 const before=await page.locator('[data-v4-accepted-line="qa-account:pending:o1:entry"]').getAttribute('style');
 const rect=await entry.boundingBox();
 await page.mouse.move(rect.x+25,rect.y+13);
 await page.mouse.down();
 await page.mouse.move(rect.x+25,rect.y+75,{steps:8});
 await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.v4QA.commands.length),0,'pointerup must never modify');
 assert.equal(await page.locator('[data-v4-accepted-line="qa-account:pending:o1:entry"]').getAttribute('style'),before,'accepted line fixed');
 assert.equal(await page.locator('[data-v4-preview]').count(),1);
 await page.getByRole('button',{name:'Discard chart edit'}).click();
 // 5. TP to SL switching: only one draft shade exists and its type changes.
 await page.locator('button[aria-label="Add TP to BUY position"]').click();
 assert.equal(await page.locator('[data-v4-draft-shade="tp"]').count(),1);
 assert.equal(await page.locator('[data-v4-draft-connector]').count(),1);
 await page.locator('button[aria-label="Add SL to BUY position"]').click();
 assert.equal(await page.locator('[data-v4-draft-shade="tp"]').count(),0,'stale green TP shade');
 assert.equal(await page.locator('[data-v4-draft-shade="sl"]').count(),1,'one red SL shade');
 assert.equal(await page.locator('[data-v4-preview]').count(),1);
 // 6. Chart-side Confirm updates only after backend stand-in resolution.
 assert.equal(await page.evaluate(()=>window.v4QA.commands.length),0);
 await page.getByRole('button',{name:'Confirm chart edit'}).click();
 await page.waitForFunction(()=>window.v4QA.commands.length===1);
 await page.locator('[data-v4-badge="qa-account:position:p1:sl"]').waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('[data-v4-preview]').length===0);
 assert.equal(await page.evaluate(()=>window.v4QA.positions[0].sl),83400);
 assert.deepEqual(errors,[],'no uncaught browser errors');
 console.log('SIX_V4_REGRESSIONS_PASS',JSON.stringify({checks:9,commands:await page.evaluate(()=>window.v4QA.commands)}));
}catch(error){
 console.error('SIX_V4_REGRESSIONS_FAIL',error);
 process.exitCode=1;
}finally{await browser.close();}
