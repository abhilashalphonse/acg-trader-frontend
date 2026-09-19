import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRiskSizedLots, estimatePositionPnlAtPrice, estimateStopRisk, positionDistancePips, riskSizingSupported } from '../src/utils/tradingRisk.js';
import { exposureAvailability } from '../src/utils/exposureAvailability.js';

const xau = { pnlCurrency: 'USD', quoteCurrency: 'USD', contractSize: 100 };
const eurusd = { pnlCurrency: 'USD', quoteCurrency: 'USD', contractSize: 100000 };
const usdjpy = { pnlCurrency: 'JPY', quoteCurrency: 'JPY', contractSize: 100000 };

test('risk sizing uses instrument contract size instead of a fixed pip-value assumption', () => {
  const plan = { entry: 2500, sl: 2499 };
  assert.equal(calculateRiskSizedLots(plan, 1, 10000, xau, 'USD'), 1);
  assert.equal(estimateStopRisk(plan, 1, xau, 'USD'), 100);
});

test('FX risk sizing is exact when P&L currency matches account currency', () => {
  const plan = { entry: 1.1, sl: 1.099 };
  const lots = calculateRiskSizedLots(plan, 1, 10000, eurusd, 'USD');
  assert.ok(Math.abs(lots - 1) < 1e-9);
});

test('risk percent sizing refuses to invent cross-currency conversion', () => {
  const plan = { entry: 150, sl: 149.9 };
  assert.equal(riskSizingSupported(usdjpy, 'USD'), false);
  assert.equal(calculateRiskSizedLots(plan, 1, 10000, usdjpy, 'USD'), null);
});

test('new exposure is blocked for uncertain execution state', () => {
  const result = exposureAvailability({
    account: { id: 'a1', status: 'ACTIVE', tradingEnabled: true, valuationStatus: 'LIVE' },
    connectionStatus: 'ready',
    market: { symbol: 'EURUSD', bid: '1.1', ask: '1.1001', sessionOpen: true, isStale: false, marketState: 'LIVE' },
    commandState: { uncertain: true },
  });
  assert.equal(result.allowed, false);
});

test('new exposure is allowed only with live account and executable market', () => {
  const result = exposureAvailability({
    account: { id: 'a1', status: 'ACTIVE', tradingEnabled: true, valuationStatus: 'LIVE' },
    connectionStatus: 'ready',
    market: { symbol: 'EURUSD', bid: '1.1', ask: '1.1001', sessionOpen: true, isStale: false, marketState: 'LIVE' },
    commandState: { uncertain: false },
  });
  assert.equal(result.allowed, true);
});


test('position protection preview calculates buy and sell P&L from contract size', () => {
  const btc = { pnlCurrency: 'USD', quoteCurrency: 'USD', contractSize: 1, pipSize: 0.01, tickSize: 0.01 };
  assert.equal(estimatePositionPnlAtPrice({ side: 'BUY', entry: 80000, volume: 0.5 }, 80100, btc), 50);
  assert.equal(estimatePositionPnlAtPrice({ side: 'SELL', entry: 80000, volume: 0.5 }, 79900, btc), 50);
  assert.equal(estimatePositionPnlAtPrice({ side: 'SELL', entry: 80000, volume: 0.5 }, 80100, btc), -50);
  assert.equal(positionDistancePips({ entry: 80000 }, 80001, btc), 100);
});

test('position protection preview prefers instrument tick value when provided', () => {
  const instrument = { tickSize: 0.25, tickValue: 12.5, contractSize: 999 };
  assert.equal(estimatePositionPnlAtPrice({ side: 'BUY', entry: 100, volume: 2 }, 100.5, instrument), 50);
});
