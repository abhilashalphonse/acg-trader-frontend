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
        positionValuations: [{ id: 'p1', accountId: 'a1', valuationStatus: 'LIVE', floatingPnl: '10' }],
        positions: [{ id: 'p1', accountId: 'a1', status: 'OPEN' }],
        orders: [{ id: 'o1', accountId: 'a1', status: 'PENDING' }],
        fills: [{ id: 'f1', accountId: 'a1', type: 'OPEN' }],
      }],
    }),
  });

  assert.equal(state.trading.accountsById.a1.state.balance, '10000');
  assert.equal(state.trading.valuationsByAccountId.a1.valuationStatus, 'LIVE');
  assert.equal(state.trading.positionValuationsById.p1.floatingPnl, '10');
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
      positionValuationsById: { p1: { id: 'p1', accountId: 'a1', floatingPnl: '10' } },
    },
  };
  const state = tradingReducer(seeded, {
    type: 'socket/envelope',
    payload: envelope('trading.position', { event: 'closed', position: { id: 'p1', accountId: 'a1', status: 'CLOSED' } }),
  });
  assert.equal(state.trading.positionsById.p1, undefined);
  assert.equal(state.trading.positionValuationsById.p1, undefined);
});

test('updates realtime position valuation from the WebSocket stream', () => {
  const state = tradingReducer(initialTradingState, {
    type: 'socket/envelope',
    payload: envelope('trading.position.valuation', {
      id: 'p1',
      accountId: 'a1',
      floatingPnl: '42.5',
      closePrice: '1.105',
      valuationStatus: 'LIVE',
    }),
  });

  assert.equal(state.trading.positionValuationsById.p1.floatingPnl, '42.5');
  assert.equal(state.trading.positionValuationsById.p1.valuationStatus, 'LIVE');
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


test('market command result immediately applies authoritative post-fill account valuation', () => {
  const seeded = {
    ...initialTradingState,
    trading: {
      ...initialTradingState.trading,
      accountsById: {
        a1: {
          id: 'a1',
          status: 'ACTIVE',
          tradingEnabled: true,
          financialRevision: 4,
          state: {
            balance: '100000',
            floatingPnl: '0',
            equity: '100000',
            usedMargin: '0',
            freeMargin: '100000',
            marginLevel: null,
          },
        },
      },
      valuationsByAccountId: {
        a1: {
          accountId: 'a1',
          valuationStatus: 'LIVE',
          complete: true,
          financialRevision: 4,
          balance: '100000',
          floatingPnl: '0',
          equity: '100000',
          usedMargin: '0',
          freeMargin: '100000',
          marginLevel: null,
        },
      },
    },
  };

  const state = tradingReducer(seeded, {
    type: 'trading/command-result',
    payload: {
      operation: 'OPEN',
      account: {
        id: 'a1',
        status: 'ACTIVE',
        tradingEnabled: true,
        financialRevision: 5,
        state: {
          balance: '99996.5',
          floatingPnl: '-30',
          equity: '99966.5',
          usedMargin: '1100.3',
          freeMargin: '98866.2',
          marginLevel: '9085.56848132',
        },
      },
      order: { id: 'o1', accountId: 'a1', status: 'FILLED' },
      deal: { id: 'd1', accountId: 'a1', type: 'OPEN', price: '1.1003' },
      position: { id: 'p1', accountId: 'a1', status: 'OPEN', symbol: 'EURUSD' },
      execution: {
        fillPrice: '1.1003',
        commission: '3.5',
        immediateOpeningPnl: '-30',
        requiredMargin: '1100.3',
        resultingAccount: {
          balance: '99996.5',
          floatingPnl: '-30',
          equity: '99966.5',
          usedMargin: '1100.3',
          freeMargin: '98866.2',
          marginLevel: '9085.56848132',
          financialRevision: 5,
        },
      },
    },
  });

  assert.equal(state.trading.accountsById.a1.financialRevision, 5);
  assert.equal(state.trading.valuationsByAccountId.a1.financialRevision, 5);
  assert.equal(state.trading.valuationsByAccountId.a1.balance, '99996.5');
  assert.equal(state.trading.valuationsByAccountId.a1.floatingPnl, '-30');
  assert.equal(state.trading.valuationsByAccountId.a1.usedMargin, '1100.3');
  assert.equal(state.trading.valuationsByAccountId.a1.freeMargin, '98866.2');
  assert.equal(state.trading.valuationsByAccountId.a1.valuationStatus, 'LIVE');
});
