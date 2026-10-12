// Owner audit is never enabled by a query parameter alone. Both the
// production build switch and explicit URL opt-in must be present.
export function isChartOrderAuditEnabled(buildFlag, search = '') {
  return buildFlag === 'true' && new URLSearchParams(search).get('acg_v4_audit') === '1';
}

// Presentation-only contracts for in-chart order levels. Trading decisions stay on the server.
export function chartLineStyle({ draft = false, preview = false } = {}) {
  return draft || preview ? 'dotted' : 'solid';
}

export function chartEntryReference({ pending = false, orderType = '', entry = null, limitPrice = null } = {}) {
  const normalized = String(orderType || '').toLowerCase().replace('_', '-');
  const limit = Number(limitPrice);
  const main = Number(entry);
  if (pending && normalized === 'stop-limit' && Number.isFinite(limit) && limit > 0) return limit;
  return Number.isFinite(main) && main > 0 ? main : null;
}

// Percentage here means change in instrument price, NOT percentage of account equity.
export function chartPriceChangePercent(reference, price) {
  const first = Number(reference);
  const second = Number(price);
  if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(second) || second <= 0) return null;
  return Math.abs((second - first) / first * 100);
}

export function chartEstimateCurrencySupported(instrument, accountCurrency) {
  const currency = String(accountCurrency || '').toUpperCase();
  const quote = String(instrument?.pnlCurrency || instrument?.quoteCurrency || '').toUpperCase();
  return Boolean(currency && quote && currency === quote);
}

/** Position protection chips reflect server-accepted levels, not draft values. */
export function chartPositionProtections(position) {
  const valid = price => price !== null && price !== undefined && price !== '' && Number.isFinite(Number(price)) && Number(price) > 0;
  return Object.freeze({ sl: valid(position?.sl), tp: valid(position?.tp) });
}

/** Accepted pending orders use side color independent of LIMIT vs STOP. */
export function chartPlacedSideColor(side) {
  return String(side || '').toUpperCase() === 'BUY' ? '#12b996' : '#ef5664';
}

/** Y coordinates for a hovered position's actual accepted price group. */
export function chartPositionConnectorLevels(position, priceToY) {
  if (!position || typeof priceToY !== 'function') return [];
  const protections = chartPositionProtections(position);
  const entryPrice = position.entry ?? position.entryPrice;
  const keys = [['entry', entryPrice], ...(protections.sl ? [['sl', position.sl]] : []), ...(protections.tp ? [['tp', position.tp]] : [])];
  return keys.map(([kind, price]) => ({ kind, y: priceToY(Number(price)) }))
    .filter(level => Number.isFinite(level.y));
}
