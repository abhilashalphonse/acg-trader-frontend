export function exposureAvailability({ account, connectionStatus, market, commandState } = {}) {
  if (commandState?.accountSwitching) return { allowed: false, reason: commandState?.accountSwitchError || 'Switching account — loading valuation, positions, orders, history and risk state' };
  if (commandState?.uncertain) return { allowed: false, reason: 'Reconciling an execution with unknown transport status' };
  if (connectionStatus !== 'ready') return { allowed: false, reason: 'Realtime account connection is unavailable' };
  if (!account?.id) return { allowed: false, reason: 'Trading account is still loading' };
  if (String(account.status || '').toUpperCase() !== 'ACTIVE') return { allowed: false, reason: `Account is ${String(account.status || 'unavailable').toLowerCase()}` };
  if (account.tradingEnabled !== true) return { allowed: false, reason: 'Trading is paused for this account' };
  if (String(account.valuationStatus || '').toUpperCase() !== 'LIVE') return { allowed: false, reason: 'Account valuation is not live' };
  if (!market?.symbol) return { allowed: false, reason: 'No instrument is selected' };
  if (market.sessionOpen === false) return { allowed: false, reason: 'Market session is closed' };
  if (market.isStale === true) return { allowed: false, reason: 'Executable quote is stale' };
  const state = String(market.marketState || '').toUpperCase();
  if (['WAITING', 'STALE', 'DISCONNECTED', 'ERROR', 'DISABLED'].includes(state)) return { allowed: false, reason: 'Executable market data is unavailable' };
  const bid = Number(market.bid);
  const ask = Number(market.ask);
  if (!Number.isFinite(bid) || bid <= 0 || !Number.isFinite(ask) || ask <= 0) return { allowed: false, reason: 'Waiting for executable bid/ask' };
  if (ask < bid) return { allowed: false, reason: 'Executable quote book is invalid' };
  return { allowed: true, reason: '' };
}
