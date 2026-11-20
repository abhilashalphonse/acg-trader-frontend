import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const src = path => new URL('../' + path, import.meta.url);

test('replacement user videos and posters are valid optimized local files', () => {
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

test('each film fits the story and no old video appears on the website', () => {
  const html = readFileSync(src('public/acg-landing-v6.html'), 'utf8');
  assert.match(html, /class="shield-story" id="experience"/);
  assert.match(html, /class="market-film"/);
  assert.equal((html.match(/<video\b/g) || []).length, 2);
  assert.match(html, /id="acg-three-markets-film"/);
  assert.match(html, /id="acg-shield-film"/);
  assert.match(html, /object-fit:contain/);
  for (const file of ['acg-three-markets.mp4', 'acg-shield.mp4']) {
    assert.ok(html.includes('/media/' + file), file);
  }
  assert.doesNotMatch(html, /acg-motion-panorama|acg-motion-emblem|hero-ambient-video/);
  assert.match(html, /not indicate available instruments, supported integrations, partners or endorsements/);
  assert.match(html, /not a security certification/);
  assert.match(html, /currently supports simulated trading through authorized accounts/);
  assert.match(html, /href="\/\?acg_login=1"/);
  assert.match(html, /href="\/\?acg_connect_prop=1"/);
  assert.doesNotMatch(html, /coming soon|white label|roadmap|future pricing|guaranteed profit/i);
});

test('Railway static media server supports byte ranges and MP4 MIME types', () => {
  const server = readFileSync(src('server.mjs'), 'utf8');
  assert.match(server, /'\.mp4': 'video\/mp4'/);
  assert.match(server, /'Accept-Ranges'] = 'bytes'/);
  assert.match(server, /'Content-Range'/);
  assert.match(server, /res\.writeHead\(206/);
  assert.match(server, /res\.writeHead\(416/);
});

test('film playback honors reduced motion, save-data and explicit user controls', () => {
  const html = readFileSync(src('public/acg-landing-v6.html'), 'utf8');
  const js = readFileSync(src('public/acg-landing-motion.js'), 'utf8');
  assert.equal((html.match(/data-video-control=/g) || []).length, 2);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /saveData/);
  assert.match(js, /video\.muted = true/);
  assert.match(js, /video\.pause\(\)/);
  assert.match(js, /video\.removeAttribute\('autoplay'\)/);
  assert.match(js, /button\.addEventListener\('click'/);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|sendBeacon/);
});
