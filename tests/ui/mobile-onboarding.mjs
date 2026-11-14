// Real Chrome smoke for mobile first-launch routes; no live credentials or backend.
import assert from 'node:assert/strict';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4187';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4187', '--strictPort'], {
  stdio: 'ignore', env: { ...process.env, VITE_ACG_TRADER_API_BASE: origin },
});
let browser;
let checks = 0;
const verify = (condition, label) => { assert.ok(condition, label); checks++; };

async function fixturePage(context, { loggedIn = false, logoutStatus = 204 } = {}) {
  const page = await context.newPage();
  const state = { loggedIn, logoutStatus, logoutCalls: 0 };
  await page.route('**/v1/auth/refresh', async route => {
    if (!state.loggedIn) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'TRADER_REFRESH_INVALID' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      accessToken: 'opaque-demo-test-only',
      expiresAt: '2099-01-01T00:00:00.000Z',
      session: { id: 'test-session', tenantId: 'test-tenant', accountIds: ['test-account'],
        selectedAccountId: 'test-account', authMethod: 'PASSWORD' },
    }) });
  });
  await page.route('**/v1/auth/logout', async route => {
    state.logoutCalls++;
    if (state.logoutStatus === 204) state.loggedIn = false;
    return route.fulfill({ status: state.logoutStatus, contentType: 'application/json',
      body: state.logoutStatus === 204 ? '' : JSON.stringify({ message: 'Service unavailable' }) });
  });
  return { page, state };
}

try {
  for (let i = 0; i < 70; i++) {
    try { if ((await fetch(origin + '/?acg_mobile_onboarding=1')).ok) break; }
    catch { /* wait */ }
    await pause(200);
  }
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const first = await fixturePage(context);
  await first.page.goto(origin + '/?acg_mobile_onboarding=1');
  await first.page.getByRole('heading', { name: /Your markets/ }).waitFor();
  verify(await first.page.getByRole('button', { name: /Start Trading/ }).count() === 1, 'native Connect Prop entry');
  verify(await first.page.getByRole('button', { name: /Try Demo/ }).count() === 1, 'independent demo entry');
  verify((await first.page.textContent('body')).includes('Registration preview only'), 'demo is not presented as live');
  verify(await first.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile welcome fits viewport');
  await first.page.getByRole('button', { name: /Start Trading/ }).click();
  await first.page.waitForURL('**/?acg_connect_prop=1');
  await first.page.getByText('Tenant ID / identifier').waitFor();
  verify(true, 'Start Trading loads existing tenant login');
  await first.page.goto(origin + '/?acg_mobile_onboarding=1');
  await first.page.getByRole('button', { name: /Try Demo/ }).click();
  await first.page.waitForURL('**/?acg_auth=signin&acg_onboarding_audit=1');
  await first.page.getByText('Standalone onboarding').waitFor();
  verify(true, 'Try Demo opens truthful flag-gated standalone identity page');
  await first.page.close();

  const returning = await fixturePage(context, { loggedIn: true });
  await returning.page.goto(origin + '/?acg_mobile_onboarding=1');
  await returning.page.getByRole('link', { name: /Continue current trading session/ }).waitFor();
  await returning.page.getByRole('button', { name: /Start Trading/ }).click();
  verify(await returning.page.getByLabel('Confirm context change').count() === 1, 'existing session requires confirmation');
  await returning.page.getByLabel('Confirm context change').getByRole('button', { name: /Continue/ }).click();
  await returning.page.waitForURL('**/?acg_connect_prop=1');
  verify(returning.state.logoutCalls === 1 && !returning.state.loggedIn, 'context change revokes existing session before navigation');
  await returning.page.getByText('Tenant ID / identifier').waitFor();
  await returning.page.close();

  const failure = await fixturePage(context, { loggedIn: true, logoutStatus: 503 });
  await failure.page.goto(origin + '/?acg_mobile_onboarding=1');
  await failure.page.getByRole('link', { name: /Continue current trading session/ }).waitFor();
  await failure.page.getByRole('button', { name: /Try Demo/ }).click();
  await failure.page.getByLabel('Confirm context change').getByRole('button', { name: /Continue/ }).click();
  await failure.page.getByRole('alert').waitFor();
  verify(new URL(failure.page.url()).searchParams.get('acg_mobile_onboarding') === '1', 'failed revoke does not navigate');
  verify(failure.state.logoutCalls === 1, 'failed revoke retriable');
  await failure.page.close();
  await context.close();
  console.log('MOBILE_ONBOARDING_BROWSER_PASS', checks);
} finally {
  if (browser) await browser.close();
  server.kill();
}
