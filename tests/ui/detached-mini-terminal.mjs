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
  await page.getByRole('button', { name: 'Pop out mini terminal' }).click();
  await page.waitForFunction(() => documentPictureInPicture.window?.document.querySelector('.acg-mini-tabs'));
  const pip = expression => page.evaluate(expression);
  check(await pip(() => documentPictureInPicture.window.document.body.textContent.includes('Always on top')), 'Native always-on-top window opens');
  check(await pip(() => documentPictureInPicture.window.getComputedStyle(documentPictureInPicture.window.document.querySelector('.acg-mini-titlebar')).display === 'flex'), 'Styles are copied into native window');
  check(await pip(()=>{
    const d=documentPictureInPicture.window.document;
    const mini=d.querySelector('.acg-mini-quick-order');
    const content=d.querySelector('.acg-mini-content');
    const buttons=d.querySelectorAll('.acg-mini-quick-actions button');
    const metrics=d.querySelector('.acg-mini-margin-summary');
    const context=d.querySelector('.acg-mini-context');
    return mini&&metrics&&context&&buttons.length===2
      && !d.querySelector('.acg-mini-quote-main')
      && d.querySelectorAll('.acg-mini-order-family').length===1
      && content.scrollHeight<=content.clientHeight+4;
  }), 'Default 390px PiP fits compact trade without duplicated quotes or vertical scrolling');
  await pip(() => [...documentPictureInPicture.window.document.querySelectorAll('nav button')].find(b => b.textContent.startsWith('Positions')).click());
  await page.waitForFunction(() => documentPictureInPicture.window.document.querySelectorAll('.acg-mini-row').length === 2);
  check(await pip(() => !documentPictureInPicture.window.document.querySelector('.acg-mini-footer')),
    'Detached Positions has no bottom footer');
  check(await pip(() => {
    const text=documentPictureInPicture.window.document.querySelector('.acg-mini-row')?.textContent||'';
    return ['Entry','Current','SL / TP','Margin','Unrealized P&L'].every(field=>text.includes(field));
  }), 'Mini position presents unified prices, risk and P&L');
  await page.evaluate(() => window.v4PositionsQA.setPnl('position-eur-1', 123.45));
  await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('.acg-mini-rows').textContent.includes('123.45'));
  check(true, 'Native window receives live position updates from main terminal');
  await pip(() => documentPictureInPicture.window.document.querySelector('.acg-mini-row').click());
  await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('.acg-mini-back'));
  check(await page.evaluate(() => window.v4PositionsQA.commands.length === 0), 'Opening position management never sends a command');
  await page.evaluate(() => window.v4PositionsQA.setAccount({ id: 'switched-account', accountCode: 'NEW-ACCOUNT' }));
  await page.waitForFunction(() => !documentPictureInPicture.window.document.querySelector('.acg-mini-back'));
  check(await pip(() => documentPictureInPicture.window.document.querySelector('.acg-mini-account').textContent.includes('NEW-ACCOUNT')), 'Account switch clears selected management and updates identity');
  await page.evaluate(()=>window.v4PositionsQA.setPositions([]));
  await page.waitForFunction(()=>documentPictureInPicture.window?.document.querySelector('.acg-mini-empty'));
  check(await pip(()=>{
    const d=documentPictureInPicture.window.document;
    return d.querySelector('.acg-mini-empty strong')?.textContent==='No open positions'
      && d.querySelector('.acg-mini-empty span')?.textContent==='Your active positions will appear here.'
      && !d.querySelector('.acg-mini-footer');
  }),'Empty detached positions show only the two-line message and no footer');
  await page.evaluate(()=>window.v4PositionsQA.setPositions([
    {id:'position-eur-1',positionId:'position-eur-1',symbol:'EURUSD',side:'SELL',volume:0.01,
      entry:1.11652,closePrice:1.11735,pnl:123.45,pnlCurrency:'USD',valuationStatus:'LIVE'},
    {id:'position-btc-2',positionId:'position-btc-2',symbol:'BTCUSD',side:'BUY',volume:0.02,
      entry:67800,closePrice:68100,pnl:6,pnlCurrency:'USD',sl:67000,tp:70000}
  ]));
  await page.waitForFunction(()=>documentPictureInPicture.window?.document.querySelectorAll('.acg-mini-row').length===2);
  await pip(() => documentPictureInPicture.window.document.querySelector('[aria-label="Return mini terminal to chart"]').click());
  await page.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  check(await page.locator('.acg-floating-order').count() === 1, 'Dock restores exactly one compact ticket');
  await page.getByRole('button', { name: 'Pop out mini terminal' }).click();
  await page.waitForFunction(() => documentPictureInPicture.window?.document.querySelector('.acg-mini-tabs'));
  await pip(() => documentPictureInPicture.window.close());
  await page.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  check(true, 'Native window close restores the widget and allows reopening');
  await page.close();

  const fallback = await setup(true);
  const popupPromise = fallback.waitForEvent('popup');
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).click();
  const popup = await popupPromise;
  popup.on('pageerror', error => errors.push(error.message));
  await popup.getByRole('navigation', { name: 'Mini terminal sections' }).waitFor();
  check(await popup.getByText('Separate window', { exact: true }).count() === 1, 'Unsupported browser gets a regular window');
  check(await popup.getByText(/will not stay on top/).count() === 1, 'Fallback describes its actual behavior near the header');
  check(await popup.locator('.acg-mini-footer').count()===0,'Mini terminal never renders a footer');
  await popup.getByRole('button', { name: 'Orders (1)', exact: true }).click();
  check((await popup.locator('.acg-mini-row').innerText()).includes('SL / TP'),
    'Mini Pending row also exposes protection and status');
  await popup.locator('.acg-mini-row').click();
  check(await popup.locator('.acg-mini-back').isVisible(), 'Pending order editor works in pop-out');
  await popup.getByRole('button', { name: 'Positions (2)', exact: true }).click();
  await popup.locator('.acg-mini-row').first().click();
  check(await popup.locator('.acg-mini-back').isVisible(), 'Position editor works in pop-out');
  await popup.screenshot({ path: 'tests/ui/artifacts/mini-terminal-position.png' });
  await popup.getByRole('button', { name: 'Trade', exact: true }).click();
  await popup.screenshot({ path: 'tests/ui/artifacts/mini-terminal-trade.png' });
  const density=await popup.evaluate(()=>{
    const content=document.querySelector('.acg-mini-content');
    const ctx=document.querySelector('.acg-mini-context')?.getBoundingClientRect();
    const tabs=document.querySelector('.acg-mini-tabs')?.getBoundingClientRect();
    const actions=document.querySelector('.acg-mini-quick-actions')?.getBoundingClientRect();
    const margins=document.querySelector('.acg-mini-margin-summary')?.getBoundingClientRect();
    return {scroll:content?.scrollHeight,visible:content?.clientHeight,
      contextHeight:ctx?.height,tabsHeight:tabs?.height,
      actionsHeight:actions?.height,metricsHeight:margins?.height};
  });
  console.log('MINI_DENSITY_GEOMETRY',JSON.stringify(density));
  check(density.contextHeight<=46&&density.tabsHeight<=32&&density.actionsHeight>=42,
    'Dense header and 44px execution buttons retain usable size');
  check(density.metricsHeight<=40,'Both margin metrics share one compact row');
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
  await popup.setViewportSize({ width: 320, height: 500 });
  check(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow resized window fits');
  await fallback.bringToFront();
  check(await popup.locator('[data-acg-mini-simple-ticket=true]').count() === 1,
    'Quick-order widget remains mounted while opener is active');
  await popup.close();
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  check(await fallback.evaluate(() => window.v4PositionsQA.commands.length === 0), 'Window lifecycle and navigation never submit a trade');
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
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).waitFor();
  // Simulate popup blocking without opening an external site.
  await fallback.evaluate(() => { window.open = () => null; });
  await fallback.getByRole('button', { name: 'Pop out mini terminal' }).click();
  await fallback.getByRole('alert').filter({ hasText: 'Allow pop-ups' }).waitFor();
  check(await fallback.locator('.acg-floating-order').isVisible(), 'Blocked popup leaves current ticket usable');
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
