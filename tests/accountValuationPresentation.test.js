import test from 'node:test';
import assert from 'node:assert/strict';
import { accountValuationPresentation } from '../src/utils/accountValuationPresentation.js';

const account = {
  financialRevision: 8,
  state: { balance: '10000', floatingPnl: '80', equity: '10080', usedMargin: '0', freeMargin: '10080' },
};
const live = {
  financialRevision: 8, complete: true, valuationStatus: 'LIVE',
  balance: '10000', floatingPnl: '0', equity: '10000',
  usedMargin: '0', freeMargin: '10000', marginLevel: null,
};

test('flat account with stale saved PnL shows authoritative zero from matching live valuation', () => {
  const value=accountValuationPresentation(account,live);
  assert.equal(value.balance,10000);
  assert.equal(value.floatingPnl,0);
  assert.equal(value.equity,10000);
  assert.equal(value.usedMargin,0);
  assert.equal(value.valuationVerified,true);
});

test('missing valuation cannot show stored equity, floating PnL or margin as current', () => {
  const value=accountValuationPresentation(account,null);
  assert.equal(value.balance,10000);
  for (const field of ['equity','floatingPnl','usedMargin','freeMargin','marginLevel']) {
    assert.equal(value[field],null,field);
  }
  assert.equal(value.valuationStatus,'WAITING');
});

test('financial revision mismatch never falls back to saved metrics', () => {
  const value=accountValuationPresentation(account,{...live,financialRevision:7});
  assert.equal(value.valuationCoherent,false);
  assert.equal(value.equity,null);
  assert.equal(value.floatingPnl,null);
});

test('stale or incomplete quotes retain their status but suppress account valuation numbers', () => {
  for (const v of [
    {...live,valuationStatus:'STALE',floatingPnl:'20',equity:'10020'},
    {...live,valuationStatus:'WAITING',complete:false,equity:null},
    {...live,valuationStatus:'LIVE',complete:false},
  ]) {
    const value=accountValuationPresentation(account,v);
    assert.equal(value.equity,null);
    assert.equal(value.floatingPnl,null);
    assert.equal(value.valuationVerified,false);
  }
});

test('missing snapshot financialRevision is not implicitly coherent', () => {
  const {financialRevision,...noRevision}=live;
  const result=accountValuationPresentation(account,noRevision);
  assert.equal(result.valuationCoherent,false);
  assert.equal(result.equity,null);
});
