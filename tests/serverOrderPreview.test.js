import test from 'node:test';
import assert from 'node:assert/strict';

import {
  primaryConversionLeg,
  previewIsExecutable,
  requiresServerOrderPreview,
} from '../src/utils/serverOrderPreview.js';

test('equities always require the authoritative server preview', () => {
  assert.equal(requiresServerOrderPreview(
    { assetClass: 'EQUITY', quoteCurrency: 'USD', pnlCurrency: 'USD', marginCurrency: 'USD' },
    { currency: 'USD' },
  ), true);
});

test('cross-currency instruments require preview while same-currency FX keeps one-click flow', () => {
  assert.equal(requiresServerOrderPreview(
    { assetClass: 'FOREX', quoteCurrency: 'INR', pnlCurrency: 'INR', marginCurrency: 'INR' },
    { currency: 'USD' },
  ), true);

  assert.equal(requiresServerOrderPreview(
    { assetClass: 'FOREX', quoteCurrency: 'USD', pnlCurrency: 'USD', marginCurrency: 'USD' },
    { currency: 'USD' },
  ), false);
});

test('preview executable check requires valid server contract and non-negative projected free margin', () => {
  const valid = {
    previewVersion: 'ACG_ORDER_PREVIEW_V1',
    costs: { requiredMargin: '27.47' },
    projectedAccount: { freeMargin: '9972.53' },
    executionPolicy: { allowed: true },
  };
  assert.equal(previewIsExecutable(valid), true);
  assert.equal(previewIsExecutable({ ...valid, projectedAccount: { freeMargin: '-0.01' } }), false);
  assert.equal(previewIsExecutable({ ...valid, executionPolicy: { allowed: false } }), false);
  assert.equal(previewIsExecutable({ ...valid, previewVersion: 'legacy' }), false);
});

test('margin conversion evidence is preferred for the visible FX leg', () => {
  const margin = { symbol: 'USDINR', selectedSide: 'ASK', quoteRate: '91' };
  const opening = { symbol: 'USDINR', selectedSide: 'BID', quoteRate: '90' };
  assert.deepEqual(primaryConversionLeg({
    conversion: {
      margin: { path: [margin] },
      openingPnl: { path: [opening] },
    },
  }), margin);
});
