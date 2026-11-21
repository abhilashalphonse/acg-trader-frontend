import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('trade ticket replaces the three-dot menu with an icon-only pop-out beside the close button in audit mode', () => {
  const ticket = src('src/components/trading-v2/desktop/DesktopOrderTicketV4.jsx');
  assert.match(ticket, /onOpenMiniTerminal\s*\?\s*\(/);
  assert.match(ticket, /data-acg-mini-header-launcher="true"/);
  assert.match(ticket, /aria-label="Pop out mini terminal"/);
  assert.match(ticket, /miniTerminalReady/);
  const popup = ticket.indexOf('data-acg-mini-header-launcher="true"');
  const close = ticket.indexOf('aria-label="Close trade ticket"', popup);
  assert.ok(close > popup, 'Popup action comes immediately before close action');
  assert.match(ticket, /!onOpenMiniTerminal && menuOpen/);
  assert.match(ticket, /aria-label="Ticket information"/);
});

test('the existing popup is controlled by the execution header and no rail button remains', () => {
  const owner = src('src/components/trading-v2/DesktopTerminal.jsx');
  const mini = src('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  assert.match(owner, /onOpenMiniTerminal=\{DOCK_AUDIT_ENABLED \? openMiniTerminal : undefined\}/);
  assert.match(owner, /ref=\{miniTerminalRef\}/);
  assert.match(owner, /onReadyChange=\{setMiniTerminalReady\}/);
  assert.match(mini, /React\.forwardRef\(/);
  assert.match(mini, /React\.useImperativeHandle\(ref, \(\) => \(\{ open: openWindow \}\)\)/);
  assert.match(mini, /if \(windowRef\.current && !windowRef\.current\.closed\) \{ windowRef\.current\.focus\(\); return; \}/);
  assert.doesNotMatch(mini, /data-acg-mini-launcher/);
  assert.doesNotMatch(mini, /className="acg-mini-rail-launcher/);
  assert.doesNotMatch(owner, /fallback=\{<span className="mb-1 block size-9"/);
});

test('the full terminal remains unchanged outside audit mode and popup still uses authoritative callbacks', () => {
  const owner = src('src/components/trading-v2/DesktopTerminal.jsx');
  const mini = src('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  assert.match(owner, /DOCK_AUDIT_ENABLED && \(/);
  assert.match(mini, /createPortal\(detached \?/);
  assert.match(owner, /renderTrade=\{dock => <DesktopOrderTicket/);
  assert.match(owner, /onManualOrder=\{submitOneClick\}/);
  assert.match(mini, /width: 270, height: 560/);
});
