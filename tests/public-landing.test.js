import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldOpenLandingPreview } from '../src/landing/landing-routing.js';

test('approved landing preview is opt-in and never intercepts federation or terminal audits', () => {
  assert.equal(shouldOpenLandingPreview(''), false);
  assert.equal(shouldOpenLandingPreview('?acg_landing_audit=0'), false);
  assert.equal(shouldOpenLandingPreview('?acg_landing_audit=1'), true);
  assert.equal(shouldOpenLandingPreview('?acg_landing_audit=1&ticket=federation'), false);
  assert.equal(shouldOpenLandingPreview('?acg_landing_audit=1&acg_ticket=federation'), false);
  assert.equal(shouldOpenLandingPreview('?acg_landing_audit=1&acg_login=1'), false);
  assert.equal(shouldOpenLandingPreview('?acg_landing_audit=1&acg_v4_audit=1'), false);
  assert.equal(shouldOpenLandingPreview('?acg_landing_audit=1&acg_mobile_audit=1'), false);
});

test('landing V6 retains approved value proposition and keeps approved three-path entry navigation', () => {
  const html = readFileSync(new URL('../public/acg-landing-v6.html', import.meta.url), 'utf8');
  assert.match(html, /Global markets\.<br\/><span class="soft-text">One platform\./i);
  assert.match(html, /Risk-based sizing\.<br\/><span>Chart-based trading\./i);
  assert.match(html, /Bring ACG Trader<br\/><span>to your traders\./i);
  assert.match(html, /href="\/\?acg_connect_prop=1"[^>]*>Start Trading/);
  assert.match(html, /href="\/\?acg_auth=signup&amp;acg_onboarding_audit=1">Try Demo/);
  assert.match(html, /href="#markets"/);
  assert.match(html, /href="#trading"/);
  assert.match(html, /href="#experience"/);
  assert.match(html, /href="#business"/);
  assert.match(html, /Futures, Options, Cloud and White Label are planned offerings/);
  assert.doesNotMatch(html, /<script\b/i, 'Static landing must not add independent session or trading scripts');
});

test('Connect Prop remains an opt-in tenant-native login with no changed default login', () => {
  const gate = readFileSync(new URL('../src/components/SessionGate.jsx', import.meta.url), 'utf8');
  assert.match(gate, /acg_connect_prop/);
  assert.match(gate, /VITE_ACG_TRADER_TENANT \|\| 'acg-funded'/);
  assert.match(gate, /auth\.login\(\{ tenant, login, password: form\.password \}\)/);
  assert.match(gate, /connectProp \? form\.tenant\.trim\(\) : configuredTenant/);
  assert.match(gate, /!connectProp && fundedUrl/);
});

test('Try Demo uses first-party personal session without Supabase tenant/partner discovery', () => {
  const api = readFileSync(new URL('../src/api/auth.js', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../src/auth/AuthProvider.jsx', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/components/StandaloneAuthPage.jsx', import.meta.url), 'utf8');
  assert.match(api, /\/v1\/auth\/personal\/demo/);
  assert.doesNotMatch(api, /\/v1\/auth\/supabase\/exchange/);
  assert.doesNotMatch(api, /supabase\/organizations/);
  assert.match(auth, /loginPersonalDemo/);
  assert.match(ui, /loginPersonalDemo\(token\)/);
  assert.doesNotMatch(ui, /selectOrganization|orgs\.map|tenantId/);
  assert.match(ui, /\$100,000 virtual/);
  assert.match(ui, /connect_prop=1/);
  assert.match(ui, /supabaseOnboardingEnabled/);
});
