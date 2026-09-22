import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, X, Check, SlidersHorizontal, Clock3 } from 'lucide-react';
import { decimalPlaces, normalizeVolumeToStep } from '../../utils/tradingCommandNormalization.js';
import { calculateRiskOrderSizing, effectiveLeverage, estimateRequiredMargin, estimateStopRisk, riskSizingSupported } from '../../utils/tradingRisk.js';
import { formatInstrumentPrice, instrumentPipSize } from '../../utils/instrumentFormatting.js';
import { effectiveTradePlan, validateTradePlanForExecution } from '../../utils/tradePlanExecution.js';

const orderTypes = [
  ['market', 'Market'],
  ['limit', 'Limit'],
  ['stop', 'Stop'],
  ['stop-limit', 'Stop Limit'],
];

function localDateTimeValue(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultSpecifiedExpiry() {
  return localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000));
}

function getPlanMetrics(plan, riskPercent, manualLots = 0.1, market, account) {
  if (!plan) return null;
  const entry = Number(plan.entry) || 0;
  const sl = Number(plan.sl) || entry;
  const tp = Number(plan.tp) || entry;
  const pipSize = instrumentPipSize(market);
  const slPips = Math.max(0.1, Math.abs(entry - sl) / pipSize);
  const tpPips = Math.max(0.1, Math.abs(tp - entry) / pipSize);
  const supported = riskSizingSupported(market, account?.currency);
  const riskSizing = plan.sizingMode === 'risk'
    ? calculateRiskOrderSizing(plan, riskPercent, account, market)
    : null;
  const requestedLots = plan.sizingMode === 'risk' ? (riskSizing?.requestedLots ?? manualLots) : manualLots;
  const lots = normalizeVolumeToStep(requestedLots, market);
  const riskAmount = estimateStopRisk(plan, lots, market, account?.currency);
  const reward = riskAmount == null ? null : riskAmount * (tpPips / slPips);
  return { slPips, tpPips, riskDollars: riskAmount, lots, rr: tpPips / slPips, reward, riskSupported: supported, riskSizing };
}

function Metric({ label, value }) {
  return <div className="rounded-md border border-white/[0.08] bg-[#080808] px-1.5 py-2"><span className="block text-[8px] text-[#718398]">{label}</span><b className="mt-0.5 block text-[12px]">{value}</b></div>;
}

function finiteQuote(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function formatCommission(perLot, rate) {
  const percentage = Number(rate);
  if (Number.isFinite(percentage) && percentage > 0) return `${(percentage * 100).toFixed(3)}%/side`;
  const number = Number(perLot);
  return Number.isFinite(number) ? `${number.toFixed(2)}/lot/side` : '—';
}

function formatMoney(value, currency = 'USD', signed = false) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(number));
    return `${signed && number > 0 ? '+' : number < 0 ? '-' : ''}${formatted}`;
  } catch {
    return `${number.toFixed(2)} ${currency || ''}`.trim();
  }
}

