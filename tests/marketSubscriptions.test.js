import test from 'node:test';
import assert from 'node:assert/strict';
import { riskCriticalMarketSymbols } from '../src/utils/marketSubscriptions.js';

test('open-position symbols stay subscribed even when they are not active or watched', () => {
  const symbols = riskCriticalMarketSymbols({
    grantedAccountIds: ['acct-1'],
    positionsById: {
      p1: { accountId: 'acct-1', symbol: 'AUDCAD', status: 'OPEN' },
      p2: { accountId: 'acct-1', symbol: 'XAUUSD', status: 'CLOSED' },
    },
    ordersById: {},
  });

  assert.deepEqual(symbols, ['AUDCAD']);
});

test('active pending-order symbols remain subscribed for trigger and execution integrity', () => {
  const symbols = riskCriticalMarketSymbols({
    grantedAccountIds: ['acct-1'],
    positionsById: {},
    ordersById: {
      o1: { accountId: 'acct-1', symbol: 'GBPUSD', type: 'LIMIT', status: 'PENDING' },
      o2: { accountId: 'acct-1', symbol: 'USDJPY', type: 'MARKET', status: 'ACCEPTED' },
      o3: { accountId: 'acct-1', symbol: 'EURUSD', type: 'STOP', status: 'CANCELLED' },
    },
  });

  assert.deepEqual(symbols, ['GBPUSD']);
});

test('risk-critical subscriptions ignore positions and orders outside granted accounts', () => {
  const symbols = riskCriticalMarketSymbols({
    grantedAccountIds: ['acct-1'],
    positionsById: {
      p1: { accountId: 'acct-2', symbol: 'BTCUSD', status: 'OPEN' },
      p2: { accountId: 'acct-1', symbol: 'XAUUSD', status: 'OPEN' },
    },
    ordersById: {
      o1: { accountId: 'acct-2', symbol: 'ETHUSD', type: 'STOP', status: 'TRIGGERED' },
    },
  });

  assert.deepEqual(symbols, ['XAUUSD']);
});
