import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Minus, Plus, X } from 'lucide-react';
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

function money(value, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '—';
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

function Metric({ label, value, tone = 'default' }) {
  const valueClass = tone === 'danger'
    ? 'text-[#ff727d]'
    : tone === 'success'
      ? 'text-[#45d9a5]'
      : tone === 'accent'
        ? 'text-[#63caff]'
        : 'text-[#dce6ef]';

  return (
    <div className="min-w-0 border-t border-white/[0.06] py-1.5">
      <span className="block text-[6.5px] font-semibold uppercase tracking-[0.07em] text-[#566a7d]">{label}</span>
      <strong className={`mt-0.5 block truncate font-mono text-[9px] font-bold tabular-nums ${valueClass}`}>{value}</strong>
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

    return {
      lots: calculatedLots,
      slPips,
      tpPips,
      riskAmount,
      reward,
      rr,
      requiredMargin,
      riskSizing,
    };
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

  const warning = riskGuard.blocks[0]?.message || !exposureAllowed
    ? exposureBlockReason
    : !executableQuote
      ? market?.sessionOpen === false
        ? 'Market session is closed.'
        : market?.isStale
          ? 'Quote is stale. New exposure is disabled.'
          : 'Waiting for an executable quote.'
      : sizingMode === 'risk' && !riskSupported
        ? 'Risk % sizing is unavailable because this instrument P&L cannot be converted safely to the account currency.'
        : planMetrics?.riskSizing?.blockReason === 'INSUFFICIENT_MARGIN'
          ? `Required margin ${money(planMetrics.riskSizing.requiredMargin, currency)} exceeds free margin ${money(planMetrics.riskSizing.freeMargin, currency)}.`
          : planMetrics?.riskSizing?.blockReason === 'MAX_VOLUME'
            ? 'Selected risk requires more than the instrument maximum lot size.'
            : planMetrics?.riskSizing?.blockReason === 'MIN_VOLUME'
              ? 'Selected risk is smaller than the instrument minimum lot size.'
              : Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50
                ? `Planned stop uses ${riskBufferUsage.toFixed(0)}% of the remaining daily-loss buffer.`
                : sizingMode === 'lots' && orderType === 'market' && !tradePlan
                  ? 'One-click lot execution has no predefined stop loss. Risk is not capped until an SL is added.'
                  : null;

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

  const nudgeLots = direction => {
    const next = direction > 0
      ? Math.min(maxVolume, normalizedLots + volumeStep)
      : Math.max(minVolume, normalizedLots - volumeStep);
    setLots(next);
  };

  const pendingPlan = Boolean(tradePlan && !tradePlan.open);
  const selectedSide = String(tradePlan?.side || '').toLowerCase();

  return (
    <section className="shrink-0 border-t border-white/[0.08] bg-[#070707]">
      <div className="flex h-8 items-center justify-between border-b border-white/[0.06] px-2.5">
        <div className="flex items-center gap-2">
          <strong className="text-[8px] font-extrabold uppercase tracking-[0.09em] text-[#d0d9e1]">Order</strong>
          <span className={`size-1.5 rounded-full ${canSubmit ? 'bg-[#36d5a0]' : 'bg-[#4a4a4a]'}`} />
        </div>
        <span className="text-[7px] text-[#5d7185]">{orderType === 'market' ? '1-click execution' : 'Chart-planned order'}</span>
      </div>

      <div className="space-y-2 px-2 py-2">
        <div className="grid grid-cols-4 gap-1">
          {ORDER_TYPES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onOrderTypeChange(id);
                if (tradePlan) onCancelPlan();
              }}
              className={`h-7 rounded border text-[7px] font-bold transition ${orderType === id ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.06] bg-black text-[#6d8195] hover:text-[#d2dce5]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-white/[0.07] bg-black p-1">
          <button type="button" onClick={() => setMode('lots')} className={`h-7 flex-1 rounded text-[8px] font-bold ${sizingMode === 'lots' ? 'bg-white/[0.055] text-[#f0f4f7]' : 'text-[#6a7d90]'}`}>Lots</button>
          <button type="button" onClick={() => setMode('risk')} className={`h-7 flex-1 rounded text-[8px] font-bold ${sizingMode === 'risk' ? 'bg-white/[0.055] text-[#f0f4f7]' : 'text-[#6a7d90]'}`}>Risk %</button>
        </div>

        {sizingMode === 'lots' ? (
          <>
            <div className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center rounded-md border border-white/[0.07] bg-black">
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
                <span className="ml-1 text-[7px] font-semibold text-[#64788d]">lots</span>
              </div>
              <button type="button" onClick={() => nudgeLots(1)} className="grid h-9 place-items-center text-[#778a9d] hover:bg-white/[0.025] hover:text-white"><Plus size={12}/></button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {LOT_PRESETS.filter(value => value >= minVolume && value <= maxVolume).map(value => (
                <button key={value} type="button" onClick={() => setLots(value)} className={`h-6 rounded border font-mono text-[7px] font-bold ${Math.abs(normalizedLots - value) < volumeStep / 2 ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.06] text-[#708397] hover:text-white'}`}>{value.toFixed(Math.max(2, lotDecimals))}</button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {RISK_PRESETS.map(value => (
              <button key={value} type="button" onClick={() => setRisk(value)} className={`h-8 rounded border text-[8px] font-bold ${Math.abs(riskPercent - value) < 0.001 ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.06] text-[#708397] hover:text-white'}`}>{value.toFixed(2)}%</button>
            ))}
            <div className="flex h-8 items-center rounded border border-white/[0.06] bg-black px-1">
              <input
                type="number"
                min="0.1"
                max="5"
                step="0.05"
                value={riskPercent}
                onChange={event => {
                  const next = Math.max(0.1, Math.min(5, Number(event.target.value) || 0.1));
                  onRiskPercentChange(next);
                }}
                className="min-w-0 flex-1 bg-transparent text-center font-mono text-[8px] font-bold text-[#dbe5ed] outline-none"
                aria-label="Custom risk percent"
              />
              <span className="text-[7px] text-[#60758a]">%</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_74px_minmax(0,1fr)] gap-1.5">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => clickSide('sell')}
            className={`flex h-[52px] min-w-0 flex-col justify-center rounded-md border px-2.5 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 ${selectedSide === 'sell' ? 'border-[#a53545] bg-[#19090d]' : 'border-[#5b252e] bg-black hover:bg-[#12070a]'}`}
          >
            <span className="text-[7px] font-black tracking-[0.08em] text-[#ff6673]">SELL</span>
            <strong className="mt-1 truncate font-mono text-[16px] font-black tracking-[-0.03em] text-[#f7edef]">{formatInstrumentPrice(market?.bid, market)}</strong>
          </button>

          <div className="grid h-[52px] place-items-center rounded-md border border-white/[0.07] bg-black text-center">
            <div>
              <strong className="block font-mono text-[10px] text-[#dbe4ec]">{Number(planMetrics?.lots ?? normalizedLots).toFixed(Math.max(2, lotDecimals))}</strong>
              <span className="mt-0.5 block text-[6.5px] uppercase tracking-[0.06em] text-[#5f7386]">{sizingMode === 'risk' ? 'calc lots' : 'lots'}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => clickSide('buy')}
            className={`flex h-[52px] min-w-0 flex-col items-end justify-center rounded-md border px-2.5 text-right transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 ${selectedSide === 'buy' ? 'border-[#21845f] bg-[#071710]' : 'border-[#1c5c47] bg-black hover:bg-[#06110d]'}`}
          >
            <span className="text-[7px] font-black tracking-[0.08em] text-[#38d9a2]">BUY</span>
            <strong className="mt-1 truncate font-mono text-[16px] font-black tracking-[-0.03em] text-[#edf8f4]">{formatInstrumentPrice(market?.ask, market)}</strong>
          </button>
        </div>

        {pendingPlan && (
          <div className="rounded-md border border-[#28465a] bg-[#08131a] px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <strong className="text-[8px] font-black text-[#d8e6f0]">{String(tradePlan.side).toUpperCase()} {String(tradePlan.orderType).toUpperCase()} PLAN</strong>
                <span className="ml-2 text-[7px] text-[#6f879a]">Drag Entry / SL / TP on chart</span>
              </div>
              <button type="button" onClick={onCancelPlan} className="grid size-6 place-items-center rounded text-[#71879a] hover:bg-white/[0.04] hover:text-white" aria-label="Cancel trade plan"><X size={12}/></button>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <Metric label="Entry" value={formatInstrumentPrice(tradePlan.entry, market)} />
              <Metric label="SL" value={Number.isFinite(planMetrics?.slPips) ? `${planMetrics.slPips.toFixed(1)}p` : '—'} />
              <Metric label="R:R" value={Number.isFinite(planMetrics?.rr) ? `1:${planMetrics.rr.toFixed(2)}` : '—'} tone="accent" />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={onCancelPlan} className="h-8 rounded border border-white/[0.07] text-[8px] font-bold text-[#8999a8]">Cancel</button>
              <button type="button" disabled={!canSubmit} onClick={onExecutePlan} className={`flex h-8 items-center justify-center gap-1 rounded border text-[8px] font-black disabled:opacity-35 ${selectedSide === 'buy' ? 'border-[#246a51] bg-[#092016] text-[#4adea8]' : 'border-[#6d2d37] bg-[#210b10] text-[#ff727d]'}`}><Check size={11}/>{tradePlan.pending ? (tradePlan.editingOrderId ? 'Update order' : 'Place order') : `Execute ${String(tradePlan.side).toUpperCase()}`}</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-x-2">
          <Metric label="Risk" value={Number.isFinite(planMetrics?.riskAmount) ? money(planMetrics.riskAmount, currency) : 'No SL'} tone={Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50 ? 'danger' : 'default'} />
          <Metric label="Margin" value={money(previewMargin, currency)} />
          <Metric label="Free after" value={money(freeAfter, currency)} tone={Number.isFinite(freeAfter) && freeAfter < 0 ? 'danger' : 'default'} />
          <Metric label="R:R" value={Number.isFinite(planMetrics?.rr) ? `1:${planMetrics.rr.toFixed(2)}` : '—'} tone="accent" />
        </div>

        <div className={`rounded-md border px-2 py-2 ${riskGuard.enabled ? 'border-[#24485b] bg-[#071117]' : 'border-white/[0.06] bg-black'}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <strong className="text-[8px] font-black uppercase tracking-[0.08em] text-[#c9d6df]">Risk Guard</strong>
                <span className={`rounded px-1.5 py-0.5 text-[6px] font-black uppercase ${riskGuard.mode === 'block' ? 'bg-[#251015] text-[#ff7782]' : 'bg-[#0d1a22] text-[#63caff]'}`}>{riskGuard.mode}</span>
              </div>
              <span className="mt-0.5 block text-[6.5px] text-[#61768a]">Personal protection; backend challenge rules remain authoritative.</span>
            </div>
            <button
              type="button"
              onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, enabled: !riskGuardSettings?.enabled })}
              className={`relative h-5 w-9 rounded-full border transition ${riskGuard.enabled ? 'border-[#2a6682] bg-[#0b2938]' : 'border-white/[0.08] bg-[#111]'}`}
              aria-label="Toggle Risk Guard"
            >
              <span className={`absolute top-[2px] size-3.5 rounded-full bg-white transition ${riskGuard.enabled ? 'left-[18px]' : 'left-[2px]'}`} />
            </button>
          </div>

          {riskGuard.enabled && (
            <>
              <div className="mt-2 grid grid-cols-4 gap-x-2">
                <Metric label="Trade risk" value={Number.isFinite(riskGuard.tradeRiskPercent) ? `${riskGuard.tradeRiskPercent.toFixed(2)}%` : '—'} tone={riskGuard.blocks.some(item => item.code === 'MAX_RISK_PER_TRADE') ? 'danger' : 'default'} />
                <Metric label="Open risk" value={Number.isFinite(riskGuard.openRiskPercent) ? `${riskGuard.openRiskPercent.toFixed(2)}%` : '—'} />
                <Metric label="After trade" value={Number.isFinite(riskGuard.projectedOpenRiskPercent) ? `${riskGuard.projectedOpenRiskPercent.toFixed(2)}%` : '—'} tone={riskGuard.blocks.some(item => item.code === 'MAX_OPEN_RISK') ? 'danger' : 'accent'} />
                <Metric label="Loss streak" value={String(riskGuard.consecutiveLosses)} tone={riskGuard.blocks.some(item => item.code === 'LOSS_STREAK') ? 'danger' : 'default'} />
              </div>

              <div className="mt-1.5 grid grid-cols-4 gap-1">
                <label className="rounded border border-white/[0.06] bg-black px-1.5 py-1">
                  <span className="block text-[6px] uppercase text-[#566a7d]">Max trade</span>
                  <div className="mt-0.5 flex items-center"><input type="number" min="0.1" max="10" step="0.1" value={riskGuardSettings?.maxRiskPerTrade ?? 1} onChange={event => onRiskGuardSettingsChange({ ...riskGuardSettings, maxRiskPerTrade: Math.max(0.1, Number(event.target.value) || 0.1) })} className="min-w-0 flex-1 bg-transparent font-mono text-[8px] font-bold text-[#dce6ef] outline-none"/><span className="text-[6px] text-[#61768a]">%</span></div>
                </label>
                <label className="rounded border border-white/[0.06] bg-black px-1.5 py-1">
                  <span className="block text-[6px] uppercase text-[#566a7d]">Max open</span>
                  <div className="mt-0.5 flex items-center"><input type="number" min="0.1" max="20" step="0.1" value={riskGuardSettings?.maxOpenRisk ?? 2} onChange={event => onRiskGuardSettingsChange({ ...riskGuardSettings, maxOpenRisk: Math.max(0.1, Number(event.target.value) || 0.1) })} className="min-w-0 flex-1 bg-transparent font-mono text-[8px] font-bold text-[#dce6ef] outline-none"/><span className="text-[6px] text-[#61768a]">%</span></div>
                </label>
                <label className="rounded border border-white/[0.06] bg-black px-1.5 py-1">
                  <span className="block text-[6px] uppercase text-[#566a7d]">Daily stop</span>
                  <div className="mt-0.5 flex items-center"><input type="number" min="0.1" max="20" step="0.1" value={riskGuardSettings?.dailyStopPercent ?? 2.5} onChange={event => onRiskGuardSettingsChange({ ...riskGuardSettings, dailyStopPercent: Math.max(0.1, Number(event.target.value) || 0.1) })} className="min-w-0 flex-1 bg-transparent font-mono text-[8px] font-bold text-[#dce6ef] outline-none"/><span className="text-[6px] text-[#61768a]">%</span></div>
                </label>
                <label className="rounded border border-white/[0.06] bg-black px-1.5 py-1">
                  <span className="block text-[6px] uppercase text-[#566a7d]">Loss streak</span>
                  <input type="number" min="1" max="20" step="1" value={riskGuardSettings?.maxConsecutiveLosses ?? 3} onChange={event => onRiskGuardSettingsChange({ ...riskGuardSettings, maxConsecutiveLosses: Math.max(1, Math.round(Number(event.target.value) || 1)) })} className="mt-0.5 w-full bg-transparent font-mono text-[8px] font-bold text-[#dce6ef] outline-none"/>
                </label>
              </div>

              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, mode: 'warn' })} className={`h-6 rounded border text-[7px] font-bold ${riskGuard.mode === 'warn' ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.06] text-[#6d8195]'}`}>Warn only</button>
                <button type="button" onClick={() => onRiskGuardSettingsChange({ ...riskGuardSettings, mode: 'block' })} className={`h-6 rounded border text-[7px] font-bold ${riskGuard.mode === 'block' ? 'border-[#6d2d37] bg-[#210b10] text-[#ff727d]' : 'border-white/[0.06] text-[#6d8195]'}`}>Block at limits</button>
              </div>

              {(riskGuard.blocks.length > 0 || riskGuard.warnings.length > 0) && (
                <div className="mt-1.5 space-y-1">
                  {[...riskGuard.blocks, ...riskGuard.warnings].slice(0, 2).map(item => (
                    <div key={item.code} className={`flex items-start gap-1.5 rounded px-1.5 py-1 text-[6.8px] font-semibold leading-3 ${item.severity === 'limit' ? 'bg-[#16090c] text-[#e2a5ab]' : 'bg-[#0c1115] text-[#8ea3b6]'}`}>
                      <AlertTriangle size={9} className={item.severity === 'limit' ? 'mt-0.5 shrink-0 text-[#ff727d]' : 'mt-0.5 shrink-0 text-[#6cbfe8]'} />
                      <span>{item.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <button type="button" onClick={() => setAdvancedOpen(value => !value)} className="flex h-6 w-full items-center justify-between border-t border-white/[0.06] text-[7px] font-semibold text-[#65798d] hover:text-[#c8d3dc]">
          <span>Pre-trade details</span><ChevronDown size={11} className={advancedOpen ? 'rotate-180 transition' : 'transition'} />
        </button>

        {advancedOpen && (
          <div className="grid grid-cols-3 gap-x-2 rounded-md border border-white/[0.06] bg-black px-2">
            <Metric label="Spread" value={Number.isFinite(spreadPips) ? `${spreadPips.toFixed(1)}p` : '—'} />
            <Metric label="Leverage" value={effectiveLeverage(account, market) ? `1:${effectiveLeverage(account, market)}` : '—'} />
            <Metric label="Reward" value={Number.isFinite(planMetrics?.reward) ? money(planMetrics.reward, currency) : '—'} tone="success" />
            <Metric label="Daily room" value={challenge.riskAvailabilityLive ? money(challenge.remainingDaily, currency) : '—'} />
            <Metric label="After SL" value={challenge.riskAvailabilityLive && Number.isFinite(planMetrics?.riskAmount) ? money(challenge.postTradeDaily, currency) : '—'} tone={Number.isFinite(riskBufferUsage) && riskBufferUsage >= 50 ? 'danger' : 'success'} />
            <Metric label="Max room" value={challenge.riskAvailabilityLive ? money(challenge.remainingMax, currency) : '—'} />
          </div>
        )}

        {warning && (
          <div className="flex items-start gap-1.5 rounded-md border border-[#57363b] bg-[#14090c] px-2 py-1.5 text-[7.5px] font-semibold leading-4 text-[#dba2a8]">
            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-[#ff727d]" />
            <span>{warning}</span>
          </div>
        )}
      </div>
    </section>
  );
}
