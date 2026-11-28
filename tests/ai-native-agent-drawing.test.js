import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAgentDrawingExecutor} from '../src/components/ai/nativeAgentDrawingExecutor.js';
import {getDrawingSnapshot,commitDrawings,undoDrawings,patchDrawing,subscribeDrawings} from '../src/utils/drawingStore.js';
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

test('exact receipt replay returns already applied without committing twice; changed receipt fails closed',async()=>{
 const f=fixture('AGENTREPLAY1'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 const snapshot=getDrawingSnapshot(symbol);
 assert.equal((await f.e.execute(f)).state,'ALREADY_APPLIED');
 assert.equal(getDrawingSnapshot(symbol),snapshot);
 const modified=structuredClone(f.receipt);modified.actions[0].geometry.price=101;
 assert.equal((await f.e.execute({...f,receipt:modified})).state,'DENIED');
 assert.equal(getDrawingSnapshot(symbol),snapshot);
});
test('cursor exception before commit produces a definite no-write outcome',async()=>{
 const f=fixture('AGENTRECOVER1'),symbol=f.request.workspace.symbol;
 f.cursor.move=async()=>{throw Error('visual failure');};
 const before=getDrawingSnapshot(symbol);
 assert.equal((await f.e.execute(f)).state,'FAILED_NO_COMMIT');
 assert.equal(getDrawingSnapshot(symbol),before);
});
test('listener exception after a fully verified commit and undo does not falsely report failure',async()=>{
 const f=fixture('AGENTRECOVER2'),symbol=f.request.workspace.symbol;
 const before=getDrawingSnapshot(symbol);
 const unsubscribe=subscribeDrawings(symbol,()=>{throw Error('listener failed');});
 try{
  const applied=await f.e.execute(f);assert.equal(applied.state,'VERIFIED');assert.equal(applied.notificationWarning,true);
  const undone=f.e.undoLastBatch();assert.equal(undone.state,'UNDONE');assert.equal(undone.notificationWarning,true);
  assert.deepEqual(getDrawingSnapshot(symbol).present,before.present);
 }finally{unsubscribe();}
});
test('unexpected concurrent mutation during write quarantines symbol even across executor remount',async()=>{
 const f=fixture('AGENTRECOVER3'),symbol=f.request.workspace.symbol;
 const unsubscribe=subscribeDrawings(symbol,()=>{
  unsubscribe();
  commitDrawings(symbol,items=>[...items,{id:'unexpected-manual',type:'hline',a:{time:closed/1000,price:99}}]);
 });
 assert.equal((await f.e.execute(f)).state,'FAILED_UNCERTAIN');
 const after=getDrawingSnapshot(symbol);
 assert.equal(f.e.undoLastBatch().state,'RECOVERY_REQUIRED');
 f.e.dispose();
 const remount=fixture(symbol);
 assert.equal((await remount.e.execute(remount)).state,'RECOVERY_REQUIRED');
 assert.equal(getDrawingSnapshot(symbol),after);
});

test('edit unique verified FVG geometry atomically and undo the edit',async()=>{
 const f=fixture('AGENTEDIT1'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 const before=getDrawingSnapshot(symbol);
 const request={...f.request,drawingRevision:before.revision,actionId:'aabbccdd-1122-4333-8444-556677889901'};
 const edited=await f.e.edit({request,question:'Shorten the AI FVG by 1 candle',selection:null,readSelection:()=>null});
 assert.equal(edited.state,'EDITED');
 const after=getDrawingSnapshot(symbol);
 assert.equal(after.revision,before.revision+1);
 assert.deepEqual(after.present[0],before.present[0]);
 assert.equal(after.present[1].b.time,before.present[1].b.time-300);
 assert.equal(after.present[1].sourceId,before.present[1].sourceId);
 assert.equal(after.present[1].aiGeometryAdjusted,true);
 assert.equal(f.e.undoLastBatch().state,'UNDONE');
 assert.deepEqual(getDrawingSnapshot(symbol).present,before.present);
});
test('selected AI liquidity edits require exact current selection and unchanged ownership',async()=>{
 const f=fixture('AGENTEDIT2'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 let before=getDrawingSnapshot(symbol);
 const selection={symbol,chartInstanceId:f.request.workspace.chartInstanceId,selectedId:before.present[0].id};
 const request=()=>({...f.request,drawingRevision:getDrawingSnapshot(symbol).revision,actionId:'aabbccdd-1122-4333-8444-556677889902'});
 const edit=(question,selected=selection)=>f.e.edit({request:request(),question,selection:selected,readSelection:()=>selected});
 assert.equal((await edit('Move selected AI liquidity line to 101',{...selection,chartInstanceId:'other'})).state,'NO_TARGET');
 assert.equal((await edit('Move selected AI liquidity line to 101')).state,'EDITED');
 assert.equal(getDrawingSnapshot(symbol).present[0].a.price,101);
 patchDrawing(symbol,selection.selectedId,{style:{color:'#FFFFFF'}});
 before=getDrawingSnapshot(symbol);
 assert.equal((await edit('Move selected AI liquidity line to 102')).state,'PROTECTED_TARGET');
 assert.equal(getDrawingSnapshot(symbol),before);
});
test('edit ambiguity, range and stop leave original drawings intact',async()=>{
 const f=fixture('AGENTEDIT3'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 commitDrawings(symbol,items=>[...items,{id:'manual-hline',type:'hline',a:{time:closed/1000,price:98},timeframeVisibility:'M5'}]);
 const before=getDrawingSnapshot(symbol);
 const request={...f.request,drawingRevision:before.revision,actionId:'aabbccdd-1122-4333-8444-556677889903'};
 const edit=question=>f.e.edit({request,question,selection:null,readSelection:()=>null});
 assert.equal((await edit('Move AI liquidity line to 101')).state,'AMBIGUOUS_TARGET');
 assert.equal((await edit('Extend AI FVG by 1 candle')).state,'OUT_OF_RANGE');
 let release;
 f.cursor.move=()=>new Promise(resolve=>{release=resolve;});
 const pending=edit('Shorten AI FVG by 1 candle');
 f.e.stop();release(false);
 assert.equal((await pending).state,'STOPPED');
 assert.equal(getDrawingSnapshot(symbol),before);
});

test('appearance, annotation label, hide/show and visibility preserve exact geometry and ownership',async()=>{
 const f=fixture('AGENTSTYLE1'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 const baseline=getDrawingSnapshot(symbol).present;
 const edit=question=>f.e.edit({request:{...f.request,drawingRevision:getDrawingSnapshot(symbol).revision,actionId:'aabbccdd-1122-4333-8444-556677889904'},question,selection:null,readSelection:()=>null});
 for(const question of ['Change AI FVG to blue','Make AI FVG dashed','Set AI FVG width to 3px','Set AI FVG opacity to 60%','Label AI FVG as "Demand zone"','Hide AI FVG','Show AI FVG','Show AI FVG on all timeframes']){
  assert.equal((await edit(question)).state,'EDITED',question);
  const current=getDrawingSnapshot(symbol).present;
  assert.deepEqual(current[0],baseline[0]);assert.deepEqual(current[1].a,baseline[1].a);assert.deepEqual(current[1].b,baseline[1].b);assert.equal(current[1].sourceId,baseline[1].sourceId);assert.equal(current[1].aiGeometryAdjusted,undefined);
 }
 const d=getDrawingSnapshot(symbol).present[1];
 assert.equal(d.style.color,'#2962FF');assert.equal(d.style.dash,'dashed');assert.equal(d.style.width,3);assert.equal(d.style.opacity,.6);assert.equal(d.text,'Demand zone');assert.equal(d.hidden,false);assert.equal(d.timeframeVisibility,'all');
 assert.equal(f.e.undoLastBatch().state,'UNDONE');assert.equal(getDrawingSnapshot(symbol).present[1].timeframeVisibility,'M5');
});

test('deletion requires exact single-use preview and restores the native batch with undo',async()=>{
 const f=fixture('AGENTDELETE1'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 const before=getDrawingSnapshot(symbol),request={...f.request,drawingRevision:before.revision,actionId:'aabbccdd-1122-4333-8444-556677889905'};
 const args={request,selection:null,readSelection:()=>null};
 assert.equal((await f.e.edit({...args,question:'Delete AI FVG'})).state,'DENIED');
 const preview=f.e.previewDeletion({question:'Delete AI FVG',selection:null});
 assert.equal(preview.state,'CONFIRM_REQUIRED');assert.equal(getDrawingSnapshot(symbol),before);
 assert.equal((await f.e.confirmDeletion({...args,preview:{...preview}})).state,'STALE');
 assert.equal(getDrawingSnapshot(symbol),before);
 const fresh=f.e.previewDeletion({question:'Delete AI FVG',selection:null});
 assert.equal((await f.e.confirmDeletion({...args,preview:fresh})).state,'DELETED');
 assert.deepEqual(getDrawingSnapshot(symbol).present,[before.present[0]]);
 assert.equal((await f.e.confirmDeletion({...args,preview:fresh})).state,'STALE');
 assert.equal(f.e.undoLastBatch().state,'UNDONE');
 assert.deepEqual(getDrawingSnapshot(symbol).present,before.present);
});
test('deletion preview is cancelled by stop, changed selection or a later manual revision',async()=>{
 const f=fixture('AGENTDELETE2'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 const before=getDrawingSnapshot(symbol),request={...f.request,drawingRevision:before.revision,actionId:'aabbccdd-1122-4333-8444-556677889906'};
 const selection={symbol,chartInstanceId:f.request.workspace.chartInstanceId,selectedId:before.present[1].id};
 const args={request,selection,readSelection:()=>selection};
 let preview=f.e.previewDeletion({question:'Delete selected AI drawing',selection});
 assert.equal(preview.state,'CONFIRM_REQUIRED');
 f.e.stop();assert.equal((await f.e.confirmDeletion({...args,preview})).state,'STALE');
 preview=f.e.previewDeletion({question:'Delete selected AI drawing',selection});
 assert.equal((await f.e.confirmDeletion({...args,preview,selection:null})).state,'STALE');
 preview=f.e.previewDeletion({question:'Delete selected AI drawing',selection});
 patchDrawing(symbol,selection.selectedId,{style:{color:'#FFFFFF'}});
 const changed=getDrawingSnapshot(symbol);
 assert.equal((await f.e.confirmDeletion({...args,preview})).state,'STALE');
 assert.equal(getDrawingSnapshot(symbol),changed);
 assert.equal(f.e.previewDeletion({question:'Delete selected AI drawing',selection}).state,'PROTECTED_TARGET');
});
test('no deletion during interrupted cursor motion',async()=>{
 const f=fixture('AGENTDELETE3'),symbol=f.request.workspace.symbol;
 assert.equal((await f.e.execute(f)).state,'VERIFIED');
 const before=getDrawingSnapshot(symbol),request={...f.request,drawingRevision:before.revision,actionId:'aabbccdd-1122-4333-8444-556677889907'};
 const preview=f.e.previewDeletion({question:'Remove AI FVG',selection:null});
 let resolveMove;f.cursor.move=()=>new Promise(resolve=>{resolveMove=resolve;});
 const running=f.e.confirmDeletion({request,preview,selection:null,readSelection:()=>null});
 f.e.stop();resolveMove(false);
 assert.equal((await running).state,'STOPPED');assert.equal(getDrawingSnapshot(symbol),before);
});
