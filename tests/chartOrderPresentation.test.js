import test from 'node:test';
import assert from 'node:assert/strict';
import { chartLineStyle, chartEntryReference, chartPriceChangePercent, chartEstimateCurrencySupported } from '../src/utils/chartOrderPresentation.js';

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
