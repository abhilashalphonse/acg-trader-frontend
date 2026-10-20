// Opt-in mobile first-launch entry. Account/ticket routes always win; this
// must never consume a partner's federation ticket or change desktop V4.
export function shouldOpenMobileOnboarding(path = '/', search = '', isAndroidNative = false) {
  if (path !== '/') return false;
  const params = new URLSearchParams(search);
  if (params.has('ticket') || params.has('acg_ticket')) return false;
  if (params.has('acg_auth') || params.has('acg_login') || params.has('acg_connect_prop')) return false;
  if (params.has('acg_v4_audit') || params.has('acg_mobile_audit')) return false;
  if (params.get('acg_mobile_onboarding') === '1') return true;
  // Only a native Android root without explicit routing state uses the welcome by default.
  return isAndroidNative && [...params.keys()].length === 0;
}

// V6 is the public home. Existing authenticated terminal, federation, and audit routes take priority.
// The approved V6 page is a standalone HTML asset so its typography/layout remain unchanged.
export function shouldOpenStandaloneAuth(path = '/', search = '') {
  const params = new URLSearchParams(search);
  if (params.has('ticket') || params.has('acg_ticket')) return false;
  if (params.has('acg_v4_audit') || params.has('acg_mobile_audit')) return false;
  if (path === '/auth/callback') return true;
  return ['signin', 'signup', 'recover'].includes(params.get('acg_auth'));
}

export function shouldOpenLandingPreview(search = '') {
  const params = new URLSearchParams(search);
  if (params.get('acg_landing_audit') !== '1') return false;
  if (params.has('ticket') || params.has('acg_ticket')) return false;
  if (params.get('acg_login') === '1') return false;
  if (params.get('acg_v4_audit') === '1' || params.get('acg_mobile_audit') === '1') return false;
  return true;
}

// Terminal sessions previously lived at root; leave those tabs and every
// ticket launch alone. The marker contains NO credential or account data.
export const ACTIVE_TERMINAL_MARKER = 'acg-trader-terminal-session-present-v1';
export function shouldOpenPublicHome(path = '/', search = '', activeTerminal = false) {
  if (path !== '/' || activeTerminal) return false;
  const p = new URLSearchParams(search);
  if (p.has('ticket') || p.has('acg_ticket')) return false;
  if (p.has('acg_login') || p.has('acg_connect_prop') || p.has('acg_terminal')) return false;
  if (p.has('acg_v4_audit') || p.has('acg_mobile_audit')) return false;
  if (p.has('acg_auth') || p.has('acg_onboarding_audit') || p.has('acg_mobile_onboarding')) return false;
  return true;
}
