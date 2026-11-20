import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldOpenPublicHome, shouldOpenStandaloneAuth } from '../src/landing/landing-routing.js';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('simulated trading and account eligibility appear before the primary login CTA', () => {
  const page = source('public/acg-landing-v6.html');
  const hero = page.slice(page.indexOf('<section class="hero"'), page.indexOf('<div class="fact-strip">'));
  const simulation = hero.indexOf('class="hero-disclosure"');
  const actions = hero.indexOf('class="hero-actions"');
  assert.ok(simulation > 0 && actions > simulation);
  assert.match(hero, /currently supports simulated trading through authorized accounts/);
  assert.match(hero, /does not offer live brokerage accounts or accept trading deposits/);
  assert.doesNotMatch(hero, /href="\/\?acg_auth=signup"/);
});

test('home clearly distinguishes ACG Funded sign-in and authorized organization account connection', () => {
  const page = source('public/acg-landing-v6.html');
  assert.match(page, /href="\/\?acg_login=1">ACG Funded sign in/);
  assert.match(page, /href="\/\?acg_connect_prop=1">Connect authorized account/);
  assert.match(page, /organization explicitly integrated with ACG Trader/);
  assert.match(page, /Never enter unrelated passwords/);
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

test('unavailable offerings are absent, not presented as roadmap or implied current products', () => {
  const page = source('public/acg-landing-v6.html');
  assert.doesNotMatch(page, /coming soon|in development|roadmap|white label|free tier|futures|options/i);
  assert.match(page, /Instrument availability is controlled by the connected account/);
  assert.match(page, /No public personal registration is advertised/);
});

test('operator, privacy, terms and Contact remain accessible from V6', () => {
  const page = source('public/acg-landing-v6.html');
  const footer = page.slice(page.lastIndexOf('<footer class="footer">'));
  assert.match(footer, /Developed by ACG-MANAGEMENT, UNIPESSOAL LDA, Portugal/);
  for (const page of ['account-security','privacy','terms','contact']) {
    assert.ok(footer.includes('href="/' + page + '.html"'), page);
    assert.match(source('public/' + page + '.html'), /ACG-MANAGEMENT, UNIPESSOAL LDA/);
  }
});
