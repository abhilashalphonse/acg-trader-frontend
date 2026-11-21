import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const outcomes=[];
async function run(flag,port){
  const base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],
    { env:{...process.env,VITE_ACG_EXECUTION_V4_ENABLED:flag,
      VITE_ACG_TRADER_API_BASE:'http://127.0.0.1:1',
      VITE_ACG_TRADER_WS_URL:'ws://127.0.0.1:1'},stdio:'ignore' });
  try {
    let online=false;
    for(let i=0;i<40;i++){
      if(child.exitCode!==null)throw new Error('Vite server exited with '+child.exitCode);
      try{const r=await fetch(base+'/tests/fixtures/desktop-runtime.html');if(r.ok){online=true;break;}}catch{}
      await delay(300);
    }
    assert.ok(online,'Fixture Vite server started');
    for (const width of [1280,1440]){
      const page=await browser.newPage({viewport:{width,height:900}});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.stack||e.message));
      page.on('console',m=>{if(m.type()==='error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) errors.push(m.text())});
      await page.goto(base+'/tests/fixtures/desktop-runtime.html',{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(2000);
      const state=await page.evaluate(()=>({
        uiErrors:window.__acgDesktopFixtureErrors||[],
        header:document.querySelector('.acg-desktop-market-strip')?.getAttribute('data-v4-header')??null,
        headerMounted:!!document.querySelector('.acg-desktop-market-strip'),
        chart:!!document.querySelector('.acg-desktop-chart'),
        panels:document.querySelectorAll('[aria-label="Desktop panel dock"]').length,
        body:document.body.innerText.slice(0,350)
      }));
      outcomes.push({flag,width,state,errors:errors.slice(0,5)});
      assert.equal(state.uiErrors.length,0,'Desktop React tree must not throw: '+JSON.stringify(outcomes.at(-1)));
      assert.ok(state.headerMounted,'Desktop header must mount: '+JSON.stringify(outcomes.at(-1)));
      assert.equal(state.header,flag==='true'?'true':null,'V4 flag must select expected desktop variant');
      await page.close();
    }
  }finally{child.kill('SIGTERM');}
}
try {
  await run('false',5194);
  await run('true',5195);
  console.log('DESKTOP_BREAKPOINT_PASS',JSON.stringify(outcomes));
}catch(e){
  console.error('DESKTOP_BREAKPOINT_FAILED',JSON.stringify(outcomes));
  console.error(e);
  process.exitCode=1;
}finally{await browser.close();}
