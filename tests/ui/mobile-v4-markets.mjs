import assert from 'node:assert/strict';
import process from 'node:process';
import {spawn} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright';

const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4187','--strictPort'],{stdio:'ignore'});
const origin='http://127.0.0.1:4187';
const entry=`import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import Markets from '/src/components/trading-v2/MobileInstrumentSheet.jsx';
import '/src/index.css';import '/src/styles/acg-pure-black.css';import '/src/styles/mobileAuditSurfaces.css';
const base={marketDataAvailable:true,bid:100,ask:101,last:100,live:true,sessionOpen:true};
const rows=(prefix,count,assetClass,extra={})=>Array.from({length:count},(_,i)=>({...base,symbol:prefix+String(i).padStart(3,'0'),name:prefix+' instrument '+i,assetClass,...extra}));
const markets=[...rows('FX',130,'FOREX').map((row,i)=>i===129?{...row,timezone:'Asia/Kolkata'}:row),...rows('US',75,'EQUITY',{listingCountry:'US'}),...rows('IN',75,'EQUITY',{timezone:'Asia/Kolkata'}),...rows('METAL',1,'METAL'),...rows('OIL',1,'ENERGY'),...rows('BTC',1,'CRYPTO')];
window.marketQA={subscriptions:[],selected:null};
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Markets,{auditMobile:!location.search.includes('legacy'),markets,watchlists:{activeSymbols:['IN074','US074']},onViewportQuoteSymbolsChange:s=>window.marketQA.subscriptions=s,onSelectSymbol:s=>window.marketQA.selected=s}));`;
let browser,checks=0;
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const ok=(v,message)=>{assert.ok(v,message);checks++;};
try {
  for(let i=0;i<80;i++){try{if((await fetch(origin+'/mobile-audit-browser.html')).ok)break;}catch{}await wait(200);}
  browser=await chromium.launch({headless:true,channel:'chrome'});
  for(const [width,height] of [[360,740],[393,852],[430,932],[690,360]]) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/src/mobileAuditBrowserMain.jsx',route=>route.fulfill({contentType:'text/javascript',body:entry}));
    await page.goto(origin+'/mobile-audit-browser.html');
    const categories=page.getByRole('group',{name:'Market categories'});
    await categories.waitFor();
    eq(await categories.getByRole('button',{name:'India',exact:true}).count(),0,'India is not a top-level category');
    for(const label of ['All','Forex','Metals','Commodities','Stocks','Crypto']) {
      const box=await categories.getByRole('button',{name:label,exact:true}).boundingBox();
      ok(box.x>=0&&box.x+box.width<=width&&box.y+box.height<=height,`${label} is visible without sideways scrolling`);
    }
    eq(await page.evaluate(()=>document.activeElement?.tagName==='INPUT'),false,'Markets opens without a keyboard');
    const list=page.locator('[data-mobile-market-list]');
    eq(await page.locator('[data-mobile-market-symbol]').count(),60,'large list starts with bounded rows');
    const box=await list.boundingBox();
    const cdp=await page.context().newCDPSession(page);
    const x=Math.round(box.x+box.width/2),bottom=Math.round(box.y+box.height-15),top=Math.round(box.y+15);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:bottom}]});
    for(let step=1;step<=8;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:bottom-(bottom-top)*step/8}]});await wait(15);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>document.querySelector('[data-mobile-market-list]').scrollTop>0);
    checks++;
    for(let i=0;i<5;i++){await list.evaluate(el=>el.scrollTo({top:el.scrollHeight}));await wait(100);}
    eq(await page.locator('[data-mobile-market-symbol]').count(),130,'scrolling reaches rows beyond the initial 60');
    await page.waitForFunction(()=>window.marketQA.subscriptions.includes('FX129'));
    checks++;
    await categories.getByRole('button',{name:'Stocks',exact:true}).click();
    eq(await list.evaluate(el=>el.scrollTop),0,'changing category resets the list to its top');
    const countries=page.getByRole('group',{name:'Stock listing country'});
    eq(await countries.getByRole('button',{name:'US',exact:true}).getAttribute('aria-pressed'),'true','Stocks defaults to US like desktop');
    eq(await page.locator('[data-mobile-market-symbol^="IN"]').count(),0,'US excludes Indian shares');
    await countries.getByRole('button',{name:'India',exact:true}).click();
    eq(await page.locator('[data-mobile-market-symbol^="US"]').count(),0,'India excludes US shares');
    for(let i=0;i<3;i++){await list.evaluate(el=>el.scrollTo({top:el.scrollHeight}));await wait(100);}
    eq(await page.locator('[data-mobile-market-symbol="IN074"]').count(),1,'last Indian share is reachable');
    await page.getByRole('textbox').fill('US074');
    eq(await page.locator('[data-mobile-market-symbol]').count(),1,'search finds instruments across country filters');
    await page.locator('[data-mobile-market-symbol="US074"]').getByRole('button').first().click();
    eq(await page.evaluate(()=>window.marketQA.selected),'US074','search result opens its actual chart');
    await page.getByRole('textbox').fill('');
    await page.getByRole('button',{name:'Watchlist',exact:true}).click();
    eq(await page.locator('[data-mobile-market-symbol="IN074"]').count(),1,'watchlist respects India selection');
    await countries.getByRole('button',{name:'US',exact:true}).click();
    eq(await page.locator('[data-mobile-market-symbol="US074"]').count(),1,'watchlist respects US selection');
    await page.getByRole('button',{name:'Markets',exact:true}).click();
    await categories.getByRole('button',{name:'All',exact:true}).click();
    for(let i=0;i<8;i++){await list.evaluate(el=>el.scrollTo({top:el.scrollHeight}));await wait(100);}
    eq(await page.locator('[data-mobile-market-symbol]').count(),283,'All can load the complete mixed catalog');
    eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page has no horizontal overflow');
    eq(errors.length,0,'no runtime errors');
    if(width===393){await categories.getByRole('button',{name:'Stocks',exact:true}).click();await countries.getByRole('button',{name:'India',exact:true}).click();await page.screenshot({path:'artifacts/mobile-v4-markets-india.png'});}
    await page.goto(origin+'/mobile-audit-browser.html?legacy=1');
    await page.getByRole('group',{name:'Market categories'}).getByRole('button',{name:'India',exact:true}).waitFor();checks++;
    eq(await page.getByRole('group',{name:'Stock listing country'}).count(),0,'legacy mobile retains its existing categories');
    await page.close();
  }
  console.log('MOBILE_V4_MARKETS_PASS',checks);
} finally {await browser?.close();server.kill();}
