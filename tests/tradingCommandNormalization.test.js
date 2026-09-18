import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeExpiryToIso,
  normalizePriceToTick,
  normalizeProtectionPrice,
  normalizeTimeInForce,
  normalizeVolumeToStep,
  pendingPriceDirection,
} from '../src/utils/tradingCommandNormalization.js';

const eurusd = { tickSize: '0.00001', volumeStep: '0.01', minVolume: '0.01', maxVolume: '100' };
const xauusd = { tickSize: '0.01', volumeStep: '0.01', minVolume: '0.01', maxVolume: '100' };

test('volume is floored to instrument step', () => {
  assert.equal(normalizeVolumeToStep(23.80952380951888, eurusd), 23.8);
});

test('SELL TP rounds down and SELL SL rounds up', () => {
  assert.equal(normalizeProtectionPrice(1.148266, eurusd, 'SELL', 'tp'), 1.14826);
  assert.equal(normalizeProtectionPrice(1.148266, eurusd, 'SELL', 'sl'), 1.14827);
});

test('BUY TP rounds up and BUY SL rounds down', () => {
  assert.equal(normalizeProtectionPrice(4346.08655, xauusd, 'BUY', 'tp'), 4346.09);
  assert.equal(normalizeProtectionPrice(4346.08655, xauusd, 'BUY', 'sl'), 4346.08);
});

test('pending order directions preserve placement semantics', () => {
  assert.equal(pendingPriceDirection('limit', 'BUY'), 'down');
  assert.equal(pendingPriceDirection('limit', 'SELL'), 'up');
  assert.equal(pendingPriceDirection('stop', 'BUY'), 'up');
  assert.equal(pendingPriceDirection('stop', 'SELL'), 'down');
  assert.equal(pendingPriceDirection('stop-limit', 'BUY', 'limit'), 'up');
  assert.equal(pendingPriceDirection('stop-limit', 'SELL', 'limit'), 'down');
});

test('time in force is normalized for backend enums', () => {
  assert.equal(normalizeTimeInForce('Today'), 'TODAY');
  assert.equal(normalizeTimeInForce('Specified'), 'SPECIFIED');
});

test('datetime-local expiry becomes an offset-aware ISO timestamp', () => {
  const iso = normalizeExpiryToIso('2030-01-02T13:45');
  assert.ok(iso);
  assert.match(iso, /Z$/);
});

test('price normalization keeps exact tick alignment', () => {
  assert.equal(normalizePriceToTick(4349.2997399999995, xauusd, 'up'), 4349.3);
});
