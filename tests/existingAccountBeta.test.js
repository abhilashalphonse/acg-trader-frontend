import test from 'node:test';
import assert from 'node:assert/strict';
import { isExistingAccountReadOnlyBeta, mayIssueExistingBetaRequest } from '../src/native/existingAccountBeta.js';

test('existing-account beta read-only build is explicitly gated', () => {
  assert.equal(isExistingAccountReadOnlyBeta({VITE_ACG_ANDROID_READ_ONLY_BETA:'true'}), true);
  assert.equal(isExistingAccountReadOnlyBeta({VITE_ACG_ANDROID_READ_ONLY_BETA:'false'}), false);
  assert.equal(isExistingAccountReadOnlyBeta({}), false);
});

test('production Android beta permits sign-in and token refresh, but no account or trading mutations', () => {
  for (const path of ['/v1/auth/login','/v1/auth/refresh','/v1/auth/logout','/v1/auth/federated/exchange']) {
    assert.equal(mayIssueExistingBetaRequest('POST',path),true,path);
  }
  for (const path of [
    '/v1/auth/personal/demo', '/v1/trading/orders/market',
    '/v1/trading/orders/pending', '/v1/trading/orders/123/cancel',
    '/v1/trading/accounts/1/positions/close-all',
    '/v1/trading/positions/1/break-even',
    '/v1/trading/positions/1/close', '/v1/trading/positions/1/reverse',
    '/v1/trading/positions/1/protection', '/v1/trading/positions/1/trailing',
    '/v1/profile',
  ]) for (const verb of ['POST','PUT','PATCH','DELETE']) {
    assert.equal(mayIssueExistingBetaRequest(verb,path),false,verb+' '+path);
  }
  assert.equal(mayIssueExistingBetaRequest('GET','/v1/auth/accounts'),true);
  assert.equal(mayIssueExistingBetaRequest('GET','/v1/trading/accounts/1/history/deals?limit=20'),true);
  assert.equal(mayIssueExistingBetaRequest('POST','/v1/auth/login/other'),false);
  assert.equal(mayIssueExistingBetaRequest('POST','/v1/auth/login?accountId=untrusted'),true);
  assert.equal(mayIssueExistingBetaRequest('POST','/v1/auth/exchange'),false);
});
