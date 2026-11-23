import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Synthetic full terminal fixture only; do not connect trading APIs.
const url = 'http://127.0.0.1:5174/v4-positions-audit.html?public_review=1&acg_v4_audit=1';
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });
const widths = [1024, 1280, 1440, 1920];
const results = [];
// PR #236 must never replace the approved V6 typography. The parent styles
// retain font family/features and component-specific readable text sizes.
const unifiedCss = await readFile('src/components/trading-v2/desktop/UnifiedTerminalWorkspace.css', 'utf8');
assert.doesNotMatch(unifiedCss,
  /(?:^|[;{\n])\s*(?:font-family|font-size|font-weight|font-feature-settings|font-variant(?:-numeric)?|letter-spacing|line-height|text-rendering)\s*:/im,
  'Unified workspace CSS must not override V6 typography');
await mkdir('artifacts', { recursive: true });

async function px(locator, prop) {
  return locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
}
function num(value) { return Number.parseFloat(value) || 0; }

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const shell = page.locator('.acg-desktop-v3.acg-unified-shell');
      await shell.waitFor({ state: 'visible', timeout: 30000 });
      const baselineTypography = await shell.evaluate(el => ({
        fontFamily: getComputedStyle(el).fontFamily,
        parentFontFamily: getComputedStyle(el.parentElement).fontFamily,
        fontFeatures: getComputedStyle(el).fontFeatureSettings,
      }));
      assert.equal(baselineTypography.fontFamily, baselineTypography.parentFontFamily,
        'Terminal must inherit the existing V6/base font family at ' + width);
      assert.match(baselineTypography.fontFeatures, /ss01/i,
        'V6 stylistic font feature ss01 must remain enabled at ' + width);
      const header = shell.locator('header.acg-desktop-market-strip');
      const grid = shell.locator('.acg-unified-workspace-grid');
      // The default desktop layout deliberately starts with the sidebar closed.
      // Open the actual trade rail before inspecting ticket controls.
      await shell.getByRole('button', { name: 'Trade', exact: true }).click();
      const ticket = shell.locator('.v4-ticket.v4-live-scope');
      await ticket.waitFor({ state: 'visible', timeout: 20000 });
      await ticket.locator('.v4-exits .v4-disclosure').click();
      await ticket.locator('.v4-exit-card').first().waitFor({ state: 'visible' });
      const headerHeight = await header.evaluate(el => el.getBoundingClientRect().height);
      assert.ok(Math.abs(headerHeight - 48) <= 1, 'Header must be precisely 48px: ' + width + ' / ' + headerHeight);
      assert.equal(num(await px(shell, 'padding-left')), 0, 'Desktop shell must have no outer gutter');
      assert.equal(num(await px(shell, 'row-gap')), 0, 'Desktop shell must have no vertical gutter');
      assert.equal(num(await px(grid, 'column-gap')), 0, 'Chart/sidebar gap must be zero');
      assert.equal(num(await px(grid, 'row-gap')), 0, 'Chart/dock gap must be zero');
      assert.equal(num(await px(header, 'border-top-left-radius')), 0, 'Header must not float as a card');
      assert.equal(num(await px(ticket, 'border-top-left-radius')), 0, 'Ticket must not float as a card');
      assert.equal(num(await px(ticket.locator('.v4-capsule').first(), 'border-top-left-radius')), 4,
        'Execution selector must be flat 4px, not pill shaped');
      assert.equal(num(await px(ticket.locator('.v4-exit-card').first(), 'border-top-left-radius')), 4,
        'Protection card must use 4px radius');
      const headerOverflow = await header.evaluate(el => ({
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }));
      assert.ok(headerOverflow.scrollWidth <= headerOverflow.clientWidth + 3,
        'Navbar must fit viewport: ' + JSON.stringify({ width, headerOverflow }));

      await page.screenshot({ path: 'artifacts/unified-terminal-' + width + '-trade.png' });

      const account = header.locator('[data-v4-header-account]');
      await account.click();
      const accountMenu = header.locator('[data-v4-header-menu="account"]');
      await accountMenu.waitFor({ state: 'visible' });
      assert.ok(num(await px(accountMenu, 'border-top-left-radius')) <= 5, 'Account menu must use flat chrome');
      await account.click();

      await shell.getByRole('button', { name: 'Markets', exact: true }).click();
      const markets = shell.locator('[data-v4-markets-panel]');
      await markets.waitFor({ state: 'visible' });
      assert.ok(num(await px(markets.locator('.acg-v4-market-category').first(), 'border-top-left-radius')) <= 4,
        'Markets category controls must have 4px corners');
      const firstMarketRow = markets.locator('.acg-v4-market-row').first();
      if (await firstMarketRow.count()) {
        assert.ok(num(await px(firstMarketRow, 'min-height')) <= 50, 'Markets rows must remain compact');
      }
      await page.screenshot({ path: 'artifacts/unified-terminal-' + width + '-markets.png' });

      await shell.getByRole('button', { name: 'Chart appearance settings' }).click();
      const settings = shell.locator('[data-v4-chart-settings="true"]');
      await settings.waitFor({ state: 'visible' });
      assert.ok(num(await px(settings, 'border-top-left-radius')) <= 5, 'Settings must use 5px corners');
      assert.equal(await settings.getByRole('group', { name: 'Chart canvas theme' }).count(), 1,
        'Chart theme switch remains available');
      await page.screenshot({ path: 'artifacts/unified-terminal-' + width + '-settings.png' });

      if (width === 1440) {
        await settings.getByRole('button', { name: 'Light' }).click();
        await page.locator('[data-acg-chart-theme="light"]').first()
          .waitFor({ state: 'visible', timeout: 20000 });
        await page.screenshot({ path: 'artifacts/unified-terminal-1440-light.png' });
        await settings.getByRole('button', { name: 'Dark' }).click();
        await page.locator('[data-acg-chart-theme="dark"]').first()
          .waitFor({ state: 'visible', timeout: 20000 });
      }
      // The overview portal is not inside the terminal shell. Verify it is
      // anchored to the actual dock Overview control and stays fully onscreen.
      const overviewTrigger = page.getByRole('button', { name: 'Account overview and margin details' });
      await overviewTrigger.waitFor({ state: 'visible' });
      await overviewTrigger.click();
      const overview = page.locator('[data-acg-unified-overview="true"]');
      await overview.waitFor({ state: 'visible' });
      assert.ok(num(await px(overview, 'border-top-left-radius')) <= 5,
        'Account overview must use 5px corners');
      const overviewBounds = await overview.boundingBox();
      assert.ok(overviewBounds.x >= 0 && overviewBounds.x + overviewBounds.width <= width + 1,
        'Overview portal must remain inside the viewport');
      await page.screenshot({ path: 'artifacts/unified-terminal-' + width + '-overview.png' });
      await page.keyboard.press('Escape');
      await overview.waitFor({ state: 'hidden' });

      // The public mock fixture must expose exactly the desktop Help Center
      // used by the live terminal, without connecting to support endpoints.
      await shell.getByRole('button', { name: 'Help Center' }).click();
      const help = page.locator('[data-acg-unified-help="true"]');
      await help.waitFor({ state: 'visible' });
      const helpRadius = await px(help, 'border-top-left-radius');
      const helpStyles = await help.evaluate(el => ({
        radius: getComputedStyle(el).borderTopLeftRadius,
        matchesDesktop: Boolean(el.closest('.acg-v3-help')),
        marker: el.getAttribute('data-acg-unified-help'),
        width: window.innerWidth,
      }));
      assert.ok(num(helpRadius) <= 5.5,
        'Help Center must have the same menu geometry: ' + JSON.stringify(helpStyles));
      const categoryTile = help.locator('[data-help-category-tile]').first();
      assert.ok(num(await px(categoryTile, 'min-height')) <= 90,
        'Help category tiles must be compact');
      await page.screenshot({ path: 'artifacts/unified-terminal-' + width + '-help.png' });
      await help.getByRole('button', { name: 'Close Help Center' }).click();
      await help.waitFor({ state: 'hidden' });

      assert.deepEqual(pageErrors, [], 'Terminal must not throw React errors at ' + width);
      results.push({ width, headerHeight, headerOverflow, trade: true, markets: true, settings: true });
    } finally {
      await page.close();
    }
  }
  console.log('UNIFIED_TERMINAL_DESIGN_PASS', JSON.stringify(results));
} finally {
  await browser.close();
}
