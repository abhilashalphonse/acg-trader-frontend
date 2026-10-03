export function isMarketSessionClosed(market) {
  const state = String(market?.marketState || '').toUpperCase();
  return market?.sessionOpen === false || state === 'CLOSED';
}

export function positionCloseAvailability(market) {
  if (!market?.symbol) {
    return { allowed: false, code: 'MARKET_STATUS_UNAVAILABLE', reason: 'Market status is unavailable.' };
  }
  if (isMarketSessionClosed(market)) {
    return { allowed: false, code: 'MARKET_CLOSED', reason: 'Market closed · closing resumes when the session opens.' };
  }
  if (market?.isStale === true) {
    return { allowed: false, code: 'QUOTE_STALE', reason: 'Waiting for a live executable quote.' };
  }

  const state = String(market?.marketState || '').toUpperCase();
  if (['WAITING', 'STALE', 'DISCONNECTED', 'ERROR', 'DISABLED', 'UNAVAILABLE', 'SUBSCRIPTION_ERROR'].includes(state)) {
    return { allowed: false, code: 'MARKET_DATA_UNAVAILABLE', reason: 'Waiting for executable market data.' };
  }

  const bid = Number(market?.bid);
  const ask = Number(market?.ask);
  if (!Number.isFinite(bid) || bid <= 0 || !Number.isFinite(ask) || ask <= 0 || ask < bid) {
    return { allowed: false, code: 'QUOTE_UNAVAILABLE', reason: 'Waiting for executable bid/ask.' };
  }

  return { allowed: true, code: 'READY', reason: '' };
}

export function marketForSymbol(markets, symbol, fallback = null) {
  const canonical = String(symbol || '').toUpperCase();
  return (Array.isArray(markets) ? markets : []).find(item => String(item?.symbol || '').toUpperCase() === canonical) || fallback;
}
