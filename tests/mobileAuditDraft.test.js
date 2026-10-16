import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileOrderTypePatch, mobileProtectionPatch } from '../src/utils/mobileAuditDraft.js';
import { createDefaultTradePlan, validateTradePlanForExecution } from '../src/utils/tradePlanExecution.js';

const market = { symbol:'EURUSD', assetClass:'FOREX', bid:1.12091, ask:1.12092, tickSize:0.00001, pipSize:0.0001 };
for (const side of ['buy', 'sell']) {
  test(`${side}: switching order type retains risk budget and protection, invalidates only entry`, () => {
    const plan = { ...createDefaultTradePlan({ side, market }), auditMode:'riskUSD', auditValue:'137', stage:'review' };
    for (const type of ['limit', 'stop', 'market']) {
      const patch = mobileOrderTypePatch(plan, type, market);
      const next = { ...plan, ...patch };
      assert.equal(next.auditValue, '137');
      assert.equal(next.auditMode, 'riskUSD');
      assert.equal(next.sl, plan.sl);
      assert.equal(next.tp, plan.tp);
      assert.equal(next.pending, type !== 'market');
      assert.equal(validateTradePlanForExecution(next, market).valid, true);
    }
  });
  test(`${side}: chart-first protection seeds normalized levels on correct side`, () => {
    const plan = createDefaultTradePlan({ side, market, protection:'none' });
    const sl = mobileProtectionPatch(plan, 'sl', market);
    const tp = mobileProtectionPatch(plan, 'tp', market);
    assert.equal(sl.activeField, 'sl');
    assert.equal(tp.activeField, 'tp');
    assert.ok(side === 'buy' ? sl.sl < plan.entry && tp.tp > plan.entry : sl.sl > plan.entry && tp.tp < plan.entry);
    assert.equal(validateTradePlanForExecution({ ...plan, ...sl, ...tp }, market).valid, true);
  });
}
test('local UI helpers cannot mutate accepted positions or pending-order edits', () => {
  for (const plan of [{ side:'buy', open:true }, { side:'sell', editingOrderId:'accepted' }]) {
    assert.equal(mobileOrderTypePatch(plan, 'limit', market), null);
    assert.equal(mobileProtectionPatch(plan, 'sl', market), null);
  }
  assert.equal(mobileOrderTypePatch(null, 'stop', market), null);
  assert.equal(mobileOrderTypePatch({side:'buy'}, 'unknown', market), null);
});
