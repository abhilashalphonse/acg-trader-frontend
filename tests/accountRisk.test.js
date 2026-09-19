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
  assert.equal(risk.dailyLossPercent, 4);
  assert.equal(risk.maxLossPercent, 2);
  assert.equal(risk.dailyLimitUsedPercent, 80);
  assert.equal(risk.maxLimitUsedPercent, 20);
  assert.equal(risk.profitProgressPercent, 0);
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

test('separates account loss percentage from challenge-limit utilization', () => {
  const risk = calculateAccountRiskSummary({
    ...account,
    dailyStartEquity: 100000,
    equity: 99880,
  });

  assert.equal(risk.dailyLossUsed, 120);
  assert.equal(risk.maxLossUsed, 120);
  assert.equal(risk.dailyLossPercent, 0.12);
  assert.equal(risk.maxLossPercent, 0.12);
  assert.equal(risk.dailyLimitUsedPercent, 2.4);
  assert.equal(risk.maxLimitUsedPercent, 1.2);
  assert.equal(risk.remainingDaily, 4880);
});
