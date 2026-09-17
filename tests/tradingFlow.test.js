import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTradingState, tradingReducer } from '../src/store/tradingReducer.js';

function apply(state, type, data) {
  return tradingReducer(state, {
    type: 'socket/envelope',
    payload: { type, data, timestamp: '2026-09-17T18:00:00.000Z' },
  });
}

test('reconciles snapshot through order, fill, position valuation and close', () => {
  let state = apply(initialTradingState, 'trading.state.snapshot', {
    accounts: [{
      account: { id: 'a1', status: 'ACTIVE', tradingEnabled: true, state: { balance: '10000', equity: '10000' } },
      valuation: { accountId: 'a1', valuationStatus: 'LIVE', balance: '10000', equity: '10000', floatingPnl: '0' },
      positions: [],
      orders: [],
      fills: [],
    }],
  });

  state = apply(state, 'trading.order', {
    event: 'accepted',
    order: { id: 'o1', accountId: 'a1', symbol: 'EURUSD', side: 'BUY', type: 'MARKET', status: 'ACCEPTED' },
  });
  state = apply(state, 'trading.fill', {
    event: 'created',
    fill: { id: 'f1', accountId: 'a1', orderId: 'o1', positionId: 'p1', symbol: 'EURUSD', type: 'OPEN', price: '1.10010' },
  });
  state = apply(state, 'trading.position', {
    event: 'opened',
    position: { id: 'p1', accountId: 'a1', symbol: 'EURUSD', side: 'BUY', status: 'OPEN', openVolume: '0.10', entryPrice: '1.10010' },
  });
  state = apply(state, 'trading.account.valuation', {
    accountId: 'a1', valuationStatus: 'LIVE', balance: '10000', equity: '10004.50', floatingPnl: '4.50', usedMargin: '110', freeMargin: '9894.50',
  });

  assert.equal(state.trading.ordersById.o1.status, 'ACCEPTED');
  assert.equal(state.trading.fills[0].positionId, 'p1');
  assert.equal(state.trading.positionsById.p1.status, 'OPEN');
  assert.equal(state.trading.valuationsByAccountId.a1.floatingPnl, '4.50');

  state = apply(state, 'trading.position', {
    event: 'closed',
    position: { id: 'p1', accountId: 'a1', symbol: 'EURUSD', side: 'BUY', status: 'CLOSED', openVolume: '0' },
  });
  assert.equal(state.trading.positionsById.p1, undefined);
});
