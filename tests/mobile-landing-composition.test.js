import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Access transition uses pure-black background and keeps actual account routes and disclosures', () => {
  const html = read('public/acg-landing-v6.html');
  const css = read('public/acg-mobile-composition.css');
  assert.ok(html.includes('<link rel="stylesheet" href="/acg-mobile-composition.css?v=20261121-moversviewport1"/>'));
  assert.ok(html.indexOf('href="/acg-mobile-composition.css') > html.indexOf('href="/acg-landing-footer.css'),
    'mobile overrides load after original styles');
  assert.match(css, /#access\.section\.access\{[\s\S]*?background:#000/);
  assert.ok(css.includes('#access .access-card{'));
  assert.ok(css.includes('background:#0e0f12'));
  assert.ok(css.includes('border-color:#747985;color:#f0f1f3'), 'dark CTA must have high-contrast label');
  const access=html.slice(html.indexOf('<section class="section access"'),html.indexOf('</section>',html.indexOf('<section class="section access"')));
  assert.ok(access.includes('href="/terminal?acg_login=1"'));
  assert.ok(access.includes('href="/terminal?acg_connect_prop=1"'));
  assert.ok(access.includes('href="/account-security.html"'));
  assert.ok(access.includes('Never enter unrelated passwords'));
});

test('all mobile cinematic stages use compact purposeful layouts without modifying original film files', () => {
  const css=read('public/acg-mobile-composition.css');
  assert.ok(css.includes('@media(max-width:600px)'));
  assert.ok(css.includes('#features.ai-section{'));
  assert.ok(css.includes('min-height:0'));
  assert.ok(css.includes('margin:clamp(62px,8svh,74px) 0 0'));
  assert.ok(css.includes('#terminal .terminal-story-figure{'));
  assert.ok(css.includes('aspect-ratio:1200/1428'));
  assert.ok(css.includes('object-fit:contain;transform:none'));
  assert.ok(css.includes('#ai-connections .ai-connect-stage{'));
  assert.ok(css.includes('object-fit:contain;object-position:center'));
  assert.ok(css.includes('#market-movers .market-movers-frame{'));
  assert.ok(css.includes('aspect-ratio:16/9'));
  assert.ok(css.includes('#experience .mobile-story-visual img{'));
  assert.ok(css.includes('max-height:550px'));
  assert.doesNotMatch(css, /\.film-tap-to-play|\.acg-hero-tap-to-play|\.play-button/);
  const html=read('public/acg-landing-v6.html');
  assert.equal((html.match(/<video\b/g)||[]).length,6);
  assert.ok(html.includes('class="ai-connect-disclosure"'));
  assert.ok(html.includes('class="terminal-story-figure"'));
});

test('mobile editorial sections are left aligned with full-width cinematic artwork and accessible disclosures', () => {
  const css = read('public/acg-mobile-composition.css');
  for (const rule of [
    '#features .ai-section-inner{align-items:stretch;text-align:left}',
    '#terminal .terminal-story-inner{align-items:stretch;text-align:left}',
    '#ai-connections .ai-connect-inner{align-items:stretch;text-align:left}',
    '#terminal .terminal-story-figure{',
    '#experience .mobile-story-visual{',
    '#market-movers .market-movers-media{',
    '#acg-faq .acg-faq-intro{text-align:left}'
  ]) assert.ok(css.includes(rule), rule);
  assert.ok(css.includes('width:100vw;max-width:none'));
  assert.ok(css.includes('object-fit:contain;transform:none'), 'terminal recording is never cropped');
  assert.ok(css.includes('#ai-connections .ai-connect-inner>.ai-connect-disclosure{'), 'assistant concept warning remains visible');
  assert.ok(css.includes('#acg-faq .acg-faq-disclaimer'), 'legal notice remains readable');
  const html = read('public/acg-landing-v6.html');
  assert.ok(html.includes('id="acg-terminal-film"'));
  assert.ok(html.includes('id="acg-ai-connection-film"'));
  assert.ok(html.includes('id="acg-market-movers-film"'));
  assert.ok(html.includes('aria-label="Terms and trading risk notice"'));
});

test('mobile films preserve original framing and legal disclosures', () => {
  const html = read('public/acg-landing-v6.html');
  const css = read('public/acg-mobile-composition.css');
  assert.ok(!html.includes('src="/media/overnight-scan-mobile.mp4"'));
  assert.ok(!html.includes('src="/media/market-movers-mobile.mp4"'));
  assert.ok(html.includes('src="/media/overnight-scan.mp4"'));
  assert.ok(html.includes('src="/media/market-movers.mp4"'));
  assert.ok(css.includes('.market-movers-frame .market-movers-video{'));
  assert.ok(css.includes('object-fit:contain;object-position:center'));
  assert.ok(css.includes('#ai-connections .ai-connect-inner>.ai-connect-disclosure{display:block}'));
  assert.ok(css.includes('.ai-connect-disclosure-desktop{display:none}'));
  assert.ok(html.includes('Illustrative concept — not an active third-party AI integration.'));
});

test('the footer keeps two-column navigation even on 320px phones', () => {
  const css = read('public/acg-mobile-composition.css');
  assert.ok(css.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)'));
  assert.ok(css.includes('.footer .footer-grid>.footer-brand-block{grid-column:1/-1}'));
  assert.ok(css.includes('.footer .footer-nav a{font-size:12.5px'));
});

test('AI Assistant mobile video and disclosure fit the readable phone gutter', () => {
  const css = read('public/acg-mobile-composition.css');
  const html = read('public/acg-landing-v6.html');
  assert.ok(css.includes('#ai-connections .ai-connect-stage{'));
  assert.ok(css.includes('width:100%;max-width:100%;align-self:stretch'));
  assert.ok(css.includes('margin:16px 0 0;aspect-ratio:16/9'));
  assert.ok(css.includes('object-fit:contain;object-position:center'));
  assert.ok(css.includes('max-width:100%;margin:10px 0 13px'));
  assert.ok(css.includes('font-size:10.5px;line-height:1.48'));
  assert.ok(html.includes('src="/media/overnight-scan.mp4"'));
  assert.ok(!html.includes('src="/media/overnight-scan-mobile.mp4"'));
  assert.ok(html.includes('Illustrative concept — not an active third-party AI integration.'));
});

test('Market Movers gets a complete viewport and keeps the whole source centered', () => {
  const css = read('public/acg-mobile-composition.css');
  const html = read('public/acg-landing-v6.html');
  assert.ok(css.includes('min-height:100vh;min-height:100svh'));
  assert.ok(css.includes('min-height:calc(100svh - 106px)'));
  assert.ok(css.includes('display:flex;align-items:center;justify-content:center'));
  assert.ok(css.includes('width:100vw;max-width:100vw;height:auto'));
  assert.ok(css.includes('margin:0;aspect-ratio:16/9'));
  assert.ok(css.includes('object-fit:contain;object-position:center;background:#000'));
  assert.ok(!html.includes('/media/market-movers-mobile.mp4'), 'cropped mobile film must not ship');
  assert.ok(html.includes('/media/market-movers.mp4'), 'use complete original footage');
});
