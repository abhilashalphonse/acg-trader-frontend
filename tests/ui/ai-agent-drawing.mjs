import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// Full mounted desktop UI, real chart transform, native drawing store and
// actual animated cursor. The chart receives historical fixture candles;
// status/grant are the only allowed AI HTTP writes.
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
await mkdir('artifacts',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
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
     const rows=[...Array.from({length:90},()=>[103,104,102,103]),[102,104,100,103],[103,105,101,104],[104,105,95,101],[101,104,100,103],[103,106,102,105],[110,112,109,111],[111,114,105,112],[112,113,105,112],[112,113,110,112],[112,113,110,112]];
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
 await page.goto(origin+'/v4-positions-audit.html?public_review=1&acg_v4_audit=1&acg_ai_preview=1&agent_drawing_review=1');
 await page.getByRole('button',{name:'Open ACG AI preview'}).click();
 const panel=page.locator('[data-ai-chat-preview]');
 await panel.getByRole('textbox',{name:'Message ACG AI'}).waitFor();
 const input=panel.getByRole('textbox',{name:'Message ACG AI'});
 const send=panel.getByRole('button',{name:'Send message'});
 // Assert the actual decoded artwork and its intended physical size.
 const cursor=page.locator('.acg-agent-cursor.is-visible .acg-agent-cursor-image');
 const waitForCursor=async()=>{
   await cursor.waitFor({state:'visible'}).catch(async error=>{
     console.error('Cursor layout diagnostic:',await page.locator('.acg-agent-cursor-image').evaluateAll(images=>images.map(img=>{
       const css=getComputedStyle(img),parent=img.parentElement,box=img.getBoundingClientRect();
       return {decoded:img.complete,naturalWidth:img.naturalWidth,width:box.width,height:box.height,display:css.display,visibility:css.visibility,maxWidth:css.maxWidth,parentClass:parent.className,parentWidth:parent.getBoundingClientRect().width,opacity:getComputedStyle(parent).opacity};
     })),await panel.innerText());throw error;
   });
   assert.equal(await cursor.evaluate(img=>img.complete&&img.naturalWidth>0&&Math.abs(img.getBoundingClientRect().height-36)<0.5&&Math.abs(img.getBoundingClientRect().width-30)<0.5),true);
 };
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:EURUSD')||'[]'));
 await page.waitForFunction(()=>document.querySelector('.acg-agent-cursor-surface')!==null);
 // Wait for chart history (the fixture never contacts a live provider).
 await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('/v1/market/candles')));
 await page.waitForFunction(()=>!document.querySelector('[data-ai-chat-preview] button[aria-label="Send message"]')?.disabled||document.querySelector('.acg-agent-cursor-surface')!==null);
 await page.waitForTimeout(350);
 await input.fill('Mark significant liquidity levels');await send.click();
 await panel.getByText(/Marked 2 liquidity level/).waitFor().catch(async error=>{console.error('Drawing fixture diagnostic:',await panel.innerText(),JSON.stringify(errors));throw error;});

 const first=await read();assert.equal(first.length,2);assert.ok(first.every(d=>d.createdBy==='ai'&&d.type==='hline'&&!d.locked));
 // Local recognition uses the native store, not provider output or a new
 // consent grant. A freshly verified batch has two unchanged AI drawings.
 const inspectionRevision=revision;
 await input.fill('List drawings');await send.click();
 await panel.getByText('AI-created and unchanged: 2',{exact:true}).waitFor();
 assert.equal(revision,inspectionRevision);
 assert.deepEqual(await read(),first);
 await input.fill('Which drawing is selected?');await send.click();
 await panel.getByText('No visible drawing is selected on this chart.',{exact:true}).waitFor();
 assert.equal(revision,inspectionRevision);assert.deepEqual(await read(),first);

 await cursor.waitFor({state:'detached'});
 await input.fill('Draw FVGs');
 await send.click();
 await waitForCursor();
 await page.screenshot({path:'artifacts/ai-agent-drawing.png',animations:'allow'});
 await panel.getByText(/Marked 1 fair value gap/).waitFor();
 const second=await read();assert.equal(second.length,3);assert.equal(second[2].type,'rectangle');

 // Edit the unique verified FVG through chat, without new HTTP draw or grant.
 await cursor.waitFor({state:'detached'});
 const editRevision=revision;
 await input.fill('Shorten AI FVG by 2 candles');await send.click();
 await waitForCursor();
 await panel.getByText(/Updated the AI drawing as requested/).waitFor();
 const edited=await read();
 assert.equal(edited.length,second.length);
 assert.deepEqual(edited.slice(0,2),second.slice(0,2));
 assert.equal(edited[2].sourceId,second[2].sourceId);
 assert.equal(edited[2].b.time,second[2].b.time-2*tfSeconds[{'M1':'1m','M5':'5m','M15':'15m','M30':'30m','H1':'1h','H4':'4h','D1':'1d','W1':'1w'}[second[2].sourceTimeframe]||second[2].sourceTimeframe]);
 assert.equal(edited[2].aiGeometryAdjusted,true);
 assert.equal(revision,editRevision);
 await input.fill('Undo the last AI drawing batch');await send.click();
 await panel.getByText('Undid the last AI drawing batch (1 drawings).',{exact:true}).waitFor();
 assert.deepEqual(await read(),second);

 // Native chart undo, not a mock store.
 await input.evaluate(el=>el.blur());await page.keyboard.press('Control+z');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:EURUSD')||'[]').length===2);
 assert.deepEqual(await read(),first);
 // Compound creation preserves existing levels and adds only the missing FVG.
 await input.fill('Mark liquidity then draw FVGs');await send.click();
 await panel.getByText(/Marked 1 liquidity\/FVG drawing/).waitFor();
 const compound=await read();assert.deepEqual(compound.slice(0,2),first);assert.equal(compound.at(-1).type,'rectangle');
 const callsBeforeUndo=revision;
 await input.fill('Undo the last AI drawing batch');await send.click();
 await panel.getByText('Undid the last AI drawing batch (1 drawings).').last().waitFor();
 assert.deepEqual(await read(),first);assert.equal(revision,callsBeforeUndo);
 // Interrupt before receipt arrival via a genuine pointer gesture on the
 // chart. Releasing the held reply must never resurrect the cancelled batch.
 await cursor.waitFor({state:'detached'});
 mode='pending';
 const held=new Promise(resolve=>{holdReady=resolve;});
 await input.fill('Draw FVGs');await send.click();await held;
 const plot=await page.locator('.acg-agent-cursor-surface').boundingBox();
 assert.ok(plot&&plot.width>0&&plot.height>0);
 await page.mouse.click(plot.x+plot.width*.45,plot.y+plot.height*.35);
 await panel.getByText('Drawing stopped: manual chart interaction took priority. No automatic retry.').waitFor();
 releaseHeld();mode='normal';
 await input.fill('Draw FVGs');
 await page.waitForFunction(()=>document.querySelector('[data-ai-chat-preview] button[aria-label="Send message"]')?.disabled===false);
 assert.deepEqual(await read(),first);
 // Stop during real cursor movement: the batch must not commit.
 await cursor.waitFor({state:'detached'});
 await input.fill('Draw FVGs');await send.click();
 await waitForCursor();
 await panel.getByRole('button',{name:'Stop response'}).click();
 await panel.getByText(/Response stopped/).waitFor();
 assert.deepEqual(await read(),first);
 // Start a fresh verified FVG after cancellation and exercise actual SVG labels.
 await cursor.waitFor({state:'detached'});
 mode='normal';await input.fill('Draw FVGs');
 await page.waitForFunction(()=>document.querySelector('[data-ai-chat-preview] button[aria-label="Send message"]')?.disabled===false);
 await send.click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:EURUSD')||'[]').length===3);
 await cursor.waitFor({state:'detached'});
 const appearanceBaseline=await read(),appearanceRevision=revision;
 async function changeAppearance(question,n){
  await input.fill(question);await send.click();
  await panel.getByText(/Updated the AI drawing appearance or visibility as requested/).nth(n-1).waitFor();
  await cursor.waitFor({state:'detached'});
  const stored=await read();assert.equal(stored.length,3);assert.deepEqual(stored.slice(0,2),appearanceBaseline.slice(0,2));
  assert.deepEqual(stored[2].a,appearanceBaseline[2].a);assert.deepEqual(stored[2].b,appearanceBaseline[2].b);
  assert.equal(revision,appearanceRevision);
  return stored[2];
 }
 assert.equal((await changeAppearance('Change AI FVG to blue',1)).style.color,'#2962FF');
 assert.equal((await changeAppearance('Label AI FVG as "Demand zone"',2)).text,'Demand zone');
 const annotation=page.locator('[data-ai-drawing-label="'+appearanceBaseline[2].id+'"]');
 await annotation.waitFor({state:'visible'});assert.equal(await annotation.textContent(),'Demand zone');
 assert.equal((await changeAppearance('Hide AI FVG',3)).hidden,true);await annotation.waitFor({state:'detached'});
 assert.equal((await changeAppearance('Show AI FVG',4)).hidden,false);await annotation.waitFor({state:'visible'});
 assert.equal((await changeAppearance('Show AI FVG on all timeframes',5)).timeframeVisibility,'all');
 await page.screenshot({path:'artifacts/ai-agent-drawing-appearance.png',animations:'allow'});
 // Destructive commands never mutate until the exact inline confirmation.
 const deletionBaseline=await read(),deletionRevision=revision;
 const confirm=panel.getByRole('button',{name:'Confirm deletion',exact:true});
 const cancel=panel.getByRole('button',{name:'Cancel deletion',exact:true});
 await input.fill('Delete AI FVG');await send.click();await confirm.waitFor();
 assert.deepEqual(await read(),deletionBaseline);
 await cancel.click();await panel.getByText('Deletion cancelled. No drawing was removed.').waitFor();
 assert.deepEqual(await read(),deletionBaseline);
 await input.fill('Delete AI FVG');await send.click();await confirm.waitFor();
 // A chart gesture invalidates the pending exact target.
 await page.mouse.click(plot.x+plot.width*.45,plot.y+plot.height*.35);
 await confirm.click();
 await panel.getByText('Deletion stopped or the confirmation is no longer valid. No automatic retry.').waitFor();
 assert.deepEqual(await read(),deletionBaseline);
 await input.fill('Delete AI FVG');await send.click();await confirm.waitFor();
 await confirm.click();await waitForCursor();
 await panel.getByText('Deleted the confirmed AI drawing. You can undo this deletion.').waitFor();
 assert.deepEqual(await read(),deletionBaseline.slice(0,2));
 await input.fill('Undo the last AI drawing batch');await send.click();
 await panel.getByText('Undid the last AI drawing batch (1 drawings).',{exact:true}).last().waitFor();
 assert.deepEqual(await read(),deletionBaseline);
 assert.equal(revision,deletionRevision);


 // Real chart interaction: select an AI line and manually lock/unlock it.
 // Returning to the same geometry must not restore mutation authority.
 await cursor.waitFor({state:'detached'});
 const target=deletionBaseline[1],hit=page.locator('[data-drawing-hit-id="'+target.id+'"]');
 const line=await hit.boundingBox();assert.ok(line&&line.width>0);
 await page.mouse.click(line.x+line.width*.65,line.y+line.height/2);
 const lock=page.getByRole('button',{name:'Lock drawing',exact:true});
 await lock.waitFor({state:'visible'});await lock.click();
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:EURUSD')||'[]').find(d=>d.id===id)?.locked===true,target.id);
 await page.getByRole('button',{name:'Unlock drawing',exact:true}).click();
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('acg-trader-drawings-v3:EURUSD')||'[]').find(d=>d.id===id)?.locked===false,target.id);
 assert.deepEqual(await read(),deletionBaseline);
 await input.fill('Change selected liquidity line to red');await send.click();
 await panel.getByText(/That drawing is manual, locked, or no longer verified/).waitFor();
 assert.deepEqual(await read(),deletionBaseline);
 await input.fill('Delete selected AI drawing');await send.click();
 await panel.getByText('That drawing is protected and cannot be deleted by AI.',{exact:true}).waitFor();
 assert.equal(await confirm.count(),0);assert.deepEqual(await read(),deletionBaseline);
 assert.equal(revision,deletionRevision);
 // Reload preserves drawings, not the page-session ownership capability.
 await page.reload();
 await page.getByRole('button',{name:'Open ACG AI preview'}).click();
 await input.waitFor();
 await input.fill('List drawings');await send.click();
 await panel.getByText('Protected AI-created: 3',{exact:true}).waitFor();
 await panel.getByText('AI-created and unchanged: 0',{exact:true}).waitFor();
 assert.deepEqual(await read(),deletionBaseline);
 await input.fill('Delete AI FVG');await send.click();
 await panel.getByText('That drawing is protected and cannot be deleted by AI.',{exact:true}).waitFor();
 assert.equal(await confirm.count(),0);assert.equal(revision,deletionRevision);
 assert.deepEqual(unexpectedWrites,[]);assert.deepEqual(errors,[]);
 console.log('PASS mounted desktop chat, native chart anchors, gradient cursor, actual drawing store, batch undo, local historical evidence and Stop; no remote draw API');
 await page.close();
}finally{await browser.close();}
