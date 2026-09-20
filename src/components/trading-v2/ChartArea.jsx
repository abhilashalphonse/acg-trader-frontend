import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, TrendingUp, SlidersHorizontal, Square, Type, Shapes, Ruler, Eye, EyeOff, RotateCcw, ScanLine } from 'lucide-react';
import TradingChart from '../TradingChart.jsx';
import DrawingLayer from './DrawingLayer.jsx';
import { formatInstrumentPrice, instrumentPipSize } from '../../utils/instrumentFormatting.js';
import { estimatePositionPnlAtPrice, estimateStopRisk, positionDistancePips } from '../../utils/tradingRisk.js';

const tools = [
  ['cursor', Crosshair, 'Select'],
  ['trendline', TrendingUp, 'Trend line'],
  ['hline', SlidersHorizontal, 'Horizontal line'],
  ['vline', Ruler, 'Vertical line'],
  ['rectangle', Square, 'Rectangle'],
  ['fibonacci', Shapes, 'Fibonacci'],
  ['text', Type, 'Text'],
];

const secondsByTimeframe = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800 };
const oscillatorIds = new Set(['rsi', 'macd', 'atr', 'stochastic']);

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function validPlanPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatProjectedPnl(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(numeric));
    return `${numeric >= 0 ? '+' : '-'}${amount}`;
  } catch {
    return `${numeric >= 0 ? '+' : '-'}${Math.abs(numeric).toFixed(2)} ${currency || ''}`.trim();
  }
}

