import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Isolated synthetic account fixture. No API credentials, real orders or backend.
const origin=process.env.V4_RELEASE_QA_ORIGIN || 'http://127.0.0.1:5174';
const path='/v4-positions-audit.html?acg_v4_audit=1';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const failures=[];
page.on('pageerror',error=>failures.push(error.message));
try{
  await page.goto(origin+path,{waitUntil:'domcontentloaded'});
  await page.locator('[data-acg-dock-audit="true"]').waitFor({timeout:18000});
  const dock=page.locator('[data-v4-positions="true"]');
  assert.equal(await dock.getByRole('searchbox',{name:'Find position'}).count(),0,
    'Live compact dock removes obsolete search field');
  await page.getByRole('button',{name:'Trade',exact:true}).click();
  const pop=page.getByRole('button',{name:'Pop out mini terminal'});
  await pop.waitFor({state:'visible'});
  assert.equal(await page.getByRole('button',{name:'Ticket information'}).count(),0,
    'Approved popup icon replaces the three-dot menu');
  const exits=page.getByRole('button',{name:/EXITS \/ PROTECTION/});
  await exits.waitFor({state:'visible'});
  assert.equal(await exits.getAttribute('aria-expanded'),'false',
    'Approved Exits / Protection disclosure starts collapsed');
  await exits.click();
  assert.equal(await exits.getAttribute('aria-expanded'),'true',
    'Exits / Protection expands on demand');
  assert.equal(await page.locator('.v4-exit-card').count(),2,
    'Both SL and TP remain available when expanded');
  await exits.click();
  assert.equal(await page.locator('.v4-exit-card').count(),0,
    'Collapsing hides only presentation fields');

  await page.goto(origin+path+'&acg_dock_audit=0',{waitUntil:'domcontentloaded'});
  await page.locator('[data-v4-positions="true"]').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-acg-dock-audit="true"]').count(),0,
    'Explicit rollback URL restores original V4 dock');
  assert.equal(await page.locator('[data-v4-positions="true"]')
    .getByRole('searchbox',{name:'Find position'}).count(),1,
    'Legacy dock controls are restored by explicit rollback');
  await page.getByRole('button',{name:'Trade',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Pop out mini terminal'}).count(),0,
    'Rollback hides production mini popup launcher');
  assert.deepEqual(failures,[],'No browser JavaScript exceptions');
  console.log('APPROVED_COMPACT_DOCK_LIVE_PASS');
}finally{await browser.close();}
