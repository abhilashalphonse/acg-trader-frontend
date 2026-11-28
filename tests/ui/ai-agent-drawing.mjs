import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// Full mounted desktop UI, real chart transform, native drawing store and
// actual animated cursor. HTTP receipts are controlled synthetic fixtures;
// real authentication and detector acceptance are exercised in backend CI.
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
await mkdir('artifacts',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
 const errors=[],drawRequests=[],unexpectedWrites=[];
 page.on('pageerror',e=>errors.push(e.message));
 let revision=0,mode='normal',latest=0,chartTf=null;
 const origin='http://127.0.0.1:5174';
 const common={contractVersion:'restricted-pilot-v1',mode:'WORKSPACE_CHAT',executionAllowed:false};
 const fixturePrices={EURUSD:1.1173,BTCUSD:68101,XAUUSD:3881.77};
 const tfSeconds={'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400,'1w':604800};
 const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(body)});
 await page.route('http://127.0.0.1:65534/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(req.method()==='OPTIONS')return json(route,{},204);
   if(path==='/v1/market/candles'){
     const tf=url.searchParams.get('timeframe'),step=tfSeconds[tf]||1800;
     const end=Math.floor(Date.now()/1000/step)*step;
     const price=fixturePrices[url.searchParams.get('symbol')]||1.1173;
     const d=price*.001;
     latest=end*1000;chartTf=tf;
     const candles=Array.from({length:100},(_,i)=>({time:end-(100-i)*step,open:price+Math.sin(i/4)*d,high:price+Math.sin(i/4)*d+d*.35,low:price+Math.sin(i/4)*d-d*.35,close:price+Math.sin(i/4)*d+d*.1,complete:true,synthetic:false,stateVersion:1}));
     return json(route,{candles,pagination:{hasMore:false}});
   }
   if(path.startsWith('/v1/ai/pilot/')){
     assert.equal(req.headers().authorization,'Bearer synthetic-browser-only');
     const b=req.postDataJSON();
     if(path.endsWith('/status'))return json(route,{...common,model:'gpt-6-luna',revision,chartDrawingEnabled:true});
     if(path.endsWith('/grant')){assert.equal(b.expectedRevision,revision);return json(route,{...common,revision:++revision});}
     if(path.endsWith('/draw')){
       drawRequests.push(b);
       assert.equal(b.latestClosedAtMs,latest);
       assert.equal(b.timeframe,chartTf);
       assert.ok(!Object.hasOwn(b,'price')&&!Object.hasOwn(b,'geometry'));
       const step=tfSeconds[b.timeframe],time=b.latestClosedAtMs/1000,price=fixturePrices[b.symbol],d=price*.001;
       const id=n=>'draw_'+String(n).repeat(32);
       const make=(n,geometry)=>({sourceId:id(n),drawingKey:id(n),sourceTimeframe:b.timeframe,geometry});
       let actions=b.command==='LIQUIDITY'?[make(1,{type:'hline',time:time-8*step,price:price+d*.15}),make(2,{type:'hline',time:time-4*step,price:price-d*.15})]:[make(3,{type:'rectangle',fromTime:time-8*step,toTime:time-step,lower:price-d*.25,upper:price+d*.25})];
       if(mode==='stop')actions=Array.from({length:6},(_,i)=>make(i+3,{type:'rectangle',fromTime:time-(12-i)*step,toTime:time-step,lower:price-d*.25,upper:price+d*.25}));
       const receipt={contractVersion:'chart-drawing-candidates-v1',actionId:b.actionId,context:{symbol:b.symbol,timeframe:b.timeframe,chartContextVersion:b.chartContextVersion,latestClosedAtMs:b.latestClosedAtMs,expiresAtMs:Date.now()+9000},actions};
       if(mode==='mismatch')receipt.context.chartContextVersion='f'.repeat(64);
       return json(route,{...common,state:'DRAWING_READY',actionId:b.actionId,workspace:{symbol:b.symbol,timeframe:b.timeframe},receipt});
     }
     unexpectedWrites.push(path);return json(route,{error:{code:'UNEXPECTED_AI_CALL'}},400);
   }
   if(req.method()!=='GET'){unexpectedWrites.push(path);return json(route,{},403);}
   return json(route,{});
 });
 await page.goto(origin+'/v4-positions-audit.html?public_review=1&acg_v4_audit=1&acg_ai_preview=1&agent_drawing_review=1');
 await page.getByRole('button',{name:'Open ACG AI preview'}).click();
 const panel=page.locator('[data-ai-chat-preview]');
 await panel.getByRole('textbox',{name:'Message ACG AI'}).waitFor();
 const input=panel.getByRole('textbox',{name:'Message ACG AI'});
 const send=panel.getByRole('button',{name:'Send message'});
 const cursor=page.locator('.acg-agent-cursor.is-visible');
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:EURUSD')||'[]'));
 await page.waitForFunction(()=>document.querySelector('.acg-agent-cursor-surface')!==null);
 // Wait for chart history (the fixture never contacts a live provider).
 await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('/v1/market/candles')));
 await page.waitForFunction(()=>!document.querySelector('[data-ai-chat-preview] button[aria-label="Send message"]')?.disabled||document.querySelector('.acg-agent-cursor-surface')!==null);
 await page.waitForTimeout(350);
 await input.fill('Mark significant liquidity levels');await send.click();
 await panel.getByText(/Marked 2 liquidity level/).waitFor();
 assert.equal(drawRequests.length,1);assert.equal(drawRequests[0].command,'LIQUIDITY');
 const first=await read();assert.equal(first.length,2);assert.ok(first.every(d=>d.createdBy==='ai'&&d.type==='hline'&&!d.locked));
 await input.fill('Draw FVGs');
 await send.click();
 await cursor.waitFor({state:'visible'});
 await page.screenshot({path:'artifacts/ai-agent-drawing.png'});
 await panel.getByText(/Marked 1 fair value gap/).waitFor();
 const second=await read();assert.equal(second.length,3);assert.equal(second[2].type,'rectangle');
 assert.equal(second[2].actionId,drawRequests[1].actionId);
 // Native chart undo, not a mock store.
 await input.evaluate(el=>el.blur());await page.keyboard.press('Control+z');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:EURUSD')||'[]').length===2);
 assert.deepEqual(await read(),first);
 // Reject a final receipt whose context token differs.
 mode='mismatch';await input.fill('Draw FVGs');await send.click();
 await panel.getByText('Drawing response could not be verified. No drawings applied.').waitFor();
 assert.deepEqual(await read(),first);
 // Stop during real cursor movement: the batch must not commit.
 mode='stop';await input.fill('Draw FVGs');await send.click();
 await cursor.waitFor({state:'visible'});
 await panel.getByRole('button',{name:'Stop response'}).click();
 await panel.getByText(/Response stopped/).waitFor();
 assert.deepEqual(await read(),first);
 assert.deepEqual(unexpectedWrites,[]);assert.deepEqual(errors,[]);
 console.log('PASS mounted desktop chat, native chart anchors, gradient cursor, actual drawing store, batch undo, stale receipt and Stop; synthetic HTTP only');
 await page.close();
}finally{await browser.close();}
