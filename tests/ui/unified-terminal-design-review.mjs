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
const iconCss = await readFile('src/components/trading-v2/desktop/TerminalIconographyV6.css', 'utf8');
assert.doesNotMatch(iconCss,
  /(?:^|[;{\n])\s*(?:font-family|font-feature-settings|font-smoothing|font-size|line-height)\s*:/im,
  'Icon refresh must never modify V6 typography');
assert.match(iconCss, /\.acg-desktop-v3\.acg-unified-shell/,
  'Icon treatment must remain scoped to the approved desktop workspace');
const densityCss = await readFile('src/components/trading-v2/desktop/DesktopTerminalDensityV6.css', 'utf8');
assert.doesNotMatch(densityCss,
  /(?:^|[;{\n])\s*(?:font-family|font-feature-settings|font-synthesis|font-optical-sizing|text-rendering|-webkit-font-smoothing)\s*:/im,
  'V6 density must preserve the existing font face and font rendering');
assert.match(densityCss, /\.acg-desktop-v3\.acg-unified-shell/,
  'Density must be scoped to the unified desktop workspace');
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
      // Only the top navbar market avatar is replaced by the candidate A mark.
      // It is a real vector SVG served by the bundle, not a blurred bitmap.
      const navbarBrand = header.locator('button[data-v4-header-instrument-image] img[data-acg-nav-brand-mark]');
      await navbarBrand.waitFor({ state: 'visible', timeout: 20000 });
      const brandMarkState = await navbarBrand.evaluate(async el => {
        if (!el.complete) await el.decode();
        const { width, height } = el.getBoundingClientRect();
        return { width, height, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight,
          url: new URL(el.currentSrc).pathname };
      });
      assert.ok(brandMarkState.url.endsWith('.svg') &&
        brandMarkState.naturalWidth > 0 && brandMarkState.naturalHeight > 0,
        'Navbar A must load as a crisp vector asset: ' + JSON.stringify(brandMarkState));
      assert.ok(brandMarkState.width >= 21 && brandMarkState.width <= 23 &&
        brandMarkState.height >= 21 && brandMarkState.height <= 23,
        'Candidate mark must fit the cleaner 22px navbar icon slot: ' + JSON.stringify(brandMarkState));

      // Match the supplied reference: one line, compact dark selector, quiet status dot.
      const compactIdentity = await header.locator('.acg-v4-header-instrument').evaluate(el => {
        const button = el.querySelector('.acg-v4-header-primary > button:first-child');
        const status = el.querySelector('.acg-v4-header-status-dot');
        const symbol = el.querySelector('.acg-v4-header-primary strong');
        const metric = (node) => { const r = node.getBoundingClientRect(); return { y:r.y+r.height/2, width:r.width, height:r.height }; };
        return { selector:metric(button), brand:metric(el.querySelector('[data-acg-nav-brand-mark]')),
          status:metric(status), symbol:metric(symbol), background:getComputedStyle(button).backgroundColor };
      });
      assert.ok(Math.abs(compactIdentity.selector.y - compactIdentity.status.y) <= 4,
        'Market status must share the same row as the symbol');
      assert.ok(compactIdentity.selector.height <= 28 && compactIdentity.brand.width <= 23,
        'Instrument selector and brand must be compact');
      assert.notEqual(compactIdentity.background,'rgb(242, 242, 244)',
        'Instrument selector should be a subdued dark capsule, not a bright block');
      const selectedTimeframe = header.locator('[data-v4-timeframe][aria-pressed="true"]');
      if (await selectedTimeframe.isVisible()) {
        const current = await selectedTimeframe.evaluate(el => ({
          height:el.getBoundingClientRect().height, background:getComputedStyle(el).backgroundColor
        }));
        assert.ok(current.height <= 27, 'Selected timeframe must use a small quiet control');
        assert.notEqual(current.background,'rgb(242, 242, 244)',
          'Selected timeframe should no longer use an oversized white fill');
      }
      const grid = shell.locator('.acg-unified-workspace-grid');
      // The default desktop layout deliberately starts with the sidebar closed.
      // Open the actual trade rail before inspecting ticket controls.
      await shell.getByRole('button', { name: 'Trade', exact: true }).click();
      const ticket = shell.locator('.v4-ticket.v4-live-scope');
      await ticket.waitFor({ state: 'visible', timeout: 20000 });
      await ticket.locator('.v4-exits .v4-disclosure').click();
      await ticket.locator('.v4-exit-card').first().waitFor({ state: 'visible' });
      // Density is measured in the rendered UI, not inferred from stylesheet
      // declarations. Execution fields must become shorter while preserving
      // the primary 47px Buy/Sell actions as reliable trading targets.
      const ticketBody = ticket.locator('.v4-ticket-body');
      const amountHeight = await ticket.locator('.v4-amount').evaluate(el => el.getBoundingClientRect().height);
      const quoteHeight = await ticket.locator('.v4-quote-strip').evaluate(el => el.getBoundingClientRect().height);
      const modeHeight = await ticket.locator('.v4-mainmodes .v4-capsule-button').first()
        .evaluate(el => el.getBoundingClientRect().height);
      const tradeButtonHeight = await ticket.locator('.v4-trade-actions .v4-buy')
        .evaluate(el => el.getBoundingClientRect().height);
      assert.ok(amountHeight <= 41, 'Compact amount height at ' + width + ': ' + amountHeight);
      assert.ok(quoteHeight <= 32, 'Compact quote strip at ' + width + ': ' + quoteHeight);
      assert.ok(modeHeight <= 30, 'Compact mode switcher at ' + width + ': ' + modeHeight);
      assert.ok(num(await px(ticketBody, 'row-gap')) <= 6,
        'Trade ticket must use compact section spacing');
      assert.ok(tradeButtonHeight >= 44, 'Buy action must remain usable: ' + tradeButtonHeight);
      // The icon system is part of the desktop chrome, not chart rendering.
      // Validate a common stroke width and a flat selected rail indicator.
      const tradeRail = shell.locator('aside[aria-label="Desktop panel dock"] [data-acg-rail-action="trade"]');
      assert.equal(await tradeRail.getAttribute('data-acg-rail-active'), 'true',
        'Trade must be selected when the execution ticket is open');
      const tradeGlyph = tradeRail.locator('svg');
      assert.ok(Math.abs(num(await px(tradeGlyph, 'stroke-width')) - 1.65) < .03,
        'Trade icon should use the V6 outline stroke');
      const activeRail = await tradeRail.evaluate(el => ({
        radius: getComputedStyle(el).borderTopLeftRadius,
        shadow: getComputedStyle(el).boxShadow,
      }));
      assert.ok(num(activeRail.radius) <= 3.5 && activeRail.shadow === 'none',
        'Active rail icons should be flat and compact');
      const indicatorsIcon = header.locator('.acg-v4-header-indicator-icon');
      assert.equal(await indicatorsIcon.count(), 1, 'Use an outline indicators icon instead of the old fx glyph');
      const headerHeight = await header.evaluate(el => el.getBoundingClientRect().height);
      assert.ok(Math.abs(headerHeight - 44) <= 1, 'Compact header must be 44px: ' + width + ' / ' + headerHeight);
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
      const accountName = account.locator('[data-v4-header-account-name]');
      assert.equal((await accountName.textContent()).trim(), 'ACG · V4-POSITIONS',
        'Account selector must keep the ACG · identifier naming convention');
      const accountType = account.locator('.acg-v4-header-account-type');
      assert.equal((await accountType.textContent()).trim(), 'Trial',
        'Account category must remain visible');
      const textAlignment = await account.evaluate(el => {
        const code = el.querySelector('[data-v4-header-account-name]').getBoundingClientRect();
        const type = el.querySelector('.acg-v4-header-account-type').getBoundingClientRect();
        return { codeY: code.y + code.height/2, typeY: type.y + type.height/2 };
      });
      assert.ok(Math.abs(textAlignment.codeY - textAlignment.typeY) <= 3,
        'Account code and Trial must share one horizontal line: ' + JSON.stringify(textAlignment));
      const accountBox = await account.boundingBox();
      assert.ok(accountBox.width <= 190 && Math.abs(accountBox.height - 34) <= 1,
        'Account button should remain proportionate to the 48px navbar: ' + JSON.stringify(accountBox));
      const avatar = account.locator('.acg-v4-header-account-mark');
      const avatarRadius = await px(avatar, 'border-top-left-radius');
      assert.ok(avatarRadius.includes('%') || num(avatarRadius) <= 15,
        'Avatar may be circular; the account button body must remain squared: ' + avatarRadius);
      assert.ok(num(await px(account, 'border-top-left-radius')) <= 4.1,
        'Account selector must have compact 4px corners');
      const chevron = account.locator('.acg-v4-header-account-chevron > svg');
      assert.ok(num(await px(chevron, 'width')) <= 14.5,
        'Chevron should be subtle and not dominate the selector');
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
        assert.ok(num(await px(firstMarketRow, 'min-height')) <= 40,
          'Markets rows should target TradingView-style density');
        const rowHeight = await firstMarketRow.evaluate(el => el.getBoundingClientRect().height);
        assert.ok(rowHeight <= 40, 'Instrument row should render at 39px, got ' + rowHeight + ' at ' + width);
        const priceFont = num(await px(firstMarketRow.locator('.acg-v4-market-price').first(), 'font-size'));
        assert.ok(priceFont >= 10 && priceFont <= 11.5,
          'Prices must remain legible but dense: ' + priceFont + ' at ' + width);
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
