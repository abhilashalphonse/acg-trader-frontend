// Read-only first-party landing smoke; no credentials, account APIs or trading actions.
import { spawn } from 'node:child_process';
import process from 'node:process';
import { mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = 4178;
const base = 'http://127.0.0.1:' + port;
const server = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore','pipe','pipe'],
  detached: true
});
let logs = '';
server.stdout.on('data', x => logs += String(x));
server.stderr.on('data', x => logs += String(x));

try {
  let ready = false;
  for (let tries = 0; tries < 50; tries++) {
    try {
      const r = await fetch(base + '/health/live', { signal: AbortSignal.timeout(800) });
      if (r.ok) { ready = true; break; }
    } catch { /* server starting */ }
    await delay(160);
  }
  assert.ok(ready, 'Railway-style static host did not start: ' + logs);

  const partial = await fetch(base + '/media/acg-three-markets.mp4', {
    headers: { Range: 'bytes=0-99' }
  });
  assert.equal(partial.status, 206);
  assert.match(partial.headers.get('content-type') || '', /video\/mp4/);
  assert.match(partial.headers.get('content-range') || '', /bytes 0-99\/1547415/);
  assert.equal((await partial.arrayBuffer()).byteLength, 100);

  mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    for (const viewport of [
      { width: 1440, height: 900, label:'desktop' },
      { width: 390, height: 844, label:'mobile' }
    ]) {
      const page = await browser.newPage({ viewport, reducedMotion:'no-preference' });
      const errors = [];
      page.on('pageerror', err => errors.push(String(err.message)));
      const r = await page.goto(base+'/acg-landing-v6.html', { waitUntil:'domcontentloaded' });
      assert.equal(r?.status(), 200);
      await page.screenshot({ path:'artifacts/landing-film-'+viewport.label+'-hero.png' });
      await page.locator('.market-film').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.market-film video')?.readyState >= 2, null, { timeout: 8000 });
      await page.waitForTimeout(350);
      const values = await page.evaluate(() => ({
        heading: document.querySelector('.acg-cinema h1')?.textContent,
        brand: document.querySelector('.site-header .brand img')?.getAttribute('src'),
        videoCount: document.querySelectorAll('.film-video').length,
        videoTypes: [...document.querySelectorAll('.film-video source')].map(v=>v.type),
        validSources: [...document.querySelectorAll('.film-video')].every(v=>v.querySelector('source')?.src?.includes('/media/')),
        width: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        filmHeight: document.querySelector('.market-film')?.getBoundingClientRect().height
      }));
      assert.match(values.heading || '', /Advanced trading\./);
      assert.equal(await page.locator('.acg-cinema-eyebrow').textContent(), 'Trading & Beyond');
      assert.equal(await page.locator('.acg-cinema-subhead').textContent(), 'Chart-first execution. Risk-based order planning.');
      assert.equal(await page.locator('a.acg-cinema-primary[href="/?acg_login=1"]').count(), 1);
      assert.equal(await page.locator('a.acg-cinema-secondary[href="/contact.html?topic=enterprise"]').count(), 1);
      const heroBounds = await page.evaluate(() => {
        const hero = document.querySelector('.acg-cinema')?.getBoundingClientRect();
        const buttons = document.querySelector('.acg-cinema-actions')?.getBoundingClientRect();
        const disclosure = document.querySelector('.acg-cinema-disclosure')?.getBoundingClientRect();
        return { heroBottom: hero.bottom, buttonsBottom: buttons.bottom,
          disclosureBottom: disclosure.bottom, top: disclosure.top,
          headerPosition: getComputedStyle(document.querySelector('.site-header')).position };
      });
      assert.equal(heroBounds.headerPosition, 'absolute', viewport.label+' header overlay');
      assert.ok(heroBounds.buttonsBottom < heroBounds.disclosureBottom, viewport.label+' CTA/disclosure order');
      assert.ok(heroBounds.disclosureBottom <= heroBounds.heroBottom + 3, viewport.label+' disclosure fits hero: '+JSON.stringify(heroBounds));
      assert.equal(values.brand, '/acg-trader-wordmark.png');
      assert.equal(values.videoCount, 2);
      assert.equal(await page.locator('video#acg-hero-reveal').count(), 1);
      assert.equal(await page.locator('a.acg-cinema-primary[href="/?acg_login=1"]').count(), 1);
      assert.equal(await page.locator('a.acg-cinema-secondary[href="/contact.html?topic=enterprise"]').count(), 1);
      const heroAssets = await page.evaluate(() => [...document.querySelectorAll('.acg-cinema source')].map(s => s.src || s.srcset));
      assert.ok(heroAssets.some(src => src.includes('acg-hero-mobile.mp4')));
      assert.ok(heroAssets.some(src => src.includes('acg-hero-desktop.mp4')));
      assert.equal(await page.locator('video#acg-three-markets-film').count(), 1);
      assert.equal(await page.locator('video#acg-shield-film').count(), 1);
      assert.deepEqual(values.videoTypes, ['video/mp4','video/mp4']);
      assert.ok(values.validSources);
      assert.ok(values.width <= values.viewportWidth + 3, viewport.label+' horizontal overflow: '+JSON.stringify(values));
      assert.ok(values.filmHeight >= 125 && values.filmHeight <= 260, viewport.label+' compact video height: '+values.filmHeight);
      const section = await page.evaluate(() => {
        const intro = document.querySelector('#market-intro')?.getBoundingClientRect();
        const film = document.querySelector('#market-intro .market-film')?.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        return { width: film?.width, intro: intro?.top, videoCenter: film ? film.left + film.width/2 : 0, viewportWidth };
      });
      assert.ok(section.width <= (viewport.label === 'desktop' ? 470 : 305), viewport.label+' small film width: '+JSON.stringify(section));
      assert.ok(Math.abs(section.videoCenter - section.viewportWidth / 2) < 8, viewport.label+' video centered');
      assert.equal(await page.locator('#market-intro .market-intro-cta[href="#markets"]').textContent(), 'Explore markets');
      assert.equal(await page.locator('#market-intro #acg-three-markets-film').count(), 1);
      assert.equal(await page.locator('.fact-strip').count(), 0);
      assert.deepEqual(errors, [], viewport.label+' errors');
      await page.screenshot({ path:'artifacts/landing-film-'+viewport.label+'-motion.png' });
      await page.evaluate(() => { document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,0); });
      await page.waitForTimeout(100);
      await page.screenshot({ path:'artifacts/landing-film-'+viewport.label+'.png', fullPage:true });
      await page.close();
    }
    const reduced = await browser.newPage({ viewport:{width:390,height:844},reducedMotion:'reduce' });
    await reduced.goto(base+'/acg-landing-v6.html',{waitUntil:'domcontentloaded'});
    await reduced.waitForTimeout(280);
    const states = await reduced.locator('video.film-video').evaluateAll(videos=>videos.map(v=>({paused:v.paused,controls:v.controls})));
    assert.ok(states.every(v=>v.paused), 'Reduced motion must not autoplay clips: '+JSON.stringify(states));
    assert.equal(await reduced.locator('[data-video-control]:not([hidden])').count(), 2);
    await reduced.close();
  } finally {
    await browser.close();
  }
  console.log('ACG_LANDING_VIDEO_SMOKE_PASS desktop mobile range accessibility');
} finally {
  try { process.kill(-server.pid,'SIGTERM'); }
  catch { server.kill('SIGTERM'); }
  server.stdout.destroy();
  server.stderr.destroy();
}
