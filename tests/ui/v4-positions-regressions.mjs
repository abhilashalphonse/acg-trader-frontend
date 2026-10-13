import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
let checks=0;
const eq=(actual,expected,description)=>{assert.deepEqual(actual,expected,description);checks++};
const ok=(actual,description)=>{assert.ok(actual,description);checks++};
try {
  await page.addInitScript(()=>{
    window.localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
      dockHeight:285,sidebarCollapsed:false,dockCollapsed:false,sidebarWidth:370
    }));
    if (!window.sessionStorage.getItem('v4-positions-first-load')) {
      window.localStorage.removeItem('acg-v4-positions-view-v1');
      window.sessionStorage.setItem('v4-positions-first-load','yes');
    }
  });
  const response=await page.goto('http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1',{waitUntil:'domcontentloaded'});
  eq(response?.status(),200,'Full-terminal fixture HTTP 200');
  const dock=page.locator('[data-v4-positions="true"]');
  await dock.waitFor({state:'visible'});
  eq(await dock.getAttribute('data-v4-position-view'),'compact','Defaults Compact on first use');
  eq(await dock.locator('[data-v4-position-id]').count(),2,'Two real fixture positions');
  const rows=()=>dock.locator('tr[data-v4-position-id]');
  const order=async()=>rows().evaluateAll(list=>list.map(el=>el.getAttribute('data-v4-position-id')));
  const initialOrder=await order();
  eq(initialOrder,['position-eur-1','position-btc-2'],'Canonical row identity and order');
  eq(await dock.locator('thead th').allTextContents(),['Instrument','Size','Current price','Unrealized P&L','Actions'],'Exact Compact headings');
  ok((await rows().first().innerText()).includes('−$0.83'),'Signed negative P&L');
  ok((await rows().first().innerText()).includes('SELL'),'Sell badge retained');
  eq(await rows().first().locator('td').count(),5,'Compact has five columns');
  const compactMetrics=await page.evaluate(()=>{
    const d=document.querySelector('[data-v4-positions="true"]');
    const tr=d.querySelector('tr[data-v4-position-id]');
    const head=d.querySelector('.v4-positions-header');
    const th=d.querySelector('thead th');
    const rect=el=>el.getBoundingClientRect();
    return {root:rect(d).height,parent:rect(d.parentElement).height,
      row:rect(tr).height,head:rect(head).height,heading:rect(th).height,
      bg:getComputedStyle(d).backgroundColor,padding:getComputedStyle(th).paddingLeft,
      font:getComputedStyle(th).fontSize};
  });
  ok(Math.abs(compactMetrics.root-compactMetrics.parent)<=1,'V4 table dock fills resized panel, never legacy 44px clipping');
  eq(compactMetrics.row,48,'Compact row 48px');
  eq(compactMetrics.head,48,'Header 48px');
  eq(compactMetrics.heading,32,'Column header 32px');
  eq(compactMetrics.bg,'rgb(9, 9, 11)','Single pure-black surface');
  eq(compactMetrics.padding,'12px','Column cell horizontal padding');
  eq(compactMetrics.font,'11px','Column labels 11px');
  await rows().first().click();
  eq(await dock.locator('tr[aria-selected="true"]').count(),1,'Row selection retained');
  eq(await page.locator('[data-v4-manage-position="position-eur-1"]').count(),0,'Dock selection never opens right-side position management');
  eq(await page.locator('[data-v4-manage-position]').count(),0,'Trade Execution stays independent on row selection');
  eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,'Selection never sends trading commands');
  await dock.getByRole('button',{name:'Risk',exact:true}).click();
  eq(await dock.getAttribute('data-v4-position-view'),'risk','Risk swaps view only');
  eq(await order(),initialOrder,'Risk view keeps order and identity');
  eq(await dock.locator('tr[aria-selected="true"]').count(),1,'Risk keeps selected position');
  eq(await dock.locator('thead th').allTextContents(),
    ['Instrument','Exposure','Margin','Stop loss','Take profit','Risk at stop','Unrealized P&L'],'Exact Risk headings');
  eq(await rows().first().locator('td').count(),7,'Risk has seven columns');
  ok((await rows().first().innerText()).includes('1,000 EUR'),'Base-quantity exposure labeled in EUR');
  ok((await rows().first().innerText()).includes('$11.16'),'Stored margin retained');
  eq(await rows().first().getByRole('button',{name:'Add stop loss for EURUSD'}).count(),1,'Missing SL has Add button');
  eq(await rows().first().getByRole('button',{name:'Add take profit for EURUSD'}).count(),1,'Missing TP has Add button');
  eq(await rows().first().getByRole('button',{name:'Close'}).count(),0,'No Close in Risk inspection view');
  await rows().first().getByRole('button',{name:'Add stop loss for EURUSD'}).click();
  eq(await page.locator('[data-v4-manage-position="position-eur-1"]').count(),1,'SL routes to existing right-side editor');
  eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,'Protection click cannot execute close');
  await dock.getByRole('button',{name:'Execution',exact:true}).click();
  eq(await order(),initialOrder,'Execution view retains same positions and order');
  eq(await dock.locator('thead th').allTextContents(),
    ['Instrument','Size','Entry price','Opened','Source','Position ID'],'Exact Execution headings');
  eq(await rows().first().locator('td').count(),6,'Execution has six columns');
  const opened=await rows().first().innerText();
  ok(opened.includes('13 Oct 2026'),'Opening date from raw ISO');
  ok(opened.includes('Manual'),'Actual execution provenance used when available');
  ok(opened.includes('position-eur-1'),'Exact position ID not fabricated');
  eq(await rows().first().getByRole('button',{name:'Close'}).count(),0,'Execution inspection has no Close action');
  eq(await rows().last().getByRole('button',{name:/Expand execution details/}).count(),1,'Chevron is accessible');
  const measured=await rows().first().evaluate(el=>el.getBoundingClientRect().height);
  eq(measured,56,'Execution row 56px');
  await rows().last().getByRole('button',{name:/Expand execution details/}).click();
  eq(await dock.locator('[data-v4-position-detail="position-btc-2"]').count(),1,'Expanded details directly beneath target position');
  eq(await rows().last().getByRole('button',{name:/Collapse execution details/}).getAttribute('aria-expanded'),'true','Chevron state accessible');
  await page.reload({waitUntil:'domcontentloaded'});
  await dock.waitFor({state:'visible'});
  eq(await dock.getAttribute('data-v4-position-view'),'execution','Last-selected view persists after reload');
  await dock.getByRole('button',{name:'Compact',exact:true}).click();
  await rows().first().getByRole('button',{name:'Close',exact:true}).click();
  eq(await page.locator('[data-v4-manage-position="position-eur-1"]').getByRole('dialog',{name:'Confirm position close'}).count(),1,'Close goes through existing V4 review');
  eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,'No command before close confirmation');
  await page.locator('[data-v4-manage-position="position-eur-1"]').getByRole('button',{name:'Cancel',exact:true}).last().click();
  eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,'Cancel produces no execution');
  await rows().first().getByRole('button',{name:'More actions for EURUSD'}).click();
  eq(await page.getByRole('menu',{name:'Actions for EURUSD'}).count(),1,'Overflow menu has accessible role and target');
  await page.getByRole('menuitem',{name:'Manage position'}).click();
  eq(await page.locator('[data-v4-manage-position="position-eur-1"]').count(),1,'Explicit Manage action opens the right-side V4 management panel');
  await rows().first().click();
  eq(await page.locator('[data-v4-manage-position]').count(),1,'Row inspection does not replace existing management panel');
  await rows().first().getByRole('button',{name:'More actions for EURUSD'}).click();
  eq(await page.getByRole('menuitem',{name:'Move to break-even'}).isDisabled(),true,'Break-even is disabled without live favorable mark');
  eq(await page.getByRole('menuitem',{name:'Trailing stop · 5 pips'}).count(),1,'Existing trailing choices are exposed');
  await page.getByRole('menuitem',{name:'Review close 50%'}).click();
  eq(await page.locator('[data-v4-manage-position="position-eur-1"]').getByRole('dialog',{name:'Confirm position close'}).count(),1,'Partial close launches existing V4 confirmation');
  ok((await page.locator('[data-v4-manage-position="position-eur-1"]').getByRole('dialog',{name:'Confirm position close'}).innerText()).includes('50%'),'Partial close confirmation identifies exact percentage');
  eq(await page.evaluate(()=>window.v4PositionsQA.commands.length),0,'Partial close review never submits a command before confirmation');
  await page.locator('[data-v4-manage-position="position-eur-1"]').getByRole('button',{name:'Cancel',exact:true}).last().click();
  await rows().first().getByRole('button',{name:'More actions for EURUSD'}).click();
  await page.keyboard.press('Escape');
  eq(await page.getByRole('menu',{name:'Actions for EURUSD'}).count(),0,'Escape dismisses overflow');
  // Large P&L updates cannot move columns or reorder position rows.
  const widthsBefore=await dock.locator('thead th').evaluateAll(items=>items.map(el=>el.getBoundingClientRect().width));
  await page.evaluate(()=>window.v4PositionsQA.setPnl('position-btc-2',123456789.89));
  await page.waitForTimeout(120);
  const widthsAfter=await dock.locator('thead th').evaluateAll(items=>items.map(el=>el.getBoundingClientRect().width));
  eq(widthsAfter,widthsBefore,'Large P&L values never resize fixed columns');
  eq(await order(),initialOrder,'Live updates do not reorder rows');
  await page.setViewportSize({width:768,height:850});
  await dock.getByRole('button',{name:'Risk',exact:true}).click();
  const narrow=await dock.evaluate(el=>{
    const scroll=el.querySelector('.v4-positions-scroller'),tabs=el.querySelector('.v4-positions-tabs');
    const selector=el.querySelector('.v4-positions-header-right');
    return {scrollWidth:scroll.scrollWidth,clientWidth:scroll.clientWidth,
      minWidth:el.querySelector('table').getBoundingClientRect().width,
      stacked:selector.getBoundingClientRect().top>=tabs.getBoundingClientRect().bottom-1};
  });
  ok(narrow.scrollWidth>narrow.clientWidth,'Risk narrow width scrolls horizontally');
  ok(narrow.minWidth>=960,'Risk minimum table width 960px');
  ok(narrow.stacked,'Selector moves to second header line when container narrows');
  const first=rows().first();
  await first.focus();
  await page.keyboard.press('Enter');
  eq(await dock.locator('tr[aria-selected="true"]').count(),1,'Keyboard Enter selects position');
  await page.evaluate(()=>{window.v4PositionsQA.setPositions([]);window.v4PositionsQA.setLoading(true);});
  await page.waitForTimeout(120);
  eq(await dock.locator('tr.v4-positions-skeleton').count(),3,'Loading shows skeleton rows');
  eq(await dock.getByText('No open positions').count(),0,'Loading never masquerades as empty');
  await page.evaluate(()=>{window.v4PositionsQA.setLoading(false);window.v4PositionsQA.setError('Synchronization failed');});
  await page.getByRole('alert').waitFor();
  eq(await dock.getByText('No open positions').count(),0,'Error never masquerades as empty');
  await dock.getByRole('button',{name:'Retry'}).click();
  eq(await page.evaluate(()=>window.v4PositionsQA.retries),1,'Retry callback invoked');
  await dock.getByText('No open positions').waitFor();
  eq(await dock.getByText('Your active positions will appear here.').count(),1,'Empty copy exact');
  console.log('V4_POSITIONS_REGRESSIONS_PASS',JSON.stringify({checks,compactMetrics,narrow,rows:initialOrder}));
}catch(error){
  console.error('V4_POSITIONS_REGRESSIONS_FAIL',error);
  throw error;
}finally{
  await browser.close();
}
