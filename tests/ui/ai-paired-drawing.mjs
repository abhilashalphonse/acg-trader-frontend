import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Isolated runner only. The backend writes this private ephemeral fixture
// after seeding its real MongoDB candles and authenticating its staff user.
// Only the chart candle transport is mirrored; every AI response is the
// unmodified real backend HTTP response, including status/grant/draw.
assert.equal(process.env.CI,'true');
assert.ok(process.env.ACG_AI_PAIRED_PRIVATE);
const f=JSON.parse(await readFile(process.env.ACG_AI_PAIRED_PRIVATE,'utf8'));
assert.match(f.root,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(f.timeframe,'1h');
assert.equal(f.step,3600000);
const origin='http://127.0.0.1:5174';
const runtime={runtimeMode:'WORKSPACE_CHAT',token:f.token,sessionId:'b'.repeat(24),accountId:f.accountId};
const market={symbol:f.symbol,displaySymbol:f.symbol,name:'Isolated market',assetClass:'METAL',bid:112.99,ask:113.01,price:113,tickSize:.01,pipSize:.1,contractSize:100,defaultLeverage:50,marketState:'LIVE',sessionOpen:true,isStale:false,marketDataAvailable:true};
const candles=f.rows.map(([open,high,low,close],i)=>({time:(f.end-(f.rows.length-i)*f.step)/1000,open,high,low,close,complete:true,synthetic:false,stateVersion:1}));
const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
let stage='startup';
try{
 for(const mobile of [false,true]){
  stage=mobile?'mobile startup':'desktop startup';
  const context=await browser.newContext({viewport:mobile?{width:393,height:852}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'no-preference'});
  const page=await context.newPage();
  const receipts=[],calls=[],unexpected=[],errors=[];
  page.on('pageerror',()=>errors.push('page error'));
  await page.addInitScript(({runtime,market})=>{
   window.__acgPairedDrawingFixture=Object.freeze({runtime,market});
   localStorage.setItem('acg-trader-terminal-prefs-v1',JSON.stringify({timeframe:'1H'}));
  },{runtime,market});
  await page.route('http://127.0.0.1:65534/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   const json=(value,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(value)});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(path==='/v1/auth/refresh'&&req.method()==='POST')return json({error:{code:'UNAUTHENTICATED'}},401);
   if(path==='/v1/market/candles'&&req.method()==='GET'){
    if(url.searchParams.get('symbol')!==f.symbol||url.searchParams.get('timeframe')!=='1h'||url.searchParams.has('before'))return json({candles:[],pagination:{hasMore:false}});
    return json({candles,pagination:{hasMore:false}});
   }
   if(req.method()==='POST'&&['/v1/ai/pilot/status','/v1/ai/pilot/grant','/v1/ai/pilot/draw'].includes(path)){
    const b=req.postDataJSON();
    if(req.headers().authorization!=='Bearer '+f.token||b.accountId!==f.accountId||b.symbol!==f.symbol||b.timeframe!==f.timeframe){unexpected.push('scope');return json({},403);}
    calls.push(path.split('/').at(-1));
    if(path.endsWith('/draw')&&(b.latestClosedAtMs!==f.end||Object.hasOwn(b,'geometry')||Object.hasOwn(b,'price'))){unexpected.push('draw scope');return json({},400);}
    const response=await fetch(f.root+path,{method:'POST',headers:{authorization:req.headers().authorization,'content-type':'application/json'},body:req.postData()});
    const body=await response.text();
    if(path.endsWith('/draw')&&response.ok)receipts.push(JSON.parse(body));
    // Forward byte-for-byte, not a synthetic receipt or substituted geometry.
    return route.fulfill({status:response.status,headers,contentType:'application/json',body});
   }
   if(req.method()!=='GET'){unexpected.push('unexpected write');return json({},403);}
   return json({});
  });
  await page.goto(origin+(mobile?'/mobile-audit-browser.html?agent_drawing_review=1':'/v4-positions-audit.html?public_review=1&acg_v4_audit=1&acg_ai_preview=1&agent_drawing_review=1'));
  if(mobile){
   await page.getByRole('button',{name:'Open terminal menu'}).click();
   await page.getByRole('menuitem',{name:'ACG AI preview'}).click();
  }else await page.getByRole('button',{name:'Open ACG AI preview'}).click();
  const panel=page.locator(mobile?'[data-mobile-ai-inline]':'[data-ai-chat-preview]');
  const input=panel.getByRole('textbox',{name:'Message ACG AI'}),send=panel.getByRole('button',{name:'Send message'});
  const cursor=page.locator('.acg-agent-cursor.is-visible .acg-agent-cursor-image');
  const read=()=>page.evaluate(symbol=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:'+symbol)||'[]'),f.symbol);
  stage=(mobile?'mobile':'desktop')+' real receipt';
  await input.fill('Mark liquidity then draw FVGs');
  await send.click();
  await cursor.waitFor({state:'visible',timeout:15000});
  await panel.getByText(/Marked \d+ liquidity\/FVG drawing/).waitFor({timeout:15000});
  const stored=await read();
  assert.equal(receipts.length,1);
  const receipt=receipts[0];
  assert.equal(receipt.state,'DRAWING_READY');assert.equal(receipt.executionAllowed,false);
  assert.equal(receipt.receipt.context.latestClosedAtMs,f.end);
  assert.equal(stored.length,receipt.receipt.actions.length);
  assert.ok(stored.some(d=>d.type==='hline')&&stored.some(d=>d.type==='rectangle'));
  for(const [i,a] of receipt.receipt.actions.entries()){
   const d=stored[i],g=a.geometry;
   assert.equal(d.id,'ai-'+a.sourceId);assert.equal(d.sourceId,a.sourceId);assert.equal(d.actionId,receipt.actionId);
   assert.equal(d.type,g.type);
   if(g.type==='hline'){assert.deepEqual(d.a,{time:g.time,price:g.price});}
   else{assert.deepEqual(d.a,{time:g.fromTime,price:g.upper});assert.deepEqual(d.b,{time:g.toTime,price:g.lower});}
  }
  assert.ok(receipt.receipt.actions.some(a=>a.geometry.type==='rectangle'&&a.geometry.lower===104&&a.geometry.upper===109));
  stage=(mobile?'mobile':'desktop')+' native undo';
  await cursor.waitFor({state:'detached'});
  await input.fill('Undo the last AI drawing batch');await send.click();
  await panel.getByText(/Undid the last AI drawing batch/).waitFor();
  assert.deepEqual(await read(),[]);
  assert.deepEqual(calls,['status','grant','draw']);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  await context.close();
  console.log('PASS '+(mobile?'mobile':'desktop')+' real authenticated receipt, exact native geometry and local undo; no provider or trade dispatch');
 }
}catch{
 // No raw browser diagnostics or credential-bearing request details in logs.
 console.error('FAIL paired drawing acceptance at '+stage);
 process.exitCode=1;
}finally{await browser.close();}
