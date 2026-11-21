import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('all six cinematic MP4s support muted inline autoplay on Safari where permitted', () => {
  const html = read('public/acg-landing-v6.html');
  const videos = [...html.matchAll(/<video\b[^>]*>/g)].map(v => v[0]);
  assert.equal(videos.length, 6);
  for (const tag of videos) {
    assert.match(tag, /\bmuted\b/);
    assert.match(tag, /\bautoplay\b/);
    assert.match(tag, /\bplaysinline\b/);
    assert.doesNotMatch(tag, /\bcontrols\b/);
  }
  assert.ok(html.includes('href="/acg-mobile-video-playback.css"'));
  assert.ok(html.includes('<script src="/acg-landing-motion.js?v=20261121-mobile-playback" defer>'),
    'mobile browsers should fetch a fresh playback controller');
});

test('autoplay policy fallback is opt-in, fully client-side, and never bypasses OS preferences', () => {
  const js = read('public/acg-landing-motion.js');
  assert.ok(js.includes("navigator.connection?.saveData === true"));
  assert.ok(js.includes("window.matchMedia('(prefers-reduced-motion: reduce)')"));
  assert.ok(js.includes("video.removeAttribute('autoplay')"));
  assert.ok(js.includes('video.autoplay = false'));
  assert.ok(js.includes("video.setAttribute('webkit-playsinline', '')"));
  assert.ok(js.includes('video.muted = true'));
  assert.ok(js.includes('video.playsInline = true'));
  assert.ok(js.includes("button.addEventListener('click', () => {"));
  assert.ok(js.includes("video.dataset.userActivated = 'true'"));
  assert.ok(js.includes("attemptPlayback(state, true)"));
  assert.ok(js.includes("error?.name === 'NotSupportedError'"));
  assert.ok(js.includes('heroVideo.dataset.userActivated'));
  assert.ok(js.includes("state.visible = entry.isIntersecting"));
  assert.ok(js.includes("document.addEventListener('visibilitychange'"));
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/);
});

test('manual controls are invisible during normal autoplay, keyboard-operable and respect motion settings', () => {
  const css = read('public/acg-mobile-video-playback.css');
  assert.ok(css.includes('.film-tap-to-play[hidden],.acg-hero-tap-to-play[hidden]{display:none!important}'));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('min-height:44px'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('.terminal-story-video[data-user-activated="true"]'));
  assert.ok(css.includes('.acg-cinema-video[data-user-activated="true"]'));
});
