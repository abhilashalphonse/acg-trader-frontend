import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChartPendingAmendment } from '../src/utils/pendingOrderChartMove.js';

const order = { orderType: 'stop-limit', entry: 1.32345, limitPrice: 1.32038, sl: 1.32590, tp: 1.31726, volume: 0.10, expiration: 'GTC' };

test('stop-limit execution-bound drag does not change its trigger', () => {
  assert.deepEqual(
    { entry: buildChartPendingAmendment(order, 1.32010, 'limitPrice').entry, limit: buildChartPendingAmendment(order, 1.32010, 'limitPrice').limitPrice },
    { entry: 1.32345, limit: 1.32010 },
  );
});

test('stop-limit trigger drag shifts both stop and limit, maintaining their initial separation', () => {
  const updated = buildChartPendingAmendment(order, 1.32245, 'entry');
  assert.ok(Math.abs(updated.limitPrice - 1.31938) < 1e-9);
  assert.equal(updated.entry, 1.32245);
  assert.equal(updated.stopLoss, 1.32590);
});

test('SL and TP amendments remain separate, and limit edits on regular stop are refused', () => {
  assert.equal(buildChartPendingAmendment(order, 1.32600, 'sl').stopLoss, 1.32600);
  assert.equal(buildChartPendingAmendment(order, 1.31600, 'tp').takeProfit, 1.31600);
  assert.equal(buildChartPendingAmendment({ ...order, orderType: 'stop' }, 1.32010, 'limitPrice'), null);
  assert.equal(buildChartPendingAmendment(order, 0, 'entry'), null);
});
