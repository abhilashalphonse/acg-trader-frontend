import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const url='http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1&acg_dock_audit=1';

async function checkHeight(min,max){
  await page.waitForFunction(({min,max})=>{
    const box=document.querySelector('.acg-desktop-dock-shell')?.getBoundingClientRect();
    return box&&box.height>=min&&box.height<=max;
  },{min,max},{timeout:12000});
}
async function expectEmpty(tab,message,detail){
  const dock=tab==='orders'
    ? page.locator('[data-v4-pending=true]')
    : page.locator('[data-v4-activity='+tab+']');
  await dock.waitFor({state:'visible'});
  const empty=dock.locator(':scope > .v4-positions-empty');
  await empty.waitFor({state:'visible'});
  assert.equal(await empty.locator('strong').innerText(),message);
  assert.equal(await empty.locator('span').innerText(),detail);
  await checkHeight(118,122);
  assert.equal(await dock.locator('.v4-positions-footer').count(),0,'No footer on empty '+tab);
  assert.equal(await dock.locator('.v4-positions-scroller').count(),0,'No empty table/scrollbar on '+tab);
  assert.equal(await dock.locator('thead').count(),0,'No empty column-heading strip on '+tab);
  const gap=await empty.evaluate(el=>el.getBoundingClientRect().bottom-el.querySelector('span').getBoundingClientRect().bottom);
  assert.ok(gap>=5,'Empty space below message is plain on '+tab);
  return dock;
}
try {
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem('all-empty-tabs-seeded')){
      localStorage.removeItem('acg-trader-desktop-dock-audit-layout-v1');
      sessionStorage.setItem('all-empty-tabs-seeded','1');
    }
  });
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('[data-acg-dock-audit=true]').waitFor({state:'visible'});
  await page.locator('[data-v4-positions=true] tr[data-v4-position-id]').first().waitFor();
  // Use the real terminal/React state rather than testing CSS on static markup.
  await page.evaluate(()=>{
    window.v4PositionsQA.setPositions([]);
    window.v4PositionsQA.setPending([]);
    window.v4PositionsQA.setHistory([]);
    window.v4PositionsQA.setJournal([]);
  });
  const positions=page.locator('[data-v4-positions=true]');
  await positions.locator(':scope > .v4-positions-empty').waitFor();
  await checkHeight(118,122);
  assert.equal(await positions.locator('.v4-positions-footer').count(),0);
  await positions.getByRole('button',{name:/Pending/}).click();
  const pending=await expectEmpty('orders','No pending orders','Orders awaiting execution will appear here.');
  await pending.getByRole('button',{name:'Expand pending workspace'}).click();
  assert.equal(await pending.locator('.v4-positions-footer').count(),0,'No Pending footer in expanded mode');
  assert.equal(await pending.locator(':scope > .v4-positions-empty').count(),1);
  await pending.getByRole('button',{name:'Restore pending workspace'}).click();
  await checkHeight(118,122);

  await pending.getByRole('button',{name:'History',exact:true}).click();
  const history=await expectEmpty('history','No closed positions in this period','Closed trades with verified timestamps will appear here.');
  assert.equal(await history.getByRole('combobox',{name:'History date range'}).count(),1,'History filter retained');
  await history.getByRole('button',{name:'Expand workspace'}).click();
  assert.equal(await history.locator('.v4-positions-footer').count(),0,'No History footer when expanded and empty');
  await history.getByRole('button',{name:'Restore workspace'}).click();
  await checkHeight(118,122);

  // Older records still exist but date filtering leaves nothing visible.
  await page.evaluate(()=>window.v4PositionsQA.setHistory([window.v4PositionsQA.olderHistory()]));
  await expectEmpty('history','No closed positions in this period','Closed trades with verified timestamps will appear here.');
  await page.evaluate(()=>window.v4PositionsQA.setHistoryLoading(true));
  await checkHeight(180,188);
  assert.ok((await history.innerText()).includes('Loading trade history'),'History loading remains visible');
  await page.evaluate(()=>{
    window.v4PositionsQA.setHistoryLoading(false);
    window.v4PositionsQA.setHistoryError('Fixture unavailable');
  });
  await checkHeight(180,188);
  assert.ok((await history.getByRole('alert').innerText()).includes('History unavailable'),'History failure remains visible');
  await page.evaluate(()=>window.v4PositionsQA.setHistoryError(null));
  await expectEmpty('history','No closed positions in this period','Closed trades with verified timestamps will appear here.');

  await history.getByRole('button',{name:'Journal',exact:true}).click();
  const journal=await expectEmpty('journal','No local journal activity in this period','Journal entries are local to this browser.');
  assert.equal(await journal.getByRole('combobox',{name:'Journal date range'}).count(),1,'Journal date filter retained');
  await journal.getByRole('button',{name:'Expand workspace'}).click();
  assert.equal(await journal.locator('.v4-positions-footer').count(),0,'No Journal footer when expanded and empty');
  await journal.getByRole('button',{name:'Restore workspace'}).click();
  await checkHeight(118,122);
  await page.evaluate(()=>window.v4PositionsQA.setJournal([window.v4PositionsQA.olderJournal()]));
  await expectEmpty('journal','No local journal activity in this period','Journal entries are local to this browser.');

  // Records appearing again must restore normal scrolling/trading history.
  await page.evaluate(()=>window.v4PositionsQA.setHistory([{
    id:'recent-verified',symbol:'EURUSD',side:'BUY',volume:0.01,
    entry:1.11,closePrice:1.12,pnl:10,raw:{closedAt:new Date().toISOString()}
  }]));
  await journal.getByRole('button',{name:'History',exact:true}).click();
  await page.locator('[data-v4-activity=history] tr.v4-activity-row').waitFor();
  await checkHeight(180,188);
  assert.equal(await page.locator('[data-v4-activity=history] tr.v4-activity-row').count(),1,
    'History restores its trading record table');

  await page.evaluate(()=>window.v4PositionsQA.setPending([{
    id:'new-pending',symbol:'EURUSD',side:'BUY',orderType:'limit',
    volume:0.01,entry:1.10,status:'pending'
  }]));
  await page.locator('[data-v4-activity=history]').getByRole('button',{name:/Pending/}).click();
  await page.locator('[data-v4-pending=true] .v4-position-row').waitFor();
  await checkHeight(180,188);
  assert.deepEqual(errors,[],'No unhandled React errors');

  await page.goto(url.replace('&acg_dock_audit=1',''),{waitUntil:'domcontentloaded'});
  const original=page.locator('[data-v4-positions=true]');
  await original.waitFor({state:'visible'});
  assert.equal(await original.getByRole('searchbox',{name:'Find position'}).count(),1,
    'Unflagged original V4 is untouched');
  console.log('V4_ALL_EMPTY_TABS_NO_FOOTER_PASS');
}finally{
  await browser.close();
}
