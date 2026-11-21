import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('mini pending entry is blank until a plan is present, without changing order validation', () => {
  const ticket = source('src/components/trading-v2/desktop/DesktopOrderTicket.jsx');
  assert.match(ticket, /placeholder=\{tradePlan\?\.pending \? 'Enter price' : ''\}/);
  assert.match(ticket, /disabled=\{!tradePlan\?\.pending \|\| editing\}/);
  assert.doesNotMatch(ticket, /Choose Buy or Sell to plan/);
  assert.match(ticket, /onClick=\{\(\) => handleSide\('buy'\)\}/);
  assert.match(ticket, /onClick=\{\(\) => handleSide\('sell'\)\}/);
});

test('mini visual polish is confined to the popup with consistent graphite surfaces', () => {
  const css = source('src/components/trading-v2/desktop/DetachedMiniTerminal.css');
  assert.match(css, /Graphite refinement: consistent surfaces/);
  assert.match(css, /--mini-bg:#0D0F13/);
  assert.match(css, /--mini-field:#15181E/);
  assert.match(css, /\.acg-mini-order-family button\[aria-pressed="true"\]/);
  assert.match(css, /\.acg-mini-pending-field input:disabled/);
  assert.match(css, /\.acg-mini-quick-actions \.acg-mini-buy\{background:#1D61DE/);
  assert.match(css, /\.acg-mini-quick-actions \.acg-mini-sell\{background:#CB3050/);
  const polish = css.slice(css.indexOf('/* Graphite refinement:'));
  assert.doesNotMatch(polish, /(?:^|\n)\.v4-ticket\s*\{/);
});

test('the popup dimensions and its audit-only launch contract are preserved', () => {
  const mini = source('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  const terminal = source('src/components/trading-v2/DesktopTerminal.jsx');
  assert.match(mini, /requestWindow\(\{ width: 270, height: 560 \}\)/);
  assert.match(mini, /popup=yes,width=270,height=560/);
  assert.match(terminal, /DOCK_AUDIT_ENABLED \&\& \(/);
  assert.match(mini, /renderTrade/);
});
