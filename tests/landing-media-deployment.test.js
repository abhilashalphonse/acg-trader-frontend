import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const src = path => new URL('../' + path, import.meta.url);
const read = file => readFileSync(src(file), 'utf8');
const cleanSource = '/media/hero.mp4';

test('unused local market-coins clips are excluded from Railway builds', () => {
  for (const file of ['acg-three-markets.mp4','acg-three-markets-poster.jpg']) {
    assert.equal(existsSync(src('public/media/' + file)), false, file + ' must be removed');
  }
});

test('the hero uses one public logo-free clip and deletes obsolete Railway media', () => {
  const html = read('public/acg-landing-v6.html');
  const css = read('public/acg-cinema-hero.css');
  const js = read('public/acg-landing-motion.js');
  assert.ok(html.includes('src="' + cleanSource + '"'));
  assert.ok(html.includes('id="acg-hero-reveal"'));
  assert.equal((html.match(/<video/g) || []).length, 6);
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
  assert.ok(html.includes('class="terminal-story" id="terminal"'));
  assert.ok(html.indexOf('id="terminal"') < html.indexOf('id="experience"'));
  assert.ok(html.includes('id="acg-terminal-film"'));
  assert.ok(html.includes('src="/media/terminal.mp4"'));
  assert.ok(html.includes('href="/acg-terminal-section.css"'));
  const terminalCss = read('public/acg-terminal-section.css');
  assert.ok(terminalCss.includes('object-fit:contain'));
  assert.ok(terminalCss.includes('prefers-reduced-motion:reduce'));
  assert.ok(html.includes('Pricing data is provided by Acg Trader.'));
  assert.ok(html.includes('class="mobile-story" id="experience"'));
  assert.ok(html.includes('id="acg-three-markets-film"'));
  assert.ok(!html.includes('id="acg-shield-film"'));
  assert.ok(html.includes('id="ai-prism-film"'));
  assert.ok(html.includes('src="/media/ai-prism.mp4"'));
  assert.ok(html.includes('href="/acg-ai-section.css"'));
  const aiCss = read('public/acg-ai-section.css');
  assert.ok(aiCss.includes('prefers-reduced-motion:reduce'));
  assert.ok(aiCss.includes('width:min(520px,100%)'));
  const section3 = html.slice(html.indexOf('<section class="ai-section"'), html.indexOf('</section>', html.indexOf('<section class="ai-section"')));
  assert.ok(!section3.includes('Concept preview') && !section3.includes('ACG AI'), 'Section 3 wording unchanged');
  const phone = readFileSync(src('public/media/acg-trader-mobile-artwork.webp'));
  assert.equal(phone.subarray(0,4).toString('ascii'), 'RIFF');
  assert.equal(phone.subarray(8,12).toString('ascii'), 'WEBP');
  assert.ok(phone.length > 10000 && phone.length < 120000);
  for (const obsolete of ['acg-shield.mp4','acg-shield-poster.jpg']) {
    assert.equal(existsSync(src('public/media/' + obsolete)), false, obsolete + ' should not ship');
  }
  assert.ok(html.includes('src="/media/acg-trader-mobile-artwork.webp"'));
  assert.ok(html.includes('href="/acg-mobile-section.css"'));
  assert.ok(html.includes('Your trading desk.<br/>In your pocket.'));
  assert.ok(html.includes('Explore mobile trading'));
  assert.ok(html.includes('<section class="ai-connect-story" id="ai-connections"'));
  assert.ok(html.indexOf('id="experience"') < html.indexOf('id="ai-connections"')
    && html.indexOf('id="ai-connections"') < html.indexOf('id="market-movers"'), 'AI connection is Section 6');
  assert.ok(html.includes('overnight-scan.mp4'));
  assert.ok(!html.includes('ACG%20Trader%20AI%20Connection.mp4'), 'previous Section 6 film must not be referenced');
  assert.ok(html.includes('id="acg-ai-connection-film"'));
  assert.ok(html.includes('href="#ai-connect-film"'));
  assert.ok(html.includes('class="ai-connect-disclosure">Acg Trader does not endorse or guarantee third-party AI Tools. AI may produce errors or inaccurate outputs. You remain responsible for reviewing and approving all orders before execution. Acg Trader is not liable for any resulting losses, missed opportunities, or erroneous trades</p>'), 'approved AI responsibility disclosure is present');
  const aiConnectCss = read('public/acg-ai-connection-section.css');
  assert.ok(aiConnectCss.includes('aspect-ratio:auto 16/9'));
  assert.ok(aiConnectCss.includes('object-fit:contain'));
  assert.ok(aiConnectCss.includes('prefers-reduced-motion:reduce'));
  assert.ok(html.includes('href="/acg-ai-connection-section.css"'));
  assert.equal((html.match(/id="acg-ai-connection-film"/g)||[]).length,1);
  assert.ok(html.indexOf('id="ai-connections"') < html.indexOf('id="market-movers"') &&
    html.indexOf('id="market-movers"') < html.indexOf('id="access"'), 'Market Movers is Section 7, immediately before account access');
  assert.ok(html.includes('id="acg-market-movers-film"'));
  assert.ok(html.includes('src="/media/market-movers.mp4"'));
  assert.ok(html.includes('href="#market-intro">Explore markets'));
  assert.ok(html.includes('class="terminal-story-cta" href="/?acg_login=1"'));
  assert.ok(html.includes('class="mobile-story-cta" href="/?acg_login=1"'));
  assert.ok(!html.includes('id="trading"') && !html.includes('id="markets"'));
  assert.ok(!html.includes('href="#trading"') && !html.includes('href="#markets"'));
  assert.ok(!html.includes('From analysis<br/>to execution.') && !html.includes('Follow the markets<br/>you trade.'));
  assert.ok(!html.includes('Rankings and price moves are for demonstration only'));
  const marketMoversCss = read('public/acg-market-movers-section.css');
  assert.ok(marketMoversCss.includes('grid-template-columns:minmax(0,40fr) minmax(0,60fr)'));
  assert.ok(marketMoversCss.includes('grid-template-columns:minmax(0,1fr)'));
  assert.match(marketMoversCss, /#market-movers\.market-movers-story\{[\s\S]*?background:#000;/);
  assert.ok(marketMoversCss.includes('border-radius:0;box-shadow:none;background:#000'));
  assert.match(marketMoversCss, /object-position:center;[\s\S]*?background:#000;/);
  assert.ok(!marketMoversCss.includes('figcaption'));
  assert.ok(marketMoversCss.includes('min-height:720px'));
  assert.ok(marketMoversCss.includes('aspect-ratio:3/2'));
  assert.ok(marketMoversCss.includes('transform:scale(1.32)'));
  assert.ok(html.includes('href="/acg-market-movers-section.css?v=20261121-cinematic"'));
  assert.ok(marketMoversCss.includes('object-fit:contain'));
  assert.ok(marketMoversCss.includes('prefers-reduced-motion:reduce'));
  assert.ok(!html.includes('class="market-movers-video" controls'));
  assert.ok(!html.includes('acg-shield.mp4'));
  const mobileCss = read('public/acg-mobile-section.css');
  assert.ok(mobileCss.includes('max-width:720px'));
  assert.ok(mobileCss.includes('max-height:600px'));
  assert.ok(html.includes('src="/media/btc-swirl.mp4"'));
  assert.ok(!html.includes('/media/acg-three-markets.mp4'));
  assert.ok(!html.includes('acg-three-markets-poster.jpg'));
  const marketCss = read('public/acg-market-intro.css');
  assert.ok(marketCss.includes('width:min(1140px,100%)'));
  assert.ok(marketCss.includes('object-fit:contain'));
  assert.ok(marketCss.includes('aspect-ratio:1254/674'), 'both frame and source use the full native ratio');
  assert.ok(!marketCss.includes('1254/556'), 'old cropped video frame is not allowed');
  assert.ok(marketCss.includes('.market-intro-media{margin:8px auto 0'), 'tight desktop media spacing without clipping video');
  assert.ok(marketCss.includes('.market-intro-media{margin-top:8px}'), 'tight phone media spacing without clipping video');
  assert.ok(marketCss.includes('display:block;position:static;width:100%;height:100%'), 'video stays in the full-size frame');
  assert.ok(!marketCss.includes('position:absolute;left:0;bottom:0'), 'no bottom-aligned video cropping');
  assert.ok(!html.includes('not indicate available instruments, supported integrations, partners or endorsements'));
  assert.ok(!html.includes('class="market-intro-note"'));
  assert.ok(html.includes('Simulated trading only. Instrument availability varies by account. Trading involves risk.'));
  assert.ok(marketCss.includes('padding:100px 0 0'));
  assert.ok(marketCss.includes('padding:73px 0 0'));
  assert.ok(html.includes('Illustrative mobile interface. Trading features and access depend on your account and device.'));
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
