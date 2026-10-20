import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldOpenMobileOnboarding, shouldOpenStandaloneAuth, shouldOpenPublicHome } from '../src/landing/landing-routing.js';
import {
  mobileContextDestination, mobileContextDescription, mobileContextSwitchAllowed, MOBILE_ONBOARDING_PATH,
} from '../src/utils/mobileOnboardingNavigation.js';

test('mobile onboarding is opt-in and never intercepts ticket or existing terminal routes', () => {
  assert.equal(MOBILE_ONBOARDING_PATH, '/?acg_mobile_onboarding=1');
  assert.equal(shouldOpenMobileOnboarding('/', '?acg_mobile_onboarding=1'), true);
  assert.equal(shouldOpenMobileOnboarding('/', ''), false);
  for (const search of [
    '?acg_mobile_onboarding=1&ticket=federated-private',
    '?acg_mobile_onboarding=1&acg_ticket=private',
    '?acg_mobile_onboarding=1&acg_auth=signin',
    '?acg_mobile_onboarding=1&acg_login=1',
    '?acg_mobile_onboarding=1&acg_connect_prop=1',
    '?acg_mobile_onboarding=1&acg_mobile_audit=1',
    '?acg_mobile_onboarding=1&acg_v4_audit=1',
  ]) assert.equal(shouldOpenMobileOnboarding('/', search), false, search);
  assert.equal(shouldOpenMobileOnboarding('/terminal', '?acg_mobile_onboarding=1'), false);
  assert.equal(shouldOpenPublicHome('/', '?acg_mobile_onboarding=1', false), false,
    'Explicit mobile welcome is not a public landing route');
  assert.equal(shouldOpenStandaloneAuth('/', '?acg_auth=signin'), true);
});

test('personal demo and partner context destinations are distinct and never take tenant ids', () => {
  assert.equal(mobileContextDestination('personal'), '/?acg_auth=signin&acg_onboarding_audit=1');
  assert.equal(mobileContextDestination('partner'), '/?acg_connect_prop=1');
  assert.equal(mobileContextDestination('signup'), '/?acg_auth=signup&acg_onboarding_audit=1');
  assert.match(mobileContextDescription('signup'), /virtual practice/);
  assert.match(mobileContextDescription('personal'), /independent/);
  assert.match(mobileContextDescription('partner'), /its own trading credentials/);
  for (const invalid of [null, undefined, '', 'SUPABASE', 'FEDERATED', 'evil']) {
    assert.throws(() => mobileContextDestination(invalid), /Unsupported trading context/);
  }
});

test('context changes reject unsettled orders and concurrent account transitions', () => {
  assert.equal(mobileContextSwitchAllowed({ authenticated: true }), true);
  assert.equal(mobileContextSwitchAllowed({ authenticated: false }), false);
  assert.equal(mobileContextSwitchAllowed({ authenticated: true, accountSwitching: true }), false);
  assert.equal(mobileContextSwitchAllowed({ authenticated: true, commandPending: true }), false);
  assert.equal(mobileContextSwitchAllowed({ authenticated: true, executionUncertain: true }), false);
  assert.equal(mobileContextSwitchAllowed(), false);
});
