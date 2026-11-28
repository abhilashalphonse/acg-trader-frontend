import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawingDeleteCommand,resolveDrawingDeletion} from '../src/components/ai/chartDrawingDelete.js';
import {getDrawingSnapshot,commitDrawings} from '../src/utils/drawingStore.js';
import {registerVerifiedDrawings} from '../src/components/ai/chartDrawingInventory.js';
test('deletion accepts only specific direct requests',()=>{
 assert.deepEqual(drawingDeleteCommand('Delete selected AI drawing'),{selected:true,target:null});
 assert.deepEqual(drawingDeleteCommand('Remove the AI FVG'),{selected:false,target:'rectangle'});
 assert.deepEqual(drawingDeleteCommand('Delete selected liquidity line'),{selected:true,target:'hline'});
 for(const q of ['Delete all drawings','Delete drawing','Remove invalidated FVGs','Delete AI FVG and buy BTC','"Delete AI FVG"','Confirm deletion','Delete AI FVG?'])assert.equal(drawingDeleteCommand(q),null,q);
});
test('manual, ambiguous and wrong-chart targets never receive a deletion proposal',()=>{
 const symbol='AGENTDELETE4',workspace={symbol,timeframe:'5m',chartInstanceId:'chart-a'};
 const first={id:'ai-draw_'+'a'.repeat(32),sourceId:'draw_'+'a'.repeat(32),createdBy:'ai',type:'rectangle',a:{time:1795836000,price:100},b:{time:1795836600,price:99},sourceTimeframe:'M5',timeframeVisibility:'M5'};
 commitDrawings(symbol,[first,{...first,id:'manual',createdBy:'manual'}]);
 const snapshot=getDrawingSnapshot(symbol);assert.equal(registerVerifiedDrawings(symbol,[snapshot.present[0]]),true);
 const resolve=(question,selection)=>resolveDrawingDeletion({question,workspace,snapshot,selection});
 assert.equal(resolve('Delete AI FVG').state,'AMBIGUOUS_TARGET');
 assert.equal(resolve('Delete selected AI drawing',{symbol,chartInstanceId:'chart-a',selectedId:'manual'}).state,'PROTECTED_TARGET');
 assert.equal(resolve('Delete selected AI drawing',{symbol,chartInstanceId:'chart-b',selectedId:first.id}).state,'NO_TARGET');
 assert.equal(resolve('Delete selected AI drawing',{symbol,chartInstanceId:'chart-a',selectedId:first.id}).state,'READY');
});
