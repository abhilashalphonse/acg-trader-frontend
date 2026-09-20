import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCandle } from '../src/services/marketData.js';

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

test('does not turn unavailable provider volume into zero or tick volume', () => {
  const normalized = normalizeCandle(candle());
  assert.equal(normalized.providerVolume, null);
  assert.equal(normalized.tickCount, 17);
  assert.equal(normalized.volume, null);
  assert.equal(normalized.volumeSource, null);
});

test('uses provider volume when the candle supplies it', () => {
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
