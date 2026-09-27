import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountExposureState,
  deriveAccountCapabilities,
  protectionRequirement,
} from '../src/utils/accountCapabilities.js';

test('V2 manual-lot optional SL requires explicit backend confirmation for the active account', () => {
  const v2 = deriveAccountCapabilities({
    challenge: { riskPolicyVersion: 'ACG_FUNDED_V2' },
    capabilities: {
      policyVersion: 'ACG_FUNDED_V2',
      fundedV2Confirmed: true,
      optionalStopLoss: true,
      manualLotWithoutStopLoss: true,
      riskPercentSizing: true,
      riskPercentSizingRequiresStopDistance: true,
      marginStopOutLevelPercent: '50',
    },
  });
  assert.equal(v2.fundedV2Confirmed, true);
  assert.equal(v2.manualLotWithoutStopLoss, true);
  assert.equal(v2.stopLossRequiredForManualLots, false);
  assert.equal(v2.stopLossRequiredForRiskSizing, true);

  const unconfirmed = deriveAccountCapabilities({
    challenge: { riskPolicyVersion: 'ACG_FUNDED_V2' },
    capabilities: {
      optionalStopLoss: true,
      manualLotWithoutStopLoss: true,
    },
  });
  assert.equal(unconfirmed.fundedV2Confirmed, false);
  assert.equal(unconfirmed.manualLotWithoutStopLoss, false);
  assert.equal(unconfirmed.stopLossRequiredForManualLots, true);
});

test('V1 and unknown accounts remain fail-closed for manual lots without SL', () => {
  for (const account of [
    { challenge: { riskPolicyVersion: 'ACG_FUNDED_V1' }, capabilities: {} },
    {},
  ]) {
    const result = protectionRequirement({
      account,
      sizingMode: 'lots',
      stopLoss: null,
    });
    assert.equal(result.valid, false);
    assert.equal(result.code, 'POLICY_STOP_REQUIRED');
  }
});

test('confirmed V2 manual lots may omit SL but risk-percent sizing still requires it', () => {
  const account = {
    challenge: { riskPolicyVersion: 'ACG_FUNDED_V2' },
    capabilities: {
      policyVersion: 'ACG_FUNDED_V2',
      fundedV2Confirmed: true,
      optionalStopLoss: true,
      manualLotWithoutStopLoss: true,
      riskPercentSizingRequiresStopDistance: true,
    },
  };

  assert.equal(protectionRequirement({ account, sizingMode: 'lots', stopLoss: null }).valid, true);
  const risk = protectionRequirement({ account, sizingMode: 'risk', stopLoss: null });
  assert.equal(risk.valid, false);
  assert.equal(risk.code, 'RISK_STOP_REQUIRED');
  assert.match(risk.message, /requires a stop loss/i);
});

test('active margin stop-out blocks only new exposure state and is not treated as challenge breach', () => {
  const result = accountExposureState({
    status: 'ACTIVE',
    marginStopOut: { state: 'ACTIVE', episodeId: 'episode-1' },
    capabilities: {
      policyVersion: 'ACG_FUNDED_V2',
      fundedV2Confirmed: true,
      marginStopOutActive: true,
      marginStopOutLevelPercent: '50',
    },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'MARGIN_STOP_OUT_ACTIVE');
  assert.match(result.reason, /stop-out/i);
  assert.match(result.reason, /> 50%/i);
});

test('unresolved durable risk state blocks new exposure independently of policy version', () => {
  const result = accountExposureState({
    riskProcessingState: 'RISK_UNRESOLVED',
    riskUnresolvedReason: 'RISK_SEQUENCE_GAP',
    capabilities: {
      policyVersion: 'ACG_FUNDED_V2',
      fundedV2Confirmed: true,
    },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'RISK_STATE_UNRESOLVED');
  assert.match(result.reason, /reconciled/i);
});
