import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('audit popup requests mobile-like 320 by 480 dimensions in native and fallback modes', () => {
  const jsx = source('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  assert.match(jsx, /requestWindow\(\{ width: 320, height: 480 \}\)/);
  assert.match(jsx, /popup=yes,width=320,height=480/);
  assert.doesNotMatch(jsx, /requestWindow\(\{ width: 360, height: 450 \}\)/);
});

test('mini terminal preserves responsive compact layouts and scrolls content inside the fixed shell', () => {
  const css = source('src/components/trading-v2/desktop/DetachedMiniTerminal.css');
  assert.match(css, /\.acg-mini-titlebar\{flex-basis:32px;height:32px/);
  assert.match(css, /\.acg-mini-context\{[\s\S]*?flex-basis:62px/);
  assert.match(css, /\.acg-mini-tabs\{flex-basis:31px/);
  assert.match(css, /\.acg-mini-quick-actions button\{height:45px/);
  assert.match(css, /\.acg-mini-content\{[\s\S]*?overflow-y:auto;overflow-x:hidden/);
  assert.match(css, /@media\(max-width:310px\)/);
});

test('empty Positions and Orders tabs display one clean label and no extra descriptions', () => {
  const jsx = source('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  assert.match(jsx, /tab==='positions'\?'No open positions':'No pending orders'/);
  assert.doesNotMatch(jsx, /Your active positions will appear here|Orders awaiting execution will appear here/);
  assert.doesNotMatch(jsx, /acg-mini-footer/);
});

test('popup remains only in URL-gated dock audit and reuses existing order engine', () => {
  const jsx = source('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  const terminal = source('src/components/trading-v2/DesktopTerminal.jsx');
  assert.match(terminal, /DOCK_AUDIT_ENABLED/);
  assert.match(terminal, /DetachedMiniTerminal/);
  assert.match(jsx, /renderTrade/);
  assert.match(jsx, /renderPending/);
  assert.match(jsx, /renderPosition/);
});
