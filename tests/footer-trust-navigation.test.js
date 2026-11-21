import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('V4 footer identifies the operator, links trust pages and discloses simulation clearly', () => {
  const html = source('public/acg-landing-v6.html');
  const footer = html.slice(html.lastIndexOf('<footer class="footer">'));
  assert.match(footer, /ACG-MANAGEMENT, UNIPESSOAL LDA, Portugal/);
  assert.match(footer, /Simulated balances and performance are not real money/);
  assert.match(footer, /it is not a broker or investment adviser/);
  assert.match(footer, /© 2026 ACG-MANAGEMENT, UNIPESSOAL LDA/);
  assert.match(footer, /<nav aria-label="Support and legal links">/);
  for (const [url, label] of [
    ['/account-security.html', 'Account security'],
    ['/privacy.html', 'Privacy Policy'],
    ['/terms.html', 'Terms of Service'],
    ['/contact.html', 'Contact'],
  ]) {
    assert.ok(footer.includes('href="' + url + '">' + label + '</a>'), url);
    const linkedPage = source('public' + url);
    assert.match(linkedPage, /<title>.*ACG Trader<\/title>/);
    assert.match(linkedPage, /ACG-MANAGEMENT, UNIPESSOAL LDA/);
    assert.doesNotMatch(linkedPage, /<form\b|<script\b|<iframe\b/i);
  }
});

test('V4 navbar, footer and responsive menu preserve authorized account login routes', () => {
  const html = source('public/acg-landing-v6.html');
  assert.match(html, /\.footer-grid\{display:grid/);
  assert.match(html, /\.mobile-nav\{display:none/);
  assert.match(html, /@media\(max-width:800px\)/);
  assert.match(html, /href="\/\?acg_connect_prop=1"/);
  assert.match(html, /href="\/\?acg_login=1"/);
  assert.doesNotMatch(html, /href="\/\?acg_auth=signup"/);
  for (const anchor of ['platform', 'features', 'market-intro', 'market-movers', 'access']) {
    assert.ok(html.includes('id="' + anchor + '"'), anchor);
  }
  assert.deepEqual([...html.matchAll(/<script\b[^>]*>/g)].map(match => match[0]), ['<script src="/acg-landing-motion.js" defer>']);
  assert.doesNotMatch(html, /<script>(.|\n)*?<\/script>/i);
});

test('Contact correctly identifies ACG Funded as a separate support channel without claiming a trader corporate address', () => {
  const contact = source('public/contact.html');
  assert.match(contact, /support@acgfunded\.com/);
  assert.match(contact, /ACG Funded/);
  assert.match(contact, /should not be confused with an independent legal-contact address/);
  assert.match(contact, /Never email passwords, recovery codes/);
});
