import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldOpenPublicHome, shouldOpenStandaloneAuth } from '../src/landing/landing-routing.js';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('homepage presents simulated trading status before any sign-in action', () => {
  const page = source('public/acg-landing-v6.html');
  const hero = page.slice(page.indexOf('<section class="hero">'), page.indexOf('<div class="showcase-shell"'));
  const simulation = hero.indexOf('<p class="hero-simulation-notice">');
  const actions = hero.indexOf('<div class="hero-actions">');
  assert.ok(simulation > 0 && actions > simulation);
  assert.match(hero, /currently provides simulated trading workflows, not live brokerage accounts/);
  assert.match(hero, /Personal demo registration is coming soon/);
  assert.doesNotMatch(hero, /href="\/\?acg_auth=signup"/);
});

test('homepage separates ACG Funded login and authorized Connect Prop with correct routing', () => {
  const page = source('public/acg-landing-v6.html');
  assert.match(page, /href="\/\?acg_login=1">ACG Funded sign in/);
  assert.match(page, /href="\/\?acg_connect_prop=1">Connect provider account/);
  assert.match(page, /Connect existing trading account/);
  assert.match(page, /other organizations require an authorized ACG Trader integration and tenant ID/);
  assert.equal(shouldOpenPublicHome('/', '?acg_login=1'), false);
  assert.equal(shouldOpenPublicHome('/', '?acg_connect_prop=1'), false);
  assert.equal(shouldOpenStandaloneAuth('/', '?acg_login=1'), false);
});

test('account connection screen identifies its issuer and requires explicit authorization', () => {
  const gate = source('src/components/SessionGate.jsx');
  assert.match(gate, /Only connect an account issued by an organization explicitly integrated with ACG Trader/);
  assert.match(gate, /Have an ACG Funded trading account/);
  assert.match(gate, /href="\/\?acg_login=1"/);
  assert.match(gate, /Platform developed by ACG-MANAGEMENT, UNIPESSOAL LDA, Portugal/);
  assert.match(gate, /Never enter a Google, email or banking password here/);
  assert.match(gate, /auth\.login\(\{ tenant, login, password: form\.password \}\)/);
});

test('Cloud, White Label and free tier are consistently described as future offerings', () => {
  const page = source('public/acg-landing-v6.html');
  const business = page.slice(page.indexOf('id="business"'), page.indexOf('</main>'));
  assert.match(business, /ACG Trader Cloud and White Label are in development/);
  assert.match(business, /these services are not yet generally available/);
  assert.match(business, /Planned self-service sandbox/);
  assert.match(business, /Planned custom branding and domain options/);
  assert.match(business, /Proposed monthly active trader allowance for a future free tier/);
  assert.match(business, /This tier is not currently available/);
  assert.doesNotMatch(business, /license a White Label edition/);
});

test('operator, privacy, terms and Contact remain accessible from V6', () => {
  const page = source('public/acg-landing-v6.html');
  const footer = page.slice(page.lastIndexOf('<footer class="v6-footer">'));
  assert.match(footer, /Developed by ACG-MANAGEMENT, UNIPESSOAL LDA, Portugal/);
  for (const page of ['account-security','privacy','terms','contact']) {
    assert.ok(footer.includes('href="/' + page + '.html"'), page);
    assert.match(source('public/' + page + '.html'), /ACG-MANAGEMENT, UNIPESSOAL LDA/);
  }
});
