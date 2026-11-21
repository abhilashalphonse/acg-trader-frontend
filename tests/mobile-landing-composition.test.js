import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Access transition uses pure-black background and keeps actual account routes and disclosures', () => {
  const html = read('public/acg-landing-v6.html');
  const css = read('public/acg-mobile-composition.css');
  assert.ok(html.includes('<link rel="stylesheet" href="/acg-mobile-composition.css?v=20261121-sections2"/>'));
  assert.ok(html.indexOf('href="/acg-mobile-composition.css') > html.indexOf('href="/acg-landing-footer.css'),
    'mobile overrides load after original styles');
  assert.match(css, /#access\.section\.access\{[\s\S]*?background:#000/);
  assert.ok(css.includes('#access .access-card{'));
  assert.ok(css.includes('background:#0e0f12'));
  assert.ok(css.includes('border-color:#747985;color:#f0f1f3'), 'dark CTA must have high-contrast label');
  const access=html.slice(html.indexOf('<section class="section access"'),html.indexOf('</section>',html.indexOf('<section class="section access"')));
  assert.ok(access.includes('href="/?acg_login=1"'));
  assert.ok(access.includes('href="/?acg_connect_prop=1"'));
  assert.ok(access.includes('href="/account-security.html"'));
  assert.ok(access.includes('Never enter unrelated passwords'));
});

test('all mobile cinematic stages use compact purposeful layouts without modifying original film files', () => {
  const css=read('public/acg-mobile-composition.css');
  assert.ok(css.includes('@media(max-width:600px)'));
  assert.ok(css.includes('#features.ai-section{'));
  assert.ok(css.includes('min-height:0'));
  assert.ok(css.includes('margin:clamp(70px,9svh,86px) 0 0'));
  assert.ok(css.includes('#terminal .terminal-story-figure{'));
  assert.ok(css.includes('aspect-ratio:1200/1428'));
  assert.ok(css.includes('object-fit:contain;transform:none'));
  assert.ok(css.includes('#ai-connections .ai-connect-stage{'));
  assert.ok(css.includes('transform:scale(1.22)'));
  assert.ok(css.includes('#market-movers .market-movers-frame{'));
  assert.ok(css.includes('transform:scale(1.6)'));
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
    '#market-movers .market-movers-media{width:100vw',
    '#acg-faq .acg-faq-intro{text-align:left}'
  ]) assert.ok(css.includes(rule), rule);
  assert.ok(css.includes('width:100vw;max-width:none'));
  assert.ok(css.includes('object-fit:contain;transform:none'), 'terminal recording is never cropped');
  assert.ok(css.includes('#ai-connections .ai-connect-disclosure{'), 'assistant concept warning remains visible');
  assert.ok(css.includes('#acg-faq .acg-faq-disclaimer'), 'legal notice remains readable');
  const html = read('public/acg-landing-v6.html');
  assert.ok(html.includes('id="acg-terminal-film"'));
  assert.ok(html.includes('id="acg-ai-connection-film"'));
  assert.ok(html.includes('id="acg-market-movers-film"'));
  assert.ok(html.includes('aria-label="Terms and trading risk notice"'));
});
