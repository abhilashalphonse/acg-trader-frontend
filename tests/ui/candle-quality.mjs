import process from 'node:process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Lisbon' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.CHART_QA_URL || 'http://127.0.0.1:5173/tests/fixtures/chart-tools.html');
  const readout = page.getByTestId('chart-ohlc');
  await page.waitForFunction(() => document.querySelector('[data-testid="chart-ohlc"]')?.textContent.includes('1.'));
  const chart = await page.locator('.fixture-chart').boundingBox();
  await page.mouse.move(chart.x + chart.width * .45, chart.y + 200);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const historical = await readout.innerText();
  await page.evaluate(() => {
    const last = window.chartToolsQA.lastCandle;
    window.chartToolsQA.pushCandle({ ...last, close: 1.2, high: 1.2, stateEpoch: 100, stateVersion: 1 });
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await readout.innerText(), historical, 'historical OHLC survives live updates');
  await page.mouse.move(1400, 950);
  await page.waitForFunction(() => document.querySelector('[data-testid="chart-ohlc"]')?.textContent.includes('1.20000'));
  const clock = page.getByTitle('Current chart time (UTC)').first();
  assert.equal(await clock.count(), 1);
  assert.match(await clock.locator('..').innerText(), /UTC/);
  assert.deepEqual(errors, []);
  console.log('Candle UI regression passed: held crosshair, return to live and UTC footer.');
} finally { await browser.close(); }
