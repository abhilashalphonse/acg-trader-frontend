import assert from 'node:assert/strict';
import process from 'node:process';
import {spawn} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4183','--strictPort'],{stdio:'ignore'});
const url='http://127.0.0.1:4183/mobile-audit-browser.html';
let browser,checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(v,e,m)=>{assert.equal(v,e,m);checks++;};
try {
  for(let i=0;i<70;i++){try{if((await fetch(url)).ok)break;}catch{}await wait(200);}
  browser=await chromium.launch({headless:true,channel:'chrome'});
  for(const width of [360,393,430]) for(const surface of ['markets','trades','accounts','settings']) {
    const page=await browser.newPage({viewport:{width,height:852}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'?surface='+surface);
    await page.locator('[data-mobile-v4-surface]').waitFor();
    eq(await page.evaluate(()=>document.activeElement?.tagName==='INPUT'),false,surface+' does not summon keyboard');
    const geometry=await page.evaluate(()=>{
      const el=document.querySelector('[data-mobile-v4-surface]');
      return {width:document.documentElement.scrollWidth,view:innerWidth,height:el.getBoundingClientRect().height,font:getComputedStyle(el.querySelector('h2') || Array.from(el.querySelectorAll('header button')).find(b=>b.textContent.trim()==='Trade')).fontSize};
    });
    ok(geometry.width<=geometry.view,surface+' fits narrow viewport');
    ok(geometry.height<=853,surface+' fits viewport height');
    eq(geometry.font,'14px',surface+' uses compact V4 title');
    if(width===393)await page.screenshot({path:`artifacts/mobile-v4-${surface}.png`});
    if(surface==='settings') {
      await page.getByRole('group',{name:'Chart type'}).getByRole('button',{name:'Line',exact:true}).click();
      await page.waitForFunction(()=>window.mobileSurfacesQA.chartMode==='line');
      await page.getByRole('group',{name:'Default timeframe'}).getByRole('button',{name:'1H',exact:true}).click();
      await page.waitForFunction(()=>window.mobileSurfacesQA.timeframe==='1H');
      eq(await page.getByRole('group',{name:'Chart type'}).getByRole('button',{name:'Line',exact:true}).getAttribute('aria-pressed'),'true','settings control reflects actual state');
    }
    if(surface==='markets') {
      await page.getByRole('textbox').fill('GBP');
      await page.getByRole('button',{name:/GBP\/USD/}).click();
      await page.waitForFunction(()=>window.mobileSurfacesQA.symbol==='GBPUSD');
      checks++;
    }
    if(surface==='accounts') {
      await page.getByRole('button',{name:/ACG-SECOND/}).click();
      await page.waitForFunction(()=>window.mobileSurfacesQA.selected==='second');checks++;
    }
    if(surface==='trades') {
      await page.getByRole('tab',{name:'History',exact:true}).click();
      ok((await page.locator('body').textContent()).includes('History'),'history navigation remains available');
    }
    eq(errors.length,0,surface+' no runtime errors: '+errors.join(';'));
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:393,height:852}});
  await page.goto(url+'?manage=1');
  await page.locator('[data-mobile-v4-badge="fixture-account:position:p1:entry"]').click();
  const dock=page.locator('[data-acg-mobile-manage-dock]');await dock.waitFor();
  await dock.getByRole('button',{name:'SL ✓',exact:true}).click();
  await dock.getByRole('button',{name:'Edit selected price'}).click();
  eq(await page.evaluate(()=>document.activeElement?.tagName==='INPUT'),false,'precise editor does not focus input');
  eq((await dock.boundingBox()).height,118,'precise editing retains dock height');
  await dock.getByRole('textbox',{name:'Selected level price'}).fill('1.12345');
  await dock.getByRole('button',{name:'Preview',exact:true}).click();
  eq(await page.evaluate(()=>window.mobileManageQA.commands.length),0,'typing/preview cannot submit');
  eq(await page.evaluate(()=>window.mobileManageQA.positions[0].sl),1.124,'accepted SL remains fixed');
  await page.screenshot({path:'artifacts/mobile-v4-precise-preview.png'});
  await dock.getByRole('button',{name:'Apply SL',exact:true}).click();
  await page.waitForFunction(()=>window.mobileManageQA.commands.length===1);
  await page.evaluate(()=>window.mobileManageQA.acknowledge());
  await page.waitForFunction(()=>window.mobileManageQA.positions[0].sl===1.12345 && !window.mobileManageQA.management.edit);
  await dock.getByRole('button',{name:'Trade actions'}).click();
  await dock.getByRole('button',{name:'Break-even',exact:true}).click();
  eq(await page.evaluate(()=>window.mobileManageQA.commands.length),1,'break-even requires confirmation');
  await dock.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.waitForFunction(()=>window.mobileManageQA.commands.length===2);
  await page.evaluate(()=>window.mobileManageQA.acknowledge());
  await page.waitForFunction(()=>window.mobileManageQA.positions[0].sl===window.mobileManageQA.positions[0].entry);
  await dock.getByRole('button',{name:'Trade actions'}).click();
  await dock.getByRole('button',{name:'Trailing stop',exact:true}).click();
  await dock.getByRole('button',{name:'10 pips',exact:true}).click();
  await dock.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.waitForFunction(()=>window.mobileManageQA.commands.length===3);
  await page.evaluate(()=>window.mobileManageQA.acknowledge());
  await page.waitForFunction(()=>window.mobileManageQA.positions[0].trailingPips===10);
  await dock.getByRole('button',{name:'SL ✓',exact:true}).click();
  await dock.getByRole('button',{name:'Edit selected price'}).click();
  await dock.getByRole('textbox').fill('1.123');
  await dock.getByRole('button',{name:'Preview',exact:true}).click();
  await page.evaluate(()=>window.mobileManageQA.setFailure('unknown'));
  await dock.getByRole('button',{name:'Apply SL',exact:true}).click();
  await dock.getByRole('button',{name:'Check status',exact:true}).waitFor();
  await dock.getByRole('button',{name:'Check status',exact:true}).click();
  await page.waitForFunction(()=>window.mobileManageQA.statusChecks===1);
  eq(await page.evaluate(()=>window.mobileManageQA.commands.length),3,'status check never resubmits uncertain amendment');
  eq(await dock.getByRole('button',{name:'Apply SL',exact:true}).count(),0,'uncertainty blocks another attempt');
  await page.reload();
  await dock.getByRole('button',{name:'Check status',exact:true}).waitFor();
  eq(await page.evaluate(()=>window.mobileManageQA.commands.length),0,'reload restores recovery without resubmitting');
  await page.evaluate(()=>window.mobileManageQA.setPositions(prev=>prev.map(p=>({...p,sl:1.123}))));
  await page.waitForFunction(()=>window.mobileManageQA.positions[0].sl===1.123 && !window.mobileManageQA.management.edit);

  await dock.getByRole('button',{name:'Finish managing trade'}).click();
  await page.locator('[data-mobile-v4-badge="fixture-account:pending:o1:entry"]').click();
  await dock.getByRole('button',{name:'Entry',exact:true}).waitFor();
  await dock.getByRole('button',{name:'Trade actions'}).click();
  await dock.getByRole('button',{name:'Order details',exact:true}).click();
  ok((await dock.textContent()).includes('GTC'),'pending details show actual expiry policy');
  eq((await dock.boundingBox()).height,118,'pending details retain dock height');
  await page.close();
  const trade=await browser.newPage({viewport:{width:393,height:852}});
  await trade.goto(url);const ticket=trade.locator('[data-acg-mobile-audit-dock]');await ticket.waitFor();
  await ticket.getByRole('button',{name:'Edit position sizing'}).click();
  await ticket.getByRole('textbox').fill('0.15');await ticket.getByRole('button',{name:'Apply',exact:true}).click();
  await trade.evaluate(()=>window.mobileAuditQA.setManaged(true));
  await trade.locator('[data-fixture-managed]').waitFor();
  await trade.evaluate(()=>window.mobileAuditQA.setManaged(false));
  ok((await ticket.textContent()).includes('0.15'),'management round trip preserves sizing');
  await trade.reload();await ticket.waitFor();
  ok((await ticket.textContent()).includes('0.15'),'reload restores scoped sizing preference');
  await trade.locator('[data-acg-mobile-audit-palette]').getByRole('button',{name:'Expand drawing tools'}).click();
  await trade.getByRole('button',{name:'Line chart',exact:true}).click();
  await trade.waitForFunction(()=>window.mobileAuditQA.chartMode==='line');
  await trade.getByRole('button',{name:'Fit chart',exact:true}).click();
  await trade.waitForFunction(()=>window.mobileAuditQA.fitCount===1);checks+=2;
  await ticket.getByRole('button',{name:'Prepare buy draft'}).click();
  await ticket.getByRole('button',{name:'Set stop loss'}).click();
  await ticket.getByRole('button',{name:'Review buy draft'}).click();
  ok((await ticket.textContent()).includes('BUY MARKET'),'review identifies side/type');
  ok((await ticket.textContent()).includes('Entry')&&(await ticket.textContent()).includes('SL')&&(await ticket.textContent()).includes('TP'),'review shows entry and protection');
  ok((await ticket.textContent()).includes('Est. risk at SL'),'review shows resolved risk');
  eq((await ticket.boundingBox()).height,118,'review retains dock height');
  await trade.screenshot({path:'artifacts/mobile-v4-order-review.png'});
  await trade.evaluate(()=>window.mobileAuditQA.setRecovery(true));
  await ticket.getByRole('button',{name:'Check status',exact:true}).click();
  await trade.waitForFunction(()=>window.mobileAuditQA.checks===1);
  eq(await trade.evaluate(()=>window.mobileAuditQA.commands),0,'new-order recovery is read-only');
  eq(await ticket.getByRole('button',{name:'Confirm buy order'}).count(),0,'recovery cannot place again');
  await trade.close();
  console.log('MOBILE_V4_COMPLETION_PASS',checks);
} finally {if(browser)await browser.close();server.kill();}
