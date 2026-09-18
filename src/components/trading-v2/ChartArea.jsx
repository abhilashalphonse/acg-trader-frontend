import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, TrendingUp, SlidersHorizontal, Square, Type, Shapes, Ruler } from 'lucide-react';
import TradingChart from '../TradingChart.jsx';
import DrawingLayer from './DrawingLayer.jsx';
import { formatInstrumentPrice, instrumentPipSize } from '../../utils/instrumentFormatting.js';

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

function TradePlanOverlay({ plan, onChange, coordinateApi, instrument }) {
  const layerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [preview, setPreview] = useState({});
  const [, forceLayout] = useState(0);

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  const metrics = useMemo(() => {
    const entry = Number(plan?.entry);
    const sl = Number(plan?.sl);
    const tp = Number(plan?.tp);
    const pip = instrumentPipSize(instrument);
    if (![entry, sl, tp, pip].every(Number.isFinite) || pip <= 0) return { slPips: 0, tpPips: 0 };
    return { slPips: Math.abs(entry - sl) / pip, tpPips: Math.abs(tp - entry) / pip };
  }, [instrument, plan]);

  useEffect(() => {
    if (!dragging || !coordinateApi?.yToPrice) return undefined;
    const field = dragging === 'limit' ? 'limitPrice' : dragging;

    const priceFromEvent = event => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const clientY = event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY ?? event.clientY;
      const price = coordinateApi.yToPrice(clientY - rect.top);
      return Number.isFinite(price) ? price : null;
    };

    const move = event => {
      const price = priceFromEvent(event);
      if (price == null) return;
      event.preventDefault?.();
      setPreview(current => ({ ...current, [field]: price }));
    };

    const up = event => {
      const price = priceFromEvent(event);
      const currentField = field;
      setDragging(null);
      setPreview(current => {
        const next = { ...current };
        delete next[currentField];
        return next;
      });
      if (price != null) onChange({ [currentField]: price, stage: 'ready' });
      else onChange({ stage: 'ready' });
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
  }, [coordinateApi, dragging, onChange]);

  if (!plan || plan.open || !coordinateApi?.priceToY) return null;
  const isBuy = plan.side === 'buy';
  const sourcePrice = field => {
    if (Object.prototype.hasOwnProperty.call(preview, field)) return Number(preview[field]);
    return Number(plan[field]);
  };
  const yFor = field => {
    const price = sourcePrice(field);
    if (!Number.isFinite(price)) return null;
    const y = coordinateApi.priceToY(price);
    return Number.isFinite(y) ? y : null;
  };

  const entryY = yFor('entry');
  const slY = yFor('sl');
  const tpY = yFor('tp');
  const rewardTop = entryY != null && tpY != null ? Math.min(entryY, tpY) : null;
  const rewardHeight = entryY != null && tpY != null ? Math.abs(entryY - tpY) : 0;
  const riskTop = entryY != null && slY != null ? Math.min(entryY, slY) : null;
  const riskHeight = entryY != null && slY != null ? Math.abs(entryY - slY) : 0;

  const line = (kind, field, color, label, value, draggable) => {
    const top = yFor(field);
    if (top == null) return null;
    return (
      <div className="absolute left-0 right-0 z-30" style={{ top }}>
        <div className="relative h-px" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}55` }}>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-1 text-[8px] font-black tracking-[0.03em]" style={{ borderColor: `${color}99`, backgroundColor: '#09121bcc', color }}>{label}</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[9px] font-extrabold" style={{ backgroundColor: color, color: kind === 'sl' ? '#2b0810' : '#032219' }}>{value}</span>
          {draggable && <button type="button" aria-label={`Drag ${label}`} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setDragging(kind); onChange({ stage: `dragging-${kind}` }); }} onTouchStart={event => { event.preventDefault(); event.stopPropagation(); setDragging(kind); onChange({ stage: `dragging-${kind}` }); }} className="absolute right-[54px] top-1/2 size-7 -translate-y-1/2 touch-none rounded-full border-2 bg-[#071019] shadow-[0_0_0_5px_rgba(255,255,255,0.04)]" style={{ borderColor: color }} />}
        </div>
      </div>
    );
  };

  const entryLabel = plan.pending ? `${isBuy ? 'BUY' : 'SELL'} ${String(plan.orderType || '').toUpperCase()}` : (isBuy ? 'BUY' : 'SELL');

  return (
    <div ref={layerRef} className="absolute inset-0 z-20 touch-none overflow-hidden rounded-xl">
      {rewardTop != null && <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: rewardTop, height: rewardHeight, background: 'linear-gradient(90deg, rgba(22,134,95,0.10), rgba(34,167,125,0.20))' }} />}
      {riskTop != null && <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: riskTop, height: riskHeight, background: 'linear-gradient(90deg, rgba(138,43,57,0.10), rgba(255,68,91,0.17))' }} />}
      {line('tp', 'tp', '#35d79d', 'TP', `+${metrics.tpPips.toFixed(1)}p`, true)}
      {line('entry', 'entry', '#42a5ff', entryLabel, formatInstrumentPrice(sourcePrice('entry'), instrument), Boolean(plan.pending))}
      {plan.pending && plan.orderType === 'stop-limit' && line('limit', 'limitPrice', '#b58cff', 'LIMIT', formatInstrumentPrice(sourcePrice('limitPrice'), instrument), true)}
      {line('sl', 'sl', '#ff5968', 'SL', `-${metrics.slPips.toFixed(1)}p`, true)}
      {dragging && <div className="pointer-events-none absolute right-[86px] top-3 z-40 rounded-lg border border-white/10 bg-[#071019]/95 px-2.5 py-1.5 text-right shadow-xl"><div className="text-[8px] uppercase tracking-[0.12em] text-[#708397]">{dragging === 'sl' ? 'Stop loss' : dragging === 'tp' ? 'Take profit' : dragging === 'limit' ? 'Limit price' : 'Entry price'}</div><strong className={`mt-0.5 block text-[11px] ${dragging === 'sl' ? 'text-[#ff6b78]' : dragging === 'tp' ? 'text-[#53e0ad]' : 'text-[#69bdff]'}`}>{formatInstrumentPrice(sourcePrice(dragging === 'limit' ? 'limitPrice' : dragging), instrument)}</strong></div>}
    </div>
  );
}

function OpenPositionProtectionOverlay({ symbol, positions = [], coordinateApi, instrument, onUpdatePosition = () => {} }) {
  const layerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [preview, setPreview] = useState({});
  const [, forceLayout] = useState(0);

  const activePositions = useMemo(
    () => (Array.isArray(positions) ? positions : []).filter(position =>
      String(position?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase()
    ),
    [positions, symbol],
  );

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  useEffect(() => {
    if (!dragging || !coordinateApi?.yToPrice) return undefined;

    const move = event => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientY = event.touches?.[0]?.clientY ?? event.clientY;
      const price = coordinateApi.yToPrice(clientY - rect.top);
      if (!Number.isFinite(price)) return;
      const key = `${dragging.positionId}:${dragging.kind}`;
      setPreview(current => ({ ...current, [key]: price }));
    };

    const up = async event => {
      const rect = layerRef.current?.getBoundingClientRect();
      const clientY = event.changedTouches?.[0]?.clientY ?? event.clientY;
      const price = rect ? coordinateApi.yToPrice(clientY - rect.top) : null;
      const current = dragging;
      setDragging(null);
      if (Number.isFinite(price)) {
        try {
          await onUpdatePosition(current.positionId, { [current.kind]: price });
        } finally {
          const key = `${current.positionId}:${current.kind}`;
          setPreview(values => {
            const next = { ...values };
            delete next[key];
            return next;
          });
        }
      }
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
  }, [coordinateApi, dragging, onUpdatePosition]);

  if (!coordinateApi?.priceToY || !activePositions.length) return null;

  const renderLine = (position, kind, color, label) => {
    const key = `${position.id}:${kind}`;
    const source = Object.prototype.hasOwnProperty.call(preview, key) ? preview[key] : position[kind];
    const price = Number(source);
    if (!Number.isFinite(price)) return null;
    const y = coordinateApi.priceToY(price);
    if (!Number.isFinite(y)) return null;
    const displayPrice = value => formatInstrumentPrice(value, instrument);

    return (
      <div key={key} className="pointer-events-none absolute left-0 right-0 z-30" style={{ top: y }}>
        <div className="relative h-px" style={{ backgroundColor: color }}>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[7px] font-black" style={{ borderColor: `${color}88`, backgroundColor: '#08111acc', color }}>{label}</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[8px] font-bold tabular-nums" style={{ backgroundColor: color, color: kind === 'sl' ? '#2b0810' : '#032219' }}>{displayPrice(price)}</span>
          <button
            type="button"
            aria-label={`Drag ${label}`}
            onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setDragging({ positionId: position.id, kind }); }}
            onTouchStart={event => { event.preventDefault(); event.stopPropagation(); setDragging({ positionId: position.id, kind }); }}
            className="pointer-events-auto absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent"
          />
        </div>
      </div>
    );
  };

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {activePositions.flatMap(position => [
        renderLine(position, 'tp', '#35d79d', 'TP'),
        renderLine(position, 'sl', '#ff5968', 'SL'),
      ])}
    </div>
  );
}

export default function ChartArea({
  symbol,
  instrument = null,
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
  onUpdatePosition = () => {},
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
        <TradingChart symbol={symbol} instrument={instrument} timeframe={chartTimeframe} tick={tick} chartMode={chartMode} bidPrice={price} positions={positions} indicators={indicators} onCoordinateApi={setCoordinateApi} />
        <DrawingLayer symbol={symbol} timeframe={chartTimeframe} tool={selectedTool} onToolChange={onSelectTool} disabled={Boolean(tradePlan)} coordinateApi={coordinateApi} />
        <TradePlanOverlay plan={tradePlan} onChange={onTradePlanChange} coordinateApi={coordinateApi} instrument={instrument} />
        {!tradePlan && <OpenPositionProtectionOverlay symbol={symbol} positions={positions} coordinateApi={coordinateApi} instrument={instrument} onUpdatePosition={onUpdatePosition} />}

        {!tradePlan && !embedded && <div className="pointer-events-none absolute bottom-1 right-[74px] z-10 rounded bg-[#08111a]/80 px-1.5 py-0.5 text-[8px] font-semibold tabular-nums text-[#6f8295] backdrop-blur-sm">{formatCountdown(remaining)}</div>}
      </div>
    </div>
  );
}
