import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++};
const ok=(value,label)=>{assert.ok(value,label);checks++};
try{
  await page.addInitScript(()=>{
    window.localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
      dockHeight:52,sidebarCollapsed:false,dockCollapsed:false,sidebarWidth:360
    }));
    window.localStorage.removeItem('acg-v4-positions-view-v1');
  });
  const response=await page.goto('http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1',{waitUntil:'domcontentloaded'});
  eq(response?.status(),200,'Full workspace fixture startup');
  const dock=page.locator('[data-v4-positions="true"]');
  await dock.waitFor({state:'visible'});
  eq(await dock.getAttribute('data-v4-position-view'),'compact','Compact remains default');
  const overviewTrigger=dock.getByRole('button',{name:'Account overview and margin details'});
  eq(await overviewTrigger.count(),1,'Every account snapshot stays accessible');
  await overviewTrigger.click();
  const overview=page.getByRole('dialog',{name:'Account overview'});
  await overview.waitFor({state:'visible'});
  const metrics=await overview.innerText();
  ok(metrics.includes('Equity')&&metrics.includes('$99,999.17'),'Verified account equity');
  ok(metrics.includes('Used margin')&&metrics.includes('$11.16'),'Reserved margin is never hidden');
  ok(metrics.includes('Free margin')&&metrics.includes('$99,988.01'),'Full free margin remains available');
  ok(metrics.includes('Unrealized P&L')&&metrics.includes('−$0.83'),'Exact signed P&L stays available');
  ok(metrics.includes('Gross (USD)')&&metrics.includes('Net directional (USD)'),
    'Verified exposure reachable without fullscreen');
  await page.keyboard.press('Escape');
  eq(await overview.count(),0,'Escape closes account overview');
  eq(await dock.locator('.v4-positions-toolbar').count(),0,'Standalone filter/view toolbar removed');
  eq(await dock.getByRole('searchbox').count(),0,'No position search on desktop');
  eq(await dock.getByRole('combobox',{name:'Filter by instrument'}).count(),0,'No instrument filter');
  eq(await dock.getByRole('button',{name:'Positions display settings'}).count(),0,'No redundant settings');
  eq(await dock.getByRole('button',{name:'Columns'}).count(),0,'No editable columns');
  const footer=dock.locator('[data-v4-exposure-footer]');
  eq(await footer.count(),0,'Footer yields space for two rows in normal dock');
  await dock.getByRole('button',{name:'Expand positions workspace'}).click();
  eq(await footer.count(),1,'Exposure remains available in expanded workspace');
  ok((await footer.innerText()).includes('2 open positions'),'Open count footer correct');
  ok((await footer.innerText()).includes('Gross exposure (USD)'),'USD notional only when verified');
  ok((await footer.innerText()).includes('$2,479.35'),'Verified gross exposure preserved');
  ok((await footer.innerText()).includes('+$244.65'),'Directional net preserved');
  await dock.getByRole('button',{name:'Restore positions workspace'}).click();
  eq(await dock.locator('tr[data-v4-position-id="position-btc-2"] [data-v4-single-asset]').count(),1,
    'BTC position uses one primary Bitcoin mark');

  const rows=()=>dock.locator('tr[data-v4-position-id]');
  const ids=()=>rows().evaluateAll(items=>items.map(x=>x.getAttribute('data-v4-position-id')));
  const originalIds=await ids();
  const visible=await dock.evaluate(el=>{
    const scroller=el.querySelector('.v4-positions-scroller').getBoundingClientRect();
    return [...el.querySelectorAll('tr[data-v4-position-id]')].filter(row=>{
      const box=row.getBoundingClientRect();
      return box.top>=scroller.top-1&&box.bottom<=scroller.bottom+1;
    }).length;
  });
  eq(visible,2,'Two entire position rows fit in the minimum-height workspace');

  eq(await ids(),originalIds,'All positions remain present without filtering');
  eq(await dock.locator('thead th').count(),5,'Compact columns are fixed');
  eq(await dock.locator('.v4-positions-account-summary').count(),1,'Account metrics remain visible');
  eq(await footer.count(),0,'Normal two-row workspace keeps footer out of the viewport');
  await page.keyboard.press('Escape');
  await dock.getByRole('button',{name:'Risk',exact:true}).click();
  eq(await dock.getAttribute('data-v4-position-view'),'risk','Risk view swaps table columns only');
  eq(await ids(),originalIds,'Risk retains identity/order');
  eq(await dock.getByRole('button',{name:'Expand position details for EUR/USD'}).count(),1,'Risk supports reference expand chevron');
  await dock.getByRole('button',{name:'Expand position details for EUR/USD'}).click();
  const detail=dock.locator('[data-v4-position-detail="position-eur-1"]');
  eq(await detail.count(),1,'Expanded section inserted under correct row');
  const detailHeight=await detail.evaluate(el=>el.getBoundingClientRect().height);
  ok(detailHeight>=190&&detailHeight<=225,`Detail card stays near 200–220px, measured ${detailHeight}px`);
  const detailsText=await detail.innerText();
  ok(detailsText.includes('Protection'),'Protection present');
  ok(detailsText.includes('Exposure & costs'),'Exposure and costs present');
  ok(detailsText.includes('Activity'),'Short activity present');
  ok(detailsText.includes('Position filled'),'Activity uses actual deal record rather than browser-only Journal messages');
  ok(detailsText.includes('Notional · live')&&detailsText.includes('$1,117.35'),'Validated live notional in expansion');
  ok(detailsText.includes('Reserved margin')&&detailsText.includes('$11.16'),'Stored margin always visible in expansion');
  ok(detailsText.includes('Commission')&&detailsText.includes('$2.50'),'Recorded commission shown without combining into P&L');
  ok(detailsText.includes('Swap / financing'),'Recorded swap separately itemized');
  ok(!detailsText.includes('R-multiple')&&!detailsText.includes('Current bid/ask spread'),'No R-multiple or spread in expansion');
  await detail.locator('summary').click();
  eq(await detail.getByRole('button',{name:/Copy Position ID/}).count(),1,'Copy Position ID');
  eq(await detail.getByRole('button',{name:/Copy Order ID/}).count(),1,'Copy Order ID');
  eq(await detail.getByRole('button',{name:/Copy Deal ID/}).count(),1,'Copy Deal ID');
  await detail.locator('summary').click();
  const commonDetails=await detail.locator('.v4-position-detail-columns').innerText();
  await dock.getByRole('button',{name:'Execution',exact:true}).click();
  eq(await detail.locator('.v4-position-detail-columns').innerText(),commonDetails,'Detail content remains identical across Risk and Execution');
  await dock.getByRole('button',{name:'Collapse position details for EUR/USD'}).click();
  eq(await detail.count(),0,'Chevron can collapse details');
  eq(await ids(),originalIds,'Execution retains same rows');
  await dock.getByRole('button',{name:'Expand position details for BTC/USD'}).click();
  ok((await dock.locator('[data-v4-position-detail="position-btc-2"]').innerText()).includes('No verified execution records available.'),
    'Unavailable backend activity is not invented');
  const geometry=await dock.evaluate(el=>{
    const rect=selector=>el.querySelector(selector).getBoundingClientRect();
    const rows=el.querySelectorAll('tr[data-v4-position-id]');
    const head=rect('.v4-positions-header'), scroller=rect('.v4-positions-scroller');
    return {header:head.height,container:el.getBoundingClientRect().height,
      tableHead:rect('.v4-positions-table thead').height,
      visibleRows:[...rows].filter(row=>{const box=row.getBoundingClientRect();return box.top>=scroller.top-1&&box.bottom<=scroller.bottom+1;}).length};
  });
  console.log('V4_DOCK_ACTUAL_GEOMETRY',JSON.stringify(geometry));
  ok(geometry.container>=148,'Workspace reserves two visible rows despite terminal chrome');
  eq(geometry.header,44,'Unified toolbar remains 44px high');
  eq(geometry.tableHead,27,'Compact column-heading row is 27px high');
  await page.setViewportSize({width:768,height:850});
  const narrow=await dock.evaluate(el=>{
    const header=el.querySelector('.v4-positions-header').getBoundingClientRect();
    const tabs=el.querySelector('.v4-positions-tabs').getBoundingClientRect();
    const tools=el.querySelector('.v4-positions-tools').getBoundingClientRect();
    const scroll=el.querySelector('.v4-positions-scroller');
    return {singleRow:Math.abs(header.top-tabs.top)<2&&Math.abs(header.top-tools.top)<12,
      height:header.height,horizontal:scroll.scrollWidth>scroll.clientWidth};
  });
  ok(narrow.singleRow,'Narrow dock retains one toolbar row');
  eq(narrow.height,44,'Narrow dock stays 44px tall');
  ok(narrow.horizontal,'Narrow table scrolls horizontally without wrapping the toolbar');
  const selector=dock.getByRole('combobox',{name:'Positions table view'});
  eq(await selector.count(),1,'Narrow desktop retains all three trading view modes');
  await selector.selectOption('execution');
  eq(await dock.getAttribute('data-v4-position-view'),'execution','Execution remains selectable at laptop widths');
  const narrowRows=await dock.evaluate(el=>{
    const viewport=el.querySelector('.v4-positions-scroller').getBoundingClientRect();
    return [...el.querySelectorAll('tr[data-v4-position-id]')].filter(row=>{
      const box=row.getBoundingClientRect();
      return box.top>=viewport.top-1&&box.bottom<=viewport.bottom+1;
    }).length;
  });
  eq(narrowRows,2,'Two entire Execution rows fit even with horizontal scrollbar');

  await page.setViewportSize({width:1440,height:900});
  await rows().first().getByRole('button',{name:'Expand position details for EUR/USD'}).click();
  await dock.locator('[data-v4-position-detail="position-eur-1"]').getByRole('button',{name:/View history/}).click();
  const scopedHistory=page.locator('[data-v4-activity="history"]');
  await scopedHistory.waitFor({state:'visible'});
  ok((await scopedHistory.locator('.v4-activity-position-filter').innerText()).includes('position-eur-1'),
    'History link scopes to the selected position rather than unrelated records');
  ok((await scopedHistory.locator('.v4-activity-position-events').innerText()).includes('Position filled'),
    'Scoped history shows authoritative order and deal events for an active position');
  eq(await scopedHistory.locator('tr.v4-activity-row').count(),0,
    'Other positions closed history is excluded from scoped view');
  await scopedHistory.getByRole('button',{name:'Show all position history'}).click();
  eq(await scopedHistory.locator('tr.v4-activity-row').count(),2,
    'Clear filter returns to all recent closed positions');
  console.log('V4_POSITIONS_REFERENCE_PASS',JSON.stringify({checks,geometry,narrow}));
}catch(error){
  console.error('V4_POSITIONS_REFERENCE_FAIL',error);
  throw error;
}finally {await browser.close();}
