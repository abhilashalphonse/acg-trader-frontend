import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTradePlanPatch } from '../src/utils/tradePlanNormalization.js';

test('chart-dragged SL and TP snap to tick in the safe direction', () => {
  const instrument = { tickSize: 0.05 };
  const plan = { side: 'buy', orderType: 'market', pending: false };
  const patch = normalizeTradePlanPatch(plan, { sl: 99.973, tp: 100.027 }, instrument);

  assert.equal(patch.sl, 99.95);
  assert.equal(patch.tp, 100.05);
});

test('pending entries snap according to order semantics', () => {
  const instrument = { tickSize: 0.01 };
  const buyLimit = normalizeTradePlanPatch({ side: 'buy', orderType: 'limit', pending: true }, { entry: 1.23456 }, instrument);
  const sellLimit = normalizeTradePlanPatch({ side: 'sell', orderType: 'limit', pending: true }, { entry: 1.23456 }, instrument);

  assert.equal(buyLimit.entry, 1.23);
  assert.equal(sellLimit.entry, 1.24);
});

test('stop-limit trigger and limit legs use their own direction rules', () => {
  const instrument = { tickSize: 0.01 };
  const patch = normalizeTradePlanPatch(
    { side: 'buy', orderType: 'stop-limit', pending: true },
    { entry: 1.23451, limitPrice: 1.23511 },
    instrument,
  );

  assert.equal(patch.entry, 1.24);
  assert.equal(patch.limitPrice, 1.24);
});


test('normalization uses the incoming pending order type when type and entry change together', () => {
  const instrument = { tickSize: 0.0001, pipSize: 0.0001 };
  const plan = { side: 'buy', orderType: 'limit', pending: true, entry: 1.0995 };
  const patch = normalizeTradePlanPatch(plan, { orderType: 'stop', entry: 1.10056 }, instrument);
  assert.equal(patch.orderType, 'stop');
  assert.equal(patch.entry, 1.1006);
});
