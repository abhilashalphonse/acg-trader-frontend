import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCandle, normalizeCandleSeries } from '../src/utils/candleNormalization.js';
import { mergeLiveCandleIntoSeries } from '../src/utils/candleMerge.js';
import { reconcileLatestCandles } from '../src/utils/candleHistory.js';
import { candleReadout } from '../src/utils/candleReadout.js';
import { initialTradingState, tradingReducer } from '../src/store/tradingReducer.js';
const bar = (extra = {}) => ({ symbol: 'EURUSD', timeframe: '1m', time: 1790850000,
  openTimeMs: 1790850000000, open: 100, high: 120, low: 90, close: 110, stateEpoch: 1000, stateVersion: 500, ...extra });
const deliver = (state, candle) => tradingReducer(state, { type: 'socket/envelope', payload: { type: 'market.candle.update', data: candle } });
test('restarted server replaces old revisions while delayed previous-epoch packets stay rejected', () => {
  const old = bar(); const fresh = bar({ stateEpoch: 2000, stateVersion: 1, close: 115 });
  let state = deliver(initialTradingState, old);
  state = tradingReducer(state, { type: 'connection/status', payload: { status: 'disconnected' } });
  state = tradingReducer(state, { type: 'socket/envelope', payload: { type: 'connection.ready', data: {} } });
  state = deliver(state, fresh); assert.equal(state.market.candlesByKey['EURUSD:1m'].close, 115);
  state = deliver(state, old); assert.equal(state.market.candlesByKey['EURUSD:1m'].close, 115);
  for (const bars of [normalizeCandleSeries([old, fresh, old]),
    mergeLiveCandleIntoSeries([old], fresh), reconcileLatestCandles([fresh], [old])]) {
    assert.equal(bars[0].close, 115); assert.equal(bars[0].stateEpoch, 2000);
  }
});
test('new server epoch can advance into a newer bucket despite a lower revision', () => {
  const state = deliver(deliver(initialTradingState, bar()), bar({ time: 1790850060,
    openTimeMs: 1790850060000, stateEpoch: 2000, stateVersion: 1 }));
  assert.equal(state.market.candlesByKey['EURUSD:1m'].openTimeMs, 1790850060000);
});
test('null/blank prices cannot create a zero wick', () => {
  for (const key of ['open', 'high', 'low', 'close']) for (const value of [null, undefined, '', ' ']) {
    assert.equal(normalizeCandle(bar({ [key]: value })), null);
  }
});
test('genuine inter-bar price gaps remain intact', () => {
  const bars = normalizeCandleSeries([bar(), bar({ time: 1790850060, open: 112 })]);
  assert.equal(bars[0].close, 110); assert.equal(bars[1].open, 112);
});
test('live updates do not change the OHLC selected by a historical crosshair', () => {
  const history = bar(); const active = bar({ time: history.time + 60, close: 115 });
  const byTime = new Map([[history.time, history], [active.time, active]]);
  assert.equal(candleReadout(byTime, active, history.time), history);
  const next = { ...active, close: 119 }; byTime.set(next.time, next);
  assert.equal(candleReadout(byTime, next, history.time), history);
  assert.equal(candleReadout(byTime, next, null), next);
  assert.equal(candleReadout(byTime, next, history.time - 60), null);
});
