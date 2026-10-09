import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMobileFloatingPnl, mobilePnlTone, openPositionsBadge } from '../src/utils/mobileHeaderPresentation.js';

test('compact mobile P&L keeps currency, sign and semantic tone', () => {
  assert.equal(formatMobileFloatingPnl(0), '$0.00');
  assert.equal(formatMobileFloatingPnl(12.34), '+$12.34');
  assert.equal(formatMobileFloatingPnl(-12.34), '-$12.34');
  assert.match(formatMobileFloatingPnl(13764.12), /\+\$13\.8K/);
  assert.match(formatMobileFloatingPnl(-13764.12), /-\$13\.8K/);
  assert.equal(mobilePnlTone(25), 'profit');
  assert.equal(mobilePnlTone(-25), 'loss');
  assert.equal(mobilePnlTone(0), 'neutral');
  assert.equal(mobilePnlTone(undefined), 'neutral');
});

test('full-precision value stays available in the P&L bottom sheet', () => {
  assert.equal(formatMobileFloatingPnl(13764.12, 'USD', false), '+$13,764.12');
  assert.equal(formatMobileFloatingPnl(-13764.12, 'USD', false), '-$13,764.12');
  assert.equal(formatMobileFloatingPnl(undefined), '—');
});

test('Trades badge shows only open positions, not absent or invalid counts', () => {
  assert.equal(openPositionsBadge(0), null);
  assert.equal(openPositionsBadge(-1), null);
  assert.equal(openPositionsBadge(4), '4');
  assert.equal(openPositionsBadge(111), '99+');
  assert.equal(openPositionsBadge(undefined), null);
});
