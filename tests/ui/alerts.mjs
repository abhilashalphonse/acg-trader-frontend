import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.ALERTS_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5174/tests/fixtures/alerts.html');
    await page.getByRole('button',{name:'Open alerts',exact:true}).click();
    await page.getByRole('button',{name:'Create alert',exact:true}).first().click();
    await page.getByLabel('Price',{exact:true}).fill('3250.50');
    await page.getByRole('button',{name:'Create alert',exact:true}).click();
    await page.getByText('Crosses 3250.50',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Edit XAUUSD alert'}).click();
    await page.getByLabel('Condition',{exact:true}).selectOption('enters_range');
    await page.getByLabel('Lower price').fill('3240');await page.getByLabel('Upper price').fill('3260');
    await page.getByRole('button',{name:'Save changes'}).click();
    await page.getByText('Enters range 3240 - 3260',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Pause or restart alert'}).click();
    await page.getByText('paused',{exact:true}).waitFor();
    await page.screenshot({path:'alerts-'+viewport.width+'.png'});
    const rect=await page.getByRole('dialog').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=viewport.width);
    await page.getByRole('button',{name:'Resume alert'}).click();
    await page.getByRole('button',{name:'Delete XAUUSD alert'}).click();
    await page.getByText('Your next move, on watch').waitFor();
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: desktop and mobile alert create/edit/pause/resume/delete and dialog sizing');
}finally{await browser.close();}
