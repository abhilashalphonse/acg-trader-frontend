import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('desktop chart no longer renders the floating spread and utility button strip',()=>{
  const area=read('src/components/trading-v2/ChartArea.jsx');
  assert.doesNotMatch(area,/Spread&nbsp;/);
  assert.doesNotMatch(area,/title="Reset chart view"/);
  assert.doesNotMatch(area,/title="Fit chart"/);
  assert.doesNotMatch(area,/right-\[74px\] top-2 z-30 flex items-center gap-1/);
  assert.match(area,/onToggleVisibility=\{\(\) => setShowDrawings\(value => !value\)\}/,
    'Drawing visibility remains available in the regular drawing rail');
  assert.match(area,/onClick=\{\(\) => coordinateApi\?\.resetView\?\.\(\)\}/,
    'Existing manual Auto reset control remains available');
});

test('floating drawing Undo/Redo toolbar is gone but shortcuts still work',()=>{
  const drawing=read('src/components/trading-v2/DrawingLayer.jsx');
  assert.doesNotMatch(drawing,/acg-mobile-history-controls/);
  assert.doesNotMatch(drawing,/title="Undo \(Ctrl\/Cmd\+Z\)"/);
  assert.doesNotMatch(drawing,/title="Redo \(Ctrl\/Cmd\+Shift\+Z\)"/);
  assert.match(drawing,/undoDrawings\(symbol\)/);
  assert.match(drawing,/redoDrawings\(symbol\)/);
  assert.match(drawing,/if \(event\.shiftKey\) redo\(\)/);
});
