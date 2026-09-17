const BLOCKED_ACCOUNT_STATUSES = new Set(['DISABLED', 'BREACHED', 'CLOSING', 'CLOSED']);
const PAUSED_ACCOUNT_STATUSES = new Set(['PAUSED']);
const BAD_MARKET_STATES = new Set(['ERROR', 'DISCONNECTED', 'DISABLED']);
const NON_LIVE_VALUATIONS = new Set(['WAITING', 'STALE']);

export function deriveTerminalStatus({
  authStatus,
  authenticated,
  connectionStatus,
  account,
  valuationStatus,
  marketStatus,
  activeMarket,
} = {}) {
  if (authStatus === 'bootstrapping' || authStatus === 'authenticating') {
    return status('SESSION_LOADING', 'info', 'Preparing trading session', 'Authenticating ACG Trader and restoring your account state.', true);
  }

  if (!authenticated) {
    return status('AUTH_REQUIRED', 'danger', 'Trading session required', 'Open ACG Trader from ACG Funded or sign in with your trading credentials.', true);
  }

  if (connectionStatus !== 'ready') {
    return status('REALTIME_RECONNECTING', 'warning', 'Realtime connection unavailable', 'Live account updates are reconnecting. New exposure is temporarily paused.', true);
  }

  if (!account?.id) {
    return status('ACCOUNT_LOADING', 'info', 'Loading trading account', 'Waiting for the authoritative account snapshot from ACG Trader.', true);
  }

  const accountStatus = String(account.status || 'UNKNOWN').toUpperCase();
  if (BLOCKED_ACCOUNT_STATUSES.has(accountStatus)) {
    return status(`ACCOUNT_${accountStatus}`, 'danger', `Account ${accountStatus.toLowerCase()}`, 'New trading is disabled for this account. Existing positions remain visible for permitted risk-reduction actions.', true);
  }

  if (PAUSED_ACCOUNT_STATUSES.has(accountStatus) || account.tradingEnabled === false) {
    return status('ACCOUNT_PAUSED', 'warning', 'Trading paused', 'New orders are disabled for this account. Existing positions remain visible for permitted risk-reduction actions.', true);
  }

  const normalizedMarket = String(activeMarket?.marketState || marketStatus || '').toUpperCase();
  if (BAD_MARKET_STATES.has(normalizedMarket)) {
    return status('MARKET_UNAVAILABLE', 'warning', 'Market data unavailable', 'Executable quotes are unavailable. New exposure is paused until the market gateway recovers.', true);
  }

  if (activeMarket?.sessionOpen === false) {
    return status('SESSION_CLOSED', 'info', 'Market session closed', `${activeMarket.displaySymbol || activeMarket.symbol || 'This instrument'} is outside its configured trading session.`, true);
  }

  if (activeMarket?.isStale || normalizedMarket === 'STALE') {
    return status('QUOTE_STALE', 'warning', 'Quote is stale', 'The selected instrument does not have a fresh executable quote. New exposure is paused.', true);
  }

  if (!activeMarket?.bid || activeMarket.bid === '—' || !activeMarket?.ask || activeMarket.ask === '—' || normalizedMarket === 'WAITING') {
    return status('QUOTE_WAITING', 'info', 'Waiting for executable quote', 'The terminal is connected and waiting for the first bid/ask update.', true);
  }

  const normalizedValuation = String(valuationStatus || account.valuationStatus || '').toUpperCase();
  if (NON_LIVE_VALUATIONS.has(normalizedValuation)) {
    const staleSymbols = Array.isArray(account.staleSymbols) && account.staleSymbols.length ? ` (${account.staleSymbols.join(', ')})` : '';
    return status(`VALUATION_${normalizedValuation}`, 'warning', `Account valuation ${normalizedValuation.toLowerCase()}`, `New exposure is paused until all open positions have executable valuation quotes${staleSymbols}.`, true);
  }

  return null;
}

export function canOpenExposure(input = {}) {
  return deriveTerminalStatus(input)?.blocksNewExposure !== true;
}

function status(code, severity, title, message, blocksNewExposure) {
  return Object.freeze({ code, severity, title, message, blocksNewExposure });
}
