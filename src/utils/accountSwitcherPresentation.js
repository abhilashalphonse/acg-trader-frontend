/**
 * Pure account-switcher grouping. Keep this separate from account permissions:
 * switching a closed account still goes through the existing terminal guard,
 * which is responsible for opening history read-only.
 */
const ARCHIVED_STATUSES = new Set([
  'BREACHED', 'CLOSED', 'DISABLED', 'EXPIRED', 'TERMINATED', 'FAILED',
  'ARCHIVED', 'CANCELLED', 'CANCELED', 'PASSED',
]);

export function accountSwitcherId(item) {
  const value = item?.id ?? item?._id ?? item?.accountId;
  return value == null ? '' : String(value);
}

export function isArchivedAccount(item) {
  return ARCHIVED_STATUSES.has(String(item?.status || '').trim().toUpperCase());
}

export function buildAccountSwitcherSections(accounts = [], currentAccount = null, activeAccountId = null) {
  const seen = new Set();
  const items = [];
  for (const candidate of Array.isArray(accounts) ? accounts : []) {
    if (!candidate || typeof candidate !== 'object') continue;
    const key = accountSwitcherId(candidate) || String(candidate?.accountCode || '');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    items.push(candidate);
  }

  const activeKey = activeAccountId == null ? '' : String(activeAccountId);
  let current = activeKey
    ? items.find(item => accountSwitcherId(item) === activeKey)
    : null;
  if (!current && currentAccount && typeof currentAccount === 'object'
      && (accountSwitcherId(currentAccount) || currentAccount.accountCode)) {
    current = currentAccount;
  }

  if (current) {
    const currentKey = accountSwitcherId(current) || String(current.accountCode || '');
    if (currentKey && !seen.has(currentKey)) {
      items.unshift(current);
      seen.add(currentKey);
    }
  }

  const selectedKey = current
    ? accountSwitcherId(current) || String(current.accountCode || '')
    : null;
  const other = [];
  const archived = [];
  for (const item of items) {
    const itemKey = accountSwitcherId(item) || String(item.accountCode || '');
    if (selectedKey && itemKey === selectedKey) continue;
    if (isArchivedAccount(item)) archived.push(item);
    else other.push(item);
  }
  const all = current ? [current, ...other, ...archived] : [...other, ...archived];
  return {
    current, other, archived,
    total: all.length,
    activeCount: all.filter(item => String(item?.status || '').toUpperCase() === 'ACTIVE').length,
    archivedCount: all.filter(isArchivedAccount).length,
  };
}
