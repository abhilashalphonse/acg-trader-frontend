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
        validSources: [...document.querySelectorAll('.film-video')].every(v => v.querySelector('source')?.src?.includes('/media/') || (['acg-three-markets-film','ai-prism-film','acg-terminal-film','acg-ai-connection-film'].includes(v.id) && v.querySelector('source')?.src?.includes('mwkwvchaqjqtyfgmialk.supabase.co'))),
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
      assert.equal(values.videoCount, 4);
      assert.equal(await page.locator('video#acg-hero-reveal').count(), 1);
      assert.equal(await page.locator('a.acg-cinema-primary[href="/?acg_login=1"]').count(), 1);
      assert.equal(await page.locator('a.acg-cinema-secondary[href="/contact.html?topic=enterprise"]').count(), 1);
      const heroAssets = await page.evaluate(() => [...document.querySelectorAll('.acg-cinema source')].map(s => s.src || s.srcset));
      assert.equal(heroAssets.length, 1);
      assert.ok(heroAssets[0].includes('mwkwvchaqjqtyfgmialk.supabase.co/storage/v1/object/public/acg-trader/a7112847-cd7c-4d7b-9f91-540af4da8234.mp4'));
      assert.equal(await page.locator('#acg-hero-replay').count(), 0);
      assert.equal(await page.locator('video#acg-hero-reveal').evaluate(v => getComputedStyle(v).objectFit), 'cover');
      assert.equal(await page.locator('video#acg-three-markets-film').count(), 1);
      assert.equal(await page.locator('video#acg-shield-film').count(), 0);
      assert.equal(await page.locator('#experience.mobile-story').count(), 1);
      assert.equal(await page.locator('video#ai-prism-film').count(), 1);
      assert.deepEqual(values.videoTypes, ['video/mp4','video/mp4','video/mp4','video/mp4']);
      assert.ok(values.validSources);
      assert.ok(values.width <= values.viewportWidth + 3, viewport.label+' horizontal overflow: '+JSON.stringify(values));
      assert.ok(values.filmHeight >= 145 && values.filmHeight <= 760, viewport.label+' cinematic video height: '+values.filmHeight);
      const section = await page.evaluate(() => {
        const intro = document.querySelector('#market-intro')?.getBoundingClientRect();
        const film = document.querySelector('#market-intro .market-film')?.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        return { width: film?.width, intro: intro?.top, videoCenter: film ? film.left + film.width/2 : 0, viewportWidth };
      });
      assert.ok(section.width <= (viewport.label === 'desktop' ? 1160 : section.viewportWidth+2), viewport.label+' cinematic film fits: '+JSON.stringify(section));
      assert.ok(section.width >= (viewport.label === 'desktop' ? 850 : 300), viewport.label+' video fills the stage: '+JSON.stringify(section));
      assert.ok(Math.abs(section.videoCenter - section.viewportWidth / 2) < 8, viewport.label+' video centered');
      const marketIntro = page.locator('#market-intro');
      assert.equal(await marketIntro.locator('.market-intro-cta[href="/?acg_login=1"]').textContent(), 'See for yourself');
      assert.equal(await marketIntro.locator('.market-intro-cta').getAttribute('title'), 'Sign in to access your ACG Trader workspace');
      assert.equal(await marketIntro.locator('.market-intro-risk').textContent(),
        'Simulated trading only. Instrument availability varies by account. Trading involves risk.');
      const introLayout = await marketIntro.evaluate(el => {
        const description = el.querySelector('.market-intro-description').getBoundingClientRect();
        const risk = el.querySelector('.market-intro-risk').getBoundingClientRect();
        const cta = el.querySelector('.market-intro-cta').getBoundingClientRect();
        return { properOrder: description.bottom <= risk.top && risk.bottom <= cta.top,
          riskToCta: cta.top - risk.bottom, riskFont: getComputedStyle(el.querySelector('.market-intro-risk')).fontSize,
          overflow: el.scrollWidth > el.clientWidth + 3 };
      });
      assert.ok(introLayout.properOrder && introLayout.riskToCta <= 26 && !introLayout.overflow,
        viewport.label + ' Section 2 risk note and CTA layout: ' + JSON.stringify(introLayout));
      assert.equal(await page.locator('#market-intro #acg-three-markets-film').count(), 1);
      const newFilm = page.locator('#acg-three-markets-film');
      const newSource = await newFilm.locator('source').getAttribute('src');
      assert.equal(newSource,
        'https://mwkwvchaqjqtyfgmialk.supabase.co/storage/v1/object/public/acg-trader/ACG%20logo%20BTC%20swirl.mp4');
      await page.waitForTimeout(1100);
      const filmMeta=await newFilm.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,
        duration:v.duration,time:v.currentTime,readyState:v.readyState,paused:v.paused}));
      console.log('ACG_MARKETS_BTC_SWIRL_'+viewport.label+' '+JSON.stringify(filmMeta));
      assert.ok(filmMeta.width>0 && filmMeta.height>0 && filmMeta.readyState >= 2,
        viewport.label+' new BTC swirl video decoded');
      assert.equal(filmMeta.width, 1254);
      assert.equal(filmMeta.height, 674);
      const marketFilmGeometry = await page.locator('#market-intro .market-film').evaluate(el => {
        const frame = el.getBoundingClientRect();
        const movie = el.querySelector('video').getBoundingClientRect();
        const cta = document.querySelector('#market-intro .market-intro-cta').getBoundingClientRect();
        return {
          frameRatio: frame.width / frame.height,
          videoRatio: movie.width / movie.height,
          topGap: frame.top - cta.bottom,
          bottomAlignment: Math.abs(frame.bottom - movie.bottom),
          matteTrimmed: movie.height - frame.height,
        };
      });
      assert.ok(Math.abs(marketFilmGeometry.frameRatio - 1254/556) < 0.015,
        viewport.label + ' film frame trims black top matte: ' + JSON.stringify(marketFilmGeometry));
      assert.ok(Math.abs(marketFilmGeometry.videoRatio - 1254/674) < 0.015,
        viewport.label + ' source remains undistorted: ' + JSON.stringify(marketFilmGeometry));
      assert.ok(marketFilmGeometry.topGap >= 0 && marketFilmGeometry.topGap <= 24,
        viewport.label + ' CTA and film are visually connected: ' + JSON.stringify(marketFilmGeometry));
      assert.ok(marketFilmGeometry.bottomAlignment < 2 && marketFilmGeometry.matteTrimmed > 20,
        viewport.label + ' crop from top while retaining lower artwork: ' + JSON.stringify(marketFilmGeometry));
      assert.equal(await newFilm.evaluate(el=>getComputedStyle(el).objectFit),'contain');
      assert.equal(await marketIntro.locator('.market-intro-note').count(), 0,
        viewport.label + ' Section 2 should not render a trailing artwork note');
      const sectionBottomGap = await marketIntro.evaluate(el => {
        const section = el.getBoundingClientRect();
        const film = el.querySelector('.market-film').getBoundingClientRect();
        return Math.abs(section.bottom - film.bottom);
      });
      assert.ok(sectionBottomGap <= 2,
        viewport.label + ' Section 2 must end at BTC video edge: ' + sectionBottomGap);
      await page.locator('#market-intro').screenshot({path:'artifacts/markets-btc-swirl-'+viewport.label+'.png'});

      assert.equal(await page.locator('.fact-strip').count(), 0);
      // Third section is an illustrative AI preview, NOT a fake working tool.
      const ai = page.locator('#features.ai-section');
      assert.equal(await ai.count(), 1);
      assert.equal(await ai.locator('h2').textContent(), 'Think it. Ask it. Trade smarter.');
      assert.equal(await ai.locator('a.ai-section-cta').textContent(), 'Learn more ↗');
      assert.equal(await ai.locator('.ai-preview-header strong').textContent(), 'AI');
      assert.equal(await ai.locator('.ai-preview-action').evaluate(el => el.tagName), 'SPAN');
      assert.equal(await ai.locator('a.ai-section-cta').getAttribute('href'), '#ai-preview');
      assert.equal(await ai.locator('.ai-preview').count(), 1);
      await ai.scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      await ai.screenshot({ path:'artifacts/ai-section-'+viewport.label+'.png' });
      // Section 4 — authentic phone illustration with an honest internal destination.
      // Terminal is the fourth section; small screen media stays contained and the fifth section is unchanged.
      const terminal=page.locator('#terminal.terminal-story');
      assert.equal(await terminal.count(), 1);
      assert.equal(await terminal.locator('h2').innerText(), 'Your entire trading workspace. One screen.');
      assert.ok((await terminal.locator('.terminal-story-copy > p').innerText()).includes('Analyze markets, plan orders'));
      assert.equal(await terminal.locator('.terminal-story-cta').getAttribute('href'), '#trading');
      assert.equal(await terminal.locator('#acg-terminal-film source').count(), 1);
      assert.ok((await terminal.locator('#acg-terminal-film source').getAttribute('src')).includes('ACG%20Trader%20Terminal.mp4'));
      assert.equal(await terminal.locator('figcaption').innerText(),
        'Past performance is not an indicator of future performance. Data displayed above is indicative only. The return may increase or decrease as a result of currency fluctuations. Actual execution price may vary. Pricing data is provided by Acg Trader.');
      assert.equal(await terminal.locator('video').evaluate(v=>v.controls),false);
      const sectionOrder = await page.evaluate(() => {
        const ids=['platform','market-intro','features','terminal','experience','ai-connections'];
        return ids.map(id => document.getElementById(id)?.getBoundingClientRect().top + window.scrollY);
      });
      assert.ok(sectionOrder.every((val,i)=>i===0||val>sectionOrder[i-1]), 'homepage order');
      await terminal.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1650);
      const terminalVideoMeta = await terminal.locator('video').evaluate(v=>({
        width:v.videoWidth,height:v.videoHeight,seconds:v.duration,readyState:v.readyState,
        currentTime:v.currentTime,paused:v.paused
      }));
      console.log('ACG_TERMINAL_MEDIA_META_'+viewport.label+' '+JSON.stringify(terminalVideoMeta));
      assert.equal(terminalVideoMeta.width, 1200, 'Approved source is portrait 1200x1428');
      assert.equal(terminalVideoMeta.height, 1428, 'Approved source aspect ratio retained');
      assert.equal(await terminal.locator('.terminal-story-frame').evaluate(el => {
        const r=el.getBoundingClientRect();return Math.abs(r.width/r.height - 1200/1428)<0.012;
      }), true, 'Video frame uses native terminal aspect ratio');
      await terminal.screenshot({path:'artifacts/terminal-story-'+viewport.label+'.png'});
      const mobileSection=page.locator('#experience.mobile-story');
      assert.equal(await mobileSection.locator('h2').innerText(), 'Your trading desk.\nIn your pocket.');
      assert.equal(await mobileSection.locator('.mobile-story-cta').getAttribute('href'), '#trading');
      assert.ok((await mobileSection.locator('.mobile-story-cta').innerText()).includes('Explore mobile trading'));
      const artwork=mobileSection.locator('img[src="/media/acg-trader-mobile-artwork.webp"]');
      assert.equal(await artwork.count(), 1);
      await mobileSection.scrollIntoViewIfNeeded();
      await artwork.evaluate(img => img.decode());
      assert.equal(await artwork.evaluate(img => img.naturalWidth), 800);
      await mobileSection.screenshot({path:'artifacts/mobile-story-'+viewport.label+'.png'});
      // Sixth section — concept artwork, not a live third-party AI connection or order gateway.
      const connections = page.locator('#ai-connections.ai-connect-story');
      assert.equal(await connections.count(), 1);
      assert.equal(await connections.locator('h2').textContent(), 'Trade with your AI assistant.');
      assert.equal(await connections.locator('.ai-connect-cta').getAttribute('href'), '#ai-connect-film');
      assert.ok((await connections.locator('.ai-connect-disclosure').innerText()).includes('not currently live'));
      assert.ok((await connections.locator('.ai-connect-disclosure').innerText()).includes('do not imply partnership or endorsement'));
      const connectionVideo = connections.locator('#acg-ai-connection-film');
      assert.equal(await connectionVideo.count(), 1);
      assert.equal(await connectionVideo.locator('source').getAttribute('src'),
        'https://mwkwvchaqjqtyfgmialk.supabase.co/storage/v1/object/public/acg-trader/ACG%20Trader%20AI%20Connection.mp4');
      assert.equal(await connectionVideo.evaluate(v => v.controls), false);
      await connections.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('#acg-ai-connection-film')?.readyState >= 2, null, {timeout: 15000});
      await page.waitForTimeout(950);
      const connVideoState = await connectionVideo.evaluate(v => ({
        width:v.videoWidth, height:v.videoHeight, duration:v.duration, readyState:v.readyState,
        paused:v.paused, currentTime:v.currentTime,
        style:getComputedStyle(v).objectFit
      }));
      console.log('ACG_AI_CONNECTION_MEDIA_'+viewport.label+' '+JSON.stringify(connVideoState));
      assert.ok(connVideoState.width > 0 && connVideoState.height > 0 && connVideoState.readyState >= 2,
        viewport.label+' AI connection film decoded');
      assert.equal(connVideoState.style, 'contain');
      const connectionBounds = await connections.evaluate(el => {
        const a = selector => el.querySelector(selector).getBoundingClientRect();
        const heading=a('h2'),disclosure=a('.ai-connect-disclosure'),cta=a('.ai-connect-cta'),
              stage=a('.ai-connect-stage'),video=a('.ai-connect-video'),section=el.getBoundingClientRect();
        return { titleLeft:heading.left,titleRight:heading.right,disclosureBottom:disclosure.bottom,
          ctaTop:cta.top,ctaBottom:cta.bottom,stageTop:stage.top,stageLeft:stage.left,
          stageRight:stage.right,stageWidth:stage.width,stageHeight:stage.height,
          videoWidth:video.width,sectionBottom:section.bottom,stageBottom:stage.bottom,
          screenWidth:window.innerWidth };
      });
      assert.ok(connectionBounds.disclosureBottom <= connectionBounds.ctaTop + 2 &&
        connectionBounds.ctaBottom <= connectionBounds.stageTop + 2, viewport.label+' AI intro order: '+JSON.stringify(connectionBounds));
      assert.ok(connectionBounds.stageLeft >= -2 && connectionBounds.stageRight <= connectionBounds.screenWidth + 2,
        viewport.label+' AI visual fits viewport: '+JSON.stringify(connectionBounds));
      assert.ok(connectionBounds.stageWidth <= 1125 && connectionBounds.stageHeight >= 120,
        viewport.label+' AI visual remains substantial and unclipped: '+JSON.stringify(connectionBounds));
      assert.ok(connectionBounds.stageBottom <= connectionBounds.sectionBottom + 2,
        viewport.label+' AI film fits the section: '+JSON.stringify(connectionBounds));
      await connections.screenshot({path:'artifacts/ai-connection-section-'+viewport.label+'.png'});
      assert.deepEqual(errors, [], viewport.label+' errors');
      await page.screenshot({ path:'artifacts/landing-film-'+viewport.label+'-motion.png' });
      await page.evaluate(() => { document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,0); });
      await page.waitForTimeout(100);
      await page.screenshot({ path:'artifacts/landing-film-'+viewport.label+'.png', fullPage:true });
      await page.close();
    }
    // Visual bounds across phone, landscape, tablet, laptop, desktop and ultrawide.
    const screens = [[320,568],[390,844],[430,932],[844,390],[768,1024],
      [1024,768],[1366,768],[1440,900],[1920,1080],[2560,1080]];
    for (const [width,height] of screens) {
      const page = await browser.newPage({ viewport:{width,height}, reducedMotion:'reduce' });
      try {
        await page.goto(base+'/acg-landing-v6.html', {waitUntil:'domcontentloaded'});
        const b = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
          const hero=rect('.acg-cinema'),copy=rect('.acg-cinema-copy');
          const actions=rect('.acg-cinema-actions'),disclosure=rect('.acg-cinema-disclosure');
          const header=rect('header.site-header'), title=rect('.acg-cinema h1');
          return {heroBottom:hero?.bottom,copyTop:copy?.top,copyBottom:copy?.bottom,
            actionsBottom:actions?.bottom,disclosureBottom:disclosure?.bottom,
            headerBottom:header?.bottom,titleLeft:title?.left,titleRight:title?.right,
            heroWidth:hero?.width,innerWidth:window.innerWidth};
        });
        assert.ok(b.copyTop >= b.headerBottom-5, width+'x'+height+' text/header overlap: '+JSON.stringify(b));
        assert.ok(b.copyBottom <= b.heroBottom+3, width+'x'+height+' clipped text: '+JSON.stringify(b));
        assert.ok(b.actionsBottom <= b.disclosureBottom, width+'x'+height+' reversed disclosure: '+JSON.stringify(b));
        assert.ok(b.titleLeft >= -3 && b.titleRight <= b.innerWidth+3, width+'x'+height+' heading overflow: '+JSON.stringify(b));
        assert.ok(b.heroWidth <= b.innerWidth+3, width+'x'+height+' hero overflow: '+JSON.stringify(b));
        const a = await page.evaluate(() => {
          const rect = sel => document.querySelector(sel)?.getBoundingClientRect();
          const section=rect('#features.ai-section'),title=rect('.ai-section h2'),
            cta=rect('.ai-section-cta'),card=rect('.ai-preview'),note=rect('.ai-section-note');
          return {
            sectionBottom:section?.bottom,titleLeft:title?.left,titleRight:title?.right,
            ctaBottom:cta?.bottom,cardTop:card?.top,cardBottom:card?.bottom,
            cardLeft:card?.left,cardRight:card?.right,cardWidth:card?.width,
            noteBottom:note?.bottom,viewportWidth:window.innerWidth
          };
        });
        assert.ok(a.titleLeft >= -3 && a.titleRight <= a.viewportWidth+3, width+'x'+height+' AI title overflow: '+JSON.stringify(a));
        assert.ok(a.cardLeft >= -3 && a.cardRight <= a.viewportWidth+3, width+'x'+height+' AI card overflow: '+JSON.stringify(a));
        assert.ok(a.cardWidth <= 530, width+'x'+height+' oversized AI card: '+JSON.stringify(a));
        assert.ok(a.cardTop > a.ctaBottom + 65, width+'x'+height+' AI preview competes with prism band: '+JSON.stringify(a));
        assert.ok(a.noteBottom <= a.sectionBottom+3, width+'x'+height+' clipped AI disclaimer: '+JSON.stringify(a));
        const m = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
          const section=rect('#experience.mobile-story'),heading=rect('.mobile-story-copy h2');
          const copy=rect('.mobile-story-copy'), visual=rect('.mobile-story-visual'), image=rect('.mobile-story-visual img');
          const button=rect('.mobile-story-cta'), note=rect('.mobile-story-note');
          return {sectionBottom:section?.bottom,headingLeft:heading?.left,headingRight:heading?.right,
            copyBottom:copy?.bottom,imageLeft:visual?.left,imageRight:visual?.right,
            imageBottom:image?.bottom,buttonBottom:button?.bottom,noteBottom:note?.bottom,
            viewportWidth:window.innerWidth,viewportHeight:window.innerHeight};
        });
        assert.ok(m.headingLeft>=-3 && m.headingRight<=m.viewportWidth+3, width+'x'+height+' mobile heading overflow: '+JSON.stringify(m));
        assert.ok(m.imageLeft>=-3 && m.imageRight<=m.viewportWidth+3, width+'x'+height+' phone artwork horizontal overflow: '+JSON.stringify(m));
        assert.ok(m.imageBottom<=m.sectionBottom+3, width+'x'+height+' phone artwork clipped: '+JSON.stringify(m));
        assert.ok(m.noteBottom<=m.sectionBottom+3, width+'x'+height+' disclaimer clipped: '+JSON.stringify(m));
        const t = await page.evaluate(() => {
          const box = (selector) => document.querySelector(selector)?.getBoundingClientRect();
          const section=box('#terminal'),head=box('.terminal-story h2'),
            frame=box('.terminal-story-frame'),video=box('#acg-terminal-film'),
            disclosure=box('.terminal-story-figure figcaption');
          return {
            sectionBottom:section?.bottom,headLeft:head?.left,headRight:head?.right,
            frameLeft:frame?.left,frameRight:frame?.right,frameWidth:frame?.width,
            videoWidth:video?.width,disclosureBottom:disclosure?.bottom,
            viewportWidth:window.innerWidth
          };
        });
        assert.ok(t.headLeft>=-3 && t.headRight<=t.viewportWidth+3,width+'x'+height+' terminal heading overflow: '+JSON.stringify(t));
        assert.ok(t.frameLeft>=-3 && t.frameRight<=t.viewportWidth+3,width+'x'+height+' terminal screen overflow: '+JSON.stringify(t));
        assert.ok(t.frameWidth<=670,width+'x'+height+' terminal screen too wide: '+JSON.stringify(t));
        assert.ok(t.disclosureBottom<=t.sectionBottom+3,width+'x'+height+' terminal disclaimer clipped: '+JSON.stringify(t));
        const con = await page.evaluate(() => {
          const b = selector => document.querySelector(selector)?.getBoundingClientRect();
          const section=b('#ai-connections'),heading=b('#ai-connect-heading'),
                note=b('.ai-connect-disclosure'),cta=b('.ai-connect-cta'),
                stage=b('#ai-connect-film'),video=b('#acg-ai-connection-film');
          return {sectionBottom:section?.bottom,headingLeft:heading?.left,
            headingRight:heading?.right,noteBottom:note?.bottom,ctaTop:cta?.top,
            ctaBottom:cta?.bottom,stageTop:stage?.top,stageBottom:stage?.bottom,
            stageLeft:stage?.left,stageRight:stage?.right,stageWidth:stage?.width,
            videoWidth:video?.width,viewportWidth:window.innerWidth};
        });
        assert.ok(con.headingLeft>=-3 && con.headingRight<=con.viewportWidth+3,width+'x'+height+' AI connection heading overflow: '+JSON.stringify(con));
        assert.ok(con.stageLeft>=-3 && con.stageRight<=con.viewportWidth+3,width+'x'+height+' AI connection art overflow: '+JSON.stringify(con));
        assert.ok(con.noteBottom<=con.ctaTop+2 && con.ctaBottom<=con.stageTop+2,width+'x'+height+' AI connections copy spacing: '+JSON.stringify(con));
        assert.ok(con.stageBottom<=con.sectionBottom+3,width+'x'+height+' AI connection art cropped: '+JSON.stringify(con));



      } finally {await page.close();}
    }
    const reduced = await browser.newPage({ viewport:{width:390,height:844},reducedMotion:'reduce' });
    await reduced.goto(base+'/acg-landing-v6.html',{waitUntil:'domcontentloaded'});
    await reduced.waitForTimeout(280);
    const states = await reduced.locator('video.film-video').evaluateAll(videos=>videos.map(v=>({paused:v.paused,controls:v.controls})));
    assert.ok(states.every(v=>v.paused), 'Reduced motion must not autoplay clips: '+JSON.stringify(states));
    assert.equal(await reduced.locator('#ai-prism-film').evaluate(v=>getComputedStyle(v).display), 'none');
    assert.equal(await reduced.locator('[data-video-control], .film-media-control').count(), 0);
    assert.ok(states.every(v => v.controls === false), 'Both decorative videos must hide native controls');
    assert.equal(await reduced.locator('#acg-hero-replay').count(), 0);
    assert.equal(await reduced.locator('#acg-hero-reveal').evaluate(v => getComputedStyle(v).display), 'none');
    const normal = await browser.newPage({ viewport:{width:1440,height:900},reducedMotion:'no-preference' });
    await normal.goto(base+'/acg-landing-v6.html',{waitUntil:'domcontentloaded'});
    await normal.locator('#acg-three-markets-film').scrollIntoViewIfNeeded();
    await normal.waitForFunction(() => document.querySelector('#acg-three-markets-film')?.readyState >= 2);
    assert.equal(await normal.locator('[data-video-control], .film-media-control').count(), 0);
    await normal.close();
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
