import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, ChevronDown, CircleMinus, Info, Minus, Plus, Shield, Target, X, Check, SlidersHorizontal, Clock3 } from 'lucide-react';
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

function parseDecimalInput(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  return Number(normalized);
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
  const [mobileAdvancedOpen, setMobileAdvancedOpen] = useState(false);
  const [bidTickDirection, setBidTickDirection] = useState(null);
  const [askTickDirection, setAskTickDirection] = useState(null);
  const previousBidRef = useRef(null);
  const previousAskRef = useRef(null);
  const bidFlashTimerRef = useRef(null);
  const askFlashTimerRef = useRef(null);
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

  useEffect(() => {
    const nextBid = Number(market?.bid);
    const previousBid = previousBidRef.current;
    if (Number.isFinite(nextBid) && Number.isFinite(previousBid) && nextBid !== previousBid) {
      setBidTickDirection(nextBid > previousBid ? 'up' : 'down');
      if (bidFlashTimerRef.current) window.clearTimeout(bidFlashTimerRef.current);
      bidFlashTimerRef.current = window.setTimeout(() => setBidTickDirection(null), 180);
    }
    if (Number.isFinite(nextBid)) previousBidRef.current = nextBid;
    return undefined;
  }, [market?.bid]);

  useEffect(() => {
    const nextAsk = Number(market?.ask);
    const previousAsk = previousAskRef.current;
    if (Number.isFinite(nextAsk) && Number.isFinite(previousAsk) && nextAsk !== previousAsk) {
      setAskTickDirection(nextAsk > previousAsk ? 'up' : 'down');
      if (askFlashTimerRef.current) window.clearTimeout(askFlashTimerRef.current);
      askFlashTimerRef.current = window.setTimeout(() => setAskTickDirection(null), 180);
    }
    if (Number.isFinite(nextAsk)) previousAskRef.current = nextAsk;
    return undefined;
  }, [market?.ask]);

  useEffect(() => () => {
    if (bidFlashTimerRef.current) window.clearTimeout(bidFlashTimerRef.current);
    if (askFlashTimerRef.current) window.clearTimeout(askFlashTimerRef.current);
  }, []);

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
    const sanitized = String(value || '').replace(',', '.').replace(/[^0-9.]/g, '');
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

  const commitPlannerRisk = (raw, mode = riskDisplayMode) => {
    const numeric = Math.abs(parseDecimalInput(raw));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const equity = Number(account?.equity);
    const nextPercent = mode === 'amount'
      ? (Number.isFinite(equity) && equity > 0 ? numeric / equity * 100 : null)
      : numeric;
    if (!Number.isFinite(nextPercent) || nextPercent <= 0) return;
    const clamped = Math.max(0.1, Math.min(5, nextPercent));
    onRiskPercentChange(clamped);
    onSizingModeChange('risk');
    onTradePlanChange({ sizingMode: 'risk' });
  };

  const commitPlannerLots = raw => {
    const numeric = parseDecimalInput(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const next = normalizeVolumeToStep(numeric, market, { rounding: 'nearest' });
    setLots(next);
    setLotInput(formatLots(next));
    onSizingModeChange('lots');
    onTradePlanChange({ sizingMode: 'lots', manualLots: next });
  };

  const commitPlannerEntry = raw => {
    const numeric = parseDecimalInput(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    onTradePlanChange({ entry: numeric, stage: 'ready' });
  };

  const commitPlannerPrice = (kind, raw) => {
    const numeric = parseDecimalInput(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    onTradePlanChange({ [kind]: numeric, stage: 'ready' });
  };

  const protectionPriceFromInput = (kind, raw, mode) => {
    const numeric = Math.abs(parseDecimalInput(raw));
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
    <div className={`absolute z-50 w-[190px] overflow-hidden rounded-lg border border-white/[0.10] bg-[#101010] p-1 shadow-[0_18px_55px_rgba(0,0,0,0.5)] ${mobileDocked ? 'bottom-[62px] left-1.5' : focusMode ? 'bottom-[72px] left-2' : 'bottom-[112px] left-0'}`}>
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
    const riskValue = Number(riskPercent).toFixed(2);
    const actionPrice = formatInstrumentPrice(effectivePlan?.entry, market);
    const slPrice = formatInstrumentPrice(effectivePlan?.sl, market);
    const tpPrice = formatInstrumentPrice(effectivePlan?.tp, market);
    const slPips = Number.isFinite(metrics?.slPips) ? metrics.slPips.toFixed(1) : '—';
    const tpPips = Number.isFinite(metrics?.tpPips) ? metrics.tpPips.toFixed(1) : '—';
    const inputClass = 'w-full bg-transparent p-0 text-center font-mono text-[10.5px] font-semibold tabular-nums text-[#f0f0f2] outline-none focus:text-white';
    const valueClass = 'w-full bg-transparent p-0 text-center font-mono text-[10.5px] font-semibold tabular-nums text-[#f0f0f2]';
    const labelClass = 'block text-[7px] font-semibold uppercase tracking-[0.075em] text-[#77777d]';
    const secondaryClass = 'mt-0.5 block min-h-4 truncate text-[7px] font-semibold tracking-[0.015em] text-[#71818d]';
    const invalidHint = !canSubmitExposure ? marketHint : null;
    const freeMargin = Number(account?.freeMargin);
    const freeAfter = Number.isFinite(freeMargin) && Number.isFinite(plannerMargin)
      ? Math.max(0, freeMargin - plannerMargin)
      : null;

    const riskField = (
      <div className="min-w-0 px-1 py-1.5 text-center">
        <span className={labelClass}>Risk</span>
        <input
          key={`risk:percent:${riskValue}`}
          defaultValue={riskValue}
          inputMode="decimal"
          onBlur={event => commitPlannerRisk(event.currentTarget.value, 'percent')}
          onKeyDown={plannerInputKeyDown}
          className={inputClass}
          aria-label="Risk percent"
        />
        <span className={secondaryClass}>% risk</span>
      </div>
    );

    const entryField = (
      <div className="min-w-0 px-1 py-1.5 text-center">
        <span className={labelClass}>Entry</span>
        {tradePlan.pending ? (
          <input
            key={`entry:${tradePlan.entry}`}
            defaultValue={formatInstrumentPrice(tradePlan.entry, market)}
            inputMode="decimal"
            onBlur={event => commitPlannerEntry(event.currentTarget.value)}
            onKeyDown={plannerInputKeyDown}
            className={inputClass}
            aria-label="Entry price"
          />
        ) : (
          <div className={valueClass} aria-label="Live market entry">{formatInstrumentPrice(effectivePlan?.entry, market)}</div>
        )}
        <span className={secondaryClass}>{tradePlan.pending ? 'price' : 'live price'}</span>
      </div>
    );

    const lotsField = (
      <div className="min-w-0 px-1 py-1.5 text-center">
        <span className={labelClass}>Lots</span>
        {sizingMode === 'risk' ? (
          <div className={valueClass} aria-label="Risk calculated lot size">{Number.isFinite(plannerLots) ? formatLots(plannerLots) : '—'}</div>
        ) : (
          <input
            key={`lots:${plannerLots}`}
            defaultValue={Number.isFinite(plannerLots) ? formatLots(plannerLots) : ''}
            inputMode="decimal"
            onBlur={event => commitPlannerLots(event.currentTarget.value)}
            onKeyDown={plannerInputKeyDown}
            className={inputClass}
            aria-label="Lot size"
          />
        )}
        <span className={secondaryClass}>{sizingMode === 'risk' ? 'auto · risk sized' : 'lots'}</span>
      </div>
    );

    const protectionField = (kind, label, value, pips, moneyValue) => (
      <div className="min-w-0 px-1 py-1.5 text-center">
        <span className={labelClass}>{label}</span>
        <input
          key={`${kind}:price:${value}`}
          defaultValue={value}
          inputMode="decimal"
          onBlur={event => commitPlannerPrice(kind, event.currentTarget.value)}
          onKeyDown={plannerInputKeyDown}
          className={inputClass}
          aria-label={`${label} price`}
        />
        <span className={secondaryClass}>{pips}p · {moneyValue}</span>
      </div>
    );

    return (
      <section className="acg-mobile-execution-surface relative overflow-hidden bg-[#0b0b0d]">
        <div className="flex min-h-9 items-center gap-1.5 px-2">
          <div className="flex min-w-0 flex-1 items-baseline gap-1">
            <strong className={`truncate text-[8.5px] font-extrabold tracking-[0.035em] ${side === 'BUY' ? 'text-[#2ddb9f]' : 'text-[#ff5f6d]'}`}>{actionLabel}</strong>
            <span className="shrink-0 text-[8px] font-semibold text-[#d9dfe5]">· {symbolLabel}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-[7px] tabular-nums text-[#6f7d88]">
            <span>Margin <b className="font-semibold text-[#aab5bf]">{formatMoney(plannerMargin, account?.currency)}</b></span>
            <span>Free <b className="font-semibold text-[#aab5bf]">{formatMoney(account?.freeMargin, account?.currency)}</b></span>
            {freeAfter != null && <span className="hidden min-[390px]:inline">After <b className="font-semibold text-[#aab5bf]">{formatMoney(freeAfter, account?.currency)}</b></span>}
          </div>
          <button type="button" onClick={onCancelPlan} className="grid size-9 shrink-0 place-items-center text-[#8996a0] active:bg-white/[0.04]" aria-label="Cancel trade plan"><X size={14}/></button>
        </div>

        <div className="grid grid-cols-5 bg-[#111114]">
          {riskField}
          {entryField}
          {lotsField}
          {protectionField('sl', 'SL', slPrice, slPips, Number.isFinite(riskAmount) ? formatMoney(-Math.abs(riskAmount), account?.currency) : '—')}
          {protectionField('tp', 'TP', tpPrice, tpPips, Number.isFinite(potential) ? formatMoney(Math.abs(potential), account?.currency, true) : '—')}
        </div>

        <div className="grid min-h-8 grid-cols-3 items-center px-2 text-[7.5px] text-[#737f89]">
          <span className="truncate">Risk <b className="ml-1 font-mono font-semibold tabular-nums text-[#f0f0f2]">{formatMoney(metrics?.riskDollars, account?.currency)}</b></span>
          <span className="truncate text-center">Reward <b className="ml-1 font-mono font-semibold tabular-nums text-[#42d7a2]">{formatMoney(metrics?.reward, account?.currency, true)}</b></span>
          <span className="truncate text-right">R:R <b className="ml-1 font-mono font-semibold tabular-nums text-[#f0f0f2]">1:{Number.isFinite(metrics?.rr) ? metrics.rr.toFixed(2) : '—'}</b></span>
        </div>

        {invalidHint && (
          <div className="border-t border-white/[0.05] bg-[#100b0c] px-2.5 py-1.5 text-center text-[8px] font-semibold leading-3.5 text-[#ff7882]" role="status">
            {invalidHint}
          </div>
        )}

        <div className={`grid ${side === 'SELL' ? 'grid-cols-[2fr_1fr]' : 'grid-cols-[1fr_2fr]'}`}>
          {side === 'BUY' && (
            <button type="button" onClick={onCancelPlan} className="flex h-[49px] items-center justify-center bg-[#0d0d10] text-[9px] font-bold uppercase tracking-[0.08em] text-[#9a9aa0]">Cancel</button>
          )}
          <button
            type="button"
            disabled={!canSubmitExposure}
            onClick={onExecutePlan}
            className={`flex h-[49px] min-w-0 flex-col justify-center bg-black px-3 disabled:cursor-not-allowed disabled:opacity-40 ${side === 'BUY' ? 'acg-execution-buy items-end text-right' : 'acg-execution-sell items-start text-left'}`}
          >
            <span className="text-[9px] font-extrabold tracking-[0.045em]">{tradePlan.editingOrderId ? `UPDATE ${actionLabel}` : actionLabel}</span>
            <strong className="mt-0.5 max-w-full whitespace-nowrap text-[18px] font-black tabular-nums leading-none tracking-[-0.035em] text-[#f5f5f6]">{actionPrice}</strong>
          </button>
          {side === 'SELL' && (
            <button type="button" onClick={onCancelPlan} className="flex h-[49px] items-center justify-center bg-[#0d0d10] text-[9px] font-bold uppercase tracking-[0.08em] text-[#9a9aa0]">Cancel</button>
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
        <section className="acg-mobile-execution-surface relative shrink-0 bg-[#0b0b0d] px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 ">
          <div className="flex min-h-[52px] items-center gap-2">
            <button type="button" onClick={onCancelPlan} className="grid size-10 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#91a3b5]" aria-label={isOpen ? 'Close position' : 'Cancel plan'}><X size={15}/></button>
            <div className="grid min-w-0 flex-1 grid-cols-3 overflow-hidden rounded-md bg-[#111114] text-center">
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

        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center"><Metric label={tradePlan.pending ? 'Entry' : 'Risk'} value={tradePlan.pending ? formatInstrumentPrice(tradePlan.entry, market) : `${riskPercent.toFixed(2)}%`}/><Metric label="Lots" value={metrics?.lots.toFixed(2)}/><Metric label="SL" value={Number.isFinite(Number(effectivePlan?.sl)) ? `${metrics?.slPips.toFixed(1)}p` : '—'}/><Metric label="TP" value={Number.isFinite(Number(effectivePlan?.tp)) ? `${metrics?.tpPips.toFixed(1)}p` : '—'}/></div>

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
        <button type="button" disabled={!canSubmitExposure} onClick={() => clickSide('sell')} className={`flex ${focusMode ? 'h-[58px] px-3' : desktopSidebar ? 'h-[56px] px-2.5' : 'h-[66px] px-3 sm:px-4'} min-w-0 flex-col items-start justify-center acg-execution-sell rounded-md ${focusMode ? 'border-0' : 'border'} bg-black text-left text-[#ff5f6d] transition-colors disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]`}><span className="text-[10px] font-extrabold tracking-[0.045em]">SELL</span><strong className={`${focusMode ? 'text-[21px]' : desktopSidebar ? 'text-[17px]' : 'text-[clamp(21px,6.2vw,27px)]'} mt-1 max-w-full whitespace-nowrap font-black tabular-nums leading-none tracking-[-0.04em] text-[#f9f3f4]`}>{market?.bid || '—'}</strong></button>
        <div className={`grid ${focusMode ? 'h-[58px]' : desktopSidebar ? 'h-[56px]' : 'h-[66px]'} grid-cols-2 grid-rows-[auto_auto_1fr] items-center rounded-md ${focusMode ? 'border-0 bg-[#111114]' : 'border border-white/[0.08] bg-black'} px-2 py-1 text-center`}>
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
        <button type="button" disabled={!canSubmitExposure} onClick={() => clickSide('buy')} className={`flex ${focusMode ? 'h-[58px] px-3' : desktopSidebar ? 'h-[56px] px-2.5' : 'h-[66px] px-3 sm:px-4'} min-w-0 flex-col items-end justify-center acg-execution-buy rounded-md ${focusMode ? 'border-0' : 'border'} bg-black text-right text-[#2ddb9f] transition-colors disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]`}><span className="text-[10px] font-extrabold tracking-[0.045em]">BUY</span><strong className={`${focusMode ? 'text-[21px]' : desktopSidebar ? 'text-[17px]' : 'text-[clamp(21px,6.2vw,27px)]'} mt-1 max-w-full whitespace-nowrap font-black tabular-nums leading-none tracking-[-0.04em] text-[#f3fbf8]`}>{market?.ask || '—'}</strong></button>
      </div>
    </>
  );

  if (mobileDocked && !tradePlan) {
    const mobileSizingLabel = sizingMode === 'risk' ? `${Number(riskPercent).toFixed(2)}%` : formatLots(normalizedLots);
    const referencePrice = finiteQuote(market?.ask)
      ? Number(market.ask)
      : finiteQuote(market?.bid)
        ? Number(market.bid)
        : null;
    const mobileMargin = referencePrice == null
      ? null
      : estimateRequiredMargin(referencePrice, normalizedLots, market, account);
    const mobileMarginPercent = Number.isFinite(Number(mobileMargin)) && Number(account?.equity) > 0
      ? (Number(mobileMargin) / Number(account.equity)) * 100
      : null;
    const mobileRiskAmount = Number(account?.equity) > 0
      ? Number(account.equity) * (Number(riskPercent) / 100)
      : null;

    return (
      <>
        <section className="acg-mobile-reference-execution acg-mobile-execution-surface relative shrink-0 overflow-visible rounded-t-[14px] border border-white/[0.09] bg-[#081019] px-2 pb-2 pt-2">
          {orderPicker}

          <div className="acg-mobile-order-controls-row grid h-[39px] grid-cols-[1.65fr_repeat(3,1fr)_38px] gap-1.5">
            <button
              type="button"
              onClick={() => setOrderPickerOpen(value => !value)}
              className="acg-mobile-order-control flex min-w-0 items-center justify-between rounded-[7px] px-3 text-left text-[11px] font-black uppercase tracking-[0.01em] text-[#eef2f7]"
              aria-label="Select order type"
            >
              <span className="truncate">{orderTypes.find(([id]) => id === orderType)?.[1] || 'Market'}</span>
              <ChevronDown size={14} className="shrink-0 text-[#c3ccd8]"/>
            </button>

            <button
              type="button"
              onClick={() => setMobileAdvancedOpen(true)}
              className={`acg-mobile-order-control flex min-w-0 items-center justify-center gap-1 rounded-[7px] px-1 text-[10px] font-bold ${sizingMode === 'risk' ? 'text-[#31d9ec]' : 'text-[#b6c0cd]'}`}
              aria-label="Open risk controls"
            >
              <Shield size={15} strokeWidth={1.8}/>
              <span>RISK</span>
            </button>

            <button
              type="button"
              disabled
              className="acg-mobile-order-control acg-mobile-protection-control flex min-w-0 items-center justify-center gap-1 rounded-[7px] px-1 text-[10px] font-bold text-[#77838f]"
              aria-label="Stop loss becomes available after choosing Buy or Sell"
              title="Choose Buy or Sell to set stop loss"
            >
              <CircleMinus size={15} strokeWidth={1.8}/>
              <span>SL</span>
            </button>

            <button
              type="button"
              disabled
              className="acg-mobile-order-control acg-mobile-protection-control flex min-w-0 items-center justify-center gap-1 rounded-[7px] px-1 text-[10px] font-bold text-[#77838f]"
              aria-label="Take profit becomes available after choosing Buy or Sell"
              title="Choose Buy or Sell to set take profit"
            >
              <Target size={15} strokeWidth={1.8}/>
              <span>TP</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileAdvancedOpen(true)}
              className="acg-mobile-order-control grid place-items-center rounded-[7px] text-[#c9d2dc]"
              aria-label="Open position sizing calculator"
            >
              <Calculator size={17} strokeWidth={1.8}/>
            </button>
          </div>

          <div className="my-2 h-px bg-white/[0.08]" aria-hidden="true"/>

          <div className="acg-mobile-sizing-summary flex h-[20px] items-center gap-1.5 px-1 text-[10px] font-medium text-[#a9b3c1]">
            <Info size={13} className="shrink-0 text-[#c3ccd7]" strokeWidth={1.9}/>
            {sizingMode === 'risk' ? (
              <span className="truncate">
                <b className="font-black text-[#eef2f7]">{Number(riskPercent).toFixed(2)}% risk</b>
                <span className="text-[#9aa6b5]">
                  {' '}(≈ {mobileRiskAmount == null ? '—' : formatMoney(mobileRiskAmount, account?.currency)})
                </span>
              </span>
            ) : (
              <span className="truncate">
                <b className="font-black text-[#eef2f7]">{formatLots(normalizedLots)} lots</b>
                <span className="text-[#9aa6b5]">
                  {' '}(≈ {mobileMargin == null ? '—' : formatMoney(mobileMargin, account?.currency)}
                  {mobileMarginPercent == null ? '' : `, ${mobileMarginPercent.toFixed(2)}%`})
                </span>
              </span>
            )}
          </div>

          <div className="acg-mobile-action-row mt-1.5 grid h-[64px] grid-cols-[1fr_1.02fr_1fr] gap-2">
            <button
              type="button"
              disabled={!canSubmitExposure}
              onClick={() => clickSide('sell')}
              className="acg-mobile-sell-action flex min-w-0 flex-col items-center justify-center rounded-[9px] px-2 text-center disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
            >
              <strong className={`acg-mobile-quote-price max-w-full whitespace-nowrap text-[clamp(20px,5.4vw,24px)] font-black tabular-nums leading-none tracking-[-0.045em] ${bidTickDirection === 'up' ? 'acg-mobile-quote-up' : bidTickDirection === 'down' ? 'acg-mobile-quote-down' : 'text-white'}`}>{market?.bid || '—'}</strong>
              <span className="mt-2 text-[14px] font-black leading-none text-white">SELL</span>
            </button>

            <div className="acg-mobile-lot-control grid min-w-0 grid-cols-[34px_minmax(0,1fr)_34px] items-center rounded-[9px] px-1">
              <button
                type="button"
                onClick={() => sizingMode === 'lots' ? decrease() : onRiskPercentChange(Math.max(0.1, +(riskPercent - 0.1).toFixed(2)))}
                className="grid size-[32px] place-items-center rounded-[7px] text-[#aeb9c6] active:bg-white/[0.06]"
                aria-label={sizingMode === 'lots' ? 'Decrease lot size' : 'Decrease risk'}
              >
                <Minus size={20} strokeWidth={1.8}/>
              </button>

              <div className="acg-mobile-sizing-center flex min-w-0 flex-col items-center justify-center">
                {sizingMode === 'lots' ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    aria-label="Lot size"
                    value={lotInput}
                    onFocus={event => {
                      event.stopPropagation();
                      setLotInputFocused(true);
                      requestAnimationFrame(() => event.currentTarget.select());
                    }}
                    onClick={event => event.stopPropagation()}
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
                    className="acg-mobile-lot-value w-full min-w-0 bg-transparent p-0 text-center font-mono text-[18px] font-black leading-none tabular-nums text-[#f5f7fa] outline-none"
                  />
                ) : (
                  <span className="acg-mobile-risk-value font-mono text-[18px] font-black leading-none tabular-nums text-[#f5f7fa]">{mobileSizingLabel}</span>
                )}
                <button
                  type="button"
                  onClick={() => setMobileAdvancedOpen(true)}
                  className="acg-mobile-sizing-label mt-2 text-[9px] font-semibold uppercase tracking-[0.03em] text-[#a1adbb] active:text-[#31d9ec]"
                  aria-label="Open position size controls"
                >
                  {sizingMode === 'risk' ? 'Risk' : 'Lots'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => sizingMode === 'lots' ? increase() : onRiskPercentChange(Math.min(5, +(riskPercent + 0.1).toFixed(2)))}
                className="grid size-[32px] place-items-center rounded-[7px] text-[#eef2f7] active:bg-white/[0.06]"
                aria-label={sizingMode === 'lots' ? 'Increase lot size' : 'Increase risk'}
              >
                <Plus size={20} strokeWidth={1.8}/>
              </button>
            </div>

            <button
              type="button"
              disabled={!canSubmitExposure}
              onClick={() => clickSide('buy')}
              className="acg-mobile-buy-action flex min-w-0 flex-col items-center justify-center rounded-[9px] px-2 text-center disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
            >
              <strong className={`acg-mobile-quote-price max-w-full whitespace-nowrap text-[clamp(20px,5.4vw,24px)] font-black tabular-nums leading-none tracking-[-0.045em] ${askTickDirection === 'up' ? 'acg-mobile-quote-up' : askTickDirection === 'down' ? 'acg-mobile-quote-down' : 'text-white'}`}>{market?.ask || '—'}</strong>
              <span className="mt-2 text-[14px] font-black leading-none text-white">BUY</span>
            </button>
          </div>
        </section>

        {mobileAdvancedOpen && (
          <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/55 px-2 backdrop-blur-[2px]" onMouseDown={() => setMobileAdvancedOpen(false)}>
            <section onMouseDown={event => event.stopPropagation()} className="mb-[max(8px,env(safe-area-inset-bottom))] w-full max-w-[444px] overflow-hidden rounded-t-[18px] border border-white/[0.08] bg-[#080808] shadow-[0_30px_90px_rgba(0,0,0,.7)]">
              <div className="mx-auto mt-1.5 h-1 w-9 rounded-full bg-white/[0.14]" aria-hidden="true" />
              <header className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                <div><b className="text-[11px] text-[#eaf1f6]">Position size</b><p className="mt-0.5 text-[7px] text-[#61768a]">Lots or account risk for the next order.</p></div>
                <button type="button" onClick={() => setMobileAdvancedOpen(false)} className="grid size-8 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#8e9aa5]" aria-label="Close position sizing"><X size={14}/></button>
              </header>

              <div className="p-3">
                <div className="grid grid-cols-2 border-b border-white/[0.08]">
                  <button type="button" onClick={() => onSizingModeChange('lots')} className={`h-9 border-b-2 text-[8px] font-black uppercase tracking-[0.07em] ${sizingMode === 'lots' ? 'border-[#53c7ff] text-[#e7f2f8]' : 'border-transparent text-[#687b8d]'}`}>Lots</button>
                  <button type="button" onClick={() => onSizingModeChange('risk')} className={`h-9 border-b-2 text-[8px] font-black uppercase tracking-[0.07em] ${sizingMode === 'risk' ? 'border-[#53c7ff] text-[#e7f2f8]' : 'border-transparent text-[#687b8d]'}`}>Risk</button>
                </div>

                {sizingMode === 'lots' ? (
                  <div className="pt-3">
                    <label className="block text-[7px] font-bold uppercase tracking-[0.09em] text-[#61768a]">Manual lots</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={lotInput}
                      onFocus={event => { setLotInputFocused(true); requestAnimationFrame(() => event.currentTarget.select()); }}
                      onChange={event => updateLotInput(event.target.value)}
                      onBlur={commitLotInput}
                      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
                      className="mt-1.5 h-10 w-full border-y border-white/[0.08] bg-black px-2 text-center font-mono text-[15px] font-black tabular-nums text-[#f1f5f8] outline-none"
                    />
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {lotPresets.slice(0, 8).map(value => (
                        <button key={value} type="button" onClick={() => { const next = normalizeVolumeToStep(value, market, { rounding: 'nearest' }); setLots(next); setLotInput(formatLots(next)); }} className={`h-8 border text-[8px] font-bold tabular-nums ${Math.abs(Number(normalizedLots) - value) < volumeStep / 2 ? 'border-[#315b72] bg-[#101820] text-[#53c7ff]' : 'border-white/[0.08] bg-black text-[#94a4b2]'}`}>{formatLots(value)}</button>
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-[7px] text-[#596f82]">Min {formatLots(minVolume)} · Step {formatLots(volumeStep)} · Max {formatLots(maxVolume)}</p>
                  </div>
                ) : (
                  <div className="pt-3">
                    <label className="block text-[7px] font-bold uppercase tracking-[0.09em] text-[#61768a]">Risk per trade</label>
                    <div className="mt-1.5 flex h-10 items-center border-y border-white/[0.08] bg-black px-2">
                      <input type="number" inputMode="decimal" min="0.1" max="5" step="0.05" value={riskPercent} onChange={event => onRiskPercentChange(Math.max(0.1, Math.min(5, Number(event.target.value) || 0.1)))} className="min-w-0 flex-1 bg-transparent text-center font-mono text-[15px] font-black tabular-nums text-[#f1f5f8] outline-none"/>
                      <span className="text-[9px] font-bold text-[#687b8d]">%</span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {[0.25, 0.5, 1, 2].map(value => <button key={value} type="button" onClick={() => onRiskPercentChange(value)} className={`h-8 border text-[8px] font-bold ${Math.abs(Number(riskPercent) - value) < 0.001 ? 'border-[#315b72] bg-[#101820] text-[#53c7ff]' : 'border-white/[0.08] bg-black text-[#94a4b2]'}`}>{value}%</button>)}
                    </div>
                    <p className="mt-2 text-[8px] leading-4 text-[#61768a]">Risk sizing uses the stop-loss distance from the chart planner before execution.</p>
                  </div>
                )}

                {riskContent && <div className="mt-3 border-t border-white/[0.08] pt-2">{riskContent}</div>}
              </div>
            </section>
          </div>
        )}
      </>
    );
  }

  if (focusMode) return <section className="acg-mobile-execution-surface relative shrink-0 bg-[#0b0b0d] px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 ">{compactControls}</section>;

  return (
    <section className={`relative ${desktopSidebar ? 'mt-1.5' : 'mt-2.5'}`}>
      {compactControls}
      <div className={`${desktopSidebar ? 'mt-1.5 min-h-6 text-[8px]' : 'mt-2 min-h-7 text-[9px]'} flex items-center gap-2 overflow-x-auto whitespace-nowrap px-0.5 font-medium text-[#7a8ba0] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}><span>{orderType === 'market' ? (sizingMode === 'risk' ? 'Planning' : 'Spread') : 'Pending'} <b className="ml-1 font-semibold text-[#b6c2d0]">{marketHint}</b></span><span className="h-3 w-px shrink-0 bg-[#101010]"/><span>Commission <b className="ml-1 font-semibold text-[#b6c2d0]">{formatCommission(market?.commissionPerLotPerSide ?? market?.commissionPerLot, market?.commissionRate)}</b></span><span className="h-3 w-px shrink-0 bg-[#101010]"/><span>Leverage <b className="ml-1 font-semibold text-[#b6c2d0]">{effectiveLeverage(account, market) ? `1:${effectiveLeverage(account, market)}` : '—'}</b></span></div>
    </section>
  );
}
