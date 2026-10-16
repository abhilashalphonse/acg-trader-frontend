import test from 'node:test';
import assert from 'node:assert/strict';
import {readMobileSizingPreference,mobileSizingPreferenceKey,mobilePreciseChartEdit} from '../src/utils/mobileV4Preferences.js';
import {findMobileExecutionOutcome} from '../src/utils/mobileExecutionRecovery.js';

test('sizing preferences are scoped to account/instrument and tolerate unavailable storage',()=>{
  assert.notEqual(mobileSizingPreferenceKey('a','EURUSD'),mobileSizingPreferenceKey('b','EURUSD'));
  assert.notEqual(mobileSizingPreferenceKey('a','EURUSD'),mobileSizingPreferenceKey('a','BTCUSD'));
  assert.equal(readMobileSizingPreference({getItem:()=>{throw Error();}},'x',0.1).amount,'0.1');
  assert.deepEqual(readMobileSizingPreference({getItem:()=>JSON.stringify({mode:'riskUSD',amount:'51.23',orderType:'stop',baseLots:0.1})},'x'),{mode:'riskUSD',amount:'51.23',orderType:'stop',baseLots:0.1});
});
test('precise chart editing is local, tick-normalized and cannot move filled entry',()=>{
  const draft={objectType:'position',kind:'sl',objectId:'p',proposedPrice:1.1};
  const next=mobilePreciseChartEdit(draft,'1.120923',{tickSize:0.00001});
  assert.equal(next.proposedPrice,1.12092);
  assert.equal(draft.proposedPrice,1.1);
  for(const value of ['',null,'abc','0','-1']) assert.equal(mobilePreciseChartEdit(draft,value,{tickSize:0.01}),null);
  assert.equal(mobilePreciseChartEdit({...draft,kind:'entry'},'1.12',{tickSize:0.00001}),null);
});
test('recovery only unlocks the exact client order on the matching account with authoritative status',async()=>{
  const recovery={accountId:'a',clientOrderId:'client-1'};
  const findOrders=async()=>({items:[{id:'o',accountId:'a',clientOrderId:'client-1',status:'FILLED'}]});
  assert.equal((await findMobileExecutionOutcome({accountId:'a',recovery,findOrders})).confirmed,true);
  for(const item of [null,{id:'o',clientOrderId:'different',status:'FILLED'},{id:'o',accountId:'b',clientOrderId:'client-1',status:'FILLED'},{id:'o',clientOrderId:'client-1',status:'UNKNOWN'}]) {
    assert.equal((await findMobileExecutionOutcome({accountId:'a',recovery,findOrders:async()=>({items:item?[item]:[]})})).confirmed,false);
  }
  assert.equal((await findMobileExecutionOutcome({accountId:'b',recovery,findOrders:()=>{throw Error('must not query wrong account');}})).confirmed,false);
});
