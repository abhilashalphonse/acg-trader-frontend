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
    ? 'text-[#ff727d]'
    : tone === 'success'
      ? 'text-[#45d9a5]'
      : tone === 'accent'
        ? 'text-[#63caff]'
        : 'text-[#dce6ef]';
  return (
    <div className="min-w-0">
      <span className="block text-[6px] font-bold uppercase tracking-[0.075em] text-[#566a7d]">{label}</span>
      <strong className={`mt-0.5 block truncate font-mono text-[8px] font-bold tabular-nums ${toneClass}`}>{value}</strong>
    </div>
  );
}

function ProtectionRow({ label, value, meta, tone = 'default', disabled = false, onChange }) {
  const toneClass = tone === 'danger' ? 'text-[#ff727d]' : tone === 'success' ? 'text-[#45d9a5]' : 'text-[#dce6ef]';
  return (
    <label className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1.5 ${disabled ? 'border-white/[0.05] bg-black/40 opacity-65' : 'border-white/[0.07] bg-black'}`}>
      <span className="text-[7px] font-black text-[#718497]">{label}</span>
      {disabled ? (
        <span className="text-[7px] font-semibold text-[#566a7d]">Choose a side to create a protected plan</span>
      ) : (
        <input
          inputMode="decimal"
          value={value ?? ''}
          onFocus={event => event.currentTarget.select()}
          onChange={event => onChange?.(event.target.value.replace(/[^0-9.]/g, ''))}
          className={`min-w-0 bg-transparent font-mono text-[9px] font-bold tabular-nums outline-none ${toneClass}`}
          aria-label={`${label} price`}
        />
      )}
      <span className="whitespace-nowrap text-[6.5px] font-semibold text-[#65798d]">{meta}</span>
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
  } else if (sizingMode === 'lots' && orderType === 'market' && !tradePlan) {
    warning = 'One-click execution has no predefined stop loss. Create a protected plan to cap risk before entry.';
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

  return (
    <section className="min-h-0 border-t border-white/[0.08] bg-[#070707]">
      <div className="flex h-9 items-center justify-between border-b border-white/[0.06] px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <strong className="text-[8px] font-black uppercase tracking-[0.09em] text-[#d0d9e1]">Order</strong>
          <span className="text-[8px] font-bold text-[#7f92a4]">{market?.displaySymbol || market?.symbol || '—'}</span>
          <span className={`text-[6px] font-black ${market?.live ? 'text-[#38d6a2]' : 'text-[#697c8e]'}`}>● {liveLabel}</span>
        </div>
        <span className="text-[6.5px] text-[#53677a]">{orderType === 'market' && sizingMode === 'lots' ? '1-click' : 'planned'}</span>
      </div>

      <div className="space-y-1.5 overflow-y-auto px-2 py-2 [scrollbar-width:thin]">
        <div className="grid grid-cols-4 gap-1">
          {ORDER_TYPES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onOrderTypeChange(id);
                if (tradePlan) onCancelPlan();
              }}
              className={`h-7 rounded border text-[7px] font-bold transition ${orderType === id ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.055] bg-black text-[#65798d] hover:text-[#d2dce5]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[6px] font-black uppercase tracking-[0.08em] text-[#566a7d]">Size by</span>
          <div className="flex flex-1 items-center rounded-md border border-white/[0.065] bg-black p-0.5">
            <button type="button" onClick={() => setMode('lots')} className={`h-6 flex-1 rounded text-[7px] font-bold ${sizingMode === 'lots' ? 'bg-white/[0.055] text-[#f0f4f7]' : 'text-[#627589]'}`}>Lots</button>
            <button type="button" onClick={() => setMode('risk')} className={`h-6 flex-1 rounded text-[7px] font-bold ${sizingMode === 'risk' ? 'bg-white/[0.055] text-[#f0f4f7]' : 'text-[#627589]'}`}>Risk %</button>
          </div>
        </div>

        {sizingMode === 'lots' ? (
          <>
            <div className="grid grid-cols-[30px_minmax(0,1fr)_30px] items-center rounded-md border border-white/[0.07] bg-black">
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
                  className="h-9 w-20 bg-transparent text-center font-mono text-[13px] font-black tabular-nums text-[#f0f4f7] outline-none"
                  inputMode="decimal"
                  aria-label="Lot size"
                />
                <span className="ml-1 text-[6.5px] font-semibold text-[#64788d]">lots</span>
              </div>
              <button type="button" onClick={() => nudgeLots(1)} className="grid h-9 place-items-center text-[#778a9d] hover:bg-white/[0.025] hover:text-white"><Plus size={12}/></button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {LOT_PRESETS.filter(value => value >= minVolume && value <= maxVolume).map(value => (
                <button key={value} type="button" onClick={() => setLots(value)} className={`h-6 rounded border font-mono text-[6.5px] font-bold ${Math.abs(normalizedLots - value) < volumeStep / 2 ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.055] text-[#687c90] hover:text-white'}`}>{value.toFixed(Math.max(2, lotDecimals))}</button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-[repeat(3,1fr)_1.2fr] gap-1">
            {RISK_PRESETS.map(value => (
              <button key={value} type="button" onClick={() => setRisk(value)} className={`h-8 rounded border text-[7px] font-bold ${Math.abs(riskPercent - value) < 0.001 ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.055] text-[#687c90] hover:text-white'}`}>{value.toFixed(2)}%</button>
            ))}
            <label className="flex h-8 items-center gap-1 rounded border border-white/[0.06] bg-black px-1.5">
              <input type="number" min="0.1" max="5" step="0.05" value={riskPercent} onChange={event => onRiskPercentChange(Math.max(0.1, Math.min(5, Number(event.target.value) || 0.1)))} className="min-w-0 flex-1 bg-transparent text-center font-mono text-[8px] font-bold text-[#dbe5ed] outline-none" aria-label="Custom risk percent"/>
              <span className="text-[6px] text-[#60758a]">%</span>
            </label>
          </div>
        )}

        {sizingMode === 'risk' && (
          <div className="flex h-6 items-center justify-between rounded border border-white/[0.05] bg-black px-2 text-[6.5px] text-[#60758a]">
            <span>Calculated volume</span>
            <b className="font-mono text-[8px] text-[#cdd9e3]">{Number.isFinite(currentLots) ? currentLots.toFixed(Math.max(2, lotDecimals)) : '—'} lots</b>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={!canSubmit} onClick={() => clickSide('sell')} className={`flex h-[50px] min-w-0 flex-col justify-center rounded-md border px-2.5 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 ${selectedSide === 'sell' ? 'border-[#a53545] bg-[#19090d]' : 'border-[#5b252e] bg-black hover:bg-[#12070a]'}`}>
            <span className="text-[7px] font-black tracking-[0.08em] text-[#ff6673]">SELL</span>
            <strong className="mt-0.5 truncate font-mono text-[16px] font-black tracking-[-0.03em] text-[#f7edef]">{formatInstrumentPrice(market?.bid, market)}</strong>
          </button>
          <button type="button" disabled={!canSubmit} onClick={() => clickSide('buy')} className={`flex h-[50px] min-w-0 flex-col items-end justify-center rounded-md border px-2.5 text-right transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 ${selectedSide === 'buy' ? 'border-[#21845f] bg-[#071710]' : 'border-[#1c5c47] bg-black hover:bg-[#06110d]'}`}>
            <span className="text-[7px] font-black tracking-[0.08em] text-[#38d9a2]">BUY</span>
            <strong className="mt-0.5 truncate font-mono text-[16px] font-black tracking-[-0.03em] text-[#edf8f4]">{formatInstrumentPrice(market?.ask, market)}</strong>
          </button>
        </div>
        <div className="-mt-0.5 text-center text-[6px] font-semibold text-[#53677a]">Spread {Number.isFinite(spreadPips) ? `${spreadPips.toFixed(1)}p` : '—'}</div>

        <div className="rounded-md border border-white/[0.065] bg-[#080808] p-1.5">
          <div className="mb-1.5 flex items-center justify-between">
            <strong className="text-[6.5px] font-black uppercase tracking-[0.08em] text-[#718497]">Protection</strong>
            {!pendingPlan && (
              <div className="flex items-center gap-1">
                <button type="button" disabled={!executableQuote || !exposureAllowed} onClick={() => startProtectedPlan('sell')} className="h-5 rounded border border-[#5b252e] px-1.5 text-[6px] font-bold text-[#ff727d] disabled:opacity-30">SELL plan</button>
                <button type="button" disabled={!executableQuote || !exposureAllowed} onClick={() => startProtectedPlan('buy')} className="h-5 rounded border border-[#1c5c47] px-1.5 text-[6px] font-bold text-[#45d9a5] disabled:opacity-30">BUY plan</button>
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
              <button type="button" onClick={onCancelPlan} className="h-7 flex-1 rounded border border-white/[0.07] text-[7px] font-bold text-[#8999a8]"><X size={9} className="mr-1 inline"/>Cancel</button>
              <button type="button" disabled={!canSubmit} onClick={onExecutePlan} className={`h-7 flex-[1.5] rounded border text-[7px] font-black disabled:opacity-35 ${selectedSide === 'buy' ? 'border-[#246a51] bg-[#092016] text-[#4adea8]' : 'border-[#6d2d37] bg-[#210b10] text-[#ff727d]'}`}><Check size={9} className="mr-1 inline"/>{tradePlan.pending ? (tradePlan.editingOrderId ? 'Update order' : 'Place order') : `Execute ${String(tradePlan.side).toUpperCase()}`}</button>
            </div>
          )}
        </div>

        <div className="rounded-md border border-white/[0.055] bg-black px-2 py-1.5">
          <div className="mb-1 text-[6px] font-black uppercase tracking-[0.08em] text-[#506477]">After this trade</div>
          <div className="grid grid-cols-4 gap-2">
            <FieldMetric label="Risk" value={Number.isFinite(planMetrics?.riskAmount) ? `${money(planMetrics.riskAmount, currency, true)} · ${Number.isFinite(riskGuard.tradeRiskPercent) ? `${riskGuard.tradeRiskPercent.toFixed(2)}%` : ''}` : '—'} tone={Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50 ? 'danger' : 'default'} />
            <FieldMetric label="Margin" value={money(previewMargin, currency, true)} />
            <FieldMetric label="Free" value={money(freeAfter, currency, true)} tone={Number.isFinite(freeAfter) && freeAfter < 0 ? 'danger' : 'default'} />
            <FieldMetric label="R:R" value={Number.isFinite(planMetrics?.rr) ? `1:${planMetrics.rr.toFixed(2)}` : '—'} tone="accent" />
          </div>
        </div>

        {warning && (
          <div className="flex items-start gap-1.5 rounded-md border border-[#57363b] bg-[#14090c] px-2 py-1.5 text-[7px] font-semibold leading-3 text-[#dba2a8]">
            <AlertTriangle size={10} className="mt-0.5 shrink-0 text-[#ff727d]" />
            <span>{warning}</span>
          </div>
        )}

        <div className={`rounded-md border ${riskGuard.blocks.length ? 'border-[#5e2932]' : riskGuard.enabled ? 'border-[#24485b]' : 'border-white/[0.055]'} bg-[#071117]`}>
          <div className="flex h-8 items-center gap-2 px-2">
            <button type="button" onClick={() => setRiskGuardOpen(value => !value)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <ShieldCheck size={12} className={riskGuard.blocks.length ? 'text-[#ff727d]' : riskGuard.enabled ? 'text-[#63caff]' : 'text-[#60758a]'}/>
              <strong className="text-[7px] font-black uppercase tracking-[0.07em] text-[#c9d6df]">Risk Guard</strong>
              <span className={`rounded px-1.5 py-0.5 text-[5.5px] font-black uppercase ${riskGuard.mode === 'block' ? 'bg-[#251015] text-[#ff7782]' : 'bg-[#0d1a22] text-[#63caff]'}`}>{riskGuard.mode}</span>
              <span className="truncate text-[6px] text-[#60758a]">{riskGuard.enabled ? (riskGuard.blocks[0]?.message || riskGuard.warnings[0]?.message || `${Number(riskGuardSettings?.maxRiskPerTrade || 1).toFixed(2)}% max trade`) : 'Disabled'}</span>
            </button>
            <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, enabled: !riskGuardSettings?.enabled })} className={`relative h-5 w-9 rounded-full border transition ${riskGuard.enabled ? 'border-[#2a6682] bg-[#0b2938]' : 'border-white/[0.08] bg-[#111]'}`} aria-label="Toggle Risk Guard">
              <span className={`absolute top-[2px] size-3.5 rounded-full bg-white transition ${riskGuard.enabled ? 'left-[18px]' : 'left-[2px]'}`} />
            </button>
            <ChevronDown size={10} className={`text-[#60758a] transition ${riskGuardOpen ? 'rotate-180' : ''}`}/>
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
                  <label key={key} className="rounded border border-white/[0.055] bg-black px-1.5 py-1">
                    <span className="block text-[5.5px] uppercase text-[#566a7d]">{label}</span>
                    <input
                      type="number"
                      min={step}
                      max={key === 'maxConsecutiveLosses' ? 20 : 20}
                      step={step}
                      value={riskGuardSettings?.[key] ?? fallback}
                      onChange={event => onRiskGuardSettingsChange({ ...riskGuardSettings, [key]: Math.max(step, Number(event.target.value) || step) })}
                      className="mt-0.5 w-full bg-transparent font-mono text-[7.5px] font-bold text-[#dce6ef] outline-none"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, mode: 'warn' })} className={`h-6 rounded border text-[6.5px] font-bold ${riskGuard.mode === 'warn' ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.055] text-[#6d8195]'}`}>Warn only</button>
                <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, mode: 'block' })} className={`h-6 rounded border text-[6.5px] font-bold ${riskGuard.mode === 'block' ? 'border-[#6d2d37] bg-[#210b10] text-[#ff727d]' : 'border-white/[0.055] text-[#6d8195]'}`}>Block at limits</button>
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setDetailsOpen(value => !value)} className="flex h-7 w-full items-center justify-between border-t border-white/[0.055] px-0.5 text-[6.5px] font-semibold text-[#617487] hover:text-[#c8d3dc]">
          <span>Order details</span><ChevronDown size={10} className={detailsOpen ? 'rotate-180 transition' : 'transition'} />
        </button>

        {detailsOpen && (
          <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-md border border-white/[0.055] bg-black px-2 py-2">
            <FieldMetric label="Spread" value={Number.isFinite(spreadPips) ? `${spreadPips.toFixed(1)}p` : '—'} />
            <FieldMetric label="Leverage" value={effectiveLeverage(account, market) ? `1:${effectiveLeverage(account, market)}` : '—'} />
            <FieldMetric label="Reward" value={Number.isFinite(planMetrics?.reward) ? money(planMetrics.reward, currency) : '—'} tone="success" />
            <FieldMetric label="Daily room" value={challenge.riskAvailabilityLive ? money(challenge.remainingDaily, currency) : '—'} />
            <FieldMetric label="After SL" value={challenge.riskAvailabilityLive && Number.isFinite(planMetrics?.riskAmount) ? money(challenge.postTradeDaily, currency) : '—'} tone={Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50 ? 'danger' : 'success'} />
            <FieldMetric label="Max room" value={challenge.riskAvailabilityLive ? money(challenge.remainingMax, currency) : '—'} />
          </div>
        )}
      </div>
    </section>
  );
}
