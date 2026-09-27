const V2_POLICY_VERSION = 'ACG_FUNDED_V2';

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function deriveAccountCapabilities(account = {}) {
  const backend = account?.capabilities || {};
  const policyVersion = String(
    backend.policyVersion
    || account?.challenge?.riskPolicyVersion
    || account?.policyVersion
    || '',
  ).trim().toUpperCase() || null;

  // V2 behavior is deliberately fail-closed. The frontend only enables the
  // relaxed manual-lot behavior when the backend confirms both the policy
  // version and the capability bit for this exact account.
  const fundedV2Confirmed = (
    policyVersion === V2_POLICY_VERSION
    && backend.fundedV2Confirmed === true
  );
  const manualLotWithoutStopLoss = (
    fundedV2Confirmed
    && backend.manualLotWithoutStopLoss === true
  );
  const optionalStopLoss = (
    fundedV2Confirmed
    && backend.optionalStopLoss === true
  );

  const marginStopOutActive = (
    backend.marginStopOutActive === true
    || String(account?.marginStopOut?.state || '').toUpperCase() === 'ACTIVE'
    || String(account?.marginStopOutState || '').toUpperCase() === 'ACTIVE'
  );

  return {
    policyVersion,
    fundedV2Confirmed,
    optionalStopLoss,
    manualLotWithoutStopLoss,
    riskPercentSizing: backend.riskPercentSizing !== false,
    riskPercentSizingRequiresStopDistance: backend.riskPercentSizingRequiresStopDistance !== false,
    marginStopOutLevelPercent: finiteNumber(backend.marginStopOutLevelPercent, 50),
    marginStopOutActive,
    stopLossRequiredForManualLots: !manualLotWithoutStopLoss,
    stopLossRequiredForRiskSizing: true,
  };
}

export function protectionRequirement({ account, sizingMode = 'lots', stopLoss = null } = {}) {
  const capabilities = deriveAccountCapabilities(account);
  const mode = String(sizingMode || 'lots').toLowerCase() === 'risk' ? 'risk' : 'lots';
  const required = mode === 'risk'
    ? capabilities.stopLossRequiredForRiskSizing
    : capabilities.stopLossRequiredForManualLots;
  const hasStopLoss = Number.isFinite(Number(stopLoss)) && Number(stopLoss) > 0;

  if (!required || hasStopLoss) {
    return { valid: true, required, code: 'READY', message: null, capabilities };
  }

  return {
    valid: false,
    required: true,
    code: mode === 'risk' ? 'RISK_STOP_REQUIRED' : 'POLICY_STOP_REQUIRED',
    message: mode === 'risk'
      ? 'Risk % sizing requires a stop loss.'
      : 'This account policy requires a stop loss for new manual-lot exposure.',
    capabilities,
  };
}

export function accountExposureState(account = {}) {
  const capabilities = deriveAccountCapabilities(account);
  const riskProcessingState = String(account?.riskProcessingState || 'RESOLVED').toUpperCase();

  if (riskProcessingState === 'RISK_UNRESOLVED') {
    return {
      allowed: false,
      code: 'RISK_STATE_UNRESOLVED',
      reason: 'Trading is temporarily unavailable while account risk state is reconciled.',
      capabilities,
    };
  }

  if (capabilities.marginStopOutActive) {
    return {
      allowed: false,
      code: 'MARGIN_STOP_OUT_ACTIVE',
      reason: 'Margin stop-out is in progress. New exposure is disabled until margin level recovers above 50%.',
      capabilities,
    };
  }

  return { allowed: true, code: 'READY', reason: '', capabilities };
}

export { V2_POLICY_VERSION };
