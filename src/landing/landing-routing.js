// Opt-in public landing preview; legacy federation and terminal audits take priority.
// The approved V6 page is a standalone HTML asset so its typography/layout remain unchanged.
export function shouldOpenStandaloneAuth(path = '/', search = '') {
  const params = new URLSearchParams(search);
  if (params.has('ticket') || params.has('acg_ticket')) return false;
  if (params.get('acg_v4_audit') === '1' || params.get('acg_mobile_audit') === '1') return false;
  if (path === '/auth/callback') return true;
  return params.get('acg_onboarding_audit') === '1'
    && ['signin', 'signup', 'recover'].includes(params.get('acg_auth'));
}

export function shouldOpenLandingPreview(search = '') {
  const params = new URLSearchParams(search);
  if (params.get('acg_landing_audit') !== '1') return false;
  if (params.has('ticket') || params.has('acg_ticket')) return false;
  if (params.get('acg_login') === '1') return false;
  if (params.get('acg_v4_audit') === '1' || params.get('acg_mobile_audit') === '1') return false;
  return true;
}