export default function ExecutionPanel({
  market,
  focusMode = false,
  desktopSidebar = false,
  lots: controlledLots,
  onLotsChange,
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
  onModifyPlan = () => {},
  onManualOrder = () => {},
  onTradePlanChange = () => {},
  exposureAllowed = true,
  exposureBlockReason = 'New exposure is temporarily unavailable',
  account = {},
  mobileDocked = false,
  riskExpanded = false,
  onToggleRisk = () => {},
  riskContent = null,
}) {
  const [internalLots, setInternalLots] = useState(0.10);
  const [lotInput, setLotInput] = useState('0.10');
  const [lotInputFocused, setLotInputFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [riskDisplayMode, setRiskDisplayMode] = useState('percent');
  const [slDisplayMode, setSlDisplayMode] = useState('pips');
  const [tpDisplayMode, setTpDisplayMode] = useState('pips');
  const lots = controlledLots ?? internalLots;
  const setLots = onLotsChange ?? setInternalLots;
  const volumeStep = Math.max(Number(market?.volumeStep) || 0.01, 0.00000001);
  const minVolume = Math.max(Number(market?.minVolume) || volumeStep, volumeStep);
  const maxVolume = Math.max(Number(market?.maxVolume) || 100, minVolume);
  const volumeDecimals = Math.min(8, Math.max(0, decimalPlaces(market?.volumeStep ?? volumeStep)));
  const formatLots = value => Number(value).toFixed(volumeDecimals);
  const normalizedLots = normalizeVolumeToStep(lots, market, { rounding: 'nearest' });

  useEffect(() => {
    if (!lotInputFocused) setLotInput(formatLots(normalizedLots));
  }, [lotInputFocused, normalizedLots, volumeDecimals]);

  const commitLotInput = () => {
    const text = String(lotInput || '').trim();
    const numeric = Number(text);
    const next = Number.isFinite(numeric) && numeric > 0
      ? normalizeVolumeToStep(numeric, market, { rounding: 'nearest' })
      : normalizedLots;
    setLots(next);
    setLotInput(formatLots(next));
    setLotInputFocused(false);
  };

  const updateLotInput = value => {
    const sanitized = String(value || '').replace(/[^0-9.]/g, '');
    const firstDot = sanitized.indexOf('.');
    const normalizedText = firstDot < 0
      ? sanitized
      : sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, '');
    setLotInput(normalizedText);
  };

  const decrease = () => {
    const next = normalizeVolumeToStep(Math.max(minVolume, Number(lots) - volumeStep), market, { rounding: 'nearest' });
    setLots(next);
    setLotInput(formatLots(next));
  };
  const increase = () => {
    const next = normalizeVolumeToStep(Math.min(maxVolume, Number(lots) + volumeStep), market, { rounding: 'nearest' });
    setLots(next);
    setLotInput(formatLots(next));
  };

  const lotPresets = useMemo(() => {
    const candidates = [minVolume, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
      .filter(value => value >= minVolume && value <= maxVolume)
      .map(value => normalizeVolumeToStep(value, market, { rounding: 'nearest' }));
    return [...new Set(candidates)].slice(0, 8);
  }, [market, minVolume, maxVolume]);
  const effectivePlan = useMemo(() => effectiveTradePlan(tradePlan, market), [market, tradePlan]);
  const metrics = useMemo(() => getPlanMetrics(effectivePlan, riskPercent, effectivePlan?.manualLots ?? lots, market, account), [account, market, effectivePlan, riskPercent, lots]);
  const executableQuote = finiteQuote(market?.bid) && finiteQuote(market?.ask) && market?.isStale !== true && market?.sessionOpen !== false && !['WAITING', 'DISCONNECTED', 'ERROR', 'DISABLED', 'STALE'].includes(String(market?.marketState || '').toUpperCase());
  const riskModeSupported = sizingMode !== 'risk' || riskSizingSupported(market, account?.currency);
  const riskConstraint = effectivePlan && sizingMode === 'risk' ? metrics?.riskSizing : null;
  const riskOrderExecutable = !riskConstraint || riskConstraint.canExecute !== false;
  const planValidation = validateTradePlanForExecution(effectivePlan, market);
  const canSubmitExposure = executableQuote && exposureAllowed && riskModeSupported && riskOrderExecutable && planValidation.valid;
  const pipSize = Number(market?.pipSize);
  const bid = Number(market?.bid);
  const ask = Number(market?.ask);
  const spreadPips = Number.isFinite(pipSize) && pipSize > 0 && Number.isFinite(bid) && Number.isFinite(ask) ? Math.abs(ask - bid) / pipSize : null;
  const riskConstraintHint = riskConstraint?.blockReason === 'INSUFFICIENT_MARGIN'
    ? `Needs ${formatMoney(riskConstraint.requiredMargin, account?.currency)} margin · ${formatMoney(riskConstraint.freeMargin, account?.currency)} free`
    : riskConstraint?.blockReason === 'MAX_VOLUME'
      ? `Selected risk needs ${riskConstraint.requestedRaw.toFixed(2)} lots · instrument max ${Number(market?.maxVolume || 0).toFixed(2)}`
      : riskConstraint?.blockReason === 'MIN_VOLUME'
        ? `Minimum ${Number(market?.minVolume || 0).toFixed(2)} lots exceeds the selected risk`
        : null;
  const marketHint = !exposureAllowed ? exposureBlockReason : !riskModeSupported ? 'Risk % sizing requires the instrument P&L currency to match the account currency' : riskConstraintHint || (!planValidation.valid ? planValidation.message : (market?.sessionOpen === false ? 'Session closed' : market?.isStale ? 'Quote stale' : !executableQuote ? 'Waiting for quote' : orderType === 'market' ? (sizingMode === 'risk' ? 'Tap Buy/Sell' : `${spreadPips?.toFixed(1) ?? '—'} pips`) : 'Tap side to place on chart'));

  const clickSide = side => {
    if (!canSubmitExposure || !market?.symbol) return;
    if (orderType !== 'market') {
      onStartPlan(side, orderType);
      return;
    }
    if (sizingMode === 'risk') onStartPlan(side, 'market');
    else onManualOrder({ side, lots, price: side === 'buy' ? market.ask : market.bid, symbol: market.symbol });
  };

  const plannerLots = Number(metrics?.lots ?? normalizedLots);
  const plannerPip = Number(instrumentPipSize(market));
  const plannerContractSize = Number(market?.contractSize);
  const plannerDollarSupported = riskSizingSupported(market, account?.currency)
    && Number.isFinite(plannerContractSize)
    && plannerContractSize > 0;
  const plannerMargin = effectivePlan
    ? estimateRequiredMargin(effectivePlan.entry, plannerLots, market, account)
    : null;

  const commitPlannerRisk = raw => {
    const numeric = Math.abs(Number(raw));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const equity = Number(account?.equity);
    const nextPercent = riskDisplayMode === 'amount'
      ? (Number.isFinite(equity) && equity > 0 ? numeric / equity * 100 : null)
      : numeric;
    if (!Number.isFinite(nextPercent) || nextPercent <= 0) return;
    const clamped = Math.max(0.1, Math.min(5, nextPercent));
    onRiskPercentChange(clamped);
    onSizingModeChange('risk');
    onTradePlanChange({ sizingMode: 'risk' });
  };

  const commitPlannerLots = raw => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const next = normalizeVolumeToStep(numeric, market, { rounding: 'nearest' });
    setLots(next);
    setLotInput(formatLots(next));
    onSizingModeChange('lots');
    onTradePlanChange({ sizingMode: 'lots', manualLots: next });
  };

  const commitPlannerEntry = raw => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    onTradePlanChange({ entry: numeric, stage: 'ready' });
  };

  const protectionPriceFromInput = (kind, raw, mode) => {
    const numeric = Math.abs(Number(raw));
    const entry = Number(effectivePlan?.entry);
    if (!Number.isFinite(numeric) || numeric <= 0 || !Number.isFinite(entry)) return null;
    let distance = null;
    if (mode === 'amount') {
      if (!plannerDollarSupported || !Number.isFinite(plannerLots) || plannerLots <= 0) return null;
      distance = numeric / (plannerLots * plannerContractSize);
    } else {
      if (!Number.isFinite(plannerPip) || plannerPip <= 0) return null;
      distance = numeric * plannerPip;
    }
    const buy = String(tradePlan?.side || '').toLowerCase() === 'buy';
    if (kind === 'sl') return buy ? entry - distance : entry + distance;
    return buy ? entry + distance : entry - distance;
  };

  const commitPlannerProtection = (kind, raw, mode) => {
    const price = protectionPriceFromInput(kind, raw, mode);
    if (!Number.isFinite(price) || price <= 0) return;
    onTradePlanChange({ [kind]: price, stage: 'ready' });
  };

  const plannerInputKeyDown = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  const sizingPicker = pickerOpen && (
    <div className={`absolute z-50 w-[196px] overflow-hidden border border-white/[0.12] bg-[#0d0d10] shadow-[0_10px_28px_rgba(0,0,0,0.38)] ${mobileDocked ? 'bottom-[70px] left-1/2 -translate-x-1/2' : focusMode ? 'bottom-[72px] left-1/2 -translate-x-1/2' : 'bottom-[112px] left-1/2 -translate-x-1/2'}`}>
      <div className="border-b border-white/[0.08] px-2.5 py-2">
        <span className="block text-[7px] font-semibold uppercase tracking-[0.1em] text-[#77777d]">Lot size</span>
      </div>

      <button type="button" onClick={() => { onSizingModeChange('lots'); setPickerOpen(false); }} className={`flex w-full items-center justify-between border-b border-white/[0.08] px-2.5 py-2 text-left text-[9px] ${sizingMode === 'lots' ? 'bg-[#15151a] text-[#53c7ff]' : 'bg-transparent text-[#d6d6da]'}`}>
        <span>
          <b className="block font-semibold">Lots</b>
          <small className="mt-0.5 block text-[7px] text-[#68686e]">Type exact size or use presets</small>
        </span>
        {sizingMode === 'lots' && <Check size={12}/>}
      </button>

      {sizingMode === 'lots' && (
        <div className="border-b border-white/[0.08] px-2 py-2">
          <span className="block pb-1.5 text-[7px] font-semibold uppercase tracking-[0.1em] text-[#77777d]">Quick sizes</span>
          <div className="grid grid-cols-4 gap-1">
            {lotPresets.map(value => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const next = normalizeVolumeToStep(value, market, { rounding: 'nearest' });
                  setLots(next);
                  setLotInput(formatLots(next));
                  setPickerOpen(false);
                }}
                className={`h-7 border text-[8px] font-semibold tabular-nums ${Math.abs(Number(lots) - value) < volumeStep / 2 ? 'border-[#315b72] bg-[#15151a] text-[#53c7ff]' : 'border-white/[0.08] bg-[#15151a] text-[#a0a0a6]'}`}
              >
                {formatLots(value)}
              </button>
            ))}
          </div>
          <span className="mt-1.5 block font-mono text-[7px] tabular-nums text-[#68686e]">Min {formatLots(minVolume)} · Step {formatLots(volumeStep)} · Max {formatLots(maxVolume)}</span>
        </div>
      )}

      <button type="button" onClick={() => { onSizingModeChange('risk'); setPickerOpen(false); }} className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-[9px] ${sizingMode === 'risk' ? 'bg-[#15151a] text-[#53c7ff]' : 'bg-transparent text-[#d6d6da]'}`}>
        <span>
          <b className="block font-semibold">Risk %</b>
          <small className="mt-0.5 block text-[7px] text-[#68686e]">Chart trade planner</small>
        </span>
        {sizingMode === 'risk' && <Check size={12}/>}
      </button>
    </div>
  );

  const orderPicker = orderPickerOpen && (
    <div className={`absolute z-50 w-[190px] overflow-hidden rounded-lg border border-white/[0.10] bg-[#101010] p-1 shadow-[0_18px_55px_rgba(0,0,0,0.5)] ${focusMode ? 'bottom-[72px] left-2' : 'bottom-[112px] left-0'}`}>
      {orderTypes.map(([id, label]) => <button key={id} type="button" onClick={() => { onOrderTypeChange(id); setOrderPickerOpen(false); }} className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-[11px] ${orderType === id ? 'bg-[#101010] text-[#60caff]' : 'text-[#c0ccd7]'}`}><span><b className="block">{label}</b><small className="text-[#718398]">{id === 'market' ? 'Immediate execution' : id === 'limit' ? 'Better price retracement' : id === 'stop' ? 'Breakout trigger' : 'Stop trigger → limit order'}</small></span>{orderType === id && <Check size={14}/>}</button>)}
    </div>
  );

  if (mobileDocked && tradePlan && !tradePlan.open) {
    const side = String(tradePlan.side || '').toLowerCase() === 'buy' ? 'BUY' : 'SELL';
    const type = String(tradePlan.orderType || 'market').toUpperCase();
    const actionLabel = tradePlan.pending ? `${side} ${type}` : side;
    const symbolLabel = String(tradePlan.symbol || market?.symbol || '').toUpperCase();
    const riskAmount = Number(metrics?.riskDollars);
    const potential = Number(metrics?.reward);
    const riskValue = riskDisplayMode === 'amount'
      ? (Number.isFinite(riskAmount) ? Math.abs(riskAmount).toFixed(2) : '')
      : Number(riskPercent).toFixed(2);
    const slValue = slDisplayMode === 'amount'
      ? (Number.isFinite(riskAmount) ? Math.abs(riskAmount).toFixed(2) : '')
      : (Number.isFinite(metrics?.slPips) ? metrics.slPips.toFixed(1) : '');
    const tpAmount = Number.isFinite(potential) ? Math.abs(potential) : null;
    const tpValue = tpDisplayMode === 'amount'
      ? (tpAmount != null ? tpAmount.toFixed(2) : '')
      : (Number.isFinite(metrics?.tpPips) ? metrics.tpPips.toFixed(1) : '');
    const actionPrice = formatInstrumentPrice(effectivePlan?.entry, market);
    const riskSummaryLabel = riskDisplayMode === 'amount' ? 'Account risk' : 'Risk';
    const riskSummaryValue = riskDisplayMode === 'amount'
      ? `${Number(riskPercent).toFixed(2)}%`
      : formatMoney(metrics?.riskDollars, account?.currency);
    const inputClass = 'w-full bg-transparent p-0 text-center font-mono text-[9px] font-semibold tabular-nums text-[#f0f0f2] outline-none';
    const labelClass = 'block text-[6px] font-semibold uppercase tracking-[0.08em] text-[#77777d]';
    const modeButton = active => `h-4 min-w-[18px] border px-1 text-[6px] font-semibold ${active ? 'border-[#315b72] bg-[#15151a] text-[#53c7ff]' : 'border-white/[0.07] bg-transparent text-[#68686e]'}`;

    const riskField = (
      <div className="min-w-0 px-1 py-1.5 text-center">
        <span className={labelClass}>Risk</span>
        <input key={`risk:${riskDisplayMode}:${riskValue}`} defaultValue={riskValue} inputMode="decimal" onBlur={event => commitPlannerRisk(event.currentTarget.value)} onKeyDown={plannerInputKeyDown} className={inputClass} aria-label={`Risk ${riskDisplayMode === 'amount' ? 'amount' : 'percent'}`} />
        <div className="mt-1 flex justify-center gap-px">
          <button type="button" onClick={() => setRiskDisplayMode('percent')} className={modeButton(riskDisplayMode === 'percent')}>%</button>
          <button type="button" onClick={() => plannerDollarSupported && setRiskDisplayMode('amount')} disabled={!plannerDollarSupported} className={modeButton(riskDisplayMode === 'amount')}>$</button>
        </div>
      </div>
    );

    const entryField = (
      <div className="min-w-0 px-1 py-1.5 text-center">
        <span className={labelClass}>Entry</span>
        {tradePlan.pending ? (
          <input key={`entry:${tradePlan.entry}`} defaultValue={formatInstrumentPrice(tradePlan.entry, market)} inputMode="decimal" onBlur={event => commitPlannerEntry(event.currentTarget.value)} onKeyDown={plannerInputKeyDown} className={inputClass} aria-label="Entry price" />
        ) : (
          <div className="w-full bg-transparent p-0 text-center font-mono text-[9px] font-semibold tabular-nums text-[#f0f0f2]" aria-label="Live market entry">{formatInstrumentPrice(effectivePlan?.entry, market)}</div>
        )}
        <span className="mt-1 block h-4 text-[6px] text-[#68686e]">{tradePlan.pending ? 'price' : 'live'}</span>
      </div>
    );

    const lotsField = (
      <div className="min-w-0 px-1 py-1.5 text-center">
        <span className={labelClass}>Lots</span>
        <input key={`lots:${plannerLots}`} defaultValue={Number.isFinite(plannerLots) ? formatLots(plannerLots) : ''} inputMode="decimal" onBlur={event => commitPlannerLots(event.currentTarget.value)} onKeyDown={plannerInputKeyDown} className={inputClass} aria-label="Lot size" />
        <span className="mt-1 block h-4 text-[6px] text-[#68686e]">volume</span>
      </div>
    );

    const protectionField = (kind, label, mode, setMode, value) => (
      <div className="min-w-0 px-1 py-1.5 text-center">
        <span className={labelClass}>{label}</span>
        <input key={`${kind}:${mode}:${value}`} defaultValue={value} inputMode="decimal" onBlur={event => commitPlannerProtection(kind, event.currentTarget.value, mode)} onKeyDown={plannerInputKeyDown} className={inputClass} aria-label={`${label} ${mode === 'amount' ? 'amount' : 'pips'}`} />
        <div className="mt-1 flex justify-center gap-px">
          <button type="button" onClick={() => setMode('pips')} className={modeButton(mode === 'pips')}>p</button>
          <button type="button" onClick={() => plannerDollarSupported && setMode('amount')} disabled={!plannerDollarSupported} className={modeButton(mode === 'amount')}>$</button>
        </div>
      </div>
    );

    return (
      <section className="relative overflow-hidden border border-white/[0.12] bg-[#0d0d10]">
        <div className="flex min-h-10 items-center justify-between gap-2 border-b border-white/[0.10] px-2.5 py-1.5">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <strong className={`text-[9px] font-extrabold tracking-[0.04em] ${side === 'BUY' ? 'text-[#2ddb9f]' : 'text-[#ff5f6d]'}`}>{actionLabel}</strong>
              <span className="truncate text-[8px] font-semibold text-[#f0f0f2]">· {symbolLabel}</span>
            </div>
            <p className="mt-0.5 text-[7px] text-[#68686e]">Drag entry / SL / TP on chart</p>
          </div>
          <button type="button" onClick={onCancelPlan} className="grid size-7 shrink-0 place-items-center border border-white/[0.08] bg-[#15151a] text-[#8a8a91]" aria-label="Cancel trade plan"><X size={13}/></button>
        </div>

        <div className="grid grid-cols-5 divide-x divide-white/[0.08] border-b border-white/[0.10] bg-[#0d0d10]">
          {riskField}
          {entryField}
          {lotsField}
          {protectionField('sl', 'SL', slDisplayMode, setSlDisplayMode, slValue)}
          {protectionField('tp', 'TP', tpDisplayMode, setTpDisplayMode, tpValue)}
        </div>

        <div className="flex h-8 items-center justify-between gap-2 border-b border-white/[0.08] px-2.5 text-[7px] text-[#77777d]">
          <span>{riskSummaryLabel} <b className="ml-1 font-mono font-semibold tabular-nums text-[#f0f0f2]">{riskSummaryValue}</b></span>
          <span>Potential <b className="ml-1 font-mono font-semibold tabular-nums text-[#42d7a2]">{formatMoney(metrics?.reward, account?.currency, true)}</b></span>
          <span>R:R <b className="ml-1 font-mono font-semibold tabular-nums text-[#f0f0f2]">1:{Number.isFinite(metrics?.rr) ? metrics.rr.toFixed(1) : '—'}</b></span>
        </div>

        <div className="flex h-7 items-center justify-between gap-3 border-b border-white/[0.08] px-2.5 text-[7px] text-[#68686e]">
          <span>Margin <b className="ml-1 font-mono font-semibold tabular-nums text-[#a0a0a6]">{formatMoney(plannerMargin, account?.currency)}</b></span>
          <span>Free <b className="ml-1 font-mono font-semibold tabular-nums text-[#a0a0a6]">{formatMoney(account?.freeMargin, account?.currency)}</b></span>
        </div>

        <div className={`grid gap-px bg-white/[0.07] ${side === 'SELL' ? 'grid-cols-[2fr_1fr]' : 'grid-cols-[1fr_2fr]'}`}>
          {side === 'BUY' && (
            <button type="button" onClick={onCancelPlan} className="flex h-[58px] items-center justify-center bg-[#0d0d10] text-[8px] font-bold uppercase tracking-[0.08em] text-[#9a9aa0]">Cancel</button>
          )}
          <button
            type="button"
            disabled={!canSubmitExposure}
            onClick={onExecutePlan}
            className={`flex h-[58px] min-w-0 flex-col justify-center bg-black px-3 disabled:cursor-not-allowed disabled:opacity-40 ${side === 'BUY' ? 'acg-execution-buy items-end text-right' : 'acg-execution-sell items-start text-left'}`}
          >
            <span className="text-[9px] font-extrabold tracking-[0.045em]">{tradePlan.editingOrderId ? `UPDATE ${actionLabel}` : actionLabel}</span>
            <strong className="mt-1 max-w-full whitespace-nowrap text-[20px] font-black tabular-nums leading-none tracking-[-0.035em] text-[#f5f5f6]">{actionPrice}</strong>
          </button>
          {side === 'SELL' && (
            <button type="button" onClick={onCancelPlan} className="flex h-[58px] items-center justify-center bg-[#0d0d10] text-[8px] font-bold uppercase tracking-[0.08em] text-[#9a9aa0]">Cancel</button>
          )}
        </div>
      </section>
    );
  }

  if (tradePlan && !tradePlan.open) {
    const side = tradePlan.side === 'buy' ? 'BUY' : 'SELL';
    const accent = tradePlan.side === 'buy' ? '#42d7a2' : '#ff6975';
    const isOpen = tradePlan.open;
    const isModifying = tradePlan.stage === 'modifying';
    const pendingLabel = tradePlan.pending ? `${side} ${String(tradePlan.orderType).toUpperCase()}` : side;

    if (focusMode) {
      return (
        <section className="relative shrink-0 border-t border-white/[0.08] bg-[#080808]/98 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 ">
          <div className="flex min-h-[52px] items-center gap-2">
            <button type="button" onClick={onCancelPlan} className="grid size-10 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#91a3b5]" aria-label={isOpen ? 'Close position' : 'Cancel plan'}><X size={15}/></button>
            <div className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-[#1b2b39] overflow-hidden rounded-md border border-white/[0.08] bg-[#080808] text-center">
              <div className="px-1 py-2"><span className="block text-[7px] text-[#718398]">{tradePlan.pending ? 'TYPE' : isOpen ? 'SIDE' : 'RISK'}</span><b className="mt-0.5 block truncate text-[9px]" style={{ color: accent }}>{tradePlan.pending ? String(tradePlan.orderType).toUpperCase() : isOpen ? side : `${riskPercent.toFixed(2)}%`}</b></div>
              <div className="px-1 py-2"><span className="block text-[7px] text-[#718398]">LOTS</span><b className="mt-0.5 block text-[10px]">{metrics?.lots.toFixed(2)}</b></div>
              <div className="px-1 py-2"><span className="block text-[7px] text-[#718398]">R:R</span><b className="mt-0.5 block text-[10px]">1:{metrics?.rr.toFixed(1)}</b></div>
            </div>
            {isOpen ? <button type="button" onClick={() => onModifyPlan(isModifying ? 'open' : 'modifying')} className="h-10 shrink-0 rounded-md border border-white/[0.08] bg-[#101010] px-3 text-[10px] font-bold text-[#dbe5ed]"><SlidersHorizontal size={13} className="mr-1 inline"/>{isModifying ? 'Done' : 'Modify'}</button> : <button type="button" disabled={!canSubmitExposure} onClick={onExecutePlan} className={`h-10 shrink-0 rounded-xl px-3 text-[9px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${tradePlan.side === 'buy' ? 'border border-[#16865f] bg-[#0c5b45] text-[#6df0bd]' : 'border border-[#8a2b39] bg-[#4a1b25] text-[#ff818b]'}`}><Check size={13} className="mr-1 inline"/>{tradePlan.pending ? 'PLACE' : side}</button>}
          </div>
        </section>
      );
    }

    return (
      <section className="mt-2.5 border-y border-white/[0.08] bg-black px-0 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-[13px] tracking-[0.02em]" style={{ color: accent }}>{pendingLabel}</strong><span className="truncate text-[11px] font-semibold text-[#d9e3ec]">{market?.symbol || '—'}</span>{isOpen && <span className="rounded-full bg-[#103025] px-2 py-0.5 text-[9px] font-bold text-[#5ee6b4]">{isModifying ? 'MODIFYING' : 'OPEN'}</span>}</div><p className="mt-0.5 text-[9px] text-[#6f8296]">{tradePlan.pending ? 'Drag entry / SL / TP directly on chart' : isOpen ? 'Drag SL / TP on chart to modify' : 'Drag SL / TP directly on chart'}</p></div>
          {!isOpen && <button type="button" onClick={onCancelPlan} className="grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-[#101010] text-[#8193a6]" aria-label="Cancel trade plan"><X size={15}/></button>}
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center"><Metric label={tradePlan.pending ? 'Entry' : 'Risk'} value={tradePlan.pending ? formatInstrumentPrice(tradePlan.entry, market) : `${riskPercent.toFixed(2)}%`}/><Metric label="Lots" value={metrics?.lots.toFixed(2)}/><Metric label="SL" value={`${metrics?.slPips.toFixed(1)}p`}/><Metric label="R:R" value={`1:${metrics?.rr.toFixed(1)}`}/></div>

        {tradePlan.pending && (
          <div className="mt-1.5 space-y-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="flex shrink-0 items-center gap-1 text-[8px] font-bold text-[#718398]"><Clock3 size={11}/> Expiry</span>
              {[['GTC', 'GTC'], ['TODAY', 'Today'], ['SPECIFIED', 'Specified']].map(([value, label]) => <button key={value} type="button" onClick={() => onTradePlanChange({ expiration: value, ...(value === 'SPECIFIED' && !tradePlan.expirationAt ? { expirationAt: defaultSpecifiedExpiry() } : {}) })} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[8px] font-bold ${String(tradePlan.expiration || 'GTC').toUpperCase() === value ? 'border-[#245477] bg-[#101010] text-[#63caff]' : 'border-white/[0.08] bg-[#080808] text-[#718398]'}`}>{label}</button>)}
            </div>
            {String(tradePlan.expiration || '').toUpperCase() === 'SPECIFIED' && <label className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#080808] px-2.5 py-2"><Clock3 size={12} className="shrink-0 text-[#5f7488]"/><span className="shrink-0 text-[8px] font-bold text-[#718398]">Expires</span><input type="datetime-local" min={localDateTimeValue(new Date())} value={tradePlan.expirationAt || defaultSpecifiedExpiry()} onChange={event => onTradePlanChange({ expirationAt: event.target.value })} className="min-w-0 flex-1 bg-transparent text-[9px] font-semibold text-[#c8d5df] outline-none [color-scheme:dark]"/></label>}
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between rounded-md border border-white/[0.08] bg-[#101010] px-3 py-2 text-[10px]"><span className="text-[#7f91a4]">Risk <b className="ml-1 text-[#f2f5f8]">{formatMoney(metrics?.riskDollars, account?.currency)}</b></span><span className="text-[#7f91a4]">Potential <b className="ml-1 text-[#55dba9]">{formatMoney(metrics?.reward, account?.currency, true)}</b></span><span className="text-[#7f91a4]">TP <b className="ml-1 text-[#f2f5f8]">{metrics?.tpPips.toFixed(1)}p</b></span></div>
        {metrics?.riskSizing?.requiredMargin != null && (
          <div className={`mt-1.5 flex items-center justify-between rounded-md border px-3 py-2 text-[9px] ${metrics.riskSizing.canExecute ? 'border-white/[0.08] bg-[#080808] text-[#718398]' : 'border-[#5b3b23] bg-[#171008] text-[#d8a56e]'}`}>
            <span>Margin <b className="ml-1 text-[#dce5ed]">{formatMoney(metrics.riskSizing.requiredMargin, account?.currency)}</b></span>
            <span>Free <b className="ml-1 text-[#dce5ed]">{formatMoney(metrics.riskSizing.freeMargin, account?.currency)}</b></span>
            {tradePlan.pending && <span>Rechecked at trigger</span>}
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">{isOpen ? <><button type="button" onClick={() => onModifyPlan(isModifying ? 'open' : 'modifying')} className="h-11 rounded-md border border-white/[0.08] bg-[#101010] text-[12px] font-bold text-[#dbe5ed]"><SlidersHorizontal size={14} className="mr-1 inline"/>{isModifying ? 'Done' : 'Modify'}</button><button type="button" onClick={onCancelPlan} className="h-11 rounded-md border border-[#8a2b39] bg-[#3b1720] text-[12px] font-bold text-[#ff818b]">Close</button></> : <><button type="button" onClick={onCancelPlan} className="h-11 rounded-md border border-white/[0.08] bg-[#101010] text-[12px] font-bold text-[#b8c5d0]">Cancel</button><button type="button" disabled={!canSubmitExposure} onClick={onExecutePlan} className={`h-11 rounded-md text-[12px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${tradePlan.side === 'buy' ? 'border border-[#16865f] bg-[#0c5b45] text-[#6df0bd]' : 'border border-[#8a2b39] bg-[#4a1b25] text-[#ff818b]'}`}><Check size={14} className="mr-1 inline"/>{tradePlan.pending ? (tradePlan.editingOrderId ? 'Update Order' : 'Place Order') : `Execute ${side}`}</button></>}</div>
      </section>
    );
  }

  const compactControls = (
    <>
      {sizingPicker}{orderPicker}
      <div className="mb-1.5 flex items-center gap-1.5">
        <button type="button" onClick={() => setOrderPickerOpen(v => !v)} className="flex h-7 items-center gap-1 rounded-lg border border-white/[0.08] bg-black px-2.5 text-[8px] font-extrabold text-[#9cb0c3]">{orderTypes.find(([id]) => id === orderType)?.[1]} <ChevronDown size={10}/></button>
        <span className="text-[8px] text-[#60758a]">{orderType === 'market' ? 'Server market execution' : 'Server pending order'}</span>
      </div>
      <div className={`grid ${focusMode ? 'grid-cols-[minmax(0,1fr)_94px_minmax(0,1fr)] gap-1.5' : desktopSidebar ? 'grid-cols-[minmax(0,1fr)_82px_minmax(0,1fr)] gap-1.5' : 'grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] gap-1.5 sm:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] sm:gap-2'}`}>
        <button type="button" disabled={!canSubmitExposure} onClick={() => clickSide('sell')} className={`flex ${focusMode ? 'h-[58px] px-3' : desktopSidebar ? 'h-[56px] px-2.5' : 'h-[66px] px-3 sm:px-4'} min-w-0 flex-col items-start justify-center acg-execution-sell rounded-md border bg-black text-left text-[#ff5f6d] transition-colors disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]`}><span className="text-[10px] font-extrabold tracking-[0.045em]">SELL</span><strong className={`${focusMode ? 'text-[21px]' : desktopSidebar ? 'text-[17px]' : 'text-[clamp(21px,6.2vw,27px)]'} mt-1 max-w-full whitespace-nowrap font-black tabular-nums leading-none tracking-[-0.04em] text-[#f9f3f4]`}>{market?.bid || '—'}</strong></button>
        <div className={`grid ${focusMode ? 'h-[58px]' : desktopSidebar ? 'h-[56px]' : 'h-[66px]'} grid-cols-2 grid-rows-[auto_auto_1fr] items-center rounded-md border border-white/[0.08] bg-black px-2 py-1 text-center`}>
          {sizingMode === 'lots' ? (
            <div className="col-span-2 mx-auto flex min-w-0 items-center justify-center">
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                aria-label="Lot size"
                value={lotInput}
                onFocus={event => {
                  setLotInputFocused(true);
                  requestAnimationFrame(() => event.currentTarget.select());
                }}
                onChange={event => updateLotInput(event.target.value)}
                onBlur={commitLotInput}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setLotInput(formatLots(normalizedLots));
                    event.currentTarget.blur();
                  }
                }}
                className="w-[52px] min-w-0 bg-transparent p-0 text-right text-[14px] font-black leading-none tabular-nums text-[#f4f7fb] outline-none"
              />
              <button type="button" onClick={() => setPickerOpen(v => !v)} className="ml-0.5 grid size-5 shrink-0 place-items-center text-[#74879d]" aria-label="Lot size presets"><ChevronDown size={12}/></button>
            </div>
          ) : (
            <button type="button" onClick={() => setPickerOpen(v => !v)} className="col-span-2 mx-auto flex items-center gap-1 text-[14px] font-black leading-none text-[#f4f7fb]">{riskPercent.toFixed(2)}% <ChevronDown size={12} className="text-[#74879d]"/></button>
          )}
          <span className="col-span-2 text-[8px] font-medium text-[#718398]">{sizingMode === 'lots' ? 'Lots' : 'Risk'}</span>
          <div className="col-span-2 flex items-end justify-between pt-0.5">
            <button type="button" onClick={() => sizingMode === 'lots' ? decrease() : onRiskPercentChange(Math.max(0.1, +(riskPercent - 0.1).toFixed(2)))} className="grid h-5 w-[29px] place-items-center rounded-md border border-white/[0.08] bg-[#080808] text-[#a0a0a5]"><Minus size={13}/></button>
            <button type="button" onClick={() => sizingMode === 'lots' ? increase() : onRiskPercentChange(Math.min(5, +(riskPercent + 0.1).toFixed(2)))} className="grid h-5 w-[29px] place-items-center rounded-md border border-white/[0.08] bg-[#080808] text-[#a0a0a5]"><Plus size={13}/></button>
          </div>
        </div>
        <button type="button" disabled={!canSubmitExposure} onClick={() => clickSide('buy')} className={`flex ${focusMode ? 'h-[58px] px-3' : desktopSidebar ? 'h-[56px] px-2.5' : 'h-[66px] px-3 sm:px-4'} min-w-0 flex-col items-end justify-center acg-execution-buy rounded-md border bg-black text-right text-[#2ddb9f] transition-colors disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]`}><span className="text-[10px] font-extrabold tracking-[0.045em]">BUY</span><strong className={`${focusMode ? 'text-[21px]' : desktopSidebar ? 'text-[17px]' : 'text-[clamp(21px,6.2vw,27px)]'} mt-1 max-w-full whitespace-nowrap font-black tabular-nums leading-none tracking-[-0.04em] text-[#f3fbf8]`}>{market?.ask || '—'}</strong></button>
      </div>
    </>
  );

  if (mobileDocked && !tradePlan) {
    return (
      <section className="relative overflow-visible border border-white/[0.12] bg-[#0d0d10]">
        <div className="flex h-8 items-center gap-2 border-b border-white/[0.10] px-2">
          <button type="button" onClick={() => setOrderPickerOpen(value => !value)} className="flex h-6 items-center gap-1 bg-transparent px-1 text-[8px] font-extrabold text-[#b0b0b7]">
            {orderTypes.find(([id]) => id === orderType)?.[1]} <ChevronDown size={10}/>
          </button>
          <span className="min-w-0 flex-1" aria-hidden="true" />
          <button type="button" onClick={onToggleRisk} className={`grid size-7 shrink-0 place-items-center text-[#8a8a91] transition ${riskExpanded ? 'text-[#53c7ff]' : ''}`} aria-label={riskExpanded ? 'Hide challenge risk' : 'Show challenge risk'} aria-expanded={riskExpanded}>
            {riskExpanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
        </div>

        {riskExpanded && riskContent && (
          <div className="border-b border-white/[0.10] bg-[#0d0d10]">
            {riskContent}
          </div>
        )}

        <div className="relative p-1.5">
          {sizingPicker}{orderPicker}
          <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] gap-px overflow-hidden border border-white/[0.08] bg-white/[0.07]">
            <button type="button" disabled={!canSubmitExposure} onClick={() => clickSide('sell')} className="acg-execution-sell flex h-[62px] min-w-0 flex-col items-start justify-center bg-black px-3 text-left text-[#ff5f6d] disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]">
              <span className="text-[9px] font-extrabold tracking-[0.045em]">SELL</span>
              <strong className="mt-1 max-w-full whitespace-nowrap text-[clamp(19px,5.6vw,24px)] font-black tabular-nums leading-none tracking-[-0.04em] text-[#f9f3f4]">{market?.bid || '—'}</strong>
            </button>

            <div className="grid h-[62px] grid-cols-2 grid-rows-[auto_auto_1fr] items-center bg-black px-2 py-1 text-center">
              {sizingMode === 'lots' ? (
                <div className="col-span-2 mx-auto flex min-w-0 items-center justify-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    aria-label="Lot size"
                    value={lotInput}
                    onFocus={event => { setLotInputFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                    onChange={event => updateLotInput(event.target.value)}
                    onBlur={commitLotInput}
                    onKeyDown={event => {
                      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
                      if (event.key === 'Escape') { event.preventDefault(); setLotInput(formatLots(normalizedLots)); event.currentTarget.blur(); }
                    }}
                    className="w-[50px] min-w-0 bg-transparent p-0 text-right text-[14px] font-black leading-none tabular-nums text-[#f4f7fb] outline-none"
                  />
                  <button type="button" onClick={() => setPickerOpen(value => !value)} className="ml-0.5 grid size-5 shrink-0 place-items-center text-[#77777f]" aria-label="Lot size presets"><ChevronDown size={12}/></button>
                </div>
              ) : (
                <button type="button" onClick={() => setPickerOpen(value => !value)} className="col-span-2 mx-auto flex items-center gap-1 text-[14px] font-black leading-none text-[#f4f7fb]">{riskPercent.toFixed(2)}% <ChevronDown size={12} className="text-[#77777f]"/></button>
              )}
              <span className="col-span-2 text-[7px] font-medium text-[#717176]">{sizingMode === 'lots' ? 'Lots' : 'Risk'}</span>
              <div className="col-span-2 flex items-end justify-between pt-0.5">
                <button type="button" onClick={() => sizingMode === 'lots' ? decrease() : onRiskPercentChange(Math.max(0.1, +(riskPercent - 0.1).toFixed(2)))} className="grid h-5 w-[28px] place-items-center border border-white/[0.08] bg-[#15151a] text-[#a0a0a5]"><Minus size={12}/></button>
                <button type="button" onClick={() => sizingMode === 'lots' ? increase() : onRiskPercentChange(Math.min(5, +(riskPercent + 0.1).toFixed(2)))} className="grid h-5 w-[28px] place-items-center border border-white/[0.08] bg-[#15151a] text-[#a0a0a5]"><Plus size={12}/></button>
              </div>
            </div>

            <button type="button" disabled={!canSubmitExposure} onClick={() => clickSide('buy')} className="acg-execution-buy flex h-[62px] min-w-0 flex-col items-end justify-center bg-black px-3 text-right text-[#2ddb9f] disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]">
              <span className="text-[9px] font-extrabold tracking-[0.045em]">BUY</span>
              <strong className="mt-1 max-w-full whitespace-nowrap text-[clamp(19px,5.6vw,24px)] font-black tabular-nums leading-none tracking-[-0.04em] text-[#f3fbf8]">{market?.ask || '—'}</strong>
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (focusMode) return <section className="relative shrink-0 border-t border-white/[0.08] bg-[#080808]/98 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 ">{compactControls}</section>;

  return (
    <section className={`relative ${desktopSidebar ? 'mt-1.5' : 'mt-2.5'}`}>
      {compactControls}
      <div className={`${desktopSidebar ? 'mt-1.5 min-h-6 text-[8px]' : 'mt-2 min-h-7 text-[9px]'} flex items-center gap-2 overflow-x-auto whitespace-nowrap px-0.5 font-medium text-[#7a8ba0] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}><span>{orderType === 'market' ? (sizingMode === 'risk' ? 'Planning' : 'Spread') : 'Pending'} <b className="ml-1 font-semibold text-[#b6c2d0]">{marketHint}</b></span><span className="h-3 w-px shrink-0 bg-[#101010]"/><span>Commission <b className="ml-1 font-semibold text-[#b6c2d0]">{formatCommission(market?.commissionPerLotPerSide ?? market?.commissionPerLot, market?.commissionRate)}</b></span><span className="h-3 w-px shrink-0 bg-[#101010]"/><span>Leverage <b className="ml-1 font-semibold text-[#b6c2d0]">{effectiveLeverage(account, market) ? `1:${effectiveLeverage(account, market)}` : '—'}</b></span></div>
    </section>
  );
}
