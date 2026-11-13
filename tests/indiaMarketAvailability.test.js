import test from 'node:test';
import assert from 'node:assert/strict';
import { isIndiaMarketVisible } from '../src/utils/indiaMarketAvailability.js';

test('Indian stocks are hidden until licensing is enabled', () => {
  const reliance = { symbol: 'RELIANCE', assetClass: 'EQUITY', providerMappings: { accelpix: 'RELIANCE' }, timezone: 'Asia/Kolkata' };
  assert.equal(isIndiaMarketVisible(reliance, false), false);
  assert.equal(isIndiaMarketVisible(reliance, true), true);
});

test('US equities, forex and commodities remain visible', () => {
  assert.equal(isIndiaMarketVisible({ symbol: 'AAPL', assetClass: 'EQUITY' }, false), true);
  assert.equal(isIndiaMarketVisible({ symbol: 'EURUSD', assetClass: 'FOREX' }, false), true);
  assert.equal(isIndiaMarketVisible({ symbol: 'XAUUSD', assetClass: 'METAL' }, false), true);
});
