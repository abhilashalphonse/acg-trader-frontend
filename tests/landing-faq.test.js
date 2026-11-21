import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('landing replaces final platform CTA with product-specific, accessible FAQs', () => {
  const html = read('public/acg-landing-v6.html');
  const start = html.indexOf('<section class="acg-faq" id="acg-faq" aria-labelledby="acg-faq-heading">');
  const end = html.indexOf('</section>', start);
  const footer = html.indexOf('<footer class="footer">');
  const access = html.indexOf('<section class="section access"');
  assert.ok(access >= 0 && start > access && end > start && footer > end);
  const section = html.slice(start, end);
  assert.ok(section.includes('<p class="acg-faq-eyebrow">Have questions?</p>'));
  assert.ok(section.includes('<h2 id="acg-faq-heading">ACG Trader FAQs</h2>'));
  assert.equal((section.match(/<details class="acg-faq-item" name="acg-trader-faq">/g) || []).length, 7);
  assert.equal((section.match(/<summary>/g) || []).length, 7);
  assert.equal((section.match(/class="acg-faq-toggle" aria-hidden="true"/g) || []).length, 7);
  assert.ok(!section.includes('onclick=') && !section.includes('<button'), 'native disclosure control is used');
  assert.ok(!html.includes('<section class="final-cta">'), 'remove the previous signup CTA');
  assert.ok(!html.includes('Markets. Orders.<br/>One clear interface.'));
  assert.ok(html.includes('href="/acg-faq-section.css"'));
  assert.ok(html.includes('href="#acg-faq">FAQs</a>'), 'footer can reach the FAQ');
});

test('FAQs describe existing service, simulation limits and approved account routes accurately', () => {
  const html = read('public/acg-landing-v6.html');
  const faq = html.slice(html.indexOf('<section class="acg-faq"'), html.indexOf('</section>', html.indexOf('<section class="acg-faq"')));
  for (const question of [
    'What is ACG Trader?',
    'Is ACG Trader a broker?',
    'How do I access my trading account?',
    'Can I trade with real money on ACG Trader?',
    'Which markets are available?',
    'Can I connect an AI assistant to ACG Trader?',
    'Where can I get help with my account?'
  ]) assert.ok(faq.includes(question), question);
  assert.ok(faq.includes('not live brokerage trading'));
  assert.ok(faq.includes('account permissions, data coverage and your provider'));
  assert.ok(faq.includes('illustrative concept'));
  assert.ok(faq.includes('not a broker or investment adviser'));
  assert.ok(faq.includes('href="/account-security.html"'));
  assert.ok(faq.includes('href="/terms.html"'));
  assert.ok(faq.includes('href="/contact.html"'));
  assert.ok(!faq.includes('live AI trading') && !faq.includes('guaranteed gains'));
});

test('FAQ typography, dividers, focus indication and responsive layout follow editorial reference', () => {
  const css = read('public/acg-faq-section.css');
  assert.match(css, /#acg-faq\.acg-faq\{[\s\S]*?background:#000/);
  assert.match(css, /\.acg-faq-intro\{text-align:center\}/);
  assert.match(css, /\.acg-faq-item\{border-bottom:1px solid/);
  assert.match(css, /\.acg-faq-toggle\{[\s\S]*?border-radius:50%/);
  assert.match(css, /\.acg-faq-item\[open\] \.acg-faq-toggle::after\{display:none\}/);
  assert.ok(css.includes('summary:focus-visible'));
  assert.ok(css.includes('@media(max-width:800px)'));
  assert.ok(css.includes('@media(max-width:480px)'));
});

test('compact terms and risk notice appears below all FAQ rows and links to applicable terms', () => {
  const html = read('public/acg-landing-v6.html');
  const start = html.indexOf('<section class="acg-faq"');
  const end = html.indexOf('</section>', start);
  const section = html.slice(start, end);
  const lastQuestion = section.lastIndexOf('<details class="acg-faq-item"');
  const lastAnswerEnd = section.lastIndexOf('</details>');
  const noticeStart = section.indexOf('<div class="acg-faq-disclaimer" role="note"');
  assert.ok(lastQuestion >= 0 && lastAnswerEnd > lastQuestion && noticeStart > lastAnswerEnd);
  const notice = section.slice(noticeStart);
  assert.ok(notice.includes('Terms &amp; risk notice.'));
  assert.ok(notice.includes('simulated trading'));
  assert.ok(notice.includes('not brokerage services or investment advice'));
  assert.ok(notice.includes('not real funds or guaranteed outcomes'));
  assert.ok(notice.includes('may be delayed, inaccurate or illustrative'));
  assert.ok(notice.includes('substantial financial losses'));
  assert.ok(notice.includes('href="/terms.html">Terms of Service</a>'));
  assert.ok(notice.includes("account issuer's applicable terms"));
  const css = read('public/acg-faq-section.css');
  assert.ok(css.includes('.acg-faq-disclaimer{margin:72px 0 0'));
  assert.ok(css.includes('.acg-faq-disclaimer p{margin:0;color:#a3a8b0;font-size:12px'));
  assert.ok(css.includes('.acg-faq-disclaimer a:focus-visible'));
  assert.ok(css.includes('.acg-faq-disclaimer{margin-top:48px}'));
});
