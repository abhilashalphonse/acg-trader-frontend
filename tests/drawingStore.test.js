import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commitDrawings,
  getDrawingSnapshot,
  redoDrawings,
  removeDrawing,
  undoDrawings,
  visibleDrawingOnTimeframe,
} from '../src/utils/drawingStore.js';

function line(id, price = 1) {
  return {
    id,
    type: 'hline',
    a: { time: 100, price },
    b: { time: 100, price },
    timeframeVisibility: 'all',
  };
}

test('drawing store is canonical for every consumer of the same symbol', () => {
  const symbol = 'STORE_SYNC_TEST';
  commitDrawings(symbol, [line('a')]);
  const first = getDrawingSnapshot(symbol);
  const second = getDrawingSnapshot(symbol);
  assert.equal(first, second);
  assert.deepEqual(first.present.map(item => item.id), ['a']);

  commitDrawings(symbol, current => [...current, line('b', 2)]);
  assert.deepEqual(getDrawingSnapshot(symbol).present.map(item => item.id), ['a', 'b']);

  removeDrawing(symbol, 'a');
  assert.deepEqual(getDrawingSnapshot(symbol).present.map(item => item.id), ['b']);
});

test('symbol-level undo and redo operate on the shared drawing history', () => {
  const symbol = 'STORE_HISTORY_TEST';
  commitDrawings(symbol, [line('first')]);
  commitDrawings(symbol, current => [...current, line('second')]);

  assert.equal(undoDrawings(symbol), true);
  assert.deepEqual(getDrawingSnapshot(symbol).present.map(item => item.id), ['first']);

  assert.equal(redoDrawings(symbol), true);
  assert.deepEqual(getDrawingSnapshot(symbol).present.map(item => item.id), ['first', 'second']);
});

test('drawing timeframe visibility respects scalar and array rules', () => {
  const base = line('visibility');
  assert.equal(visibleDrawingOnTimeframe({ ...base, timeframeVisibility: 'M5' }, 'M1'), false);
  assert.equal(visibleDrawingOnTimeframe({ ...base, timeframeVisibility: 'M5' }, 'M5'), true);
  assert.equal(visibleDrawingOnTimeframe({ ...base, timeframeVisibility: ['M1', 'H1'] }, 'M5'), false);
  assert.equal(visibleDrawingOnTimeframe({ ...base, timeframeVisibility: ['M1', 'H1'] }, 'H1'), true);
  assert.equal(visibleDrawingOnTimeframe({ ...base, hidden: true }, 'M1'), false);
});
