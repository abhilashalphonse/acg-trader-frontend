import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import process from 'node:process';
const { chromium }=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1320,height:850}});
const errors=[];
let checks=0;
page.on('pageerror',e=>errors.push(e.message));
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const wait=()=>page.waitForTimeout(100);
const badge=id=>page.locator('[data-v4-badge="qa-account:'+id+'"]');
const accepted=id=>page.locator('[data-v4-accepted-line="qa-account:'+id+'"]');
const drag=async (selector,dy)=>{
  const grip=page.locator(selector);
  await grip.scrollIntoViewIfNeeded();
  const rect=await grip.boundingBox();
  ok(Boolean(rect),'drag control must have a bounding box');
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x,y+dy,{steps:8});
  return {x,y};
};
const end=async()=>{await page.mouse.up();await wait();};
try{
 await page.goto('http://127.0.0.1:5174/v4-six-fixes-audit.html',{waitUntil:'networkidle'});
 const entry=badge('pending:o1:entry');
 const tp=badge('pending:o1:tp');
 await entry.waitFor();
 eq(await badge('position:p1:entry').count(),0,'no second synthetic market position entry');
 eq(await page.locator('[data-v4-chart-badge]').count(),1,'original approved market badge present');
 eq(await page.locator('[data-v4-chart-badge] [data-v4-position-direction]').innerText(),'BUY');
 eq(await entry.locator('[data-v4-pending-type]').innerText(),'LIMIT');

 // Click selects an existing pending order; a click never arms an edit.
 await tp.locator('[data-v4-drag-handle]').click();
 await page.waitForFunction(()=>window.v4QA.selectedPendingId==='o1');
 eq(await page.locator('[data-v4-preview]').count(),0,'click does not create draft');
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'click does not create confirm buttons');
 eq(await page.locator('[data-v4-manage-pending="o1"]').count(),1,'correct Limit order is selected');
 eq(await page.locator('[data-v4-manage-position]').count(),0,'pending selection must not open position manager');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-exit-card').count(),2);
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-capsule').count(),1);

 // Press/release without crossing the drag threshold must preserve the order.
 const grip=tp.locator('[data-v4-drag-handle]');
 const rect=await grip.boundingBox();
 await page.mouse.move(rect.x+3,rect.y+12);
 await page.mouse.down();
 await page.mouse.move(rect.x+3,rect.y+14);
 await end();
 eq(await page.locator('[data-v4-preview]').count(),0,'2px motion is not an edit');
 eq(await page.evaluate(()=>window.v4QA.commands.length),0,'no command from click');

 // Pending TP: original full chip follows the pointer; solid accepted line stays.
 const tpOldY=await accepted('pending:o1:tp').evaluate(n=>n.style.top);
 const badgeOldY=(await tp.boundingBox()).y;
 await drag('[data-v4-drag-handle="qa-account:pending:o1:tp"]',-45);
 ok((await tp.boundingBox()).y!==badgeOldY,'accepted chip visually follows the drag');
 eq(await accepted('pending:o1:tp').evaluate(n=>n.style.top),tpOldY,'solid accepted price remains fixed');
 eq(await page.locator('[data-v4-draft-badge]').count(),0,'no second full draft chip');
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'no Confirm during drag');
 await end();
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),1,'Confirm after meaningful release');
 eq(await tp.count(),1,'original TP chip remains the only full chip');
 eq(await page.locator('[data-v4-preview]').count(),1,'one dotted preview line');
 eq(await page.evaluate(()=>window.v4QA.commands.length),0,'release does not submit');
 await page.getByRole('button',{name:'Discard chart edit'}).click();
 eq(await page.locator('[data-v4-preview]').count(),0,'Discard clears draft');
 eq(await page.evaluate(()=>window.v4QA.orders[0].tp),82100,'Discard preserves accepted TP');

 // Moving entry likewise edits only after release; Discard preserves entry.
 await drag('[data-v4-pending-grip="qa-account:pending:o1:entry"]',52);
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'entry actions hidden while dragging');
 await end();
 eq(await entry.count(),1,'entry chip not duplicated');
 eq(await page.locator('[data-v4-preview]').count(),1);
 await page.getByRole('button',{name:'Discard chart edit'}).click();
 eq(await page.evaluate(()=>window.v4QA.orders[0].entry),84400);

 // New order planning must never add extraneous chart confirmation controls.
 await page.getByRole('button',{name:'Start new limit plan'}).click();
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0);
 eq(await page.locator('[data-v4-preview]').count(),0);
 await page.getByRole('button',{name:'Finish planning'}).click();

 // Clicking a different pending order selects that order (not an open position).
 await badge('pending:o2:entry').locator('[data-v4-pending-grip]').click();
 await page.waitForFunction(()=>window.v4QA.selectedPendingId==='o2');
 eq(await page.locator('[data-v4-manage-pending="o2"]').count(),1);
 eq(await page.locator('[data-v4-manage-pending="o1"]').count(),0);
 eq(await page.locator('[data-v4-manage-position]').count(),0);
 eq(await page.locator('[data-v4-manage-pending="o2"] input[aria-label="Stop trigger price"]').count(),1);
 eq(await page.locator('[data-v4-manage-pending="o2"] input[aria-label="Limit boundary price"]').count(),1);

 // Drag Stop-Limit trigger. The accepted trigger and limit remain solid while
 // two dotted proposed levels move in lockstep; no command until Confirm.
 const stopBefore=await accepted('pending:o2:entry').evaluate(n=>n.style.top);
 const limitBefore=await accepted('pending:o2:limitPrice').evaluate(n=>n.style.top);
 await drag('[data-v4-pending-grip="qa-account:pending:o2:entry"]',-41);
 eq(await page.locator('[data-v4-secondary-preview]').count(),1,'linked limit preview while moving stop trigger');
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'actions hidden until release');
 await end();
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),1);
 eq(await accepted('pending:o2:entry').evaluate(n=>n.style.top),stopBefore);
 eq(await accepted('pending:o2:limitPrice').evaluate(n=>n.style.top),limitBefore);
 eq(await page.evaluate(()=>window.v4QA.orders[1].entry),81600);
 eq(await page.evaluate(()=>window.v4QA.orders[1].limitPrice),81400);
 await page.getByRole('button',{name:'Confirm chart edit'}).click();
 await page.waitForFunction(()=>window.v4QA.orders[1].entry!==81600);
 await page.waitForFunction(()=>document.querySelectorAll('[data-v4-preview]').length===0);
 const changed=await page.evaluate(()=>window.v4QA.orders[1]);
 ok(Math.abs((changed.entry-81600)-(changed.limitPrice-81400))<.01,'Stop-Limit trigger delta keeps limit spacing');
 eq(await page.locator('[data-v4-secondary-preview]').count(),0,'linked preview cleared on ACK');

 // Stop-Limit limit boundary is independently amendable.
 const beforeLimit=await page.evaluate(()=>window.v4QA.orders[1].limitPrice);
 await drag('[data-v4-drag-handle="qa-account:pending:o2:limitPrice"]',32);
 eq(await page.locator('[data-v4-secondary-preview]').count(),0,'limit-only drag has no coupled trigger');
 await end();
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),1);
 await page.getByRole('button',{name:'Confirm chart edit'}).click();
 await page.waitForFunction(price=>window.v4QA.orders[1].limitPrice!==price,beforeLimit);
 eq(await page.evaluate(()=>window.v4QA.orders[1].entry),changed.entry,'limit-only edit leaves trigger unchanged');

 // Pending-order panel can add/modify protections without Buy/Sell controls.
 const pending=page.locator('[data-v4-manage-pending="o2"]');
 await pending.locator('button:has-text("New Order")').count();
 eq(await pending.getByRole('button',{name:/^(BUY|SELL) /}).count(),0);
 ok((await pending.innerText()).includes('Estimated margin on fill'));
 await pending.getByRole('button',{name:'Cancel Order'}).click();
 eq(await pending.getByRole('dialog',{name:'Confirm order cancellation'}).count(),1);
 await pending.getByRole('button',{name:'Keep Order'}).click();
 eq(await page.evaluate(()=>window.v4QA.orders.length),2,'cancel confirmation can be dismissed');

 // Open-position selection must override the pending manager.
 await page.getByRole('button',{name:'Select open position'}).click();
 const manage=page.locator('[data-v4-manage-position="p1"]');
 await manage.waitFor();
 eq(await page.locator('[data-v4-manage-pending]').count(),0);
 eq(await page.evaluate(()=>window.v4QA.selectedPositionId),'p1');
 ok((await manage.innerText()).includes('EXITS / PROTECTION'));
 ok((await manage.innerText()).includes('Estimated margin'));
 eq(await manage.locator('.v4-exit-card').count(),2);
 eq(await manage.locator('.v4-manage-new-order').count(),0,'no redundant bottom New Order');
 eq(await manage.locator('.v4-manage-close').count(),1,'idle footer is Close Position');
 eq(await manage.getByRole('button',{name:'Confirm position protection'}).count(),0,'no Confirm without a draft');

 // Actions use existing position callbacks and close confirmation.
 await manage.getByRole('button',{name:/POSITION ACTIONS/}).click();
 eq(await manage.locator('[data-v4-manage-advanced]').count(),1);
 eq(await manage.getByRole('button',{name:'Break-even'}).count(),1);
 eq(await manage.getByRole('button',{name:'Trailing SL'}).count(),1);
 eq(await manage.getByRole('button',{name:'Partial close'}).count(),1);
 await manage.getByRole('button',{name:'Trailing SL'}).click();
 await manage.locator('[data-v4-trailing-options]').getByRole('button',{name:'10 pips'}).click();
 await page.waitForFunction(()=>window.v4QA.actionCommands.some(x=>x.kind==='trail'&&x.pips===10));
 await manage.getByRole('button',{name:'Partial close'}).click();
 eq(await manage.getByRole('dialog',{name:'Confirm position close'}).count(),1);
 await manage.getByRole('button',{name:'Keep Position'}).click();
 eq(await page.evaluate(()=>window.v4QA.actionCommands.filter(x=>x.kind==='close').length),0);
 await manage.locator('.v4-manage-close').click();
 eq(await manage.getByRole('dialog',{name:'Confirm position close'}).count(),1);
 await manage.getByRole('button',{name:'Confirm Close'}).click();
 await page.waitForFunction(()=>window.v4QA.actionCommands.some(x=>x.kind==='close'&&x.percent===100));

 // Existing add-TP still creates a deliberate draft with Confirm/Discard;
 // panel and chart use the same object and submit only on Confirm.
 await page.locator('button[aria-label="Add TP to BUY position"]').click();
 await page.waitForFunction(()=>Boolean(window.v4QA.parentDraft));
 eq(await manage.getByRole('button',{name:'Confirm position protection'}).count(),1);
 eq(await page.locator('[data-v4-draft-badge]').count(),1);
 await manage.getByRole('button',{name:'Discard position protection'}).click();
 await page.waitForFunction(()=>window.v4QA.parentDraft==null);
 eq(await page.locator('[data-v4-preview]').count(),0);

 // Selecting another open position switches its exact manager, never stays
 // stuck on the first position. Shared currency avatar remains correct.
 await page.getByRole('button',{name:'Select EUR/USD position'}).click();
 const eur=page.locator('[data-v4-manage-position="p2"]');
 await eur.waitFor();
 eq(await manage.count(),0);
 eq(await eur.locator('.v4-symbol strong').innerText(),'EUR/USD');
 eq(await eur.locator('[data-v4-manage-instrument-avatar] > span > span').count(),2);
 eq(await eur.locator('.v4-manage-close').count(),1);
 await eur.getByRole('button',{name:'Back to new order'}).click();
 eq(await page.locator('[data-v4-manage-position]').count(),0);
 eq(await page.locator('[data-v4-manage-pending]').count(),0);
 eq(await page.locator('[data-v4-preview]').count(),0);
 eq(await page.locator('[data-v4-draft-shade]').count(),0);
 eq(await page.locator('[data-v4-accepted-shade]').count(),0);
 assert.deepEqual(errors,[],'no uncaught page errors');checks++;
 console.log('SIX_V4_REGRESSIONS_PASS',JSON.stringify({checks,commands:await page.evaluate(()=>window.v4QA.commands)}));
}catch(error){
 console.error('SIX_V4_REGRESSIONS_FAIL',error);
 process.exitCode=1;
}finally{await browser.close();}
