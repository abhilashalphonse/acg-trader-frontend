import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('V6 footer includes exact operator identity, four trust links and the simulated-trading disclosure', () => {
  const html = source('public/acg-landing-v6.html');
  const footer = html.slice(html.lastIndexOf('<footer class="v6-footer">'));
  assert.match(footer, /Account security and transparency/);
  assert.match(footer, /ACG-MANAGEMENT, UNIPESSOAL LDA, Portugal/);
  assert.match(footer, /Simulated accounts do not represent live brokerage accounts/);
  assert.match(footer, /Futures, Options, Cloud and White Label are planned offerings/);
  assert.match(footer, /© 2026 ACG-MANAGEMENT, UNIPESSOAL LDA/);
  assert.match(footer, /<nav class="v6-footer-nav" aria-label="Account security, legal information and contact">/);
  for (const [url, label] of [
    ['/account-security.html', 'Account security'],
    ['/privacy.html', 'Privacy Policy'],
    ['/terms.html', 'Terms of Service'],
    ['/contact.html', 'Contact'],
  ]) {
    assert.match(footer, new RegExp('<a href="' + url.replaceAll('.', '\\.') + '">' + label + '</a>'));
    const linkedPage = source('public' + url);
    assert.match(linkedPage, /<title>.*ACG Trader<\/title>/);
    assert.match(linkedPage, /ACG-MANAGEMENT, UNIPESSOAL LDA/);
    assert.doesNotMatch(linkedPage, /<form\b|<script\b|<iframe\b/i);
  }
});

test('footer remains responsive and does not alter product sections or primary login routes', () => {
  const html = source('public/acg-landing-v6.html');
  assert.match(html, /\.v6-footer-main\{display:grid/);
  assert.match(html, /\.v6-footer-nav\{display:flex/);
  assert.match(html, /@media\(max-width:500px\)\{\.v6-footer\{/);
  assert.match(html, /href="\/\?acg_connect_prop=1"/);
  assert.match(html, /href="\/\?acg_auth=signup"/);
  assert.match(html, /id="markets"/);
  assert.match(html, /id="trading"/);
  assert.match(html, /id="experience"/);
  assert.match(html, /id="business"/);
  assert.doesNotMatch(html, /<script\b/i);
});

test('Contact correctly identifies ACG Funded as a separate support channel without claiming a trader corporate address', () => {
  const contact = source('public/contact.html');
  assert.match(contact, /support@acgfunded\.com/);
  assert.match(contact, /ACG Funded/);
  assert.match(contact, /should not be confused with an independent legal-contact address/);
  assert.match(contact, /Never email passwords, recovery codes/);
});