function OpenPositionEntryOverlay({ symbol, positions = [], coordinateApi, instrument, selectedPositionId = null, onSelectPosition = () => {} }) {
  const [, forceLayout] = useState(0);

  const activePositions = useMemo(
    () => (Array.isArray(positions) ? positions : []).filter(position =>
      String(position?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase()
      && Number.isFinite(Number(position?.entry ?? position?.entryPrice))
    ),
    [positions, symbol],
  );

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  if (!coordinateApi?.priceToY || !activePositions.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[19] overflow-hidden">
      {activePositions.map(position => {
        const entry = Number(position.entry ?? position.entryPrice);
        const y = coordinateApi.priceToY(entry);
        if (!Number.isFinite(y)) return null;
        const side = String(position.side || '').toUpperCase();
        const pnl = Number(position.pnl);
        const currency = position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
        const lots = Number(position.volume ?? position.lots);
        const positive = Number.isFinite(pnl) && pnl >= 0;

        return (
          <div key={position.id || `${side}-${entry}-${lots}`} className="absolute left-0 right-0" style={{ top: y }}>
            <div className="relative border-t border-dashed border-[#53c7ff]/75">
              <button
                type="button"
                onClick={event => { event.stopPropagation(); onSelectPosition(position.id); }}
                className={`pointer-events-auto absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-md border bg-black/92 px-2 py-1 text-[10px] font-semibold shadow-[0_6px_18px_rgba(0,0,0,.34)] backdrop-blur-sm ${String(selectedPositionId) === String(position.id) ? 'border-[#59C7FF]/70 ring-1 ring-[#59C7FF]/20' : 'border-white/[0.10]'}`}
                aria-label={`Select ${side} ${position.symbol || symbol} position`}
              >
                <span className={`font-bold ${side === 'BUY' ? 'text-[#3bd9a3]' : 'text-[#ff6c78]'}`}>{side}</span>
                <span className="text-[#A3ADB7]">·</span>
                <span className="text-[#DCE3E9]">{Number.isFinite(lots) ? lots.toFixed(2) : '—'} lot</span>
                <span className="hidden text-[#747F89] xl:inline">Entry</span>
                <span className="font-mono tabular-nums text-[#F2F5F7]">{formatInstrumentPrice(entry, instrument)}</span>
              </button>
              <span className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md border bg-black/94 px-2 py-1 font-mono text-[10px] font-bold tabular-nums shadow-[0_4px_14px_rgba(0,0,0,.30)] ${positive ? 'border-[#245b48] text-[#42dda7]' : 'border-[#642c35] text-[#ff6f7b]'}`}>
                {Number.isFinite(pnl) ? formatProjectedPnl(pnl, currency) : 'OPEN'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TradePlanOverlay({ plan, onChange, coordinateApi, instrument, lots = 0.1, accountCurrency = 'USD' }) {
  const layerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [preview, setPreview] = useState({});
  const [, forceLayout] = useState(0);

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  const metrics = useMemo(() => {
    const entry = validPlanPrice(plan?.entry);
    const sl = validPlanPrice(plan?.sl);
    const tp = validPlanPrice(plan?.tp);
    const pip = Number(instrumentPipSize(instrument));
    if (!Number.isFinite(entry) || !Number.isFinite(pip) || pip <= 0) return { slPips: null, tpPips: null };
    return {
      slPips: Number.isFinite(sl) ? Math.abs(entry - sl) / pip : null,
      tpPips: Number.isFinite(tp) ? Math.abs(tp - entry) / pip : null,
    };
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
    if (Object.prototype.hasOwnProperty.call(preview, field)) return validPlanPrice(preview[field]);
    return validPlanPrice(plan?.[field]);
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
  const displayLots = Number(plan?.manualLots ?? lots);
  const liveEntry = sourcePrice('entry');
  const liveSl = sourcePrice('sl');
  const liveTp = sourcePrice('tp');
  const livePip = instrumentPipSize(instrument);
  const liveSlPips = [liveEntry, liveSl, livePip].every(Number.isFinite) && livePip > 0 ? Math.abs(liveEntry - liveSl) / livePip : null;
  const liveTpPips = [liveEntry, liveTp, livePip].every(Number.isFinite) && livePip > 0 ? Math.abs(liveTp - liveEntry) / livePip : null;
  const liveRisk = Number.isFinite(displayLots) && Number.isFinite(liveEntry) && Number.isFinite(liveSl)
    ? estimateStopRisk({ ...plan, entry: liveEntry, sl: liveSl }, displayLots, instrument, accountCurrency)
    : null;
  const liveReward = Number.isFinite(displayLots) && Number.isFinite(liveEntry) && Number.isFinite(liveTp)
    ? estimateStopRisk({ ...plan, entry: liveEntry, sl: liveTp }, displayLots, instrument, accountCurrency)
    : null;
  const lotLabel = Number.isFinite(displayLots) ? `${displayLots.toFixed(Math.max(2, Number(instrument?.volumeStep) < 0.01 ? 3 : 2))} lot` : '— lot';
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
          <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-1 text-[8px] font-black tracking-[0.03em]" style={{ borderColor: `${color}99`, backgroundColor: 'rgba(8,8,8,0.92)', color }}>{label}</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 font-mono text-[8px] font-extrabold tabular-nums" style={{ backgroundColor: color, color: kind === 'sl' ? '#2b0810' : '#032219' }}>{value}</span>
          {draggable && <button type="button" aria-label={`Drag ${label}`} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setDragging(kind); onChange({ stage: `dragging-${kind}` }); }} onTouchStart={event => { event.preventDefault(); event.stopPropagation(); setDragging(kind); onChange({ stage: `dragging-${kind}` }); }} className="pointer-events-auto absolute right-[54px] top-1/2 size-7 -translate-y-1/2 cursor-ns-resize touch-none rounded-full border-2 bg-[#080808] shadow-[0_0_0_5px_rgba(255,255,255,0.04)]" style={{ borderColor: color }} />}
        </div>
      </div>
    );
  };

  const entryLabel = plan.pending ? `${isBuy ? 'BUY' : 'SELL'} ${String(plan.orderType || '').toUpperCase()}` : (isBuy ? 'BUY' : 'SELL');

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {rewardTop != null && <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: rewardTop, height: rewardHeight, background: 'linear-gradient(90deg, rgba(22,134,95,0.10), rgba(34,167,125,0.20))' }} />}
      {riskTop != null && <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: riskTop, height: riskHeight, background: 'linear-gradient(90deg, rgba(138,43,57,0.10), rgba(255,68,91,0.17))' }} />}
      {line('tp', 'tp', '#35d79d', 'TP', `${lotLabel} · ${Number.isFinite(liveReward) ? formatProjectedPnl(Math.abs(liveReward), accountCurrency) : Number.isFinite(metrics.tpPips) ? '+' + metrics.tpPips.toFixed(1) + 'p' : '—'} · TP ${formatInstrumentPrice(liveTp, instrument)}`, true)}
      {line('entry', 'entry', '#42a5ff', entryLabel, formatInstrumentPrice(sourcePrice('entry'), instrument), Boolean(plan.pending))}
      {plan.pending && plan.orderType === 'stop-limit' && line('limit', 'limitPrice', '#b58cff', 'LIMIT', formatInstrumentPrice(sourcePrice('limitPrice'), instrument), true)}
      {line('sl', 'sl', '#ff5968', 'SL', `${lotLabel} · ${Number.isFinite(liveRisk) ? formatProjectedPnl(-Math.abs(liveRisk), accountCurrency) : Number.isFinite(metrics.slPips) ? '-' + metrics.slPips.toFixed(1) + 'p' : '—'} · SL ${formatInstrumentPrice(liveSl, instrument)}`, true)}
      {dragging && <div className="pointer-events-none absolute right-[86px] top-3 z-40 rounded-lg border border-white/10 bg-[#080808]/95 px-2.5 py-1.5 text-right shadow-xl"><div className="text-[8px] uppercase tracking-[0.12em] text-[#708397]">{dragging === 'sl' ? 'Stop loss' : dragging === 'tp' ? 'Take profit' : dragging === 'limit' ? 'Limit price' : 'Entry price'}</div><strong className={`mt-0.5 block text-[11px] ${dragging === 'sl' ? 'text-[#ff6b78]' : dragging === 'tp' ? 'text-[#53e0ad]' : 'text-[#69bdff]'}`}>{formatInstrumentPrice(sourcePrice(dragging === 'limit' ? 'limitPrice' : dragging), instrument)}</strong></div>}
    </div>
  );
}

function OpenPositionProtectionOverlay({ symbol, positions = [], coordinateApi, instrument, onUpdatePosition = () => {}, selectedPositionId = null, onSelectPosition = () => {} }) {
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
    const projectedPnl = estimatePositionPnlAtPrice(position, price, instrument);
    const pips = positionDistancePips(position, price, instrument);
    const currency = position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
    const previewText = projectedPnl == null
      ? `${displayPrice(price)} · ${pips?.toFixed(1) ?? '—'}p`
      : `${displayPrice(price)} · ${formatProjectedPnl(projectedPnl, currency)} · ${pips?.toFixed(1) ?? '—'}p`;

    return (
      <div key={key} className="pointer-events-none absolute left-0 right-0 z-30" style={{ top: y }}>
        <div className="relative h-px" style={{ backgroundColor: color }}>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[7px] font-black" style={{ borderColor: `${color}88`, backgroundColor: 'rgba(8,8,8,0.92)', color }}>{label}</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[8px] font-bold tabular-nums" style={{ borderColor: `${color}66`, backgroundColor: 'rgba(8,8,8,0.94)', color }}>{previewText}</span>
          <button
            type="button"
            aria-label={`Drag ${label}`}
            onPointerDown={event => { event.preventDefault(); event.stopPropagation(); onSelectPosition(position.id); setDragging({ positionId: position.id, kind }); }}
            onTouchStart={event => { event.preventDefault(); event.stopPropagation(); onSelectPosition(position.id); setDragging({ positionId: position.id, kind }); }}
            className={`pointer-events-auto absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent ${String(selectedPositionId) === String(position.id) ? 'ring-1 ring-inset ring-white/10' : ''}`}
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
  tradePlanLots = 0.1,
  accountCurrency = 'USD',
  onTradePlanChange = () => {},
  onUpdatePosition = () => {},
  selectedPositionId = null,
  onSelectPosition = () => {},
  indicators = [],
  positions = [],
  desktopEnhanced = false,
}) {
  const timeframeSeconds = secondsByTimeframe[chartTimeframe] || 60;
  const [remaining, setRemaining] = useState(() => timeframeSeconds - (Math.floor(Date.now() / 1000) % timeframeSeconds));
  const [coordinateApi, setCoordinateApi] = useState(null);
  const [showDrawings, setShowDrawings] = useState(true);
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

  const heightClass = oscillatorCount ? (oscillatorCount > 1 ? 'h-[500px] md:h-[580px]' : 'h-[430px] md:h-[520px]') : 'h-[360px] md:h-[460px]';
  const areaClass = embedded
    ? `grid h-full min-h-0 ${hideToolbar ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[36px_minmax(0,1fr)]'} gap-1.5`
    : focusMode
      ? 'grid h-full min-h-0 grid-cols-[36px_minmax(0,1fr)] gap-1.5 px-1.5 pb-1.5'
      : `grid ${heightClass} grid-cols-[34px_minmax(0,1fr)] gap-2 px-2 pb-2`;

  const toolbarClass = focusMode || embedded
    ? 'flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto bg-transparent py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : 'flex min-h-0 flex-col items-center gap-0.5 bg-transparent py-1';

  return (
    <div className={areaClass}>
      {!hideToolbar && <aside className={toolbarClass} aria-label="Drawing tools">{tools.map(([id, Icon, label]) => <button key={id} type="button" title={label} onClick={() => !tradePlan && onSelectTool(id)} aria-label={label} disabled={Boolean(tradePlan)} className={`grid ${focusMode ? 'size-[30px]' : 'size-[28px]'} shrink-0 place-items-center rounded-md transition ${selectedTool === id ? 'bg-white/[0.07] text-[#59c8ff]' : 'text-[#77838f] hover:bg-white/[0.055] hover:text-[#eef3f7]'} disabled:cursor-not-allowed disabled:opacity-30`}><Icon size={focusMode ? 17 : 16} strokeWidth={1.75} /></button>)}</aside>}

      <div className={`relative min-h-0 min-w-0 overflow-hidden bg-black`}>
        <TradingChart symbol={symbol} instrument={instrument} timeframe={chartTimeframe} tick={tick} chartMode={chartMode} bidPrice={price} askPrice={ask} positions={positions} indicators={indicators} onCoordinateApi={setCoordinateApi} showBidAskLines={desktopEnhanced} showPositionPriceLines={!desktopEnhanced} />
        {showDrawings && <DrawingLayer symbol={symbol} timeframe={chartTimeframe} tool={selectedTool} onToolChange={onSelectTool} disabled={Boolean(tradePlan)} coordinateApi={coordinateApi} />}
        <TradePlanOverlay plan={tradePlan} onChange={onTradePlanChange} coordinateApi={coordinateApi} instrument={instrument} lots={tradePlanLots} accountCurrency={accountCurrency} />
        {desktopEnhanced && !tradePlan && <OpenPositionEntryOverlay symbol={symbol} positions={positions} coordinateApi={coordinateApi} instrument={instrument} selectedPositionId={selectedPositionId} onSelectPosition={onSelectPosition} />}
        {!tradePlan && <OpenPositionProtectionOverlay symbol={symbol} positions={positions} coordinateApi={coordinateApi} instrument={instrument} onUpdatePosition={onUpdatePosition} selectedPositionId={selectedPositionId} onSelectPosition={onSelectPosition} />}

        {desktopEnhanced && (
          <div className="absolute right-[74px] top-2 z-30 flex items-center gap-1">
            <div className="pointer-events-none mr-1 flex h-7 items-center rounded-md border border-white/[0.06] bg-black/86 px-2.5 text-[9px] font-medium tabular-nums text-[#7E8994] backdrop-blur-sm">
              <span>Spread&nbsp;<b className="font-mono font-semibold text-[#B9C2CA]">{(() => { const pip = instrumentPipSize(instrument); const bid = Number(price); const askValue = Number(ask); return Number.isFinite(pip) && pip > 0 && Number.isFinite(bid) && Number.isFinite(askValue) ? `${(Math.abs(askValue - bid) / pip).toFixed(1)}p` : '—'; })()}</b></span>
            </div>
            <button type="button" onClick={() => coordinateApi?.resetView?.()} className="grid size-7 place-items-center rounded border border-white/[0.06] bg-[#07090B]/92 text-[#6F8191] hover:text-[#E6EDF3]" title="Reset chart view"><RotateCcw size={11}/></button>
            <button type="button" onClick={() => coordinateApi?.fitContent?.()} className="grid size-7 place-items-center rounded border border-white/[0.06] bg-[#07090B]/92 text-[#6F8191] hover:text-[#E6EDF3]" title="Fit chart"><ScanLine size={11}/></button>
            <button type="button" onClick={() => setShowDrawings(value => !value)} className={`grid size-7 place-items-center rounded border bg-[#07090B]/92 ${showDrawings ? 'border-white/[0.06] text-[#6F8191] hover:text-[#E6EDF3]' : 'border-[#315b72] text-[#59C7FF]'}`} title={showDrawings ? 'Hide drawings' : 'Show drawings'}>{showDrawings ? <Eye size={11}/> : <EyeOff size={11}/>}</button>
          </div>
        )}

        {!tradePlan && (!embedded || desktopEnhanced) && <div className="pointer-events-none absolute bottom-1 right-[74px] z-10 rounded border border-white/[0.06] bg-[#07090B]/90 px-2 py-1 font-mono text-[9px] font-semibold tabular-nums text-[#A1AFBC] backdrop-blur-sm">{formatCountdown(remaining)}</div>}
      </div>
    </div>
  );
}
