import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V4_ORDER_VISUAL_STATES, v4LevelId, projectV4AcceptedLevels,
  projectV4Edit, v4MissingProtections, v4ProtectionAction, placeV4Badges,
} from '../src/components/trading-v2/v4/chartOrderModel.js';

const accountId = 'test-account';
const symbol = 'BTCUSD';
const example = () => projectV4AcceptedLevels({ accountId, symbol,
  positions: [
    { id: 'p1', symbol, status: 'OPEN', side: 'SELL', entry: 83671, sl: 85606, tp: 81741, volume: 0.01 },
    { id: 'p2', symbol, status: 'OPEN', side: 'BUY', entry: 83900, tp: 84600, volume: 0.02 },
    { id: 'closed', symbol, status: 'CLOSED', entry: 83000 },
    { id: 'other', symbol: 'GBPUSD', status: 'OPEN', entry: 1.34 },
  ],
  pendingOrders: [
    { id: 'o1', symbol, status: 'PENDING', orderType: 'stop-limit',
      side: 'SELL', entry: 82500, limitPrice: 82400, sl: null, tp: 81000 },
    { id: 'o2', symbol, status: 'FILLED', entry: 82000 },
  ],
});

test('accepts only account/symbol-specific open and pending server levels', () => {
  const levels = example();
  assert.equal(levels.length, 8);
  assert.ok(levels.every(level => level.state === 'ACCEPTED' && level.lineStyle === 'solid'));
  assert.deepEqual(levels.filter(level => level.objectId === 'o1').map(level => level.kind),
    ['entry', 'limitPrice', 'tp']);
  assert.equal(projectV4AcceptedLevels({ accountId: null, symbol, positions: [{ entry: 1 }] }).length, 0);
  assert.equal(v4LevelId({ accountId, objectType: 'position', objectId: 'p1', kind: 'sl' }),
    'test-account:position:p1:sl');
});

test('an edit ghost cannot mutate an accepted solid source line', () => {
  const levels = example();
  const id = 'test-account:position:p1:tp';
  const result = projectV4Edit(levels, { levelId: id, proposedPrice: 81000 });
  assert.equal(result.ghost.price, 81000);
  assert.equal(result.ghost.state, V4_ORDER_VISUAL_STATES.PREVIEW);
  assert.equal(result.ghost.lineStyle, 'dotted');
  assert.equal(result.accepted.find(level => level.id === id).price, 81741);
  assert.equal(result.accepted.find(level => level.id === id).lineStyle, 'solid');
  assert.equal(projectV4Edit(levels, { levelId: id, proposedPrice: 0 }).ghost, null);
  assert.equal(projectV4Edit(levels, { levelId: 'other-id', proposedPrice: 83000 }).ghost, null);
});

test('attached TP and SL never appear as duplicate entry chips', () => {
  const levels = example();
  const first = 'test-account:position:p1:entry';
  const second = 'test-account:position:p2:entry';
  assert.deepEqual(v4MissingProtections(levels, first), []);
  assert.deepEqual(v4MissingProtections(levels, second), ['sl']);
  assert.deepEqual(v4MissingProtections(levels.filter(level => level.kind !== 'tp'), first), ['tp']);
});

test('removing an accepted protection requires confirmation intent', () => {
  const levels = example();
  const id = 'test-account:position:p1:tp';
  const action = v4ProtectionAction(levels, id, 'remove');
  assert.equal(action.state, 'CONFIRM_REMOVE');
  assert.equal(action.confirmedPrice, 81741);
  assert.equal(action.objectId, 'p1');
  assert.equal(v4ProtectionAction(levels, 'test-account:position:p1:entry', 'remove'), null);
  assert.equal(v4ProtectionAction(levels, id, 'noop'), null);
});

test('overlap solver preserves independent IDs and exact price-line coordinates', () => {
  const values = [
    { id: 'p1', y: 130 }, { id: 'p2', y: 130 }, { id: 'p3', y: 133 },
    { id: 'p4', y: 175 },
  ];
  const before = structuredClone(values);
  const { placements, overflow } = placeV4Badges(values, { minY: 0, maxY: 300, badgeHeight: 28, gap: 5 });
  assert.deepEqual(overflow, []);
  assert.equal(placements.length, 4);
  assert.equal(new Set(placements.map(p => p.id)).size, 4);
  assert.ok(placements.every((p,i) => i === 0 || p.badgeTop >= placements[i-1].badgeTop + 33));
  assert.deepEqual(values, before, 'layout must not mutate accepted inputs');
  assert.deepEqual(placements.map(p => p.priceLineY), [130,130,133,175]);
  assert.ok(placements.some(p => p.displaced));
});

test('impossible overlap returns explicit overflow rather than stacking badges', () => {
  const levels = Array.from({ length: 6 }, (_, i) => ({ id: String(i), y: 80 }));
  const { placements, overflow } = placeV4Badges(levels, { minY: 0, maxY: 100, badgeHeight: 28, gap: 5 });
  assert.equal(placements.length, 3);
  assert.equal(overflow.length, 3);
  assert.ok(placements.every(p => p.badgeTop >= 0 && p.badgeTop <= 72));
});

test('missing quote/coordinate data never produces a fabricated accepted level', () => {
  const levels = projectV4AcceptedLevels({ accountId, symbol, positions: [
    { id: 'nil', symbol, status:'OPEN', side:'BUY', entry:null, sl:0, tp:'NaN' },
    { id: 'bad', symbol, status:'OPEN', entry:-2, sl:Infinity },
  ] });
  assert.deepEqual(levels, []);
});
