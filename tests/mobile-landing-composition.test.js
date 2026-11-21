import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Access transition uses pure-black background and keeps actual account routes and disclosures', () => {
  const html = read('public/acg-landing-v6.html');
  const css = read('public/acg-mobile-composition.css');
  assert.ok(html.includes('<link rel="stylesheet" href="/acg-mobile-composition.css?v=20261121-audit1"/>'));
  assert.ok(html.indexOf('href="/acg-mobile-composition.css') > html.indexOf('href="/acg-landing-footer.css'),
    'mobile overrides load after original styles');
  assert.match(css, /#access\.section\.access\{[\s\S]*?background:#000/);
  assert.ok(css.includes('#access .access-card{'));
  assert.ok(css.includes('background:#0e0f12'));
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
  assert.ok(css.includes('margin-top:clamp(82px,10svh,98px)'));
  assert.ok(css.includes('#terminal .terminal-story-figure{'));
  assert.ok(css.includes('aspect-ratio:1200/1428'));
  assert.ok(css.includes('object-fit:contain;transform:none'));
  assert.ok(css.includes('#ai-connections .ai-connect-stage{'));
  assert.ok(css.includes('transform:scale(1.13)'));
  assert.ok(css.includes('#market-movers .market-movers-frame{'));
  assert.ok(css.includes('transform:scale(1.55)'));
  assert.ok(css.includes('#experience .mobile-story-visual img{'));
  assert.ok(css.includes('max-height:535px'));
  assert.doesNotMatch(css, /\.film-tap-to-play|\.acg-hero-tap-to-play|\.play-button/);
  const html=read('public/acg-landing-v6.html');
  assert.equal((html.match(/<video\b/g)||[]).length,6);
  assert.ok(html.includes('class="ai-connect-disclosure"'));
  assert.ok(html.includes('class="terminal-story-figure"'));
});
