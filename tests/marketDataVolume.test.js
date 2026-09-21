import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCandle, normalizeCandleSeries } from '../src/utils/candleNormalization.js';
import { mergeLiveCandleIntoSeries } from '../src/services/marketData.js';

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

test('uses tick volume when provider volume is zero but live ticks exist', () => {
  const normalized = normalizeCandle(candle({ providerVolume: '0', tickCount: 17 }));
  assert.equal(normalized.providerVolume, 0);
  assert.equal(normalized.tickCount, 17);
  assert.equal(normalized.volume, 17);
  assert.equal(normalized.volumeSource, 'tick');
});

test('preserves a true zero-volume candle when neither provider nor ticks report activity', () => {
  const normalized = normalizeCandle(candle({ providerVolume: '0', tickCount: 0 }));
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


test('live candle updates preserve the strongest available volume baseline', () => {
  const history = [normalizeCandle(candle({ time: 1_700_000_000, providerVolume: 120, tickCount: 0 }))];
  const live = candle({ time: 1_700_000_000, providerVolume: 8, tickCount: 14, close: 104 });
  const merged = mergeLiveCandleIntoSeries(history, live, 10);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].providerVolume, 120);
  assert.equal(merged[0].volume, 120);
  assert.equal(merged[0].volumeSource, 'provider');
  assert.equal(merged[0].close, 104);
});

test('live candle updates fall back to growing tick volume when provider volume is unavailable', () => {
  const history = [normalizeCandle(candle({ time: 1_700_000_000, providerVolume: 0, tickCount: 5 }))];
  const live = candle({ time: 1_700_000_000, providerVolume: 0, tickCount: 14, close: 104 });
  const merged = mergeLiveCandleIntoSeries(history, live, 10);

  assert.equal(merged[0].providerVolume, null);
  assert.equal(merged[0].tickCount, 14);
  assert.equal(merged[0].volume, 14);
  assert.equal(merged[0].volumeSource, 'tick');
});
