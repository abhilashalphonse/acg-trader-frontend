import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAgentDrawingExecutor} from '../src/components/ai/nativeAgentDrawingExecutor.js';
import {getDrawingSnapshot,commitDrawings,undoDrawings,patchDrawing} from '../src/utils/drawingStore.js';
const clock=1795836601000,closed=1795836600000,version='e'.repeat(64);
const actionId='aabbccdd-1122-4333-8444-556677889900';
function fixture(symbol){
 const workspace={symbol,timeframe:'5m',chartInstanceId:'chart-'+symbol};
 const ctx={enabled:true,workspace,chartContextVersion:version,latestClosedAtMs:closed};
 const request={userRequested:true,complete:true,workspace,actionId,chartContextVersion:version,latestClosedAtMs:closed,drawingRevision:getDrawingSnapshot(symbol).revision};
 const src1='draw_'+'1'.repeat(32),src2='draw_'+'2'.repeat(32);
 const receipt={contractVersion:'chart-drawing-candidates-v1',actionId,context:{symbol,timeframe:'5m',chartContextVersion:version,latestClosedAtMs:closed,expiresAtMs:clock+9000},actions:[
 {sourceId:src1,drawingKey:src1,sourceTimeframe:'5m',geometry:{type:'hline',time:closed/1000-300,price:100}},
 {sourceId:src2,drawingKey:src2,sourceTimeframe:'5m',geometry:{type:'rectangle',fromTime:closed/1000-600,toTime:closed/1000,lower:90,upper:95}}]};
 let active=null;const events=[];const token={};
 const cursor={start:p=>{active=token;events.push(['start',p]);return token;},move:async(t,p)=>{events.push(['move',p]);return active===t;},pulse:t=>{events.push(['pulse']);return active===t;},finish:()=>{active=null;events.push(['finish']);},stop:()=>{active=null;events.push(['stop']);}};
 const coordinateApi={plotSize:()=>({width:400,height:300}),toScreen:p=>({x:100+(p.time-closed/1000)/10,y:200-p.price})};
 const e=createNativeAgentDrawingExecutor({workspace,coordinateApi,cursor,readCurrentContext:()=>ctx,now:()=>clock});
 return {e,ctx,request,receipt,cursor,coordinateApi,events};
}
test('direct user command animates exact native anchors and commits one verified, editable, undoable batch',async()=>{
 const f=fixture('AGENTTESTA'),symbol=f.request.workspace.symbol,before=getDrawingSnapshot(symbol);
 const out=await f.e.execute(f);
 assert.equal(out.state,'VERIFIED');assert.equal(out.count,2);
 assert.deepEqual(f.events.map(x=>x[0]),['start','move','move','move','pulse','finish']);
 const after=getDrawingSnapshot(symbol);
 assert.equal(after.revision,before.revision+1);
 assert.equal(after.present[0].a.price,100);
 assert.equal(after.present[1].b.price,90);
 assert.equal(after.present[1].timeframeVisibility,'M5');
 assert.equal(after.present[0].createdBy,'ai');assert.equal(after.present[0].locked,false);
 assert.equal(undoDrawings(symbol),true);assert.deepEqual(getDrawingSnapshot(symbol).present,before.present);
 assert.equal((await f.e.execute(f)).state,'DENIED');
});
test('new command does not stack or overwrite existing AI drawings, including manual edits',async()=>{
 const f=fixture('AGENTTESTB'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 const drawing=getDrawingSnapshot(symbol).present[0];
 patchDrawing(symbol,drawing.id,{a:{...drawing.a,price:101},b:{...drawing.b,price:101}});
 f.request.actionId='aabbccdd-1122-4333-8444-556677889901';f.receipt.actionId=f.request.actionId;
 f.request.drawingRevision=getDrawingSnapshot(symbol).revision;
 const revision=f.request.drawingRevision;
 assert.equal((await f.e.execute(f)).state,'NO_CHANGES');
 assert.equal(getDrawingSnapshot(symbol).revision,revision);
 assert.equal(getDrawingSnapshot(symbol).present[0].a.price,101);
});
test('malformed, cancelled, stale, non-user and offscreen proposals do not mutate the store',async()=>{
 const f=fixture('AGENTTESTC'),symbol=f.request.workspace.symbol;
 for(const request of [{...f.request,userRequested:false},{...f.request,complete:false},{...f.request,chartContextVersion:'a'.repeat(64)}]){
  assert.equal((await f.e.execute({...f,request})).state,'DENIED');
 }
 const bad=structuredClone(f.receipt);bad.actions[0].geometry.type='order';
 assert.equal((await f.e.execute({...f,receipt:bad})).state,'DENIED');
 const abort=new AbortController();abort.abort();
 assert.equal((await f.e.execute({...f,signal:abort.signal})).state,'DENIED');
 f.coordinateApi.toScreen=()=>({x:-10,y:-10});
 assert.equal((await f.e.execute(f)).state,'OFFSCREEN');
 assert.equal(getDrawingSnapshot(symbol).present.length,0);
});
test('stop during animation and concurrent manual drawing edits prevent partial commits',async()=>{
 const f=fixture('AGENTTESTD'),symbol=f.request.workspace.symbol;
 let resolveMove;
 f.cursor.move=()=>new Promise(resolve=>{resolveMove=resolve;});
 const running=f.e.execute(f);f.e.stop();resolveMove(false);
 assert.equal((await running).state,'STOPPED');assert.equal(getDrawingSnapshot(symbol).present.length,0);
 const second=f.e.execute(f);
 commitDrawings(symbol,[{id:'manual',type:'hline',a:{time:closed/1000,price:99}}]);
 resolveMove(true);
 assert.equal((await second).state,'STALE');
 assert.deepEqual(getDrawingSnapshot(symbol).present.map(x=>x.id),['manual']);
});

test('conversational undo reverses only the verified latest batch',async()=>{
 const f=fixture('AGENTUNDO1'),symbol=f.request.workspace.symbol;
 const manual={id:'manual',type:'hline',a:{time:closed/1000,price:99}};
 commitDrawings(symbol,[manual]);f.request.drawingRevision=getDrawingSnapshot(symbol).revision;
 const baseline=JSON.stringify(getDrawingSnapshot(symbol).present);
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 assert.deepEqual(f.e.undoLastBatch(),{state:'UNDONE',count:2});
 assert.equal(JSON.stringify(getDrawingSnapshot(symbol).present),baseline);
 assert.equal(f.e.undoLastBatch().state,'NO_AI_BATCH');
});
test('conversational undo refuses to overwrite a later manual revision',async()=>{
 const f=fixture('AGENTUNDO2'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 commitDrawings(symbol,current=>[...current,{id:'manual-later',type:'hline',a:{time:closed/1000,price:99}}]);
 const baseline=JSON.stringify(getDrawingSnapshot(symbol).present);
 assert.equal(f.e.undoLastBatch().state,'UNDO_CONFLICT');
 assert.equal(JSON.stringify(getDrawingSnapshot(symbol).present),baseline);
});

test('pan or zoom during choreography invalidates the batch without a write',async()=>{
 const f=fixture('AGENTPAN1'),symbol=f.request.workspace.symbol;
 const original=f.coordinateApi.toScreen;let shift=0;
 f.coordinateApi.toScreen=p=>{const point=original(p);return {...point,x:point.x+shift};};
 f.cursor.move=async()=>{shift=12;return true;};
 const out=await f.e.execute(f);
 assert.equal(out.state,'STALE');assert.equal(getDrawingSnapshot(symbol).present.length,0);
});
