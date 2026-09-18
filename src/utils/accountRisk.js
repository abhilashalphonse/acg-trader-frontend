const DAILY_REFERENCE = 'DAILY_START_EQUITY';
const MAX_REFERENCE = 'INITIAL_BALANCE';

function finiteNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function calculateAccountRiskSummary(account, plannedRisk = 0) {
  const initialBalance = finiteNumber(account?.initialBalance, 0);
  const equity = finiteNumber(account?.equity, initialBalance);
  const dailyStartEquity = finiteNumber(account?.dailyStartEquity, equity);
  const dailyLossLimit = Math.max(0, finiteNumber(account?.dailyLossLimit, 0));
  const maxLossLimit = Math.max(0, finiteNumber(account?.maxLossLimit, 0));
  const profitTarget = Math.max(0, finiteNumber(account?.profitTarget, 0));
  const dailyReference = String(account?.dailyLossReference || account?.riskPolicy?.dailyLoss?.reference || DAILY_REFERENCE).toUpperCase();
  const maxReference = String(account?.maxLossReference || account?.riskPolicy?.maxLoss?.reference || MAX_REFERENCE).toUpperCase();
  const policySupported = dailyReference === DAILY_REFERENCE && maxReference === MAX_REFERENCE;

  // Mirrors ChallengeRiskEngine exactly:
  // breach when equity <= dailyStartEquity - dailyLossLimit
  // breach when equity <= initialBalance - maxLossLimit
  const dailyBreachEquity = dailyStartEquity - dailyLossLimit;
  const maxBreachEquity = initialBalance - maxLossLimit;
  const dailyLossUsed = Math.max(0, dailyStartEquity - equity);
  const maxLossUsed = Math.max(0, initialBalance - equity);
  const rawRemainingDaily = Math.max(0, equity - dailyBreachEquity);
  const rawRemainingMax = Math.max(0, equity - maxBreachEquity);
  const profit = Math.max(0, equity - initialBalance);

  const valuationLive = String(account?.valuationStatus || '').toUpperCase() === 'LIVE' && account?.complete !== false;
  // ChallengeRiskEngine only evaluates LIVE complete valuations. A non-live or
  // unsupported policy must never be presented as available risk room.
  const riskAvailabilityLive = valuationLive && policySupported;
  const remainingDaily = riskAvailabilityLive ? rawRemainingDaily : 0;
  const remainingMax = riskAvailabilityLive ? rawRemainingMax : 0;
  const numericPlannedRisk = Math.max(0, finiteNumber(plannedRisk, 0));
  const postTradeDaily = Math.max(0, remainingDaily - numericPlannedRisk);
  const postTradeMax = Math.max(0, remainingMax - numericPlannedRisk);

  return {
    policyVersion: 'challenge-risk-equity-threshold-v1',
    policySupported,
    valuationLive,
    riskAvailabilityLive,
    initialBalance,
    equity,
    dailyStartEquity,
    dailyLossLimit,
    maxLossLimit,
    profitTarget,
    dailyReference,
    maxReference,
    dailyBreachEquity,
    maxBreachEquity,
    dailyLossUsed,
    maxLossUsed,
    profit,
    rawRemainingDaily,
    rawRemainingMax,
    remainingDaily,
    remainingMax,
    postTradeDaily,
    postTradeMax,
  };
}
