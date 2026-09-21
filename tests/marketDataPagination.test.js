import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prependHistoricalCandles,
  reconcileLatestCandles,
} from '../src/utils/candleHistory.js';

function bar(time, close = time) {
  return {
    time,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1,
  };
}

test('older candle pages prepend without duplicates and preserve current overlap', () => {
  const existing = [bar(300, 30), bar(400, 40), bar(500, 50)];
  const older = [bar(100, 10), bar(200, 20), bar(300, 999)];

  const merged = prependHistoricalCandles(existing, older, 10);

  assert.equal(merged.added, 2);
  assert.deepEqual(merged.bars.map(item => item.time), [100, 200, 300, 400, 500]);
  assert.equal(merged.bars.find(item => item.time === 300).close, 30);
});

test('latest reconciliation replaces stale overlap while retaining older loaded history', () => {
  const existing = [bar(100, 10), bar(200, 20), bar(300, 30), bar(400, 40)];
  const latest = [bar(300, 31), bar(400, 41), bar(500, 50)];

  const reconciled = reconcileLatestCandles(existing, latest, 10);

  assert.deepEqual(reconciled.map(item => item.time), [100, 200, 300, 400, 500]);
  assert.equal(reconciled.find(item => item.time === 300).close, 31);
  assert.equal(reconciled.find(item => item.time === 400).close, 41);
});

test('history merge enforces the chart memory ceiling from the oldest side', () => {
  const existing = [bar(300), bar(400), bar(500)];
  const older = [bar(100), bar(200)];

  const merged = prependHistoricalCandles(existing, older, 4);

  assert.equal(merged.bars.length, 4);
  assert.deepEqual(merged.bars.map(item => item.time), [200, 300, 400, 500]);
  assert.equal(merged.added, 1);
});
