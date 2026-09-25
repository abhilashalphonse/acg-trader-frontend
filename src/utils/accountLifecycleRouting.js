export function resolveActiveAccountId({
  selectedAccountId = null,
  grantedAccountIds = [],
  snapshotAccountIds = [],
} = {}) {
  const grants = [...new Set((grantedAccountIds || []).map(String).map(value => value.trim()).filter(Boolean))];
  const selected = String(selectedAccountId || '').trim();

  // The selected account remains authoritative even before its first realtime
  // snapshot arrives. Falling back to an older loaded account here can surface
  // stale lifecycle state (for example a previous breached trial).
  if (selected && grants.includes(selected)) return selected;
  if (grants.length) return grants[0];

  return (snapshotAccountIds || [])
    .map(String)
    .map(value => value.trim())
    .find(Boolean) || null;
}

export function resolveCommandAccountId({
  activeAccountId,
  grantedAccountIds = [],
  accountSwitching = false,
  accountSwitchError = null,
} = {}) {
  const accountId = String(activeAccountId || '').trim();
  if (!accountId) throw new Error('No trading account is available for this session');

  const grants = new Set((grantedAccountIds || []).map(String).filter(Boolean));
  if (!grants.has(accountId)) {
    const error = new Error('This account is no longer granted to the current trading session');
    error.code = 'ACCOUNT_ACCESS_REVOKED';
    throw error;
  }
  if (accountSwitching) {
    const error = new Error(accountSwitchError || 'Trading account is still synchronizing');
    error.code = 'ACCOUNT_SWITCH_IN_PROGRESS';
    throw error;
  }
  return accountId;
}

export function resolveLifecycleReplacement({
  accountGrants = [],
  activeAccountId = null,
  lifecycleId = null,
} = {}) {
  const active = String(activeAccountId || '').trim();
  const lifecycle = String(lifecycleId || '').trim();
  if (!lifecycle) return null;

  return (Array.isArray(accountGrants) ? accountGrants : [])
    .filter(item => {
      const id = String(item?.id || '').trim();
      const sameLifecycle = String(item?.fundedAccountId || '').trim() === lifecycle;
      const activeAndTradable = String(item?.status || '').toUpperCase() === 'ACTIVE'
        && item?.tradingEnabled === true;
      return id && id !== active && sameLifecycle && activeAndTradable;
    })
    .sort((a, b) => {
      const aMaster = String(a?.accountType || '').toUpperCase() === 'FUNDED' ? 1 : 0;
      const bMaster = String(b?.accountType || '').toUpperCase() === 'FUNDED' ? 1 : 0;
      if (aMaster !== bMaster) return bMaster - aMaster;
      return Number(b?.phase || 0) - Number(a?.phase || 0);
    })[0] || null;
}
