import test from 'node:test';
import assert from 'node:assert/strict';
import { INDICATOR_LIBRARY, createIndicator, indicatorVisibleOnTimeframe, calculateIndicatorData } from '../src/utils/indicators.js';
import { constrainDrawingPoint, drawingMagnetMode, indicatorValueAt, searchIndicators, settingsForSave, validateIndicatorSettings } from '../src/utils/chartToolSettings.js';

test('search finds full indicator names, abbreviations and multiple terms', () => {
  assert.deepEqual(searchIndicators(INDICATOR_LIBRARY, 'relative strength', 'All').map(x => x.id), ['rsi']);
  assert.deepEqual(searchIndicators(INDICATOR_LIBRARY, 'moving average', 'Trend').map(x => x.id), ['ema', 'sma']);
  assert.deepEqual(searchIndicators(INDICATOR_LIBRARY, '', 'Favorites', ['atr']).map(x => x.id), ['atr']);
});
test('invalid and partially edited inputs never pass Apply validation', () => {
  for (const period of ['', 'bad', 0, 501, 1.5, Infinity]) assert.ok(validateIndicatorSettings('ema', { period }));
  assert.equal(validateIndicatorSettings('ema', { period: '200' }), '');
  assert.ok(validateIndicatorSettings('macd', { fast: 30, slow: 20, signal: 9 }));
  assert.ok(validateIndicatorSettings('rsi', { period: 14, lowerGuide: 80, upperGuide: 20 }));
  assert.ok(validateIndicatorSettings('rsi', { period: 14, lowerGuide: '', upperGuide: 70 }));
  assert.ok(validateIndicatorSettings('volume', { timeframeVisibility: [] }));
  for (const { id, defaults } of INDICATOR_LIBRARY) assert.equal(validateIndicatorSettings(id, defaults), '', id);
});
test('visibility preserves multi-selection and recognizes desktop aliases', () => {
  const settings = settingsForSave({ period: '20', timeframeVisibility: ['1m', '1H'] });
  assert.deepEqual(settings, { period: 20, timeframeVisibility: ['M1', 'H1'] });
  const indicator = createIndicator('ema', settings);
  assert.equal(indicatorVisibleOnTimeframe(indicator, '1H'), true);
  assert.equal(indicatorVisibleOnTimeframe(indicator, 'M5'), false);
  assert.equal(indicatorVisibleOnTimeframe({ ...indicator, visible: false }, 'M1'), false);
});
test('Shift constrains a drawing to 45-degree increments without moving the origin', () => {
  const p = constrainDrawingPoint({ x: 10, y: 10 }, { x: 110, y: 18 }, true);
  assert.ok(Math.abs(p.y - 10) < 1e-8);
  const diagonal = constrainDrawingPoint({ x: 0, y: 0 }, { x: 50, y: 42 }, true);
  assert.ok(Math.abs(diagonal.x - diagonal.y) < 1e-8);
  const free = { x: 15, y: 18 };
  assert.equal(constrainDrawingPoint({ x: 0, y: 0 }, free, false), free);
});
test('modifier temporarily enables or disables magnet without changing preference', () => {
  assert.equal(drawingMagnetMode('off', true), 'weak');
  assert.equal(drawingMagnetMode('strong', true), 'off');
  assert.equal(drawingMagnetMode('strong', false), 'strong');
});
test('moving averages and bands have no fabricated values during warmup', () => {
  const bars = [1, 2, 3, 4, 5].map((close, i) => ({ time: i + 1, open: close, high: close, low: close, close, volume: 1 }));
  for (const id of ['ema', 'sma']) {
    const result = calculateIndicatorData(createIndicator(id, { period: 3 }), bars);
    assert.deepEqual(result.lines[0].data, [{ time: 3, value: 2 }, { time: 4, value: 3 }, { time: 5, value: 4 }]);
  }
  const bb = calculateIndicatorData(createIndicator('bollinger', { period: 3, deviation: 2 }), bars);
  assert.equal(bb.lines[0].data[0].time, 3);
  assert.ok(Math.abs(bb.lines[0].data[0].value - (2 + 2 * Math.sqrt(2 / 3))) < 1e-10);
});
test('MACD histogram becomes available after signal warmup', () => {
  const indicator = createIndicator('macd', { fast: 2, slow: 4, signal: 3 });
  const bars = Array.from({ length: 9 }, (_, i) => ({ time: i + 1, open: i + 1, high: i + 1, low: i + 1, close: i + 1 }));
  assert.deepEqual(calculateIndicatorData(indicator, bars.slice(0, 4)).histogram, []);
  const result = calculateIndicatorData(indicator, bars);
  assert.equal(result.histogram[0].time, 6);
  assert.ok(result.histogram.every(point => Number.isFinite(point.value)));
});

test('crosshair readout never substitutes a nearby bar for missing or warmup data', () => {
  const points = [{ time: 10, value: 20 }, { time: 12, value: 30 }, { time: 14, value: 40 }];
  assert.equal(indicatorValueAt(points, 12), 30);
  assert.equal(indicatorValueAt(points, 11), null);
  assert.equal(indicatorValueAt(points, 1), null);
  assert.equal(indicatorValueAt(points, null), 40);
  assert.equal(indicatorValueAt([], 12), null);
});
