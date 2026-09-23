import { estimatePositionPnlAtPrice, positionDistancePips } from './tradingRisk.js';

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumber(value) {
  const number = finiteNumber(value);
  return number != null && number > 0 ? number : null;
}

export function resolvePositionClosePrice(position, instrument) {
  const valued = positiveNumber(position?.closePrice);
  if (valued != null) return valued;
  const side = String(position?.side || '').toUpperCase();
  const fallback = side === 'BUY' ? instrument?.bid : side === 'SELL' ? instrument?.ask : null;
  return positiveNumber(fallback);
}

function projection(position, target, instrument) {
  const price = positiveNumber(target);
  if (price == null || !instrument) return null;
  const pnl = finiteNumber(estimatePositionPnlAtPrice(position, price, instrument));
  const pips = finiteNumber(positionDistancePips(position, price, instrument));
  return { price, pnl, pips };
}

export function buildOpenPositionSummary(position = {}, account = {}, instrument = null) {
  const pnl = finiteNumber(position?.pnl);
  const accountBasis = positiveNumber(account?.equity)
    ?? positiveNumber(account?.balance)
    ?? positiveNumber(account?.initialBalance);
  const pnlPercent = pnl != null && accountBasis != null ? pnl / accountBasis * 100 : null;
  const currentPrice = resolvePositionClosePrice(position, instrument);
  const margin = finiteNumber(position?.margin);
  const sl = projection(position, position?.sl, instrument);
  const tp = projection(position, position?.tp, instrument);

  let riskStatus = 'UNPROTECTED';
  let riskAmount = null;
  let riskPercent = null;
  if (sl) {
    if (sl.pnl == null) {
      riskStatus = 'PROTECTED';
    } else if (sl.pnl >= 0) {
      riskStatus = 'PROTECTED';
      riskAmount = 0;
      riskPercent = 0;
    } else {
      riskStatus = 'ACTIVE';
      riskAmount = Math.abs(sl.pnl);
      riskPercent = accountBasis != null ? riskAmount / accountBasis * 100 : null;
    }
  }

  return {
    currentPrice,
    pnl,
    pnlPercent,
    margin,
    sl,
    tp,
    riskStatus,
    riskAmount,
    riskPercent,
  };
}
