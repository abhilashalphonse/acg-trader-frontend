import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRiskGuard } from '../src/utils/riskGuard.js';

const account = {
  currency: 'USD',
  equity: 10000,
  initialBalance: 10000,
  dailyStartEquity: 10000,
  dailyLossLimit: 500,
  maxLossLimit: 1000,
  valuationStatus: 'LIVE',
  complete: true,
};

const eurusd = {
  symbol: 'EURUSD',
  quoteCurrency: 'USD',
  pnlCurrency: 'USD',
  contractSize: 100000,
  tickSize: 0.00001,
  pipSize: 0.0001,
};

test('warn mode surfaces unknown risk without blocking execution', () => {
  const result = evaluateRiskGuard({
    account,
    positions: [{ symbol: 'EURUSD', entry: 1.1, volume: 1, sl: null }],
    markets: [eurusd],
    proposedRisk: null,
    settings: { enabled: true, mode: 'warn', maxRiskPerTrade: 1, maxOpenRisk: 2, dailyStopPercent: 2.5, maxConsecutiveLosses: 3 },
  });

  assert.equal(result.allowed, true);
  assert.ok(result.warnings.some(item => item.code === 'UNMEASURED_OPEN_RISK'));
  assert.ok(result.warnings.some(item => item.code === 'UNMEASURED_TRADE_RISK'));
});

test('block mode rejects new exposure when stop risk cannot be measured', () => {
  const result = evaluateRiskGuard({
    account,
    positions: [{ symbol: 'EURUSD', entry: 1.1, volume: 1, sl: null }],
    markets: [eurusd],
    proposedRisk: null,
    settings: { enabled: true, mode: 'block', maxRiskPerTrade: 1, maxOpenRisk: 2, dailyStopPercent: 2.5, maxConsecutiveLosses: 3 },
  });

  assert.equal(result.allowed, false);
  assert.ok(result.blocks.some(item => item.code === 'UNMEASURED_OPEN_RISK'));
  assert.ok(result.blocks.some(item => item.code === 'UNMEASURED_TRADE_RISK'));
});

test('block mode enforces per-trade and projected total open-risk limits', () => {
  const result = evaluateRiskGuard({
    account,
    positions: [{ symbol: 'EURUSD', entry: 1.1, volume: 1, sl: 1.099 }],
    markets: [eurusd],
    proposedRisk: 150,
    settings: { enabled: true, mode: 'block', maxRiskPerTrade: 1, maxOpenRisk: 2, dailyStopPercent: 2.5, maxConsecutiveLosses: 3 },
  });

  assert.equal(result.allowed, false);
  assert.ok(result.blocks.some(item => item.code === 'MAX_RISK_PER_TRADE'));
  assert.ok(result.blocks.some(item => item.code === 'MAX_OPEN_RISK'));
});
