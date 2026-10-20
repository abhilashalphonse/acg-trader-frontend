// A context change is a new authentication journey, not an account-grant
// switch. Never infer "personal" from authMethod=SUPABASE: legacy partner
// integrations can also issue SUPABASE trader sessions.
export const MOBILE_ONBOARDING_PATH = '/?acg_mobile_onboarding=1';

export function mobileContextDestination(context) {
  if (context === 'personal') return '/?acg_auth=signin&acg_onboarding_audit=1';
  if (context === 'signup') return '/?acg_auth=signup&acg_onboarding_audit=1';
  if (context === 'partner') return '/?acg_connect_prop=1';
  throw new Error('Unsupported trading context');
}

export function mobileContextDescription(context) {
  if (context === 'personal') return 'Your independent ACG Trader virtual practice account';
  if (context === 'signup') return 'Create a personal virtual practice account when registration is available';
  if (context === 'partner') return 'A prop firm using its own trading credentials';
  throw new Error('Unsupported trading context');
}

// Treat account switching within a session separately from changing identity
// or tenant. Neither path accepts a tenant/account ID from the browser.
export function mobileContextSwitchAllowed({
  authenticated = false,
  accountSwitching = false,
  commandPending = false,
  executionUncertain = false,
} = {}) {
  return Boolean(authenticated && !accountSwitching && !commandPending && !executionUncertain);
}
