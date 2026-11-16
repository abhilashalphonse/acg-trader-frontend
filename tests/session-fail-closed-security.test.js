import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canRenderTraderWorkspace } from '../src/auth/sessionAuthorization.js';

const now = Date.parse('2026-11-16T18:00:00Z');
const valid = { accessToken: 'opaque-server-issued-token', principal: { sessionId: 'server-session' },
  expiresAt: '2026-11-16T19:00:00Z' };

test('only valid server-verified unexpired session opens the Trader workspace', () => {
  assert.equal(canRenderTraderWorkspace('authenticated', valid, now), true);
});

test('expired, missing-token, offline and reauthorization states fail closed', () => {
  const cases = [
    ['anonymous', valid], ['reauth-required', valid], ['bootstrapping', valid],
    ['authenticating', valid],
    ['authenticated', { ...valid, accessToken: '' }],
    ['authenticated', { ...valid, principal: null }],
    ['authenticated', { ...valid, expiresAt: '2026-11-16T17:59:59Z' }],
    ['authenticated', { ...valid, expiresAt: 'unparseable' }],
    ['authenticated', { ...valid, expiresAt: null }],
  ];
  for (const [status,session] of cases) assert.equal(canRenderTraderWorkspace(status,session,now),false,status);
});

test('offline fallback never promotes unverified legacy Web Storage data to an authenticated UI', () => {
  const source=readFileSync(new URL('../src/auth/AuthProvider.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source, /sessionRef\.current = legacy\s*;[\s\S]{0,120}setStatus\('authenticated'\)/);
  assert.match(source, /Never present the protected terminal as authenticated/);
  assert.match(source, /authenticated: canRenderTraderWorkspace\(status, session\)/);
  assert.match(source, /clearLegacyStoredSession\(\);\s*setStatus\('anonymous'\);/);
});
