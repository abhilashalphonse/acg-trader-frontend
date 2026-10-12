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
 const originalPositionBadge=page.locator('[data-v4-chart-badge]');
 assert.equal(await originalPositionBadge.locator('[data-v4-position-direction]').innerText(),'BUY');
 assert.equal(await originalPositionBadge.locator('[data-v4-position-size]').innerText(),'0.01');
 assert.match(await originalPositionBadge.locator('[data-v4-position-pnl]').innerText(),/3[.]50 USD/);
 assert.equal(await originalPositionBadge.evaluate(el=>Math.round(el.getBoundingClientRect().height)),28);
 const positionRightBefore=(await originalPositionBadge.boundingBox());
 const positionRightEdgeBefore=positionRightBefore.x+positionRightBefore.width;
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
 const entryActions=page.locator('[data-v4-position-action-anchor] [data-v4-chart-actions]');
 assert.equal(await entryActions.count(),1,'market Confirm / Discard must be beside approved position badge');
 assert.equal(await entryActions.getAttribute('data-v4-actions-location'),'position-entry');
 assert.equal(await page.locator('[data-v4-draft-badge] [data-v4-chart-actions]').count(),0,
   'TP draft badge must not contain Confirm / Discard');
 const positionAnchor=page.locator('[data-v4-position-action-anchor]');
 const positionBadge=positionAnchor.locator('[data-v4-chart-badge]');
 const buttons=await entryActions.boundingBox(), positionBox=await positionBadge.boundingBox();
 assert.ok(buttons.x+buttons.width<=positionBox.x+1,'buttons must be OUTSIDE and LEFT of the position badge');
 assert.ok(Math.abs(positionBox.x+positionBox.width-positionRightEdgeBefore)<2,
   'Confirm/Discard must NOT shift or resize the main position badge');
 assert.ok(Math.abs((buttons.y+buttons.height/2)-(positionBox.y+positionBox.height/2))<2,
   'actions must remain on the position ENTRY line, not on the TP draft line');
 const previewBox=await page.locator('[data-v4-draft-badge]').boundingBox();
 assert.ok(Math.abs(previewBox.y-positionBox.y)>20,'TP draft must have its own independent price level');
 assert.match(await page.locator('[data-v4-draft-badge]').innerText(),/Take profit/);
 assert.match(await page.locator('[data-v4-draft-badge]').innerText(),/84,400/);
 assert.match(await page.locator('[data-v4-draft-badge]').innerText(),/0[.]60%/);
 assert.ok(await page.locator('[data-v4-protection-draft-price]').count()===1);
 assert.match(await page.locator('[data-v4-draft-badge]').innerText(),/[+]5[.]00 USD/,'TP draft should use projected P&L, not an unrelated price label');
 assert.equal(await page.locator('[data-v4-draft-badge]').evaluate(node=>Math.round(node.getBoundingClientRect().height)),28);
 assert.equal(await page.locator('[data-v4-draft-badge]').evaluate(node=>getComputedStyle(node).backgroundColor),
   'rgb(16, 26, 24)', 'draft TP badge must use approved dark-green metallic surface');
 assert.equal(await page.locator('[data-v4-draft-shade="tp"]').count(),1);
 assert.equal(await page.locator('[data-v4-draft-connector]').count(),1);
 // Newly created TP has a functioning drag grip. Its draft moves, but release
 // must never hit the command handler or move any server-accepted level.
 const draftGrip=page.locator('[data-v4-drag-handle="draft"]');
 const draftBefore=await page.locator('[data-v4-protection-draft-price]').innerText();
 const draftBeforeBounds=await draftGrip.boundingBox();
 await page.mouse.move(draftBeforeBounds.x+draftBeforeBounds.width/2,draftBeforeBounds.y+draftBeforeBounds.height/2);
 await page.mouse.down();
 await page.mouse.move(draftBeforeBounds.x+draftBeforeBounds.width/2,
   draftBeforeBounds.y+draftBeforeBounds.height/2-30,{steps:10});
 await page.mouse.up();
 const draftAfter=await page.locator('[data-v4-protection-draft-price]').innerText();
 assert.notEqual(draftAfter,draftBefore,'new TP draft must actually move with pointer');
 assert.equal(await page.evaluate(()=>window.v4QA.commands.length),0,'new TP mouse release must not execute');
 assert.equal(await entryActions.count(),1,'position entry Confirm / Discard persists while dragging TP');
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
 const acceptedSlBadge=page.locator('[data-v4-badge="qa-account:position:p1:sl"]');
 assert.equal(await acceptedSlBadge.evaluate(node=>Math.round(node.getBoundingClientRect().height)),28);
 assert.equal(await acceptedSlBadge.evaluate(node=>getComputedStyle(node).backgroundColor),
   'rgb(27, 17, 21)', 'accepted SL must use approved restrained red surface');
 assert.equal(await page.locator('[data-v4-accepted-shade="sl"]').count(),1,
   'server-accepted SL shading must derive only from accepted position');
 // Existing accepted SL has the same drag affordance, with the accepted
 // server price and solid line unchanged until explicit confirmation.
 const acceptedSlLine=page.locator('[data-v4-accepted-line="qa-account:position:p1:sl"]');
 const slAcceptedStyle=await acceptedSlLine.getAttribute('style');
 const slGrip=page.locator('[data-v4-drag-handle="qa-account:position:p1:sl"]');
 const slBounds=await slGrip.boundingBox();
 await page.mouse.move(slBounds.x+slBounds.width/2,slBounds.y+slBounds.height/2);
 await page.mouse.down();
 await page.mouse.move(slBounds.x+slBounds.width/2,slBounds.y+slBounds.height/2+26,{steps:8});
 await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.v4QA.commands.length),1,
  'accepted SL drag release must not execute another command');
 assert.equal(await acceptedSlLine.getAttribute('style'),slAcceptedStyle,
  'accepted SL remains fixed while dotted preview is dragged');
 assert.equal(await page.locator('[data-v4-preview]').count(),1);
 assert.equal(await page.locator('[data-v4-position-action-anchor] [data-v4-chart-actions]').count(),1);
 await page.getByRole('button',{name:'Discard chart edit'}).click();
 assert.equal(await page.locator('[data-v4-preview]').count(),0);
 assert.equal(await page.evaluate(()=>window.v4QA.positions[0].sl),83400,
  'discarding accepted SL drag leaves server price unchanged');

 // Add TP again, confirm it through simulated backend, then drag accepted TP.
 await page.locator('button[aria-label="Add TP to BUY position"]').click();
 await page.getByRole('button',{name:'Confirm chart edit'}).click();
 await page.waitForFunction(()=>window.v4QA.commands.length===2);
 await page.locator('[data-v4-badge="qa-account:position:p1:tp"]').waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('[data-v4-preview]').length===0);
 assert.equal(await page.locator('[data-v4-accepted-shade="tp"]').count(),1);
 assert.equal(await page.locator('[data-v4-accepted-shade="sl"]').count(),1);
 const tpGrip=page.locator('[data-v4-drag-handle="qa-account:position:p1:tp"]');
 const tpBounds=await tpGrip.boundingBox();
 const acceptedTpLine=page.locator('[data-v4-accepted-line="qa-account:position:p1:tp"]');
 const tpTop=await acceptedTpLine.evaluate(node=>node.style.top);
 await page.mouse.move(tpBounds.x+tpBounds.width/2,tpBounds.y+tpBounds.height/2);
 await page.mouse.down();
 await page.mouse.move(tpBounds.x+tpBounds.width/2,tpBounds.y+tpBounds.height/2-26,{steps:8});
 await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.v4QA.commands.length),2,
  'accepted TP drag release must not execute another command');
 assert.equal(await acceptedTpLine.evaluate(node=>node.style.top),tpTop,
  'accepted TP price coordinate remains fixed while dragging dotted preview');
 assert.equal(await page.locator('[data-v4-preview]').count(),1);
 await page.getByRole('button',{name:'Discard chart edit'}).click();
 assert.equal(await page.locator('[data-v4-preview]').count(),0);
 assert.deepEqual(errors,[],'no uncaught browser errors');
 console.log('SIX_V4_REGRESSIONS_PASS',JSON.stringify({checks:22,commands:await page.evaluate(()=>window.v4QA.commands)}));
}catch(error){
 console.error('SIX_V4_REGRESSIONS_FAIL',error);
 process.exitCode=1;
}finally{await browser.close();}
