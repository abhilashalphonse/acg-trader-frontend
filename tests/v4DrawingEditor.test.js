import test from 'node:test';
import assert from 'node:assert/strict';
import { clampDrawingEditorPosition, drawingEditorStartPosition, riskTargetProjectionCandidates } from '../src/utils/v4DrawingEditor.js';

const position = (type, target) => ({
  id:'risk', type, a:{time:100,price:100},
  b:{time:110,price:type === 'long-position' ? 95 : 105},
  riskTarget:target,
});

test('long and short position target fallbacks keep the exact stored TP price', () => {
  for (const type of ['long-position', 'short-position']) {
    const drawing = position(type, {time:999999,price:type === 'long-position' ? 110 : 90});
    const candidates = riskTargetProjectionCandidates(drawing);
    assert.deepEqual(candidates.map(p => p.time), [999999,110,100]);
    assert.ok(candidates.every(p => p.price === drawing.riskTarget.price));
    assert.equal(drawing.riskTarget.time, 999999, 'render fallback does not change storage');
  }
});

test('missing position risk target gets a temporary rendering fallback only', () => {
  const long = position('long-position', null);
  const short = position('short-position', null);
  assert.equal(riskTargetProjectionCandidates(long)[0].price, 110);
  assert.equal(riskTargetProjectionCandidates(short)[0].price, 90);
  assert.equal(long.riskTarget, null);
  assert.equal(short.riskTarget, null);
  assert.deepEqual(riskTargetProjectionCandidates({...long,type:'trendline'}), []);
});

test('floating editor coordinates are clamped and user placement stays inside a resized chart', () => {
  const editor = {width:500,height:44};
  assert.deepEqual(clampDrawingEditorPosition({left:750,top:-5},{width:900,height:600},editor),{left:392,top:8});
  assert.deepEqual(clampDrawingEditorPosition({left:750,top:800},{width:600,height:300},editor),{left:92,top:248});
  assert.deepEqual(drawingEditorStartPosition({x:100,y:80},{width:900,height:600},editor),{left:8,top:28});
  assert.deepEqual(drawingEditorStartPosition(null,{width:900,height:600},editor),{left:200,top:8});
});
