import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('metallic theme is scoped to the desktop terminal, not shared mobile shell', () => {
  const terminal = source('src/components/trading-v2/DesktopTerminal.jsx');
  const css = source('src/components/trading-v2/desktop/DesktopTerminal.theme.css');
  assert.match(terminal, /import '\.\/desktop\/DesktopTerminal\.theme\.css';/);
  assert.match(terminal, /className="acg-terminal acg-desktop-v3 /);
  assert.match(css, /\.acg-desktop-v3 \{/);
  assert.doesNotMatch(css, /^\s*:root\s*\{/m);
  assert.doesNotMatch(css, /^\s*body\s*\{/m);
});

test('desktop chrome uses silver selections while Buy and Sell retain their action colors', () => {
  const terminal = source('src/components/trading-v2/DesktopTerminal.jsx');
  const theme = source('src/components/trading-v2/desktop/DesktopTerminal.theme.css');
  const ticket = source('src/components/trading-v2/desktop/DesktopOrderTicket.theme.css');
  assert.doesNotMatch(terminal, /#195be1/i);
  assert.match(theme, /--acg-v3-silver: #cbd0d6/);
  assert.match(theme, /\.acg-desktop-v3 \.acg-active-underline/);
  assert.match(ticket, /button\.acg-exec-buy\s*\{\s*background: #195be1/i);
  assert.match(ticket, /button\.acg-exec-sell\s*\{\s*background: #c83242/i);
});

test('desktop drawing tool accents are isolated without changing shared mobile drawing styles', () => {
  const theme = source('src/components/trading-v2/desktop/DesktopTerminal.theme.css');
  assert.match(theme, /\.acg-desktop-v3 aside\[aria-label="Drawing tools"\]/);
  assert.match(theme, /\.acg-desktop-v3 \.acg-mobile-drawing-tool-selected/);
});

test('desktop quote labels are neutral but mobile bid/ask markers remain in their existing colors', () => {
  const chart = source('src/components/TradingChart.jsx');
  assert.match(chart, /mobileQuotes \? '#19c9ad' : showBidAskLines \? '#B0B7BF'/);
  assert.match(chart, /mobileQuotes \? '#ff5d70' : '#939BA4'/);
  assert.match(chart, /mobileQuotes \? \{ axisLabelColor: '#d93d52'/);
});
