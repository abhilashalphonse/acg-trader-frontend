import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldOpenLandingPreview, shouldOpenStandaloneAuth, shouldOpenPublicHome } from '../src/landing/landing-routing.js';

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

test('public homepage uses V4 design language and current production capability only', () => {
  const html = readFileSync(new URL('../public/acg-landing-v6.html', import.meta.url), 'utf8');
  assert.match(html, /Built for the chart/);
  assert.match(html, /Ready for the trade/);
  assert.match(html, /Chart-first trading platform/);
  assert.match(html, /class="shell hero-layout"/);
  assert.match(html, /class="hero-stage"/);
  // Product structure, not editorial chapter badges or slash-numbered headings.
  const markup = html.slice(html.indexOf('<body>'));
  assert.doesNotMatch(markup, /WEB TRADING TERMINAL|\b0[1-4] \/ (?:THE PLATFORM|TRADING WORKFLOW|MARKETS|ACCOUNT ACCESS|CHARTING|EXECUTION|RISK|POSITIONS)/);
  assert.doesNotMatch(markup, /class="(?:micro|feature-num|access-kicker|hero-stage-head|hero-stage-foot)/);
  assert.doesNotMatch(markup, /A FOCUSED TRADING WORKSPACE|CHART-FIRST INTERFACE|DESKTOP PREVIEW/);

  assert.match(html, /class="desktop-nav"/);
  assert.match(html, /class="mobile-nav"/);
  assert.match(html, /min-height:660px/);
  assert.match(html, /color-scheme:dark/);
  assert.match(html, /currently supports simulated trading through authorized accounts/);
  assert.match(html, /not a broker/);
  assert.match(html, /href="\/\?acg_login=1"/);
  assert.match(html, /href="\/\?acg_connect_prop=1"/);
  for (const anchor of ['platform', 'features', 'trading', 'markets', 'access']) {
    assert.ok(html.includes('id="' + anchor + '"'), anchor);
  }
  assert.doesNotMatch(html, /coming soon|in development|roadmap|white label|free tier|futures|options/i);
  assert.doesNotMatch(html, /href="\/\?acg_auth=signup"/);
  assert.doesNotMatch(html, /<script\b/i, 'Static landing must not add independent session or trading scripts');
});

test('landing uses the complete ACG Trader italic wordmark from the supplied app reference', () => {
  const html = readFileSync(new URL('../public/acg-landing-v6.html', import.meta.url), 'utf8');
  const body = html.slice(html.indexOf('<body>'));
  const wordmark = readFileSync(new URL('../public/acg-trader-wordmark.png', import.meta.url));
  const terminalLoader = readFileSync(new URL('../src/components/ACGStartupLoader.jsx', import.meta.url), 'utf8');
  assert.equal(wordmark.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(wordmark.readUInt32BE(16), 388);
  assert.equal(wordmark.readUInt32BE(20), 67);
  assert.equal((body.match(/src="\/acg-trader-wordmark\.png"/g) || []).length, 3);
  assert.equal((body.match(/class="brand-original" src="\/acg-trader-wordmark\.png"/g) || []).length, 2);
  assert.match(body, /class="term-original" src="\/acg-trader-wordmark\.png"/);
  assert.doesNotMatch(body, /src="\/acg-logo\.png"|class="brand-trader"|class="brand-emblem"/);
  assert.match(terminalLoader, /src="\/acg-logo\.png"/, 'The existing app loading icon remains unchanged');
  assert.match(html, /\.brand-original\{display:block;width:162px;height:auto/);
  assert.match(html, /\.term-original\{display:block;width:128px;height:auto/);
  assert.match(body, /aria-label="ACG Trader home"/);
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

test('V6 is the default homepage but never intercepts partner launch or active trading', () => {
  assert.equal(shouldOpenPublicHome('/', ''), true);
  assert.equal(shouldOpenPublicHome('/', '?acg_landing_audit=0'), true);
  assert.equal(shouldOpenPublicHome('/', '', true), false);
  for (const query of ['?ticket=launch', '?acg_ticket=launch', '?acg_login=1',
    '?acg_connect_prop=1', '?acg_terminal=1', '?acg_v4_audit=1',
    '?acg_v4_audit=0', '?acg_mobile_audit=1', '?acg_mobile_audit=0',
    '?acg_auth=signup', '?acg_auth=signin']) {
    assert.equal(shouldOpenPublicHome('/', query), false, query);
  }
  assert.equal(shouldOpenPublicHome('/terminal', ''), false);
  assert.equal(shouldOpenPublicHome('/auth/callback', ''), false);
  assert.equal(shouldOpenStandaloneAuth('/', '?acg_auth=signup'), true);
  assert.equal(shouldOpenStandaloneAuth('/', '?acg_auth=signin'), true);
  assert.equal(shouldOpenStandaloneAuth('/auth/callback', ''), true);
  assert.equal(shouldOpenStandaloneAuth('/', '?ticket=launch&acg_auth=signin'), false);
});

test('public marketing keeps tenant-native and federation entry with no Supabase tenant linking', () => {
  const html = readFileSync(new URL('../public/acg-landing-v6.html', import.meta.url), 'utf8');
  const router = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../src/auth/AuthProvider.jsx', import.meta.url), 'utf8');
  const signup = readFileSync(new URL('../src/components/StandaloneAuthPage.jsx', import.meta.url), 'utf8');
  assert.match(html, /href="\/\?acg_connect_prop=1"/);
  assert.match(html, /href="\/\?acg_login=1"/);
  assert.match(router, /shouldOpenPublicHome/);
  assert.match(router, /shouldOpenStandaloneAuth/);
  assert.match(auth, /exchangeFederationTicket/);
  assert.match(auth, /ACTIVE_TERMINAL_MARKER/);
  assert.match(signup, /window\.location\.assign\('\/terminal'\)/);
  assert.doesNotMatch(signup, /selectOrganization|orgs\.map|tenantId/);
});
