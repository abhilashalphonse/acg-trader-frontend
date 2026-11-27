import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const base='http://127.0.0.1:5174';
await mkdir('artifacts',{recursive:true});
async function assertDraft(page){
  const panel=page.locator('[data-ai-chat-preview]');
  await panel.waitFor();
  const draft=panel.getByRole('textbox',{name:'Message ACG AI'});
  assert.equal(await draft.inputValue(),'');
  assert.equal(await panel.getByRole('checkbox',{name:'Include chart context'}).isChecked(),false);
  assert.equal(await panel.getByRole('button',{name:'Show sample report'}).count(),0);
  await panel.getByRole('checkbox',{name:'Include chart context'}).check();
  await panel.getByRole('button',{name:'Show sample report'}).click();
  const report=panel.locator('[data-ai-workspace-report]');await report.waitFor();
  assert.match(await report.textContent(),/Synthetic fixture/);assert.match(await report.textContent(),/Last closed price119/);
  await panel.getByRole('checkbox',{name:'Include chart context'}).uncheck();
  assert.equal(await report.count(),0);
  await panel.getByRole('checkbox',{name:'Include chart context'}).check();
  await panel.getByRole('button',{name:'Explain BOS'}).click();
  assert.equal(await draft.inputValue(),'Explain break of structure (BOS).');
  await panel.getByRole('button',{name:'Your API key',exact:true}).click();
  await panel.getByRole('group',{name:'Preview funding choice'}).getByRole('button',{name:'ACG Credits'}).click();
  assert.equal(await panel.getByRole('button',{name:'ACG Credits',exact:true}).count(),1);
  assert.equal(await panel.getByRole('button',{name:'Send unavailable in preview'}).isDisabled(),true);
  assert.equal(await panel.getByRole('status').textContent(),'Preview only. Nothing is sent to an AI provider. No orders or credits are affected.');
  await panel.getByRole('button',{name:'New chat draft'}).click();
  assert.equal(await draft.inputValue(),'');
  return panel;
}
try{
  for(const width of [1024,1440,1920]){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=base+'/v4-positions-audit.html?public_review=1&acg_v4_audit=1';
    await page.goto(url);
    await page.locator('.acg-desktop-v3.acg-unified-shell').waitFor();
    assert.equal(await page.getByRole('button',{name:'Open ACG AI preview'}).count(),0);
    await page.goto(url+'&acg_ai_preview=1');
    const trigger=page.getByRole('button',{name:'Open ACG AI preview'});
    await trigger.click();
    const panel=await assertDraft(page);
    const bounds=await panel.boundingBox();assert.ok(bounds.width>=300&&bounds.x+bounds.width<=width+1);
    assert.ok(await page.locator('.acg-desktop-dock-shell').isVisible());
    await page.screenshot({path:'artifacts/ai-desktop-'+width+'.png'});
    await panel.getByRole('button',{name:'Close AI assistant'}).click();
    await panel.waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
    await page.close();
  }
  for(const [width,height] of [[360,740],[393,852],[690,360]]){
    const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/mobile-audit-browser.html');
    await page.getByRole('button',{name:'Open terminal menu'}).click();
    assert.equal(await page.getByRole('menuitem',{name:'ACG AI preview'}).count(),0);
    await page.goto(base+'/mobile-audit-browser.html?acg_ai_preview=1');
    const chart=page.locator('[data-audit-fixture-chart]');
    await chart.waitFor();
    const initial=await chart.elementHandle();
    await page.getByRole('button',{name:'Open terminal menu'}).click();
    await page.getByRole('menuitem',{name:'ACG AI preview'}).click();
    assert.equal(await page.locator('dialog[open]').count(),1);
    assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='TEXTAREA'),false);
    const panel=await assertDraft(page);
    const bounds=await panel.boundingBox();assert.ok(bounds.width<=width+1&&bounds.height<=height+1);
    await page.screenshot({path:'artifacts/ai-mobile-'+width+'.png'});
    await panel.getByRole('button',{name:'Back to chart'}).click();
    await panel.waitFor({state:'detached'});
    assert.equal(await initial.evaluate(el=>el.isConnected),true);
    assert.equal(await page.evaluate(()=>window.mobileAuditQA.commands),0);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('PASS native AI preview desktop and mobile geometry, explicit context, labelled report, consent removal, draft, disabled send and chart continuity');
}finally{await browser.close();}
