export function accountTypeKey(account) {
  const raw = String(account?.accountType || account?.mode || '').trim().toUpperCase();
  if (raw === 'DEMO') return 'TRIAL';
  if (raw === 'FUNDED') return 'MASTER';
  return 'CHALLENGE';
}

export function accountTypeLabel(account) {
  const type = accountTypeKey(account);
  if (type === 'TRIAL') return 'Trial Account';
  if (type === 'MASTER') return 'Master Account';
  return 'Challenge Account';
}

export function accountTypeBadge(account) {
  return accountTypeKey(account);
}

export function accountRiskTitle(account) {
  const type = accountTypeKey(account);
  if (type === 'TRIAL') return 'Trial Risk';
  if (type === 'MASTER') return 'Master Risk';
  return 'Challenge Risk';
}

export function accountRiskDescription(account) {
  const type = accountTypeKey(account);
  if (type === 'TRIAL') return 'Current trial limits and trading risk.';
  if (type === 'MASTER') return 'Current Master Account risk limits.';
  return 'Current challenge limits and trading risk.';
}

export function accountLimitsUnavailableCopy(account) {
  const type = accountTypeKey(account);
  if (type === 'MASTER') return 'Evaluation targets do not apply to this Master Account.';
  if (type === 'TRIAL') return 'Trial limits are not available for this account.';
  return 'Challenge limits are not available for this account.';
}

export function isMasterAccount(account) {
  return accountTypeKey(account) === 'MASTER';
}
