import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBrowserTabTitle } from '../src/utils/browserTabTitle.js';

const gold = { symbol: 'XAUUSD', digits: 2, tickSize: 0.01 };
const eur = { symbol: 'EURUSD', digits: 5, tickSize: 0.00001 };

test('selected instrument, live price and feed-provided positive change', () => {
  assert.equal(formatBrowserTabTitle({
    activeSymbol: 'XAUUSD', market: { ...gold, last: '3635.80', changePercent: 2.79 },
    tick: { price: 3636.10 },
  }), 'XAUUSD 3636.10 ▲ +2.79% | ACG Trader');
});
test('negative and zero change remain distinct', () => {
  assert.equal(formatBrowserTabTitle({
    activeSymbol: 'EURUSD', market: { ...eur, changePercent: -0.42 }, tick: { last: 1.1173 },
  }), 'EURUSD 1.11730 ▼ -0.42% | ACG Trader');
  assert.equal(formatBrowserTabTitle({
    activeSymbol: 'EURUSD', market: { ...eur, last: 1.1173, changePercent: 0 },
  }), 'EURUSD 1.11730 0.00% | ACG Trader');
});
test('missing or invalid percent is omitted rather than invented', () => {
  for (const changePercent of [null, undefined, '', 'no data', NaN]) {
    assert.equal(formatBrowserTabTitle({
      activeSymbol: 'XAUUSD', market: { ...gold, last: 3636.1, changePercent },
    }), 'XAUUSD 3636.10 | ACG Trader');
  }
});
test('missing/nonpositive price is omitted and brand fallback remains', () => {
  assert.equal(formatBrowserTabTitle({
    activeSymbol: 'EURUSD', market: { ...eur, last: '—', changePercent: null },
    tick: { price: NaN },
  }), 'EURUSD | ACG Trader');
  assert.equal(formatBrowserTabTitle({}), 'ACG Trader');
});
test('newer tick change updates the active instrument without stale values', () => {
  assert.equal(formatBrowserTabTitle({
    activeSymbol: 'BTCUSD', market: { symbol: 'BTCUSD', digits: 2, last: 66121, changePercent: 4.2 },
    tick: { price: 66121.45, changePercent: 4.21 },
  }), 'BTCUSD 66121.45 ▲ +4.21% | ACG Trader');
});
