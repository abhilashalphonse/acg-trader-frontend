// Build-time lock for the private Android existing-account beta.
// This client connects to production accounts but can never submit or modify trades.
// This is an accidental-action barrier, not a substitute for backend permission checks.
export function isExistingAccountReadOnlyBeta(env = import.meta.env) {
  return String(env?.VITE_ACG_ANDROID_READ_ONLY_BETA || '').toLowerCase() === 'true';
}

const SESSION_METHODS = new Set([
  'POST /v1/auth/login',
  'POST /v1/auth/refresh',
  'POST /v1/auth/logout',
  'POST /v1/auth/federated/exchange',
]);

export function mayIssueExistingBetaRequest(method, path) {
  const verb = String(method || 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true;
  const pathname = String(path || '').split('?')[0];
  return SESSION_METHODS.has(`${verb} ${pathname}`);
}
