import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import process from 'node:process';
import { readFileSync } from 'node:fs';
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
 // DesktopMultiChart is the production wrapper between DesktopTerminal and
 // ChartArea. Assert the full prop chain; the isolated fixture alone missed
 // the originally reported full-terminal Sell Limit selection failure.
 const multi=readFileSync('src/components/trading-v2/desktop/DesktopMultiChart.jsx','utf8');
 const terminal=readFileSync('src/components/trading-v2/DesktopTerminal.jsx','utf8');
 const chartArea=readFileSync('src/components/trading-v2/ChartArea.jsx','utf8');
 ok(multi.includes('onSelectPending={onSelectPending}'),'DesktopMultiChart must forward pending selection to ChartArea');
 ok(multi.includes('onPendingOrderDraftChange={isActive ? onPendingOrderDraftChange'),'DesktopMultiChart must forward pending draft change');
 ok(multi.includes('pendingOrderDraft={isActive ? pendingOrderDraft : null}'),'DesktopMultiChart must forward pending draft state');
 ok(terminal.includes('onSelectPending={selectPending}'),'DesktopTerminal must connect exact pending selection');
 ok(terminal.includes("'ACCEPTED','TRIGGERED'"),'selection must recognize backend-active order statuses');
 ok(chartArea.includes('onSelectPosition={onSelectPosition} onSelectPending={onSelectPending}'),'ChartArea must forward selection to V4FullTerminalOrders');
 const entry=badge('pending:o1:entry');
 const tp=badge('pending:o1:tp');
 await entry.waitFor();
 eq(await badge('position:p1:entry').count(),0,'no second synthetic market position entry');
 eq(await page.locator('[data-v4-chart-badge]').count(),1,'original approved market badge present');
 eq(await page.locator('[data-v4-chart-badge] [data-v4-position-direction]').innerText(),'BUY');
 eq(await entry.locator('[data-v4-pending-type]').innerText(),'LIMIT');
 eq(await page.evaluate(()=>window.v4QA.orders[0].status),'ACCEPTED');
 eq(await page.evaluate(()=>window.v4QA.orders[1].status),'TRIGGERED');

 // Click selects an existing pending order; a click never arms an edit.
 await tp.locator('[data-v4-drag-handle]').click();
 await page.waitForFunction(()=>window.v4QA.selectedPendingId==='o1');
 eq(await page.locator('[data-v4-preview]').count(),0,'click does not create draft');
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'click does not create confirm buttons');
 eq(await page.locator('[data-v4-manage-pending="o1"]').count(),1,'correct Limit order is selected');
 eq(await page.locator('[data-v4-manage-position]').count(),0,'pending selection must not open position manager');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-exit-card').count(),2);
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-capsule').count(),0,
   'Pending manager does not repeat a New Order switch when Back and Close exist');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-session').count(),0,
   'Pending manager does not repeat the status row');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-quote-strip').count(),0,
   'Pending manager uses order details instead of repeating entry and status in a quote strip');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-symbol .v4-manage-header-context').count(),1);

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
 eq(await page.locator('[data-v4-manage-pending="o2"] .v4-manage-pending-metrics > div').count(),2);

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
 eq(await pending.getByRole('button',{name:'New Order',exact:true}).count(),0,
  'Pending context relies on Back/Close rather than redundant mode switch');
 eq(await pending.getByRole('button',{name:/^(BUY|SELL) /}).count(),0);
 ok((await pending.innerText()).includes('Estimated margin on fill'));
 eq(await pending.getByText('Order size',{exact:true}).count(),1,'pending size appears once');
 eq(await pending.getByText('Estimated margin on fill',{exact:true}).count(),1,'pending margin appears once');
 eq(await pending.getByText('Order status',{exact:true}).count(),0,'no duplicate status slab');
 eq(await pending.getByText('ORDER ACTIONS',{exact:true}).count(),0,'no duplicate metadata disclosure');
 eq(await pending.getByText('Order type',{exact:true}).count(),0,'order type is in header only');
 eq(await pending.locator('.v4-ratio-slab').count(),0,'no redundant slab');
 eq(await pending.locator('.v4-margin-summary').count(),0,'pending footer only shows actions');
 await pending.getByRole('button',{name:'Cancel Order'}).click();
 eq(await pending.getByRole('dialog',{name:'Confirm order cancellation'}).count(),1);
 eq(await pending.locator('.v4-manage-close-dialog').count(),0,'no oversized pending confirmation');
 await pending.getByRole('button',{name:'Keep Order'}).click();
 eq(await page.evaluate(()=>window.v4QA.orders.length),2,'cancel confirmation can be dismissed');

 // The pending-order manager owns its selected order's amendment draft.
 // Editing the Stop-Limit execution boundary via the manager cannot alter
 // another order, submit a new Buy/Sell, or move the accepted trigger.
 const beforePanelBoundary=await page.evaluate(()=>window.v4QA.orders[1].limitPrice);
 const beforePanelTrigger=await page.evaluate(()=>window.v4QA.orders[1].entry);
 await pending.getByRole('spinbutton',{name:'Limit boundary price'}).fill(String(beforePanelBoundary+25));
 await page.waitForFunction(()=>window.v4QA.pendingDraft?.kind==='limitPrice');
 eq(await page.evaluate(()=>window.v4QA.orders[1].limitPrice),beforePanelBoundary,
   'pending sidebar input may only create a preview before Confirm');
 eq(await page.locator('[data-v4-preview]').count(),1,'pending panel uses chart dotted preview');
 eq(await pending.locator('.v4-manage-confirm').count(),1);
 await pending.locator('.v4-manage-discard').click();
 await page.waitForFunction(()=>window.v4QA.pendingDraft==null);
 eq(await page.locator('[data-v4-preview]').count(),0,'pending panel Discard clears chart draft');
 eq(await page.evaluate(()=>window.v4QA.orders[1].limitPrice),beforePanelBoundary);
 await pending.getByRole('spinbutton',{name:'Limit boundary price'}).fill(String(beforePanelBoundary+25));
 await pending.locator('.v4-manage-confirm').click();
 await page.waitForFunction(price=>window.v4QA.orders[1].limitPrice===price,beforePanelBoundary+25);
 await page.waitForFunction(()=>window.v4QA.pendingDraft==null);
 eq(await page.evaluate(()=>window.v4QA.orders[1].entry),beforePanelTrigger,
   'pending panel limit-boundary amendment leaves Stop-Limit trigger unchanged');

 // Open-position selection must override the pending manager.
 await page.getByRole('button',{name:'Select open position'}).click();
 const manage=page.locator('[data-v4-manage-position="p1"]');
 await manage.waitFor();
 eq(await page.locator('[data-v4-manage-pending]').count(),0);
 eq(await page.evaluate(()=>window.v4QA.selectedPositionId),'p1');
 ok((await manage.innerText()).includes('EXITS / PROTECTION'));
 ok((await manage.innerText()).includes('Estimated margin'));
 eq(await manage.locator('.v4-exit-card').count(),2);
 eq(await manage.locator('.v4-session').count(),0,'no duplicate position status row');
 eq(await manage.locator('.v4-capsule').count(),0,'no Open Position/New Order switch in manager');
 eq(await manage.locator('.v4-instrument .v4-manage-header-context').count(),1,'single contextual side/status line');
 eq(await manage.locator('.v4-quote-strip').count(),1,'retain compact prices and return');
 eq(await manage.locator('.v4-quote-strip > span').count(),3);
 eq(await manage.locator('.v4-section-heading').filter({hasText:/^POSITION$/}).count(),0,
   'no redundant position heading');
 eq(await manage.getByText('POSITION SIZE',{exact:true}).count(),1);
 eq(await manage.getByRole('button',{name:'Back to new order'}).count(),1);
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
 eq(await manage.locator('[data-v4-partial-close-options]').count(),0,
   'percentage buttons hidden before partial close is requested');
 await manage.getByRole('button',{name:'Partial close'}).click();
 eq(await manage.getByRole('dialog',{name:'Confirm position close'}).count(),0,
   'Partial Close must not implicitly close 50%');
 eq(await manage.locator('[data-v4-partial-close-options] button').count(),3);
 eq(await page.evaluate(()=>window.v4QA.actionCommands.filter(x=>x.kind==='close').length),0);
 await manage.getByRole('button',{name:'Close 25%'}).click();
 eq(await manage.getByRole('dialog',{name:'Confirm position close'}).count(),1);
 ok((await manage.getByRole('dialog',{name:'Confirm position close'}).innerText()).includes('25%'),
   'confirm exact chosen percentage');
 await manage.getByRole('button',{name:'Cancel',exact:true}).click();
 eq(await page.evaluate(()=>window.v4QA.actionCommands.filter(x=>x.kind==='close').length),0);
 await manage.locator('.v4-manage-close').click();
 eq(await manage.getByRole('dialog',{name:'Confirm position close'}).count(),1);
 eq(await manage.locator('.v4-manage-close').count(),0,'Close Position CTA replaced during confirmation');
 eq(await manage.locator('.v4-manage-close-dialog').count(),0,'no oversized close confirmation card');
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
 // Click the *chart* position to switch directly from EUR/USD into the
 // BTC position's management panel; this must not leave EUR/USD selected.
 await page.locator('[data-v4-chart-badge]').click();
 await page.waitForFunction(()=>window.v4QA.selectedPositionId==='p1');
 eq(await page.locator('[data-v4-manage-position="p1"]').count(),1,
   'chart position selection switches to the exact clicked position');
 eq(await page.locator('[data-v4-manage-position="p2"]').count(),0);
 await page.locator('[data-v4-manage-position="p1"]').getByRole('button',{name:'Back to new order'}).click();
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
