import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';
import process from 'node:process';

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {
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
      const d = dock.getBoundingClientRect(), h = header.getBoundingClientRect(), c = chart.getBoundingClientRect();
      return {
        dockTop: d.top, dockHeight: d.height, dockLeft: d.left, dockRight: d.right,
        headerHeight: h.height, chartHeight: c.height, chartBottom: c.bottom,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        rows: Array.from(dock.children).slice(0, 3).map(el => Math.round(el.getBoundingClientRect().height)),
        actions: Array.from(dock.querySelectorAll('button')).filter(el => ['Prepare buy draft', 'Prepare sell draft'].includes(el.ariaLabel))
          .map(el => ({ scroll: el.scrollWidth, width: el.clientWidth })),
      };
    });
    eq(geometry.headerHeight, 48, width + 'px: compact header height');
    eq(geometry.rows.length, 3, width + 'px: exactly three permanent dock rows');
    eq(geometry.rows[0], 32, width + 'px: settings row 32px');
    eq(geometry.rows[1], 20, width + 'px: helper row 20px');
    eq(geometry.rows[2], 48, width + 'px: trade row 48px');
    ok(geometry.dockHeight <= 124 && geometry.dockHeight >= 115, width + 'px: dock compact height');
    ok(Math.abs(geometry.dockLeft - 6) <= 1.5 && Math.abs(width - geometry.dockRight - 6) <= 1.5, width + 'px: dock side gutters');
    ok(geometry.documentWidth <= geometry.viewportWidth + 1, width + 'px: no horizontal page overflow');
    ok(geometry.chartHeight > 0 && geometry.dockTop >= geometry.chartBottom - 1, width + 'px: flexible chart fills remaining measured space');
    const beforeHeight = await dock.evaluate(el => el.getBoundingClientRect().height);
    await dock.getByRole('button', { name: 'Choose order type' }).click();
    await dock.getByRole('group', { name: 'Order types' }).getByRole('button', { name: 'Limit' }).click();
    eq(Math.round(await dock.evaluate(el => el.getBoundingClientRect().height)), Math.round(beforeHeight), width + 'px: anchored type picker does not expand dock');
    await page.screenshot({ path: width === 393 && height === 852 ? 'artifacts/mobile-audit-393.png' : 'artifacts/mobile-audit-' + width + '-' + height + '.png' });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.goto(uri);
  const dock = page.locator('[data-acg-mobile-audit-dock]');
  await dock.getByRole('button', { name: 'Prepare buy draft' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'planning', 'Buy prepares draft only');
  eq(await page.evaluate(() => window.mobileAuditQA.commands), 0, 'No order from draft selection');
  await dock.getByRole('button', { name: 'Review buy draft' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'review', 'Second deliberate selection enters review');
  await dock.getByRole('button', { name: 'Cancel' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'idle', 'Cancel drops only draft');
  eq(await page.evaluate(() => window.mobileAuditQA.closedPositions), 0, 'Cancelling a draft cannot close a live position');
  eq(await page.evaluate(() => window.mobileAuditQA.commands), 0, 'Cancel never creates an order');

  await dock.getByRole('button', { name: 'Edit position sizing' }).click();
  await dock.getByRole('button', { name: 'Lots', exact: false }).last().click();
  await dock.getByRole('group', { name: 'Sizing modes' }).getByRole('button', { name: 'Risk %' }).click();
  await dock.getByRole('button', { name: 'Prepare buy draft' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.sizing.code), 'STOP_REQUIRED', 'Risk mode blocked without SL');
  ok((await dock.textContent()).includes('Set a stop loss'), 'Missing SL helper is actionable');
  await dock.getByRole('button', { name: 'Set stop loss' }).click();
  await dock.getByRole('dialog', { name: 'Stop loss' }).getByRole('textbox').fill('1.1190');
  await dock.getByRole('dialog', { name: 'Stop loss' }).getByRole('button', { name: 'Apply' }).click();
  let before = await page.evaluate(() => window.mobileAuditQA.sizing);
  ok(before.canExecute && before.lots > 0, 'Risk sizing uses existing fee-aware adapter after SL');
  await page.evaluate(() => window.mobileAuditQA.editPlan({ sl: 1.1180 }));
  const changed = await page.evaluate(() => window.mobileAuditQA.sizing);
  ok(changed.lots < before.lots, 'Moving SL wider reduces volume for fixed risk budget');
  await page.evaluate(() => window.mobileAuditQA.editPlan({ tp: 1.1250 }));
  const afterTp = await page.evaluate(() => window.mobileAuditQA.sizing);
  eq(afterTp.lots, changed.lots, 'Moving TP never changes risk-sized volume');
  await dock.getByRole('button', { name: 'Review buy draft' }).click();
  eq(await page.evaluate(() => window.mobileAuditQA.stage), 'review', 'Reviewed risk trade has validated draft');
  await page.evaluate(() => window.mobileAuditQA.editPlan({ sl: 1.1185 }));
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
