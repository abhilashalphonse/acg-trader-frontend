import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const base = process.env.MINI_TERMINAL_QA_URL || 'http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1&acg_dock_audit=1';
const errors = [];
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
async function setup(fallback = false) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ fallback }) => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('acg-trader-desktop-dock-audit-layout-v1', JSON.stringify({ sidebarCollapsed: true, sidebarWidth: 360, dockCollapsed: false, dockHeight: 300 }));
    if (fallback) Object.defineProperty(window, 'documentPictureInPicture', { value: undefined });
  }, { fallback });
  await page.goto(base);
  // The right-side Trade button opens the execution panel containing the
  // only mini-terminal launcher. The rail no longer has a pop-out button.
  await page.getByRole('button', { name: 'Trade', exact: true }).click();
  await page.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  return page;
}
try {
  const normal=await browser.newPage({viewport:{width:1440,height:900}});
  await normal.goto(base.replace('&acg_dock_audit=1',''),{waitUntil:'domcontentloaded'});
  await normal.locator('[data-v4-positions=true]').waitFor({state:'visible'});
  check(await normal.getByRole('button',{name:'Pop out mini terminal'}).count()===0,
    'Normal customer V4 does not load mini feature');
  await normal.close();
  const page = await setup();
  check(await page.evaluate(() => Boolean(window.documentPictureInPicture)), 'Chrome supports native document PiP');
  check(await page.locator('.acg-floating-order').count()===0,'Audit never renders in-chart floating trade widget');
  check(await page.locator('.acg-mini-attached').count()===0,'Audit does not mount an attached mini ticket');
  check(await page.locator('[data-acg-mini-header-launcher=true]').count()===1,
    'Exactly one popup launcher is embedded in the trade execution header');
  check(await page.locator('[data-acg-mini-rail-launcher],[data-acg-mini-launcher=true],.acg-mini-rail-launcher').count()===0,
    'Right-hand toolbar has no separate popup button');
  check(await page.locator('.v4-head-actions button').count()===2,
    'Popup button is immediately next to Close trade ticket');
  check(await page.getByRole('button',{name:'Ticket information'}).count()===0,
    'Three-dot Ticket information button is replaced in audit mode');
  await page.getByRole('button', { name: 'Pop out mini terminal' }).click();
  await page.waitForFunction(() => documentPictureInPicture.window?.document.querySelector('.acg-mini-tabs'));
  // Clicking the header again must focus the SAME native window.
  await page.evaluate(() => { window.__miniFirstPiP = documentPictureInPicture.window; });
  await page.getByRole('button', { name: 'Pop out mini terminal' }).click();
  check(await page.evaluate(() => documentPictureInPicture.window === window.__miniFirstPiP),
    'Repeated header click focuses the existing native mini terminal');
  const pip = expression => page.evaluate(expression);
  check(await pip(() => documentPictureInPicture.window.document.querySelector('.acg-mini-terminal')?.dataset.windowMode==='Always on top'), 'Native always-on-top window opens');
  check(await pip(()=>{
    const d=documentPictureInPicture.window.document;
    const price=d.querySelector('.acg-mini-market-price strong')?.textContent;
    const buy=d.querySelector('.acg-mini-buy strong')?.textContent;
    const sell=d.querySelector('.acg-mini-sell strong')?.textContent;
    return price==='1.11730'&&buy==='1.11735'&&sell==='1.11725';
  }), 'Five-digit forex quotes must never receive a thousands separator in fractions');
  const nativeSize=await pip(()=>({width:documentPictureInPicture.window.innerWidth,height:documentPictureInPicture.window.innerHeight}));
  const nativeHeight=nativeSize.height;
  // Chrome may clamp Document PiP to a platform-dependent minimum outer width.
  // Validate the requested window size in source and the actual layout fit here.
  console.log('MINI_NATIVE_WINDOW_DIMENSIONS', JSON.stringify(nativeSize));
  check(nativeSize.width>=240 && nativeSize.height>=300,
    'Native mini terminal opens a usable window (browser may enforce minimums)');
  check(await pip(() => {
    const d=documentPictureInPicture.window.document;
    return d.documentElement.scrollWidth<=d.documentElement.clientWidth+1;
  }), 'Native popup content does not overflow horizontally');
  check(await pip(() => documentPictureInPicture.window.getComputedStyle(documentPictureInPicture.window.document.querySelector('.acg-mini-titlebar')).display === 'none'), 'Native browser chrome replaces the duplicate inner titlebar');
  check(await pip(()=>{
    const d=documentPictureInPicture.window.document;
    const mini=d.querySelector('.acg-mini-quick-order');
    const content=d.querySelector('.acg-mini-content');
    const buttons=d.querySelectorAll('.acg-mini-quick-actions button');
    const free=d.querySelector('.acg-mini-free-margin');
    const estimate=d.querySelector('.acg-mini-estimate');
    const spread=d.querySelector('.acg-mini-spread');
    const context=d.querySelector('.acg-mini-context');
    return mini&&free&&estimate&&spread&&context&&buttons.length===2
      && !d.querySelector('.acg-mini-quote-main')
      && d.querySelectorAll('.acg-mini-order-family').length===1
      && content.scrollHeight<=content.clientHeight+4;
  }), 'Default slim PiP fits compact trade without duplicate quotes or scrolling');
  await pip(() => [...documentPictureInPicture.window.document.querySelectorAll('nav button')].find(b => b.textContent.startsWith('Positions')).click());
  check(await page.evaluate(expected=>documentPictureInPicture.window.innerHeight===expected,nativeHeight),
    'Native popup height stays unchanged when switching to Positions');
  await page.waitForFunction(() => documentPictureInPicture.window.document.querySelectorAll('.acg-mini-row').length === 2);
  check(await pip(() => {
    const d=documentPictureInPicture.window.document;
    const rows=[...d.querySelectorAll('.acg-mini-row')];
    const content=d.querySelector('.acg-mini-content')?.getBoundingClientRect();
    return rows.length===2 && content && rows[0].getBoundingClientRect().top>=content.top-1
      && rows[1].getBoundingClientRect().bottom<=content.bottom+1;
  }), 'Both slim position cards fit inside the popup without scrolling');
  check(await pip(() => !documentPictureInPicture.window.document.querySelector('.acg-mini-footer')),
    'Detached Positions has no bottom footer');
  check(await pip(() => {
    const text=documentPictureInPicture.window.document.querySelector('.acg-mini-row')?.textContent||'';
    return ['Entry','Current','SL','TP'].every(field=>text.includes(field)) && Boolean(documentPictureInPicture.window.document.querySelector('.acg-mini-row-head>b'));
  }), 'Mini position presents unified prices, risk and P&L');
  await page.evaluate(() => window.v4PositionsQA.setPnl('position-eur-1', 123.45));
  await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('.acg-mini-rows').textContent.includes('123.45'));
  check(true, 'Native window receives live position updates from main terminal');
  await pip(() => documentPictureInPicture.window.document.querySelector('.acg-mini-row').click());
  await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('.acg-mini-back'));
  check(await page.evaluate(() => window.v4PositionsQA.commands.length === 0), 'Opening position management never sends a command');
  await page.evaluate(() => window.v4PositionsQA.setAccount({ id: 'switched-account', accountCode: 'NEW-ACCOUNT' }));
  await page.waitForFunction(() => !documentPictureInPicture.window.document.querySelector('.acg-mini-back'));
  check(await pip(() => documentPictureInPicture.window.document.querySelector('.acg-mini-titlebar').title==='NEW-ACCOUNT'), 'Account switch clears selected management and updates identity');
  await page.evaluate(()=>window.v4PositionsQA.setPositions([]));
  await page.waitForFunction(()=>documentPictureInPicture.window?.document.querySelector('.acg-mini-empty'));
  check(await pip(()=>{
    const d=documentPictureInPicture.window.document;
    return d.querySelector('.acg-mini-empty strong')?.textContent==='No open positions'
      && !d.querySelector('.acg-mini-empty span')
      && !d.querySelector('.acg-mini-footer');
  }),'Empty detached positions show one concise label and no footer');
  await page.evaluate(()=>window.v4PositionsQA.setPositions([
    {id:'position-eur-1',positionId:'position-eur-1',symbol:'EURUSD',side:'SELL',volume:0.01,
      entry:1.11652,closePrice:1.11735,pnl:123.45,pnlCurrency:'USD',valuationStatus:'LIVE'},
    {id:'position-btc-2',positionId:'position-btc-2',symbol:'BTCUSD',side:'BUY',volume:0.02,
      entry:67800,closePrice:68100,pnl:6,pnlCurrency:'USD',sl:67000,tp:70000}
  ]));
  await page.waitForFunction(()=>documentPictureInPicture.window?.document.querySelectorAll('.acg-mini-row').length===2);
  await pip(() => documentPictureInPicture.window.document.querySelector('[aria-label="Close mini terminal"]').click());
  await page.locator('[data-acg-mini-window-state="closed"]').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  check(await page.locator('.acg-floating-order').count() === 0,
    'Closing popup never recreates the old floating widget');
  check(await page.locator('[data-acg-mini-header-launcher=true]').count()===1,'Header launcher remains available');
  await page.getByRole('button', { name: 'Pop out mini terminal' }).click();
  await page.waitForFunction(() => documentPictureInPicture.window?.document.querySelector('.acg-mini-tabs'));
  await pip(() => documentPictureInPicture.window.close());
  await page.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  check(await page.locator('.acg-floating-order').count()===0,'Native close preserves popup-only mode');
  await page.close();

  const fallback = await setup(true);
  const popupPromise = fallback.waitForEvent('popup');
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).click();
  const popup = await popupPromise;
  popup.on('pageerror', error => errors.push(error.message));
  await popup.getByRole('navigation', { name: 'Mini terminal sections' }).waitFor();
  // Chrome headless often ignores native Document PiP size requests; force a real
  // 270x560 fallback viewport makes slim density assertions meaningful.
  await popup.setViewportSize({ width: 270, height: 560 });
  check(await popup.evaluate(() => innerWidth===270 && innerHeight===560),
    'Regular popup uses an actual 270 by 560 slim viewport');
  check(await popup.locator('[data-window-mode="Separate window"]').count()===1, 'Unsupported browser gets a regular window');
  check(await popup.getByText(/will not stay on top/).count() === 1, 'Fallback describes its actual behavior near the header');
  check(await popup.locator('.acg-mini-footer').count()===0,'Mini terminal never renders a footer');
  const fallbackHeight=await popup.evaluate(()=>innerHeight);
  await popup.getByRole('button', { name: 'Orders (1)', exact: true }).click();
  check(await popup.evaluate(expected=>innerHeight===expected,fallbackHeight),
    'Regular popup height stays unchanged on Orders tab');
  const pendingText=await popup.locator('.acg-mini-row').innerText();
  check(['Trigger','Limit','SL','TP'].every(field=>pendingText.includes(field)),
    'Mini Pending row exposes trigger, limit, SL and TP');
  await popup.screenshot({path:'tests/ui/artifacts/mini-terminal-orders-list.png'});
  await popup.locator('.acg-mini-row').click();
  check(await popup.locator('.acg-mini-back').isVisible(), 'Pending order editor works in pop-out');
  await popup.getByRole('button', { name: 'Positions (2)', exact: true }).click();
  check(await popup.evaluate(expected=>innerHeight===expected,fallbackHeight),
    'Regular popup height stays unchanged on Positions tab');
  check(await popup.evaluate(() => {
    const rows=[...document.querySelectorAll('.acg-mini-row')];
    const content=document.querySelector('.acg-mini-content')?.getBoundingClientRect();
    return rows.length===2 && content && rows[0].getBoundingClientRect().top>=content.top-1
      && rows[1].getBoundingClientRect().bottom<=content.bottom+1;
  }), 'Both position cards fit fully into actual 270 by 560 window without scrolling');
  await popup.screenshot({path:'tests/ui/artifacts/mini-terminal-positions-list.png'});
  await popup.locator('.acg-mini-row').first().click();
  check(await popup.locator('.acg-mini-back').isVisible(), 'Position editor works in pop-out');
  await popup.screenshot({ path: 'tests/ui/artifacts/mini-terminal-position.png' });
  await popup.getByRole('button', { name: 'Trade', exact: true }).click();
  check(await popup.evaluate(expected=>innerHeight===expected,fallbackHeight),
    'Regular popup height stays unchanged on Trade tab');
  await fallback.evaluate(()=>window.v4PositionsQA.setSymbol('XAUUSD'));
  await popup.getByRole('combobox',{name:'Mini terminal instrument'}).selectOption('XAUUSD');
  await popup.locator('.acg-mini-market-price strong').getByText('3,881.77').waitFor();
  check(await popup.locator('.acg-mini-cfd').innerText()==='CFD',
    'Reference instrument CFD badge is visible');
  check(await popup.locator('.acg-mini-market-name').innerText()==='Gold / US Dollar',
    'Reference instrument subtitle is visible');
  check(await popup.locator('.acg-mini-market-price small').innerText()==='+0.10%',
    'Show a percentage only when supplied by the market feed');
  check(await popup.locator('.acg-mini-spread strong').innerText()==='28',
    'Real bid/ask and tick size produce reference spread');
  await popup.screenshot({ path: 'tests/ui/artifacts/mini-terminal-trade.png' });
  await popup.getByRole('button',{name:'Orders (1)',exact:true}).click();
  await fallback.evaluate(()=>window.v4PositionsQA.setPending([]));
  await popup.getByRole('button',{name:'Orders (0)',exact:true}).waitFor();
  check(await popup.locator('.acg-mini-empty').getByText('No pending orders').isVisible(),
    'Empty Orders shows reference centred message and no footer');
  await popup.screenshot({path:'tests/ui/artifacts/mini-terminal-orders-empty.png'});
  await popup.getByRole('button',{name:'Trade',exact:true}).click();
  const density=await popup.evaluate(()=>{
    const content=document.querySelector('.acg-mini-content');
    const ctx=document.querySelector('.acg-mini-context')?.getBoundingClientRect();
    const tabs=document.querySelector('.acg-mini-tabs')?.getBoundingClientRect();
    const actions=document.querySelector('.acg-mini-quick-actions')?.getBoundingClientRect();
    const free=document.querySelector('.acg-mini-free-margin')?.getBoundingClientRect();
    const est=document.querySelector('.acg-mini-estimate')?.getBoundingClientRect();
    const header=document.querySelector('.acg-mini-titlebar')?.getBoundingClientRect();
    return {scroll:content?.scrollHeight,visible:content?.clientHeight,
      contextHeight:ctx?.height,tabsHeight:tabs?.height,
      actionsHeight:actions?.height,freeHeight:free?.height,estHeight:est?.height,headerHeight:header?.height};
  });
  console.log('MINI_DENSITY_GEOMETRY',JSON.stringify(density));
  check(density.headerHeight===28&&density.contextHeight===52
    &&density.tabsHeight>=27&&density.tabsHeight<=29&&density.actionsHeight===36,
    'Slim row heights: 28px brand / 52px market / 28px tabs / 36px quoted actions');
  check(density.freeHeight>=17&&density.freeHeight<=21
    &&density.estHeight>=18&&density.estHeight<=22,
    'Margin summaries are compact without hiding financial values');
  check(density.scroll<=density.visible+4,'Default detached trade fits without a vertical scrollbar');
  check(await popup.locator('[data-acg-mini-simple-ticket=true]').isVisible(),
    'Trade tab uses original floating quick-order logic in a simple popup');
  check(await popup.locator('.v4-ticket').count()===0,
    'Full V4 execution terminal is not mounted inside popup');
  check(await popup.getByRole('button',{name:'Buy at quoted price'}).count()===1
    && await popup.getByRole('button',{name:'Sell at quoted price'}).count()===1,
    'Simple Buy and Sell quotes are immediately visible');
  check(await popup.getByRole('textbox',{name:'Lot size'}).isVisible(),
    'Quantity entry is always visible');
  await popup.getByRole('button',{name:'Pending',exact:true}).click();
  await popup.getByRole('textbox',{name:'Pending entry price'}).waitFor();
  check(await popup.getByRole('textbox',{name:'Pending entry price'}).isDisabled(),
    'Pending entry waits for original chart planning instead of inventing an order');
  await popup.getByRole('button',{name:'Market',exact:true}).click();
  const riskSwitch=popup.getByRole('button',{name:'Toggle mini risk sizing'});
  if(await riskSwitch.isEnabled()){
    await riskSwitch.click();
    check(await popup.getByRole('textbox',{name:'Risk percent'}).isVisible(),
      'Simple popup preserves original risk-based sizing');
    await riskSwitch.click();
  }
  check(await popup.getByRole('textbox',{name:'Lot size'}).isEnabled(),
    'Lots remain editable after returning from risk mode');
  check(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal window overflow');
  await fallback.evaluate(() => window.v4PositionsQA.setAccount({ freeMargin: 54321.12 }));
  await popup.getByText('$54,321.12', { exact: true }).waitFor();
  check(true, 'Popup receives updated authoritative free margin without footer');
  await popup.setViewportSize({ width: 245, height: 560 });
  check(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Manual 245px resize fits without horizontal overflow');
  await fallback.bringToFront();
  check(await popup.locator('[data-acg-mini-simple-ticket=true]').count() === 1,
    'Quick-order widget remains mounted while opener is active');
  await popup.close();
  await fallback.locator('[data-acg-mini-window-state="closed"]').waitFor({ state: 'attached' });
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  check(await fallback.evaluate(() => window.v4PositionsQA.commands.length === 0), 'Window lifecycle and navigation never submit a trade');
  // The notice banner may overlap the right header; its background must
  // never intercept clicks on the popup button below it.
  const noticeStyle = await fallback.locator('.acg-motion-notice').evaluate(
    element => getComputedStyle(element).pointerEvents);
  check(noticeStyle === 'none', 'Trade notice cannot intercept popup-header clicks');
  const closePopupPromise = fallback.waitForEvent('popup');
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).click();
  const closePopup = await closePopupPromise;
  await closePopup.getByRole('button', { name: 'Positions (2)', exact: true }).click();
  await closePopup.locator('.acg-mini-row').first().click();
  await closePopup.getByRole('button', { name: 'Close Position', exact: true }).click();
  check(await fallback.evaluate(() => window.v4PositionsQA.commands.length === 0), 'Close requires explicit confirmation inside the mini terminal');
  await closePopup.getByRole('button', { name: 'Confirm Close', exact: true }).click();
  await fallback.waitForFunction(() => window.v4PositionsQA.commands.length === 1);
  check(await fallback.evaluate(() => window.v4PositionsQA.commands[0].id === 'position-eur-1'), 'Confirmed close uses the existing command callback');
  await closePopup.getByRole('button', { name: 'Positions (1)', exact: true }).waitFor();
  check(await fallback.evaluate(() => window.v4PositionsQA.positions.length === 1), 'Confirmed position change is reflected in both windows');
  await closePopup.close();
  await fallback.locator('[data-acg-mini-window-state="closed"]').waitFor({ state: 'attached' });
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  // Simulate popup blocking without opening an external site.
  await fallback.evaluate(() => { window.open = () => null; });
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).click();
  await fallback.getByRole('alert').filter({ hasText: 'Allow pop-ups' }).waitFor();
  check(await fallback.locator('.acg-floating-order').count()===0,
    'Blocked popup must not recreate the in-chart widget');
  check(await fallback.locator('[data-acg-mini-header-launcher=true]').isVisible(),
    'Blocked popup leaves header launcher available to retry');
  await fallback.close();
  const owner = await setup(true);
  const ownerPopupPromise = owner.waitForEvent('popup');
  await owner.getByRole('button', { name: 'Pop out mini terminal' }).click();
  const ownerPopup = await ownerPopupPromise;
  await ownerPopup.locator('.acg-mini-tabs').waitFor();
  const ownerClosed = ownerPopup.waitForEvent('close');
  await owner.goto('about:blank');
  await ownerClosed;
  check(ownerPopup.isClosed(), 'Navigating away from owner closes its detached trading window');
  await owner.close();
  check(errors.length === 0, `No browser errors: ${errors.join('; ')}`);
  console.log(`MINI_TERMINAL_PASS ${checks} checks`);
} finally { await browser.close(); }
