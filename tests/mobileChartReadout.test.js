import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileChartReadout } from '../src/utils/mobileChartReadout.js';

test('mobile header reports candle change, not daily or account P&L', () => {
  const result = mobileChartReadout({symbol:'eurusd', timeframe:'M15', bar:{open:1.10,close:1.111}, inspecting:true});
  assert.equal(result.symbol, 'EURUSD');
  assert.equal(result.timeframe, 'M15');
  assert.ok(Math.abs(result.changePercent - 1) < 1e-10);
  assert.equal(result.close, 1.111);
  assert.equal(result.inspecting, true);
});
test('missing or invalid candle data never becomes a fabricated price/change', () => {
  for (const bar of [null, {}, {open:0,close:1}, {open:1,close:null}, {open:NaN,close:1}, {open:1,close:Infinity}])
    assert.equal(mobileChartReadout({bar}), null);
  const unchanged = mobileChartReadout({symbol:'EURUSD',timeframe:'M1',bar:{open:1,close:1}});
  assert.equal(unchanged.changePercent, 0);
});
