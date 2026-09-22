import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultTradePlan,
  effectiveTradePlan,
  validateTradePlanForExecution,
} from '../src/utils/tradePlanExecution.js';

const eurusd = {
  symbol: 'EURUSD',
  assetClass: 'FOREX',
  bid: 1.1000,
  ask: 1.1001,
  tickSize: 0.00001,
  pipSize: 0.0001,
  contractSize: 100000,
};

test('default trade plan preserves selected risk sizing mode', () => {
  const plan = createDefaultTradePlan({ side: 'buy', requestedType: 'market', market: eurusd, sizingMode: 'risk', lots: 0.2 });
  assert.equal(plan.sizingMode, 'risk');
  assert.equal(plan.manualLots, 0.2);
});

test('default crypto plan uses asset-aware stop distance instead of a few ticks', () => {
  const btc = { symbol: 'BTCUSD', assetClass: 'CRYPTO', bid: 79999, ask: 80000, tickSize: 0.01, pipSize: 0.01, contractSize: 1 };
  const plan = createDefaultTradePlan({ side: 'buy', requestedType: 'market', market: btc, sizingMode: 'risk', lots: 0.1 });
  assert.equal(plan.entry, 80000);
  assert.equal(plan.sl, 79600);
  assert.equal(plan.tp, 80800);
});

test('market plan entry follows the current executable side price', () => {
  const plan = createDefaultTradePlan({ side: 'buy', requestedType: 'market', market: eurusd, sizingMode: 'risk' });
  const moved = { ...eurusd, bid: 1.1010, ask: 1.1011 };
  assert.equal(effectiveTradePlan(plan, moved).entry, 1.1011);
});

test('invalid protection geometry is blocked before submission', () => {
  const plan = { symbol: 'EURUSD', side: 'buy', orderType: 'market', pending: false, entry: 1.1001, sl: 1.1010, tp: 1.1020 };
  const result = validateTradePlanForExecution(plan, eurusd);
  assert.equal(result.valid, false);
  assert.equal(result.code, 'INVALID_SL_GEOMETRY');
});

test('pending order relation is validated against live executable quote', () => {
  const badLimit = { symbol: 'EURUSD', side: 'buy', orderType: 'limit', pending: true, entry: 1.1002, sl: 1.0990, tp: 1.1020, expiration: 'GTC' };
  const result = validateTradePlanForExecution(badLimit, eurusd);
  assert.equal(result.valid, false);
  assert.equal(result.code, 'INVALID_PENDING_ENTRY');
});

test('valid stop-limit geometry is accepted', () => {
  const plan = { symbol: 'EURUSD', side: 'buy', orderType: 'stop-limit', pending: true, entry: 1.1010, limitPrice: 1.1012, sl: 1.1000, tp: 1.1030, expiration: 'GTC' };
  const result = validateTradePlanForExecution(plan, eurusd);
  assert.equal(result.valid, true);
});
