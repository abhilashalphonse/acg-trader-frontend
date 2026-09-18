import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLocalPositionValuation,
  canUseLocalPositionValuation,
  positionPnlCurrency,
} from '../src/utils/positionValuation.js';

test('same-currency positions may use live local valuation', () => {
  const position = { side: 'BUY', quoteCurrency: 'USD', entryPrice: '1.1000', contractSize: '100000', openVolume: '0.1' };
  const instrument = { bid: 1.1010, ask: 1.1012, quoteCurrency: 'USD', marketState: 'LIVE', isStale: false };

  assert.equal(positionPnlCurrency(position, null, instrument), 'USD');
  assert.equal(canUseLocalPositionValuation(position, null, instrument, 'USD'), true);
  const valuation = calculateLocalPositionValuation(position, instrument);
  assert.ok(Math.abs(valuation.floatingPnl - 10) < 1e-9);
});

test('cross-currency positions never fabricate account-currency PnL locally', () => {
  const position = { side: 'BUY', quoteCurrency: 'JPY', entryPrice: '150', contractSize: '100000', openVolume: '0.1' };
  const instrument = { bid: 150.1, ask: 150.11, quoteCurrency: 'JPY', marketState: 'LIVE', isStale: false };

  assert.equal(positionPnlCurrency(position, null, instrument), 'JPY');
  assert.equal(canUseLocalPositionValuation(position, null, instrument, 'USD'), false);
});

test('stale or non-live quotes disable local position valuation', () => {
  const position = { side: 'SELL', quoteCurrency: 'USD', entryPrice: '1.1000', contractSize: '100000', openVolume: '0.1' };
  assert.equal(canUseLocalPositionValuation(position, null, { bid: 1.099, ask: 1.0992, quoteCurrency: 'USD', marketState: 'LIVE', isStale: true }, 'USD'), false);
  assert.equal(canUseLocalPositionValuation(position, null, { bid: 1.099, ask: 1.0992, quoteCurrency: 'USD', marketState: 'WAITING', isStale: false }, 'USD'), false);
});
