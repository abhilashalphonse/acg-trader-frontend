import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('V4 footer identifies the operator, links trust pages and discloses simulation clearly', () => {
  const html = source('public/acg-landing-v6.html');
  const footer = html.slice(html.lastIndexOf('<footer class="footer">'));
  assert.match(footer, /Developed by<br\/><strong>ACG-MANAGEMENT, UNIPESSOAL LDA<\/strong><br\/>Portugal/);
  assert.match(footer, /© 2026 ACG-MANAGEMENT, UNIPESSOAL LDA · Portugal/);
  assert.match(footer, /Simulated trading technology\. Not a broker or investment adviser\./);
  assert.match(footer, /<nav class="footer-nav footer-resources" aria-label="Support and legal links">/);
  assert.match(footer, /<nav class="footer-nav footer-platform" aria-label="Platform links">/);
  assert.ok(!footer.includes('Simulated balances and performance are not real money'), 'full risk statement lives above footer');
  assert.ok(html.includes('class="acg-faq-disclaimer" role="note"'), 'full risk notice remains near FAQs');
  assert.ok(footer.includes('href="#acg-faq">FAQs</a>'), 'FAQ footer link reaches the new section');
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
  assert.ok(html.includes('href="/acg-landing-footer.css"'));
  const css=source('public/acg-landing-footer.css');
  assert.ok(css.includes('.footer .footer-grid{'));
  assert.ok(css.includes('background:#000'));
  assert.ok(css.includes('width:min(1080px,calc(100% - 80px))'));
  assert.ok(css.includes('@media(max-width:900px)'));
  assert.ok(css.includes('@media(max-width:600px)'));
  assert.ok(css.includes('@media(max-width:360px)'));
  assert.ok(css.includes('.footer a:focus-visible'));
  assert.ok(!html.includes('href="#markets"') && !html.includes('href="#trading"'), 'removed anchors stay absent');
  assert.match(html, /\.mobile-nav\{display:none/);
  assert.match(html, /@media\(max-width:800px\)/);
  assert.match(html, /href="\/\?acg_connect_prop=1"/);
  assert.match(html, /href="\/\?acg_login=1"/);
  assert.doesNotMatch(html, /href="\/\?acg_auth=signup"/);
  for (const anchor of ['platform', 'features', 'market-intro', 'market-movers', 'access']) {
    assert.ok(html.includes('id="' + anchor + '"'), anchor);
  }
  assert.deepEqual([...html.matchAll(/<script\b[^>]*>/g)].map(match => match[0]), ['<script src="/acg-landing-motion.js?v=20261121-mobile-playback" defer>']);
  assert.doesNotMatch(html, /<script>(.|\n)*?<\/script>/i);
});

test('Contact correctly identifies ACG Funded as a separate support channel without claiming a trader corporate address', () => {
  const contact = source('public/contact.html');
  assert.match(contact, /support@acgfunded\.com/);
  assert.match(contact, /ACG Funded/);
  assert.match(contact, /should not be confused with an independent legal-contact address/);
  assert.match(contact, /Never email passwords, recovery codes/);
});
