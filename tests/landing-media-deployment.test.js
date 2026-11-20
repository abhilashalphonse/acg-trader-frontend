import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const src = path => new URL('../' + path, import.meta.url);

test('supplied video assets are committed, valid MP4 files and web optimized', () => {
  const clips = [
    { file: 'acg-motion-panorama.mp4', maxBytes: 2000000 },
    { file: 'acg-motion-emblem.mp4', maxBytes: 200000 }
  ];
  for (const clip of clips) {
    const filename = src('public/media/' + clip.file);
    const data = readFileSync(filename);
    assert.equal(data.subarray(4, 8).toString('ascii'), 'ftyp', clip.file);
    assert.ok(data.length > 10000 && data.length < clip.maxBytes, clip.file);
  }
  for (const file of ['acg-motion-panorama-poster.jpg', 'acg-motion-emblem-poster.jpg']) {
    const data = readFileSync(src('public/media/' + file));
    assert.equal(data.subarray(0, 2).toString('hex'), 'ffd8', file);
    assert.ok(statSync(src('public/media/' + file)).size > 5000);
  }
});

test('premium landing integrates both clips without claiming partnerships or live brokerage execution', () => {
  const html = readFileSync(src('public/acg-landing-v6.html'), 'utf8');
  assert.match(html, /id="experience"/);
  assert.equal((html.match(/<video class="film-video /g) || []).length, 2);
  for (const file of ['acg-motion-panorama.mp4','acg-motion-emblem.mp4']) {
    assert.match(html, new RegExp('/media/' + file.replace('.', '\\.')));
  }
  assert.match(html, /muted autoplay loop playsinline preload="metadata"/);
  assert.match(html, /not ACG Trader partners, integrations, providers or endorsements/);
  assert.match(html, /not the ACG Trader logo or a separate product/);
  assert.match(html, /currently supports simulated trading through authorized accounts/);
  assert.match(html, /href="\/\?acg_login=1"/);
  assert.match(html, /href="\/\?acg_connect_prop=1"/);
  assert.doesNotMatch(html, /coming soon|white label|roadmap|future pricing|guaranteed profit/i);
});

test('Railway media server supports video MIME types and byte-range playback', () => {
  const server = readFileSync(src('server.mjs'), 'utf8');
  assert.match(server, /'\.mp4': 'video\/mp4'/);
  assert.match(server, /'Accept-Ranges'] = 'bytes'/);
  assert.match(server, /'Content-Range'/);
  assert.match(server, /res\.writeHead\(206/);
  assert.match(server, /res\.writeHead\(416/);
});

test('decorative motion is first-party, muted and respects accessibility preferences', () => {
  const js = readFileSync(src('public/acg-landing-motion.js'), 'utf8');
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /saveData/);
  assert.match(js, /video\.muted = true/);
  assert.match(js, /video\.pause\(\)/);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|sendBeacon/);
});
