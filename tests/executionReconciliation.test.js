import test from 'node:test';
import assert from 'node:assert/strict';
import { executeWithOrderReconciliation } from '../src/utils/executionReconciliation.js';

function ambiguous(code = 'REQUEST_TIMEOUT') {
  const error = new Error(code);
  error.code = code;
  return error;
}

test('ambiguous submission retries at most twice then reconciles without another order submission', async () => {
  let submits = 0;
  let lookups = 0;
  const result = await executeWithOrderReconciliation({
    clientOrderId: 'open-123',
    submit: async () => {
      submits += 1;
      throw ambiguous();
    },
    findOrder: async id => {
      lookups += 1;
      assert.equal(id, 'open-123');
      return { id: 'order-1', clientOrderId: id, status: 'FILLED' };
    },
    sleep: async () => {},
  });

  assert.equal(submits, 2);
  assert.equal(lookups, 1);
  assert.equal(result.reconciled, true);
  assert.equal(result.order.id, 'order-1');
});

test('non-ambiguous rejection is not retried or reconciled', async () => {
  let submits = 0;
  let lookups = 0;
  const rejected = new Error('Risk rejected');
  rejected.code = 'RISK_LIMIT_REACHED';

  await assert.rejects(() => executeWithOrderReconciliation({
    clientOrderId: 'open-456',
    submit: async () => { submits += 1; throw rejected; },
    findOrder: async () => { lookups += 1; return null; },
    sleep: async () => {},
  }), /Risk rejected/);

  assert.equal(submits, 1);
  assert.equal(lookups, 0);
});

test('unconfirmed ambiguous execution locks exposure with EXECUTION_STATUS_UNKNOWN', async () => {
  let submits = 0;
  let lookups = 0;
  await assert.rejects(async () => {
    try {
      await executeWithOrderReconciliation({
        clientOrderId: 'open-789',
        submit: async () => { submits += 1; throw ambiguous('NETWORK_ERROR'); },
        findOrder: async () => { lookups += 1; return null; },
        sleep: async () => {},
      });
    } catch (error) {
      assert.equal(error.code, 'EXECUTION_STATUS_UNKNOWN');
      assert.equal(error.clientOrderId, 'open-789');
      throw error;
    }
  }, /Execution status is unknown/);

  assert.equal(submits, 2);
  assert.equal(lookups, 4);
});
