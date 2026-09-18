import React, { useMemo, useState } from 'react';
import { ChevronDown, Minus, Plus, X, Check, SlidersHorizontal, Clock3 } from 'lucide-react';
import { normalizeVolumeToStep } from '../../utils/tradingCommandNormalization.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
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

function getPlanMetrics(plan, riskPercent, manualLots = 0.1) {
  if (!plan) return null;
  const entry = Number(plan.entry) || 0;
  const sl = Number(plan.sl) || entry;
  const tp = Number(plan.tp) || entry;
  const pipSize = entry > 100 ? 0.01 : 0.0001;
  const slPips = Math.max(0.1, Math.abs(entry - sl) / pipSize);
  const tpPips = Math.max(0.1, Math.abs(tp - entry) / pipSize);
  const equity = Number(plan.accountEquity);
  const hasEquity = Number.isFinite(equity) && equity > 0;
  const lots = plan.sizingMode === 'risk' && hasEquity
    ? clamp((equity * (riskPercent / 100)) / Math.max(slPips * 10, 0.01), 0.01, 100)
    : manualLots;
  const riskDollars = plan.sizingMode === 'risk' && hasEquity
    ? +(equity * (riskPercent / 100)).toFixed(2)
    : +(slPips * lots * 10).toFixed(2);
  const reward = +(riskDollars * (tpPips / slPips)).toFixed(2);
  return { slPips, tpPips, riskDollars, lots, rr: tpPips / slPips, reward };
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-[#1b2b39] bg-[#0b151f] px-1.5 py-2"><span className="block text-[8px] text-[#718398]">{label}</span><b className="mt-0.5 block text-[12px]">{value}</b></div>;
}

function finiteQuote(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function formatCommission(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}/lot` : '—';
}

export default function ExecutionPanel({
  market,
  focusMode = false,
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
}) {
  const [internalLots, setInternalLots] = useState(0.10);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const lots = controlledLots ?? internalLots;
  const setLots = onLotsChange ?? setInternalLots;
  const volumeStep = Math.max(Number(market?.volumeStep) || 0.01, 0.00000001);
  const minVolume = Math.max(Number(market?.minVolume) || volumeStep, volumeStep);
  const maxVolume = Math.max(Number(market?.maxVolume) || 100, minVolume);
  const decrease = () => setLots(normalizeVolumeToStep(Math.max(minVolume, Number(lots) - volumeStep), market));
  const increase = () => setLots(normalizeVolumeToStep(Math.min(maxVolume, Number(lots) + volumeStep), market, { rounding: 'nearest' }));
  const rawMetrics = useMemo(() => getPlanMetrics(tradePlan, riskPercent, tradePlan?.manualLots ?? lots), [tradePlan, riskPercent, lots]);
  const metrics = useMemo(() => rawMetrics ? { ...rawMetrics, lots: normalizeVolumeToStep(rawMetrics.lots, market) } : null, [market, rawMetrics]);
  const executableQuote = finiteQuote(market?.bid) && finiteQuote(market?.ask) && market?.isStale !== true && market?.sessionOpen !== false && market?.marketState !== 'WAITING' && market?.marketState !== 'DISCONNECTED';
  const pipSize = Number(market?.pipSize);
  const bid = Number(market?.bid);
  const ask = Number(market?.ask);
  const spreadPips = Number.isFinite(pipSize) && pipSize > 0 && Number.isFinite(bid) && Number.isFinite(ask) ? Math.abs(ask - bid) / pipSize : null;
  const marketHint = market?.sessionOpen === false ? 'Session closed' : market?.isStale ? 'Quote stale' : !executableQuote ? 'Waiting for quote' : orderType === 'market' ? (sizingMode === 'risk' ? 'Tap Buy/Sell' : `${spreadPips?.toFixed(1) ?? '—'} pips`) : 'Tap side to place on chart';

  const clickSide = side => {
    if (!executableQuote || !market?.symbol) return;
    if (orderType !== 'market') {
      onStartPlan(side, orderType);
      return;
    }
    if (sizingMode === 'risk') onStartPlan(side, 'market');
    else onManualOrder({ side, lots, price: side === 'buy' ? market.ask : market.bid, symbol: market.symbol });
  };

  const sizingPicker = pickerOpen && (
    <div className={`absolute z-50 w-[176px] overflow-hidden rounded-2xl border border-[#223443] bg-[#0a141e] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.5)] ${focusMode ? 'bottom-[72px] left-1/2 -translate-x-1/2' : 'bottom-[112px] left-1/2 -translate-x-1/2'}`}>
      <button type="button" onClick={() => { onSizingModeChange('lots'); setPickerOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] ${sizingMode === 'lots' ? 'bg-[#10283a] text-[#60caff]' : 'text-[#c0ccd7]'}`}><span><b className="block">Lots</b><small className="text-[#718398]">MT5-style manual size</small></span>{sizingMode === 'lots' && <Check size={14}/>}</button>
      <button type="button" onClick={() => { onSizingModeChange('risk'); setPickerOpen(false); }} className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] ${sizingMode === 'risk' ? 'bg-[#10283a] text-[#60caff]' : 'text-[#c0ccd7]'}`}><span><b className="block">Risk %</b><small className="text-[#718398]">Chart trade planner</small></span>{sizingMode === 'risk' && <Check size={14}/>}</button>
    </div>
  );

  const orderPicker = orderPickerOpen && (
    <div className={`absolute z-50 w-[190px] overflow-hidden rounded-2xl border border-[#223443] bg-[#0a141e] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.5)] ${focusMode ? 'bottom-[72px] left-2' : 'bottom-[112px] left-0'}`}>
      {orderTypes.map(([id, label]) => <button key={id} type="button" onClick={() => { onOrderTypeChange(id); setOrderPickerOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] ${orderType === id ? 'bg-[#10283a] text-[#60caff]' : 'text-[#c0ccd7]'}`}><span><b className="block">{label}</b><small className="text-[#718398]">{id === 'market' ? 'Immediate execution' : id === 'limit' ? 'Better price retracement' : id === 'stop' ? 'Breakout trigger' : 'Stop trigger → limit order'}</small></span>{orderType === id && <Check size={14}/>}</button>)}
    </div>
  );

  if (tradePlan && !tradePlan.open) {
    const side = tradePlan.side === 'buy' ? 'BUY' : 'SELL';
    const accent = tradePlan.side === 'buy' ? '#42d7a2' : '#ff6975';
    const isOpen = tradePlan.open;
    const isModifying = tradePlan.stage === 'modifying';
    const pendingLabel = tradePlan.pending ? `${side} ${String(tradePlan.orderType).toUpperCase()}` : side;

    if (focusMode) {
      return (
        <section className="relative shrink-0 border-t border-[#1a2b3a] bg-[#071019]/98 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_34px_rgba(0,0,0,0.26)] backdrop-blur-xl">
          <div className="flex min-h-[52px] items-center gap-2">
            <button type="button" onClick={onCancelPlan} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#253746] bg-[#0d1822] text-[#91a3b5]" aria-label={isOpen ? 'Close position' : 'Cancel plan'}><X size={15}/></button>
            <div className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-[#1b2b39] overflow-hidden rounded-xl border border-[#1b2b39] bg-[#0a151f] text-center">
              <div className="px-1 py-2"><span className="block text-[7px] text-[#718398]">{tradePlan.pending ? 'TYPE' : isOpen ? 'SIDE' : 'RISK'}</span><b className="mt-0.5 block truncate text-[9px]" style={{ color: accent }}>{tradePlan.pending ? String(tradePlan.orderType).toUpperCase() : isOpen ? side : `${riskPercent.toFixed(2)}%`}</b></div>
              <div className="px-1 py-2"><span className="block text-[7px] text-[#718398]">LOTS</span><b className="mt-0.5 block text-[10px]">{metrics?.lots.toFixed(2)}</b></div>
              <div className="px-1 py-2"><span className="block text-[7px] text-[#718398]">R:R</span><b className="mt-0.5 block text-[10px]">1:{metrics?.rr.toFixed(1)}</b></div>
            </div>
            {isOpen ? <button type="button" onClick={() => onModifyPlan(isModifying ? 'open' : 'modifying')} className="h-10 shrink-0 rounded-xl border border-[#294054] bg-[#0d1a25] px-3 text-[10px] font-bold text-[#dbe5ed]"><SlidersHorizontal size={13} className="mr-1 inline"/>{isModifying ? 'Done' : 'Modify'}</button> : <button type="button" disabled={!executableQuote} onClick={onExecutePlan} className={`h-10 shrink-0 rounded-xl px-3 text-[9px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${tradePlan.side === 'buy' ? 'border border-[#16865f] bg-[#0c5b45] text-[#6df0bd]' : 'border border-[#8a2b39] bg-[#4a1b25] text-[#ff818b]'}`}><Check size={13} className="mr-1 inline"/>{tradePlan.pending ? 'PLACE' : side}</button>}
          </div>
        </section>
      );
    }

    return (
      <section className="mt-2.5 rounded-[18px] border border-[#1a2b3a] bg-[#08121b]/95 p-2.5 shadow-[0_14px_35px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-[13px] tracking-[0.02em]" style={{ color: accent }}>{pendingLabel}</strong><span className="truncate text-[11px] font-semibold text-[#d9e3ec]">{market?.symbol || '—'}</span>{isOpen && <span className="rounded-full bg-[#103025] px-2 py-0.5 text-[9px] font-bold text-[#5ee6b4]">{isModifying ? 'MODIFYING' : 'OPEN'}</span>}</div><p className="mt-0.5 text-[9px] text-[#6f8296]">{tradePlan.pending ? 'Drag entry / SL / TP directly on chart' : isOpen ? 'Drag SL / TP on chart to modify' : 'Drag SL / TP directly on chart'}</p></div>
          {!isOpen && <button type="button" onClick={onCancelPlan} className="grid size-8 place-items-center rounded-lg border border-[#223343] bg-[#0d1822] text-[#8193a6]" aria-label="Cancel trade plan"><X size={15}/></button>}
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center"><Metric label={tradePlan.pending ? 'Entry' : 'Risk'} value={tradePlan.pending ? Number(tradePlan.entry).toFixed(Number(tradePlan.entry) > 100 ? 2 : 5) : `${riskPercent.toFixed(2)}%`}/><Metric label="Lots" value={metrics?.lots.toFixed(2)}/><Metric label="SL" value={`${metrics?.slPips.toFixed(1)}p`}/><Metric label="R:R" value={`1:${metrics?.rr.toFixed(1)}`}/></div>

        {tradePlan.pending && (
          <div className="mt-1.5 space-y-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="flex shrink-0 items-center gap-1 text-[8px] font-bold text-[#718398]"><Clock3 size={11}/> Expiry</span>
              {[['GTC', 'GTC'], ['TODAY', 'Today'], ['SPECIFIED', 'Specified']].map(([value, label]) => <button key={value} type="button" onClick={() => onTradePlanChange({ expiration: value, ...(value === 'SPECIFIED' && !tradePlan.expirationAt ? { expirationAt: defaultSpecifiedExpiry() } : {}) })} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[8px] font-bold ${String(tradePlan.expiration || 'GTC').toUpperCase() === value ? 'border-[#245477] bg-[#0d2a3e] text-[#63caff]' : 'border-[#1a2c3b] bg-[#0a151f] text-[#718398]'}`}>{label}</button>)}
            </div>
            {String(tradePlan.expiration || '').toUpperCase() === 'SPECIFIED' && <label className="flex items-center gap-2 rounded-xl border border-[#1a3040] bg-[#091720] px-2.5 py-2"><Clock3 size={12} className="shrink-0 text-[#5f7488]"/><span className="shrink-0 text-[8px] font-bold text-[#718398]">Expires</span><input type="datetime-local" min={localDateTimeValue(new Date())} value={tradePlan.expirationAt || defaultSpecifiedExpiry()} onChange={event => onTradePlanChange({ expirationAt: event.target.value })} className="min-w-0 flex-1 bg-transparent text-[9px] font-semibold text-[#c8d5df] outline-none [color-scheme:dark]"/></label>}
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[#193044] bg-[#091723] px-3 py-2 text-[10px]"><span className="text-[#7f91a4]">Risk <b className="ml-1 text-[#f2f5f8]">${metrics?.riskDollars.toFixed(2)}</b></span><span className="text-[#7f91a4]">Potential <b className="ml-1 text-[#55dba9]">+${metrics?.reward.toFixed(2)}</b></span><span className="text-[#7f91a4]">TP <b className="ml-1 text-[#f2f5f8]">{metrics?.tpPips.toFixed(1)}p</b></span></div>

        <div className="mt-2 grid grid-cols-2 gap-2">{isOpen ? <><button type="button" onClick={() => onModifyPlan(isModifying ? 'open' : 'modifying')} className="h-11 rounded-xl border border-[#294054] bg-[#0d1a25] text-[12px] font-bold text-[#dbe5ed]"><SlidersHorizontal size={14} className="mr-1 inline"/>{isModifying ? 'Done' : 'Modify'}</button><button type="button" onClick={onCancelPlan} className="h-11 rounded-xl border border-[#8a2b39] bg-[#3b1720] text-[12px] font-bold text-[#ff818b]">Close</button></> : <><button type="button" onClick={onCancelPlan} className="h-11 rounded-xl border border-[#273847] bg-[#0d1822] text-[12px] font-bold text-[#b8c5d0]">Cancel</button><button type="button" disabled={!executableQuote} onClick={onExecutePlan} className={`h-11 rounded-xl text-[12px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${tradePlan.side === 'buy' ? 'border border-[#16865f] bg-[#0c5b45] text-[#6df0bd]' : 'border border-[#8a2b39] bg-[#4a1b25] text-[#ff818b]'}`}><Check size={14} className="mr-1 inline"/>{tradePlan.pending ? (tradePlan.editingOrderId ? 'Update Order' : 'Place Order') : `Execute ${side}`}</button></>}</div>
      </section>
    );
  }

  const compactControls = (
    <>
      {sizingPicker}{orderPicker}
      <div className="mb-1.5 flex items-center gap-1.5">
        <button type="button" onClick={() => setOrderPickerOpen(v => !v)} className="flex h-7 items-center gap-1 rounded-lg border border-[#1b2c3d] bg-[#09131d] px-2.5 text-[8px] font-extrabold text-[#9cb0c3]">{orderTypes.find(([id]) => id === orderType)?.[1]} <ChevronDown size={10}/></button>
        <span className="text-[8px] text-[#60758a]">{orderType === 'market' ? 'Server market execution' : 'Server pending order'}</span>
      </div>
      <div className={`grid ${focusMode ? 'grid-cols-[minmax(0,1fr)_94px_minmax(0,1fr)] gap-1.5' : 'grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] gap-2'}`}>
        <button type="button" disabled={!executableQuote} onClick={() => clickSide('sell')} className={`flex ${focusMode ? 'h-[58px] px-3' : 'h-[66px] px-4'} flex-col items-start justify-center rounded-[14px] border border-[#8a2b39] bg-gradient-to-br from-[#461b24] via-[#32131b] to-[#251017] text-left text-[#ff6975] disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]`}><span className="text-[10px] font-extrabold tracking-[0.045em]">SELL</span><strong className={`${focusMode ? 'text-[21px]' : 'text-[27px]'} mt-1 font-black leading-none tracking-[-0.04em] text-[#f9f3f4]`}>{market?.bid || '—'}</strong></button>
        <div className={`grid ${focusMode ? 'h-[58px]' : 'h-[66px]'} grid-cols-2 grid-rows-[auto_auto_1fr] items-center rounded-[14px] border border-[#1c2d3d] bg-[#09131d] px-2 py-1 text-center`}><button type="button" onClick={() => setPickerOpen(v => !v)} className="col-span-2 mx-auto flex items-center gap-1 text-[14px] font-black leading-none text-[#f4f7fb]">{sizingMode === 'lots' ? lots.toFixed(2) : `${riskPercent.toFixed(2)}%`} <ChevronDown size={12} className="text-[#74879d]"/></button><span className="col-span-2 text-[8px] font-medium text-[#718398]">{sizingMode === 'lots' ? 'Lots' : 'Risk'}</span><div className="col-span-2 flex items-end justify-between pt-0.5"><button type="button" onClick={() => sizingMode === 'lots' ? decrease() : onRiskPercentChange(Math.max(0.1, +(riskPercent - 0.1).toFixed(2)))} className="grid h-5 w-[29px] place-items-center rounded-md border border-[#142535] bg-[#0e1b27] text-[#93a4b7]"><Minus size={13}/></button><button type="button" onClick={() => sizingMode === 'lots' ? increase() : onRiskPercentChange(Math.min(5, +(riskPercent + 0.1).toFixed(2)))} className="grid h-5 w-[29px] place-items-center rounded-md border border-[#142535] bg-[#0e1b27] text-[#93a4b7]"><Plus size={13}/></button></div></div>
        <button type="button" disabled={!executableQuote} onClick={() => clickSide('buy')} className={`flex ${focusMode ? 'h-[58px] px-3' : 'h-[66px] px-4'} flex-col items-end justify-center rounded-[14px] border border-[#16865f] bg-gradient-to-bl from-[#0b6048] via-[#0b4838] to-[#0b2e27] text-right text-[#44dda9] disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]`}><span className="text-[10px] font-extrabold tracking-[0.045em]">BUY</span><strong className={`${focusMode ? 'text-[21px]' : 'text-[27px]'} mt-1 font-black leading-none tracking-[-0.04em] text-[#f3fbf8]`}>{market?.ask || '—'}</strong></button>
      </div>
    </>
  );

  if (focusMode) return <section className="relative shrink-0 border-t border-[#1a2b3a] bg-[#071019]/98 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_34px_rgba(0,0,0,0.26)] backdrop-blur-xl">{compactControls}</section>;

  return (
    <section className="relative mt-2.5">
      {compactControls}
      <div className="mt-2 flex min-h-7 items-center gap-2 overflow-x-auto whitespace-nowrap px-0.5 text-[9px] font-medium text-[#7a8ba0] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><span>{orderType === 'market' ? (sizingMode === 'risk' ? 'Planning' : 'Spread') : 'Pending'} <b className="ml-1 font-semibold text-[#b6c2d0]">{marketHint}</b></span><span className="h-3 w-px shrink-0 bg-[#243442]"/><span>Commission <b className="ml-1 font-semibold text-[#b6c2d0]">{formatCommission(market?.commissionPerLot)}</b></span><span className="h-3 w-px shrink-0 bg-[#243442]"/><span>Leverage <b className="ml-1 font-semibold text-[#b6c2d0]">{market?.defaultLeverage ? `1:${market.defaultLeverage}` : '—'}</b></span></div>
    </section>
  );
}
