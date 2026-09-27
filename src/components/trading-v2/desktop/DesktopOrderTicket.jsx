import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { decimalPlaces, normalizeVolumeToStep } from '../../../utils/tradingCommandNormalization.js';
import {
  estimateOpeningRequirement,
  estimateRequiredMargin,
  estimateStopRisk,
  riskSizingSupported,
} from '../../../utils/tradingRisk.js';
import { formatInstrumentPrice, instrumentPipSize } from '../../../utils/instrumentFormatting.js';
import { effectiveTradePlan, validateTradePlanForExecution } from '../../../utils/tradePlanExecution.js';
import { resolveExecutionPreview } from '../../../utils/executionPricing.js';
import { deriveAccountCapabilities } from '../../../utils/accountCapabilities.js';

const RISK_PRESETS = [0.25, 0.5, 1];

function finitePositive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function money(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency || ''}`.trim();
  }
}

function priceInputValue(value, instrument) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  const decimals = Math.min(8, Math.max(0, decimalPlaces(instrument?.tickSize ?? instrument?.pipSize ?? 0.00001)));
  return numeric.toFixed(decimals);
}

function Metric({ label, value, tone = 'default' }) {
  const toneClass = tone === 'danger'
    ? 'text-[#d45a64]'
    : tone === 'success'
      ? 'text-[#2aa37f]'
      : tone === 'accent'
        ? 'text-[#195be1]'
        : 'text-[#eef2f5]';

  return (
    <div className="min-w-0">
      <span className="block text-[9px] font-semibold text-[#697987]">{label}</span>
      <strong className={`mt-0.5 block truncate font-mono text-[12px] font-semibold tabular-nums ${toneClass}`}>{value}</strong>
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
  onNotice = () => {},
}) {
  const [lotInput, setLotInput] = useState(String(lots));
  const [lotFocused, setLotFocused] = useState(false);
  const [riskInput, setRiskInput] = useState(String(riskPercent));
  const [riskFocused, setRiskFocused] = useState(false);
  const [riskUnit, setRiskUnit] = useState('percent');
  const [entryInput, setEntryInput] = useState('');
  const [entryFocused, setEntryFocused] = useState(false);
  const [limitInput, setLimitInput] = useState('');
  const [limitFocused, setLimitFocused] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [protectionIntent, setProtectionIntent] = useState(null);
  const [marketLotsBeforePending, setMarketLotsBeforePending] = useState(null);

  const currency = account?.currency || 'USD';
  const equity = Number(account?.equity);
  const freeMargin = Number(account?.freeMargin);
  const volumeStep = Math.max(Number(market?.volumeStep) || 0.01, 0.00000001);
  const minVolume = Math.max(Number(market?.minVolume) || volumeStep, volumeStep);
  const maxVolume = Math.max(Number(market?.maxVolume) || 100, minVolume);
  const lotDecimals = Math.min(8, Math.max(0, decimalPlaces(market?.volumeStep ?? volumeStep)));
  const normalizedLots = normalizeVolumeToStep(lots, market, { rounding: 'nearest' });
  const orderFamily = orderType === 'market' ? 'market' : 'pending';
  const accountCapabilities = deriveAccountCapabilities(account);
  const riskSupported = riskSizingSupported(market, currency);

  const executableQuote = finitePositive(market?.bid)
    && finitePositive(market?.ask)
    && Number(market?.ask) >= Number(market?.bid)
    && market?.isStale !== true
    && market?.sessionOpen !== false
    && !['WAITING', 'DISCONNECTED', 'ERROR', 'DISABLED', 'STALE'].includes(String(market?.marketState || '').toUpperCase());

  const previewPlan = useMemo(
    () => tradePlan ? effectiveTradePlan(tradePlan, market) : null,
    [market, tradePlan],
  );

  const executionPreview = useMemo(() => {
    if (!previewPlan) return { plan: null, sizing: null };
    return resolveExecutionPreview({
      plan: previewPlan,
      riskPercent,
      manualLots: previewPlan?.manualLots ?? normalizedLots,
      account,
      instrument: market,
    });
  }, [account, market, normalizedLots, previewPlan, riskPercent]);

  const executionPlan = executionPreview.plan || previewPlan;
  const executionSizing = executionPreview.sizing;
  const activeSizingMode = executionPlan?.sizingMode || sizingMode;
  const effectiveLots = activeSizingMode === 'risk'
    ? (Number.isFinite(Number(executionSizing?.lots)) ? Number(executionSizing.lots) : null)
    : normalizedLots;

  const pendingReference = executionPlan?.pending && String(executionPlan?.orderType || '').toLowerCase() === 'stop-limit'
    ? finitePositive(executionPlan?.limitPrice)
    : finitePositive(executionPlan?.entry);
  const marketReference = finitePositive(market?.ask) || finitePositive(market?.bid);
  const marginReference = pendingReference || marketReference;

  const previewMargin = Number.isFinite(Number(effectiveLots))
    ? estimateRequiredMargin(marginReference, effectiveLots, market, account)
    : null;
  const openingRequirement = Number.isFinite(Number(effectiveLots))
    ? estimateOpeningRequirement(marginReference, effectiveLots, market, account)
    : null;
  const freeAfter = Number.isFinite(freeMargin) && Number.isFinite(openingRequirement)
    ? freeMargin - openingRequirement
    : null;

  const hasStopLoss = Number.isFinite(finitePositive(executionPlan?.sl));
  const hasTakeProfit = Number.isFinite(finitePositive(executionPlan?.tp));
  const selectedSide = String(executionPlan?.side || '').toLowerCase();
  const riskPlan = executionPlan?.pending && String(executionPlan?.orderType || '').toLowerCase() === 'stop-limit'
    ? { ...executionPlan, entry: executionPlan?.limitPrice }
    : executionPlan;
  const stopRisk = hasStopLoss && Number.isFinite(Number(effectiveLots))
    ? estimateStopRisk(riskPlan, effectiveLots, market, currency)
    : null;
  const takeProfitValue = hasTakeProfit && Number.isFinite(Number(effectiveLots))
    ? estimateStopRisk({ ...riskPlan, sl: executionPlan?.tp }, effectiveLots, market, currency)
    : null;
  const entry = finitePositive(riskPlan?.entry);
  const sl = finitePositive(riskPlan?.sl);
  const tp = finitePositive(riskPlan?.tp);
  const rr = [entry, sl, tp].every(Number.isFinite) && Math.abs(entry - sl) > 0
    ? Math.abs(tp - entry) / Math.abs(entry - sl)
    : null;

  const planValidation = executionPlan
    ? validateTradePlanForExecution(executionPlan, market, { preserveEntry: true })
    : { valid: true, message: null };
  const marginBlocked = Number.isFinite(openingRequirement)
    && Number.isFinite(freeMargin)
    && openingRequirement > freeMargin + 1e-8;

  const riskAmount = Number.isFinite(equity)
    ? equity * Number(riskPercent) / 100
    : null;

  useEffect(() => {
    if (!lotFocused) setLotInput(Number(normalizedLots).toFixed(lotDecimals));
  }, [lotDecimals, lotFocused, normalizedLots]);

  useEffect(() => {
    if (riskFocused) return;
    if (riskUnit === 'amount') setRiskInput(Number.isFinite(riskAmount) ? String(Number(riskAmount.toFixed(2))) : '');
    else setRiskInput(String(riskPercent));
  }, [riskAmount, riskFocused, riskPercent, riskUnit]);

  useEffect(() => {
    if (!entryFocused) setEntryInput(priceInputValue(tradePlan?.entry, market));
  }, [entryFocused, market, tradePlan?.entry]);

  useEffect(() => {
    if (!limitFocused) setLimitInput(priceInputValue(tradePlan?.limitPrice, market));
  }, [limitFocused, market, tradePlan?.limitPrice]);

  useEffect(() => {
    const intent = tradePlan?.desktopProtectionIntent;
    if (!['sl', 'tp'].includes(intent)) return;
    setProtectionIntent(intent);
    onTradePlanChange({ desktopProtectionIntent: null, stage: 'ready' });
    onNotice(`Choose Buy or Sell to place ${intent === 'sl' ? 'SL' : 'TP'} on the chart.`);
  }, [onNotice, onTradePlanChange, tradePlan?.desktopProtectionIntent]);

  const setLots = value => {
    const next = normalizeVolumeToStep(value, market, { rounding: 'nearest' });
    onLotsChange(next);
    onSizingModeChange('lots');
    setLotInput(Number(next).toFixed(lotDecimals));
    if (tradePlan) onTradePlanChange({ manualLots: next, sizingMode: 'lots' });
  };

  const commitLot = () => {
    const numeric = Number(String(lotInput).trim());
    setLots(Number.isFinite(numeric) && numeric > 0 ? numeric : normalizedLots);
    setLotFocused(false);
  };

  const setMode = mode => {
    const next = mode === 'risk' ? 'risk' : 'lots';
    onSizingModeChange(next);
    if (tradePlan) onTradePlanChange({ sizingMode: next, manualLots: normalizedLots, stage: 'ready' });
    if (next === 'lots') setProtectionIntent(null);
  };

  const setRiskFromInput = value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const asPercent = riskUnit === 'amount'
      ? (Number.isFinite(equity) && equity > 0 ? numeric / equity * 100 : null)
      : numeric;
    if (!Number.isFinite(asPercent)) return;
    const next = Math.max(0.1, Math.min(5, asPercent));
    onRiskPercentChange(next);
    onSizingModeChange('risk');
    if (tradePlan) onTradePlanChange({ sizingMode: 'risk', manualLots: normalizedLots, stage: 'ready' });
  };

  const commitRisk = () => {
    setRiskFromInput(riskInput);
    setRiskFocused(false);
  };

  const updateEntryInput = value => {
    setEntryInput(value);
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0 && tradePlan) {
      onTradePlanChange({ entry: numeric, stage: 'ready' });
    }
  };

  const commitEntry = () => {
    const numeric = Number(entryInput);
    if (Number.isFinite(numeric) && numeric > 0) onTradePlanChange({ entry: numeric, stage: 'ready' });
    else setEntryInput(priceInputValue(tradePlan?.entry, market));
    setEntryFocused(false);
  };

  const updateLimitInput = value => {
    setLimitInput(value);
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0 && tradePlan) {
      onTradePlanChange({ limitPrice: numeric, stage: 'ready' });
    }
  };

  const commitLimit = () => {
    const numeric = Number(limitInput);
    if (Number.isFinite(numeric) && numeric > 0) onTradePlanChange({ limitPrice: numeric, stage: 'ready' });
    else setLimitInput(priceInputValue(tradePlan?.limitPrice, market));
    setLimitFocused(false);
  };

  const chooseFamily = family => {
    setProtectionIntent(null);
    if (family === 'market') {
      onOrderTypeChange('market');
      if (tradePlan) onCancelPlan();
      if (Number.isFinite(Number(marketLotsBeforePending))) {
        const restored = normalizeVolumeToStep(marketLotsBeforePending, market, { rounding: 'nearest' });
        onLotsChange(restored);
        setLotInput(Number(restored).toFixed(lotDecimals));
        setMarketLotsBeforePending(null);
      }
      return;
    }

    if (orderFamily !== 'pending') {
      if (tradePlan) onCancelPlan();
      setMarketLotsBeforePending(normalizedLots);
      const defaultLots = normalizeVolumeToStep(1, market, { rounding: 'nearest' });
      onLotsChange(defaultLots);
      onSizingModeChange('lots');
      setLotInput(Number(defaultLots).toFixed(lotDecimals));
      onOrderTypeChange('limit');
      onNotice('Choose Buy or Sell to project a pending order on the chart.');
      return;
    }

    onOrderTypeChange(orderType === 'market' ? 'limit' : orderType);
  };

  const inferredPendingType = side => {
    if (tradePlan?.editingOrderId) return String(tradePlan.orderType || 'limit').toLowerCase();
    if (tradePlan?.desktopExplicitStopLimit || String(tradePlan?.orderType || '').toLowerCase() === 'stop-limit') return 'stop-limit';

    const price = Number(tradePlan?.entry);
    const bid = Number(market?.bid);
    const ask = Number(market?.ask);
    if (![price, bid, ask].every(Number.isFinite)) return 'limit';
    if (side === 'buy') return price < ask ? 'limit' : 'stop';
    return price > bid ? 'limit' : 'stop';
  };

  useEffect(() => {
    if (
      orderFamily !== 'pending'
      || !tradePlan?.desktopPendingDraft
      || tradePlan?.editingOrderId
      || tradePlan?.desktopExplicitStopLimit
      || !['buy', 'sell'].includes(selectedSide)
    ) return;

    const price = Number(tradePlan?.entry);
    const bid = Number(market?.bid);
    const ask = Number(market?.ask);
    if (![price, bid, ask].every(Number.isFinite)) return;
    const nextType = selectedSide === 'buy'
      ? (price < ask ? 'limit' : 'stop')
      : (price > bid ? 'limit' : 'stop');
    if (nextType === String(tradePlan?.orderType || '').toLowerCase()) return;

    onOrderTypeChange(nextType);
    onTradePlanChange({ orderType: nextType, stage: 'ready' });
  }, [
    market?.ask,
    market?.bid,
    onOrderTypeChange,
    onTradePlanChange,
    orderFamily,
    selectedSide,
    tradePlan?.desktopExplicitStopLimit,
    tradePlan?.desktopPendingDraft,
    tradePlan?.editingOrderId,
    tradePlan?.entry,
    tradePlan?.orderType,
  ]);

  const defaultProtectionPrice = (field, sideOverride = selectedSide) => {
    const side = sideOverride === 'sell' ? 'sell' : 'buy';
    const base = finitePositive(tradePlan?.entry)
      || finitePositive(side === 'buy' ? market?.ask : market?.bid);
    if (!base) return null;
    const pip = finitePositive(instrumentPipSize(market)) || finitePositive(market?.tickSize) || base * 0.0001;
    const distance = Math.max(pip * 10, base * (String(market?.assetClass || '').toUpperCase() === 'FOREX' ? 0.0005 : 0.0025));
    const multiplier = field === 'tp' ? 2 : 1;
    if (field === 'sl') return side === 'buy' ? base - distance : base + distance;
    return side === 'buy' ? base + distance * multiplier : base - distance * multiplier;
  };

  const addProtection = field => {
    if (tradePlan?.[field] != null) {
      onTradePlanChange({ activeField: field, stage: 'ready' });
      return;
    }

    if (!tradePlan) {
      if (orderFamily === 'pending') {
        onNotice('Choose Buy or Sell first to create the pending projection.');
        return;
      }
      setProtectionIntent(field);
      onNotice(`Choose Buy or Sell to place ${field === 'sl' ? 'SL' : 'TP'} on the chart.`);
      return;
    }

    const value = defaultProtectionPrice(field);
    if (Number.isFinite(value)) {
      onTradePlanChange({ [field]: value, activeField: field, stage: 'ready' });
      onNotice(`${field === 'sl' ? 'SL' : 'TP'} active on chart — drag to adjust.`);
    }
  };

  const removeProtection = field => {
    setProtectionIntent(current => current === field ? null : current);
    if (tradePlan) onTradePlanChange({ [field]: null, activeField: null, stage: 'ready' });
  };

  const applyRewardRatio = ratio => {
    if (!tradePlan || !Number.isFinite(entry) || !Number.isFinite(sl) || !Number.isFinite(Number(ratio))) return;
    const distance = Math.abs(entry - sl) * Number(ratio);
    const nextTp = selectedSide === 'sell' ? entry - distance : entry + distance;
    onTradePlanChange({ tp: nextTp, activeField: 'tp', stage: 'ready' });
  };

  const switchPlannedMarketSide = side => {
    const protection = hasStopLoss && hasTakeProfit ? 'both' : hasStopLoss ? 'sl' : hasTakeProfit ? 'tp' : 'none';
    onStartPlan(side, 'market', { protection });
    onNotice('Direction changed — review the chart protection before execution.');
  };

  const handleSide = side => {
    if (!market?.symbol || !executableQuote || !exposureAllowed) {
      if (!exposureAllowed) onNotice(exposureBlockReason);
      return;
    }

    if (orderFamily === 'market') {
      if (!tradePlan && activeSizingMode === 'lots' && !protectionIntent) {
        onManualOrder({
          side,
          lots: normalizedLots,
          price: side === 'buy' ? market.ask : market.bid,
          symbol: market.symbol,
        }, { skipRiskGuard: true });
        return;
      }

      if (!tradePlan) {
        onStartPlan(side, 'market', { protection: protectionIntent || 'none' });
        setProtectionIntent(null);
        if (activeSizingMode === 'risk' && !protectionIntent) onNotice('Stop loss required when using risk sizing.');
        else onNotice('Protection active on chart — drag to adjust, then execute.');
        return;
      }

      if (selectedSide && selectedSide !== side) {
        switchPlannedMarketSide(side);
        return;
      }

      if (activeSizingMode === 'risk' && !hasStopLoss) {
        onNotice('Stop loss required when using risk sizing.');
        return;
      }

      onExecutePlan({ skipRiskGuard: true });
      return;
    }

    if (!tradePlan) {
      onOrderTypeChange('limit');
      onStartPlan(side, 'limit', {
        protection: 'none',
        desktopPendingDraft: true,
      });
      onNotice(`${side === 'buy' ? 'Buy' : 'Sell'} Limit projection active — drag entry, adjust lots, then press ${side === 'buy' ? 'Buy' : 'Sell'} again to place.`);
      return;
    }

    if (tradePlan.editingOrderId && selectedSide && selectedSide !== side) return;

    if (tradePlan.desktopPendingDraft && selectedSide && selectedSide !== side) {
      onOrderTypeChange('limit');
      onStartPlan(side, 'limit', {
        protection: 'none',
        desktopPendingDraft: true,
      });
      onNotice(`${side === 'buy' ? 'Buy' : 'Sell'} Limit projection active — drag entry or adjust lots.`);
      return;
    }

    const nextType = inferredPendingType(side);

    if (activeSizingMode === 'risk' && !hasStopLoss) {
      onTradePlanChange({
        side,
        orderType: nextType,
        sizingMode: 'risk',
        manualLots: normalizedLots,
        stage: 'ready',
      });
      onNotice('Set SL to calculate size before placing the pending order.');
      return;
    }

    onExecutePlan({
      skipRiskGuard: true,
      planPatch: {
        side,
        orderType: nextType,
        desktopPendingDraft: false,
        sizingMode: activeSizingMode,
        manualLots: normalizedLots,
      },
    });
  };

  const enableStopLimit = () => {
    if (!tradePlan) return;
    const side = selectedSide || 'buy';
    const base = finitePositive(tradePlan.entry);
    if (!base) return;
    const pip = finitePositive(instrumentPipSize(market)) || finitePositive(market?.tickSize) || base * 0.0001;
    const limitPrice = finitePositive(tradePlan.limitPrice)
      || (side === 'buy' ? base + 1.5 * pip : base - 1.5 * pip);
    onOrderTypeChange('stop-limit');
    onTradePlanChange({
      orderType: 'stop-limit',
      desktopExplicitStopLimit: true,
      limitPrice,
      stage: 'ready',
    });
  };

  const disableStopLimit = () => {
    if (!tradePlan) return;
    const nextType = inferredPendingType(selectedSide || 'buy') === 'stop-limit' ? 'limit' : inferredPendingType(selectedSide || 'buy');
    onOrderTypeChange(nextType);
    onTradePlanChange({
      orderType: nextType,
      desktopExplicitStopLimit: false,
      limitPrice: null,
      stage: 'ready',
    });
  };

  const riskSizingText = activeSizingMode === 'risk'
    ? Number.isFinite(Number(effectiveLots))
      ? `${Number(effectiveLots).toFixed(Math.max(2, lotDecimals))} lot`
      : 'Set SL to calculate'
    : null;

  let warning = null;
  if (!exposureAllowed) warning = exposureBlockReason;
  else if (!executableQuote) {
    if (market?.sessionOpen === false) warning = 'Market session is closed.';
    else if (market?.isStale) warning = 'Quote is stale. Execution is disabled.';
    else warning = 'Waiting for an executable quote.';
  } else if (executionPlan && !planValidation.valid && !tradePlan?.desktopPendingDraft) warning = planValidation.message;
  else if (marginBlocked) warning = `Opening requirement exceeds free margin ${money(freeMargin, currency)}.`;
  else if (activeSizingMode === 'risk' && !riskSupported) warning = 'Risk sizing is unavailable for this instrument/account currency.';

  const marketSellPrice = formatInstrumentPrice(market?.bid, market);
  const marketBuyPrice = formatInstrumentPrice(market?.ask, market);
  const pendingSellType = inferredPendingType('sell').replace('-', ' ').toUpperCase();
  const pendingBuyType = inferredPendingType('buy').replace('-', ' ').toUpperCase();
  const editing = Boolean(tradePlan?.editingOrderId);
  const pendingProjection = orderFamily === 'pending' && Boolean(tradePlan?.pending) && !editing;
  const pendingSellLabel = editing
    ? `Update ${pendingSellType}`
    : pendingProjection && selectedSide === 'sell'
      ? `Place Sell ${pendingSellType}`
      : 'Sell';
  const pendingBuyLabel = editing
    ? `Update ${pendingBuyType}`
    : pendingProjection && selectedSide === 'buy'
      ? `Place Buy ${pendingBuyType}`
      : 'Buy';

  const sideDisabled = side => {
    if (!executableQuote || !exposureAllowed) return true;
    if (editing && selectedSide && selectedSide !== side) return true;
    if (marginBlocked && activeSizingMode !== 'risk') return true;
    if (activeSizingMode === 'risk' && executionSizing?.blockReason && hasStopLoss) return true;
    return false;
  };

  return (
    <section className="acg-desktop-order flex h-full min-h-0 flex-col bg-[#0A0C0F]">
      <div className="grid h-11 shrink-0 grid-cols-2 border-b border-white/[0.05] bg-[#0A0C0F]">
        <button type="button" onClick={() => chooseFamily('market')} className={orderFamily === 'market' ? 'relative text-[11px] font-bold text-[#f4f6f8]' : 'relative text-[11px] font-semibold text-[#74808b] hover:text-white'}>
          Market
          {orderFamily === 'market' && <span className="absolute inset-x-[22%] bottom-0 h-0.5 bg-[#195be1]"/>}
        </button>
        <button type="button" onClick={() => chooseFamily('pending')} className={orderFamily === 'pending' ? 'relative text-[11px] font-bold text-[#f4f6f8]' : 'relative text-[11px] font-semibold text-[#74808b] hover:text-white'}>
          Pending
          {orderFamily === 'pending' && <span className="absolute inset-x-[22%] bottom-0 h-0.5 bg-[#195be1]"/>}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <strong className="block text-[11px] font-bold text-[#eef2f5]">{market?.displaySymbol || market?.symbol || '—'}</strong>
            <span className="mt-0.5 block text-[8px] text-[#647382]">{orderFamily === 'market' ? 'Fast market execution' : 'Drag entry on chart or type a price'}</span>
          </div>
          {tradePlan && (
            <button type="button" onClick={() => { onCancelPlan(); setProtectionIntent(null); }} className="grid size-7 place-items-center rounded text-[#687784] hover:bg-white/[0.04] hover:text-white" aria-label="Clear order setup">
              <X size={12}/>
            </button>
          )}
        </div>

        {orderFamily === 'pending' && (
          tradePlan?.pending ? (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[9px] font-semibold text-[#8b98a4]">Entry price</span>
                <span className="text-[8px] text-[#586875]">chart ↔ ticket</span>
              </div>
              <input
                value={entryInput}
                onFocus={event => { setEntryFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                onChange={event => updateEntryInput(event.target.value)}
                onBlur={commitEntry}
                onKeyDown={event => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setEntryInput(priceInputValue(tradePlan?.entry, market));
                    event.currentTarget.blur();
                  }
                }}
                inputMode="decimal"
                className="h-11 w-full rounded-md border border-[#195be1]/35 bg-black px-3 text-right font-mono text-[16px] font-semibold tabular-nums text-[#eef3f7] outline-none focus:border-[#195be1]"
                aria-label="Pending entry price"
              />
            </div>
          ) : (
            <div className="mb-3 rounded-md border border-white/[0.05] bg-black/35 px-2.5 py-2 text-[9px] text-[#71808d]">
              Choose <strong className="text-[#d45a64]">Sell</strong> or <strong className="text-[#4f82ef]">Buy</strong> to project the pending order on the chart.
            </div>
          )
        )}

        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[9px] font-semibold text-[#8b98a4]">Position size</span>
            <div className="grid h-7 w-[128px] grid-cols-2 rounded-md border border-white/[0.06] bg-black p-0.5">
              <button type="button" onClick={() => setMode('lots')} className={activeSizingMode === 'lots' ? 'rounded bg-[#151820] text-[8px] font-bold text-[#eef2f5]' : 'rounded text-[8px] font-semibold text-[#657380] hover:text-white'}>Lots</button>
              <button type="button" onClick={() => setMode('risk')} disabled={!riskSupported} className={activeSizingMode === 'risk' ? 'rounded bg-[#0d1a22] text-[8px] font-bold text-[#195be1]' : 'rounded text-[8px] font-semibold text-[#657380] hover:text-white disabled:opacity-35'}>Risk</button>
            </div>
          </div>

          {activeSizingMode === 'lots' ? (
            <div className="grid grid-cols-[34px_minmax(0,1fr)_34px] items-center rounded-md border border-white/[0.06] bg-black">
              <button type="button" onClick={() => setLots(Math.max(minVolume, normalizedLots - volumeStep))} className="grid h-11 place-items-center text-[#697784] hover:text-white" aria-label="Decrease lot size"><Minus size={12}/></button>
              <div className="flex items-center justify-center border-x border-white/[0.05]">
                <input
                  value={lotInput}
                  onFocus={event => { setLotFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                  onChange={event => setLotInput(event.target.value)}
                  onBlur={commitLot}
                  onKeyDown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                      setLotInput(Number(normalizedLots).toFixed(lotDecimals));
                      event.currentTarget.blur();
                    }
                  }}
                  inputMode="decimal"
                  className="h-11 w-24 bg-transparent text-center font-mono text-[18px] font-bold tabular-nums text-[#f4f6f8] outline-none"
                  aria-label="Lot size"
                />
                <span className="ml-1 text-[8px] text-[#647382]">lots</span>
              </div>
              <button type="button" onClick={() => setLots(Math.min(maxVolume, normalizedLots + volumeStep))} className="grid h-11 place-items-center text-[#697784] hover:text-white" aria-label="Increase lot size"><Plus size={12}/></button>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-black p-2">
              <div className="flex items-center gap-1.5">
                <div className="grid h-8 w-[70px] grid-cols-2 rounded border border-white/[0.06] bg-[#08090a] p-0.5">
                  <button type="button" onClick={() => setRiskUnit('percent')} className={riskUnit === 'percent' ? 'rounded bg-[#151820] text-[8px] font-bold text-white' : 'rounded text-[8px] text-[#697784]'}>%</button>
                  <button type="button" onClick={() => setRiskUnit('amount')} className={riskUnit === 'amount' ? 'rounded bg-[#151820] text-[8px] font-bold text-white' : 'rounded text-[8px] text-[#697784]'}>{currency}</button>
                </div>
                <input
                  value={riskInput}
                  onFocus={event => { setRiskFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                  onChange={event => setRiskInput(event.target.value)}
                  onBlur={commitRisk}
                  onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                  inputMode="decimal"
                  className="h-8 min-w-0 flex-1 rounded border border-white/[0.06] bg-[#08090a] px-2 text-right font-mono text-[12px] font-semibold text-[#eef2f5] outline-none focus:border-[#195be1]"
                  aria-label="Risk value"
                />
              </div>
              <div className="mt-1.5 flex gap-1">
                {RISK_PRESETS.map(value => (
                  <button key={value} type="button" onClick={() => { setRiskUnit('percent'); setRiskFromInput(value); }} className={Math.abs(Number(riskPercent) - value) < 0.001 ? 'h-6 flex-1 rounded border border-[#195be1]/60 bg-[#0d1a22] text-[8px] font-bold text-[#195be1]' : 'h-6 flex-1 rounded border border-white/[0.05] text-[8px] font-semibold text-[#677684] hover:text-white'}>
                    {value}%
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-[9px]">
                <span className="text-[#697784]">Set SL to calculate size</span>
                <strong className={Number.isFinite(Number(effectiveLots)) ? 'font-mono text-[#eef2f5]' : 'font-normal text-[#8b98a4]'}>{riskSizingText}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[9px] font-semibold text-[#8b98a4]">Protection</span>
            {protectionIntent && <span className="text-[8px] text-[#195be1]">choose direction</span>}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex min-w-0">
              <button type="button" onClick={() => addProtection('sl')} className={hasStopLoss ? 'h-9 min-w-0 flex-1 rounded-l-md border border-[#7f3540] bg-[#160b0d] text-[9px] font-bold text-[#d45a64]' : protectionIntent === 'sl' ? 'h-9 min-w-0 flex-1 rounded-l-md border border-[#195be1] bg-[#0d1a22] text-[9px] font-bold text-[#195be1]' : 'h-9 min-w-0 flex-1 rounded-l-md border border-white/[0.06] bg-black text-[9px] font-semibold text-[#8b98a4] hover:text-white'}>
                {hasStopLoss ? 'SL ACTIVE' : activeSizingMode === 'risk' ? 'SET SL' : 'SL'}
              </button>
              <button type="button" onClick={() => removeProtection('sl')} disabled={!hasStopLoss && protectionIntent !== 'sl'} className="grid h-9 w-8 place-items-center rounded-r-md border border-l-0 border-white/[0.06] bg-black text-[#647382] hover:text-white disabled:opacity-25" aria-label="Remove stop loss"><X size={10}/></button>
            </div>
            <div className="flex min-w-0">
              <button type="button" onClick={() => addProtection('tp')} className={hasTakeProfit ? 'h-9 min-w-0 flex-1 rounded-l-md border border-[#255b49] bg-[#081511] text-[9px] font-bold text-[#2aa37f]' : protectionIntent === 'tp' ? 'h-9 min-w-0 flex-1 rounded-l-md border border-[#195be1] bg-[#0d1a22] text-[9px] font-bold text-[#195be1]' : 'h-9 min-w-0 flex-1 rounded-l-md border border-white/[0.06] bg-black text-[9px] font-semibold text-[#8b98a4] hover:text-white'}>
                {hasTakeProfit ? 'TP ACTIVE' : 'TP'}
              </button>
              <button type="button" onClick={() => removeProtection('tp')} disabled={!hasTakeProfit && protectionIntent !== 'tp'} className="grid h-9 w-8 place-items-center rounded-r-md border border-l-0 border-white/[0.06] bg-black text-[#647382] hover:text-white disabled:opacity-25" aria-label="Remove take profit"><X size={10}/></button>
            </div>
          </div>
        </div>

        {warning && (
          <div className="mb-3 flex items-start gap-1.5 rounded-md border border-[#56353b] bg-[#14090c] px-2 py-1.5 text-[8px] font-semibold leading-4 text-[#d8a1a7]">
            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-[#d45a64]"/>
            <span>{warning}</span>
          </div>
        )}

        <button type="button" onClick={() => setAdvancedOpen(value => !value)} className="mb-2 flex h-7 w-full items-center justify-between border-t border-white/[0.05] pt-2 text-[8px] font-semibold text-[#697784] hover:text-white">
          <span>Advanced</span>
          <ChevronDown size={11} className={advancedOpen ? 'rotate-180 transition' : 'transition'}/>
        </button>

        {advancedOpen && (
          <div className="mb-3 space-y-2 rounded-md border border-white/[0.05] bg-black/30 p-2">
            {orderFamily === 'pending' && !editing && (
              <div>
                <span className="mb-1 block text-[8px] font-semibold text-[#697784]">Pending type</span>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={disableStopLimit} className={!tradePlan?.desktopExplicitStopLimit ? 'h-7 rounded border border-[#195be1]/50 bg-[#0d1a22] text-[8px] font-bold text-[#195be1]' : 'h-7 rounded border border-white/[0.05] text-[8px] text-[#748391]'}>Auto Limit / Stop</button>
                  <button type="button" onClick={enableStopLimit} className={tradePlan?.desktopExplicitStopLimit ? 'h-7 rounded border border-[#195be1]/50 bg-[#0d1a22] text-[8px] font-bold text-[#195be1]' : 'h-7 rounded border border-white/[0.05] text-[8px] text-[#748391]'}>Stop Limit</button>
                </div>
              </div>
            )}

            {String(tradePlan?.orderType || '').toLowerCase() === 'stop-limit' && (
              <label className="block">
                <span className="mb-1 block text-[8px] font-semibold text-[#697784]">Limit price</span>
                <input
                  value={limitInput}
                  onFocus={event => { setLimitFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                  onChange={event => updateLimitInput(event.target.value)}
                  onBlur={commitLimit}
                  inputMode="decimal"
                  className="h-8 w-full rounded border border-white/[0.06] bg-black px-2 text-right font-mono text-[10px] text-[#eef2f5] outline-none focus:border-[#195be1]"
                />
              </label>
            )}

            {hasStopLoss && (
              <div>
                <span className="mb-1 block text-[8px] font-semibold text-[#697784]">Risk : Reward</span>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 1.5, 2, 3].map(value => (
                    <button key={value} type="button" onClick={() => applyRewardRatio(value)} className={Number.isFinite(rr) && Math.abs(rr - value) < 0.03 ? 'h-7 rounded border border-[#195be1]/55 bg-[#0d1a22] text-[8px] font-bold text-[#195be1]' : 'h-7 rounded border border-white/[0.05] text-[8px] text-[#748391] hover:text-white'}>
                      1:{value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {orderFamily === 'pending' && tradePlan && (
              <div>
                <span className="mb-1 block text-[8px] font-semibold text-[#697784]">Expiry</span>
                <div className="grid grid-cols-3 gap-1">
                  {['GTC', 'TODAY', 'SPECIFIED'].map(value => (
                    <button key={value} type="button" onClick={() => onTradePlanChange({ expiration: value, ...(value === 'SPECIFIED' ? {} : { expirationAt: null }), stage: 'ready' })} className={String(tradePlan?.expiration || 'GTC').toUpperCase() === value ? 'h-7 rounded border border-[#195be1]/55 bg-[#0d1a22] text-[8px] font-bold text-[#195be1]' : 'h-7 rounded border border-white/[0.05] text-[8px] text-[#748391]'}>
                      {value === 'SPECIFIED' ? 'Custom' : value === 'TODAY' ? 'Today' : 'GTC'}
                    </button>
                  ))}
                </div>
                {String(tradePlan?.expiration || 'GTC').toUpperCase() === 'SPECIFIED' && (
                  <input type="datetime-local" value={tradePlan?.expirationAt || ''} onChange={event => onTradePlanChange({ expirationAt: event.target.value, stage: 'ready' })} className="mt-1.5 h-8 w-full rounded border border-white/[0.06] bg-black px-2 text-[9px] text-[#dce3e8] outline-none focus:border-[#195be1]"/>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.05] bg-[#0A0C0F]/98 px-3 pb-3 pt-2.5 shadow-[0_-10px_24px_rgba(0,0,0,.22)] backdrop-blur">
        <div className={`mb-2 grid gap-2 ${hasStopLoss || hasTakeProfit ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {hasStopLoss && <Metric label="Loss at SL" value={Number.isFinite(stopRisk) ? money(-Math.abs(stopRisk), currency) : '—'} tone="danger"/>}
          {hasTakeProfit && <Metric label="Profit at TP" value={Number.isFinite(takeProfitValue) ? money(Math.abs(takeProfitValue), currency) : '—'} tone="success"/>}
          <Metric label="Margin" value={money(previewMargin, currency)} />
          <Metric label="Free after" value={money(freeAfter, currency)} tone={Number.isFinite(freeAfter) && freeAfter < 0 ? 'danger' : 'default'} />
        </div>

        {activeSizingMode === 'risk' && !hasStopLoss && (
          <div className="mb-1.5 text-[8px] font-semibold text-[#b9888e]">Set SL to calculate size before execution.</div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={sideDisabled('sell')}
            onClick={() => handleSide('sell')}
            className="flex h-[58px] min-w-0 flex-col justify-center rounded-md border border-[#71333b] bg-[#0c0c0e] px-3 text-left transition hover:bg-[#121012] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <strong className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#d45a64]">
              {orderFamily === 'market'
                ? (tradePlan && selectedSide === 'sell' ? 'Execute Sell' : 'Sell')
                : pendingSellLabel}
            </strong>
            <span className="mt-1 truncate font-mono text-[14px] font-semibold tabular-nums text-[#f0f3f5]">
              {orderFamily === 'market' ? marketSellPrice : (tradePlan?.pending ? formatInstrumentPrice(tradePlan?.entry, market) : marketSellPrice)}
            </span>
          </button>

          <button
            type="button"
            disabled={sideDisabled('buy')}
            onClick={() => handleSide('buy')}
            className="flex h-[58px] min-w-0 flex-col items-end justify-center rounded-md border border-[#195be1]/70 bg-[#0c0c0e] px-3 text-right transition hover:bg-[#0d1118] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <strong className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#4f82ef]">
              {orderFamily === 'market'
                ? (tradePlan && selectedSide === 'buy' ? 'Execute Buy' : 'Buy')
                : pendingBuyLabel}
            </strong>
            <span className="mt-1 truncate font-mono text-[14px] font-semibold tabular-nums text-[#f0f3f5]">
              {orderFamily === 'market' ? marketBuyPrice : (tradePlan?.pending ? formatInstrumentPrice(tradePlan?.entry, market) : marketBuyPrice)}
            </span>
          </button>
        </div>

        {accountCapabilities.stopLossRequiredForManualLots && activeSizingMode === 'lots' && (
          <div className="mt-1.5 text-[8px] text-[#9a7b80]">This account policy requires SL for manual-lot exposure.</div>
        )}
      </div>
    </section>
  );
}
