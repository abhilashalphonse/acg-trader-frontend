import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCandle, normalizeCandleSeries } from '../src/utils/candleNormalization.js';

function candle(overrides = {}) {
  return {
    time: 1_700_000_000,
    open: '100',
    high: '105',
    low: '99',
    close: '103',
    providerVolume: null,
    tickCount: 17,
    complete: false,
    synthetic: false,
    ...overrides,
  };
}

test('uses tick volume when provider volume is unavailable', () => {
  const normalized = normalizeCandle(candle());
  assert.equal(normalized.providerVolume, null);
  assert.equal(normalized.tickCount, 17);
  assert.equal(normalized.volume, 17);
  assert.equal(normalized.volumeSource, 'tick');
});

test('prefers provider volume when the candle supplies it', () => {
  const normalized = normalizeCandle(candle({ providerVolume: '1245.5' }));
  assert.equal(normalized.providerVolume, 1245.5);
  assert.equal(normalized.volume, 1245.5);
  assert.equal(normalized.volumeSource, 'provider');
});

test('preserves a real zero provider-volume value', () => {
  const normalized = normalizeCandle(candle({ providerVolume: '0' }));
  assert.equal(normalized.providerVolume, 0);
  assert.equal(normalized.volume, 0);
  assert.equal(normalized.volumeSource, 'provider');
});

test('normalizes millisecond timestamps to unix seconds', () => {
  const normalized = normalizeCandle(candle({ time: 1_700_000_000_123 }));
  assert.equal(normalized.time, 1_700_000_000);
});

test('repairs wick bounds so open and close are contained by the candle', () => {
  const normalized = normalizeCandle(candle({ high: 102, low: 101, open: 100, close: 103 }));
  assert.equal(normalized.high, 103);
  assert.equal(normalized.low, 100);
});

test('rejects an inverted provider high-low range', () => {
  assert.equal(normalizeCandle(candle({ high: 98, low: 106 })), null);
});

test('sorts candles and keeps the latest duplicate timestamp', () => {
  const bars = normalizeCandleSeries([
    candle({ time: 30, close: 101 }),
    candle({ time: 10, close: 99 }),
    candle({ time: 30, close: 104 }),
    candle({ time: 20, close: 102 }),
  ]);
  assert.deepEqual(bars.map(bar => bar.time), [10, 20, 30]);
  assert.equal(bars[2].close, 104);
});
