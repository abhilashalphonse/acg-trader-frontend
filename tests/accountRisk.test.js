import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAccountRiskSummary } from '../src/utils/accountRisk.js';

const account = {
  initialBalance: 100000,
  equity: 98000,
  dailyStartEquity: 102000,
  dailyLossLimit: 5000,
  dailyLossReference: 'DAILY_START_EQUITY',
  maxLossLimit: 10000,
  maxLossReference: 'INITIAL_BALANCE',
  profitTarget: 10000,
  valuationStatus: 'LIVE',
  complete: true,
};

test('matches backend ChallengeRiskEngine equity thresholds', () => {
  const risk = calculateAccountRiskSummary(account, 500);
  assert.equal(risk.dailyBreachEquity, 97000);
  assert.equal(risk.maxBreachEquity, 90000);
  assert.equal(risk.dailyLossUsed, 4000);
  assert.equal(risk.maxLossUsed, 2000);
  assert.equal(risk.remainingDaily, 1000);
  assert.equal(risk.remainingMax, 8000);
  assert.equal(risk.postTradeDaily, 500);
  assert.equal(risk.riskAvailabilityLive, true);
});

test('never advertises available risk when valuation is not LIVE', () => {
  const risk = calculateAccountRiskSummary({ ...account, valuationStatus: 'STALE' }, 100);
  assert.equal(risk.rawRemainingDaily, 1000);
  assert.equal(risk.remainingDaily, 0);
  assert.equal(risk.remainingMax, 0);
  assert.equal(risk.riskAvailabilityLive, false);
});

test('never advertises risk for an unsupported policy reference', () => {
  const risk = calculateAccountRiskSummary({ ...account, dailyLossReference: 'BALANCE' });
  assert.equal(risk.policySupported, false);
  assert.equal(risk.remainingDaily, 0);
  assert.equal(risk.remainingMax, 0);
});
