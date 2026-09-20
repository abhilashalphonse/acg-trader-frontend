import { calculateAccountRiskSummary } from './accountRisk.js';
import { estimateStopRisk } from './tradingRisk.js';

export const DEFAULT_RISK_GUARD_SETTINGS = Object.freeze({
  enabled: true,
  mode: 'warn',
  maxRiskPerTrade: 1,
  maxOpenRisk: 2,
  dailyStopPercent: 2.5,
  maxConsecutiveLosses: 3,
});

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function instrumentFor(markets, symbol) {
  const key = String(symbol || '').toUpperCase();
  return (Array.isArray(markets) ? markets : []).find(item => String(item?.symbol || '').toUpperCase() === key) || null;
}

function positionRisk(position, instrument, accountCurrency) {
  if (!position || position.sl == null || !instrument) return null;
  return estimateStopRisk(
    {
      entry: position.entry ?? position.entryPrice,
      sl: position.sl,
      side: String(position.side || '').toLowerCase(),
    },
    position.volume ?? position.lots,
    instrument,
    accountCurrency,
  );
}

function consecutiveLosses(history = []) {
  let count = 0;
  for (const item of Array.isArray(history) ? history : []) {
    const pnl = finite(item?.pnl);
    if (pnl == null) continue;
    if (pnl < 0) count += 1;
    else break;
  }
  return count;
}

export function calculateOpenRisk({ account, positions = [], markets = [] }) {
  const currency = account?.currency;
  let total = 0;
  let measured = 0;
  let unprotected = 0;

  for (const position of Array.isArray(positions) ? positions : []) {
    const instrument = instrumentFor(markets, position?.symbol);
    const risk = positionRisk(position, instrument, currency);
    if (Number.isFinite(risk)) {
      total += Math.max(0, risk);
      measured += 1;
    } else {
      unprotected += 1;
    }
  }

  const equity = finite(account?.equity);
  return {
    amount: total,
    percent: equity && equity > 0 ? total / equity * 100 : null,
    measuredPositions: measured,
    unprotectedPositions: unprotected,
  };
}

export function evaluateRiskGuard({
  account = {},
  positions = [],
  positionHistory = [],
  markets = [],
  proposedRisk = null,
  settings = DEFAULT_RISK_GUARD_SETTINGS,
} = {}) {
  const normalized = { ...DEFAULT_RISK_GUARD_SETTINGS, ...(settings || {}) };
  const enabled = normalized.enabled === true;
  const mode = normalized.mode === 'block' ? 'block' : 'warn';
  const equity = finite(account?.equity);
  const risk = finite(proposedRisk);
  const tradeRiskPercent = equity && equity > 0 && risk != null ? Math.max(0, risk) / equity * 100 : null;
  const openRisk = calculateOpenRisk({ account, positions, markets });
  const projectedOpenRisk = Number.isFinite(openRisk.amount) && risk != null ? openRisk.amount + Math.max(0, risk) : openRisk.amount;
  const projectedOpenRiskPercent = equity && equity > 0 ? projectedOpenRisk / equity * 100 : null;
  const challenge = calculateAccountRiskSummary(account, risk || 0);
  const losses = consecutiveLosses(positionHistory);

  const findings = [];
  const add = (code, message, severity = 'warning') => findings.push({ code, message, severity });

  if (enabled) {
    if (Number.isFinite(tradeRiskPercent) && finite(normalized.maxRiskPerTrade) > 0 && tradeRiskPercent > Number(normalized.maxRiskPerTrade) + 1e-8) {
      add('MAX_RISK_PER_TRADE', `Trade risk ${tradeRiskPercent.toFixed(2)}% exceeds your ${Number(normalized.maxRiskPerTrade).toFixed(2)}% per-trade limit.`, 'limit');
    }

    if (Number.isFinite(projectedOpenRiskPercent) && finite(normalized.maxOpenRisk) > 0 && projectedOpenRiskPercent > Number(normalized.maxOpenRisk) + 1e-8) {
      add('MAX_OPEN_RISK', `Projected open risk ${projectedOpenRiskPercent.toFixed(2)}% exceeds your ${Number(normalized.maxOpenRisk).toFixed(2)}% total-risk limit.`, 'limit');
    }

    if (finite(normalized.dailyStopPercent) > 0 && Number(challenge.dailyLossPercent) >= Number(normalized.dailyStopPercent) - 1e-8) {
      add('DAILY_STOP', `Today's drawdown ${Number(challenge.dailyLossPercent).toFixed(2)}% has reached your ${Number(normalized.dailyStopPercent).toFixed(2)}% daily stop.`, 'limit');
    }

    if (finite(normalized.maxConsecutiveLosses) > 0 && losses >= Number(normalized.maxConsecutiveLosses)) {
      add('LOSS_STREAK', `${losses} consecutive losing trades reached your loss-streak guard.`, 'limit');
    }

    if (openRisk.unprotectedPositions > 0) {
      add('UNMEASURED_OPEN_RISK', `${openRisk.unprotectedPositions} open position${openRisk.unprotectedPositions === 1 ? '' : 's'} do not have measurable stop-loss risk, so total open risk is incomplete.`);
    }

    if (risk == null) {
      add('UNMEASURED_TRADE_RISK', 'This order has no measurable stop-loss risk yet. Risk Guard cannot calculate per-trade or projected open risk.');
    }

    if (challenge.riskAvailabilityLive && risk != null && risk >= challenge.remainingDaily) {
      add('DAILY_CHALLENGE_BUFFER', 'This stop would consume the remaining challenge daily-loss buffer.', 'limit');
    }

    if (challenge.riskAvailabilityLive && risk != null && risk >= challenge.remainingMax) {
      add('MAX_CHALLENGE_BUFFER', 'This stop would consume the remaining challenge max-loss buffer.', 'limit');
    }
  }

  const limitFindings = findings.filter(item => item.severity === 'limit');
  const blocks = enabled && mode === 'block' ? limitFindings : [];
  const warnings = enabled ? findings.filter(item => mode !== 'block' || item.severity !== 'limit') : [];

  return {
    enabled,
    mode,
    allowed: blocks.length === 0,
    blocks,
    warnings,
    findings,
    tradeRisk: risk,
    tradeRiskPercent,
    openRiskAmount: openRisk.amount,
    openRiskPercent: openRisk.percent,
    projectedOpenRiskAmount: projectedOpenRisk,
    projectedOpenRiskPercent,
    unprotectedPositions: openRisk.unprotectedPositions,
    consecutiveLosses: losses,
    projectedDailyRemaining: challenge.riskAvailabilityLive ? challenge.postTradeDaily : null,
    projectedMaxRemaining: challenge.riskAvailabilityLive ? challenge.postTradeMax : null,
    dailyLossPercent: challenge.dailyLossPercent,
  };
}
