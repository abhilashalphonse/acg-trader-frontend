import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMarketSessionClosed,
  marketForSymbol,
  positionCloseAvailability,
} from '../src/utils/marketExecutionAvailability.js';
import { exposureAvailability } from '../src/utils/exposureAvailability.js';

function market(overrides = {}) {
  return {
    symbol: 'AUDCAD',
    sessionOpen: true,
    marketState: 'LIVE',
    isStale: false,
    bid: 0.9901,
    ask: 0.9902,
    ...overrides,
  };
}

test('closed session is a UI state and blocks manual close before submission', () => {
  const result = positionCloseAvailability(market({ sessionOpen: false, marketState: 'CLOSED' }));
  assert.equal(isMarketSessionClosed(market({ sessionOpen: false })), true);
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'MARKET_CLOSED');
  assert.match(result.reason, /Market closed/);
});

test('marketState CLOSED also blocks when session flag has not refreshed yet', () => {
  const result = positionCloseAvailability(market({ sessionOpen: true, marketState: 'CLOSED' }));
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'MARKET_CLOSED');
});

test('live executable quote allows manual close', () => {
  const result = positionCloseAvailability(market());
  assert.deepEqual(result, { allowed: true, code: 'READY', reason: '' });
});

test('stale, unavailable and crossed quotes stay disabled without relying on backend errors', () => {
  assert.equal(positionCloseAvailability(market({ isStale: true })).code, 'QUOTE_STALE');
  assert.equal(positionCloseAvailability(market({ marketState: 'DISCONNECTED' })).code, 'MARKET_DATA_UNAVAILABLE');
  assert.equal(positionCloseAvailability(market({ bid: 1.1, ask: 1.09 })).code, 'QUOTE_UNAVAILABLE');
});

test('market lookup resolves the position symbol instead of using the active chart symbol', () => {
  const markets = [market(), market({ symbol: 'XAUUSD', bid: 4300, ask: 4301 })];
  assert.equal(marketForSymbol(markets, 'xauusd')?.symbol, 'XAUUSD');
  assert.equal(marketForSymbol(markets, 'GBPUSD', markets[0])?.symbol, 'AUDCAD');
});


test('new exposure is disabled when market state says CLOSED even before sessionOpen refreshes', () => {
  const result = exposureAvailability({
    account: {
      id: 'account-1',
      status: 'ACTIVE',
      tradingEnabled: true,
      valuationStatus: 'LIVE',
      riskProcessingState: 'RESOLVED',
      marginStopOutState: 'NONE',
    },
    connectionStatus: 'ready',
    commandState: {},
    market: market({ sessionOpen: undefined, marketState: 'CLOSED' }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'SESSION_CLOSED');
  assert.match(result.reason, /Market closed/);
});
