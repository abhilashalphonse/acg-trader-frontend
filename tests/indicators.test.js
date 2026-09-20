import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateIndicatorData,
  createIndicator,
  requiredIndicatorHistory,
} from '../src/utils/indicators.js';

function bar(time, price, volume = 1) {
  return { time, open: price, high: price, low: price, close: price, volume };
}

test('indicator history depth expands for long moving averages and caps at 1000 bars', () => {
  const ema500 = createIndicator('ema', { period: 500 });
  const sma200 = createIndicator('sma', { period: 200 });
  assert.equal(requiredIndicatorHistory([sma200], 'M1'), 220);
  assert.equal(requiredIndicatorHistory([ema500], 'M1'), 1000);
});

test('indicator history depth ignores indicators hidden on the current timeframe', () => {
  const ema500 = createIndicator('ema', { period: 500, timeframeVisibility: 'H1' });
  assert.equal(requiredIndicatorHistory([ema500], 'M1'), 160);
  assert.equal(requiredIndicatorHistory([ema500], 'H1'), 1000);
});

test('MACD requests enough history for slow EMA and signal warmup', () => {
  const macd = createIndicator('macd', { slow: 200, signal: 50 });
  assert.equal(requiredIndicatorHistory([macd], 'M1'), 650);
});

test('instrument-session VWAP resets at configured local session start', () => {
  const beforeSession = Math.floor(Date.parse('2026-09-20T03:44:00Z') / 1000); // 09:14 Asia/Kolkata
  const sessionOpen = Math.floor(Date.parse('2026-09-20T03:45:00Z') / 1000); // 09:15 Asia/Kolkata
  const indicator = createIndicator('vwap', { sessionReset: 'session', source: 'close' });
  const result = calculateIndicatorData(indicator, [
    bar(beforeSession, 100),
    bar(sessionOpen, 200),
  ], {
    instrument: { sessionTimezone: 'Asia/Kolkata', sessionStart: '09:15' },
  });

  assert.deepEqual(result.lines[0].data.map(point => point.value), [100, 200]);
});

test('session VWAP falls back deterministically to UTC when timezone metadata is absent', () => {
  const first = Math.floor(Date.parse('2026-09-20T23:59:00Z') / 1000);
  const second = Math.floor(Date.parse('2026-09-21T00:00:00Z') / 1000);
  const indicator = createIndicator('vwap', { sessionReset: 'session', source: 'close' });
  const result = calculateIndicatorData(indicator, [bar(first, 100), bar(second, 200)], { instrument: {} });
  assert.deepEqual(result.lines[0].data.map(point => point.value), [100, 200]);
});

test('legacy UTC-day VWAP behavior remains available', () => {
  const first = Math.floor(Date.parse('2026-09-20T03:44:00Z') / 1000);
  const second = Math.floor(Date.parse('2026-09-20T03:45:00Z') / 1000);
  const indicator = createIndicator('vwap', { sessionReset: 'utc-day', source: 'close' });
  const result = calculateIndicatorData(indicator, [bar(first, 100), bar(second, 200)], {
    instrument: { sessionTimezone: 'Asia/Kolkata', sessionStart: '09:15' },
  });
  assert.deepEqual(result.lines[0].data.map(point => point.value), [100, 150]);
});
