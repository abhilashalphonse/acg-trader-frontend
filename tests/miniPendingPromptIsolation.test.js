import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');

test('mini pending planning suppresses only redundant instructions and retains all execution guards', () => {
  const ticket=get('src/components/trading-v2/desktop/DesktopOrderTicket.jsx');
  for(const instruction of [
    'Choose Buy or Sell to project a pending order on the chart.',
    'Limit projection active — drag entry, adjust lots',
    'Limit projection active — drag entry or adjust lots.',
  ]) {
    assert.ok(ticket.includes(instruction), 'regular ticket must retain its instruction');
  }
  assert.match(ticket,/if \(variant !== 'mini'\) onNotice\('Choose Buy or Sell/);
  assert.match(ticket,/if \(variant !== 'mini'\) onNotice\(\x60\$\{side/);
  assert.match(ticket,/if \(!executableQuote \|\| !exposureAllowed\)/);
  assert.match(ticket,/onExecutePlan\(\{/);
  assert.match(ticket,/desktopPendingDraft: false/);
  assert.match(ticket,/Set SL to calculate size before placing the pending order/);
});

test('direct chart cancellation is strictly gated to actual detached audit popup lifecycle', () => {
  const terminal=get('src/components/trading-v2/DesktopTerminal.jsx');
  const mini=get('src/components/trading-v2/desktop/DetachedMiniTerminal.jsx');
  const multi=get('src/components/trading-v2/desktop/DesktopMultiChart.jsx');
  const chart=get('src/components/trading-v2/ChartArea.jsx');
  const orders=get('src/components/trading-v2/v4/V4FullTerminalOrders.jsx');
  const layer=get('src/components/trading-v2/v4/V4ChartOrderLayer.jsx');

  assert.match(terminal,/directPendingCancel=\{DOCK_AUDIT_ENABLED && miniTerminalDetached\}/);
  assert.match(terminal,/onDetachedChange=\{setMiniTerminalDetached\}/);
  assert.match(mini,/onDetachedChange\?\.\(detached\)/);
  assert.match(multi,/directPendingCancel=\{isActive && directPendingCancel\}/);
  assert.match(chart,/directPendingCancel=\{directPendingCancel && !auditMobile\}/);
  assert.match(orders,/directPendingCancel=\{!mobile && directPendingCancel\}/);
  assert.match(layer,/if \(!directPendingCancel\) \{[\s\S]*?setCancelPendingId\(level.id\);/);
  assert.match(layer,/pendingCancelsInFlight\.current\.has\(orderId\)/);
  assert.match(layer,/await onCancelPending\(orderId\)/);
  assert.match(layer,/!readOnly && !directPendingCancel && cancelPendingId/);
});

test('the test fixture simulates pending cancellations without contacting a real backend', () => {
  const fixture=get('src/v4PositionsAuditMain.jsx');
  assert.match(fixture,/onCancelPending=\{async id=>\{/);
  assert.match(fixture,/kind:'cancel-pending'/);
  assert.match(fixture,/if\(publicReview\)return false/);
});
