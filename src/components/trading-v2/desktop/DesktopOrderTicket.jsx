import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import { calculateAccountRiskSummary } from '../../../utils/accountRisk.js';
import { DEFAULT_RISK_GUARD_SETTINGS, evaluateRiskGuard } from '../../../utils/riskGuard.js';
import { decimalPlaces, normalizeVolumeToStep } from '../../../utils/tradingCommandNormalization.js';
import {
  calculateRiskOrderSizing,
  effectiveLeverage,
  estimateRequiredMargin,
  estimateStopRisk,
  riskSizingSupported,
} from '../../../utils/tradingRisk.js';
import { formatInstrumentPrice, instrumentPipSize } from '../../../utils/instrumentFormatting.js';

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
        ? 'text-[#59C7FF]'
        : 'text-[#E6EDF3]';
  return (
    <div className="min-w-0">
      <span className="block text-[8px] font-semibold uppercase tracking-[0.075em] text-[#6F8191]">{label}</span>
      <strong className={`mt-0.5 block truncate font-mono text-[10px] font-semibold tabular-nums ${toneClass}`}>{value}</strong>
    </div>
  );
}

function ProtectionRow({ label, value, meta, tone = 'default', disabled = false, onChange }) {
  const toneClass = tone === 'danger' ? 'text-[#FF6F7A]' : tone === 'success' ? 'text-[#42D7A1]' : 'text-[#E6EDF3]';
  return (
    <label className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1.5 ${disabled ? 'border-white/[0.05] bg-black/40 opacity-65' : 'border-white/[0.06] bg-black'}`}>
      <span className="text-[9px] font-bold text-[#A1AFBC]">{label}</span>
      {disabled ? (
        <span className="text-[7px] font-semibold text-[#6F8191]">Choose a side to create a protected plan</span>
      ) : (
        <input
          inputMode="decimal"
          value={value ?? ''}
          onFocus={event => event.currentTarget.select()}
          onChange={event => onChange?.(event.target.value.replace(/[^0-9.]/g, ''))}
          className={`min-w-0 bg-transparent font-mono text-[10px] font-bold tabular-nums outline-none ${toneClass}`}
          aria-label={`${label} price`}
        />
      )}
      <span className="whitespace-nowrap text-[8px] font-medium text-[#6F8191]">{meta}</span>
    </label>
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
  const [expanded, setExpanded] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [riskGuardOpen, setRiskGuardOpen] = useState(false);

  const volumeStep = Math.max(Number(market?.volumeStep) || 0.01, 0.00000001);
  const minVolume = Math.max(Number(market?.minVolume) || volumeStep, volumeStep);
  const maxVolume = Math.max(Number(market?.maxVolume) || 100, minVolume);
  const lotDecimals = Math.min(8, Math.max(0, decimalPlaces(market?.volumeStep ?? volumeStep)));
  const normalizedLots = normalizeVolumeToStep(lots, market, { rounding: 'nearest' });
  const currency = account?.currency || 'USD';

  useEffect(() => {
    if (!lotFocused) setLotInput(Number(normalizedLots).toFixed(lotDecimals));
  }, [lotDecimals, lotFocused, normalizedLots]);

  const executableQuote = finiteQuote(market?.bid)
    && finiteQuote(market?.ask)
    && Number(market?.ask) >= Number(market?.bid)
    && market?.isStale !== true
    && market?.sessionOpen !== false
    && !['WAITING', 'DISCONNECTED', 'ERROR', 'DISABLED', 'STALE'].includes(String(market?.marketState || '').toUpperCase());

  const planMetrics = useMemo(() => {
    if (!tradePlan) return null;
    const pip = instrumentPipSize(market);
    const entry = Number(tradePlan.entry);
    const sl = Number(tradePlan.sl);
    const tp = Number(tradePlan.tp);
    const slPips = [entry, sl, pip].every(Number.isFinite) && pip > 0 ? Math.abs(entry - sl) / pip : null;
    const tpPips = [entry, tp, pip].every(Number.isFinite) && pip > 0 ? Math.abs(tp - entry) / pip : null;

    let calculatedLots = normalizedLots;
    let riskSizing = null;
    if (sizingMode === 'risk') {
      riskSizing = calculateRiskOrderSizing(
        { ...tradePlan, sizingMode: 'risk' },
        riskPercent,
        account,
        market,
      );
      if (Number.isFinite(riskSizing?.requestedLots)) calculatedLots = riskSizing.requestedLots;
    }

    const riskAmount = estimateStopRisk(tradePlan, calculatedLots, market, currency);
    const requiredMargin = estimateRequiredMargin(entry, calculatedLots, market, account);
    const reward = Number.isFinite(riskAmount) && Number.isFinite(slPips) && slPips > 0 && Number.isFinite(tpPips)
      ? riskAmount * (tpPips / slPips)
      : null;
    const rr = Number.isFinite(slPips) && slPips > 0 && Number.isFinite(tpPips) ? tpPips / slPips : null;

    return { lots: calculatedLots, slPips, tpPips, riskAmount, reward, rr, requiredMargin, riskSizing };
  }, [account, currency, market, normalizedLots, riskPercent, sizingMode, tradePlan]);

  const previewMargin = useMemo(() => {
    const price = Number(tradePlan?.entry ?? market?.ask);
    const previewLots = Number(planMetrics?.lots ?? normalizedLots);
    return estimateRequiredMargin(price, previewLots, market, account);
  }, [account, market, normalizedLots, planMetrics?.lots, tradePlan?.entry]);

  const freeMargin = Number(account?.freeMargin);
  const freeAfter = Number.isFinite(freeMargin) && Number.isFinite(previewMargin) ? freeMargin - previewMargin : null;
  const challenge = useMemo(
    () => calculateAccountRiskSummary(account, planMetrics?.riskAmount || 0),
    [account, planMetrics?.riskAmount],
  );

  const riskSupported = riskSizingSupported(market, currency);
  const riskSizingBlocked = sizingMode === 'risk' && Boolean(planMetrics?.riskSizing && planMetrics.riskSizing.canExecute === false);
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
    && (sizingMode !== 'risk' || riskSupported)
    && !riskSizingBlocked
    && riskGuard.allowed;

  const spreadPips = useMemo(() => {
    const pip = Number(market?.pipSize);
    const bid = Number(market?.bid);
    const ask = Number(market?.ask);
    return Number.isFinite(pip) && pip > 0 && Number.isFinite(bid) && Number.isFinite(ask)
      ? Math.abs(ask - bid) / pip
      : null;
  }, [market]);

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
  } else if (sizingMode === 'risk' && !riskSupported) {
    warning = 'Risk % sizing is unavailable because this instrument P&L cannot be converted safely to the account currency.';
  } else if (planMetrics?.riskSizing?.blockReason === 'INSUFFICIENT_MARGIN') {
    warning = `Required margin ${money(planMetrics.riskSizing.requiredMargin, currency)} exceeds free margin ${money(planMetrics.riskSizing.freeMargin, currency)}.`;
  } else if (planMetrics?.riskSizing?.blockReason === 'MAX_VOLUME') {
    warning = 'Selected risk requires more than the instrument maximum lot size.';
  } else if (planMetrics?.riskSizing?.blockReason === 'MIN_VOLUME') {
    warning = 'Selected risk is smaller than the instrument minimum lot size.';
  } else if (Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50) {
    warning = `Planned stop uses ${riskBufferUsage.toFixed(0)}% of the remaining daily-loss buffer.`;
  }

  const setLots = value => {
    const next = normalizeVolumeToStep(value, market, { rounding: 'nearest' });
    onLotsChange(next);
    setLotInput(Number(next).toFixed(lotDecimals));
    if (tradePlan) onTradePlanChange({ manualLots: next, sizingMode: 'lots' });
  };

  const commitLotInput = () => {
    const numeric = Number(String(lotInput).trim());
    setLots(Number.isFinite(numeric) && numeric > 0 ? numeric : normalizedLots);
    setLotFocused(false);
  };

  const setMode = mode => {
    onSizingModeChange(mode);
    if (tradePlan) onTradePlanChange({ sizingMode: mode, manualLots: normalizedLots });
  };

  const setRisk = value => {
    onRiskPercentChange(value);
    setMode('risk');
  };

  const clickSide = side => {
    if (!canSubmit || !market?.symbol) return;
    if (orderType !== 'market' || sizingMode === 'risk') {
      onStartPlan(side, orderType);
      return;
    }
    onManualOrder({
      side,
      lots: normalizedLots,
      price: side === 'buy' ? market.ask : market.bid,
      symbol: market.symbol,
    });
  };

  const startProtectedPlan = side => {
    if (!executableQuote || !exposureAllowed) return;
    onStartPlan(side, orderType === 'market' ? 'market' : orderType);
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
    const next = direction > 0
      ? Math.min(maxVolume, normalizedLots + volumeStep)
      : Math.max(minVolume, normalizedLots - volumeStep);
    setLots(next);
  };

  const pendingPlan = Boolean(tradePlan && !tradePlan.open);
  const selectedSide = String(tradePlan?.side || '').toLowerCase();
  const currentLots = Number(planMetrics?.lots ?? normalizedLots);
  const liveLabel = market?.sessionOpen === false ? 'CLOSED' : market?.live ? 'LIVE' : market?.isStale ? 'STALE' : String(market?.marketState || 'WAITING').toUpperCase();
  const hasStopLoss = Number.isFinite(Number(tradePlan?.sl));
  const hasTakeProfit = Number.isFinite(Number(tradePlan?.tp));
  const orderFamily = orderType === 'market' ? 'market' : 'pending';

  const chooseOrderFamily = family => {
    if (family === 'market') onOrderTypeChange('market');
    else if (orderType === 'market') onOrderTypeChange('limit');
    if (tradePlan) onCancelPlan();
  };

  const toggleTool = tool => setActiveTool(current => current === tool ? null : tool);

  const openRiskSizing = () => {
    toggleTool('risk');
    if (tradePlan && sizingMode !== 'risk') setMode('risk');
  };

  const openProtection = tool => toggleTool(tool);

  const applyCalculatedRiskLots = () => {
    if (!Number.isFinite(currentLots)) return;
    setLots(currentLots);
    setMode('lots');
    setActiveTool(null);
  };

  return (
    <section className="min-h-0 bg-[#07090B]">
      <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <strong className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#E6EDF3]">Order</strong>
          <span className="text-[9px] font-bold text-[#A1AFBC]">{market?.displaySymbol || market?.symbol || '—'}</span>
          <span className={`text-[6px] font-black ${market?.live ? 'text-[#38d6a2]' : 'text-[#697c8e]'}`}>● {liveLabel}</span>
        </div>
        <span className="text-[6.5px] font-semibold uppercase tracking-[0.07em] text-[#6F8191]">{orderFamily === 'market' && sizingMode === 'lots' ? '1-click' : 'planned'}</span>
      </div>

      <div className="space-y-2 overflow-y-auto px-2.5 py-2.5 [scrollbar-width:thin]">
        <div className="grid grid-cols-[1.25fr_1fr_.72fr_.72fr_30px] gap-1">
          <button
            type="button"
            onClick={() => toggleTool('market')}
            className={`h-8 rounded-md border px-2 text-[8px] font-bold uppercase tracking-[0.05em] ${orderFamily === 'market' ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-[#4f3d22] bg-[#151108] text-[#E7BD58]'}`}
          >
            {orderFamily === 'market' ? 'Market' : 'Pending'}
          </button>
          <button type="button" onClick={openRiskSizing} className={`h-8 rounded-md border text-[8px] font-bold uppercase tracking-[0.05em] ${sizingMode === 'risk' ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] bg-black text-[#7d90a2] hover:text-white'}`}>
            Risk{sizingMode === 'risk' ? ` ${Number(riskPercent).toFixed(2)}%` : ''}
          </button>
          <button type="button" onClick={() => openProtection('sl')} className={`h-8 rounded-md border text-[8px] font-bold ${hasStopLoss ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] bg-black text-[#7d90a2] hover:text-white'}`}>
            SL{hasStopLoss ? ' ✓' : ''}
          </button>
          <button type="button" onClick={() => openProtection('tp')} className={`h-8 rounded-md border text-[8px] font-bold ${hasTakeProfit ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] bg-black text-[#7d90a2] hover:text-white'}`}>
            TP{hasTakeProfit ? ' ✓' : ''}
          </button>
          <button type="button" onClick={() => setExpanded(value => !value)} className="grid h-8 place-items-center rounded-md border border-white/[0.06] bg-black text-[#7d90a2] hover:text-white" aria-label={expanded ? 'Collapse order ticket' : 'Expand order ticket'}>
            <ChevronDown size={13} className={`transition ${expanded ? 'rotate-180' : ''}`}/>
          </button>
        </div>

        {activeTool === 'market' && (
          <div className="rounded-md border border-white/[0.08] bg-[#0C1013] p-1 shadow-xl">
            <button type="button" onClick={() => { chooseOrderFamily('market'); setActiveTool(null); }} className={`flex h-8 w-full items-center justify-between rounded px-2 text-[8px] font-bold ${orderFamily === 'market' ? 'bg-white/[0.05] text-[#E6EDF3]' : 'text-[#8ea0b1] hover:bg-white/[0.03]'}`}><span>Market</span><span className="text-[6px] text-[#6F8191]">Immediate</span></button>
            <button type="button" onClick={() => { chooseOrderFamily('pending'); setActiveTool(null); setExpanded(true); }} className={`flex h-8 w-full items-center justify-between rounded px-2 text-[8px] font-bold ${orderFamily === 'pending' ? 'bg-white/[0.05] text-[#E7BD58]' : 'text-[#8ea0b1] hover:bg-white/[0.03]'}`}><span>Pending</span><span className="text-[6px] text-[#6F8191]">Limit / Stop</span></button>
          </div>
        )}

        {activeTool === 'risk' && (
          <div className="rounded-md border border-[#24485b] bg-[#071117] p-2 shadow-xl">
            <div className="mb-1.5 flex items-center justify-between"><strong className="text-[8px] uppercase tracking-[0.08em] text-[#A1AFBC]">Risk sizing</strong>{tradePlan && Number.isFinite(Number(tradePlan?.sl)) ? <span className="text-[6.5px] text-[#6F8191]">SL {formatInstrumentPrice(tradePlan.sl, market)}</span> : null}</div>
            {!tradePlan || !Number.isFinite(Number(tradePlan?.sl)) ? (
              <div>
                <p className="text-[7px] leading-3 text-[#7f93a6]">Set a stop loss first so ACG can calculate the lot size from your risk.</p>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <button type="button" onClick={() => { startProtectedPlan('sell'); setActiveTool('sl'); }} className="h-8 rounded border border-[#5b252e] text-[7px] font-bold text-[#FF6F7A]">SELL + SL</button>
                  <button type="button" onClick={() => { startProtectedPlan('buy'); setActiveTool('sl'); }} className="h-8 rounded border border-[#1c5c47] text-[7px] font-bold text-[#42D7A1]">BUY + SL</button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-1">
                  {RISK_PRESETS.map(value => <button key={value} type="button" onClick={() => setRisk(value)} className={`h-8 rounded border text-[7px] font-bold ${Math.abs(riskPercent-value)<0.001 ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] text-[#7d90a2]'}`}>{value.toFixed(2)}%</button>)}
                  <label className="flex h-8 items-center rounded border border-white/[0.06] bg-black px-1"><input type="number" min="0.1" max="5" step="0.05" value={riskPercent} onChange={event => setRisk(Math.max(0.1,Math.min(5,Number(event.target.value)||0.1)))} className="w-full bg-transparent text-center font-mono text-[8px] font-bold text-[#E6EDF3] outline-none"/><span className="text-[6px] text-[#6F8191]">%</span></label>
                </div>
                <div className="mt-2 flex items-center justify-between rounded border border-white/[0.05] bg-black px-2 py-1.5"><span className="text-[6.5px] text-[#6F8191]">Calculated size</span><strong className="font-mono text-[10px] text-[#E6EDF3]">{Number.isFinite(currentLots) ? currentLots.toFixed(Math.max(2,lotDecimals)) : '—'} lot</strong></div>
                <button type="button" onClick={applyCalculatedRiskLots} disabled={!Number.isFinite(currentLots)} className="mt-1.5 h-8 w-full rounded border border-[#315b72] bg-[#0d1a22] text-[7px] font-black text-[#59C7FF] disabled:opacity-30">USE {Number.isFinite(currentLots) ? currentLots.toFixed(Math.max(2,lotDecimals)) : '—'} LOT</button>
              </>
            )}
          </div>
        )}

        {(activeTool === 'sl' || activeTool === 'tp') && (
          <div className="rounded-md border border-white/[0.08] bg-[#0C1013] p-2 shadow-xl">
            <div className="mb-1.5 flex items-center justify-between"><strong className="text-[8px] uppercase tracking-[0.08em] text-[#A1AFBC]">{activeTool === 'sl' ? 'Stop loss' : 'Take profit'}</strong>{tradePlan ? <span className={`text-[6.5px] font-bold ${selectedSide === 'buy' ? 'text-[#42D7A1]' : 'text-[#FF6F7A]'}`}>{selectedSide.toUpperCase()}</span> : null}</div>
            {!tradePlan ? (
              <div className="grid grid-cols-2 gap-1">
                <button type="button" onClick={() => startProtectedPlan('sell')} className="h-8 rounded border border-[#5b252e] text-[7px] font-bold text-[#FF6F7A]">SELL setup</button>
                <button type="button" onClick={() => startProtectedPlan('buy')} className="h-8 rounded border border-[#1c5c47] text-[7px] font-bold text-[#42D7A1]">BUY setup</button>
              </div>
            ) : (
              <>
                <ProtectionRow
                  label={activeTool === 'sl' ? 'SL' : 'TP'}
                  disabled={!pendingPlan}
                  value={pendingPlan && Number.isFinite(Number(tradePlan?.[activeTool])) ? formatInstrumentPrice(tradePlan[activeTool], market, '') : ''}
                  meta={activeTool === 'sl'
                    ? (Number.isFinite(planMetrics?.slPips) ? `${planMetrics.slPips.toFixed(1)}p · ${Number.isFinite(planMetrics?.riskAmount) ? money(planMetrics.riskAmount,currency) : 'risk —'}` : 'Enter price or drag chart line')
                    : (Number.isFinite(planMetrics?.tpPips) ? `${planMetrics.tpPips.toFixed(1)}p · ${Number.isFinite(planMetrics?.reward) ? money(planMetrics.reward,currency) : 'profit —'}` : 'Enter price or drag chart line')}
                  tone={activeTool === 'sl' ? 'danger' : 'success'}
                  onChange={value => updateProtection(activeTool, value)}
                />
                <div className="mt-1.5 flex gap-1"><button type="button" onClick={() => { updateProtection(activeTool,''); setActiveTool(null); }} className="h-7 flex-1 rounded border border-white/[0.06] text-[6.5px] font-bold text-[#6F8191]">Remove</button><button type="button" onClick={() => setActiveTool(null)} className="h-7 flex-1 rounded border border-white/[0.08] bg-white/[0.04] text-[6.5px] font-bold text-[#E6EDF3]">Done</button></div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] gap-1.5">
          <button type="button" disabled={!canSubmit} onClick={() => clickSide('sell')} className="flex h-[58px] min-w-0 flex-col justify-center rounded-md border border-[#6d2d37] bg-[#18080c] px-2.5 text-left transition hover:bg-[#210b10] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35">
            <strong className="truncate font-mono text-[15px] font-black tracking-[-0.03em] text-[#f7edef]">{formatInstrumentPrice(market?.bid, market)}</strong>
            <span className="mt-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#FF6F7A]">Sell</span>
          </button>

          <div className="grid h-[58px] grid-cols-[24px_minmax(0,1fr)_24px] items-center rounded-md border border-white/[0.06] bg-black">
            <button type="button" onClick={() => nudgeLots(-1)} disabled={sizingMode === 'risk'} className="grid h-full place-items-center text-[#6F8191] hover:text-white disabled:opacity-25" aria-label="Decrease lot size"><Minus size={11}/></button>
            <div className="flex min-w-0 flex-col items-center justify-center">
              <input
                value={sizingMode === 'risk' && Number.isFinite(currentLots) ? currentLots.toFixed(Math.max(2, lotDecimals)) : lotInput}
                readOnly={sizingMode === 'risk'}
                onFocus={event => {
                  if (sizingMode === 'risk') return;
                  setLotFocused(true);
                  requestAnimationFrame(() => event.currentTarget.select());
                }}
                onChange={event => {
                  if (sizingMode !== 'risk') setLotInput(event.target.value.replace(/[^0-9.]/g, ''));
                }}
                onBlur={() => { if (sizingMode !== 'risk') commitLotInput(); }}
                onKeyDown={event => {
                  if (sizingMode === 'risk') return;
                  if (event.key === 'ArrowUp') { event.preventDefault(); nudgeLots(1); }
                  if (event.key === 'ArrowDown') { event.preventDefault(); nudgeLots(-1); }
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setLotInput(Number(normalizedLots).toFixed(lotDecimals));
                    event.currentTarget.blur();
                  }
                }}
                className="w-[54px] bg-transparent text-center font-mono text-[13px] font-black tabular-nums text-[#E6EDF3] outline-none"
                inputMode="decimal"
                aria-label="Lot size"
              />
              <span className="mt-0.5 text-[6px] font-semibold text-[#64788d]">{sizingMode === 'risk' ? 'calc. lots' : 'lot'}</span>
            </div>
            <button type="button" onClick={() => nudgeLots(1)} disabled={sizingMode === 'risk'} className="grid h-full place-items-center text-[#6F8191] hover:text-white disabled:opacity-25" aria-label="Increase lot size"><Plus size={11}/></button>
          </div>

          <button type="button" disabled={!canSubmit} onClick={() => clickSide('buy')} className="flex h-[58px] min-w-0 flex-col items-end justify-center rounded-md border border-[#246a51] bg-[#071710] px-2.5 text-right transition hover:bg-[#092016] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35">
            <strong className="truncate font-mono text-[15px] font-black tracking-[-0.03em] text-[#edf8f4]">{formatInstrumentPrice(market?.ask, market)}</strong>
            <span className="mt-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#42D7A1]">Buy</span>
          </button>
        </div>

        <div className="-mt-1 flex items-center justify-between px-0.5 text-[6px] font-semibold text-[#6F8191]">
          <span>Spread {Number.isFinite(spreadPips) ? `${spreadPips.toFixed(1)}p` : '—'}</span>
          <span>{orderFamily === 'market' ? 'Market execution' : String(orderType).replace('-', ' ')}</span>
        </div>

        {warning && (
          <div className="flex items-start gap-1.5 rounded-md border border-[#57363b] bg-[#14090c] px-2 py-1.5 text-[7px] font-semibold leading-3 text-[#dba2a8]">
            <AlertTriangle size={10} className="mt-0.5 shrink-0 text-[#FF6F7A]" />
            <span>{warning}</span>
          </div>
        )}

        {expanded && (
          <div className="space-y-2 border-t border-white/[0.06] pt-2">
            <div className="grid grid-cols-2 rounded-md border border-white/[0.06] bg-black p-0.5">
              <button type="button" onClick={() => chooseOrderFamily('market')} className={`h-8 rounded text-[8px] font-bold ${orderFamily === 'market' ? 'bg-white/[0.055] text-[#E6EDF3]' : 'text-[#627589]'}`}>MARKET</button>
              <button type="button" onClick={() => chooseOrderFamily('pending')} className={`h-8 rounded text-[8px] font-bold ${orderFamily === 'pending' ? 'bg-white/[0.055] text-[#E7BD58]' : 'text-[#627589]'}`}>PENDING</button>
            </div>

            {orderFamily === 'pending' && (
              <div className="grid grid-cols-3 gap-1">
                {ORDER_TYPES.filter(([id]) => id !== 'market').map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onOrderTypeChange(id);
                      if (tradePlan) onCancelPlan();
                    }}
                    className={`h-8 rounded border text-[8px] font-semibold ${orderType === id ? 'border-[#6d5830] bg-[#171208] text-[#E7BD58]' : 'border-white/[0.06] bg-black text-[#6F8191] hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-md border border-white/[0.06] bg-[#0C1013] p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <strong className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#A1AFBC]">Volume</strong>
                <button type="button" onClick={() => setMode(sizingMode === 'risk' ? 'lots' : 'risk')} className={`rounded border px-2 py-1 text-[6.5px] font-bold ${sizingMode === 'risk' ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] text-[#6F8191]'}`}>
                  {sizingMode === 'risk' ? 'Risk sizing on' : 'Use risk sizing'}
                </button>
              </div>

              {sizingMode === 'lots' ? (
                <>
                  <div className="grid grid-cols-[34px_minmax(0,1fr)_34px] items-center rounded-md border border-white/[0.06] bg-black">
                    <button type="button" onClick={() => nudgeLots(-1)} className="grid h-9 place-items-center text-[#778a9d] hover:bg-white/[0.025] hover:text-white"><Minus size={12}/></button>
                    <div className="flex items-center justify-center border-x border-white/[0.06]">
                      <input
                        value={lotInput}
                        onFocus={event => { setLotFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                        onChange={event => setLotInput(event.target.value.replace(/[^0-9.]/g, ''))}
                        onBlur={commitLotInput}
                        onKeyDown={event => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                          if (event.key === 'Escape') {
                            setLotInput(Number(normalizedLots).toFixed(lotDecimals));
                            event.currentTarget.blur();
                          }
                        }}
                        className="h-9 w-24 bg-transparent text-center font-mono text-[14px] font-black tabular-nums text-[#E6EDF3] outline-none"
                        inputMode="decimal"
                        aria-label="Lot size"
                      />
                      <span className="ml-1 text-[6.5px] font-semibold text-[#64788d]">lots</span>
                    </div>
                    <button type="button" onClick={() => nudgeLots(1)} className="grid h-9 place-items-center text-[#778a9d] hover:bg-white/[0.025] hover:text-white"><Plus size={12}/></button>
                  </div>
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    {LOT_PRESETS.filter(value => value >= minVolume && value <= maxVolume).map(value => (
                      <button key={value} type="button" onClick={() => setLots(value)} className={`h-7 rounded border font-mono text-[6.5px] font-bold ${Math.abs(normalizedLots - value) < volumeStep / 2 ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] text-[#687c90] hover:text-white'}`}>{value.toFixed(Math.max(2, lotDecimals))}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-[repeat(3,1fr)_1.2fr] gap-1">
                    {RISK_PRESETS.map(value => (
                      <button key={value} type="button" onClick={() => setRisk(value)} className={`h-8 rounded border text-[7px] font-bold ${Math.abs(riskPercent - value) < 0.001 ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] text-[#687c90] hover:text-white'}`}>{value.toFixed(2)}%</button>
                    ))}
                    <label className="flex h-8 items-center gap-1 rounded border border-white/[0.06] bg-black px-1.5">
                      <input type="number" min="0.1" max="5" step="0.05" value={riskPercent} onChange={event => onRiskPercentChange(Math.max(0.1, Math.min(5, Number(event.target.value) || 0.1)))} className="min-w-0 flex-1 bg-transparent text-center font-mono text-[10px] font-bold text-[#dbe5ed] outline-none" aria-label="Custom risk percent"/>
                      <span className="text-[6px] text-[#6F8191]">%</span>
                    </label>
                  </div>
                  <div className="mt-1 flex h-7 items-center justify-between rounded border border-white/[0.05] bg-black px-2 text-[6.5px] text-[#6F8191]">
                    <span>Calculated volume</span>
                    <b className="font-mono text-[8px] text-[#cdd9e3]">{Number.isFinite(currentLots) ? currentLots.toFixed(Math.max(2, lotDecimals)) : '—'} lots</b>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-md border border-white/[0.06] bg-[#0C1013] p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <strong className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#A1AFBC]">Protection</strong>
                {!pendingPlan && (
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={!executableQuote || !exposureAllowed} onClick={() => startProtectedPlan('sell')} className="h-7 rounded border border-[#5b252e] px-2 text-[6px] font-bold text-[#FF6F7A] disabled:opacity-30">SELL plan</button>
                    <button type="button" disabled={!executableQuote || !exposureAllowed} onClick={() => startProtectedPlan('buy')} className="h-7 rounded border border-[#1c5c47] px-2 text-[6px] font-bold text-[#42D7A1] disabled:opacity-30">BUY plan</button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <ProtectionRow
                  label="SL"
                  disabled={!pendingPlan}
                  value={pendingPlan && Number.isFinite(Number(tradePlan?.sl)) ? formatInstrumentPrice(tradePlan.sl, market, '') : ''}
                  meta={pendingPlan && Number.isFinite(planMetrics?.slPips) ? `${planMetrics.slPips.toFixed(1)}p · ${Number.isFinite(planMetrics?.riskAmount) ? money(planMetrics.riskAmount, currency) : 'risk —'}` : '+ Add stop loss'}
                  tone="danger"
                  onChange={value => updateProtection('sl', value)}
                />
                <ProtectionRow
                  label="TP"
                  disabled={!pendingPlan}
                  value={pendingPlan && Number.isFinite(Number(tradePlan?.tp)) ? formatInstrumentPrice(tradePlan.tp, market, '') : ''}
                  meta={pendingPlan && Number.isFinite(planMetrics?.tpPips) ? `${planMetrics.tpPips.toFixed(1)}p · ${Number.isFinite(planMetrics?.reward) ? money(planMetrics.reward, currency) : 'reward —'}` : '+ Add take profit'}
                  tone="success"
                  onChange={value => updateProtection('tp', value)}
                />
              </div>

              {pendingPlan && (
                <div className="mt-1.5 flex items-center gap-1">
                  <button type="button" onClick={onCancelPlan} className="h-7 flex-1 rounded border border-white/[0.06] text-[7px] font-bold text-[#A1AFBC]"><X size={9} className="mr-1 inline"/>Cancel</button>
                  <button type="button" disabled={!canSubmit} onClick={onExecutePlan} className={`h-7 flex-[1.5] rounded border text-[7px] font-black disabled:opacity-35 ${selectedSide === 'buy' ? 'border-[#246a51] bg-[#092016] text-[#42D7A1]' : 'border-[#6d2d37] bg-[#210b10] text-[#FF6F7A]'}`}><Check size={9} className="mr-1 inline"/>{tradePlan.pending ? (tradePlan.editingOrderId ? 'Update order' : 'Place order') : `Execute ${String(tradePlan.side).toUpperCase()}`}</button>
                </div>
              )}
            </div>

            <div className={`rounded-md border ${riskGuard.blocks.length ? 'border-[#5e2932]' : riskGuard.enabled ? 'border-[#24485b]' : 'border-white/[0.06]'} bg-[#071117]`}>
              <div className="flex h-9 items-center gap-2 px-2">
                <button type="button" onClick={() => setRiskGuardOpen(value => !value)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ShieldCheck size={12} className={riskGuard.blocks.length ? 'text-[#FF6F7A]' : riskGuard.enabled ? 'text-[#59C7FF]' : 'text-[#6F8191]'}/>
                  <strong className="text-[7px] font-black uppercase tracking-[0.07em] text-[#E6EDF3]">Risk Guard</strong>
                  <span className={`rounded px-1.5 py-0.5 text-[5.5px] font-black uppercase ${riskGuard.mode === 'block' ? 'bg-[#251015] text-[#ff7782]' : 'bg-[#0d1a22] text-[#59C7FF]'}`}>{riskGuard.mode}</span>
                  <span className="truncate text-[6px] text-[#6F8191]">{riskGuard.enabled ? (riskGuard.blocks[0]?.message || riskGuard.warnings[0]?.message || `${Number(riskGuardSettings?.maxRiskPerTrade || 1).toFixed(2)}% max trade`) : 'Disabled'}</span>
                </button>
                <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, enabled: !riskGuardSettings?.enabled })} className={`relative h-5 w-9 rounded-full border transition ${riskGuard.enabled ? 'border-[#2a6682] bg-[#0b2938]' : 'border-white/[0.06] bg-[#111]'}`} aria-label="Toggle Risk Guard">
                  <span className={`absolute top-[2px] size-3.5 rounded-full bg-white transition ${riskGuard.enabled ? 'left-[18px]' : 'left-[2px]'}`} />
                </button>
                <ChevronDown size={10} className={`text-[#6F8191] transition ${riskGuardOpen ? 'rotate-180' : ''}`}/>
              </div>

              {riskGuardOpen && (
                <div className="border-t border-white/[0.06] px-2 pb-2 pt-1.5">
                  <div className="grid grid-cols-4 gap-2">
                    <FieldMetric label="Trade" value={Number.isFinite(riskGuard.tradeRiskPercent) ? `${riskGuard.tradeRiskPercent.toFixed(2)}%` : '—'} />
                    <FieldMetric label="Open" value={Number.isFinite(riskGuard.openRiskPercent) ? `${riskGuard.openRiskPercent.toFixed(2)}%` : '—'} />
                    <FieldMetric label="After" value={Number.isFinite(riskGuard.projectedOpenRiskPercent) ? `${riskGuard.projectedOpenRiskPercent.toFixed(2)}%` : '—'} tone="accent" />
                    <FieldMetric label="Streak" value={String(riskGuard.consecutiveLosses)} />
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-1">
                    {[
                      ['Max trade', 'maxRiskPerTrade', 1, 0.1],
                      ['Max open', 'maxOpenRisk', 2, 0.1],
                      ['Daily stop', 'dailyStopPercent', 2.5, 0.1],
                      ['Loss streak', 'maxConsecutiveLosses', 3, 1],
                    ].map(([label, key, fallback, step]) => (
                      <label key={key} className="rounded border border-white/[0.06] bg-black px-1.5 py-1">
                        <span className="block text-[5.5px] uppercase text-[#6F8191]">{label}</span>
                        <input
                          type="number"
                          min={step}
                          max={key === 'maxConsecutiveLosses' ? 20 : 20}
                          step={step}
                          value={riskGuardSettings?.[key] ?? fallback}
                          onChange={event => onRiskGuardSettingsChange({ ...riskGuardSettings, [key]: Math.max(step, Number(event.target.value) || step) })}
                          className="mt-0.5 w-full bg-transparent font-mono text-[9px] font-semibold text-[#E6EDF3] outline-none"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, mode: 'warn' })} className={`h-6 rounded border text-[6.5px] font-bold ${riskGuard.mode === 'warn' ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] text-[#6d8195]'}`}>Warn only</button>
                    <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, mode: 'block' })} className={`h-6 rounded border text-[6.5px] font-bold ${riskGuard.mode === 'block' ? 'border-[#6d2d37] bg-[#210b10] text-[#FF6F7A]' : 'border-white/[0.06] text-[#6d8195]'}`}>Block at limits</button>
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={() => setDetailsOpen(value => !value)} className="flex h-7 w-full items-center justify-between border-t border-white/[0.06] px-0.5 text-[6.5px] font-semibold text-[#6F8191] hover:text-[#c8d3dc]">
              <span>Advanced details</span><ChevronDown size={10} className={detailsOpen ? 'rotate-180 transition' : 'transition'} />
            </button>

            {detailsOpen && (
              <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-md border border-white/[0.06] bg-black px-2 py-2">
                <FieldMetric label="Spread" value={Number.isFinite(spreadPips) ? `${spreadPips.toFixed(1)}p` : '—'} />
                <FieldMetric label="Leverage" value={effectiveLeverage(account, market) ? `1:${effectiveLeverage(account, market)}` : '—'} />
                <FieldMetric label="Free after" value={money(freeAfter, currency)} tone={Number.isFinite(freeAfter) && freeAfter < 0 ? 'danger' : 'default'} />
                <FieldMetric label="Risk at SL" value={Number.isFinite(planMetrics?.riskAmount) ? money(planMetrics.riskAmount, currency) : '—'} tone={Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50 ? 'danger' : 'default'} />
                <FieldMetric label="R:R" value={Number.isFinite(planMetrics?.rr) ? `1:${planMetrics.rr.toFixed(2)}` : '—'} tone="accent" />
                <FieldMetric label="Daily room" value={challenge.riskAvailabilityLive ? money(challenge.remainingDaily, currency) : '—'} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
