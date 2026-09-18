function currency(value) {
  return String(value || '').trim().toUpperCase();
}

export function positionPnlCurrency(position, valuation, instrument) {
  return currency(position?.quoteCurrency || valuation?.quoteCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency);
}

export function canUseLocalPositionValuation(position, valuation, instrument, accountCurrency) {
  const pnlCurrency = positionPnlCurrency(position, valuation, instrument);
  const normalizedAccountCurrency = currency(accountCurrency);
  if (!pnlCurrency || !normalizedAccountCurrency || pnlCurrency !== normalizedAccountCurrency) return false;
  if (instrument?.isStale === true) return false;
  const marketState = currency(instrument?.marketState);
  if (marketState && marketState !== 'LIVE') return false;
  return true;
}

export function calculateLocalPositionValuation(position, instrument) {
  const side = currency(position?.side);
  const closePrice = Number(side === 'BUY' ? instrument?.bid : instrument?.ask);
  const entryPrice = Number(position?.entryPrice);
  const contractSize = Number(position?.contractSize ?? instrument?.contractSize);
  const volume = Number(position?.openVolume);
  if (![closePrice, entryPrice, contractSize, volume].every(Number.isFinite) || contractSize <= 0 || volume <= 0) return null;
  const difference = side === 'BUY' ? closePrice - entryPrice : entryPrice - closePrice;
  return { closePrice, floatingPnl: difference * contractSize * volume };
}
