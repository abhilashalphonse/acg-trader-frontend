import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// Full mounted desktop UI, real chart transform, native drawing store and
// actual animated cursor. The chart receives historical fixture candles;
// status/grant are the only allowed AI HTTP writes.
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
await mkdir('artifacts',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
 const errors=[],unexpectedWrites=[];
 page.on('pageerror',e=>errors.push(e.message));
 let revision=0,mode='normal',holdReady=null,releaseHeld=null;
 const fixtureClock=Date.now();
 const origin='http://127.0.0.1:5174';
 const common={contractVersion:'restricted-pilot-v1',mode:'WORKSPACE_CHAT',executionAllowed:false};
 const fixturePrices={EURUSD:1.1173,BTCUSD:68101,XAUUSD:3881.77};
 const tfSeconds={'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400,'1w':604800};
 const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(body)});
 await page.route('http://127.0.0.1:65534/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(req.method()==='OPTIONS')return json(route,{},204);
   // The ordinary AuthProvider probes for an existing refresh cookie at boot.
   // This browser fixture has no real session; explicitly deny the probe.
   // Keep every other non-allowlisted write (including trade APIs) forbidden.
   if(path==='/v1/auth/refresh'&&req.method()==='POST')return json(route,{error:{code:'UNAUTHENTICATED'}},401);
   if(path==='/v1/market/candles'&&req.method()==='GET'){
     const tf=url.searchParams.get('timeframe'),step=tfSeconds[tf]||1800;
     const end=Math.floor(fixtureClock/1000/step)*step;
     const price=fixturePrices[url.searchParams.get('symbol')]||1.1173;
     const d=price*.001;
     const rows=[...Array.from({length:90},()=>[103,104,102,103]),[102,104,100,103],[103,105,101,104],[104,105,95,101],[101,104,100,103],[103,106,102,105],[110,112,109,111],[111,114,105,112],[112,113,110,112],[112,113,110,112],[112,113,110,112]];
     const scale=v=>price+d*(v-110)/10;
     const candles=rows.map(([o,h,l,c],i)=>({time:end-(100-i)*step-7*86400,open:scale(o),high:scale(h),low:scale(l),close:scale(c),complete:true,synthetic:false,stateVersion:1}));
     return json(route,{candles,pagination:{hasMore:false}});
   }
   if(path.startsWith('/v1/ai/pilot/')){
     assert.equal(req.headers().authorization,'Bearer synthetic-browser-only');
     const b=req.postDataJSON();
     if(path.endsWith('/status'))return json(route,{...common,model:'gpt-6-luna',revision,chartDrawingEnabled:true});
     if(path.endsWith('/grant')){
       assert.equal(b.expectedRevision,revision);
       if(mode==='pending'){await new Promise(resolve=>{releaseHeld=resolve;holdReady?.();});return json(route,{...common,revision:revision+1}).catch(()=>{});}
       return json(route,{...common,revision:++revision});
     }
     unexpectedWrites.push(path);return json(route,{error:{code:'UNEXPECTED_AI_CALL'}},400);
   }
   if(req.method()!=='GET'){unexpectedWrites.push(path);return json(route,{},403);}
   return json(route,{});
 });

 await page.goto(origin+'/mobile-audit-browser.html?agent_drawing_review=1');
 await page.getByRole('button',{name:'Open terminal menu'}).click();
 await page.getByRole('menuitem',{name:'ACG AI preview'}).click();
 const panel=page.locator('[data-mobile-ai-inline]'),plot=page.locator('.acg-agent-cursor-surface');
 await panel.waitFor();await plot.waitFor();
 const p=await plot.boundingBox(),c=await panel.boundingBox();
 assert.ok(p&&c&&p.height>=150&&p.y+p.height<=c.y+1,'real chart must remain visible above chat');
 assert.equal(await page.locator('[data-acg-mobile-audit-dock]').count(),0);
 const input=panel.getByRole('textbox',{name:'Message ACG AI'}),send=panel.getByRole('button',{name:'Send message'});
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:EURUSD')||'[]'));
 await input.fill('Draw FVGs');await send.click();
 const cursor=page.locator('.acg-agent-cursor.is-visible .acg-agent-cursor-image');
 await cursor.waitFor({state:'visible'});
 await page.screenshot({path:'artifacts/ai-mobile-agent-drawing.png'});
 await panel.getByText(/Marked 1 fair value gap/).waitFor();
 const first=await read();assert.equal(first.length,1);assert.equal(first[0].type,'rectangle');
 await cursor.waitFor({state:'detached'});
 await input.fill('Change AI FVG to blue');await send.click();
 await panel.getByText(/Updated the AI drawing appearance/).waitFor();
 const styled=await read();assert.equal(styled[0].style.color,'#2962FF');
 await cursor.waitFor({state:'detached'});
 await input.fill('Delete AI FVG');await send.click();
 const confirm=panel.getByRole('button',{name:'Confirm deletion',exact:true});
 await confirm.waitFor();assert.deepEqual(await read(),styled);
 await panel.getByRole('button',{name:'Cancel deletion',exact:true}).click();
 await panel.getByText('Deletion cancelled. No drawing was removed.').waitFor();
 assert.deepEqual(await read(),styled);
 await panel.getByRole('button',{name:'Back to chart'}).click();
 await panel.waitFor({state:'detached'});
 await page.locator('[data-acg-mobile-audit-dock]').waitFor({state:'visible'});
 assert.deepEqual(unexpectedWrites,[]);assert.deepEqual(errors,[]);
 console.log('PASS mobile native chart, cursor, appearance, deletion cancellation and restored execution dock; synthetic HTTP only');
 await page.close();
}finally{await browser.close();}
