import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commodityDisplaySymbol,
  commoditySearchTerms,
  commoditySubgroup,
  isCommodityInstrument,
} from '../src/utils/commodityPresentation.js';

test('classifies commodity instruments into desktop subgroups', () => {
  assert.equal(isCommodityInstrument({ assetClass: 'METAL' }), true);
  assert.equal(isCommodityInstrument({ assetClass: 'ENERGY' }), true);
  assert.equal(isCommodityInstrument({ assetClass: 'OTHER' }), true);
  assert.equal(isCommodityInstrument({ assetClass: 'FOREX' }), false);

  assert.equal(commoditySubgroup({ symbol: 'XAUUSD', assetClass: 'METAL' }), 'metals');
  assert.equal(commoditySubgroup({ symbol: 'COPPER', assetClass: 'OTHER' }), 'metals');
  assert.equal(commoditySubgroup({ symbol: 'WTIUSD', assetClass: 'ENERGY' }), 'energy');
  assert.equal(commoditySubgroup({ symbol: 'NGASUSD', assetClass: 'ENERGY' }), 'energy');
  assert.equal(commoditySubgroup({ symbol: 'CORN', assetClass: 'OTHER' }), 'agriculture');
  assert.equal(commoditySubgroup({ symbol: 'COCOA', assetClass: 'OTHER' }), 'agriculture');
});

test('uses familiar trader-facing energy aliases without changing canonical symbols', () => {
  assert.equal(commodityDisplaySymbol({ symbol: 'WTIUSD' }), 'USOIL');
  assert.equal(commodityDisplaySymbol({ symbol: 'XBRUSD' }), 'UKOIL');
  assert.equal(commodityDisplaySymbol({ symbol: 'NGASUSD' }), 'NATGAS');
  assert.equal(commodityDisplaySymbol({ symbol: 'CORN', displaySymbol: 'CORN' }), 'CORN');
});

test('commodity search terms include common oil and gas names', () => {
  assert.match(commoditySearchTerms({ symbol: 'WTIUSD', name: 'Crude Oil WTI Spot' }), /USOIL/i);
  assert.match(commoditySearchTerms({ symbol: 'WTIUSD', name: 'Crude Oil WTI Spot' }), /West Texas Intermediate/i);
  assert.match(commoditySearchTerms({ symbol: 'XBRUSD', name: 'Brent Spot \/ US Dollar' }), /UKOIL/i);
  assert.match(commoditySearchTerms({ symbol: 'NGASUSD', name: 'Natural Gas' }), /NATGAS/i);
});
