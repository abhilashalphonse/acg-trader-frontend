import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import { calculateAccountRiskSummary } from '../../../utils/accountRisk.js';
import { DEFAULT_RISK_GUARD_SETTINGS, evaluateRiskGuard } from '../../../utils/riskGuard.js';
import { decimalPlaces, normalizeVolumeToStep } from '../../../utils/tradingCommandNormalization.js';
import {
  effectiveLeverage,
  estimateOpeningRequirement,
  estimateRequiredMargin,
  estimateStopRisk,
  riskSizingSupported,
} from '../../../utils/tradingRisk.js';
import { formatInstrumentPrice, formatSpreadDisplay, instrumentPipSize } from '../../../utils/instrumentFormatting.js';
import { effectiveTradePlan, validateTradePlanForExecution } from '../../../utils/tradePlanExecution.js';
import { estimateExecutionPrice, resolveExecutionPreview } from '../../../utils/executionPricing.js';
import { deriveAccountCapabilities, protectionRequirement } from '../../../utils/accountCapabilities.js';

const ORDER_TYPES = [
  ['market', 'Market'],
  ['limit', 'Limit'],
  ['stop', 'Stop'],
  ['stop-limit', 'Stop Limit'],
];

const RISK_PRESETS = [0.25, 0.5, 1];
const LOT_PRESETS = [0.01, 0.1, 0.5, 1];

