import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';
import process from 'node:process';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {
  detached: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', buffer => { serverLog += buffer.toString(); });
server.stderr.on('data', buffer => { serverLog += buffer.toString(); });
let browser, checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const eq = (value, expected, message) => { assert.equal(value, expected, message); checks++; };
const uri = 'http://127.0.0.1:4178/mobile-audit-browser.html';

try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(uri)).ok) { ready = true; break; } }
    catch { /* still starting */ }
    await wait(250);
  }
  ok(ready, 'Vite fixture server is ready: ' + serverLog.slice(-400));
  browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });
  await mkdir('artifacts', { recursive: true });
  for (const [width, height] of [[360, 740], [375, 720], [393, 852], [430, 932], [393, 540], [690, 360]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(uri);
    const dock = page.locator('[data-acg-mobile-audit-dock]');
    await dock.waitFor({ state: 'visible' });
    const geometry = await page.evaluate(() => {
      const dock = document.querySelector('[data-acg-mobile-audit-dock]');
      const header = document.querySelector('[data-acg-mobile-audit-header]');
      const chart = document.querySelector('[data-audit-fixture-chart]');
      const palette = document.querySelector('[data-acg-mobile-audit-palette]');
      const dockRegion = dock.parentElement;
      const d = dock.getBoundingClientRect(), h = header.getBoundingClientRect(), c = chart.getBoundingClientRect();
      return {
        dockTop: d.top, dockHeight: d.height, dockLeft: d.left, dockRight: d.right,
        headerHeight: h.height, chartHeight: c.height, chartBottom: c.bottom,
        chartWidth: c.width, paletteButtons: palette.querySelectorAll('button').length,
        paletteLeft: palette.getBoundingClientRect().left,
        regionBottom: dockRegion.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        rows: Array.from(dock.children).slice(0, 3).map(el => Math.round(el.getBoundingClientRect().height)),
        actions: Array.from(dock.querySelectorAll('button')).filter(el => ['Prepare buy draft', 'Prepare sell draft'].includes(el.ariaLabel))
          .map(el => ({ scroll: el.scrollWidth, width: el.clientWidth })),
      };
    });
    eq(geometry.headerHeight, 48, width + 'px: compact header height');
    const navTrigger = page.getByRole('button', {name:'Open terminal menu'});
    await navTrigger.click();
    eq(await page.getByRole('menuitem').count(), 6, width + 'px: all supported destinations are available');
    const navBox = await page.getByRole('menu', {name:'Terminal navigation'}).boundingBox();
    ok(navBox.x >= 0 && navBox.x + navBox.width <= width && navBox.y + navBox.height <= height, width + 'px: navigation stays inside viewport');
    eq(await page.evaluate(() => document.activeElement?.tagName === 'INPUT'), false, width + 'px: menu never focuses keyboard input');
    if (width === 393 && height === 852) await page.screenshot({path:'artifacts/mobile-audit-navigation.png'});
    await page.keyboard.press('Escape');
    eq(await navTrigger.getAttribute('aria-expanded'), 'false', width + 'px: Escape dismisses navigation');
    eq(geometry.rows.length, 3, width + 'px: exactly three permanent dock rows');
    eq(geometry.rows[0], 32, width + 'px: settings row 32px');
    eq(geometry.rows[1], 20, width + 'px: helper row 20px');
    eq(geometry.rows[2], 48, width + 'px: trade row 48px');
    ok(geometry.dockHeight <= 124 && geometry.dockHeight >= 115, width + 'px: dock compact height');
    ok(Math.abs(geometry.dockLeft - 6) <= 1.5 && Math.abs(width - geometry.dockRight - 6) <= 1.5, width + 'px: dock side gutters');
    ok(geometry.documentWidth <= geometry.viewportWidth + 1, width + 'px: no horizontal page overflow');
    ok(geometry.chartHeight > 0 && geometry.dockTop >= geometry.chartBottom - 1, width + 'px: flexible chart fills remaining measured space');
    eq(Math.round(geometry.chartWidth), width, width + 'px: collapsed palette does not reserve chart width');
    eq(geometry.paletteButtons, 3, width + 'px: collapsed screenshot palette has three controls');
    ok(Math.abs(geometry.paletteLeft - 12) <= 1, width + 'px: palette floats over chart at upper-left');
    ok(Math.abs(geometry.regionBottom - geometry.viewportHeight) <= 1, width + 'px: safe area belongs to dock region, not a separate blank strip');
    const beforeHeight = await dock.evaluate(el => el.getBoundingClientRect().height);
    if (width === 393 && height === 852) await page.screenshot({ path:'artifacts/mobile-audit-ready.png' });
    await dock.getByRole('button', { name: 'Choose order type' }).click();
    await dock.getByRole('group', { name: 'Order types' }).getByRole('button', { name: 'Limit' }).click();
    eq(Math.round(await dock.evaluate(el => el.getBoundingClientRect().height)), Math.round(beforeHeight), width + 'px: anchored type picker does not expand dock');
    await page.screenshot({ path: width === 393 && height === 852 ? 'artifacts/mobile-audit-393.png' : 'artifacts/mobile-audit-' + width + '-' + height + '.png' });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.goto(uri);
  const dock = page.locator('[data-acg-mobile-audit-dock]');
  const palette = page.locator('[data-acg-mobile-audit-palette]');
  const header = page.locator('[data-acg-mobile-audit-header]');
  const summary = page.locator('[data-mobile-header-readout]');
  ok((await summary.textContent()).includes('1.12099'), 'Latest candle close is presented in the topbar');
  ok(!(await page.evaluate(() => window.mobileAuditQA.chartChrome(true))).includes('data-chart-instrument-info'), 'Actual audit chart markup omits duplicate instrument/OHLC block');
  ok((await page.evaluate(() => window.mobileAuditQA.chartChrome(false))).includes('data-chart-instrument-info'), 'Actual V3 chart retains its existing readout');
  for (const [label, target] of [['Markets','markets'],['Trades','trades'],['Accounts','account'],['Indicators','indicators'],['Platform settings','platform'],['Help & support','help']]) {
    await header.getByRole('button', {name:'Open terminal menu'}).click();
    await page.getByRole('menuitem', {name:label, exact:true}).click();
    eq(await page.evaluate(() => window.mobileAuditQA.lastDestination), target, label + ' dispatches its supported destination');
    eq(await page.getByRole('menu').count(), 0, label + ' selection closes navigation');
  }
  await header.getByRole('button', {name:'Select chart timeframe'}).click();
  await header.getByRole('button', {name:'Open terminal menu'}).click();
  eq(await header.getByRole('group', {name:'Chart timeframes'}).count(), 0, 'Navigation and timeframe popovers are mutually exclusive');
  await page.keyboard.press('ArrowDown');
  eq(await page.evaluate(() => document.activeElement?.textContent), 'Trades', 'Menu supports keyboard navigation');
  await page.locator('[data-audit-fixture-chart]').click({position:{x:100,y:260}});
  eq(await page.getByRole('menu').count(), 0, 'Outside tap closes navigation');
  await page.evaluate(() => window.mobileAuditQA.setReadout({symbol:'BTCUSD',timeframe:'M15',close:90000,changePercent:99}));
  ok(!(await summary.textContent()).includes('90000'), 'Another instrument cannot leak its readout into current header');
  await page.evaluate(() => window.mobileAuditQA.setReadout({symbol:'EURUSD',timeframe:'M15',close:1.12100,changePercent:-0.001,inspecting:true}));
  await page.waitForFunction(() => document.querySelector('[data-mobile-header-readout]')?.textContent.includes('CANDLE'));
  ok((await summary.textContent()).includes('CANDLE') && (await summary.textContent()).includes('0.00%'), 'Inspection is labelled, rounded zero is neutral');
  await header.getByRole('button', {name:'Select chart timeframe'}).click();
  await header.getByRole('group', {name:'Chart timeframes'}).getByRole('button', {name:'1H',exact:true}).click();
  ok(!(await summary.textContent()).includes('CANDLE'), 'Timeframe change hides old candle snapshot');
  await header.getByRole('button', {name:'Select chart timeframe'}).click();
  await header.getByRole('group', {name:'Chart timeframes'}).getByRole('button', {name:'15m',exact:true}).click();
  await page.evaluate(() => window.mobileAuditQA.setReadout(null));
  await header.getByRole('button', {name:'Select chart timeframe'}).click();
  await header.getByRole('button', {name:'Open positions, 3 active'}).click();
  eq(await header.getByRole('group', {name:'Chart timeframes'}).count(), 0, 'P&L shortcut closes any open header picker');
  eq(await page.evaluate(() => window.mobileAuditQA.lastDestination), 'trades', 'P&L retains direct trade access');
  eq(await palette.getByRole('button').count(), 3, 'Three buttons visible by default');
  const chartWidthBefore = await page.locator('[data-audit-fixture-chart]').evaluate(el => el.getBoundingClientRect().width);
  await palette.getByRole('button', { name: 'Expand drawing tools' }).click();
  eq(await palette.getByRole('button', { name: 'Collapse drawing tools' }).getAttribute('aria-expanded'), 'true', 'Three-dot button expands the same palette');
  ok(await palette.getByRole('button', { name: 'Fibonacci retracement' }).count() === 1, 'Expanded palette includes V4 analysis tools');
  ok(await palette.getByRole('button', { name: 'Long position risk tool' }).count() === 1, 'Expanded palette includes V4 long position');
  ok(await palette.getByRole('button', { name: 'Short position risk tool' }).count() === 1, 'Expanded palette includes V4 short position');
  await page.screenshot({ path: 'artifacts/mobile-audit-393-expanded.png' });
  await palette.getByRole('button', { name: 'Fibonacci retracement' }).click();
  await page.waitForFunction(() => window.mobileAuditQA.selectedTool === 'fibonacci');
  await palette.getByRole('button', { name: 'Collapse drawing tools' }).click();
  eq(await palette.getByRole('button').count(), 3, 'Collapse restores three-button palette');
  eq(await page.evaluate(() => window.mobileAuditQA.selectedTool), 'fibonacci', 'Collapsing never changes selected drawing tool');
  eq(Math.round(await page.locator('[data-audit-fixture-chart]').evaluate(el => el.getBoundingClientRect().width)), Math.round(chartWidthBefore), 'Expanding does not shrink chart width');
  eq(await page.evaluate(() => window.mobileAuditQA.commands), 0, 'Drawing tool interactions cannot submit orders');
  await dock.getByRole('button', { name: 'Prepare buy draft' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'planning', 'Buy prepares draft only');
  eq(await page.evaluate(() => window.mobileAuditQA.commands), 0, 'No order from draft selection');
  await dock.getByRole('button', { name: 'Review buy draft' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'review', 'Second deliberate selection enters review');
  await dock.getByRole('button', { name: 'Cancel', exact: true }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'idle', 'Cancel drops only draft');
  eq(await page.evaluate(() => window.mobileAuditQA.closedPositions), 0, 'Cancelling a draft cannot close a live position');
  eq(await page.evaluate(() => window.mobileAuditQA.commands), 0, 'Cancel never creates an order');

  await dock.getByRole('button', { name: 'Choose sizing mode' }).click();
  eq(await page.evaluate(() => document.activeElement?.tagName === 'INPUT'), false, 'Sizing menu never focuses a numeric input');
  await dock.getByRole('group', { name: 'Sizing modes' }).getByRole('button', { name: 'Risk %' }).click();
  await dock.getByRole('button', { name: 'Prepare buy draft' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.sizing.code), 'STOP_REQUIRED', 'Risk mode blocked without SL');
  ok((await dock.textContent()).includes('Set a stop loss'), 'Missing SL helper is actionable');
  await dock.getByRole('button', { name: 'Set stop loss' }).click();
  eq(await dock.getByRole('dialog', { name: 'Stop loss' }).count(), 0, 'First SL tap places the draft level directly on chart');
  ok(await page.locator('[data-mobile-draft-level="sl"]').isVisible(), 'SL is visible in actual chart overlay');
  eq(await page.evaluate(() => document.activeElement?.tagName === 'INPUT'), false, 'Chart protection placement never opens a keyboard');
  const slHandle = page.locator('[data-mobile-draft-level="sl"] button');
  const slBox = await slHandle.boundingBox();
  const slBeforeDrag = await page.evaluate(() => window.mobileAuditQA.plan.sl);
  await page.mouse.move(slBox.x + slBox.width / 2, slBox.y + slBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slBox.x + slBox.width / 2, slBox.y + slBox.height / 2 + 12, {steps:3});
  ok((await page.evaluate(() => window.mobileAuditQA.plan.sl)) < slBeforeDrag, 'Moving SL updates canonical draft during the drag');
  await page.mouse.up();
  ok((await page.evaluate(() => window.mobileAuditQA.plan.sl)) < slBeforeDrag, 'Releasing SL retains the local draft price');
  const committedSl = await page.evaluate(() => window.mobileAuditQA.plan.sl);
  const movedSlBox = await slHandle.boundingBox();
  await slHandle.click();
  eq(await page.evaluate(() => window.mobileAuditQA.plan.sl), committedSl, 'A tap without drag does not change the price');
  await page.mouse.move(movedSlBox.x + movedSlBox.width / 2, movedSlBox.y + movedSlBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(movedSlBox.x + movedSlBox.width / 2, movedSlBox.y + movedSlBox.height / 2 + 15, {steps:3});
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', {pointerId:1,bubbles:true})));
  await page.mouse.up();
  eq(await page.evaluate(() => window.mobileAuditQA.plan.sl), committedSl, 'Pointer cancellation restores the pre-drag draft price');
  eq(await page.evaluate(() => window.mobileAuditQA.commands), 0, 'Dragging a new chart protection never submits an order');
  await dock.getByRole('button', { name: 'Set stop loss' }).click();
  eq(await page.evaluate(() => document.activeElement?.tagName === 'INPUT'), false, 'Precise editor does not autofocus or summon keyboard');
  await dock.getByRole('dialog', { name: 'Stop loss' }).getByRole('textbox').fill('1.1190');
  await dock.getByRole('dialog', { name: 'Stop loss' }).getByRole('button', { name: 'Apply' }).click();
  let before = await page.evaluate(() => window.mobileAuditQA.sizing);
  ok(before.canExecute && before.lots > 0, 'Risk sizing uses existing fee-aware adapter after SL');
  await page.evaluate(() => window.mobileAuditQA.editPlan({ sl: 1.1180 }));
  await page.waitForFunction(() => window.mobileAuditQA.plan?.sl === 1.118);
  const changed = await page.evaluate(() => window.mobileAuditQA.sizing);
  ok(changed.lots < before.lots, 'Moving SL wider reduces volume for fixed risk budget');
  await page.evaluate(() => window.mobileAuditQA.editPlan({ tp: 1.1250 }));
  await page.waitForFunction(() => window.mobileAuditQA.plan?.tp === 1.125);
  const afterTp = await page.evaluate(() => window.mobileAuditQA.sizing);
  eq(afterTp.lots, changed.lots, 'Moving TP never changes risk-sized volume');
  await page.screenshot({path:'artifacts/mobile-audit-chart-draft.png'});
  await dock.getByRole('button', {name:'Choose order type'}).click();
  await dock.getByRole('group', {name:'Order types'}).getByRole('button', {name:'Limit', exact:true}).click();
  eq(await page.evaluate(() => window.mobileAuditQA.plan.auditValue), '0.50', 'Changing order type retains risk budget');
  eq(await page.evaluate(() => window.mobileAuditQA.plan.sl), 1.118, 'Changing order type retains stop price');
  eq(await page.evaluate(() => window.mobileAuditQA.plan.tp), 1.125, 'Changing order type retains target');
  await dock.getByRole('button', {name:'Choose order type'}).click();
  await dock.getByRole('group', {name:'Order types'}).getByRole('button', {name:'Market', exact:true}).click();
  await dock.getByRole('button', {name:'Choose sizing mode'}).click();
  await page.locator('[data-audit-fixture-chart]').click({position:{x:250,y:20}});
  eq(await dock.getByRole('group', {name:'Sizing modes'}).count(), 0, 'Outside tap dismisses menu without draft changes');
  await dock.getByRole('button', { name: 'Review buy draft' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'review', 'Reviewed risk trade has validated draft');
  await page.evaluate(() => window.mobileAuditQA.editPlan({ sl: 1.1185 }));
  await page.waitForFunction(() => window.mobileAuditQA.stage === 'planning');
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'planning', 'Editing SL invalidates prior review');
  await dock.getByRole('button', { name: 'Review buy draft' }).click();
  await dock.getByRole('button', { name: 'Confirm buy order' }).dblclick();
  await wait(220);
  eq(await page.evaluate(() => window.mobileAuditQA.commands), 1, 'Double-click cannot submit twice');
  eq(await page.evaluate(() => window.mobileAuditQA.attempts), 1, 'Exactly one final order attempt');
  await page.close();
  console.log('MOBILE_AUDIT_BROWSER_PASS', checks, 'responsive + review + sizing + duplicate-click assertions');
} finally {
  if (browser) await browser.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
}
