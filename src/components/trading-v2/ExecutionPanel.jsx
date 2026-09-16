import React, { useMemo, useState } from 'react';
import { ChevronDown, Minus, Plus, X, Check, SlidersHorizontal } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getPlanMetrics(plan, riskPercent) {
  if (!plan) return null;
  const entry = Number(plan.entry) || 0;
  const sl = Number(plan.sl) || entry;
  const tp = Number(plan.tp) || entry;
  const pipSize = entry > 100 ? 0.01 : 0.0001;
  const slPips = Math.max(0.1, Math.abs(entry - sl) / pipSize);
  const tpPips = Math.max(0.1, Math.abs(tp - entry) / pipSize);
  const riskDollars = +(12500 * (riskPercent / 100)).toFixed(2);
  const lots = clamp(riskDollars / Math.max(slPips * 10, 0.01), 0.01, 100);
  const reward = +(riskDollars * (tpPips / slPips)).toFixed(2);
  return { slPips, tpPips, riskDollars, lots, rr: tpPips / slPips, reward };
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
  tradePlan,
  onStartPlan = () => {},
  onCancelPlan = () => {},
  onExecutePlan = () => {},
}) {
  const [internalLots, setInternalLots] = useState(0.10);
  const [pickerOpen, setPickerOpen] = useState(false);
  const lots = controlledLots ?? internalLots;
  const setLots = onLotsChange ?? setInternalLots;
  const decrease = () => setLots(Math.max(0.01, +(lots - 0.01).toFixed(2)));
  const increase = () => setLots(+(lots + 0.01).toFixed(2));
  const metrics = useMemo(() => getPlanMetrics(tradePlan, riskPercent), [tradePlan, riskPercent]);

  if (focusMode) {
    return (
      <section className="shrink-0 border-t border-[#1a2b3a] bg-[#071019]/98 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_34px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <div className="grid grid-cols-[minmax(0,1fr)_94px_minmax(0,1fr)] gap-1.5">
          <button type="button" className="flex h-[58px] flex-col items-start justify-center rounded-[14px] border border-[#8a2b39] bg-gradient-to-br from-[#461b24] via-[#32131b] to-[#251017] px-3 text-left text-[#ff6975]">
            <span className="text-[10px] font-extrabold tracking-[0.045em]">SELL</span>
            <strong className="mt-1 text-[21px] font-black leading-none tracking-[-0.04em] text-[#f9f3f4]">{market.bid}</strong>
          </button>
          <div className="grid h-[58px] place-items-center rounded-[14px] border border-[#1c2d3d] bg-[#09131d] text-center">
            <strong className="text-[14px]">{lots.toFixed(2)}</strong><span className="text-[8px] text-[#718398]">Lots</span>
          </div>
          <button type="button" className="flex h-[58px] flex-col items-end justify-center rounded-[14px] border border-[#16865f] bg-gradient-to-bl from-[#0b6048] via-[#0b4838] to-[#0b2e27] px-3 text-right text-[#44dda9]">
            <span className="text-[10px] font-extrabold tracking-[0.045em]">BUY</span>
            <strong className="mt-1 text-[21px] font-black leading-none tracking-[-0.04em] text-[#f3fbf8]">{market.ask}</strong>
          </button>
        </div>
      </section>
    );
  }

  if (tradePlan) {
    const side = tradePlan.side === 'buy' ? 'BUY' : 'SELL';
    const accent = tradePlan.side === 'buy' ? '#42d7a2' : '#ff6975';
    const isOpen = tradePlan.open;
    return (
      <section className="mt-2.5 rounded-[18px] border border-[#1a2b3a] bg-[#08121b]/95 p-2.5 shadow-[0_14px_35px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-[14px] tracking-[0.03em]" style={{ color: accent }}>{side}</strong>
              <span className="truncate text-[11px] font-semibold text-[#d9e3ec]">{market.symbol}</span>
              {isOpen && <span className="rounded-full bg-[#103025] px-2 py-0.5 text-[9px] font-bold text-[#5ee6b4]">OPEN</span>}
            </div>
            <p className="mt-0.5 text-[9px] text-[#6f8296]">{isOpen ? 'Position controls' : 'Drag SL / TP directly on chart'}</p>
          </div>
          {!isOpen && (
            <button type="button" onClick={onCancelPlan} className="grid size-8 place-items-center rounded-lg border border-[#223343] bg-[#0d1822] text-[#8193a6]" aria-label="Cancel trade plan"><X size={15} /></button>
          )}
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          <div className="rounded-xl border border-[#1b2b39] bg-[#0b151f] px-1.5 py-2"><span className="block text-[8px] text-[#718398]">Risk</span><b className="mt-0.5 block text-[12px]">{riskPercent.toFixed(2)}%</b></div>
          <div className="rounded-xl border border-[#1b2b39] bg-[#0b151f] px-1.5 py-2"><span className="block text-[8px] text-[#718398]">Lots</span><b className="mt-0.5 block text-[12px]">{metrics?.lots.toFixed(2)}</b></div>
          <div className="rounded-xl border border-[#1b2b39] bg-[#0b151f] px-1.5 py-2"><span className="block text-[8px] text-[#718398]">SL</span><b className="mt-0.5 block text-[12px]">{metrics?.slPips.toFixed(1)}p</b></div>
          <div className="rounded-xl border border-[#1b2b39] bg-[#0b151f] px-1.5 py-2"><span className="block text-[8px] text-[#718398]">R:R</span><b className="mt-0.5 block text-[12px]">1:{metrics?.rr.toFixed(1)}</b></div>
        </div>

        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[#193044] bg-[#091723] px-3 py-2 text-[10px]">
          <span className="text-[#7f91a4]">Risk <b className="ml-1 text-[#f2f5f8]">${metrics?.riskDollars.toFixed(2)}</b></span>
          <span className="text-[#7f91a4]">Potential <b className="ml-1 text-[#55dba9]">+${metrics?.reward.toFixed(2)}</b></span>
          <span className="text-[#7f91a4]">TP <b className="ml-1 text-[#f2f5f8]">{metrics?.tpPips.toFixed(1)}p</b></span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {isOpen ? (
            <>
              <button type="button" className="h-11 rounded-xl border border-[#294054] bg-[#0d1a25] text-[12px] font-bold text-[#dbe5ed]"><SlidersHorizontal size={14} className="mr-1 inline" />Modify</button>
              <button type="button" onClick={onCancelPlan} className="h-11 rounded-xl border border-[#8a2b39] bg-[#3b1720] text-[12px] font-bold text-[#ff818b]">Close demo</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onCancelPlan} className="h-11 rounded-xl border border-[#273847] bg-[#0d1822] text-[12px] font-bold text-[#b8c5d0]">Cancel</button>
              <button type="button" onClick={onExecutePlan} className={`h-11 rounded-xl text-[12px] font-black ${tradePlan.side === 'buy' ? 'border border-[#16865f] bg-[#0c5b45] text-[#6df0bd]' : 'border border-[#8a2b39] bg-[#4a1b25] text-[#ff818b]'}`}><Check size={14} className="mr-1 inline" />Execute {side}</button>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="relative mt-2.5">
      {pickerOpen && (
        <div className="absolute bottom-[82px] left-1/2 z-40 w-[168px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#223443] bg-[#0a141e] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.5)]">
          <button type="button" onClick={() => { onSizingModeChange('lots'); setPickerOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] ${sizingMode === 'lots' ? 'bg-[#10283a] text-[#60caff]' : 'text-[#c0ccd7]'}`}><span><b className="block">Lots</b><small className="text-[#718398]">Manual size</small></span>{sizingMode === 'lots' && <Check size={14} />}</button>
          <button type="button" onClick={() => { onSizingModeChange('risk'); setPickerOpen(false); }} className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] ${sizingMode === 'risk' ? 'bg-[#10283a] text-[#60caff]' : 'text-[#c0ccd7]'}`}><span><b className="block">Risk %</b><small className="text-[#718398]">Auto lot sizing</small></span>{sizingMode === 'risk' && <Check size={14} />}</button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] gap-2">
        <button type="button" onClick={() => sizingMode === 'risk' && onStartPlan('sell')} className="flex h-[66px] flex-col items-start justify-center rounded-[16px] border border-[#8a2b39] bg-gradient-to-br from-[#461b24] via-[#32131b] to-[#251017] px-4 text-left text-[#ff6975] shadow-[0_0_22px_rgba(255,68,91,0.09),inset_0_1px_rgba(255,255,255,0.035)]">
          <span className="text-[12px] font-extrabold tracking-[0.035em]">SELL</span><strong className="mt-1 text-[27px] font-black leading-none tracking-[-0.045em] text-[#f9f3f4]">{market.bid}</strong>
        </button>

        <div className="grid h-[66px] grid-cols-2 grid-rows-[auto_auto_1fr] items-center rounded-[16px] border border-[#1c2d3d] bg-[#09131d] px-2.5 py-1.5 text-center shadow-[inset_0_1px_rgba(255,255,255,0.025)]">
          <button type="button" onClick={() => setPickerOpen(v => !v)} className="col-span-2 mx-auto flex items-center gap-1 text-[16px] font-black leading-none text-[#f4f7fb]">
            {sizingMode === 'lots' ? lots.toFixed(2) : `${riskPercent.toFixed(2)}%`} <ChevronDown size={14} className="text-[#74879d]" />
          </button>
          <span className="col-span-2 -mt-0.5 text-[9px] font-medium text-[#718398]">{sizingMode === 'lots' ? 'Lots' : 'Risk'}</span>
          <div className="col-span-2 flex items-end justify-between pt-1">
            <button type="button" onClick={() => sizingMode === 'lots' ? decrease() : onRiskPercentChange(Math.max(0.1, +(riskPercent - 0.1).toFixed(2)))} aria-label="Decrease size" className="grid h-6 w-[32px] place-items-center rounded-lg border border-[#142535] bg-[#0e1b27] text-[#93a4b7]"><Minus size={15} /></button>
            <button type="button" onClick={() => sizingMode === 'lots' ? increase() : onRiskPercentChange(Math.min(5, +(riskPercent + 0.1).toFixed(2)))} aria-label="Increase size" className="grid h-6 w-[32px] place-items-center rounded-lg border border-[#142535] bg-[#0e1b27] text-[#93a4b7]"><Plus size={15} /></button>
          </div>
        </div>

        <button type="button" onClick={() => sizingMode === 'risk' && onStartPlan('buy')} className="flex h-[66px] flex-col items-end justify-center rounded-[16px] border border-[#16865f] bg-gradient-to-bl from-[#0b6048] via-[#0b4838] to-[#0b2e27] px-4 text-right text-[#44dda9] shadow-[0_0_24px_rgba(32,209,151,0.10),inset_0_1px_rgba(255,255,255,0.035)]">
          <span className="text-[12px] font-extrabold tracking-[0.035em]">BUY</span><strong className="mt-1 text-[27px] font-black leading-none tracking-[-0.045em] text-[#f3fbf8]">{market.ask}</strong>
        </button>
      </div>

      <div className="mt-2 flex min-h-7 items-center gap-2 overflow-x-auto whitespace-nowrap px-0.5 text-[9px] font-medium text-[#7a8ba0] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span>{sizingMode === 'risk' ? 'Planning' : 'Spread'} <b className="ml-1 font-semibold text-[#b6c2d0]">{sizingMode === 'risk' ? 'Tap Buy/Sell' : '0.5 pips'}</b></span>
        <span className="h-3 w-px shrink-0 bg-[#243442]" />
        <span>Commission <b className="ml-1 font-semibold text-[#b6c2d0]">$0</b></span>
        <span className="h-3 w-px shrink-0 bg-[#243442]" />
        <span>Leverage <b className="ml-1 font-semibold text-[#b6c2d0]">1:100</b></span>
        <span className="ml-auto pl-2">Margin Required <b className="ml-1 font-semibold text-[#c8d2dd]">$99.37</b></span>
      </div>
    </section>
  );
}
