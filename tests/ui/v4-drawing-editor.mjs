import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import process from 'node:process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const origin = process.env.V4_DRAWING_QA_URL || 'http://127.0.0.1:5174/tests/fixtures/chart-tools.html';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--no-sandbox'] });
let assertions = 0;
const check = (value, message) => { assert.ok(value, message); assertions += 1; };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '?v4=1');
  await page.locator('.fixture-chart svg.touch-none').waitFor();
  await page.getByRole('button', { name: 'Trend line', exact: true }).click();
  const svg = page.locator('.fixture-chart svg.touch-none');
  const chart = await svg.boundingBox();
  check(Boolean(chart && chart.width > 400), 'V4 drawing pane mounted');
  await page.mouse.move(chart.x + 175, chart.y + 170);
  await page.mouse.down();
  await page.mouse.move(chart.x + 390, chart.y + 244, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => window.chartToolsQA.drawings().length === 1);
  const before = await page.evaluate(() => window.chartToolsQA.drawings());
  const bar = page.locator('[data-v4-drawing-edit-toolbar="true"]');
  await bar.waitFor({ state: 'visible' });
  check(await bar.getByRole('button', { name: 'Drag drawing edit toolbar' }).count() === 1, 'Explicit V4 grip present');
  const family = await bar.evaluate(el => getComputedStyle(el).fontFamily);
  check(family.includes('Inter'), 'V4 drawing editor uses Inter');
  check((await bar.evaluate(el => getComputedStyle(el).backgroundColor)) === 'rgb(20, 20, 23)', 'Graphite V4 toolbar background');
  const initial = await bar.boundingBox();
  const grip = bar.getByRole('button', { name: 'Drag drawing edit toolbar' });
  const gripBox = await grip.boundingBox();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2 + 84, gripBox.y + gripBox.height / 2 + 55, { steps: 10 });
  await page.mouse.up();
  const moved = await bar.boundingBox();
  check(moved.x - initial.x > 35 && moved.y - initial.y > 25, 'V4 toolbar moves freely by dragging its grip');
  check(JSON.stringify(await page.evaluate(() => window.chartToolsQA.drawings())) === JSON.stringify(before), 'Moving toolbar leaves drawing geometry unchanged');

  // Constrain toolbar on all four sides, including the visible chart bottom.
  const gripNext = await grip.boundingBox();
  await page.mouse.move(gripNext.x + 9, gripNext.y + 12);
  await page.mouse.down();
  await page.mouse.move(chart.x + chart.width + 800, chart.y + chart.height + 800, { steps: 6 });
  await page.mouse.up();
  const bounded = await bar.boundingBox();
  check(bounded.x + bounded.width <= chart.x + chart.width + 2 && bounded.y + bounded.height <= chart.y + chart.height + 2, 'Toolbar stays within chart bounds');

  await bar.getByTitle('Drawing properties', { exact: true }).click();
  const properties = page.locator('.acg-v4-drawing-properties');
  await properties.waitFor({ state: 'visible' });
  check(await properties.count() === 1, 'Properties editor also receives isolated V4 styling');
  await properties.getByRole('button', { name: 'Cancel', exact: true }).click();

  const legacy = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  legacy.on('pageerror', error => errors.push(error.message));
  await legacy.goto(origin);
  await legacy.locator('.fixture-chart svg.touch-none').waitFor();
  await legacy.getByTitle('Trend line', { exact: true }).click();
  const legacySvg = legacy.locator('.fixture-chart svg.touch-none');
  const legacyChart = await legacySvg.boundingBox();
  await legacy.mouse.move(legacyChart.x + 175, legacyChart.y + 170);
  await legacy.mouse.down();
  await legacy.mouse.move(legacyChart.x + 390, legacyChart.y + 244, { steps: 12 });
  await legacy.mouse.up();
  await legacy.locator('.acg-drawing-toolbar').waitFor({ state: 'visible' });
  check(await legacy.locator('[data-v4-drawing-drag-handle]').count() === 0, 'Legacy editor unchanged; V4 drag controls not leaked');
  check(await legacy.locator('[data-v4-drawing-edit-toolbar]').count() === 0, 'V4 editor remains opt-in only');
  check(errors.length === 0, 'No page errors in V4 or legacy fixtures');
  console.log('V4_DRAWING_EDITOR_PASS', assertions);
} finally {
  await browser.close();
}
