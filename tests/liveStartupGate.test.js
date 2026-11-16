import test from 'node:test';
import assert from 'node:assert/strict';
import { liveStartupFailures } from './ui/live-startup-gate.mjs';

const healthy = {
  pageStatus: 200, title: 'ACG Trader', mainScriptCount: 1, rootChildren: 1,
  htmlBoot: false, loaderCount: 0,
};

test('healthy Firebase boot passes gate', () => {
  assert.deepEqual(liveStartupFailures(healthy), []);
});

test('Firebase Site Not Found 404 fails even when loader is absent', () => {
  const reasons = liveStartupFailures({
    pageStatus: 404, title: 'Site Not Found', mainScriptCount: 0, rootChildren: undefined,
    htmlBoot: false, loaderCount: 0,
  });
  assert.ok(reasons.some(x => x.includes('HTTP 200')));
  assert.ok(reasons.some(x => x.includes('Site Not Found')));
});

test('HTTP 200 error page without app shell fails', () => {
  assert.ok(liveStartupFailures({ ...healthy, mainScriptCount: 0, rootChildren: 0 }).length > 0);
});

test('HTTP 200 page that is stuck loading fails', () => {
  assert.ok(liveStartupFailures({ ...healthy, htmlBoot: true, loaderCount: 1 }).length > 0);
});

test('no response fails', () => {
  assert.ok(liveStartupFailures({ ...healthy, pageStatus: null }).length > 0);
});
