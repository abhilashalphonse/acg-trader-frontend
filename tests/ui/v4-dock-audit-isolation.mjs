import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {isDockAuditEnabled} from '../../src/utils/dockAuditMode.js';
import {shouldOpenPublicHome} from '../../src/landing/landing-routing.js';

// A query flag must not act as a login bypass or sticky account preference.
assert.equal(isDockAuditEnabled('?acg_dock_audit=1'),true);
assert.equal(isDockAuditEnabled('?acg_dock_audit=0'),false);
assert.equal(isDockAuditEnabled('?acg_dock_audit=11'),false);
assert.equal(isDockAuditEnabled(''),false);
assert.equal(shouldOpenPublicHome('/','?acg_dock_audit=1',false),false);
assert.equal(shouldOpenPublicHome('/','?acg_dock_audit=0',false),true);

const host='http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
try{
  await page.addInitScript(()=>{
    localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
      dockHeight:286,sidebarCollapsed:false,dockCollapsed:false,sidebarWidth:360,
    }));
    localStorage.setItem('acg-v4-positions-dock-density-v3','true');
    localStorage.removeItem('acg-trader-desktop-dock-audit-layout-v1');
  });
  await page.goto(host,{waitUntil:'domcontentloaded'});
  const root=page.locator('[data-v4-positions=true]');
  await root.waitFor({state:'visible'});
  assert.equal(await page.locator('[data-acg-dock-audit=true]').count(),0,'Default URL is original V4');
  assert.equal(await root.getByRole('searchbox',{name:'Find position'}).count(),1,
    'Default V4 retains its original search and toolbars');
  assert.equal(await root.getByRole('combobox',{name:'Filter by instrument'}).count(),1,
    'Default V4 retains instrument filter');
  const normalLayout=await page.evaluate(()=>localStorage.getItem('acg-trader-desktop-layout-v2'));
  const normalDockHeight=await root.evaluate(el=>el.getBoundingClientRect().height);
  console.log('NORMAL_DOCK_BASELINE',JSON.stringify({normalDockHeight,normalLayout}));
  await page.goto(host+'&acg_dock_audit=1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-acg-dock-audit=true]').waitFor({state:'visible'});
  const audit=page.locator('[data-v4-positions=true]');
  assert.equal(await audit.getByRole('searchbox').count(),0,'Audit removes search only in flagged sessions');
  assert.equal(await audit.getByRole('combobox',{name:'Filter by instrument'}).count(),0,
    'Audit removes instrument filter only in flagged sessions');
  assert.equal(await audit.getByRole('button',{name:'Account overview and margin details'}).count(),1,
    'Audit renders redesigned metric disclosure');
  const status=await audit.evaluate(el=>{
    const rootRect=el.getBoundingClientRect();
    const viewport=el.querySelector('.v4-positions-scroller').getBoundingClientRect();
    const rows=[...el.querySelectorAll('tr[data-v4-position-id]')];
    return {height:rootRect.height,header:el.querySelector('.v4-positions-header').getBoundingClientRect().height,
      visibleRows:rows.filter(row=>{
        const r=row.getBoundingClientRect();
        return r.top>=viewport.top-1&&r.bottom<=viewport.bottom+1;
      }).length};
  });
  assert.equal(status.header,44,'Audit toolbar uses one row');
  assert.equal(status.visibleRows,2,'Audit shows two complete positions');
  assert.equal(await page.evaluate(()=>localStorage.getItem('acg-trader-desktop-layout-v2')),normalLayout,
    'Audit loading never mutates normal saved layout');
  await page.locator('[data-v4-positions=true]').getByRole('button',{name:'Expand positions workspace'}).click();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>localStorage.getItem('acg-trader-desktop-layout-v2')),normalLayout,
    'Audit fullscreen toggle never writes the normal saved layout');
  await page.goto(host+'&acg_dock_audit=0',{waitUntil:'domcontentloaded'});
  await root.waitFor({state:'visible'});
  assert.equal(await root.getByRole('searchbox',{name:'Find position'}).count(),1,
    'Turning flag off restores original dock');
  assert.equal(await page.locator('[data-acg-dock-audit=true]').count(),0);
  assert.deepEqual(errors,[],'No React runtime exceptions');
  console.log('V4_DOCK_AUDIT_ISOLATION_PASS',JSON.stringify(status));
}finally{
  await browser.close();
}
