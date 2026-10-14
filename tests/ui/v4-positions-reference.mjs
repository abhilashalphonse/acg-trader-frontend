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
  eq(await dock.getByRole('button',{name:'Positions display settings'}).count(),0,'Redundant settings icon removed');
  eq(await dock.getByRole('button',{name:'Columns'}).count(),0,'Columns control removed');
  const footer=dock.locator('[data-v4-exposure-footer]');
  eq(await footer.count(),1,'Portfolio exposure footer available');
  ok((await footer.innerText()).includes('2 open positions'),'Open count footer correct');
  ok((await footer.innerText()).includes('Gross exposure (USD)'),'Mixed units shown only as verified USD notional');
  ok((await footer.innerText()).includes('$2,479.35'),'Gross exposure includes complete BTC and EUR USD notionals');
  ok((await footer.innerText()).includes('+$244.65'),'Net directional USD signs SELL and BUY correctly');
  eq(await dock.locator('tr[data-v4-position-id="position-btc-2"] [data-v4-single-asset]').count(),1,
    'BTC position uses one primary Bitcoin mark');

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
  eq(await dock.locator('thead th').count(),5,'Compact columns are fixed');
  eq(await dock.locator('.v4-positions-account-summary').count(),1,'Overview remains visible');
  eq(await footer.count(),1,'Verified exposure footer remains visible');
  await page.keyboard.press('Escape');
  await dock.getByRole('button',{name:'Risk',exact:true}).click();
  eq(await dock.getAttribute('data-v4-position-view'),'risk','Risk view swaps table columns only');
  eq(await ids(),originalIds,'Risk retains identity/order');
  eq(await dock.getByRole('button',{name:'Expand position details for EUR/USD'}).count(),1,'Risk supports reference expand chevron');
  await dock.getByRole('button',{name:'Expand position details for EUR/USD'}).click();
  const detail=dock.locator('[data-v4-position-detail="position-eur-1"]');
  eq(await detail.count(),1,'Expanded section inserted under correct row');
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
  await dock.getByRole('button',{name:'Collapse position details for EUR/USD'}).click();
  eq(await detail.count(),0,'Chevron can collapse details');
  const commonDetails=await detail.locator('.v4-position-detail-columns').innerText();
  await dock.getByRole('button',{name:'Execution',exact:true}).click();
  eq(await detail.locator('.v4-position-detail-columns').innerText(),commonDetails,'Detail content remains identical across Risk and Execution');
  eq(await ids(),originalIds,'Execution retains same rows');
  await dock.getByRole('button',{name:'Expand position details for BTC/USD'}).click();
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
