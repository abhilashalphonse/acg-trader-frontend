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
      dockHeight:180,sidebarCollapsed:false,dockCollapsed:false,sidebarWidth:360
    }));
    window.localStorage.removeItem('acg-v4-positions-view-v1');
  });
  const response=await page.goto('http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1',{waitUntil:'domcontentloaded'});
  eq(response?.status(),200,'Full workspace fixture startup');
  const dock=page.locator('[data-v4-positions="true"]');
  await dock.waitFor({state:'visible'});
  eq(await dock.getAttribute('data-v4-position-view'),'compact','Compact remains default');
  const header=await dock.locator('.v4-positions-account-summary').innerText();
  ok(header.includes('Equity'),'Reference header includes Equity');
  ok(header.includes('$99,999.17'),'Actual account equity shown');
  ok(header.includes('Used margin')&&header.includes('$11.16'),'Actual used margin shown');
  ok(header.includes('Free margin')&&header.includes('$99,988.01'),'Actual free margin shown');
  ok(header.includes('Unrealized P&L')&&header.includes('−$0.83'),'Actual floating P&L shown');
  eq(await dock.locator('.v4-positions-toolbar').count(),1,'Complete reference toolbar');
  const search=dock.getByRole('searchbox',{name:'Find position'});
  const instruments=dock.getByRole('combobox',{name:'Filter by instrument'});
  eq(await search.count(),1,'Search field available');
  eq(await instruments.count(),1,'Instrument dropdown available');
  eq(await dock.getByRole('button',{name:'Positions display settings'}).count(),1,'Settings icon available');
  eq(await dock.getByRole('button',{name:'Columns'}).count(),1,'Columns chooser available');
  const footer=dock.locator('[data-v4-exposure-footer]');
  eq(await footer.count(),1,'Portfolio exposure footer available');
  ok((await footer.innerText()).includes('2 open positions'),'Open count footer correct');
  ok((await footer.innerText()).includes('Multiple assets'),'Mixed underlying assets not aggregated into false units');

  const rows=()=>dock.locator('tr[data-v4-position-id]');
  const ids=()=>rows().evaluateAll(items=>items.map(x=>x.getAttribute('data-v4-position-id')));
  const originalIds=await ids();
  await search.fill('BTC');
  eq(await ids(),['position-btc-2'],'Search filters by symbol without altering base list');
  await search.fill('position-eur-1');
  eq(await ids(),['position-eur-1'],'Search filters by exact position ID');
  await search.fill('');
  await instruments.selectOption('BTCUSD');
  eq(await ids(),['position-btc-2'],'Dropdown filters instrument');
  await instruments.selectOption('');
  eq(await ids(),originalIds,'Clear filtering restores previous order');
  await dock.getByRole('button',{name:'Columns'}).click();
  const chooser=dock.getByRole('group',{name:'Columns in compact view'});
  await chooser.getByRole('checkbox',{name:'Size'}).uncheck();
  eq(await dock.locator('thead th').count(),4,'Column chooser hides optional column');
  eq(await rows().first().locator('td').count(),4,'Column chooser hides matching row cells');
  await chooser.getByRole('button',{name:'Reset columns'}).click();
  eq(await dock.locator('thead th').count(),5,'Reset restores Compact default');
  await dock.getByRole('button',{name:'Positions display settings'}).click();
  const settings=dock.getByRole('group',{name:'Positions display settings'});
  await settings.getByRole('checkbox',{name:'Show exposure footer'}).uncheck();
  eq(await footer.count(),0,'Settings can hide exposure footer');
  await settings.getByRole('checkbox',{name:'Show exposure footer'}).check();
  eq(await footer.count(),1,'Settings restore footer');
  await settings.getByRole('checkbox',{name:'Show account overview'}).uncheck();
  eq(await dock.locator('.v4-positions-account-summary').count(),0,'Settings hide account summary');
  await settings.getByRole('checkbox',{name:'Show account overview'}).check();
  eq(await dock.locator('.v4-positions-account-summary').count(),1,'Settings restore account summary');
  await page.keyboard.press('Escape');
  await dock.getByRole('button',{name:'Risk',exact:true}).click();
  eq(await dock.getAttribute('data-v4-position-view'),'risk','Risk view swaps table columns only');
  eq(await ids(),originalIds,'Risk retains identity/order');
  eq(await dock.getByRole('button',{name:'Expand position details for EUR/USD'}).count(),1,'Risk supports reference expand chevron');
  await dock.getByRole('button',{name:'Expand position details for EUR/USD'}).click();
  const detail=dock.locator('[data-v4-position-detail="position-eur-1"]');
  eq(await detail.count(),1,'Expanded section inserted under correct row');
  const detailsText=await detail.innerText();
  ok(detailsText.includes('Execution'),'Expanded Execution section present');
  ok(detailsText.includes('Risk & protection'),'Expanded Risk section present');
  ok(detailsText.includes('Position activity'),'Expanded activity section present');
  ok(detailsText.includes('Position filled'),'Activity uses actual deal record rather than browser-only Journal messages');
  ok(detailsText.includes('USD notional')&&detailsText.includes('$1,117.35'),'Risk details show quote-safe USD exposure');
  ok(detailsText.includes('Margin / equity')&&!detailsText.includes('Reserved margin'),'Risk expansion avoids repeating already-visible reserved margin');
  ok(detailsText.includes('Recorded commission')&&detailsText.includes('$2.50'),'Recorded commission shown without combining into P&L');
  ok(detailsText.includes('Recorded swap / financing'),'Recorded swap is separately itemized');
  ok(detailsText.includes('R-multiple'),'Missing original-risk basis never guessed');
  await dock.getByRole('button',{name:'Collapse position details for EUR/USD'}).click();
  eq(await detail.count(),0,'Chevron can collapse details');
  await dock.getByRole('button',{name:'Execution',exact:true}).click();
  eq(await ids(),originalIds,'Execution retains same rows');
  await dock.getByRole('button',{name:'Expand execution details for BTC/USD'}).click();
  ok((await dock.locator('[data-v4-position-detail="position-btc-2"]').innerText()).includes('No verified execution records available.'),
    'Unavailable backend activity is not invented');
  const geometry=await dock.evaluate(el=>{
    const rect=selector=>el.querySelector(selector).getBoundingClientRect();
    return {header:rect('.v4-positions-header').height,toolbar:rect('.v4-positions-toolbar').height,
      footer:rect('.v4-positions-footer').height,container:el.getBoundingClientRect().height};
  });
  ok(geometry.container>=290,'Legacy saved 180px dock is upgraded once to fit V4 header, toolbar, table and footer');
  eq(geometry.header,48,'Reference header height remains 48px at desktop width');
  ok(geometry.toolbar>=44,'Toolbar fits controls without overflow');
  ok(geometry.footer>=34,'Footer stays above minimum height');
  await page.setViewportSize({width:768,height:850});
  const narrow=await dock.evaluate(el=>{
    const filters=el.querySelector('.v4-positions-filters').getBoundingClientRect();
    const tools=el.querySelector('.v4-positions-tools').getBoundingClientRect();
    const scroll=el.querySelector('.v4-positions-scroller');
    return {stacked:tools.top>=filters.bottom-1,horizontal:scroll.scrollWidth>scroll.clientWidth};
  });
  ok(narrow.stacked,'At narrow widths view selector shifts below search/filter toolbar');
  ok(narrow.horizontal,'At narrow widths table scrolls horizontally');
  console.log('V4_POSITIONS_REFERENCE_PASS',JSON.stringify({checks,geometry,narrow}));
}catch(error){
  console.error('V4_POSITIONS_REFERENCE_FAIL',error);
  throw error;
}finally {await browser.close();}
