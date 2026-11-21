import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';

const src = path => new URL('../' + path, import.meta.url);
const read = file => readFileSync(src(file), 'utf8');
const cleanSource = 'https://mwkwvchaqjqtyfgmialk.supabase.co/storage/v1/object/public/acg-trader/a7112847-cd7c-4d7b-9f91-540af4da8234.mp4';

test('remaining supporting videos and posters are valid local media', () => {
  const clips = [
    { file: 'acg-three-markets.mp4', maxBytes: 2000000 },
    { file: 'acg-shield.mp4', maxBytes: 150000 }
  ];
  for (const clip of clips) {
    const data = readFileSync(src('public/media/' + clip.file));
    assert.equal(data.subarray(4, 8).toString('ascii'), 'ftyp', clip.file);
    assert.ok(data.length > 10000 && data.length < clip.maxBytes, clip.file);
  }
  for (const file of ['acg-three-markets-poster.jpg', 'acg-shield-poster.jpg']) {
    const data = readFileSync(src('public/media/' + file));
    assert.equal(data.subarray(0, 2).toString('hex'), 'ffd8', file);
    assert.ok(statSync(src('public/media/' + file)).size > 10000);
  }
});

test('the hero uses one public logo-free clip and deletes obsolete Railway media', () => {
  const html = read('public/acg-landing-v6.html');
  const css = read('public/acg-cinema-hero.css');
  const js = read('public/acg-landing-motion.js');
  assert.ok(html.includes('src="' + cleanSource + '"'));
  assert.ok(html.includes('id="acg-hero-reveal"'));
  assert.equal((html.match(/<video/g) || []).length, 3);
  assert.ok(css.includes("url('/media/acg-prism-static.svg')"));
  assert.ok(css.includes('object-fit:cover'), 'art-directed crop must preserve geometry');
  assert.ok(css.includes('max-height:600px'), 'short landscape screens must be handled');
  assert.ok(css.includes('min-height:max(620px,100svh)'));
  assert.ok(css.includes('min-aspect-ratio:2/1'));
  assert.ok(css.includes('max-aspect-ratio:4/5'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(js.includes("heroVideo.addEventListener('ended'"));
  assert.ok(js.includes('completed = true'));
  assert.ok(js.includes('reduceMotion.matches'));
  assert.ok(js.includes('saveData()'));
  assert.ok(js.includes('visibilitychange'));
  assert.ok(js.includes('heroVideo.classList.add(\'is-unavailable\')'));
  assert.ok(!js.includes('heroReplay'));
  assert.ok(!html.includes('id="acg-hero-replay"'));
  assert.ok(!html.includes('acg-hero-desktop') && !html.includes('acg-hero-mobile'));
  for (const obsolete of ['acg-hero-desktop.mp4','acg-hero-mobile.mp4','acg-hero-desktop-freeze.jpg','acg-hero-mobile-freeze.jpg']) {
    assert.equal(existsSync(src('public/media/' + obsolete)), false, obsolete + ' must not ship');
  }
  const svg = read('public/media/acg-prism-static.svg');
  const mobileSvg = read('public/media/acg-prism-static-mobile.svg');
  assert.ok(svg.includes('<svg'));
  assert.ok(mobileSvg.includes('<svg'));
  assert.ok(css.includes("url('/media/acg-prism-static-mobile.svg')"));
});

test('the supporting films stay licensed-account aware and have no extra playback controls', () => {
  const html = read('public/acg-landing-v6.html');
  const js = read('public/acg-landing-motion.js');
  assert.ok(html.includes('class="shield-story" id="experience"'));
  assert.ok(html.includes('id="acg-three-markets-film"'));
  assert.ok(html.includes('id="acg-shield-film"'));
  for (const media of ['acg-three-markets.mp4','acg-shield.mp4']) {
    assert.ok(html.includes('/media/' + media));
  }
  assert.ok(html.includes('not indicate available instruments, supported integrations, partners or endorsements'));
  assert.ok(html.includes('not a security certification'));
  assert.ok(html.includes('Simulated trading for authorized accounts'));
  assert.ok(html.includes('href="/?acg_login=1"'));
  assert.ok(html.includes('href="/?acg_connect_prop=1"'));
  assert.ok(!html.includes('data-video-control='));
  assert.ok(!html.includes('film-media-control'));
  assert.ok(!html.includes(' controls preload'));
  assert.ok(!js.includes('manualPlay') && !js.includes('userPaused'));
  assert.ok(js.includes('IntersectionObserver'));
  assert.ok(js.includes('video.muted = true'));
  assert.ok(js.includes('video.pause()'));
  assert.ok(js.includes("video.removeAttribute('autoplay')"));
  assert.ok(js.includes("video.removeAttribute('controls')"));
  assert.ok(!js.includes('localStorage') && !js.includes('sessionStorage'));
});

test('Railway media server supports MP4 partial requests', () => {
  const server = read('server.mjs');
  assert.ok(server.includes("'Accept-Ranges'] = 'bytes'"));
  assert.ok(server.includes("'Content-Range'"));
  assert.ok(server.includes('writeHead(206'));
  assert.ok(server.includes('writeHead(416'));
  assert.ok(server.includes("'video/mp4'"));
});
