import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {prepareChartDrawingPlan,applyChartDrawingPlan} from '../src/components/ai/chartDrawingPlan.js';
import {getDrawingSnapshot,commitDrawings,undoDrawings} from '../src/utils/drawingStore.js';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const now=1795836600000, time=1795836600;
const scope=symbol=>({symbol,timeframe:'5m',chartInstanceId:'fixture-chart'});
const line={type:'hline',time,price:59941.16};
const rect={type:'rectangle',fromTime:time,toTime:time+300,lower:59961.48,upper:60029.20};
test('preview is immutable and applies chart-only drawings as a single undoable operation',()=>{
 const workspace=scope('TESTBTC'),before=getDrawingSnapshot(workspace.symbol);
 const plan=prepareChartDrawingPlan({workspace,actions:[line,rect],now});
 assert.ok(plan);assert.ok(Object.isFrozen(plan.actions[0].a));
 assert.equal(getDrawingSnapshot(workspace.symbol).revision,before.revision);
 assert.equal(applyChartDrawingPlan(plan,{workspace,confirmed:false,now}),false);
 assert.equal(applyChartDrawingPlan(plan,{workspace,confirmed:true,now}),true);
 const after=getDrawingSnapshot(workspace.symbol);
 assert.equal(after.revision,before.revision+1);
 assert.equal(after.present.length,before.present.length+2);
 assert.deepEqual(after.present[0].a,{time,price:59941.16});
 assert.deepEqual(after.present[1].b,{time:time+300,price:59961.48});
 assert.equal(after.present[1].timeframeVisibility,'M5');
 assert.equal(applyChartDrawingPlan(plan,{workspace,confirmed:true,now}),false);
 assert.equal(undoDrawings(workspace.symbol),true);
 assert.deepEqual(getDrawingSnapshot(workspace.symbol).present,before.present);
});
test('rejects raw forged plans, cross-chart, expired and stale drawing revision',()=>{
 const workspace=scope('TESTGOLD');
 const p=prepareChartDrawingPlan({workspace,actions:[line],now});
 assert.equal(applyChartDrawingPlan(structuredClone(p),{workspace,confirmed:true,now}),false);
 for(const changed of [{...workspace,symbol:'OTHER'},{...workspace,timeframe:'1m'},{...workspace,chartInstanceId:'different'}])
   assert.equal(applyChartDrawingPlan(p,{workspace:changed,confirmed:true,now}),false);
 assert.equal(applyChartDrawingPlan(p,{workspace,confirmed:true,now:now+120000}),false);
 commitDrawings(workspace.symbol,[{id:'manual',type:'hline',a:{time,price:1900}}]);
 assert.equal(applyChartDrawingPlan(p,{workspace,confirmed:true,now}),false);
 assert.equal(getDrawingSnapshot(workspace.symbol).present.length,1);
});
test('unsupported actions and malformed geometry fail without touching drawings',()=>{
 const workspace=scope('TESTEUR');
 for(const actions of [[{type:'market-order',price:1}], [{...line,executionAllowed:true}], [{...line,time:now}],
   [{...line,price:'1.23'}],[{...rect,upper:rect.lower}],[{...rect,toTime:time}],Array(9).fill(line),[]])
   assert.equal(prepareChartDrawingPlan({workspace,actions,now}),null);
 assert.equal(getDrawingSnapshot(workspace.symbol).present.length,0);
});
