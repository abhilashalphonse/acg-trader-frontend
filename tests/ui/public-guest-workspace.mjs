import assert from 'node:assert/strict';
import process from 'node:process';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:5197';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5197','--strictPort'],{
 env:{...process.env,VITE_ACG_EXECUTION_V4_ENABLED:'true',VITE_ACG_TRADER_API_BASE:'http://127.0.0.1:65534',
 VITE_ACG_TRADER_WS_URL:'ws://127.0.0.1:65534'},stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let i=0;i<75;i++){
  if(server.exitCode!==null)throw Error('Vite stopped');
  try{if((await fetch(origin+'/acg-landing-v6.html')).ok){ready=true;break;}}catch{}
  await delay(250);
 }
 assert.ok(ready,'Vite serves the landing page');
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
 await mkdir('artifacts',{recursive:true});
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:880},isMobile:width<500,hasTouch:width<500});
  const errors=[],unauthorizedCalls=[],ws=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    const pathname=new URL(request.url()).pathname;
    if(/^\/v1\/(?:market|trading|orders|positions)\//.test(pathname))unauthorizedCalls.push(pathname);
  });
  page.on('websocket',sock=>{
   const url=new URL(sock.url());
   // Vite dev-server HMR is not an ACG market-data subscription.
   if(url.host==='127.0.0.1:5197' && url.pathname==='/')return;
   ws.push(sock.url());
  });
  try{
    await page.goto(origin+'/acg-landing-v6.html',{waitUntil:'domcontentloaded'});
    if(width<500)await page.locator('details.mobile-nav summary').click();
    const nav=width<500?page.locator('.mobile-dropdown'):page.locator('.header-actions');
    await nav.getByRole('link',{name:/Explore Markets/}).click();
    await page.waitForURL('**/terminal');
    const guest=page.locator('[data-acg-guest-workspace="true"]');
    await guest.waitFor({state:'visible',timeout:25000});
    assert.equal(await page.locator('input[type=password]').count(),0);
    assert.equal(await guest.getByText('SAMPLE CHART DATA').count(),1);
    await guest.locator('canvas').first().waitFor({state:'visible',timeout:25000});
    await guest.getByRole('button',{name:'Select market'}).click();
    await guest.getByRole('group',{name:'Select sample instrument'}).getByRole('button',{name:/Gold/}).click();
    await page.waitForFunction(()=>document.title.includes('XAUUSD'));
    await guest.getByRole('button',{name:'1h',exact:true}).click();
    assert.equal(await guest.getByRole('button',{name:'1h',exact:true}).getAttribute('aria-pressed'),'true');
    await guest.getByRole('button',{name:/Indicators/}).click();
    const library=guest.getByRole('complementary',{name:'Indicators'});
    await library.waitFor({state:'visible'});
    await library.getByRole('button',{name:'Add Relative Strength Index'}).click();
    assert.match(await library.locator('.acg-tool-count').textContent(),/2 on chart/);
    if(width===1440){
      // Exercise the actual V6 drawing rail and persisted guest namespace.
      const layer=guest.locator('.acg-guest-chart svg.touch-none').first();
      await layer.waitFor({state:'visible'});
      await guest.getByTitle('Trend line',{exact:true}).first().click();
      const box=await layer.boundingBox();
      assert.ok(box && box.width>380 && box.height>220,'Price-pane drawing surface has room for drag');
      await page.mouse.move(box.x+155,box.y+125);
      await page.mouse.down();
      await page.mouse.move(box.x+350,box.y+220,{steps:12});
      await page.mouse.up();
      await page.waitForFunction(()=>{
        try{return JSON.parse(localStorage.getItem('acg-trader-drawings-v3:GUEST_XAUUSD')||'[]').length>0}
        catch{return false}
      },null,{timeout:15000});
      const isolatedDrawing=await page.evaluate(()=>({
        guest:JSON.parse(localStorage.getItem('acg-trader-drawings-v3:GUEST_XAUUSD')||'[]').length,
        authenticated:localStorage.getItem('acg-trader-drawings-v3:XAUUSD'),
      }));
      assert.ok(isolatedDrawing.guest>0,'Guest created a real drawing');
      assert.equal(isolatedDrawing.authenticated,null,'Guest drawing never writes into signed-in account storage');
    }
    await page.screenshot({path:'artifacts/guest-explore-markets-'+width+'.png',fullPage:true});
    assert.deepEqual(errors,[],'No chart React errors');
    assert.deepEqual(unauthorizedCalls,[],'No privileged market/order requests');
    assert.deepEqual(ws,[],'No trading websocket');
    assert.equal(await guest.locator('[data-acg-gated="demo"]').getAttribute('href'),'/?acg_auth=signup');
    assert.equal(await guest.locator('[data-acg-gated="account"]').getAttribute('href'),'/terminal?acg_connect_prop=1');
  }finally{await page.close();}
 }
 const secure=await browser.newPage();
 try{
  await secure.goto(origin+'/terminal?acg_login=1',{waitUntil:'domcontentloaded'});
  await secure.getByRole('button',{name:'Sign in',exact:true}).waitFor({timeout:25000});
  assert.equal(await secure.locator('[data-acg-guest-workspace]').count(),0);
  await secure.goto(origin+'/terminal?acg_connect_prop=1',{waitUntil:'domcontentloaded'});
  await secure.getByText('Tenant ID / identifier').waitFor({timeout:25000});
  assert.equal(await secure.locator('[data-acg-guest-workspace]').count(),0);
 }finally{await secure.close();}
 console.log('PUBLIC_GUEST_ACCEPTANCE_PASS');
}finally{await browser?.close();server.kill('SIGTERM');}
