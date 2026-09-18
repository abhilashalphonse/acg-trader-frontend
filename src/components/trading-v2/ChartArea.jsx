import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, TrendingUp, SlidersHorizontal, Square, Type, Shapes, Ruler } from 'lucide-react';
import TradingChart from '../TradingChart.jsx';
import DrawingLayer from './DrawingLayer.jsx';

const tools = [
  ['cursor', Crosshair, 'Select'],
  ['trendline', TrendingUp, 'Trend line'],
  ['hline', SlidersHorizontal, 'Horizontal line'],
  ['vline', Ruler, 'Vertical line'],
  ['rectangle', Square, 'Rectangle'],
  ['fibonacci', Shapes, 'Fibonacci'],
  ['text', Type, 'Text'],
];

const secondsByTimeframe = { S1: 1, S5: 5, S15: 15, S30: 30, M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 };
const oscillatorIds = new Set(['rsi', 'macd', 'atr', 'stochastic']);

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function TradePlanOverlay({ plan, onChange }) {
  const layerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [positions, setPositions] = useState({ tp: 27, entry: 50, limit: 57, sl: 69 });

  useEffect(() => {
    if (!plan) return;
    const isBuy = plan.side === 'buy';
    if (plan.pending) {
      setPositions({ tp: isBuy ? 24 : 76, entry: isBuy ? (plan.orderType === 'limit' ? 58 : 42) : (plan.orderType === 'limit' ? 42 : 58), limit: isBuy ? 48 : 52, sl: isBuy ? 76 : 24 });
    } else {
      setPositions({ tp: isBuy ? 27 : 73, entry: 50, limit: 57, sl: isBuy ? 69 : 31 });
    }
  }, [plan?.side, plan?.pending, plan?.orderType]);

  const metrics = useMemo(() => {
    const entry = Number(plan?.entry) || 0;
    const sl = Number(plan?.sl) || entry;
    const tp = Number(plan?.tp) || entry;
    const pip = entry > 100 ? 0.01 : 0.0001;
    return { slPips: Math.abs(entry - sl) / pip, tpPips: Math.abs(tp - entry) / pip };
  }, [plan]);

  useEffect(() => {
    if (!dragging) return undefined;
    const move = event => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientY = event.touches?.[0]?.clientY ?? event.clientY;
      const raw = ((clientY - rect.top) / rect.height) * 100;
      const next = Math.min(88, Math.max(12, raw));
      const isBuy = plan.side === 'buy';
      const pip = plan.entry > 100 ? 0.01 : 0.0001;

      if (dragging === 'sl') {
        const bounded = isBuy ? Math.max(positions.entry + 6, next) : Math.min(positions.entry - 6, next);
        setPositions(p => ({ ...p, sl: bounded }));
        const pips = Math.max(0.5, Math.abs(bounded - positions.entry) * 0.22);
        onChange({ sl: isBuy ? plan.entry - pips * pip : plan.entry + pips * pip, stage: 'dragging-sl' });
      } else if (dragging === 'tp') {
        const bounded = isBuy ? Math.min(positions.entry - 6, next) : Math.max(positions.entry + 6, next);
        setPositions(p => ({ ...p, tp: bounded }));
        const pips = Math.max(0.5, Math.abs(bounded - positions.entry) * 0.34);
        onChange({ tp: isBuy ? plan.entry + pips * pip : plan.entry - pips * pip, stage: 'dragging-tp' });
      } else if (dragging === 'entry') {
        setPositions(p => ({ ...p, entry: next }));
        const market = Number(plan.marketPrice) || Number(plan.entry) || 0;
        const deltaPips = (50 - next) * 0.18;
        const entry = market + deltaPips * pip;
        const slDistance = Math.max(2, metrics.slPips) * pip;
        const tpDistance = Math.max(4, metrics.tpPips) * pip;
        onChange({ entry, sl: isBuy ? entry - slDistance : entry + slDistance, tp: isBuy ? entry + tpDistance : entry - tpDistance, stage: 'dragging-entry' });
      } else if (dragging === 'limit') {
        setPositions(p => ({ ...p, limit: next }));
        const offsetPips = Math.max(0.5, Math.abs(next - positions.entry) * 0.14);
        onChange({ limitPrice: isBuy ? plan.entry - offsetPips * pip : plan.entry + offsetPips * pip, stage: 'dragging-limit' });
      }
    };
    const up = () => { setDragging(null); onChange({ stage: plan.open ? 'modifying' : 'ready' }); };
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
  }, [dragging, onChange, plan, positions.entry, metrics.slPips, metrics.tpPips]);

  if (!plan) return null;
  const isBuy = plan.side === 'buy';
  const rewardTop = Math.min(positions.tp, positions.entry);
  const rewardHeight = Math.abs(positions.entry - positions.tp);
  const riskTop = Math.min(positions.entry, positions.sl);
  const riskHeight = Math.abs(positions.sl - positions.entry);
  const decimals = Number(plan.entry) > 100 ? 2 : 5;

  const line = (kind, top, color, label, value, draggable) => (
    <div className="absolute left-0 right-0 z-30" style={{ top: `${top}%` }}><div className="relative h-px" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}55` }}><span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-1 text-[8px] font-black tracking-[0.03em]" style={{ borderColor: `${color}99`, backgroundColor: '#09121bcc', color }}>{label}</span><span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[9px] font-extrabold" style={{ backgroundColor: color, color: kind === 'sl' ? '#2b0810' : '#032219' }}>{value}</span>{draggable && <button type="button" aria-label={`Drag ${label}`} onPointerDown={event => { event.preventDefault(); setDragging(kind); }} onTouchStart={event => { event.preventDefault(); setDragging(kind); }} className="absolute right-[54px] top-1/2 size-7 -translate-y-1/2 touch-none rounded-full border-2 bg-[#071019] shadow-[0_0_0_5px_rgba(255,255,255,0.04)]" style={{ borderColor: color }} />}</div></div>
  );

  const entryLabel = plan.pending ? `${isBuy ? 'BUY' : 'SELL'} ${String(plan.orderType || '').toUpperCase()}` : isBuy ? `BUY${plan.open ? ' • OPEN' : ''}` : `SELL${plan.open ? ' • OPEN' : ''}`;

  return (
    <div ref={layerRef} className="absolute inset-0 z-20 touch-none overflow-hidden rounded-xl">
      <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: `${rewardTop}%`, height: `${rewardHeight}%`, background: 'linear-gradient(90deg, rgba(22,134,95,0.10), rgba(34,167,125,0.20))' }} />
      <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: `${riskTop}%`, height: `${riskHeight}%`, background: 'linear-gradient(90deg, rgba(138,43,57,0.10), rgba(255,68,91,0.17))' }} />
      {line('tp', positions.tp, '#35d79d', 'TP', `+${metrics.tpPips.toFixed(1)}p`, !plan.open || plan.stage === 'modifying')}
      {line('entry', positions.entry, '#42a5ff', entryLabel, Number(plan.entry).toFixed(decimals), Boolean(plan.pending && !plan.open))}
      {plan.pending && plan.orderType === 'stop-limit' && line('limit', positions.limit, '#b58cff', 'LIMIT', Number(plan.limitPrice ?? plan.entry).toFixed(decimals), !plan.open)}
      {line('sl', positions.sl, '#ff5968', 'SL', `-${metrics.slPips.toFixed(1)}p`, !plan.open || plan.stage === 'modifying')}
      {dragging && <div className="pointer-events-none absolute right-[86px] z-40 rounded-lg border border-white/10 bg-[#071019]/95 px-2.5 py-1.5 text-right shadow-xl" style={{ top: `${((dragging === 'sl' ? positions.sl : dragging === 'tp' ? positions.tp : dragging === 'limit' ? positions.limit : positions.entry) - 12)}%` }}><div className="text-[8px] uppercase tracking-[0.12em] text-[#708397]">{dragging === 'sl' ? 'Stop loss' : dragging === 'tp' ? 'Take profit' : dragging === 'limit' ? 'Limit price' : 'Entry price'}</div><strong className={`mt-0.5 block text-[11px] ${dragging === 'sl' ? 'text-[#ff6b78]' : dragging === 'tp' ? 'text-[#53e0ad]' : 'text-[#69bdff]'}`}>{dragging === 'sl' ? `-${metrics.slPips.toFixed(1)} pips` : dragging === 'tp' ? `+${metrics.tpPips.toFixed(1)} pips` : Number(dragging === 'limit' ? plan.limitPrice : plan.entry).toFixed(decimals)}</strong></div>}
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
  embedded = false,
  hideToolbar = false,
  tradePlan,
  onTradePlanChange = () => {},
  indicators = [],
  positions = [],
}) {
  const timeframeSeconds = secondsByTimeframe[chartTimeframe] || 60;
  const [remaining, setRemaining] = useState(() => timeframeSeconds - (Math.floor(Date.now() / 1000) % timeframeSeconds));
  const [coordinateApi, setCoordinateApi] = useState(null);
  const oscillatorCount = indicators.filter(item => item.visible !== false && oscillatorIds.has(item.id)).length;

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

  const formattedPrice = useMemo(() => price || '—', [price]);
  const heightClass = oscillatorCount ? (oscillatorCount > 1 ? 'h-[430px] md:h-[440px]' : 'h-[360px] md:h-[440px]') : 'h-[270px] md:h-[300px]';
  const areaClass = embedded
    ? `grid h-full min-h-0 ${hideToolbar ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[36px_minmax(0,1fr)]'} gap-1.5`
    : focusMode
      ? 'grid h-full min-h-0 grid-cols-[36px_minmax(0,1fr)] gap-1.5 px-1.5 pb-1.5'
      : `grid ${heightClass} grid-cols-[34px_minmax(0,1fr)] gap-2 px-2 pb-2`;

  const toolbarClass = focusMode || embedded
    ? 'flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto rounded-xl border border-[#1b2c3d] bg-[#09131d] py-1.5 shadow-[inset_0_1px_rgba(255,255,255,0.02)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : 'flex min-h-0 flex-col items-center gap-0.5 rounded-xl border border-[#1b2c3d] bg-[#09131d] py-1.5 shadow-[inset_0_1px_rgba(255,255,255,0.02)]';

  return (
    <div className={areaClass}>
      {!hideToolbar && <aside className={toolbarClass} aria-label="Drawing tools">{tools.map(([id, Icon, label]) => <button key={id} type="button" title={label} onClick={() => !tradePlan && onSelectTool(id)} aria-label={label} disabled={Boolean(tradePlan)} className={`grid ${focusMode ? 'size-[29px]' : 'size-[27px]'} shrink-0 place-items-center rounded-lg transition ${selectedTool === id ? 'bg-[#0f3149] text-[#59c8ff]' : 'text-[#74879c] hover:bg-white/[0.035] hover:text-[#d7e4f1]'} disabled:cursor-not-allowed disabled:opacity-30`}><Icon size={focusMode ? 17 : 16} strokeWidth={1.75} /></button>)}</aside>}

      <div className={`relative min-h-0 min-w-0 overflow-hidden ${embedded ? '' : 'rounded-xl border border-[#1b2c3d]'} bg-[#080f17]`}>
        <TradingChart symbol={symbol} timeframe={chartTimeframe} tick={tick} chartMode={chartMode} bidPrice={price} positions={positions} indicators={indicators} onCoordinateApi={setCoordinateApi} />
        <DrawingLayer symbol={symbol} timeframe={chartTimeframe} tool={selectedTool} onToolChange={onSelectTool} disabled={Boolean(tradePlan)} coordinateApi={coordinateApi} />
        <TradePlanOverlay plan={tradePlan} onChange={onTradePlanChange} />

        {!tradePlan && !embedded && <div className="pointer-events-none absolute bottom-1 right-[74px] z-10 rounded bg-[#08111a]/80 px-1.5 py-0.5 text-[8px] font-semibold tabular-nums text-[#6f8295] backdrop-blur-sm">{formatCountdown(remaining)}</div>}
      </div>
    </div>
  );
}