function finiteQuote(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function validProtectionPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatCommission(perLot, rate) {
  const percentage = Number(rate);
  if (Number.isFinite(percentage) && percentage > 0) return `${(percentage * 100).toFixed(3)}%/side`;
  const number = Number(perLot);
  return Number.isFinite(number) ? `${number.toFixed(2)}/lot/side` : '—';
}

function money(value, currency = 'USD', compact = false) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      notation: compact && Math.abs(numeric) >= 10000 ? 'compact' : 'standard',
      minimumFractionDigits: compact && Math.abs(numeric) >= 10000 ? 1 : 2,
      maximumFractionDigits: compact && Math.abs(numeric) >= 10000 ? 1 : 2,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency || ''}`.trim();
  }
}

function FieldMetric({ label, value, tone = 'default' }) {
  const toneClass = tone === 'danger'
    ? 'text-[#FF6F7A]'
    : tone === 'success'
      ? 'text-[#42D7A1]'
      : tone === 'accent'
        ? 'text-[#195be1]'
        : 'text-[#F0F4F7]';
  return (
    <div className="min-w-0">
      <span className="block text-[9px] font-semibold uppercase tracking-[0.06em] text-[#73808B]">{label}</span>
      <strong className={`mt-1 block truncate font-mono text-[12px] font-bold tabular-nums tracking-[-0.02em] ${toneClass}`}>{value}</strong>
    </div>
  );
}


export default function DesktopOrderTicket({
  market,
  account = {},
  lots = 0.1,
  onLotsChange = () => {},
  sizingMode = 'lots',
  onSizingModeChange = () => {},
  riskPercent = 0.5,
  onRiskPercentChange = () => {},
  orderType = 'market',
  onOrderTypeChange = () => {},
  tradePlan,
  onStartPlan = () => {},
  onCancelPlan = () => {},
  onExecutePlan = () => {},
  onManualOrder = () => {},
  onTradePlanChange = () => {},
  exposureAllowed = true,
  exposureBlockReason = 'New exposure is temporarily unavailable',
  markets = [],
  positions = [],
  positionHistory = [],
  riskGuardSettings = DEFAULT_RISK_GUARD_SETTINGS,
  onRiskGuardSettingsChange = () => {},
}) {
  const [lotInput, setLotInput] = useState(String(lots));
  const [lotFocused, setLotFocused] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [protectionMode, setProtectionMode] = useState({ sl: 'price', tp: 'price' });
  const [riskGuardOpen, setRiskGuardOpen] = useState(false);
  const [protectionDraft, setProtectionDraft] = useState(null);
  const skipProtectionCommitRef = useRef(false);
  const [pendingPriceDraft, setPendingPriceDraft] = useState(null);
  const skipPendingPriceCommitRef = useRef(false);
  const [riskInput, setRiskInput] = useState(String(riskPercent));
  const [riskInputFocused, setRiskInputFocused] = useState(false);
  const skipRiskCommitRef = useRef(false);

  const volumeStep = Math.max(Number(market?.volumeStep) || 0.01, 0.00000001);
  const minVolume = Math.max(Number(market?.minVolume) || volumeStep, volumeStep);
  const maxVolume = Math.max(Number(market?.maxVolume) || 100, minVolume);
  const lotDecimals = Math.min(8, Math.max(0, decimalPlaces(market?.volumeStep ?? volumeStep)));
  const normalizedLots = normalizeVolumeToStep(lots, market, { rounding: 'nearest' });
  const currency = account?.currency || 'USD';

  const executableQuote = finiteQuote(market?.bid)
    && finiteQuote(market?.ask)
    && Number(market?.ask) >= Number(market?.bid)
    && market?.isStale !== true
    && market?.sessionOpen !== false
    && !['WAITING', 'DISCONNECTED', 'ERROR', 'DISABLED', 'STALE'].includes(String(market?.marketState || '').toUpperCase());

  const previewPlan = useMemo(
    () => tradePlan ? effectiveTradePlan(tradePlan, market) : null,
    [market, tradePlan],
  );

  const executionPreview = useMemo(
    () => resolveExecutionPreview({
      plan: previewPlan,
      riskPercent,
      manualLots: previewPlan?.manualLots ?? normalizedLots,
      account,
      instrument: market,
    }),
    [account, market, normalizedLots, previewPlan, riskPercent],
  );
  const executionPlan = executionPreview.plan;
  const executionSizing = executionPreview.sizing;

  const effectiveExecutionLots = Number.isFinite(Number(executionSizing?.lots))
    ? Number(executionSizing.lots)
    : normalizedLots;

  const planMetrics = useMemo(() => {
    if (!executionPlan) return null;
    const pip = instrumentPipSize(market);
    const orderTypeName = String(executionPlan.orderType || '').toLowerCase();
    const entry = validProtectionPrice(
      executionPlan.pending && orderTypeName === 'stop-limit'
        ? executionPlan.limitPrice
        : executionPlan.entry,
    );
    const sl = validProtectionPrice(executionPlan.sl);
    const tp = validProtectionPrice(executionPlan.tp);
    const slPips = [entry, sl, pip].every(Number.isFinite) && pip > 0 ? Math.abs(entry - sl) / pip : null;
    const tpPips = [entry, tp, pip].every(Number.isFinite) && pip > 0 ? Math.abs(tp - entry) / pip : null;
    const calculatedLots = effectiveExecutionLots;
    const riskPlan = { ...executionPlan, entry };
    const riskAmount = estimateStopRisk(riskPlan, calculatedLots, market, currency);
    const requiredMargin = estimateRequiredMargin(entry, calculatedLots, market, account);
    const reward = Number.isFinite(tp) && Number.isFinite(entry)
      ? estimateStopRisk({ ...riskPlan, sl: tp }, calculatedLots, market, currency)
      : null;
    const rr = Number.isFinite(slPips) && slPips > 0 && Number.isFinite(tpPips) ? tpPips / slPips : null;

    return {
      lots: calculatedLots,
      slPips,
      tpPips,
      riskAmount,
      reward,
      rr,
      requiredMargin,
      riskSizing: executionSizing?.riskSizing || null,
    };
  }, [account, currency, effectiveExecutionLots, executionPlan, executionSizing?.riskSizing, market]);

  const previewMargin = useMemo(() => {
    const side = String(executionPlan?.side || '').toLowerCase();
    const fallbackPrice = side === 'sell' ? Number(market?.bid) : Number(market?.ask);
    const orderTypeName = String(executionPlan?.orderType || '').toLowerCase();
    const reference = executionPlan?.pending && orderTypeName === 'stop-limit'
      ? executionPlan?.limitPrice
      : executionPlan?.entry;
    const price = Number(reference ?? fallbackPrice);
    return estimateRequiredMargin(price, effectiveExecutionLots, market, account);
  }, [account, effectiveExecutionLots, executionPlan, market]);

  const previewRequirement = useMemo(() => {
    const side = String(executionPlan?.side || '').toLowerCase();
    const fallbackPrice = side === 'sell' ? Number(market?.bid) : Number(market?.ask);
    const orderTypeName = String(executionPlan?.orderType || '').toLowerCase();
    const reference = executionPlan?.pending && orderTypeName === 'stop-limit'
      ? executionPlan?.limitPrice
      : executionPlan?.entry;
    const price = Number(reference ?? fallbackPrice);
    return estimateOpeningRequirement(price, effectiveExecutionLots, market, account);
  }, [account, effectiveExecutionLots, executionPlan, market]);

  const freeMargin = Number(account?.freeMargin);
  const freeAfter = Number.isFinite(freeMargin) && Number.isFinite(previewRequirement) ? freeMargin - previewRequirement : null;
  const challenge = useMemo(
    () => calculateAccountRiskSummary(account, planMetrics?.riskAmount || 0),
    [account, planMetrics?.riskAmount],
  );

  const riskSupported = riskSizingSupported(market, currency);
  const activeSizingMode = executionPlan?.sizingMode || sizingMode;
  const displayedLots = activeSizingMode === 'risk' && Number.isFinite(effectiveExecutionLots)
    ? effectiveExecutionLots
    : normalizedLots;

  useEffect(() => {
    if (!lotFocused) setLotInput(Number(displayedLots).toFixed(lotDecimals));
  }, [displayedLots, lotDecimals, lotFocused]);

  useEffect(() => {
    if (!riskInputFocused) setRiskInput(String(riskPercent));
  }, [riskInputFocused, riskPercent]);

  const accountCapabilities = deriveAccountCapabilities(account);
  const planProtection = executionPlan
    ? protectionRequirement({
      account,
      sizingMode: activeSizingMode,
      stopLoss: executionPlan.sl,
    })
    : { valid: true, message: null };
  const riskSizingBlocked = activeSizingMode === 'risk' && executionSizing?.canExecute === false;
  const marginBlocked = activeSizingMode === 'lots'
    && Number.isFinite(previewRequirement)
    && Number.isFinite(freeMargin)
    && previewRequirement > freeMargin + 1e-8;
  const planValidation = executionPlan ? validateTradePlanForExecution(executionPlan, market, { preserveEntry: true }) : { valid: true, code: 'NO_PLAN', message: null };
  const riskGuard = useMemo(() => evaluateRiskGuard({
    account,
    positions,
    positionHistory,
    markets,
    proposedRisk: planMetrics?.riskAmount ?? null,
    settings: riskGuardSettings,
  }), [account, markets, planMetrics?.riskAmount, positionHistory, positions, riskGuardSettings]);

  const canSubmit = executableQuote
    && exposureAllowed
    && (activeSizingMode !== 'risk' || riskSupported)
    && !riskSizingBlocked
    && !marginBlocked
    && planValidation.valid
    && planProtection.valid
    && riskGuard.allowed;

  const spreadDisplay = useMemo(
    () => formatSpreadDisplay(market?.bid, market?.ask, market),
    [market],
  );

  const riskBufferUsage = challenge.remainingDaily > 0 && Number.isFinite(planMetrics?.riskAmount)
    ? (planMetrics.riskAmount / challenge.remainingDaily) * 100
    : null;

  let warning = null;
  if (riskGuard.blocks[0]?.message) warning = riskGuard.blocks[0].message;
  else if (!exposureAllowed) warning = exposureBlockReason;
  else if (!executableQuote) {
    if (market?.sessionOpen === false) warning = 'Market session is closed.';
    else if (market?.isStale) warning = 'Quote is stale. New exposure is disabled.';
    else if (Number(market?.ask) < Number(market?.bid)) warning = 'Executable quote book is invalid.';
    else warning = 'Waiting for an executable quote.';
  } else if (!planValidation.valid) {
    warning = planValidation.message || 'Review this order before submitting.';
  } else if (!planProtection.valid) {
    warning = planProtection.message;
  } else if (activeSizingMode === 'risk' && !riskSupported) {
    warning = 'Risk % sizing is unavailable because this instrument P&L cannot be converted safely to the account currency.';
  } else if (executionSizing?.blockReason === 'INSUFFICIENT_MARGIN') {
    warning = `Opening requirement ${money(planMetrics.riskSizing.totalRequirement, currency)} exceeds free margin ${money(planMetrics.riskSizing.freeMargin, currency)}.`;
  } else if (executionSizing?.blockReason === 'MAX_VOLUME') {
    warning = 'Selected risk requires more than the instrument maximum lot size.';
  } else if (executionSizing?.blockReason === 'MIN_VOLUME') {
    warning = 'Selected risk is smaller than the instrument minimum lot size.';
  } else if (marginBlocked) {
    warning = `Opening requirement ${money(previewRequirement, currency)} exceeds free margin ${money(freeMargin, currency)}.`;
  } else if (Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50) {
    warning = `Planned stop uses ${riskBufferUsage.toFixed(0)}% of the remaining daily-loss buffer.`;
  }

  const setLots = value => {
    const next = normalizeVolumeToStep(value, market, { rounding: 'nearest' });
    onLotsChange(next);
    onSizingModeChange('lots');
    setLotInput(Number(next).toFixed(lotDecimals));
    if (tradePlan) onTradePlanChange({ manualLots: next, sizingMode: 'lots' });
  };

  const commitLotInput = () => {
    if (activeSizingMode === 'risk') {
      setLotInput(Number(displayedLots).toFixed(lotDecimals));
      setLotFocused(false);
      return;
    }
    const numeric = Number(String(lotInput).trim());
    setLots(Number.isFinite(numeric) && numeric > 0 ? numeric : normalizedLots);
    setLotFocused(false);
  };

  const setMode = mode => {
    const nextMode = mode === 'risk' ? 'risk' : 'lots';
    onSizingModeChange(nextMode);

    if (!tradePlan) {
      if (nextMode === 'lots') setActiveTool(current => current === 'sl' ? null : current);
      return;
    }

    if (nextMode === 'risk') {
      const patch = { sizingMode: 'risk', manualLots: normalizedLots };
      if (!Number.isFinite(validProtectionPrice(tradePlan.sl))) {
        const defaultSl = defaultProtectionPrice('sl');
        if (Number.isFinite(defaultSl)) patch.sl = defaultSl;
      }
      onTradePlanChange({ ...patch, stage: 'ready' });
      setActiveTool('sl');
      return;
    }

    onTradePlanChange({ sizingMode: 'lots', manualLots: normalizedLots });
  };

  const setRisk = value => {
    const next = Math.max(0.1, Math.min(5, Number(value) || 0.1));
    setRiskInput(String(next));
    onRiskPercentChange(next);
    setMode('risk');
  };

  const commitRiskInput = () => {
    if (skipRiskCommitRef.current) {
      skipRiskCommitRef.current = false;
      setRiskInput(String(riskPercent));
      setRiskInputFocused(false);
      return;
    }
    const numeric = Number(String(riskInput).trim());
    setRisk(Number.isFinite(numeric) ? numeric : riskPercent);
    setRiskInputFocused(false);
  };

  const clickSide = side => {
    if (!market?.symbol) return;

    if (pendingPlan) {
      if (canSubmit && selectedSide === side) onExecutePlan();
      return;
    }

    if (activeSizingMode === 'risk') {
      if (!executableQuote || !exposureAllowed || !riskSupported || !riskGuard.allowed) return;
      onStartPlan(side, orderType === 'market' ? 'market' : orderType, { protection: 'sl' });
      setActiveTool('sl');
      return;
    }

    if (!canSubmit) return;
    if (orderType !== 'market') {
      onStartPlan(side, orderType, {
        protection: accountCapabilities.stopLossRequiredForManualLots ? 'sl' : 'none',
      });
      if (accountCapabilities.stopLossRequiredForManualLots) setActiveTool('sl');
      return;
    }
    if (accountCapabilities.stopLossRequiredForManualLots) {
      onStartPlan(side, 'market', { protection: 'sl' });
      setActiveTool('sl');
      return;
    }
    onManualOrder({
      side,
      lots: normalizedLots,
      price: side === 'buy' ? market.ask : market.bid,
      symbol: market.symbol,
    });
  };

  const startProtectedPlan = (side, protection = 'both') => {
    if (!executableQuote || !exposureAllowed) return;
    onStartPlan(side, orderType === 'market' ? 'market' : orderType, { protection });
  };

  const updateProtection = (field, raw) => {
    if (!tradePlan) return;
    if (raw === '' || raw === '.') {
      onTradePlanChange({ [field]: null });
      return;
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) onTradePlanChange({ [field]: numeric, stage: 'ready' });
  };

  const nudgeLots = direction => {
    const baseLots = activeSizingMode === 'risk' && Number.isFinite(displayedLots)
      ? displayedLots
      : normalizedLots;
    const next = direction > 0
      ? Math.min(maxVolume, baseLots + volumeStep)
      : Math.max(minVolume, baseLots - volumeStep);
    setLots(next);
  };

  const pendingPlan = Boolean(tradePlan && !tradePlan.open);
  const selectedSide = String(tradePlan?.side || '').toLowerCase();
  const riskSizing = planMetrics?.riskSizing || null;
  const riskCalculatedLots = Number(riskSizing?.requestedLots);
  const riskRequestedRaw = Number(riskSizing?.requestedRaw);
  const riskExecutableLots = (() => {
    if (!riskSizing) return null;
    if (riskSizing.blockReason === 'INSUFFICIENT_MARGIN') {
      const marginLots = Number(riskSizing.maxMarginLots);
      return Number.isFinite(marginLots) && marginLots >= minVolume ? marginLots : null;
    }
    const lots = Number(riskSizing.requestedLots);
    return Number.isFinite(lots) && lots >= minVolume ? lots : null;
  })();
  const riskTargetLoss = Number.isFinite(Number(account?.equity))
    ? Number(account.equity) * Number(riskPercent) / 100
    : null;
  const riskNeedsCap = Boolean(riskSizing?.blockReason === 'MAX_VOLUME' || riskSizing?.blockReason === 'INSUFFICIENT_MARGIN' || riskSizing?.blockReason === 'MIN_VOLUME');
  const liveLabel = market?.sessionOpen === false ? 'CLOSED' : market?.live ? 'LIVE' : market?.isStale ? 'STALE' : String(market?.marketState || 'WAITING').toUpperCase();
  const hasStopLoss = Number.isFinite(validProtectionPrice(tradePlan?.sl));
  const hasTakeProfit = Number.isFinite(validProtectionPrice(tradePlan?.tp));
  const orderFamily = orderType === 'market' ? 'market' : 'pending';

  const chooseOrderFamily = family => {
    if (family === 'market') onOrderTypeChange('market');
    else if (orderType === 'market') onOrderTypeChange('limit');
    if (tradePlan) onCancelPlan();
  };

  const changePendingType = nextType => {
    onOrderTypeChange(nextType);
    if (!tradePlan || !tradePlan.pending) return;

    const side = String(tradePlan.side || '').toLowerCase();
    const quote = Number(side === 'buy' ? market?.ask : market?.bid);
    if (!Number.isFinite(quote) || quote <= 0) {
      onTradePlanChange({ orderType: nextType, stage: 'ready' });
      return;
    }

    const pip = instrumentPipSize(market);
    const safePip = Number.isFinite(Number(pip)) && Number(pip) > 0 ? Number(pip) : quote * 0.0001;
    const oldEntry = Number(tradePlan.entry);
    const oldSl = validProtectionPrice(tradePlan.sl);
    const oldTp = validProtectionPrice(tradePlan.tp);
    const slDistance = Number.isFinite(oldEntry) && Number.isFinite(oldSl) ? Math.abs(oldEntry - oldSl) : null;
    const tpDistance = Number.isFinite(oldEntry) && Number.isFinite(oldTp) ? Math.abs(oldTp - oldEntry) : null;

    let entry = quote;
    if (nextType === 'limit') entry = side === 'buy' ? quote - 5 * safePip : quote + 5 * safePip;
    else entry = side === 'buy' ? quote + 5 * safePip : quote - 5 * safePip;

    const limitPrice = nextType === 'stop-limit'
      ? (side === 'buy' ? entry + 1.5 * safePip : entry - 1.5 * safePip)
      : null;
    const sl = Number.isFinite(slDistance)
      ? (side === 'buy' ? entry - slDistance : entry + slDistance)
      : tradePlan.sl;
    const tp = Number.isFinite(tpDistance)
      ? (side === 'buy' ? entry + tpDistance : entry - tpDistance)
      : tradePlan.tp;

    onTradePlanChange({
      orderType: nextType,
      pending: true,
      entry,
      limitPrice,
      sl,
      tp,
      stage: 'ready',
    });
  };

  const distanceUnit = String(market?.assetClass || '').toUpperCase() === 'FOREX' ? 'pips' : 'pts';
  const pipSize = instrumentPipSize(market);

  const protectionReferenceEntry = () => {
    if (!tradePlan) return null;
    const plan = executionPlan || tradePlan;
    const type = String(plan?.orderType || '').toLowerCase();
    const reference = plan?.pending && type === 'stop-limit' ? plan?.limitPrice : plan?.entry;
    const numeric = Number(reference);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  };

  const defaultProtectionPrice = field => {
    if (!tradePlan) return null;
    const entry = protectionReferenceEntry();
    if (!Number.isFinite(entry) || !Number.isFinite(pipSize) || pipSize <= 0) return null;
    const distance = field === 'sl' ? 10 : 20;
    const side = String(tradePlan.side || '').toLowerCase();
    const direction = field === 'sl'
      ? (side === 'buy' ? -1 : 1)
      : (side === 'buy' ? 1 : -1);
    return entry + direction * distance * pipSize;
  };

  const enableProtection = field => {
    if (!tradePlan) {
      setActiveTool(field);
      return;
    }
    if (!Number.isFinite(validProtectionPrice(tradePlan?.[field]))) {
      const price = defaultProtectionPrice(field);
      if (Number.isFinite(price)) onTradePlanChange({ [field]: price, stage: 'ready' });
    }
    setProtectionDraft(null);
    setActiveTool(current => current === field ? null : field);
  };

  const removeProtection = field => {
    if (!tradePlan) return;
    if (field === 'sl' && planProtection.required) return;
    const other = field === 'sl' ? 'tp' : 'sl';
    if (!Number.isFinite(validProtectionPrice(tradePlan?.[other]))) onCancelPlan();
    else onTradePlanChange({ [field]: null, stage: 'ready' });
    setProtectionDraft(null);
    setActiveTool(null);
  };

  const protectionDistance = field => field === 'sl' ? planMetrics?.slPips : planMetrics?.tpPips;
  const protectionMoney = field => field === 'sl' ? planMetrics?.riskAmount : planMetrics?.reward;

  const protectionValue = (field, mode) => {
    if (!tradePlan || !Number.isFinite(validProtectionPrice(tradePlan?.[field]))) return '';
    if (mode === 'price') return formatInstrumentPrice(tradePlan[field], market, '');
    if (mode === 'distance') {
      const distance = Number(protectionDistance(field));
      return Number.isFinite(distance) ? distance.toFixed(1) : '';
    }
    const amount = Number(protectionMoney(field));
    return Number.isFinite(amount) ? Math.abs(amount).toFixed(2) : '';
  };

  const protectionDraftKey = (field, mode) => `${field}:${mode}`;

  const sanitizeProtectionInput = value => {
    const normalized = String(value ?? '').replace(',', '.').replace(/[^0-9.]/g, '');
    const point = normalized.indexOf('.');
    return point < 0
      ? normalized
      : normalized.slice(0, point + 1) + normalized.slice(point + 1).replace(/\./g, '');
  };

  const pendingPriceValue = field => formatInstrumentPrice(tradePlan?.[field], market, '');

  const beginPendingPriceEdit = field => {
    skipPendingPriceCommitRef.current = false;
    setPendingPriceDraft({ field, value: pendingPriceValue(field) });
  };

  const discardPendingPriceEdit = () => {
    skipPendingPriceCommitRef.current = true;
    setPendingPriceDraft(null);
  };

  const commitPendingPriceInput = (field, rawValue) => {
    if (skipPendingPriceCommitRef.current) {
      skipPendingPriceCommitRef.current = false;
      setPendingPriceDraft(null);
      return;
    }
    const raw = String(rawValue ?? '').trim();
    const numeric = Number(raw);
    if (raw && raw !== '.' && Number.isFinite(numeric) && numeric > 0) {
      onTradePlanChange({ [field]: numeric, stage: 'ready' });
    }
    setPendingPriceDraft(null);
  };

  const beginProtectionEdit = (field, mode) => {
    skipProtectionCommitRef.current = false;
    setProtectionDraft({
      key: protectionDraftKey(field, mode),
      value: protectionValue(field, mode),
    });
  };

  const discardProtectionEdit = () => {
    skipProtectionCommitRef.current = true;
    setProtectionDraft(null);
  };

  const commitProtectionInput = (field, mode, rawValue) => {
    if (!tradePlan) {
      setProtectionDraft(null);
      return;
    }

    if (skipProtectionCommitRef.current) {
      skipProtectionCommitRef.current = false;
      setProtectionDraft(null);
      return;
    }

    const raw = String(rawValue ?? '').trim();
    const numeric = Number(raw);
    if (!raw || raw === '.' || !Number.isFinite(numeric) || numeric <= 0) {
      setProtectionDraft(null);
      return;
    }

    if (mode === 'price') {
      updateProtection(field, raw);
      setProtectionDraft(null);
      return;
    }

    const entry = protectionReferenceEntry();
    const side = String(tradePlan.side || '').toLowerCase();
    if (!Number.isFinite(entry) || !Number.isFinite(pipSize) || pipSize <= 0 || (side !== 'buy' && side !== 'sell')) {
      setProtectionDraft(null);
      return;
    }

    let distance = numeric;
    if (mode === 'money') {
      if (field === 'sl' && activeSizingMode === 'risk') {
        const equity = Number(account?.equity);
        if (Number.isFinite(equity) && equity > 0) {
          onRiskPercentChange(Math.max(0.01, Math.min(5, (numeric / equity) * 100)));
        }
        setProtectionDraft(null);
        return;
      }

      const oneUnitPrice = side === 'buy' ? entry - pipSize : entry + pipSize;
      const perUnit = estimateStopRisk(
        { ...tradePlan, entry, sl: oneUnitPrice },
        effectiveExecutionLots,
        market,
        currency,
      );
      if (!Number.isFinite(perUnit) || perUnit <= 0) {
        setProtectionDraft(null);
        return;
      }
      distance = numeric / perUnit;
    }

    const direction = field === 'sl'
      ? (side === 'buy' ? -1 : 1)
      : (side === 'buy' ? 1 : -1);
    const price = entry + direction * distance * pipSize;
    if (Number.isFinite(price) && price > 0) {
      onTradePlanChange({ [field]: price, stage: 'ready' });
    }
    setProtectionDraft(null);
  };

  const applyRewardRatio = ratio => {
    if (!tradePlan || !hasStopLoss || !Number.isFinite(Number(planMetrics?.slPips))) return;
    const entry = protectionReferenceEntry();
    const side = String(tradePlan.side || '').toLowerCase();
    if (!Number.isFinite(entry) || !Number.isFinite(pipSize) || pipSize <= 0) return;
    const tpDistance = Number(planMetrics.slPips) * ratio;
    const price = side === 'buy' ? entry + tpDistance * pipSize : entry - tpDistance * pipSize;
    if (Number.isFinite(price) && price > 0) {
      onTradePlanChange({ tp: price, stage: 'ready' });
      setActiveTool('tp');
    }
  };

  const liveLotInput = event => {
    const raw = event.target.value.replace(/[^0-9.]/g, '');
    setLotInput(raw);
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const next = normalizeVolumeToStep(numeric, market, { rounding: 'nearest' });
    onLotsChange(next);
    onSizingModeChange('lots');
    if (tradePlan) onTradePlanChange({ manualLots: next, sizingMode: 'lots' });
  };

  const executionButtonPrice = side => {
    if (pendingPlan && selectedSide === side) return tradePlan?.entry;
    const preview = estimateExecutionPrice(market, side, effectiveExecutionLots);
    return preview?.price ?? (side === 'buy' ? market?.ask : market?.bid);
  };

  const executionButtonLabel = side => {
    if (!pendingPlan || selectedSide !== side) {
      if (activeSizingMode === 'risk') return side === 'buy' ? 'Buy · Set SL' : 'Sell · Set SL';
      return side === 'buy' ? 'Buy' : 'Sell';
    }
    if (tradePlan?.editingOrderId) return 'Update order';
    if (!tradePlan?.pending) {
      if (activeSizingMode === 'risk') return side === 'buy' ? 'Confirm buy' : 'Confirm sell';
      return side === 'buy' ? 'Execute buy' : 'Execute sell';
    }
    const typeLabel = String(tradePlan?.orderType || orderType || '').replace('-', ' ');
    return `Place ${side} ${typeLabel}`;
  };

  const sideButtonDisabled = side => {
    if (pendingPlan) return !canSubmit || selectedSide !== side;
    if (activeSizingMode === 'risk') {
      return !executableQuote || !exposureAllowed || !riskSupported || !riskGuard.allowed;
    }
    return !canSubmit;
  };

  const renderProtectionEditor = field => {
    const enabled = Number.isFinite(validProtectionPrice(tradePlan?.[field]));
    const mode = protectionMode[field];
    const isSl = field === 'sl';
    const amount = Number(protectionMoney(field));
    const distance = Number(protectionDistance(field));
    return (
      <div className="mt-1.5 rounded-md border border-white/[0.06] bg-black/45 p-2">
        <div className="grid grid-cols-3 gap-1">
          {[
            ['price', 'Price'],
            ['distance', distanceUnit],
            ['money', isSl ? 'Loss $' : 'Profit $'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setProtectionDraft(null);
                setProtectionMode(current => ({ ...current, [field]: id }));
              }}
              className={`h-7 rounded text-[8px] font-bold ${mode === id ? 'bg-white/[0.07] text-[#E6EDF3]' : 'text-[#687c90] hover:bg-white/[0.03] hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-white/[0.06] bg-[#07090B] px-2">
          <input
            value={protectionDraft?.key === protectionDraftKey(field, mode) ? protectionDraft.value : protectionValue(field, mode)}
            onFocus={event => {
              beginProtectionEdit(field, mode);
              requestAnimationFrame(() => event.currentTarget.select());
            }}
            onChange={event => {
              const value = sanitizeProtectionInput(event.target.value);
              setProtectionDraft({ key: protectionDraftKey(field, mode), value });
            }}
            onBlur={event => commitProtectionInput(field, mode, event.currentTarget.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                discardProtectionEdit();
                event.currentTarget.blur();
              }
            }}
            inputMode="decimal"
            className={`h-9 min-w-0 bg-transparent font-mono text-[11px] font-bold outline-none ${isSl ? 'text-[#FF6F7A]' : 'text-[#42D7A1]'}`}
            aria-label={`${isSl ? 'Stop loss' : 'Take profit'} ${mode}`}
          />
          <span className="whitespace-nowrap text-[8px] font-semibold text-[#6F8191]">
            {mode === 'price' ? formatInstrumentPrice(tradePlan?.[field], market) : mode === 'distance' ? distanceUnit : currency}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {mode === 'price' ? (
            <>
              <FieldMetric label={distanceUnit} value={Number.isFinite(distance) ? distance.toFixed(1) : '—'} />
              <FieldMetric
                label={isSl ? 'Loss' : 'Profit'}
                value={Number.isFinite(amount) ? `${isSl ? '-' : '+'}${money(Math.abs(amount), currency)}` : '—'}
                tone={isSl ? 'danger' : 'success'}
              />
            </>
          ) : mode === 'distance' ? (
            <>
              <FieldMetric label="Price" value={enabled ? formatInstrumentPrice(tradePlan?.[field], market) : '—'} />
              <FieldMetric
                label={isSl ? 'Loss' : 'Profit'}
                value={Number.isFinite(amount) ? `${isSl ? '-' : '+'}${money(Math.abs(amount), currency)}` : '—'}
                tone={isSl ? 'danger' : 'success'}
              />
            </>
          ) : (
            <>
              <FieldMetric label="Price" value={enabled ? formatInstrumentPrice(tradePlan?.[field], market) : '—'} />
              <FieldMetric label={distanceUnit} value={Number.isFinite(distance) ? distance.toFixed(1) : '—'} />
            </>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          {isSl && (
            <span className="text-[7px] font-semibold uppercase tracking-[0.08em] text-[#6F8191]">
              {planProtection.required ? 'Required by account / sizing' : 'Optional'}
            </span>
          )}
          <button
            type="button"
            disabled={isSl && planProtection.required}
            onClick={() => removeProtection(field)}
            className="ml-auto h-6 rounded px-2 text-[8px] font-semibold text-[#6F8191] hover:bg-white/[0.03] hover:text-[#E6EDF3] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#6F8191]"
          >
            {isSl && planProtection.required ? 'Required' : 'Remove'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="acg-desktop-order flex h-full min-h-0 flex-col bg-[#0A0C0F]">
      <div className="acg-order-top-tabs grid h-11 shrink-0 grid-cols-2 border-b border-white/[0.05] bg-[#0A0C0F]">
        <button type="button" onClick={() => { chooseOrderFamily('market'); setActiveTool(null); }} className={orderFamily === 'market' ? "relative text-[11px] font-bold text-[#f3f5f7]" : "relative text-[11px] font-semibold text-[#7F8A95] hover:text-white"}>Trade{orderFamily === 'market' && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#195be1]"/>}</button>
        <button type="button" onClick={() => { chooseOrderFamily('pending'); setActiveTool(null); }} className={orderFamily === 'pending' ? "relative text-[11px] font-bold text-[#f3f5f7]" : "relative text-[11px] font-semibold text-[#7F8A95] hover:text-white"}>Pending{orderFamily === 'pending' && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#195be1]"/>}</button>
      </div>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.045] px-3">
        <div className="flex min-w-0 items-center gap-2"><strong className="text-[10px] font-black uppercase tracking-[0.08em] text-[#E6EDF3]">Order</strong><span className="truncate text-[9px] font-semibold text-[#AAB5BF]">{market?.displaySymbol || market?.symbol || '—'}</span><span className={market?.live ? "text-[7px] font-bold text-[#42D7A1]" : market?.isStale ? "text-[7px] font-bold text-[#E7BD58]" : "text-[7px] font-bold text-[#6F8191]"}>● {liveLabel}</span></div>
        <span className="text-[7px] font-semibold text-[#6F8191]">{orderFamily === 'market' ? '1-click' : String(orderType).replace('-', ' ')}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        <div className="acg-order-type-block">
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <strong className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#94A3AF]">Order Type</strong>
            <span className="text-[7px] font-semibold text-[#607181]">{orderFamily === 'market' ? 'Immediate execution' : 'Pending execution'}</span>
          </div>
          {orderFamily === 'market' ? (
            <div className="flex h-10 items-center justify-between rounded-[10px] border border-[#195be1]/45 bg-[#0E131B] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.015)]">
              <strong className="text-[11px] font-bold text-[#f2f5f7]">Market</strong>
              <span className="text-[7px] font-semibold text-[#6f8293]">Bid / Ask</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {ORDER_TYPES.filter(([id]) => id !== 'market').map(([id, label]) => (
                <button key={id} type="button" onClick={() => changePendingType(id)} className={orderType === id ? "h-8 rounded border border-[#195be1]/70 bg-[#10151f] text-[8px] font-bold text-[#e8eef4]" : "h-8 rounded border border-white/[0.06] bg-black text-[8px] font-semibold text-[#6F8191] hover:text-white"}>{label}</button>
              ))}
            </div>
          )}
        </div>

        {orderFamily === 'pending' && pendingPlan && (
          <div className="rounded-[10px] border border-white/[0.05] bg-[#0B0D10] p-2.5">
            <div className={`grid gap-2 ${orderType === 'stop-limit' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <label className="min-w-0">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.06em] text-[#7D90A2]">{orderType === 'limit' ? 'Limit price' : 'Stop price'}</span>
                <input
                  value={pendingPriceDraft?.field === 'entry' ? pendingPriceDraft.value : pendingPriceValue('entry')}
                  onFocus={event => {
                    beginPendingPriceEdit('entry');
                    requestAnimationFrame(() => event.currentTarget.select());
                  }}
                  onChange={event => setPendingPriceDraft({ field: 'entry', value: sanitizeProtectionInput(event.target.value) })}
                  onBlur={event => commitPendingPriceInput('entry', event.currentTarget.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      discardPendingPriceEdit();
                      event.currentTarget.blur();
                    }
                  }}
                  inputMode="decimal"
                  className="h-9 w-full rounded-md border border-white/[0.07] bg-black px-2.5 text-right font-mono text-[11px] font-bold text-[#E6EDF3] outline-none focus:border-[#195be1]"
                  aria-label="Pending entry price"
                />
              </label>
              {orderType === 'stop-limit' && (
                <label className="min-w-0">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.06em] text-[#7D90A2]">Limit price</span>
                  <input
                    value={pendingPriceDraft?.field === 'limitPrice' ? pendingPriceDraft.value : pendingPriceValue('limitPrice')}
                    onFocus={event => {
                      beginPendingPriceEdit('limitPrice');
                      requestAnimationFrame(() => event.currentTarget.select());
                    }}
                    onChange={event => setPendingPriceDraft({ field: 'limitPrice', value: sanitizeProtectionInput(event.target.value) })}
                    onBlur={event => commitPendingPriceInput('limitPrice', event.currentTarget.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        discardPendingPriceEdit();
                        event.currentTarget.blur();
                      }
                    }}
                    inputMode="decimal"
                    className="h-9 w-full rounded-md border border-white/[0.07] bg-black px-2.5 text-right font-mono text-[11px] font-bold text-[#E6EDF3] outline-none focus:border-[#195be1]"
                    aria-label="Stop limit price"
                  />
                </label>
              )}
            </div>

            <div className="mt-2">
              <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.06em] text-[#7D90A2]">Expiry</span>
              <div className="grid grid-cols-3 gap-1">
                {['GTC', 'TODAY', 'SPECIFIED'].map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onTradePlanChange({
                      expiration: value,
                      ...(value === 'SPECIFIED' ? {} : { expirationAt: null }),
                      stage: 'ready',
                    })}
                    className={`h-7 rounded border text-[8px] font-bold ${String(tradePlan?.expiration || 'GTC').toUpperCase() === value ? 'border-[#195be1] bg-[#0d1a22] text-[#195be1]' : 'border-white/[0.06] bg-black text-[#718497] hover:text-white'}`}
                  >
                    {value === 'SPECIFIED' ? 'Specified' : value === 'TODAY' ? 'Today' : 'GTC'}
                  </button>
                ))}
              </div>
              {String(tradePlan?.expiration || 'GTC').toUpperCase() === 'SPECIFIED' && (
                <input
                  type="datetime-local"
                  value={tradePlan?.expirationAt || ''}
                  onChange={event => onTradePlanChange({ expirationAt: event.target.value, stage: 'ready' })}
                  className="mt-1.5 h-8 w-full rounded-md border border-white/[0.07] bg-black px-2 font-mono text-[9px] text-[#DDE6ED] outline-none focus:border-[#195be1]"
                  aria-label="Pending order expiry"
                />
              )}
            </div>
          </div>
        )}

        <div className="rounded-[10px] border border-white/[0.05] bg-[#0B0D10] p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#AAB5BF]">Position size</strong>
            <div className="grid h-7 w-[132px] grid-cols-2 rounded-md border border-white/[0.06] bg-black p-0.5">
              <button
                type="button"
                onClick={() => setMode('lots')}
                className={`rounded text-[8px] font-black ${activeSizingMode === 'lots' ? 'bg-[#151820] text-[#E6EDF3]' : 'text-[#6F8191] hover:text-white'}`}
              >
                Lots
              </button>
              <button
                type="button"
                onClick={() => setMode('risk')}
                disabled={!riskSupported}
                className={`rounded text-[8px] font-black disabled:cursor-not-allowed disabled:opacity-35 ${activeSizingMode === 'risk' ? 'bg-[#0d1a22] text-[#195be1]' : 'text-[#6F8191] hover:text-white'}`}
              >
                Risk %
              </button>
            </div>
          </div>

          {activeSizingMode === 'lots' ? (
            <>
              <div className="grid grid-cols-[38px_minmax(0,1fr)_38px] items-center rounded-[10px] border border-white/[0.05] bg-[#060708]">
                <button type="button" onClick={() => nudgeLots(-1)} className="grid h-10 place-items-center text-[#6F8191] hover:bg-white/[0.025] hover:text-white" aria-label="Decrease lot size"><Minus size={12}/></button>
                <div className="flex items-center justify-center border-x border-white/[0.05]">
                  <input
                    value={lotInput}
                    onFocus={event => { setLotFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                    onChange={liveLotInput}
                    onBlur={commitLotInput}
                    onKeyDown={event => {
                      if (event.key === 'ArrowUp') { event.preventDefault(); nudgeLots(1); }
                      if (event.key === 'ArrowDown') { event.preventDefault(); nudgeLots(-1); }
                      if (event.key === 'Enter') event.currentTarget.blur();
                      if (event.key === 'Escape') { setLotInput(Number(normalizedLots).toFixed(lotDecimals)); event.currentTarget.blur(); }
                    }}
                    className="h-11 w-24 bg-transparent text-center font-mono text-[18px] font-black tabular-nums tracking-[-0.03em] text-[#F3F6F8] outline-none"
                    inputMode="decimal"
                    aria-label="Lot size"
                  />
                  <span className="ml-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#6F8191]">lots</span>
                </div>
                <button type="button" onClick={() => nudgeLots(1)} className="grid h-10 place-items-center text-[#6F8191] hover:bg-white/[0.025] hover:text-white" aria-label="Increase lot size"><Plus size={12}/></button>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {LOT_PRESETS.filter(value => value >= minVolume && value <= maxVolume).map(value => (
                  <button key={value} type="button" onClick={() => setLots(value)} className={`h-7 rounded border font-mono text-[8px] font-bold ${Math.abs(normalizedLots-value)<volumeStep/2 ? 'border-[#195be1] bg-[#0d1a22] text-[#195be1]' : 'border-white/[0.06] text-[#687c90] hover:text-white'}`}>{value.toFixed(Math.max(2,lotDecimals))}</button>
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between px-0.5 text-[8px]">
                <span className="text-[#6F8191]">Range {minVolume}–{maxVolume} lots</span>
                <span className={accountCapabilities.manualLotWithoutStopLoss ? 'font-semibold text-[#195be1]' : 'font-semibold text-[#E7BD58]'}>
                  {accountCapabilities.manualLotWithoutStopLoss ? 'SL optional' : 'SL required'}
                </span>
              </div>
            </>
          ) : (
            <div className="border-t border-white/[0.06] pt-2">
              <div className="grid grid-cols-4 gap-1">
                {RISK_PRESETS.map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRisk(value)}
                    className={`h-8 rounded border text-[8px] font-black ${Math.abs(riskPercent-value)<0.001 ? 'border-[#195be1] bg-[#0d1a22] text-[#195be1]' : 'border-white/[0.06] bg-black text-[#7d90a2] hover:text-white'}`}
                  >
                    {value.toFixed(2)}%
                  </button>
                ))}
                <label className="flex h-8 items-center rounded border border-white/[0.06] bg-black px-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={riskInput}
                    onFocus={event => { skipRiskCommitRef.current = false; setRiskInputFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                    onChange={event => setRiskInput(sanitizeProtectionInput(event.target.value))}
                    onBlur={commitRiskInput}
                    onKeyDown={event => {
                      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
                      else if (event.key === 'Escape') {
                        event.preventDefault();
                        skipRiskCommitRef.current = true;
                        setRiskInput(String(riskPercent));
                        event.currentTarget.blur();
                      }
                    }}
                    className="w-full bg-transparent text-center font-mono text-[9px] font-black text-[#E6EDF3] outline-none"
                  />
                  <span className="text-[7px] text-[#6F8191]">%</span>
                </label>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1">
                <div className="rounded border border-[#195be1]/45 bg-[#0d1a22]/30 px-2 py-1.5">
                  <span className="block text-[7px] font-semibold uppercase tracking-[0.05em] text-[#6F8191]">Risk</span>
                  <strong className="mt-0.5 block font-mono text-[10px] text-[#195be1]">{Number(riskPercent).toFixed(2)}% · {Number.isFinite(riskTargetLoss) ? money(riskTargetLoss, currency) : '—'}</strong>
                </div>
                <div className="rounded border border-white/[0.05] bg-black px-2 py-1.5">
                  <span className="block text-[7px] font-semibold uppercase tracking-[0.05em] text-[#6F8191]">Calculated size</span>
                  <strong className="mt-0.5 block font-mono text-[10px] text-[#E6EDF3]">{Number.isFinite(riskRequestedRaw) ? `${riskRequestedRaw.toFixed(Math.max(2,lotDecimals))} lots` : Number.isFinite(riskCalculatedLots) ? `${riskCalculatedLots.toFixed(Math.max(2,lotDecimals))} lots` : '—'}</strong>
                </div>
                <div className="rounded border border-[#5e2932] bg-[#14090c] px-2 py-1.5">
                  <span className="block text-[7px] font-semibold uppercase tracking-[0.05em] text-[#8f6970]">Stop loss</span>
                  <strong className="mt-0.5 block text-[9px] font-black text-[#FF6F7A]">{hasStopLoss ? 'SET' : 'REQUIRED'}</strong>
                </div>
              </div>

              {!tradePlan ? (
                <p className="mt-2 rounded border border-white/[0.05] bg-black/40 px-2 py-1.5 text-[8px] leading-4 text-[#7f93a6]">
                  Choose risk %, then press BUY or SELL. ACG Trader will open SL placement and calculate lots from the stop distance.
                </p>
              ) : (
                <p className="mt-2 rounded border border-[#195be1]/35 bg-[#0d1a22]/20 px-2 py-1.5 text-[8px] leading-4 text-[#8da9bd]">
                  Move or type the stop loss. Position size, SL loss and required margin update automatically.
                </p>
              )}

              {riskNeedsCap && (
                <div className="mt-1.5 rounded border border-[#5a4523] bg-[#171208] px-2 py-1.5 text-[8px] leading-3.5 text-[#d8b867]">
                  {riskSizing?.blockReason === 'MAX_VOLUME'
                    ? `Selected risk requires more than the instrument maximum. Requested size is ${Number.isFinite(riskRequestedRaw) ? riskRequestedRaw.toFixed(Math.max(2,lotDecimals)) : '—'} lots.`
                    : riskSizing?.blockReason === 'INSUFFICIENT_MARGIN'
                      ? `Selected risk needs more margin than available. Margin-supported size is about ${Number.isFinite(riskExecutableLots) ? riskExecutableLots.toFixed(Math.max(2,lotDecimals)) : '—'} lots.`
                      : `Selected risk is below the instrument minimum. Minimum size is ${Number.isFinite(riskExecutableLots) ? riskExecutableLots.toFixed(Math.max(2,lotDecimals)) : '—'} lots.`}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-[10px] border border-white/[0.05] bg-[#0B0D10] p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <strong className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#AAB5BF]">Protection</strong>
            {pendingPlan && <div className="flex items-center gap-1.5"><span className={`text-[8px] font-black ${selectedSide === 'buy' ? 'text-[#42D7A1]' : 'text-[#FF6F7A]'}`}>{selectedSide === 'buy' ? 'LONG' : 'SHORT'}</span><button type="button" onClick={onCancelPlan} className="grid size-5 place-items-center rounded text-[#6F8191] hover:bg-white/[0.04] hover:text-white" aria-label="Cancel trade plan"><X size={10}/></button></div>}
          </div>

          <div className="acg-protection-grid grid grid-cols-2 gap-2">
            <div className={`rounded-md border ${activeTool === 'sl' ? 'col-span-2 ' : ''}${hasStopLoss ? 'border-[#5e2932]' : 'border-white/[0.05]'} bg-[#080A0C] px-2.5 py-2`}>
              <div className="flex h-7 items-center justify-between">
                <button type="button" onClick={() => enableProtection('sl')} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={`grid size-3.5 place-items-center rounded border text-[8px] ${hasStopLoss ? 'border-[#8e3b49] bg-[#331017] text-[#FF6F7A]' : 'border-white/[0.12] text-transparent'}`}>✓</span>
                  <span className="text-[10px] font-bold text-[#E6EDF3]">Stop Loss</span>
                  <span className="shrink-0 text-[7px] font-semibold uppercase tracking-[0.06em] text-[#6F8191]">{planProtection.required ? 'Required' : 'Optional'}</span>
                  {hasStopLoss && <span className="truncate font-mono text-[8px] text-[#FF6F7A]">{Number.isFinite(planMetrics?.riskAmount) ? `-${money(Math.abs(planMetrics.riskAmount),currency)}` : '—'}</span>}
                </button>
                <button type="button" onClick={() => enableProtection('sl')} className="text-[8px] font-bold text-[#8295A7] hover:text-white">{hasStopLoss ? 'Edit' : 'Add'}</button>
              </div>
              {activeTool === 'sl' && !tradePlan && (
                <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-white/[0.05] pt-1.5">
                  <button type="button" onClick={() => startProtectedPlan('sell','sl')} className="h-8 rounded border border-[#5b252e] text-[8px] font-bold text-[#FF6F7A]">Plan short</button>
                  <button type="button" onClick={() => startProtectedPlan('buy','sl')} className="h-8 rounded border border-[#1c5c47] text-[8px] font-bold text-[#42D7A1]">Plan long</button>
                </div>
              )}
              {activeTool === 'sl' && tradePlan && renderProtectionEditor('sl')}
            </div>

            <div className={`rounded-md border ${activeTool === 'tp' ? 'col-span-2 ' : ''}${hasTakeProfit ? 'border-[#245b48]' : 'border-white/[0.05]'} bg-[#080A0C] px-2.5 py-2`}>
              <div className="flex h-7 items-center justify-between">
                <button type="button" onClick={() => enableProtection('tp')} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={`grid size-3.5 place-items-center rounded border text-[8px] ${hasTakeProfit ? 'border-[#286b52] bg-[#0a281d] text-[#42D7A1]' : 'border-white/[0.12] text-transparent'}`}>✓</span>
                  <span className="text-[10px] font-bold text-[#E6EDF3]">Take Profit</span>
                  {hasTakeProfit && <span className="truncate font-mono text-[8px] text-[#42D7A1]">{Number.isFinite(planMetrics?.reward) ? `+${money(Math.abs(planMetrics.reward),currency)}` : '—'}</span>}
                </button>
                <button type="button" onClick={() => enableProtection('tp')} className="text-[8px] font-bold text-[#8295A7] hover:text-white">{hasTakeProfit ? 'Edit' : 'Add'}</button>
              </div>
              {activeTool === 'tp' && !tradePlan && (
                <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-white/[0.05] pt-1.5">
                  <button type="button" onClick={() => startProtectedPlan('sell','tp')} className="h-8 rounded border border-[#5b252e] text-[8px] font-bold text-[#FF6F7A]">Plan short</button>
                  <button type="button" onClick={() => startProtectedPlan('buy','tp')} className="h-8 rounded border border-[#1c5c47] text-[8px] font-bold text-[#42D7A1]">Plan long</button>
                </div>
              )}
              {activeTool === 'tp' && tradePlan && renderProtectionEditor('tp')}
            </div>
          </div>

          {hasStopLoss && (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="mr-1 text-[8px] font-semibold text-[#6F8191]">R:R</span>
              {[1,1.5,2,3].map(value => <button key={value} type="button" onClick={() => applyRewardRatio(value)} className={`h-6 flex-1 rounded border text-[8px] font-bold ${Number.isFinite(planMetrics?.rr) && Math.abs(planMetrics.rr-value)<0.03 ? 'border-[#195be1] bg-[#0d1a22] text-[#195be1]' : 'border-white/[0.06] text-[#718497] hover:text-white'}`}>1:{value}</button>)}
            </div>
          )}
        </div>

        {warning && (
          <div className="flex items-start gap-1.5 rounded-md border border-[#57363b] bg-[#14090c] px-2 py-1.5 text-[8px] font-semibold leading-4 text-[#dba2a8]">
            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-[#FF6F7A]" />
            <span>{warning}</span>
          </div>
        )}

        <div className={`rounded-md border ${riskGuard.blocks.length ? 'border-[#5e2932]' : 'border-white/[0.06]'} bg-black/35`}>
          <div className="flex h-9 items-center gap-2 px-2.5">
            <button type="button" onClick={() => setRiskGuardOpen(value => !value)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <ShieldCheck size={11} className={riskGuard.blocks.length ? 'text-[#FF6F7A]' : riskGuard.enabled ? 'text-[#195be1]' : 'text-[#6F8191]'}/>
              <strong className="text-[9px] font-black uppercase tracking-[0.06em] text-[#AAB5BF]">Risk Guard</strong>
              <span className="truncate text-[8px] text-[#6F8191]">{riskGuard.enabled ? (riskGuard.blocks[0]?.message || riskGuard.warnings[0]?.message || `${Number(riskGuardSettings?.maxRiskPerTrade || 1).toFixed(2)}% max trade`) : 'Off'}</span>
            </button>
            <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, enabled: !riskGuardSettings?.enabled })} className={`relative h-4 w-7 rounded-full border transition ${riskGuard.enabled ? 'border-[#195be1] bg-[#0b2938]' : 'border-white/[0.06] bg-[#111]'}`} aria-label="Toggle Risk Guard">
              <span className={`absolute top-[1px] size-3 rounded-full bg-white transition ${riskGuard.enabled ? 'left-[13px]' : 'left-[1px]'}`} />
            </button>
          </div>
          {riskGuardOpen && (
            <div className="border-t border-white/[0.06] px-2 pb-2 pt-1.5">
              <div className="grid grid-cols-4 gap-2">
                <FieldMetric label="Trade" value={Number.isFinite(riskGuard.tradeRiskPercent) ? `${riskGuard.tradeRiskPercent.toFixed(2)}%` : '—'} />
                <FieldMetric label="Open" value={Number.isFinite(riskGuard.openRiskPercent) ? `${riskGuard.openRiskPercent.toFixed(2)}%` : '—'} />
                <FieldMetric label="After" value={Number.isFinite(riskGuard.projectedOpenRiskPercent) ? `${riskGuard.projectedOpenRiskPercent.toFixed(2)}%` : '—'} tone="accent" />
                <FieldMetric label="Streak" value={String(riskGuard.consecutiveLosses)} />
              </div>
            </div>
          )}
        </div>

        {(challenge.dailyLossLimit > 0 || challenge.maxLossLimit > 0 || challenge.profitTarget > 0) && (
          <div className="rounded-[10px] border border-white/[0.05] bg-[#0B0D10] px-2.5 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-[9px] font-black uppercase tracking-[0.08em] text-[#AAB5BF]">Account Limits</strong>
              <span className={challenge.riskAvailabilityLive ? "text-[7px] font-bold text-[#42D7A1]" : "text-[7px] font-bold text-[#E7BD58]"}>{challenge.riskAvailabilityLive ? 'LIVE' : 'SYNCING'}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <FieldMetric label="Daily Loss Remaining" value={challenge.dailyLossLimit > 0 && challenge.riskAvailabilityLive ? money(challenge.remainingDaily, currency) : '—'} />
              <FieldMetric label="Max Loss Remaining" value={challenge.maxLossLimit > 0 && challenge.riskAvailabilityLive ? money(challenge.remainingMax, currency) : '—'} />
              <FieldMetric label="Profit Target Remaining" value={challenge.profitTarget > 0 ? money(Math.max(0, challenge.profitTarget - challenge.profit), currency) : '—'} />
              <FieldMetric label="Daily Loss After SL" value={challenge.dailyLossLimit > 0 && challenge.riskAvailabilityLive && Number.isFinite(planMetrics?.riskAmount) ? money(challenge.postTradeDaily, currency) : '—'} tone={challenge.dailyLossLimit > 0 && challenge.riskAvailabilityLive && Number.isFinite(planMetrics?.riskAmount) && challenge.postTradeDaily < challenge.remainingDaily * 0.25 ? 'danger' : 'default'} />
            </div>
          </div>
        )}

        <div className="rounded-[10px] border border-white/[0.05] bg-[#0B0D10] px-2.5 py-2.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <FieldMetric label="Required Margin" value={money(previewMargin, currency)} />
            <FieldMetric label="Free Margin After" value={money(freeAfter, currency)} tone={Number.isFinite(freeAfter) && freeAfter < 0 ? 'danger' : 'default'} />
            <FieldMetric
              label="Loss at SL"
              value={Number.isFinite(planMetrics?.riskAmount) ? money(planMetrics.riskAmount, currency) : '—'}
              tone={activeTool === 'sl' ? 'danger' : Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50 ? 'danger' : 'default'}
            />
            <FieldMetric
              label="Risk / Reward"
              value={Number.isFinite(planMetrics?.rr) ? `1:${planMetrics.rr.toFixed(2)}` : '—'}
              tone={activeTool === 'sl' || activeTool === 'tp' ? 'accent' : 'default'}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-2">
            <FieldMetric label="Spread" value={spreadDisplay} />
            <FieldMetric label="Commission" value={formatCommission(market?.commissionPerLotPerSide ?? market?.commissionPerLot, market?.commissionRate)} />
            <FieldMetric label="Leverage" value={effectiveLeverage(account, market) ? `1:${effectiveLeverage(account, market)}` : '—'} />
          </div>
        </div>

      </div>

      <div className="shrink-0 border-t border-white/[0.05] bg-[#0A0C0F]/98 px-3 pb-3 pt-2.5 shadow-[0_-10px_24px_rgba(0,0,0,.22)] backdrop-blur">
        {pendingPlan && (
          <div className="mb-1.5 flex items-center justify-between px-0.5 text-[8px] font-semibold text-[#6F8191]">
            <span>{tradePlan?.pending ? 'Pending order ready' : 'Protected market plan'}</span>
            <span>{String(selectedSide || '').toUpperCase()} · review and confirm</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={sideButtonDisabled('sell')}
            onClick={() => clickSide('sell')}
            className="flex h-[62px] min-w-0 flex-col justify-center rounded-[10px] border border-[#8A3440] bg-[#D7384B] px-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition hover:bg-[#E13D51] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <strong className="truncate font-mono text-[15px] font-black tracking-[-0.03em] text-white">{formatInstrumentPrice(executionButtonPrice('sell'), market)}</strong>
            <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-white">{executionButtonLabel('sell')}</span>
          </button>
          <button
            type="button"
            disabled={sideButtonDisabled('buy')}
            onClick={() => clickSide('buy')}
            className="flex h-[62px] min-w-0 flex-col items-end justify-center rounded-[10px] border border-[#10A884] bg-[#0AA17C] px-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition hover:bg-[#0DB28A] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <strong className="truncate font-mono text-[15px] font-black tracking-[-0.03em] text-white">{formatInstrumentPrice(executionButtonPrice('buy'), market)}</strong>
            <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-white">{executionButtonLabel('buy')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
