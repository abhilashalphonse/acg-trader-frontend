import test from 'node:test';
import assert from 'node:assert/strict';
import { chartLineStyle, chartEntryReference, chartPriceChangePercent, chartEstimateCurrencySupported, chartPositionProtections, chartPlacedSideColor, chartPositionConnectorLevels, isChartOrderAuditEnabled } from '../src/utils/chartOrderPresentation.js';

test('draft or temporary edits use dotted levels while accepted orders and positions stay solid', () => {
  assert.equal(chartLineStyle({ draft: true }), 'dotted');
  assert.equal(chartLineStyle({ preview: true }), 'dotted');
  assert.equal(chartLineStyle({}), 'solid');
  assert.equal(chartLineStyle({ draft: false, preview: false }), 'solid');
});

test('a stop-limit has two displayed prices but its preview P&L reference is the limit leg', () => {
  assert.equal(chartEntryReference({ pending: true, orderType: 'stop-limit', entry: 1.32345, limitPrice: 1.32038 }), 1.32038);
  assert.equal(chartEntryReference({ pending: true, orderType: 'stop_limit', entry: 1.32345, limitPrice: 1.32038 }), 1.32038);
  assert.equal(chartEntryReference({ pending: true, orderType: 'stop', entry: 1.32345, limitPrice: 1.32038 }), 1.32345);
  assert.equal(chartEntryReference({ pending: false, orderType: 'market', entry: 1.32384 }), 1.32384);
});

test('price distance is a price percentage rather than a percentage of equity', () => {
  assert.ok(Math.abs(chartPriceChangePercent(1.32038, 1.32590) - 0.41807) < 0.001);
  assert.equal(chartPriceChangePercent(0, 1.2), null);
  assert.equal(chartPriceChangePercent(null, 1.2), null);
});

test('cross-currency projected amounts are not mislabelled with account currency', () => {
  assert.equal(chartEstimateCurrencySupported({ quoteCurrency: 'USD' }, 'USD'), true);
  assert.equal(chartEstimateCurrencySupported({ quoteCurrency: 'INR' }, 'USD'), false);
});

test('V4 in-chart changes require both the deployment gate and exact audit URL flag', () => {
  assert.equal(isChartOrderAuditEnabled('true', '?acg_v4_audit=1'), true);
  assert.equal(isChartOrderAuditEnabled('false', '?acg_v4_audit=1'), false);
  assert.equal(isChartOrderAuditEnabled(undefined, '?acg_v4_audit=1'), false);
  assert.equal(isChartOrderAuditEnabled('true', ''), false);
  assert.equal(isChartOrderAuditEnabled('true', '?acg_v4_audit=0'), false);
  assert.equal(isChartOrderAuditEnabled('true', '?acg_v4_audit=1&foo=bar'), true);
});

test('attached TP/SL flags use only accepted positive values', () => {
  assert.deepEqual({ ...chartPositionProtections({ sl: 82500, tp: 86300 }) }, { sl: true, tp: true });
  assert.deepEqual({ ...chartPositionProtections({ sl: null, tp: '' }) }, { sl: false, tp: false });
  assert.deepEqual({ ...chartPositionProtections({ sl: 0, tp: 'NaN' }) }, { sl: false, tp: false });
  assert.deepEqual({ ...chartPositionProtections({ sl: -1, tp: undefined }) }, { sl: false, tp: false });
});

test('placed pending color reflects buy/sell side, not order subtype', () => {
  assert.equal(chartPlacedSideColor('buy'), '#12b996');
  assert.equal(chartPlacedSideColor('BUY'), '#12b996');
  assert.equal(chartPlacedSideColor('sell'), '#ef5664');
  assert.equal(chartPlacedSideColor('SELL'), '#ef5664');
});

test('position hover connects only actual protections with correct accepted coordinates', () => {
  const toY = p => 300 - (p - 83000) / 10;
  const both = { id: 'A', entry: 83000, sl: 83200, tp: 82500 };
  assert.deepEqual(chartPositionConnectorLevels(both, toY), [
    { kind: 'entry', y: 300 }, { kind: 'sl', y: 280 }, { kind: 'tp', y: 350 },
  ]);
  assert.deepEqual(chartPositionConnectorLevels({ id: 'B', entryPrice: 83100, sl: null, tp: 82800 }, toY),
    [{ kind: 'entry', y: 290 }, { kind: 'tp', y: 320 }]);
  assert.deepEqual(chartPositionConnectorLevels({ id: 'C', entry: 83000 }, toY), [{ kind: 'entry', y: 300 }]);
  assert.deepEqual(chartPositionConnectorLevels(both, null), []);
});
