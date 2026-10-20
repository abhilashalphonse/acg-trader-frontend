import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signOutDestination } from '../src/utils/signOutDestination.js';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('sign out destination stays within its independently authenticated context', () => {
  assert.equal(signOutDestination('SUPABASE'), '/?acg_auth=signin');
  assert.equal(signOutDestination('PASSWORD', '?acg_connect_prop=1'), '/?acg_connect_prop=1');
  assert.equal(signOutDestination('PASSWORD', '?acg_v4_audit=1'), '/?acg_login=1');
  assert.equal(signOutDestination('FEDERATED', '?acg_ticket=ticket'), '/?acg_login=1');
  assert.equal(signOutDestination('PASSWORD', '?acg_connect_prop=0'), '/?acg_login=1');
});

test('desktop V4 and both mobile account screens expose the sign-out action', () => {
  const desktop = source('../src/components/trading-v2/DesktopTerminal.jsx');
  const mobileV4 = source('../src/components/trading-v2/MobileAccountsV4.jsx');
  const legacyMobile = source('../src/components/trading-v2/MobileAccountSheet.jsx');
  assert.match(desktop, /<SignOutAction variant="desktop" \/>/);
  assert.match(mobileV4, /<SignOutAction variant="mobile-v4" \/>/);
  assert.match(legacyMobile, /<SignOutAction variant="mobile-legacy" \/>/);
  assert.match(desktop, /data-v4-header-account/);
  assert.match(mobileV4, /data-v4-account-switcher/);
});

test('sign-out is deliberate and uses actual auth logout before navigation', () => {
  const action = source('../src/components/trading-v2/SignOutAction.jsx');
  assert.match(action, /setConfirming\(true\)/);
  assert.match(action, /await auth\.logout\(\)/);
  assert.match(action, /window\.location\.assign\(next\)/);
  assert.match(action, /Could not securely sign out/);
  assert.match(action, /Cancel/);
});

test('backend revoke succeeds before clearing frontend session, never masks failures', () => {
  const provider = source('../src/auth/AuthProvider.jsx');
  const call = provider.slice(provider.indexOf('const logout = useCallback'), provider.indexOf('const refreshPrincipal = useCallback'));
  assert.ok(call.indexOf('await authApi.logout(token)') > 0);
  assert.ok(call.indexOf('hardClearSession(null)') > call.indexOf('await authApi.logout(token)'));
  assert.doesNotMatch(call, /catch\s*\{[\s\S]*?\}/);
  assert.match(call, /await new SupabaseBrowserAuth\(\)\.signOut\(\)/);
  assert.ok(call.indexOf('hardClearSession(null)') > call.indexOf('await new SupabaseBrowserAuth().signOut()'));
});

test('mobile context exit revokes the trader session without logging out the personal provider', () => {
  const provider = source('../src/auth/AuthProvider.jsx');
  const call = provider.slice(provider.indexOf('const leaveTradingSession = useCallback'), provider.indexOf('const logout = useCallback'));
  assert.match(call, /await authApi\.logout\(token\)/);
  assert.match(call, /hardClearSession\(null\)/);
  assert.doesNotMatch(call, /SupabaseBrowserAuth|signOut/);
  assert.ok(call.indexOf('hardClearSession(null)') > call.indexOf('await authApi.logout(token)'));
});

test('isolated mobile account QA fixtures need no AuthProvider', () => {
  const action = source('../src/components/trading-v2/SignOutAction.jsx');
  const fixture = source('../src/mobileAuditBrowserMain.jsx');
  assert.match(action, /useContext\(AuthContext\)/);
  assert.match(action, /if \(!auth\?\.logout \|\| !auth\?\.authenticated\) return null/);
  assert.match(fixture, /<MobileAccountSheet auditMobile account=/);
  assert.doesNotMatch(fixture, /<AuthProvider>/);
});
