import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatInstrumentPrice,
  formatSpreadDisplay,
  instrumentDigits,
  instrumentPipSize,
  instrumentTickSize,
} from '../src/utils/instrumentFormatting.js';

test('formats FX, JPY, metals and indices from catalog metadata', () => {
  const eurusd = { digits: 5, tickSize: 0.00001, pipSize: 0.0001 };
  const usdjpy = { digits: 3, tickSize: 0.001, pipSize: 0.01 };
  const gold = { digits: 2, tickSize: 0.01, pipSize: 0.1 };
  const us30 = { digits: 1, tickSize: 0.1, pipSize: 1 };

  assert.equal(formatInstrumentPrice(1.084567, eurusd), '1.08457');
  assert.equal(formatInstrumentPrice(149.1236, usdjpy), '149.124');
  assert.equal(formatInstrumentPrice(2650.126, gold), '2650.13');
  assert.equal(formatInstrumentPrice(42123.26, us30), '42123.3');
  assert.equal(instrumentPipSize(usdjpy), 0.01);
  assert.equal(instrumentTickSize(gold), 0.01);
});

test('derives precision from tick metadata when digits is absent', () => {
  const instrument = { tickSize: 0.000001, pipSize: 0.00001 };
  assert.equal(instrumentDigits(instrument), 6);
  assert.equal(formatInstrumentPrice(1.1234567, instrument), '1.123457');
});


test('formats crypto spread as quote-currency price distance', () => {
  const btcusd = {
    symbol: 'BTC/USD',
    assetClass: 'CRYPTO',
    digits: 2,
    tickSize: 0.01,
    pipSize: 0.01,
  };

  assert.equal(formatSpreadDisplay(84035.64, 84037.64, btcusd), '$2.00');
});

test('keeps non-crypto spread in instrument points', () => {
  const eurusd = {
    symbol: 'EUR/USD',
    assetClass: 'FOREX',
    digits: 5,
    tickSize: 0.00001,
    pipSize: 0.0001,
  };

  assert.equal(formatSpreadDisplay(1.08450, 1.08462, eurusd), '1.2p');
});
