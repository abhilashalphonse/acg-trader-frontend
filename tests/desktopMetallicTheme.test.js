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

test('desktop settings and help surfaces opt in without affecting mobile sheets', () => {
  const page = source('src/pages/TradingTerminalV2.jsx');
  const sheet = source('src/components/trading-v2/FrontendSheet.jsx');
  const help = source('src/help/HelpCenter.jsx');
  assert.match(page, /<FrontendSheet desktop type=\{overlay\}/);
  assert.match(sheet, /desktop = false/);
  assert.match(sheet, /acg-v3-sheet fixed inset-0/);
  assert.match(help, /desktop \? "acg-v3-help fixed inset-0/);
});

test('all desktop primary surfaces use the exact chart-black palette', () => {
  const shell = source('src/components/trading-v2/desktop/DesktopTerminal.theme.css');
  const execution = source('src/components/trading-v2/desktop/DesktopOrderTicket.theme.css');
  const dock = source('src/components/trading-v2/PositionsPanel.desktop.css');
  assert.match(shell, /--acg-v3-chart-black: #09090B;/);
  assert.match(shell, /\.acg-desktop-v3 \.acg-exec-root,/);
  assert.match(shell, /\.acg-desktop-v3 \.acg-dock-v3,/);
  assert.match(shell, /background: var\(--acg-v3-chart-black\) !important;/);
  assert.match(execution, /--acg-exec-canvas: #09090B;/);
  assert.match(dock, /--acg-dock-canvas: #09090B;/);
});

test('desktop chart-black visual refinement leaves execution colors and mobile layout intact', () => {
  const shell = source('src/components/trading-v2/desktop/DesktopTerminal.theme.css');
  const ticket = source('src/components/trading-v2/desktop/DesktopOrderTicket.theme.css');
  const page = source('src/pages/TradingTerminalV2.jsx');
  assert.match(shell, /\.acg-desktop-v3 aside\[aria-label="Drawing tools"\] button\[class\*="ring-\[#195be1\]"\]/);
  assert.match(ticket, /button\.acg-exec-buy\s*\{\s*background: #195be1/i);
  assert.match(ticket, /button\.acg-exec-sell\s*\{\s*background: #c83242/i);
  assert.match(page, /if \(isDesktop\)/);
  assert.match(page, /<FrontendSheet desktop type=\{overlay\}/);
  assert.match(page, /<PositionsPanel key=\{\x60positions-/);
});

test('desktop drawing rail uses symmetrical insets and retains scrolling', () => {
  const chartArea = source('src/components/trading-v2/ChartArea.jsx');
  const theme = source('src/components/trading-v2/desktop/DesktopTerminal.theme.css');
  const desktopRail = chartArea.match(/const toolbarClass = drawingToolbarOverlay[\s\S]*?\n  return \(/)?.[0] || '';
  assert.equal((desktopRail.match(/acg-desktop-drawing-rail my-0/g) || []).length, 2);
  assert.match(desktopRail, /acg-desktop-drawing-rail my-0[^']*overflow-y-auto/);
  assert.match(theme, /\.acg-desktop-v3 \.acg-desktop-drawing-rail::\-webkit-scrollbar/);
  assert.match(theme, /scrollbar-width: none/);
  assert.match(desktopRail, /acg-mobile-reference-drawing-rail mx-0\.5 my-1/);
});

test('desktop positions headers sit close to their tabs without changing the 44px tab bar', () => {
  const positions = source('src/components/trading-v2/PositionsPanel.jsx');
  assert.match(positions, /flex h-\[44px\] items-center justify-between/);
  assert.match(positions, /grid-cols-\[1\.25fr_\.65fr_[^"'\n]+?\] items-center border-b border-white\/\[0\.06\] px-3 pb-1 pt-0\.5/);
});

test('desktop workspace is edge-aligned without outer vertical gutters', () => {
  const desktop = source('src/components/trading-v2/DesktopTerminal.jsx');
  assert.match(desktop, /acg-terminal acg-desktop-v3 relative flex h-dvh min-h-0 flex-col gap-0 overflow-hidden bg-black px-1 pt-1 pb-0/);
  assert.match(desktop, /relative grid h-full min-h-0 min-w-0 gap-x-1 gap-y-0 bg-black/);
  assert.match(desktop, /gridTemplateRows: `minmax\(0, 1fr\) \$\{dockHeight\}px`/);
});

test('desktop Positions empty state fills remaining dock area and keeps mobile view independent', () => {
  const positions = source('src/components/trading-v2/PositionsPanel.jsx');
  assert.match(positions, /acg-desktop-positions acg-dock-v3 flex h-full min-h-0 flex-col/);
  assert.match(positions, /tab === 'positions' && desktopDense && \([\s\S]*?<div className="flex min-w-\[1120px\] flex-1 flex-col">/);
  assert.match(positions, /!positions\.length && <div className="grid min-h-\[110px\] flex-1 place-items-center/);
  assert.match(positions, /: 'mt-3 overflow-visible'/);
});
