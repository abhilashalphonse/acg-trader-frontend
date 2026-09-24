import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAWING_CREATE_TOOL_IDS,
  DRAWING_TOOL_GROUPS,
  DRAWING_TOOL_LABELS,
  canonicalDrawingTimeframe,
  canonicalTimeframeVisibility,
  clampDrawingRiskPercent,
  isDrawingCreateTool,
  riskDrawingGeometry,
} from '../src/utils/drawingTools.js';

test('drawing tool catalog is unique and fully labelled', () => {
  const all = DRAWING_TOOL_GROUPS.flat();
  assert.equal(new Set(all).size, all.length);
  for (const id of all) {
    assert.equal(typeof DRAWING_TOOL_LABELS[id], 'string');
    assert.ok(DRAWING_TOOL_LABELS[id].length > 0);
  }
  for (const id of DRAWING_CREATE_TOOL_IDS) assert.equal(isDrawingCreateTool(id), true);
  assert.equal(isDrawingCreateTool('cursor'), false);
});

test('drawing timeframe aliases normalize to chart timeframes', () => {
  assert.equal(canonicalDrawingTimeframe('5m'), 'M5');
  assert.equal(canonicalDrawingTimeframe('1H'), 'H1');
  assert.deepEqual(canonicalTimeframeVisibility(['1m', 'M1', '4H']), ['M1', 'H4']);
});

test('drawing risk percent matches execution planner limits', () => {
  assert.equal(clampDrawingRiskPercent(0), 0.1);
  assert.equal(clampDrawingRiskPercent(0.5), 0.5);
  assert.equal(clampDrawingRiskPercent(50), 5);
});

test('long and short risk tools keep stop and target on the valid side', () => {
  const entry={time:100,price:100};
  const pointer={time:160,price:95};
  const long=riskDrawingGeometry('long-position',entry,pointer,0.1);
  assert.equal(long.b.price,95);
  assert.equal(long.riskTarget.price,110);
  const short=riskDrawingGeometry('short-position',entry,pointer,0.1);
  assert.equal(short.b.price,105);
  assert.equal(short.riskTarget.price,90);
});
