import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getDrawingSnapshot,commitDrawings,patchDrawing,undoDrawings,subscribeDrawings,replaceDrawingsLive,redoDrawings} from '../src/utils/drawingStore.js';
import {registerVerifiedDrawings,inspectChartDrawings,drawingInspectionCommand,drawingOwnership,resetVerifiedDrawingOwnership} from '../src/components/ai/chartDrawingInventory.js';
const draw=(n,type='hline',frame='M5')=>({id:'ai-draw_'+String(n).repeat(32),sourceId:'draw_'+String(n).repeat(32),createdBy:'ai',actionId:'aabbccdd-1122-4333-8444-556677889900',type,a:{time:1795836600,price:100},b:{time:1795836900,price:99},timeframeVisibility:frame});
const scope=symbol=>({symbol,timeframe:'5m',chartInstanceId:'chart-a'});
test('inventory respects timeframe, selection scope, manual and protected persisted objects',()=>{
 const symbol='INVTEST1';commitDrawings(symbol,[draw(1),draw(2,'rectangle','H1'),{...draw(3),hidden:true},{...draw(4),createdBy:'manual',id:'manual'}]);
 const initial=inspectChartDrawings({...scope(symbol),selection:{symbol,chartInstanceId:'other',selectedId:'manual'}});
 assert.equal(initial.total,2);assert.deepEqual(initial.counts,{VERIFIED_AI:0,PROTECTED_AI:1,MANUAL:1});assert.equal(initial.selected,null);
 const selected=inspectChartDrawings({...scope(symbol),selection:{symbol,chartInstanceId:'chart-a',selectedId:'manual'}});
 assert.equal(selected.selected.ownership,'MANUAL');
 assert.equal(inspectChartDrawings({...scope(symbol),timeframe:'unknown'}),null);
});
test('only verified creation grants session recognition; manual edit permanently revokes it even after undo',()=>{
 const symbol='INVTEST2';commitDrawings(symbol,[draw(1),draw(2,'rectangle')]);
 const before=getDrawingSnapshot(symbol).present;
 assert.equal(registerVerifiedDrawings(symbol,[before[0]]),true);
 let report=inspectChartDrawings(scope(symbol));assert.deepEqual(report.counts,{VERIFIED_AI:1,PROTECTED_AI:1,MANUAL:0});
 patchDrawing(symbol,before[0].id,{style:{color:'#FFFFFF'}});
 assert.equal(inspectChartDrawings(scope(symbol)).counts.VERIFIED_AI,0);
 assert.equal(undoDrawings(symbol),true);
 assert.equal(inspectChartDrawings(scope(symbol)).counts.VERIFIED_AI,0);
});
test('inspection is bounded and commands cannot mix actions',()=>{
 const symbol='INVTEST3';commitDrawings(symbol,Array.from({length:25},(_,i)=>({...draw(1),id:'manual-'+i,createdBy:'manual'})));
 const r=inspectChartDrawings(scope(symbol));assert.equal(r.total,25);assert.equal(r.drawings.length,20);assert.equal(r.truncated,true);
 assert.equal(drawingInspectionCommand('List drawings'),'LIST');assert.equal(drawingInspectionCommand('Which drawing is selected?'),'SELECTED');
 for(const q of ['List drawings and delete them','Show drawings then buy BTC','Delete selected drawing','List drawings on EURUSD'])assert.equal(drawingInspectionCommand(q),null);
});

test('throwing UI subscriber cannot conceal transient manual edits or restore ownership via undo',()=>{
 const symbol='INVTEST4';commitDrawings(symbol,[draw(1)]);
 const baseline=getDrawingSnapshot(symbol).present;
 const unsub=subscribeDrawings(symbol,()=>{throw Error('UI listener failure');});
 try{
  assert.equal(registerVerifiedDrawings(symbol,baseline),true);
  assert.throws(()=>replaceDrawingsLive(symbol,[{...baseline[0],style:{...baseline[0].style,color:'#FFFFFF'}}]),/UI listener failure/);
  assert.throws(()=>replaceDrawingsLive(symbol,baseline),/UI listener failure/);
  assert.equal(drawingOwnership(symbol,getDrawingSnapshot(symbol).present[0]),'PROTECTED_AI');
 }finally{unsub();}
});
test('unrelated native edits preserve ownership; native manual changes, undo and redo never reacquire it',()=>{
 const symbol='INVTEST5';commitDrawings(symbol,[draw(1),{...draw(2),id:'manual',createdBy:'manual'}]);
 const baseline=getDrawingSnapshot(symbol).present;
 assert.equal(registerVerifiedDrawings(symbol,[baseline[0]]),true);
 patchDrawing(symbol,'manual',{text:'unrelated'});
 assert.equal(drawingOwnership(symbol,getDrawingSnapshot(symbol).present[0]),'VERIFIED_AI');
 patchDrawing(symbol,baseline[0].id,{locked:true});
 assert.equal(drawingOwnership(symbol,getDrawingSnapshot(symbol).present[0]),'PROTECTED_AI');
 assert.equal(undoDrawings(symbol),true);assert.equal(drawingOwnership(symbol,getDrawingSnapshot(symbol).present[0]),'PROTECTED_AI');
 assert.equal(redoDrawings(symbol),true);assert.equal(drawingOwnership(symbol,getDrawingSnapshot(symbol).present[0]),'PROTECTED_AI');
});
test('session reset revokes authority without altering any stored drawing',()=>{
 const symbol='INVTEST6';commitDrawings(symbol,[draw(1)]);
 const before=getDrawingSnapshot(symbol);
 assert.equal(registerVerifiedDrawings(symbol,before.present),true);
 resetVerifiedDrawingOwnership();
 assert.equal(getDrawingSnapshot(symbol),before);
 assert.equal(drawingOwnership(symbol,before.present[0]),'PROTECTED_AI');
});
