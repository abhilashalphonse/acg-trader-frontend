import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('audit popup requests a tall and slim 270 by 560 window in both modes', () => {
  const jsx = source('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  assert.match(jsx, /requestWindow\(\{ width: 270, height: 560 \}\)/);
  assert.match(jsx, /popup=yes,width=270,height=560/);
  assert.doesNotMatch(jsx, /requestWindow\(\{ width: 320, height: 480 \}\)/);
});

test('mini window uses slim reference sizing, compact controls and internal scrolling', () => {
  const css = source('src/components/trading-v2/desktop/DetachedMiniTerminal.css');
  const i = css.indexOf('/* Slim reference: 270');
  assert.ok(i !== -1, 'Slim reference rules must be declared');
  const slim = css.slice(i);
  assert.match(slim, /\.acg-mini-titlebar\{[\s\S]*?height:28px/);
  assert.match(slim, /\.acg-mini-context\{[\s\S]*?min-height:52px/);
  assert.match(slim, /\.acg-mini-tabs\{[\s\S]*?min-height:28px/);
  assert.match(slim, /\.acg-mini-quick-actions button\{[\s\S]*?height:36px/);
  assert.match(slim, /\.acg-mini-quantity\{[\s\S]*?height:29px/);
  assert.match(slim, /@media\(max-width:255px\)/);
  assert.match(css, /\.acg-mini-content\{[\s\S]*?overflow-y:auto;overflow-x:hidden/);
});

test('empty tabs show one calm label and preserve original trade callbacks', () => {
  const jsx = source('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  assert.match(jsx, /tab==='positions'\?'No open positions':'No pending orders'/);
  assert.doesNotMatch(jsx, /Your active positions will appear here|Orders awaiting execution will appear here|acg-mini-footer/);
  assert.match(jsx, /renderTrade/);
  assert.match(jsx, /renderPending/);
  assert.match(jsx, /renderPosition/);
});

test('slim popup still requires the URL-gated dock audit', () => {
  const terminal = source('src/components/trading-v2/DesktopTerminal.jsx');
  assert.match(terminal, /DOCK_AUDIT_ENABLED/);
  assert.match(terminal, /DetachedMiniTerminal/);
});
