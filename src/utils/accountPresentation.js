export function accountTypeKey(account) {
  if (!account) return 'UNKNOWN';
  const raw = String(account?.accountType || account?.mode || '').trim().toUpperCase();
  if (raw === 'DEMO') return 'TRIAL';
  if (raw === 'FUNDED') return 'MASTER';
  if (raw === 'CHALLENGE') return 'CHALLENGE';
  return 'UNKNOWN';
}

export function accountTypeLabel(account) {
  const type = accountTypeKey(account);
  if (type === 'TRIAL') return 'Trial Account';
  if (type === 'MASTER') return 'Master Account';
  if (type === 'CHALLENGE') return 'Challenge Account';
  return 'Trading Account';
}

export function accountTypeBadge(account) {
  const type = accountTypeKey(account);
  return type === 'UNKNOWN' ? 'ACCOUNT' : type;
}

export function accountRiskTitle(account) {
  const type = accountTypeKey(account);
  if (type === 'TRIAL') return 'Trial Risk';
  if (type === 'MASTER') return 'Master Risk';
  if (type === 'CHALLENGE') return 'Challenge Risk';
  return 'Account Risk';
}

export function accountRiskDescription(account) {
  const type = accountTypeKey(account);
  if (type === 'TRIAL') return 'Current trial limits and trading risk.';
  if (type === 'MASTER') return 'Current Master Account risk limits.';
  if (type === 'CHALLENGE') return 'Current challenge limits and trading risk.';
  return 'Current trading risk.';
}

export function accountLimitsUnavailableCopy(account) {
  const type = accountTypeKey(account);
  if (type === 'MASTER') return 'Evaluation targets do not apply to this Master Account.';
  if (type === 'TRIAL') return 'Trial limits are not available for this account.';
  if (type === 'CHALLENGE') return 'Challenge limits are not available for this account.';
  return 'Risk limits are not available for this account.';
}

export function isMasterAccount(account) {
  return accountTypeKey(account) === 'MASTER';
}


export function accountStatusLabel(status) {
  const value = String(status || '').trim().toUpperCase();
  const labels = {
    ACTIVE: 'Active',
    PAUSED: 'Paused',
    BREACHED: 'Breached',
    DISABLED: 'Disabled',
    CLOSED: 'Closed',
  };
  return labels[value] || (value ? value.replaceAll('_', ' ') : 'Unknown');
}


export function accountStatusToneClass(status) {
  const value = String(status || '').trim().toUpperCase();
  if (value === 'ACTIVE') return 'border-[#176247] bg-[#0c2d23] text-[#45dda9]';
  if (value === 'PAUSED') return 'border-[#655126] bg-[#2a220f] text-[#e7c76b]';
  if (value === 'BREACHED' || value === 'DISABLED' || value === 'CLOSED') return 'border-[#63313b] bg-[#2a151a] text-[#ff8994]';
  return 'border-white/[0.08] bg-[#101010] text-[#8999a8]';
}
