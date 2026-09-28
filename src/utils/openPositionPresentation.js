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

export function minimumPositionProtectionDistance(instrument) {
  const tick = positiveNumber(instrument?.tickSize);
  const pip = positiveNumber(instrument?.pipSize) ?? tick;

  const direct = positiveNumber(
    instrument?.minStopDistancePrice
      ?? instrument?.minimumStopDistancePrice
  );
  if (direct != null) return direct;

  const points = positiveNumber(
    instrument?.stopsLevel
      ?? instrument?.stopLevel
      ?? instrument?.minStopDistancePoints
      ?? instrument?.minimumStopDistancePoints
  );
  if (points != null && tick != null) return points * tick;

  const pips = positiveNumber(
    instrument?.minStopDistancePips
      ?? instrument?.minimumStopDistancePips
  );
  if (pips != null && pip != null) return pips * pip;

  const generic = positiveNumber(instrument?.minStopDistance ?? instrument?.minimumStopDistance);
  const genericUnit = String(
    instrument?.minStopDistanceUnit
      ?? instrument?.minimumStopDistanceUnit
      ?? ''
  ).trim().toUpperCase();
  if (generic != null && genericUnit === 'PRICE') return generic;
  if (generic != null && ['POINT', 'POINTS'].includes(genericUnit) && tick != null) return generic * tick;
  if (generic != null && ['PIP', 'PIPS'].includes(genericUnit) && pip != null) return generic * pip;

  return tick ?? 0;
}

export function validateOpenPositionProtection(position = {}, instrument = null, patch = {}) {
  const side = String(position?.side || '').toUpperCase();
  if (!['BUY', 'SELL'].includes(side)) {
    return { ok: false, message: 'Position side is unavailable.', executablePrice: null, minDistance: null };
  }

  const executablePrice = resolvePositionClosePrice(position, instrument);
  if (executablePrice == null) {
    return { ok: false, message: 'Current executable price is unavailable.', executablePrice: null, minDistance: null };
  }

  const minDistance = minimumPositionProtectionDistance(instrument);
  const tick = positiveNumber(instrument?.tickSize) ?? 0;
  const epsilon = Math.max(tick * 1e-6, Number.EPSILON * Math.max(1, executablePrice));

  const validateField = (field, raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return field === 'sl' ? 'Enter a valid stop-loss price.' : 'Enter a valid take-profit price.';
    }

    if (side === 'BUY' && field === 'sl' && value > executablePrice - minDistance + epsilon) {
      return `BUY stop loss must be at least ${minDistance > 0 ? minDistance : tick} below the current Bid.`;
    }
    if (side === 'BUY' && field === 'tp' && value < executablePrice + minDistance - epsilon) {
      return `BUY take profit must be at least ${minDistance > 0 ? minDistance : tick} above the current Bid.`;
    }
    if (side === 'SELL' && field === 'sl' && value < executablePrice + minDistance - epsilon) {
      return `SELL stop loss must be at least ${minDistance > 0 ? minDistance : tick} above the current Ask.`;
    }
    if (side === 'SELL' && field === 'tp' && value > executablePrice - minDistance + epsilon) {
      return `SELL take profit must be at least ${minDistance > 0 ? minDistance : tick} below the current Ask.`;
    }
    return null;
  };

  for (const field of ['sl', 'tp']) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const message = validateField(field, patch[field]);
    if (message) return { ok: false, message, executablePrice, minDistance };
  }

  return { ok: true, message: '', executablePrice, minDistance };
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
