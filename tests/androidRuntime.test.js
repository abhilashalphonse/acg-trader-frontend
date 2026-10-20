import test from 'node:test';
import assert from 'node:assert/strict';
import { isAndroidNativeRuntime } from '../src/native/androidRuntime.js';
import { shouldOpenMobileOnboarding } from '../src/landing/landing-routing.js';

const android = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } };
const web = { Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } };
const ios = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } };

test('only the actual Android bridge enables native entry', () => {
  assert.equal(isAndroidNativeRuntime(android), true);
  assert.equal(isAndroidNativeRuntime(web), false);
  assert.equal(isAndroidNativeRuntime(ios), false);
  assert.equal(isAndroidNativeRuntime({}), false);
  assert.equal(isAndroidNativeRuntime({ Capacitor: { getPlatform: () => 'android' } }), false);
});

test('Android launches into mobile onboarding, without overriding explicit auth, terminal, federation or browser routes', () => {
  assert.equal(shouldOpenMobileOnboarding('/', '', true), true);
  assert.equal(shouldOpenMobileOnboarding('/', '', false), false);
  assert.equal(shouldOpenMobileOnboarding('/', '?acg_mobile_onboarding=1', false), true);
  for (const query of ['?ticket=token', '?acg_ticket=token', '?acg_auth=signin',
    '?acg_connect_prop=1', '?acg_login=1', '?acg_terminal=1',
    '?acg_mobile_audit=1', '?acg_v4_audit=1', '?acg_landing_audit=1']) {
    assert.equal(shouldOpenMobileOnboarding('/', query, true), false, query);
  }
  assert.equal(shouldOpenMobileOnboarding('/terminal', '', true), false);
  assert.equal(shouldOpenMobileOnboarding('/auth/callback', '', true), false);
});
