import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  TrendingUp,
  SlidersHorizontal,
  Square,
  Type,
  Shapes,
  Smile,
  Ruler,
  Magnet,
} from 'lucide-react';
import TradingChart from '../TradingChart.jsx';

const tools = [
  ['cursor', Crosshair],
  ['trendline', TrendingUp],
  ['lines', SlidersHorizontal],
  ['rectangle', Square],
  ['text', Type],
  ['geometry', Shapes],
  ['icon', Smile],
  ['measure', Ruler],
  ['magnet', Magnet],
];

const secondsByTimeframe = {
  S1: 1,
  S5: 5,
  S15: 15,
  S30: 30,
  M1: 60,
  M5: 300,
  M15: 900,
  H1: 3600,
  H4: 14400,
  D1: 86400,
};

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function TradePlanOverlay({ plan, onChange }) {
  const layerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [positions, setPositions] = useState({ tp: 27, entry: 50, sl: 69 });

  const metrics = useMemo(() => {
    const entry = Number(plan?.entry) || 0;
    const sl = Number(plan?.sl) || entry;
    const tp = Number(plan?.tp) || entry;
    const pip = entry > 100 ? 0.01 : 0.0001;
    return {
      slPips: Math.abs(entry - sl) / pip,
      tpPips: Math.abs(tp - entry) / pip,
    };
  }, [plan]);

  useEffect(() => {
    if (!dragging) return undefined;
    const move = event => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientY = event.touches?.[0]?.clientY ?? event.clientY;
      const raw = ((clientY - rect.top) / rect.height) * 100;
      const isBuy = plan.side === 'buy';
      const next = Math.min(88, Math.max(12, raw));
      if (dragging === 'sl') {
        const bounded = isBuy ? Math.max(positions.entry + 6, next) : Math.min(positions.entry - 6, next);
        setPositions(p => ({ ...p, sl: bounded }));
        const pip = plan.entry > 100 ? 0.01 : 0.0001;
        const pips = Math.max(0.5, Math.abs(bounded - positions.entry) * 0.22);
        onChange({ sl: isBuy ? plan.entry - pips * pip : plan.entry + pips * pip, stage: 'dragging-sl' });
      } else if (dragging === 'tp') {
        const bounded = isBuy ? Math.min(positions.entry - 6, next) : Math.max(positions.entry + 6, next);
        setPositions(p => ({ ...p, tp: bounded }));
        const pip = plan.entry > 100 ? 0.01 : 0.0001;
        const pips = Math.max(0.5, Math.abs(bounded - positions.entry) * 0.34);
        onChange({ tp: isBuy ? plan.entry + pips * pip : plan.entry - pips * pip, stage: 'dragging-tp' });
      }
    };
    const up = () => {
      setDragging(null);
      onChange({ stage: plan.open ? 'open' : 'ready' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [dragging, onChange, plan, positions.entry]);

  if (!plan) return null;
  const isBuy = plan.side === 'buy';
  const rewardTop = Math.min(positions.tp, positions.entry);
  const rewardHeight = Math.abs(positions.entry - positions.tp);
  const riskTop = Math.min(positions.entry, positions.sl);
  const riskHeight = Math.abs(positions.sl - positions.entry);

  const line = (kind, top, color, label, value, draggable) => (
    <div className="absolute left-0 right-0 z-30" style={{ top: `${top}%` }}>
      <div className="relative h-px" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}55` }}>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-1 text-[8px] font-black tracking-[0.03em]" style={{ borderColor: `${color}99`, backgroundColor: '#09121bcc', color }}>{label}</span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[9px] font-extrabold" style={{ backgroundColor: color, color: kind === 'sl' ? '#2b0810' : '#032219' }}>{value}</span>
        {draggable && (
          <button
            type="button"
            aria-label={`Drag ${label}`}
            onPointerDown={event => { event.preventDefault(); setDragging(kind); }}
            onTouchStart={event => { event.preventDefault(); setDragging(kind); }}
            className="absolute right-[54px] top-1/2 size-7 -translate-y-1/2 touch-none rounded-full border-2 bg-[#071019] shadow-[0_0_0_5px_rgba(255,255,255,0.04)]"
            style={{ borderColor: color }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div ref={layerRef} className="absolute inset-0 z-20 touch-none overflow-hidden rounded-xl">
      <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: `${rewardTop}%`, height: `${rewardHeight}%`, background: 'linear-gradient(90deg, rgba(22,134,95,0.10), rgba(34,167,125,0.20))' }} />
      <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: `${riskTop}%`, height: `${riskHeight}%`, background: 'linear-gradient(90deg, rgba(138,43,57,0.10), rgba(255,68,91,0.17))' }} />
      {line('tp', positions.tp, '#35d79d', 'TP', `+${metrics.tpPips.toFixed(1)}p`, !plan.open || plan.stage === 'open')}
      {line('entry', positions.entry, '#42a5ff', isBuy ? `BUY${plan.open ? ' • OPEN' : ''}` : `SELL${plan.open ? ' • OPEN' : ''}`, Number(plan.entry).toFixed(plan.entry > 100 ? 2 : 5), false)}
      {line('sl', positions.sl, '#ff5968', 'SL', `-${metrics.slPips.toFixed(1)}p`, !plan.open || plan.stage === 'open')}
      {dragging && (
        <div className="pointer-events-none absolute right-[86px] z-40 rounded-lg border border-white/10 bg-[#071019]/95 px-2.5 py-1.5 text-right shadow-xl" style={{ top: `${(dragging === 'sl' ? positions.sl : positions.tp) - 12}%` }}>
          <div className="text-[8px] uppercase tracking-[0.12em] text-[#708397]">{dragging === 'sl' ? 'Stop loss' : 'Take profit'}</div>
          <strong className={`mt-0.5 block text-[11px] ${dragging === 'sl' ? 'text-[#ff6b78]' : 'text-[#53e0ad]'}`}>{dragging === 'sl' ? `-${metrics.slPips.toFixed(1)} pips` : `+${metrics.tpPips.toFixed(1)} pips`}</strong>
        </div>
      )}
    </div>
  );
}

export default function ChartArea({
  symbol,
  chartTimeframe,
  tick,
  price,
  ask,
  chartMode,
  selectedTool,
  onSelectTool,
  focusMode = false,
  tradePlan,
  onTradePlanChange = () => {},
}) {
  const timeframeSeconds = secondsByTimeframe[chartTimeframe] || 60;
  const [remaining, setRemaining] = useState(() => timeframeSeconds - (Math.floor(Date.now() / 1000) % timeframeSeconds));

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const mod = now % timeframeSeconds;
      setRemaining(mod === 0 ? timeframeSeconds : timeframeSeconds - mod);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [timeframeSeconds]);

  const formattedPrice = useMemo(() => price || '0.99368', [price]);

  const areaClass = focusMode
    ? 'grid h-full min-h-0 grid-cols-[36px_minmax(0,1fr)] gap-1.5 px-1.5 pb-1.5'
    : 'grid h-[270px] grid-cols-[34px_minmax(0,1fr)] gap-2 px-2 pb-2 md:h-[300px]';

  const toolbarClass = focusMode
    ? 'flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto rounded-xl border border-[#1b2c3d] bg-[#09131d] py-1.5 shadow-[inset_0_1px_rgba(255,255,255,0.02)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : 'flex min-h-0 flex-col items-center gap-0.5 rounded-xl border border-[#1b2c3d] bg-[#09131d] py-1.5 shadow-[inset_0_1px_rgba(255,255,255,0.02)]';

  return (
    <div className={areaClass}>
      <aside className={toolbarClass} aria-label="Drawing tools">
        {tools.map(([id, Icon]) => (
          <button key={id} type="button" onClick={() => onSelectTool(id)} aria-label={id} className={`grid ${focusMode ? 'size-[29px]' : 'size-[27px]'} shrink-0 place-items-center rounded-lg transition ${selectedTool === id ? 'bg-[#0f3149] text-[#59c8ff]' : 'text-[#74879c] hover:bg-white/[0.035] hover:text-[#d7e4f1]'}`}>
            <Icon size={focusMode ? 17 : 16} strokeWidth={1.75} />
          </button>
        ))}
      </aside>

      <div className="relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-[#1b2c3d] bg-[#080f17]">
        <TradingChart symbol={symbol} timeframe={chartTimeframe} tick={tick} chartMode={chartMode} bidPrice={price} askPrice={ask} />
        <TradePlanOverlay plan={tradePlan} onChange={onTradePlanChange} />

        {!tradePlan && (
          <div className="pointer-events-none absolute right-0 top-[31%] z-10 flex -translate-y-1/2 flex-col items-end">
            <span className="rounded-l-md bg-[#22a77d] px-2 py-1 text-[10px] font-extrabold leading-none text-[#e9fff8] shadow-[0_0_14px_rgba(34,167,125,0.18)]">{formattedPrice}</span>
            <small className="mt-0.5 rounded-bl bg-[#16684f] px-2 py-0.5 text-[8px] font-semibold leading-none text-[#a6e7cf]">{formatCountdown(remaining)}</small>
          </div>
        )}
      </div>
    </div>
  );
}
