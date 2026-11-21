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
        validSources: [...document.querySelectorAll('.film-video')].every(v => v.querySelector('source')?.src?.includes('/media/') || (['acg-three-markets-film','ai-prism-film','acg-terminal-film','acg-ai-connection-film','acg-market-movers-film'].includes(v.id) && v.querySelector('source')?.src?.includes('mwkwvchaqjqtyfgmialk.supabase.co'))),
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
      assert.equal(values.videoCount, 5);
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
      assert.deepEqual(values.videoTypes, ['video/mp4','video/mp4','video/mp4','video/mp4','video/mp4']);
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
          topAlignment: Math.abs(frame.top - movie.top),
          bottomAlignment: Math.abs(frame.bottom - movie.bottom),
          leftAlignment: Math.abs(frame.left - movie.left),
          rightAlignment: Math.abs(frame.right - movie.right),
        };
      });
      assert.ok(Math.abs(marketFilmGeometry.frameRatio - 1254/674) < 0.015,
        viewport.label + ' film frame shows the full native source, without cropping: ' + JSON.stringify(marketFilmGeometry));
      assert.ok(Math.abs(marketFilmGeometry.videoRatio - 1254/674) < 0.015,
        viewport.label + ' source remains undistorted: ' + JSON.stringify(marketFilmGeometry));
      assert.ok(marketFilmGeometry.topGap >= 0 && marketFilmGeometry.topGap <= 12,
        viewport.label + ' CTA and full film remain visually connected: ' + JSON.stringify(marketFilmGeometry));
      assert.ok(marketFilmGeometry.topAlignment < 2 && marketFilmGeometry.bottomAlignment < 2
        && marketFilmGeometry.leftAlignment < 2 && marketFilmGeometry.rightAlignment < 2,
        viewport.label + ' full video must align to all four edges of the frame: ' + JSON.stringify(marketFilmGeometry));
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
      assert.equal(await terminal.locator('.terminal-story-cta').getAttribute('href'), '/?acg_login=1');
      assert.equal(await terminal.locator('#acg-terminal-film source').count(), 1);
      assert.ok((await terminal.locator('#acg-terminal-film source').getAttribute('src')).includes('ACG%20Trader%20Terminal.mp4'));
      assert.equal(await terminal.locator('figcaption').innerText(),
        'Past performance is not an indicator of future performance. Data displayed above is indicative only. The return may increase or decrease as a result of currency fluctuations. Actual execution price may vary. Pricing data is provided by Acg Trader.');
      assert.equal(await terminal.locator('video').evaluate(v=>v.controls),false);
      const sectionOrder = await page.evaluate(() => {
        const ids=['platform','market-intro','features','terminal','experience','ai-connections','market-movers','access'];
        return ids.map(id => document.getElementById(id)?.getBoundingClientRect().top + window.scrollY);
      });
      assert.ok(sectionOrder.every((val,i)=>i===0||val>sectionOrder[i-1]), 'homepage order');
      assert.equal(await page.locator('#trading, #markets, .workflow-preview, .market-list').count(), 0, 'removed workflow and catalog are absent');
      assert.equal(await page.locator('a[href="#trading"], a[href="#markets"]').count(), 0, 'no orphaned anchors');
      assert.ok(await page.locator('a[href="#market-intro"]').count() >= 3, 'market links point to existing intro');
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
      assert.equal(await mobileSection.locator('.mobile-story-cta').getAttribute('href'), '/?acg_login=1');
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
      assert.equal((await connections.locator('.ai-connect-disclosure').innerText()).trim(),
        'Acg Trader does not endorse or guarantee third-party AI Tools. AI may produce errors or inaccurate outputs. You remain responsible for reviewing and approving all orders before execution. Acg Trader is not liable for any resulting losses, missed opportunities, or erroneous trades');
      const connectionVideo = connections.locator('#acg-ai-connection-film');
      assert.equal(await connectionVideo.count(), 1);
      assert.equal(await connectionVideo.locator('source').getAttribute('src'),
        'https://mwkwvchaqjqtyfgmialk.supabase.co/storage/v1/object/public/acg-trader/ACG%20Trader%20-%20Overnight%20Scan.mp4');
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
        const titleFont=parseFloat(getComputedStyle(el.querySelector('h2')).fontSize);
        return { titleLeft:heading.left,titleRight:heading.right,disclosureBottom:disclosure.bottom,
          ctaTop:cta.top,ctaBottom:cta.bottom,stageTop:stage.top,stageLeft:stage.left,
          stageRight:stage.right,stageWidth:stage.width,stageHeight:stage.height,
          videoWidth:video.width,sectionBottom:section.bottom,stageBottom:stage.bottom,
          sectionHeight:section.height,titleFont,
          screenWidth:window.innerWidth };
      });
      assert.ok(connectionBounds.disclosureBottom <= connectionBounds.ctaTop + 2 &&
        connectionBounds.ctaBottom <= connectionBounds.stageTop + 2, viewport.label+' AI intro order: '+JSON.stringify(connectionBounds));
      assert.ok(connectionBounds.stageLeft >= -2 && connectionBounds.stageRight <= connectionBounds.screenWidth + 2,
        viewport.label+' AI visual fits viewport: '+JSON.stringify(connectionBounds));
      assert.ok(connectionBounds.stageWidth <= 805 && connectionBounds.stageHeight >= 120,
        viewport.label+' compact AI visual fits and remains readable: '+JSON.stringify(connectionBounds));
      assert.ok(connectionBounds.titleFont <= (viewport.label === 'desktop' ? 65 : 44),
        viewport.label+' AI heading stays compact: '+JSON.stringify(connectionBounds));
      assert.ok(connectionBounds.sectionHeight <= (viewport.label === 'desktop' ? 900 : 650),
        viewport.label+' Section 6 is not oversized: '+JSON.stringify(connectionBounds));
      assert.ok(connectionBounds.stageBottom <= connectionBounds.sectionBottom + 2,
        viewport.label+' AI film fits the section: '+JSON.stringify(connectionBounds));
      await connections.screenshot({path:'artifacts/ai-connection-section-'+viewport.label+'.png'});
      // Section 7 — approved left-text / right-video product showcase.
      const movers = page.locator('#market-movers.market-movers-story');
      assert.equal(await movers.count(), 1);
      assert.equal(await movers.locator('h2').innerText(), 'See what’s moving.');
      assert.ok((await movers.locator('.market-movers-copy p').innerText()).includes('what’s gaining momentum'));
      assert.equal(await movers.locator('.market-movers-cta').getAttribute('href'), '#market-intro');
      assert.equal(await movers.locator('figcaption').count(), 0, 'Section 7 has no trailing disclaimer');
      const moversVideo = movers.locator('#acg-market-movers-film');
      assert.equal(await moversVideo.locator('source').getAttribute('src'),
        'https://mwkwvchaqjqtyfgmialk.supabase.co/storage/v1/object/public/acg-trader/ACG%20Market%20Movers%20-%20Take%20the%20Lead.mp4');
      assert.equal(await moversVideo.evaluate(v => v.controls), false);
      await movers.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('#acg-market-movers-film')?.readyState >= 2, null, {timeout:15000});
      const moversMeta=await moversVideo.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,readyState:v.readyState,fit:getComputedStyle(v).objectFit}));
      console.log('ACG_MARKET_MOVERS_MEDIA_'+viewport.label+' '+JSON.stringify(moversMeta));
      assert.ok(moversMeta.width>0 && moversMeta.height>0 && moversMeta.readyState>=2);
      assert.equal(moversMeta.fit, 'contain');
      const moversGeometry=await movers.evaluate(el=>{
        const box=selector=>el.querySelector(selector).getBoundingClientRect();
        const copy=box('.market-movers-copy'),video=box('.market-movers-frame'),
          film=el.querySelector('.market-movers-video'),
          cta=box('.market-movers-cta'),page=el.getBoundingClientRect();
        const bg=(node)=>getComputedStyle(node).backgroundColor;
        const frameStyle=getComputedStyle(el.querySelector('.market-movers-frame'));
        const filmStyle=getComputedStyle(film);
        return {copyRight:copy.right,copyBottom:copy.bottom,ctaBottom:cta.bottom,
          videoLeft:video.left,videoRight:video.right,videoTop:video.top,videoBottom:video.bottom,
          frameWidth:video.width,frameHeight:video.height,
          sectionHeight:page.height,sectionBottom:page.bottom,screenWidth:innerWidth,
          sectionBackground:bg(el),frameBackground:frameStyle.backgroundColor,videoBackground:bg(film),
          frameRadius:frameStyle.borderRadius,transform:filmStyle.transform,
          objectFit:filmStyle.objectFit};
      });
      assert.equal(moversGeometry.sectionBackground, 'rgb(0, 0, 0)', 'section black matte');
      assert.equal(moversGeometry.frameBackground, moversGeometry.sectionBackground, 'frame and section color match');
      assert.equal(moversGeometry.videoBackground, moversGeometry.sectionBackground, 'video and section color match');
      assert.equal(moversGeometry.frameRadius, '0px', 'no mismatched rounded video panel');
      assert.equal(moversGeometry.objectFit,'contain', 'keep film proportions');
      assert.ok(moversGeometry.transform.startsWith('matrix(') &&
        Number(moversGeometry.transform.match(/matrix\(([^,]+)/)?.[1]) >= 1.25,
        viewport.label+' video content actually enlarged: '+JSON.stringify(moversGeometry));
      if(viewport.label==='desktop'){
        assert.ok(moversGeometry.sectionHeight>=710, 'Section 7 must feel substantial: '+JSON.stringify(moversGeometry));
        assert.ok(moversGeometry.frameWidth>=650 && moversGeometry.frameHeight>=425,
          'Section 7 video stage too small: '+JSON.stringify(moversGeometry));
        assert.ok(moversGeometry.copyRight+20 < moversGeometry.videoLeft,
          'Market Movers must split copy left and film right: '+JSON.stringify(moversGeometry));
      }else{
        assert.ok(moversGeometry.frameWidth>=350 && moversGeometry.frameHeight>=225,
          'mobile film must fill available column: '+JSON.stringify(moversGeometry));
        assert.ok(moversGeometry.ctaBottom+15 <= moversGeometry.videoTop,
          'Market Movers must stack copy above film on mobile: '+JSON.stringify(moversGeometry));
      }
      assert.ok(moversGeometry.videoLeft>=-2 && moversGeometry.videoRight<=moversGeometry.screenWidth+2
        && moversGeometry.videoBottom<=moversGeometry.sectionBottom+2,
        'Market Movers film fits viewport: '+JSON.stringify(moversGeometry));
      await movers.screenshot({path:'artifacts/market-movers-'+viewport.label+'.png'});
      // Final section — editorial FAQ accordion replaces the old Markets/Orders CTA.
      const faq = page.locator('#acg-faq.acg-faq');
      assert.equal(await faq.count(), 1);
      assert.equal(await faq.locator('h2').innerText(), 'ACG Trader FAQs');
      assert.equal(await faq.locator('details.acg-faq-item').count(), 7);
      assert.equal(await page.locator('.final-cta').count(), 0, 'old closing CTA is removed');
      assert.equal(await page.locator('.footer a[href="#acg-faq"]').count(), 1);
      assert.equal(await faq.locator('details[open]').count(), 0, 'FAQs start collapsed');
      await faq.scrollIntoViewIfNeeded();
      const rows = faq.locator('details.acg-faq-item');
      await rows.nth(0).locator('summary').click();
      assert.equal(await rows.nth(0).getAttribute('open'), '', 'first FAQ expands');
      assert.ok((await rows.nth(0).locator('.acg-faq-answer').innerText()).includes('chart-first trading technology'));
      await rows.nth(1).locator('summary').click();
      assert.equal(await rows.nth(1).getAttribute('open'), '', 'second FAQ expands');
      assert.equal(await faq.locator('details[open]').count(), 1, 'opening another FAQ closes the prior');
      await rows.nth(2).locator('summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await rows.nth(2).getAttribute('open'), '', 'keyboard can expand an FAQ');
      assert.equal(await faq.locator('details[open]').count(), 1);
      const faqBounds=await faq.evaluate(el=>{
        const header=el.querySelector('h2').getBoundingClientRect();
        const first=el.querySelector('details summary').getBoundingClientRect();
        const section=el.getBoundingClientRect();
        const css=getComputedStyle(el);
        return {titleLeft:header.left,titleRight:header.right,
          rowLeft:first.left,rowRight:first.right,sectionBottom:section.bottom,
          viewportWidth:innerWidth,background:css.backgroundColor};
      });
      assert.equal(faqBounds.background,'rgb(0, 0, 0)', 'FAQ black background');
      assert.ok(faqBounds.titleLeft>=-2 && faqBounds.titleRight<=faqBounds.viewportWidth+2,
        viewport.label+' FAQ title fits the screen: '+JSON.stringify(faqBounds));
      assert.ok(faqBounds.rowLeft>=-2 && faqBounds.rowRight<=faqBounds.viewportWidth+2,
        viewport.label+' FAQ questions fit the screen: '+JSON.stringify(faqBounds));
      // Terms/risk fine print must sit beneath the final FAQ divider, remain readable,
      // and point to the real Terms page rather than inventing user acceptance.
      const disclaimer=faq.locator('.acg-faq-disclaimer[role="note"]');
      assert.equal(await disclaimer.count(), 1);
      assert.ok((await disclaimer.innerText()).includes('Terms & risk notice.'));
      assert.ok((await disclaimer.innerText()).includes('substantial financial losses'));
      assert.equal(await disclaimer.locator('a').getAttribute('href'), '/terms.html');
      const noteBounds=await disclaimer.evaluate(el=>{
        const section=el.closest('#acg-faq'),lastRow=section.querySelector('.acg-faq-item:last-child');
        const note=el.getBoundingClientRect(),last=lastRow.getBoundingClientRect(),css=getComputedStyle(el.querySelector('p'));
        return {left:note.left,right:note.right,top:note.top,lastRowBottom:last.bottom,
          fontSize:parseFloat(css.fontSize),lineHeight:parseFloat(css.lineHeight),viewport:innerWidth};
      });
      assert.ok(noteBounds.top>noteBounds.lastRowBottom+20,'risk notice follows FAQ rows with whitespace');
      assert.ok(noteBounds.left>=-2 && noteBounds.right<=noteBounds.viewport+2,
        viewport.label+' FAQ risk notice fits screen: '+JSON.stringify(noteBounds));
      assert.ok(noteBounds.fontSize>=12 && noteBounds.fontSize<=13 && noteBounds.lineHeight>=19,
        viewport.label+' risk notice is compact but readable: '+JSON.stringify(noteBounds));
      await faq.screenshot({path:'artifacts/acg-faq-'+viewport.label+'.png'});
      // The footer now continues the FAQ's black editorial style without
      // repeating its full terms-and-risk paragraph.
      const footer = page.locator('footer.footer');
      assert.equal(await footer.count(), 1, 'single site footer');
      assert.equal(await footer.locator('.footer-brand-block').count(), 1);
      assert.equal(await footer.locator('.footer-nav').count(), 2);
      assert.ok((await footer.locator('.footer-operator').innerText()).includes('ACG-MANAGEMENT, UNIPESSOAL LDA'));
      assert.ok((await footer.locator('.footer-bottom').innerText()).includes('Not a broker or investment adviser.'));
      assert.ok(!(await footer.innerText()).includes('Simulated balances and performance are not real money'),
        'avoid repeating FAQ disclaimer in footer');
      const footerLinks = await footer.locator('nav a').evaluateAll(links =>
        links.map(a => ({href:a.getAttribute('href'),text:a.textContent.trim()})));
      assert.ok(footerLinks.length >= 9 && footerLinks.every(l => Boolean(l.href) && Boolean(l.text)));
      const deadLinks = await footer.evaluate(el => [...el.querySelectorAll('nav a[href^="#"]')]
        .filter(link => !document.getElementById(link.getAttribute('href').slice(1)))
        .map(link => link.getAttribute('href')));
      assert.deepEqual(deadLinks,[], 'footer internal links resolve to visible sections');
      const footerGeometry = await footer.evaluate(el=>{
        const rect = selector => el.querySelector(selector).getBoundingClientRect();
        const outer=el.getBoundingClientRect();
        const brand=rect('.footer-brand-block'),product=rect('.footer-platform'),
          support=rect('.footer-resources'),legal=rect('.footer-bottom');
        const faq=document.getElementById('acg-faq').getBoundingClientRect();
        return {background:getComputedStyle(el).backgroundColor,
          left:outer.left,right:outer.right,top:outer.top,
          brandTop:brand.top,brandRight:brand.right,
          productLeft:product.left,productTop:product.top,productRight:product.right,
          supportLeft:support.left,supportTop:support.top,supportRight:support.right,
          bottomRowTop:legal.top,faqBottom:faq.bottom,width:innerWidth};
      });
      assert.equal(footerGeometry.background,'rgb(0, 0, 0)', 'footer matches the FAQ black');
      assert.ok(footerGeometry.top>=footerGeometry.faqBottom-2, 'FAQ flows into footer');
      assert.ok(footerGeometry.productRight<=footerGeometry.width+2 &&
        footerGeometry.supportRight<=footerGeometry.width+2 &&
        footerGeometry.left>=-2 && footerGeometry.right<=footerGeometry.width+2,
        viewport.label+' footer fits the viewport: '+JSON.stringify(footerGeometry));
      if(viewport.label==='desktop'){
        assert.ok(footerGeometry.brandRight+25<footerGeometry.productLeft &&
          footerGeometry.productRight+25<footerGeometry.supportLeft,
          'desktop footer columns do not crowd or overlap: '+JSON.stringify(footerGeometry));
      }else{
        assert.ok(footerGeometry.brandTop+25<footerGeometry.productTop &&
          Math.abs(footerGeometry.productTop-footerGeometry.supportTop)<8,
          'mobile footer puts branding above two link columns: '+JSON.stringify(footerGeometry));
      }
      await footer.scrollIntoViewIfNeeded();
      await footer.screenshot({path:'artifacts/acg-footer-'+viewport.label+'.png'});
      assert.deepEqual(errors, [], viewport.label+' errors');
      await page.screenshot({ path:'artifacts/landing-film-'+viewport.label+'-motion.png' });
      await page.evaluate(() => { document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,0); });
      await page.waitForTimeout(100);
      await page.screenshot({ path:'artifacts/landing-film-'+viewport.label+'.png', fullPage:true });
      await page.close();
    }
    // Visual bounds across phone, landscape, tablet, laptop, desktop and ultrawide.
    const screens = [[320,568],[360,780],[390,844],[430,932],[844,390],[768,1024],
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
        assert.ok(con.stageWidth<=805,width+'x'+height+' AI connection artwork exceeds compact width: '+JSON.stringify(con));
        assert.ok(con.noteBottom<=con.ctaTop+2 && con.ctaBottom<=con.stageTop+2,width+'x'+height+' AI connections copy spacing: '+JSON.stringify(con));
        assert.ok(con.stageBottom<=con.sectionBottom+3,width+'x'+height+' AI connection art cropped: '+JSON.stringify(con));
        // Full mobile design QA: access continuity and actual dimensions of
        // AI preview, terminal, AI assistant, mobile illustration and Movers.
        if(width<=600 && height>600 || width===320) {
          const q=await page.evaluate(()=>{
            const selector=s=>document.querySelector(s);
            const box=s=>selector(s).getBoundingClientRect();
            const bg=s=>getComputedStyle(selector(s)).backgroundColor;
            const style=s=>getComputedStyle(selector(s));
            const sections=['#features','#terminal','#experience','#ai-connections','#market-movers','#access','#acg-faq'];
            return {
              viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
              colors:sections.map(s=>({id:s,bg:bg(s)})),
              aiHeight:box('#features').height,aiCardWidth:box('#features .ai-preview').width,
              mobileHeight:box('#experience').height,
              terminalFrame:box('#terminal .terminal-story-frame').toJSON(),
              terminalVideoFit:style('#terminal .terminal-story-video').objectFit,
              aiConnection:box('#ai-connections .ai-connect-stage').toJSON(),
              movers:box('#market-movers .market-movers-frame').toJSON(),
              moversZoom:style('#market-movers .market-movers-video').transform,
              access:box('#access').toJSON(),
              accessCards:[...document.querySelectorAll('#access .access-card')].map(el=>({
                left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,
                color:getComputedStyle(el).backgroundColor,
                buttonHeight:el.querySelector('.btn').getBoundingClientRect().height,
                buttonTextColor:getComputedStyle(el.querySelector('.btn')).color
              })),
              faqTop:box('#acg-faq').top
            };
          });
          assert.ok(q.scrollWidth<=q.viewport+2,width+'x'+height+' mobile horizontal overflow: '+JSON.stringify(q));
          assert.ok(q.colors.filter(c=>['#market-movers','#access','#acg-faq'].includes(c.id))
            .every(c=>c.bg==='rgb(0, 0, 0)'), 'market to account to FAQ must all be pure black: '+JSON.stringify(q.colors));
          assert.ok(q.accessCards.length===2 && q.accessCards.every(v=>
            v.color==='rgb(14, 15, 18)' && v.buttonHeight>=44 &&
            v.left>=-2 && v.right<=q.viewport+2),
            'dark access cards and full-size touch targets: '+JSON.stringify(q.accessCards));
          assert.equal(q.accessCards[1].buttonTextColor,'rgb(240, 241, 243)',
            'authorized-account outline button must have light readable text');
          assert.ok(q.terminalFrame.width>=q.viewport-53 &&
            q.terminalFrame.left>=-2 && q.terminalFrame.right<=q.viewport+2 &&
            q.terminalVideoFit==='contain',
            'portrait terminal should fill phone safely: '+JSON.stringify(q.terminalFrame));
          assert.ok(q.aiConnection.width>=q.viewport-56 &&
            q.aiConnection.left>=-2 && q.aiConnection.right<=q.viewport+2,
            'AI assistant film should use available width: '+JSON.stringify(q.aiConnection));
          assert.ok(q.movers.width>=q.viewport-55 &&
            q.movers.left>=-2 && q.movers.right<=q.viewport+2,
            'Market Movers stage should use available width: '+JSON.stringify(q.movers));
          assert.ok(q.moversZoom!=='none','Market Movers visual needs meaningful zoom');
          assert.ok(q.aiHeight<=900,
            'AI narrative must not leave another oversized blank section: '+q.aiHeight);
          assert.ok(q.access.bottom<=q.faqTop+3,'account access flows directly into FAQs');
          if(width===390) {
            // Use normal-motion film frames for design screenshots; reduced-motion
            // static placeholders are separately checked earlier in the suite.
            await page.emulateMedia({reducedMotion:'no-preference'});
            await page.locator('#acg-terminal-film').scrollIntoViewIfNeeded();
            await page.waitForFunction(() => document.querySelector('#acg-terminal-film')?.readyState>=2,
              null,{timeout:12000});
            await page.locator('#access').scrollIntoViewIfNeeded();
            await page.locator('#access').screenshot({path:'artifacts/account-access-mobile-audited.png'});
            await page.locator('#market-movers').scrollIntoViewIfNeeded();
            await page.locator('#market-movers').screenshot({path:'artifacts/movers-mobile-audited.png'});
            await page.locator('#terminal').scrollIntoViewIfNeeded();
            await page.locator('#terminal').screenshot({path:'artifacts/terminal-mobile-audited.png'});
            await page.locator('#ai-connections').scrollIntoViewIfNeeded();
            await page.locator('#ai-connections').screenshot({path:'artifacts/ai-assistant-mobile-audited.png'});
          }
        }



      } finally {await page.close();}
    }
    // iOS may reject autoplay. Cinematic films should fail quietly with NO
    // overlay buttons, while the hero retains its static background artwork.
    const blocked = await browser.newPage({
      viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'
    });
    await blocked.addInitScript(() => {
      HTMLMediaElement.prototype.play = () =>
        Promise.reject(new DOMException('Autoplay blocked by mobile policy','NotAllowedError'));
    });
    await blocked.goto(base+'/acg-landing-v6.html',{waitUntil:'domcontentloaded'});
    await blocked.locator('#acg-three-markets-film').scrollIntoViewIfNeeded();
    await blocked.waitForFunction(() =>
      document.querySelector('#acg-three-markets-film')?.classList.contains('is-unavailable'),
      null,{timeout:8000});
    assert.equal(await blocked.locator('.film-tap-to-play,.acg-hero-tap-to-play').count(),0,
      'blocked autoplay never introduces visible Play buttons');
    assert.equal(await blocked.locator('#acg-three-markets-film').evaluate(v=>v.muted && v.playsInline),true);
    await blocked.close();
    const reduced = await browser.newPage({ viewport:{width:390,height:844},reducedMotion:'reduce' });
    await reduced.goto(base+'/acg-landing-v6.html',{waitUntil:'domcontentloaded'});
    await reduced.waitForTimeout(280);
    const states = await reduced.locator('video.film-video').evaluateAll(videos=>videos.map(v=>({paused:v.paused,controls:v.controls})));
    assert.ok(states.every(v=>v.paused), 'Reduced motion must not autoplay clips: '+JSON.stringify(states));
    assert.equal(await reduced.locator('#ai-prism-film').evaluate(v=>getComputedStyle(v).display),'none');
    assert.equal(await reduced.locator('[data-video-control],.film-media-control,.film-tap-to-play,.acg-hero-tap-to-play').count(),0);
    assert.ok(states.every(v=>v.controls === false), 'No video controls');
    assert.equal(await reduced.locator('#acg-hero-replay').count(),0);
    assert.equal(await reduced.locator('#acg-hero-reveal').evaluate(v=>getComputedStyle(v).display),'none');
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
