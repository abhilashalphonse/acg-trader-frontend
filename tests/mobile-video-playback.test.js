import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('six landing films use silent inline autoplay without playback controls', () => {
  const html = read('public/acg-landing-v6.html');
  const videos = [...html.matchAll(/<video\b[^>]*>/g)].map(v => v[0]);
  assert.equal(videos.length, 6);
  for (const tag of videos) {
    assert.match(tag, /\bmuted\b/);
    assert.match(tag, /\bautoplay\b/);
    assert.match(tag, /\bplaysinline\b/);
    assert.doesNotMatch(tag, /\bcontrols\b/);
  }
  assert.ok(!html.includes('href="/acg-mobile-video-playback.css"'));
  assert.ok(html.includes('<script src="/acg-landing-motion.js?v=20261121-mobile-recovery1" defer>'));
});

test('autoplay can gracefully fall back to still imagery without adding a Play button', () => {
  const js = read('public/acg-landing-motion.js');
  assert.ok(js.includes("navigator.connection?.saveData === true"));
  assert.ok(js.includes("window.matchMedia('(prefers-reduced-motion: reduce)')"));
  assert.ok(js.includes("video.removeAttribute('autoplay')"));
  assert.ok(js.includes('video.autoplay = false'));
  assert.ok(js.includes("video.setAttribute('webkit-playsinline', '')"));
  assert.ok(js.includes('video.muted = true'));
  assert.ok(js.includes('video.playsInline = true'));
  assert.ok(js.includes("state.visible = entry.isIntersecting"));
  assert.ok(js.includes("video.classList.add('is-unavailable')"));
  assert.ok(js.includes("heroVideo.classList.add('is-unavailable')"));
  assert.ok(js.includes("document.addEventListener('visibilitychange'"));
  assert.doesNotMatch(js, /createElement\(['"]button|film-tap-to-play|hero-tap-to-play|Play video|Play intro animation/);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/);
});


test('recover mobile playback after load, visibility, resume or a user gesture without controls', () => {
  const js = read('public/acg-landing-motion.js');
  assert.match(js, /video\.addEventListener\(event/);
  assert.match(js, /'loadeddata', 'canplay'/);
  assert.match(js, /state\.visible && !wasVisible/);
  assert.match(js, /addEventListener\('pageshow', retryVisibleFilms\)/);
  assert.match(js, /addEventListener\('touchstart', retryVisibleFilms/);
  assert.match(js, /addEventListener\('pointerdown', retryVisibleFilms/);
  assert.match(js, /Date\.now\(\) - state\.lastAttempt < 1500/);
  assert.doesNotMatch(js, /createElement\(['"]button|film-tap-to-play/);
});
