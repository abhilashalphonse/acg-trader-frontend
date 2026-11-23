import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import process from 'node:process';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const port=5186,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{env:{...process.env,VITE_ACG_EXECUTION_V4_ENABLED:'true'},stdio:'ignore'});
const browser=await chromium.launch({headless:true,...(process.env.ALERTS_CHROME_PATH?{executablePath:process.env.ALERTS_CHROME_PATH}:{}),args:['--no-sandbox']});
try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/tests/fixtures/alerts.html')).ok){ready=true;break;}}catch{}await delay(300);}
  assert.ok(ready,'Vite starts');
  for(const mobile of [false,true]){
    const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
    const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/tests/fixtures/alerts.html'+(mobile?'?mobile=1':''));
    await page.getByRole('button',{name:'Open alerts',exact:true}).click();
    const panel=page.getByRole('region',{name:'Alerts panel'});
    await panel.waitFor();
    if(!mobile){
      assert.equal(await page.locator('.acg-motion-side-panel [data-acg-alert-panel]').count(),1,'Alerts use the real resizable terminal panel');
      assert.equal(await page.getByRole('dialog').count(),0,'Desktop manager is not a modal');
      assert.equal(await page.locator('.acg-alert-backdrop').count(),0);
      await page.getByRole('button',{name:'Markets',exact:true}).click();
      const row=page.locator('[data-market-symbol="EURUSD"]');await row.waitFor();
      await row.click({button:'right'});
      await page.getByRole('menuitem',{name:'Add alert on EURUSD',exact:true}).click();
    }else{
      await panel.getByRole('button',{name:'Close alerts'}).click();
      await page.getByRole('button',{name:'Open watchlist'}).click();
      await page.getByRole('button',{name:'Add alert on EURUSD',exact:true}).click();
    }
    const editor=page.getByRole('dialog',{name:'Create alert',exact:true});await editor.waitFor();
    assert.equal(await editor.getByLabel('Instrument',{exact:true}).inputValue(),'EURUSD');
    await editor.getByLabel('Price',{exact:true}).fill('1.12');
    await editor.getByRole('tab',{name:'Notifications',exact:true}).click();
    await editor.getByLabel('Play sound',{exact:true}).uncheck();
    await editor.getByRole('button',{name:'Create alert',exact:true}).click();
    await panel.getByText('Crosses 1.12',{exact:true}).waitFor();
    await panel.getByRole('button',{name:'Edit EURUSD alert'}).click();
    const edit=page.getByRole('dialog',{name:'Edit alert',exact:true});
    await edit.getByRole('tab',{name:'Notifications',exact:true}).click();
    assert.equal(await edit.getByLabel('Play sound',{exact:true}).isChecked(),false,'Per-alert mute survives saving and reopening');
    await edit.getByRole('tab',{name:'Settings',exact:true}).click();
    await edit.getByLabel('Condition',{exact:true}).selectOption('enters_range');
    await edit.getByLabel('Lower price').fill('1.10');await edit.getByLabel('Upper price').fill('1.13');
    await page.screenshot({path:'artifacts/alerts-editor-'+viewport.width+'.png'});
    const rect=await edit.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=viewport.width&&rect.y>=0&&rect.y+rect.height<=viewport.height+1);
    await edit.getByRole('button',{name:'Save changes'}).click();
    await panel.getByText('Enters range 1.10 – 1.13',{exact:true}).waitFor();
    await panel.getByRole('button',{name:'Pause or restart alert'}).click();await panel.getByText('paused',{exact:true}).waitFor();
    await panel.getByRole('button',{name:'Resume alert'}).click();
    await page.screenshot({path:'artifacts/alerts-panel-'+viewport.width+'.png'});
    if(!mobile){
      const width=(await page.locator('.acg-motion-side-panel').boundingBox()).width;
      await page.getByRole('button',{name:'Markets',exact:true}).click();
      await page.locator('[data-market-symbol="EURUSD"] .acg-watchlist-alert-badge').waitFor();
      assert.equal((await page.locator('.acg-motion-side-panel').boundingBox()).width,width,'Markets and Alerts share panel sizing');
      await page.getByRole('button',{name:'Open alerts',exact:true}).click();
    }
    await panel.getByRole('tab',{name:'Log',exact:true}).click();
    const log=panel.getByRole('tabpanel',{name:'Alert log'});
    assert.equal(await log.locator('article.acg-alert-row').count(),50);
    await panel.getByRole('button',{name:'Load older alerts'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Alert log"] article.acg-alert-row').length===60);
    await panel.getByRole('tab',{name:/^Alerts/}).click();
    await panel.getByRole('button',{name:'Delete EURUSD alert'}).click();
    await panel.getByText('Your next move, on watch').waitFor();
    await panel.getByRole('button',{name:'Close alerts'}).click();assert.equal(await page.locator('[data-acg-alert-panel]').count(),0);
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: real desktop panel, watchlist creation and badge, settings/notifications, saved sound, mobile sheet, lifecycle and paginated log');
}finally{await browser.close();server.kill('SIGTERM');}
