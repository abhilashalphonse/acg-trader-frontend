import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getDrawingSnapshot,commitDrawings,patchDrawing,undoDrawings} from '../src/utils/drawingStore.js';
import {registerVerifiedDrawings,inspectChartDrawings,drawingInspectionCommand} from '../src/components/ai/chartDrawingInventory.js';
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
