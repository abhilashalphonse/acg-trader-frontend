import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenPositionSummary, resolvePositionClosePrice } from '../src/utils/openPositionPresentation.js';

const instrument = {
  bid: 1.14279,
  ask: 1.14283,
  pipSize: 0.0001,
  tickSize: 0.00001,
  contractSize: 100000,
};

test('SELL open position uses executable ask as current price when valuation close price is absent', () => {
  assert.equal(resolvePositionClosePrice({ side: 'SELL' }, instrument), 1.14283);
});

test('BUY open position uses executable bid as current price when valuation close price is absent', () => {
  assert.equal(resolvePositionClosePrice({ side: 'BUY' }, instrument), 1.14279);
});

test('open position summary exposes margin, account-relative PnL and unprotected risk state', () => {
  const summary = buildOpenPositionSummary({
    side: 'SELL',
    volume: 5,
    entry: 1.14278,
    pnl: -25,
    margin: 5714,
    sl: null,
    tp: null,
  }, {
    equity: 100000,
    balance: 100000,
  }, instrument);

  assert.equal(summary.currentPrice, 1.14283);
  assert.equal(summary.margin, 5714);
  assert.equal(summary.pnlPercent, -0.025);
  assert.equal(summary.riskStatus, 'UNPROTECTED');
  assert.equal(summary.riskAmount, null);
});

test('stop-loss risk is measured from entry and becomes protected beyond break even', () => {
  const risky = buildOpenPositionSummary({
    side: 'SELL',
    volume: 5,
    entry: 1.14278,
    pnl: 0,
    margin: 5714,
    sl: 1.14378,
    tp: 1.14078,
  }, { equity: 100000 }, instrument);

  assert.equal(risky.riskStatus, 'ACTIVE');
  assert.equal(risky.riskAmount, 500);
  assert.equal(risky.riskPercent, 0.5);
  assert.equal(risky.sl.pips, 10);
  assert.equal(risky.tp.pips, 20);

  const protectedPosition = buildOpenPositionSummary({
    side: 'SELL',
    volume: 5,
    entry: 1.14278,
    pnl: 100,
    margin: 5714,
    sl: 1.14178,
  }, { equity: 100000 }, instrument);

  assert.equal(protectedPosition.riskStatus, 'PROTECTED');
  assert.equal(protectedPosition.riskAmount, 0);
  assert.equal(protectedPosition.riskPercent, 0);
});
