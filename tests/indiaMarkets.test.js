import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isChartOnlyInstrument,
  isIndiaInstrument,
  marketCategoryId,
  marketGroup,
  marketVenue,
} from '../src/utils/marketClassification.js';
import { exposureAvailability } from '../src/utils/exposureAvailability.js';
import { buildDefaultWatchlists } from '../src/hooks/useWatchlists.js';

const reliance = {
  symbol: 'RELIANCE',
  assetClass: 'EQUITY',
  timezone: 'Asia/Kolkata',
  quoteCurrency: 'INR',
  executionEnabled: false,
  providerMappings: { accelpix: 'RELIANCE' },
};

test('classifies Accelpix equities as India/NSE instead of generic stocks', () => {
  assert.equal(isIndiaInstrument(reliance), true);
  assert.equal(marketGroup(reliance), 'India');
  assert.equal(marketCategoryId(reliance), 'india');
  assert.equal(marketVenue(reliance), 'NSE');
  assert.equal(isChartOnlyInstrument(reliance), true);
});

test('keeps ordinary Twelve Data equities in Stocks', () => {
  const apple = {
    symbol: 'AAPL',
    assetClass: 'EQUITY',
    timezone: 'America/New_York',
    executionEnabled: true,
    providerMappings: { twelveData: 'AAPL' },
  };
  assert.equal(isIndiaInstrument(apple), false);
  assert.equal(marketGroup(apple), 'Stocks');
  assert.equal(marketCategoryId(apple), 'stocks');
  assert.equal(marketVenue(apple), null);
});

test('builds a dedicated India NSE watchlist without duplicating India equities into Stocks', () => {
  const lists = buildDefaultWatchlists([
    reliance,
    {
      symbol: 'TCS',
      assetClass: 'EQUITY',
      timezone: 'Asia/Kolkata',
      providerMappings: { accelpix: 'TCS' },
    },
    {
      symbol: 'AAPL',
      assetClass: 'EQUITY',
      timezone: 'America/New_York',
      providerMappings: { twelveData: 'AAPL' },
    },
  ]);

  assert.deepEqual(lists.find(item => item.id === 'india')?.symbols, ['RELIANCE', 'TCS']);
  assert.deepEqual(lists.find(item => item.id === 'stocks')?.symbols, ['AAPL']);
});

test('blocks new exposure for a chart-only NSE instrument while keeping charts usable', () => {
  const result = exposureAvailability({
    account: {
      id: 'a1',
      status: 'ACTIVE',
      tradingEnabled: true,
      valuationStatus: 'LIVE',
    },
    connectionStatus: 'ready',
    commandState: {},
    market: {
      ...reliance,
      sessionOpen: true,
      isStale: false,
      marketState: 'LIVE',
      bid: '1174.90',
      ask: '1175.00',
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'INSTRUMENT_EXECUTION_DISABLED');
  assert.match(result.reason, /chart-only/i);
});
