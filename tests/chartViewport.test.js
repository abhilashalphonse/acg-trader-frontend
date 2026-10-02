import test from 'node:test';
import assert from 'node:assert/strict';
import { initialChartRange, normalizeChartViewport } from '../src/utils/chartViewport.js';
import { normalizeDesktopChartSettings } from '../src/utils/desktopChartSettings.js';

test('existing saved settings acquire adjustable spacing defaults', () => {
  assert.deepEqual(normalizeDesktopChartSettings({ timezone: 'UTC' }).viewport,
    { top: .12, bottom: .16, bars: 42 });
  assert.deepEqual(normalizeChartViewport({ top: 9, bottom: -4, bars: 'oops' }),
    { top: .3, bottom: .02, bars: 42 });
});

test('same UTC M5 window is selected independently of chart width and price magnitude', () => {
  const last = Date.UTC(2026, 9, 2, 14, 40) / 1000;
  for (const price of [1.325, 149.5, 2700]) {
    const bars = Array.from({ length: 750 }, (_, index) => ({ time: last - (749 - index) * 300, close: price }));
    const range = initialChartRange(bars.length, 42, 7);
    assert.equal(bars[range.from].time, Date.UTC(2026, 9, 2, 11, 15) / 1000);
    assert.equal(range.to - (bars.length - 1), 7);
  }
  assert.deepEqual(initialChartRange(10, 42, 7), { from: 0, to: 16 });
});
