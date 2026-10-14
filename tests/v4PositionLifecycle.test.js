import test from 'node:test';
import assert from 'node:assert/strict';
import {positionLifecycleEvents} from '../src/utils/v4PositionLifecycle.js';
const position={id:'pos-101',raw:{sourceOrderId:'order-22'}};
const o={id:'order-22',createdAt:'2026-10-13T01:00:00Z',type:'MARKET',side:'SELL',requestedVolume:'0.1'};
const d={id:'deal-12',positionId:'pos-101',executedAt:'2026-10-13T01:00:02Z',type:'OPEN',price:'1.11',volume:'0.1'};
test('requires persisted order/deal identity and valid times; never fabricate events',()=>{
  assert.deepEqual(positionLifecycleEvents(position),[]);
  assert.deepEqual(positionLifecycleEvents({id:null},{orders:[o],deals:[d]}),[]);
  assert.deepEqual(positionLifecycleEvents(position,{orders:[{...o,id:'different'}],deals:[{...d,positionId:'other'}]}),[]);
  assert.deepEqual(positionLifecycleEvents(position,{deals:[{...d,executedAt:null}]}),[]);
});
test('joins by exact position and originating order identity, newest first',()=>{
  const events=positionLifecycleEvents(position,{orders:[o,{...o,id:'irrelevant'}],deals:[d]});
  assert.equal(events.length,2);
  assert.deepEqual(events.map(event=>event.label),['Position filled','Order created']);
  assert.deepEqual(events.map(event=>event.recordId),['deal-12','order-22']);
  assert.ok(events.every(event=>event.timestamp.endsWith('Z')));
});
test('deduplicates repeated deal snapshots and maps real partial exits',()=>{
  const close={id:'deal-13',positionId:'pos-101',type:'CLOSE',executedAt:'2026-10-13T01:30:00Z',price:'1.12',volume:'0.05'};
  const events=positionLifecycleEvents(position,{deals:[d,close],fills:[d,{...close}]});
  assert.equal(events.length,2);
  assert.equal(events[0].label,'Position reduced');
  assert.equal(events[0].kind,'deal');
  assert.equal(events[0].description,'0.05 lots @ 1.12');
});
