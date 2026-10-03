export function resolveAuthoritativeSessionOpen({ realtimeStatus = null, gateway = null, quote = null, instrument = null } = {}) {
  if (typeof realtimeStatus?.sessionOpen === 'boolean') return realtimeStatus.sessionOpen;
  if (typeof gateway?.sessionOpen === 'boolean') return gateway.sessionOpen;
  if (typeof quote?.sessionOpen === 'boolean') return quote.sessionOpen;
  return instrument?.sessionOpen === true;
}

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


export function summarizeCloseAllResult(result, fallbackRequested = 0) {
  const rows = Array.isArray(result?.results) ? result.results : [];
  const count = status => rows.filter(item => String(item?.status || '').toUpperCase() === status).length;
  const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const closed = numeric(result?.closed, count('CLOSED'));
  const skipped = numeric(result?.skipped, count('SKIPPED_CLOSED_SESSION'));
  const failed = numeric(result?.failed, count('FAILED'));
  const requested = numeric(result?.requested, Math.max(fallbackRequested, closed + skipped + failed));
  const complete = result?.complete === true || (requested > 0 && closed === requested && skipped === 0 && failed === 0);

  if (complete) {
    return { complete: true, requested, closed, skipped: 0, failed: 0, message: 'All positions closed' };
  }

  const parts = [];
  if (closed > 0) parts.push(`${closed} closed`);
  if (skipped > 0) parts.push(`${skipped} market closed`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (!parts.length) parts.push('No positions were closed');

  return { complete: false, requested, closed, skipped, failed, message: parts.join(' · ') };
}
