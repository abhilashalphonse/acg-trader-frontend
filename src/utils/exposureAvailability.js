import { accountExposureState } from './accountCapabilities.js';

export function exposureAvailability({ account, connectionStatus, market, commandState } = {}) {
  if (commandState?.accountSwitching) return { allowed: false, code: 'ACCOUNT_SWITCHING', reason: commandState?.accountSwitchError || 'Switching account — loading valuation, positions, orders, history and risk state' };
  if (commandState?.uncertain) return { allowed: false, code: 'EXECUTION_RECONCILING', reason: 'Reconciling an execution with unknown transport status' };
  if (connectionStatus !== 'ready') return { allowed: false, code: 'REALTIME_UNAVAILABLE', reason: 'Realtime account connection is unavailable' };
  if (!account?.id) return { allowed: false, code: 'ACCOUNT_LOADING', reason: 'Trading account is still loading' };
  if (String(account.status || '').toUpperCase() !== 'ACTIVE') return { allowed: false, code: 'ACCOUNT_NOT_ACTIVE', reason: `Account is ${String(account.status || 'unavailable').toLowerCase()}` };
  if (account.tradingEnabled !== true) return { allowed: false, code: 'ACCOUNT_TRADING_DISABLED', reason: 'Trading is paused for this account' };

  const accountState = accountExposureState(account);
  if (!accountState.allowed) return accountState;

  if (String(account.valuationStatus || '').toUpperCase() !== 'LIVE') return { allowed: false, code: 'VALUATION_NOT_LIVE', reason: 'Account valuation is not live' };
  if (!market?.symbol) return { allowed: false, code: 'SYMBOL_MISSING', reason: 'No instrument is selected' };
  if (market.executionEnabled === false) return { allowed: false, code: 'INSTRUMENT_EXECUTION_DISABLED', reason: 'Chart-only market — trading is not enabled yet' };
  if (market.sessionOpen === false) return { allowed: false, code: 'SESSION_CLOSED', reason: 'Market session is closed' };
  if (market.isStale === true) return { allowed: false, code: 'QUOTE_STALE', reason: 'Executable quote is stale' };
  const state = String(market.marketState || '').toUpperCase();
  if (['WAITING', 'STALE', 'DISCONNECTED', 'ERROR', 'DISABLED'].includes(state)) return { allowed: false, code: 'MARKET_DATA_UNAVAILABLE', reason: 'Executable market data is unavailable' };
  const bid = Number(market.bid);
  const ask = Number(market.ask);
  if (!Number.isFinite(bid) || bid <= 0 || !Number.isFinite(ask) || ask <= 0) return { allowed: false, code: 'QUOTE_UNAVAILABLE', reason: 'Waiting for executable bid/ask' };
  if (ask < bid) return { allowed: false, code: 'QUOTE_CROSSED', reason: 'Executable quote book is invalid' };
  return { allowed: true, code: 'READY', reason: '', capabilities: accountState.capabilities };
}
