import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTradingState, tradingReducer } from '../src/store/tradingReducer.js';

function envelope(type, data) {
  return { type, data, timestamp: '2026-09-17T18:00:00.000Z' };
}

test('hydrates authoritative account state from trading snapshot', () => {
  const state = tradingReducer(initialTradingState, {
    type: 'socket/envelope',
    payload: envelope('trading.state.snapshot', {
      accounts: [{
        account: { id: 'a1', status: 'ACTIVE', state: { balance: '10000' } },
        valuation: { accountId: 'a1', valuationStatus: 'LIVE', equity: '10010' },
        positions: [{ id: 'p1', accountId: 'a1', status: 'OPEN' }],
        orders: [{ id: 'o1', accountId: 'a1', status: 'PENDING' }],
        fills: [{ id: 'f1', accountId: 'a1', type: 'OPEN' }],
      }],
    }),
  });

  assert.equal(state.trading.accountsById.a1.state.balance, '10000');
  assert.equal(state.trading.valuationsByAccountId.a1.valuationStatus, 'LIVE');
  assert.equal(state.trading.positionsById.p1.status, 'OPEN');
  assert.equal(state.trading.ordersById.o1.status, 'PENDING');
  assert.equal(state.trading.fills[0].id, 'f1');
});

test('removes a position when the server emits a close event', () => {
  const seeded = {
    ...initialTradingState,
    trading: {
      ...initialTradingState.trading,
      positionsById: { p1: { id: 'p1', accountId: 'a1', status: 'OPEN' } },
    },
  };
  const state = tradingReducer(seeded, {
    type: 'socket/envelope',
    payload: envelope('trading.position', { event: 'closed', position: { id: 'p1', accountId: 'a1', status: 'CLOSED' } }),
  });
  assert.equal(state.trading.positionsById.p1, undefined);
});

test('deduplicates fills by server entity id', () => {
  let state = tradingReducer(initialTradingState, {
    type: 'socket/envelope',
    payload: envelope('trading.fill', { event: 'created', fill: { id: 'f1', accountId: 'a1', price: '1.1' } }),
  });
  state = tradingReducer(state, {
    type: 'socket/envelope',
    payload: envelope('trading.fill', { event: 'created', fill: { id: 'f1', accountId: 'a1', price: '1.2' } }),
  });
  assert.equal(state.trading.fills.length, 1);
  assert.equal(state.trading.fills[0].price, '1.2');
});


test('market tick updates both tick and quote state for active symbols', () => {
  const tick = {
    symbol: 'EURUSD',
    price: '1.10501',
    bid: '1.10500',
    ask: '1.10502',
    sequence: 42,
  };
  const state = tradingReducer(initialTradingState, {
    type: 'socket/envelope',
    payload: envelope('market.tick', tick),
  });

  assert.deepEqual(state.market.ticksBySymbol.EURUSD, tick);
  assert.deepEqual(state.market.quotesBySymbol.EURUSD, tick);
});


test('provider stream recovery increments candle-history reconciliation revision', () => {
  let state = tradingReducer(initialTradingState, {
    type: 'socket/envelope',
    payload: envelope('market.status', { scope: 'gateway', state: 'DISCONNECTED', recovered: false }),
  });
  assert.equal(state.market.historyRecoveryRevision, 0);

  state = tradingReducer(state, {
    type: 'socket/envelope',
    payload: envelope('market.status', { scope: 'gateway', state: 'CONNECTING', recovered: false }),
  });
  assert.equal(state.market.historyRecoveryRevision, 0);

  state = tradingReducer(state, {
    type: 'socket/envelope',
    payload: envelope('market.status', { scope: 'gateway', state: 'LIVE', recovered: true }),
  });
  assert.equal(state.market.historyRecoveryRevision, 1);
  assert.equal(state.market.gatewayStatus.state, 'LIVE');

  state = tradingReducer(state, {
    type: 'socket/envelope',
    payload: envelope('market.status', { scope: 'gateway', state: 'LIVE', recovered: false }),
  });
  assert.equal(state.market.historyRecoveryRevision, 1);
});
