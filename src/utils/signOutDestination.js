// Trading session auth methods are independent. Never send an ACG Trader
// Supabase identity into the broker/prop credential login, or vice versa.
export function signOutDestination(authMethod, search = '') {
  if (String(authMethod || '').toUpperCase() === 'SUPABASE') {
    return '/?acg_auth=signin&acg_onboarding_audit=1';
  }
  const params = new URLSearchParams(search);
  if (params.get('acg_connect_prop') === '1') return '/?acg_connect_prop=1';
  return '/?acg_login=1';
}
