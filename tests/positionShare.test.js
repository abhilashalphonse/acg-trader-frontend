import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPositionShareModel, formatSharePips, formatSharePnl } from '../src/utils/positionShare.js';

test('share model uses the live normalized position values shown in the terminal', () => {
  const position = {
    symbol: 'BTCUSD',
    side: 'SELL',
    volume: 0.8,
    entry: 81767.96,
    closePrice: 81786.05,
    pnl: -14.47,
    pnlCurrency: 'USD',
    margin: 72.35,
  };
  const instrument = { symbol: 'BTCUSD', displaySymbol: 'BTC/USD', pipSize: 0.01, digits: 2 };
  const model = buildPositionShareModel(position, instrument, new Date('2026-09-19T17:45:00Z'));

  assert.equal(model.symbol, 'BTC/USD');
  assert.equal(model.side, 'SELL');
  assert.equal(model.volume, 0.8);
  assert.equal(model.entryDisplay, '81767.96');
  assert.equal(model.currentDisplay, '81786.05');
  assert.equal(model.pnl, -14.47);
  assert.ok(Math.abs(model.roiPercent - (-20)) < 1e-9);
  assert.ok(Math.abs(model.pips - (-1809)) < 1e-9);
});

test('share model falls back to executable market side when closePrice is unavailable', () => {
  const buy = buildPositionShareModel(
    { symbol: 'EURUSD', side: 'BUY', volume: 1, entry: 1.1, pnl: 10, pnlCurrency: 'USD' },
    { symbol: 'EURUSD', displaySymbol: 'EUR/USD', bid: 1.101, ask: 1.1012, pipSize: 0.0001, digits: 5 },
  );
  const sell = buildPositionShareModel(
    { symbol: 'EURUSD', side: 'SELL', volume: 1, entry: 1.1, pnl: -12, pnlCurrency: 'USD' },
    { symbol: 'EURUSD', displaySymbol: 'EUR/USD', bid: 1.101, ask: 1.1012, pipSize: 0.0001, digits: 5 },
  );

  assert.equal(buy.currentPrice, 1.101);
  assert.equal(sell.currentPrice, 1.1012);
});

test('share formatting preserves sign and unrealized distance', () => {
  assert.match(formatSharePnl(125.4, 'USD'), /^\+\$125\.40$/);
  assert.match(formatSharePnl(-14.47, 'USD'), /^-\$14\.47$/);
  assert.equal(formatSharePips(12.345), '+12.3 pips');
  assert.equal(formatSharePips(-8.55), '-8.6 pips');
});


test('share model omits ROI when position margin is unavailable', () => {
  const model = buildPositionShareModel(
    { symbol: 'BTCUSD', side: 'BUY', volume: 0.25, entry: 80000, closePrice: 80100, pnl: 25, pnlCurrency: 'USD' },
    { symbol: 'BTCUSD', displaySymbol: 'BTC/USD', pipSize: 0.01, digits: 2 },
  );
  assert.equal(model.roiPercent, null);
});
