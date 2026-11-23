import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir} from 'node:fs/promises';
import process from 'node:process';
import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});
const port=5187,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{env:{...process.env,VITE_ACG_EXECUTION_V4_ENABLED:'true'},stdio:'ignore'});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/tests/fixtures/alerts.html')).ok){ready=true;break;}}catch{}await delay(300);}
  assert.ok(ready);
  for(const dark of [false,true]){
    const page=await browser.newPage({viewport:{width:1180,height:760}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/tests/fixtures/alerts.html?chartAlerts=1');
    const layer=page.locator('[data-chart-alerts-layer]'),tag=page.locator('[data-chart-alert-tag="chart-alert:level"]');
    await tag.waitFor({state:'attached'});
    if(dark){await page.getByRole('button',{name:'Switch chart theme'}).click();await page.waitForFunction(()=>document.querySelector('[data-chart-alerts-layer]')?.dataset.theme==='dark');await tag.waitFor({state:'attached'});}
    assert.equal(await layer.getAttribute('data-theme'),dark?'dark':'light');
    let rect=await tag.boundingBox(),surface=await layer.boundingBox();
    await page.mouse.move(60,rect.y+rect.height/2);
    await page.waitForFunction(()=>document.querySelector('[data-chart-alert-tag]')?.classList.contains('is-active'));
    assert.match(await tag.innerText(),/EURUSD · Crossing · 1.10040/);
    assert.equal(await tag.evaluate(el=>getComputedStyle(el).opacity),'1');
    await page.screenshot({path:'artifacts/alerts-chart-hover-'+(dark?'dark':'light')+'.png'});
    const drag=tag.getByRole('button',{name:'Move EURUSD alert level'});
    const grip=await drag.boundingBox();
    await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
    await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2+35,{steps:5});await page.mouse.up();
    await page.waitForFunction(()=>document.querySelector('[aria-label="Alert write count"]').textContent==='1');
    await page.waitForFunction(()=>!document.querySelector('[data-chart-alert-tag]')?.textContent.includes('Saving'));
    assert.ok(!(await tag.innerText()).includes('1.10040'),'Drop persists the new threshold');
    await tag.getByRole('button',{name:/^Edit EURUSD/}).focus();
    await tag.getByRole('button',{name:/^Edit EURUSD/}).click();
    const editor=page.getByRole('dialog',{name:'Edit alert',exact:true});
    assert.equal(await editor.getByLabel('Price source').inputValue(),'bid');
    await editor.getByRole('tab',{name:'Notifications'}).click();
    assert.equal(await editor.getByLabel('Play sound',{exact:true}).isChecked(),false);
    await editor.getByRole('button',{name:'Cancel',exact:true}).click();
    // Escape cancels a local drag without submitting another mutation.
    rect=await tag.boundingBox();await page.mouse.move(60,rect.y+rect.height/2);
    const g=await drag.boundingBox();await page.mouse.move(g.x+g.width/2,g.y+g.height/2);await page.mouse.down();
    await page.mouse.move(g.x+g.width/2,g.y+g.height/2+20,{steps:3});await page.keyboard.press('Escape');await page.mouse.up();
    assert.equal(await page.getByLabel('Alert write count').innerText(),'1');
    // A rejected versioned write reverts the local preview and reports failure.
    await page.getByRole('button',{name:'Reject next alert update'}).click();
    rect=await tag.boundingBox();await page.mouse.move(60,rect.y+rect.height/2);
    const original=await tag.innerText(),g2=await drag.boundingBox();
    await page.mouse.move(g2.x+g2.width/2,g2.y+g2.height/2);await page.mouse.down();
    await page.mouse.move(g2.x+g2.width/2,g2.y+g2.height/2+25,{steps:3});await page.mouse.up();
    await page.getByRole('alert').filter({hasText:'Could not confirm the alert update'}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('[data-chart-alert-tag]')?.textContent.includes('Saving'));
    assert.equal(await tag.innerText(),original);
    await page.getByRole('alert').filter({hasText:'Could not confirm the alert update'}).waitFor({state:'hidden'});
    // Price label stays transparent to native scale dragging.
    surface=await layer.boundingBox();
    const width=Number(await layer.getAttribute('data-plot-width'));
    const beforeScale=(await tag.boundingBox()).y;
    await page.mouse.move(surface.x+width+28,surface.y+300);
    await page.mouse.down();await page.mouse.move(surface.x+width+28,surface.y+380,{steps:8});await page.mouse.up();
    await page.waitForFunction(y=>Math.abs(document.querySelector('[data-chart-alert-tag]').getBoundingClientRect().y-y)>1,beforeScale);
    assert.equal(await page.getByLabel('Alert write count').innerText(),'2','Scaling does not submit alert writes');
    assert.equal(await page.getByRole('dialog').count(),0,'Scaling does not open an editor');
    // Only the small + is interactive; the attached price label passes pointer input to the chart.
    await page.mouse.move(surface.x+width-5,surface.y+170);
    const plus=page.getByRole('button',{name:/^Add alert at /});await plus.waitFor();
    const axisGroup=page.locator('.acg-chart-alert-axis-add');
    const price=await axisGroup.locator('.acg-chart-alert-axis-price').innerText();
    assert.match(price,/^[0-9]+[.][0-9]{5}$/);
    const axis=await axisGroup.boundingBox();
    assert.ok(Math.abs(axis.y+axis.height/2-(surface.y+170))<2);
    assert.equal(await axisGroup.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    assert.equal(await plus.evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
    assert.ok((await plus.boundingBox()).width<=24,'Only the narrow icon strip captures input');
    await page.screenshot({path:'artifacts/alerts-chart-axis-'+(dark?'dark':'light')+'.png'});
    await page.mouse.move(surface.x+100,surface.y+240);
    await page.waitForFunction(()=>!document.querySelector('.acg-chart-alert-axis-add'));
    await page.mouse.move(surface.x+width-5,surface.y+170);await plus.waitFor();
    const selected=await axisGroup.locator('.acg-chart-alert-axis-price').innerText();
    const chartBefore=await layer.boundingBox();
    await plus.click();
    assert.equal(await page.getByRole('menu',{name:'Chart alert actions'}).count(),0,'Plus opens editor directly');
    const create=page.getByRole('dialog',{name:'Create alert',exact:true});await create.waitFor();
    assert.equal(await create.getByLabel('Price',{exact:true}).inputValue(),selected);
    assert.equal(await create.getByLabel('Instrument',{exact:true}).inputValue(),'EURUSD');
    const chartAfter=await layer.boundingBox();
    assert.equal(chartAfter.width,chartBefore.width,'Opening editor preserves chart width');
    assert.equal(chartAfter.height,chartBefore.height,'Opening editor preserves chart height');
    assert.equal(await page.getByLabel('Panel opens').innerText(),'0','Editor never opens the side panel underneath');
    const settings=create.getByRole('tabpanel',{name:'Alert settings'});
    assert.equal(await settings.evaluate(el=>el.scrollHeight>el.clientHeight),false,'Core settings fit without scrolling');
    assert.ok((await create.boundingBox()).height<540,'Default editor has a compact height');
    await page.screenshot({path:'artifacts/alerts-chart-create-'+(dark?'dark':'light')+'.png'});
    await create.getByRole('button',{name:'Cancel',exact:true}).click();
    const menu=page.getByRole('menu',{name:'Chart alert actions'});
    await page.mouse.click(surface.x+100,surface.y+220,{button:'right'});
    await menu.waitFor();
    const contextPrice=await menu.locator('.acg-chart-alert-context-heading strong').innerText();
    await page.screenshot({path:'artifacts/alerts-chart-context-'+(dark?'dark':'light')+'.png'});
    await menu.getByRole('menuitem',{name:/^Add alert on EURUSD at /}).click();
    await create.waitFor();
    assert.equal(await create.getByLabel('Price',{exact:true}).inputValue(),contextPrice,'Context menu preserves the captured price');
    await create.getByRole('button',{name:'Create alert',exact:true}).click();
    await create.waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.querySelectorAll('[data-chart-alert-tag]').length===2);
    // Keep the original rule selected for the direct management regression.
    await page.mouse.click(surface.x+100,surface.y+220,{button:'right'});
    await menu.waitFor();await page.keyboard.press('Escape');assert.equal(await menu.count(),0);
    // Versioned pause/delete controls operate directly on the hovered chart tag.
    rect=await tag.boundingBox();await page.mouse.move(60,rect.y+rect.height/2);
    await tag.getByRole('button',{name:dark?'Pause EURUSD chart alert':'Delete EURUSD chart alert'}).click();
    await tag.waitFor({state:'detached'});
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: light/dark chart alert labels, versioned drag, Escape, rejected-write recovery, axis creation and pause/delete');
}finally{await browser.close();server.kill('SIGTERM');}
