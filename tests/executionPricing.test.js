import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateExecutionPrice, volumeBandFor } from '../src/utils/executionPricing.js';

const xau = {
  bid: 4310.80,
  ask: 4310.90,
  tickSize: 0.01,
  spreadPoints: 10,
  spreadProfile: {
    volumeBands: [
      { upTo: 1, extraPoints: 0 },
      { upTo: 5, extraPoints: 5 },
      { upTo: 15, extraPoints: 10 },
      { upTo: null, extraPoints: 40 },
    ],
  },
};

test('volume band selection mirrors backend boundary semantics', () => {
  assert.equal(volumeBandFor(xau.spreadProfile.volumeBands, 1).extraPoints, 0);
  assert.equal(volumeBandFor(xau.spreadProfile.volumeBands, 5).extraPoints, 5);
  assert.equal(volumeBandFor(xau.spreadProfile.volumeBands, 15).extraPoints, 10);
  assert.equal(volumeBandFor(xau.spreadProfile.volumeBands, 31).extraPoints, 40);
});

test('execution preview applies adverse volume adjustment to the executable side', () => {
  const buy = estimateExecutionPrice(xau, 'buy', 5);
  const sell = estimateExecutionPrice(xau, 'sell', 5);
  assert.equal(buy.price, 4310.95);
  assert.equal(sell.price, 4310.75);
  assert.equal(buy.liquidityAdjustmentPoints, 5);
  assert.equal(sell.liquidityAdjustmentPoints, 5);
  assert.equal(buy.effectiveExecutionSpreadPoints, 15);
});

test('execution preview stays at the quoted price inside the first volume band', () => {
  assert.equal(estimateExecutionPrice(xau, 'buy', 0.5).price, 4310.90);
  assert.equal(estimateExecutionPrice(xau, 'sell', 0.5).price, 4310.80);
});
