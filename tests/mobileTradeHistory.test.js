import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileHistoryRows,mobilePartialCloseAllowed} from '../src/utils/mobileTradeHistory.js';
const now=Date.parse('2026-10-16T12:00:00Z');
const positions=[{id:'a',symbol:'EURUSD',closedAtIso:'2026-10-16T00:00:00Z'},{id:'b',symbol:'GBPUSD',closedAtIso:'2026-09-01T00:00:00Z'},{id:'missing',symbol:'EURUSD'}];
const orders=[{id:'o',symbol:'EURUSD',status:'CANCELLED',cancelledAt:'2026-10-16T10:00:00Z'},{id:'live',symbol:'EURUSD',status:'PENDING',createdAt:'2026-10-16T10:00:00Z'}];
test('history keeps active pending orders separate and filters authoritative records in UTC',()=>{
  assert.deepEqual(mobileHistoryRows({positions,orders,kind:'position',period:'today',now}).map(r=>r.item.id),['a']);
  assert.deepEqual(mobileHistoryRows({positions,orders,kind:'order',period:'today',now}).map(r=>r.item.id),['o']);
  assert.deepEqual(mobileHistoryRows({positions,kind:'position',period:'all',symbol:'GBPUSD',now}).map(r=>r.item.id),['b']);
  assert.equal(mobileHistoryRows({positions,kind:'position',period:'all',now}).length,3);
});
test('custom date endpoints are inclusive and invalid ranges produce no misleading rows',()=>{
  assert.equal(mobileHistoryRows({positions,period:'custom',start:'2026-10-16',end:'2026-10-16',now}).length,1);
  assert.equal(mobileHistoryRows({positions,period:'custom',start:'2026-10-17',end:'2026-10-16',now}).length,0);
});
test('partial close options respect minimum volume and the remainder',()=>{
  const spec={volumeStep:0.01,minVolume:0.01};
  assert.equal(mobilePartialCloseAllowed({volume:0.01},50,spec),false);
  assert.equal(mobilePartialCloseAllowed({volume:0.1},50,spec),true);
  assert.equal(mobilePartialCloseAllowed({volume:0.01},100,spec),true);
});
