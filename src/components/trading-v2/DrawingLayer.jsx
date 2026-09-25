import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { evaluateRiskToolSetup } from '../../utils/tradingRisk.js';
import { formatInstrumentPrice, instrumentPipSize } from '../../utils/instrumentFormatting.js';
import DrawingProperties from './DrawingProperties.jsx';
import { constrainDrawingPoint, drawingMagnetMode } from '../../utils/chartToolSettings.js';
import {
  clampDrawingRiskPercent,
  drawingToolLabel as catalogDrawingToolLabel,
  isDrawingCreateTool,
  isRiskDrawingTool,
  isTwoPointDrawingTool,
  riskDrawingGeometry,
} from '../../utils/drawingTools.js';
import {
  cloneDrawings,
  commitDrawings,
  commitLiveDrawingTransaction,
  getDrawingSnapshot,
  patchDrawing,
  redoDrawings,
  removeDrawing,
  replaceDrawingsLive,
  subscribeDrawings,
  undoDrawings,
  visibleDrawingOnTimeframe,
} from '../../utils/drawingStore.js';

const DEFAULT_STYLE = {
  color: '#195be1',
  width: 1.5,
  dash: 'solid',
  fillOpacity: 0.07,
};

const TOOL_DEFAULTS = {
  trendline: { color: '#195be1', width: 1.5 },
  ray: { color: '#195be1', width: 1.5 },
  'extended-line': { color: '#195be1', width: 1.5 },
  hline: { color: '#f0c35c' },
  'horizontal-ray': { color: '#f0c35c' },
  vline: { color: '#f0c35c' },
  ruler: { color: '#195be1', width: 1.5, dash: 'dashed' },
  fibonacci: { color: '#b78cff' },
  text: { color: '#d8e4ee', width: 1, fontSize: 12 },
  'long-position': { color: '#35d79d' },
  'short-position': { color: '#ff6673' },
};

function drawingLabel(drawing) {
  if (!drawing) return 'Drawing';
  if (drawing.type === 'text') return drawing.text?.trim() || 'Text';
  return catalogDrawingToolLabel(drawing.type);
}

function dashArray(style) {
  if (style?.dash === 'dashed') return '6 4';
  if (style?.dash === 'dotted') return '2 3';
  return undefined;
}

function lineStyle(drawing, selected) {
  const style = drawing.style || DEFAULT_STYLE;
  return {
    stroke: style.color,
    strokeWidth: selected ? Math.max(2, (Number(style.width) || 1.5) + 0.35) : Number(style.width) || 1.5,
    strokeDasharray: dashArray(style),
    vectorEffect: 'non-scaling-stroke',
  };
}

function extendedSegment(a, b, size, mode = 'both') {
  const dx = Number(b?.x) - Number(a?.x);
  const dy = Number(b?.y) - Number(a?.y);
  const width = Math.max(1, Number(size?.width) || 1);
  const height = Math.max(1, Number(size?.height) || 1);
  if (![dx, dy, a?.x, a?.y].every(Number.isFinite) || Math.hypot(dx, dy) < 0.001) return { start: a, end: b };

  const candidates = [];
  const push = t => {
    if (!Number.isFinite(t)) return;
    const x = Number(a.x) + dx * t;
    const y = Number(a.y) + dy * t;
    if (x >= -0.5 && x <= width + 0.5 && y >= -0.5 && y <= height + 0.5) candidates.push({ t, x, y });
  };

  if (Math.abs(dx) > 1e-9) {
    push((0 - Number(a.x)) / dx);
    push((width - Number(a.x)) / dx);
  }
  if (Math.abs(dy) > 1e-9) {
    push((0 - Number(a.y)) / dy);
    push((height - Number(a.y)) / dy);
  }

  if (!candidates.length) return { start: a, end: b };
  candidates.sort((left, right) => left.t - right.t);

  if (mode === 'ray') {
    const forward = candidates.filter(point => point.t >= 0);
    return { start: a, end: forward[forward.length - 1] || b };
  }
  return { start: candidates[0], end: candidates[candidates.length - 1] };
}

function rulerLabel(drawing, instrument, timeframe, barsBetween = null) {
  const startPrice = Number(drawing?.a?.price);
  const endPrice = Number(drawing?.b?.price);
  const startTime = Number(drawing?.a?.time);
  const endTime = Number(drawing?.b?.time);
  if (![startPrice, endPrice, startTime, endTime].every(Number.isFinite)) return 'Measure';

  const delta = endPrice - startPrice;
  const pipSize = Number(instrumentPipSize(instrument));
  const pips = Number.isFinite(pipSize) && pipSize > 0 ? delta / pipSize : null;
  const percent = startPrice !== 0 ? (delta / startPrice) * 100 : null;
  const seconds = { S1:1,S5:5,S15:15,S30:30,M1:60,M5:300,M15:900,M30:1800,H1:3600,H4:14400,D1:86400,W1:604800 }[String(timeframe || '').toUpperCase()] || 60;
  const chartBars = typeof barsBetween === 'function' ? Number(barsBetween(startTime, endTime)) : Number.NaN;
  const bars = Number.isFinite(chartBars) ? chartBars : Math.abs(endTime - startTime) / seconds;
  const signed = value => value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  const parts = [];
  if (Number.isFinite(pips)) parts.push(`${signed(pips)} pips`);
  else parts.push(`${delta > 0 ? '+' : ''}${formatInstrumentPrice(delta, instrument)}`);
  if (Number.isFinite(percent)) parts.push(`${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`);
  parts.push(`${bars.toFixed(bars < 10 ? 1 : 0)} bars`);
  return parts.join(' · ');
}

function Handle({ point, onPointerDown }) {
  if (!point) return null;
  return (
    <g>
      <circle
        cx={point.x}
        cy={point.y}
        r="14"
        fill="transparent"
        className="pointer-events-auto cursor-grab"
        onPointerDown={onPointerDown}
      />
      <circle
        cx={point.x}
        cy={point.y}
        r="5"
        fill="#000000"
        stroke="#195be1"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        className="pointer-events-none"
      />
    </g>
  );
}

function DraftPointMarker({ point, secondary = false }) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return (
    <g className="pointer-events-none" aria-hidden="true">
      <circle
        cx={point.x}
        cy={point.y}
        r={secondary ? 5.5 : 7}
        fill="rgba(9,9,11,0.92)"
        stroke="rgba(25,91,225,0.28)"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={point.x}
        cy={point.y}
        r={secondary ? 3 : 4}
        fill="#09090b"
        stroke="#195be1"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      {!secondary && (
        <circle
          cx={point.x}
          cy={point.y}
          r="1.35"
          fill="#195be1"
          stroke="none"
        />
      )}
    </g>
  );
}

function DrawingShape({
  drawing,
  selected,
  resolvePoint,
  size,
  onSelect,
  onStartHandle,
  onContextMenu,
  onDoubleClick,
  riskMetrics = null,
  instrument = null,
  accountCurrency = 'USD',
  timeframe = 'M1',
  barsBetween = null,
  interactive = true,
  globallyLocked = false,
}) {
  const a = resolvePoint(drawing.a);
  const b = resolvePoint(drawing.b || drawing.a);
  if (!a || !b || drawing.hidden) return null;

  const effectiveLocked = drawing.locked || globallyLocked;
  const common = interactive ? {
    className: effectiveLocked ? 'pointer-events-auto cursor-default' : 'pointer-events-auto cursor-move',
    onPointerDown: event => onSelect(event, drawing.id),
    onContextMenu: event => onContextMenu(event, drawing.id),
    onDoubleClick: event => onDoubleClick(event, drawing.id),
  } : {
    className: 'pointer-events-none',
  };

  if (drawing.type === 'long-position' || drawing.type === 'short-position') {
    const target = resolvePoint(drawing.riskTarget);
    if (!target) return null;
    const isLong = drawing.type === 'long-position';
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const width = Math.max(70, right - left);
    const boxRight = left + width;
    const entryY = a.y;
    const stopY = b.y;
    const targetY = target.y;
    const rewardTop = Math.min(entryY, targetY);
    const rewardHeight = Math.abs(entryY - targetY);
    const riskTop = Math.min(entryY, stopY);
    const riskHeight = Math.abs(entryY - stopY);
    const lots = Number(riskMetrics?.sizing?.requestedLots);
    const riskMoney = Number(riskMetrics?.sizing?.actualRisk);
    const riskPct = Number(riskMetrics?.sizing?.actualRiskPercent);
    const rr = Number(riskMetrics?.riskReward);
    const ready = riskMetrics?.canCreateOrder === true;
    const statusText = riskMetrics?.message || 'Risk sizing unavailable';
    const currency = accountCurrency || 'USD';
    const money = value => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value) : '—';
    const infoWidth = Math.min(206, Math.max(120, size.width - 8));
    const infoX = Math.max(4, Math.min(Math.max(4, size.width - infoWidth - 4), left + 4));
    const infoY = Math.max(4, Math.min(Math.max(4, size.height - 62), entryY + 5));
    return (
      <g>
        <rect x={left} y={rewardTop} width={width} height={Math.max(1, rewardHeight)} fill="rgba(53,215,157,0.13)" stroke="rgba(53,215,157,0.55)" strokeWidth="1" {...common}/>
        <rect x={left} y={riskTop} width={width} height={Math.max(1, riskHeight)} fill="rgba(255,102,115,0.13)" stroke="rgba(255,102,115,0.55)" strokeWidth="1" {...common}/>
        <line x1={left} y1={entryY} x2={boxRight} y2={entryY} stroke="#195be1" strokeWidth={selected ? 2 : 1.2} vectorEffect="non-scaling-stroke" {...common}/>
        <line x1={left} y1={stopY} x2={boxRight} y2={stopY} stroke="#ff6673" strokeWidth="1.2" vectorEffect="non-scaling-stroke" {...common}/>
        <line x1={left} y1={targetY} x2={boxRight} y2={targetY} stroke="#35d79d" strokeWidth="1.2" vectorEffect="non-scaling-stroke" {...common}/>
        <rect x={infoX} y={infoY} rx="4" width={infoWidth} height="58" fill="rgba(6,9,11,0.94)" stroke={ready ? 'rgba(53,215,157,0.28)' : 'rgba(255,102,115,0.32)'} strokeWidth="1" className="pointer-events-none"/>
        <text x={infoX + 6} y={infoY + 13} fill="#dce7ef" fontSize="8" fontWeight="700" className="pointer-events-none">{isLong ? 'LONG' : 'SHORT'} · {Number.isFinite(rr) ? `R:R ${rr.toFixed(2)}` : 'R:R —'}</text>
        <text x={infoX + 6} y={infoY + 27} fill="#8296a7" fontSize="7" className="pointer-events-none">Risk {Number.isFinite(riskPct) ? `${riskPct.toFixed(2)}%` : '—'} · {money(riskMoney)} · {Number.isFinite(lots) ? `${lots.toFixed(2)} lot` : '— lot'}</text>
        <text x={infoX + 6} y={infoY + 42} fill={ready ? '#35d79d' : '#ff7b86'} fontSize="7" fontWeight="700" className="pointer-events-none">{statusText.length > 40 ? `${statusText.slice(0, 39)}…` : statusText}</text>
        <text x={boxRight - 4} y={entryY - 4} textAnchor="end" fill="#195be1" fontSize="7" fontWeight="700" className="pointer-events-none">ENTRY {formatInstrumentPrice(drawing.a?.price, instrument)}</text>
        <text x={boxRight - 4} y={stopY - 4} textAnchor="end" fill="#ff6673" fontSize="7" fontWeight="700" className="pointer-events-none">SL {formatInstrumentPrice(drawing.b?.price, instrument)}</text>
        <text x={boxRight - 4} y={targetY - 4} textAnchor="end" fill="#35d79d" fontSize="7" fontWeight="700" className="pointer-events-none">TP {formatInstrumentPrice(drawing.riskTarget?.price, instrument)}</text>
        {interactive && selected && !effectiveLocked && (
          <>
            <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />
            <Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} />
            <Handle point={target} onPointerDown={event => onStartHandle(event, drawing.id, 'riskTarget')} />
          </>
        )}
      </g>
    );
  }

  if (drawing.type === 'hline') {
    return (
      <g>
        <line x1="0" y1={a.y} x2={size.width} y2={a.y} stroke="transparent" strokeWidth="16" {...common} />
        <line x1="0" y1={a.y} x2={size.width} y2={a.y} {...lineStyle(drawing, selected)} className="pointer-events-none" />
        {interactive && selected && !effectiveLocked && <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />}
      </g>
    );
  }
  if (drawing.type === 'vline') {
    return (
      <g>
        <line x1={a.x} y1="0" x2={a.x} y2={size.height} stroke="transparent" strokeWidth="16" {...common} />
        <line x1={a.x} y1="0" x2={a.x} y2={size.height} {...lineStyle(drawing, selected)} className="pointer-events-none" />
        {interactive && selected && !effectiveLocked && <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />}
      </g>
    );
  }

  if (drawing.type === 'horizontal-ray') {
    return (
      <g>
        <line x1={a.x} y1={a.y} x2={size.width} y2={a.y} stroke="transparent" strokeWidth="16" {...common} />
        <line x1={a.x} y1={a.y} x2={size.width} y2={a.y} {...lineStyle(drawing, selected)} className="pointer-events-none" />
        {interactive && selected && !effectiveLocked && <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />}
      </g>
    );
  }

  if (drawing.type === 'ray' || drawing.type === 'extended-line') {
    const segment = extendedSegment(a, b, size, drawing.type === 'ray' ? 'ray' : 'both');
    return (
      <g>
        <line x1={segment.start.x} y1={segment.start.y} x2={segment.end.x} y2={segment.end.y} stroke="transparent" strokeWidth="16" {...common} />
        <line x1={segment.start.x} y1={segment.start.y} x2={segment.end.x} y2={segment.end.y} {...lineStyle(drawing, selected)} className="pointer-events-none" />
        {interactive && selected && !effectiveLocked && (
          <>
            <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />
            <Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} />
          </>
        )}
      </g>
    );
  }

  if (drawing.type === 'ruler') {
    const label = rulerLabel(drawing, instrument, timeframe, barsBetween);
    const labelWidth = Math.min(Math.max(84, size.width - 12), Math.max(104, Math.min(238, label.length * 5.2 + 16)));
    const midX = Math.max(labelWidth / 2 + 4, Math.min(size.width - labelWidth / 2 - 4, (a.x + b.x) / 2));
    const midY = Math.max(18, Math.min(size.height - 18, (a.y + b.y) / 2 - 14));
    return (
      <g>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="18" {...common} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...lineStyle(drawing, selected)} className="pointer-events-none" />
        <line x1={a.x} y1={a.y - 6} x2={a.x} y2={a.y + 6} {...lineStyle(drawing, selected)} className="pointer-events-none" />
        <line x1={b.x} y1={b.y - 6} x2={b.x} y2={b.y + 6} {...lineStyle(drawing, selected)} className="pointer-events-none" />
        <g className="pointer-events-none">
          <rect x={midX - labelWidth / 2} y={midY - 11} width={labelWidth} height="22" rx="5" fill="rgba(5,8,12,0.94)" stroke="rgba(25,91,225,0.55)" />
          <text x={midX} y={midY + 3} textAnchor="middle" fill="#e8eef7" fontSize="9" fontWeight="700">{label}</text>
        </g>
        {interactive && selected && !effectiveLocked && (
          <>
            <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />
            <Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} />
          </>
        )}
      </g>
    );
  }

  if (drawing.type === 'rectangle') {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(a.x - b.x);
    const height = Math.abs(a.y - b.y);
    const style = drawing.style || DEFAULT_STYLE;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={`${style.color}${Math.round(Math.min(0.35, Math.max(0, style.fillOpacity ?? 0.07)) * 255).toString(16).padStart(2, '0')}`}
          {...lineStyle(drawing, selected)}
          {...common}
        />
        {interactive && selected && !effectiveLocked && (
          <>
            <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />
            <Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} />
          </>
        )}
      </g>
    );
  }

  if (drawing.type === 'fibonacci') {
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const style = drawing.style || DEFAULT_STYLE;
    return (
      <g>
        {levels.map(level => {
          const y = a.y + (b.y - a.y) * level;
          return (
            <g key={level}>
              <line
                x1={left}
                y1={y}
                x2={right}
                y2={y}
                stroke={style.color}
                strokeWidth={selected ? Math.max(1.8, (Number(style.width) || 1) + 0.35) : (level === 0.5 ? Math.max(1.5, Number(style.width) || 1) : Number(style.width) || 1)}
                strokeDasharray={level === 0.5 ? undefined : dashArray(style) || '3 3'}
                vectorEffect="non-scaling-stroke"
                {...common}
              />
              <text x={left + 5} y={y - 4} fill="#b9c7d7" fontSize="11" className="pointer-events-none">
                {Math.round(level * 1000) / 10}% · {formatInstrumentPrice(Number(drawing.a?.price) + (Number(drawing.b?.price) - Number(drawing.a?.price)) * level, instrument)}
              </text>
            </g>
          );
        })}
        {interactive && selected && !effectiveLocked && (
          <>
            <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />
            <Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} />
          </>
        )}
      </g>
    );
  }

  if (drawing.type === 'text') {
    const style = drawing.style || DEFAULT_STYLE;
    return (
      <g {...common}>
        <text
          x={a.x}
          y={a.y}
          fill={selected ? '#ffffff' : style.color}
          fontSize={Number(style.fontSize) || 10}
          fontWeight="600"
          style={{ paintOrder: 'stroke', stroke: '#000000', strokeWidth: 3 }}
        >
          {drawing.text || 'Text'}
        </text>
        {interactive && selected && !effectiveLocked && <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />}
      </g>
    );
  }

  return (
    <g>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="16" {...common} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...lineStyle(drawing, selected)} className="pointer-events-none" />
      {interactive && selected && !effectiveLocked && (
        <>
          <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />
          <Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} />
        </>
      )}
    </g>
  );
}

function drawingId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function DrawingLayer({
  symbol,
  timeframe,
  tool = 'cursor',
  onToolChange = () => {},
  disabled = false,
  coordinateApi = null,
  keepToolActive = false,
  snapMode = 'off',
  snapStep = null,
  lockAll = false,
  onDrawingCountChange = () => {},
  instrument = null,
  account = null,
  riskPercent = 0.5,
  accountCurrency = 'USD',
  onCreateRiskOrder = () => {},
  chartInstanceId = 'chart',
  interactionEnabled = true,
  showHistoryControls = true,
}) {
  const svgRef = useRef(null);
  const creationGestureRef = useRef(null);
  const history = useSyncExternalStore(
    listener => subscribeDrawings(symbol, listener),
    () => getDrawingSnapshot(symbol),
    () => getDrawingSnapshot(symbol),
  );
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [drag, setDrag] = useState(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [, setCoordinateRevision] = useState(0);

  const drawings = history.present;

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setDrag(null);
    setSettingsOpen(false);
    setContextMenu(null);
  }, [symbol, chartInstanceId]);

  useEffect(() => {
    onDrawingCountChange(drawings.length);
  }, [drawings.length, onDrawingCountChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('acg-trader-drawing-selection-change', {
      detail: {
        symbol: String(symbol || '').toUpperCase(),
        chartInstanceId,
        selectedId,
      },
    }));
  }, [chartInstanceId, selectedId, symbol]);

  useEffect(() => {
    const node = svgRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => setCoordinateRevision(value => value + 1));
  }, [coordinateApi]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const normalizedSymbol = String(symbol || '').toUpperCase();

    const handleCommand = event => {
      const detail = event?.detail || {};
      if (String(detail.symbol || '').toUpperCase() !== normalizedSymbol) return;
      if (detail.chartInstanceId && detail.chartInstanceId !== chartInstanceId) return;
      if (!detail.id) return;
      const drawing = getDrawingSnapshot(symbol).present.find(item => item.id === detail.id);
      if (!drawing) return;

      if (detail.action === 'select' || detail.action === 'focus' || detail.action === 'settings') {
        setSelectedId(detail.id);
        setContextMenu(null);
        if (detail.action === 'settings') setSettingsOpen(true);
        if (detail.action === 'focus') coordinateApi?.focusTime?.(drawing.a?.time);
      }
    };

    window.addEventListener('acg-trader-drawing-command', handleCommand);
    return () => window.removeEventListener('acg-trader-drawing-command', handleCommand);
  }, [chartInstanceId, coordinateApi, symbol]);


  const commit = next => commitDrawings(symbol, next);

  const undo = useCallback(() => {
    if (undoDrawings(symbol)) {
      setSelectedId(null);
      setContextMenu(null);
    }
  }, [symbol]);

  const redo = useCallback(() => {
    if (redoDrawings(symbol)) {
      setSelectedId(null);
      setContextMenu(null);
    }
  }, [symbol]);


  useEffect(() => {
    if (!interactionEnabled) return undefined;
    const onKey = event => {
      const activeElement = document.activeElement;
      const tag = activeElement?.tagName;
      const editingText = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || activeElement?.isContentEditable === true;
      const command = event.ctrlKey || event.metaKey;

      if (!editingText && command && event.key.toLowerCase() === 'z' && (drag || draft)) {
        event.preventDefault();
        if (drag?.before) replaceDrawingsLive(symbol, drag.before);
        setDrag(null);
        setDraft(null);
        creationGestureRef.current = null;
        return;
      }
      if (!editingText && command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (!editingText && command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (!editingText && event.key === 'Escape') {
        if (drag?.before) replaceDrawingsLive(symbol, drag.before);
        setDraft(null);
        creationGestureRef.current = null;
        setDrag(null);
        setSelectedId(null);
        setSettingsOpen(false);
        setContextMenu(null);
        if (tool !== 'cursor') onToolChange('cursor');
        return;
      }

      if (!editingText && selectedId && ['Delete', 'Backspace'].includes(event.key)) {
        event.preventDefault();
        removeDrawing(symbol, selectedId);
        setSelectedId(null);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactionEnabled, onToolChange, selectedId, symbol, tool, drag, draft, undo, redo]);

  const selected = useMemo(() => drawings.find(item => item.id === selectedId), [drawings, selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    if (!selected || !visibleDrawingOnTimeframe(selected, timeframe)) {
      setSelectedId(null);
      setSettingsOpen(false);
      setContextMenu(null);
    }
  }, [selected, selectedId, timeframe]);
  const drawingTool = interactionEnabled && !disabled && isDrawingCreateTool(tool);
  const resolvePoint = point => coordinateApi?.toScreen?.(point) || null;

  const eventScreenPoint = event => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const snapDataPoint = (point, screen = null, modifier = false) => {
    const mode = drawingMagnetMode(snapMode, modifier);
    if (!point || mode === 'off') return point;

    if (screen && coordinateApi?.snapToCandle) {
      const candleSnap = coordinateApi.snapToCandle(screen, mode === 'strong' ? Infinity : 12);
      if (candleSnap) return { time: candleSnap.time, price: candleSnap.price };
    }

    const step = Number(snapStep);
    if (!Number.isFinite(step) || step <= 0) return point;
    return { ...point, price: Math.round(Number(point.price) / step) * step };
  };

  const eventDataPoint = event => {
    const anchor = draft?.a || (drag?.mode === 'b' ? drawings.find(item => item.id === drag.id)?.a : null);
    const activeType = draft?.type || drawings.find(item => item.id === drag?.id)?.type;
    const screen = constrainDrawingPoint(resolvePoint(anchor), eventScreenPoint(event), event.shiftKey && ['trendline', 'ray', 'extended-line', 'ruler'].includes(activeType));
    const point = screen ? coordinateApi?.toData?.(screen) || null : null;
    return snapDataPoint(point, screen, event.ctrlKey || event.metaKey);
  };

  const makeDrawing = (type, a, b = a, text = '') => ({
    id: drawingId(type),
    type,
    a,
    b,
    text,
    riskTarget: null,
    riskPercent: isRiskDrawingTool(type) ? clampDrawingRiskPercent(riskPercent) : null,
    locked: false,
    hidden: false,
    timeframeVisibility: 'all',
    style: { ...DEFAULT_STYLE, ...(TOOL_DEFAULTS[type] || {}) },
  });

  const finishTool = () => {
    if (!keepToolActive) onToolChange('cursor');
  };

  const completeDraft = endPoint => {
    if (!draft || !endPoint) return false;
    let created = { ...draft, b: endPoint };

    if (isRiskDrawingTool(created.type)) {
      created = { ...created, ...riskDrawingGeometry(created.type, created.a, endPoint, snapStep) };
    }

    const a = coordinateApi?.toScreen?.(created.a);
    const b = coordinateApi?.toScreen?.(created.b);
    if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) <= 5) return false;

    commit(current => [...current, created]);
    setSelectedId(created.id);
    setDraft(null);
    creationGestureRef.current = null;
    finishTool();
    return true;
  };

  const startCreate = event => {
    if (!drawingTool || !coordinateApi || event.button !== 0) return;
    const point = eventDataPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);

    if (draft) {
      completeDraft(point);
      return;
    }

    if (tool === 'text') {
      const created = makeDrawing('text', point, point, 'Text');
      commit(current => [...current, created]);
      setSelectedId(created.id);
      setSettingsOpen(true);
      finishTool();
      return;
    }

    if (!isTwoPointDrawingTool(tool)) {
      const created = makeDrawing(tool, point);
      commit(current => [...current, created]);
      setSelectedId(created.id);
      finishTool();
      return;
    }

    const startScreen = eventScreenPoint(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    creationGestureRef.current = { pointerId: event.pointerId, startScreen };
    setDraft(makeDrawing(tool, point, point));
  };

  const pointerMove = event => {
    if (!coordinateApi) return;
    const screen = eventScreenPoint(event);
    const data = eventDataPoint(event);
    if (!screen || !data) return;

    if (draft) {
      setDraft(current => {
        if (!current) return current;
        if (isRiskDrawingTool(current.type)) {
          return { ...current, ...riskDrawingGeometry(current.type, current.a, data, snapStep) };
        }
        return { ...current, b: data };
      });
      return;
    }

    if (!drag) return;
    event.preventDefault();

    replaceDrawingsLive(symbol, drawings.map(item => {
        if (item.id !== drag.id || item.locked || lockAll) return item;
        if (drag.mode === 'a' || drag.mode === 'b') {
          if (isRiskDrawingTool(item.type)) {
            const next = { ...item, [drag.mode]: data };
            const isLong = item.type === 'long-position';
            if (drag.mode === 'a') {
              const delta = Number(data.price) - Number(item.a.price);
              next.b = { ...item.b, price: Number(item.b.price) + delta };
              if (item.riskTarget) next.riskTarget = { ...item.riskTarget, price: Number(item.riskTarget.price) + delta };
            } else {
              const entry = Number(item.a.price);
              const distance = Math.max(Number(snapStep) || 0.00000001, Math.abs(Number(data.price) - entry));
              next.b = { ...data, price: isLong ? entry - distance : entry + distance };
            }
            return next;
          }
          return { ...item, [drag.mode]: data };
        }
        if (drag.mode === 'riskTarget') {
          if (isRiskDrawingTool(item.type)) {
            const entry = Number(item.a.price);
            const distance = Math.max(Number(snapStep) || 0.00000001, Math.abs(Number(data.price) - entry));
            return { ...item, riskTarget: { ...data, price: item.type === 'long-position' ? entry + distance : entry - distance } };
          }
          return { ...item, riskTarget: data };
        }

        const dx = screen.x - drag.startScreen.x;
        const dy = screen.y - drag.startScreen.y;
        const movePoint = point => {
          const originalScreen = coordinateApi.toScreen?.(point);
          if (!originalScreen) return point;
          const targetScreen = { x: originalScreen.x + dx, y: originalScreen.y + dy };
          // Moving an object preserves its shape; magnet applies to individual anchors.
          return coordinateApi.toData?.(targetScreen) || point;
        };
        return {
          ...item,
          a: movePoint(drag.original.a),
          b: movePoint(drag.original.b || drag.original.a),
          riskTarget: drag.original.riskTarget ? movePoint(drag.original.riskTarget) : item.riskTarget,
        };
      }));
  };

  const finishPointer = event => {
    if (draft && creationGestureRef.current?.pointerId === event.pointerId) {
      const endScreen = eventScreenPoint(event);
      const startScreen = creationGestureRef.current.startScreen;
      const moved = startScreen && endScreen ? Math.hypot(endScreen.x - startScreen.x, endScreen.y - startScreen.y) : 0;
      if (moved > 5) completeDraft(eventDataPoint(event) || draft.b);
      else creationGestureRef.current = null;
    }
    if (drag?.before) commitLiveDrawingTransaction(symbol, drag.before);
    setDrag(null);
  };

  const cancelPointer = event => {
    if (draft && creationGestureRef.current?.pointerId === event.pointerId) {
      setDraft(null);
      creationGestureRef.current = null;
    }
    if (drag?.before) replaceDrawingsLive(symbol, drag.before);
    setDrag(null);
  };

  const selectDrawing = (event, id) => {
    if (!interactionEnabled || disabled || tool !== 'cursor' || !coordinateApi || event.button !== 0) return;
    const screen = eventScreenPoint(event);
    const drawing = drawings.find(item => item.id === id);
    if (!screen || !drawing) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    setSelectedId(id);

    if (drawing.locked || lockAll) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      id,
      mode: 'move',
      startScreen: screen,
      original: { a: { ...drawing.a }, b: { ...(drawing.b || drawing.a) }, riskTarget: drawing.riskTarget ? { ...drawing.riskTarget } : null },
      before: cloneDrawings(drawings),
    });
  };

  const startHandle = (event, id, mode) => {
    const drawing = drawings.find(item => item.id === id);
    if (!interactionEnabled || disabled || !coordinateApi || drawing?.locked || lockAll || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedId(id);
    setDrag({ id, mode, before: cloneDrawings(drawings) });
  };

  const patchSelected = patch => {
    if (!selectedId) return;
    patchDrawing(symbol, selectedId, patch);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    commit(current => current.filter(item => item.id !== selectedId));
    setSelectedId(null);
    setSettingsOpen(false);
    setContextMenu(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const duplicate = {
      ...selected,
      id: drawingId(selected.type),
      a: { ...selected.a },
      b: selected.b ? { ...selected.b } : selected.b,
      style: { ...selected.style },
      riskTarget: selected.riskTarget ? { ...selected.riskTarget } : null,
      locked: false,
    };
    commit(current => [...current, duplicate]);
    setSelectedId(duplicate.id);
    setContextMenu(null);
  };

  const openContext = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(id);
    const rect = svgRef.current?.getBoundingClientRect();
    setContextMenu({
      x: Math.max(8, Math.min(size.width - 190, event.clientX - (rect?.left || 0))),
      y: Math.max(8, Math.min(size.height - 210, event.clientY - (rect?.top || 0))),
    });
  };

  const openSettings = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(id);
    setSettingsOpen(true);
    setContextMenu(null);
  };

  const riskMetricsFor = drawing => {
    if (!drawing || !isRiskDrawingTool(drawing.type)) return null;
    const entry = Number(drawing.a?.price);
    const sl = Number(drawing.b?.price);
    const tp = Number(drawing.riskTarget?.price);
    const side = drawing.type === 'long-position' ? 'buy' : 'sell';
    const riskDistance = Math.abs(entry - sl);
    const rewardDistance = Math.abs(tp - entry);
    const evaluation = evaluateRiskToolSetup({
      plan: { entry, sl, tp, side },
      riskPercent: drawing.riskPercent ?? riskPercent,
      account: account || {},
      instrument: instrument || {},
    });
    return {
      ...evaluation,
      riskReward: riskDistance > 0 && Number.isFinite(rewardDistance) ? rewardDistance / riskDistance : null,
      plan: { entry, sl, tp, side },
    };
  };

  const createOrderFromSelectedRisk = () => {
    if (!selected || !isRiskDrawingTool(selected.type)) return;
    const metrics = riskMetricsFor(selected);
    if (!metrics?.canCreateOrder) return;
    onCreateRiskOrder({
      symbol,
      side: selected.type === 'long-position' ? 'buy' : 'sell',
      entry: Number(selected.a?.price),
      sl: Number(selected.b?.price),
      tp: Number(selected.riskTarget?.price),
      riskPercent: Number(selected.riskPercent ?? riskPercent),
      lots: Number(metrics?.sizing?.requestedLots),
      sizing: metrics?.sizing,
      sourceDrawingId: selected.id,
    });
  };

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const visibleDrawings = drawings.filter(item => visibleDrawingOnTimeframe(item, timeframe));
  const draftStartScreen = draft ? resolvePoint(draft.a) : null;
  const draftEndScreen = draft ? resolvePoint(draft.b || draft.a) : null;
  const draftHasVisibleExtent = draftStartScreen && draftEndScreen
    ? Math.hypot(draftEndScreen.x - draftStartScreen.x, draftEndScreen.y - draftStartScreen.y) > 2
    : false;
  const compactDrawingUi = size.width < 560;

  const selectedAnchor = (() => {
    if (!selected || !coordinateApi?.toScreen) return null;
    const points = [selected.a, selected.b, selected.riskTarget]
      .filter(Boolean)
      .map(point => coordinateApi.toScreen(point))
      .filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
    if (!points.length) return null;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: Math.min(...points.map(point => point.y)),
    };
  })();

  const selectedToolbarStyle = compactDrawingUi
    ? { left: 8, right: 8, bottom: 46 }
    : {
        left: Math.max(8, Math.min(size.width - 360, (selectedAnchor?.x ?? size.width / 2) - 165)),
        top: Math.max(8, Math.min(size.height - 46, (selectedAnchor?.y ?? 54) - 42)),
      };

  const settingsPanelStyle = compactDrawingUi
    ? { left: 8, right: 8, bottom: 90, width: 'auto', maxHeight: '56%', overflowY: 'auto' }
    : {
        right: 12,
        top: 12,
        width: Math.min(360, size.width - 24),
        maxHeight: Math.max(160, size.height - 24),
        overflowY: 'auto',
      };

  const cycleSelectedWidth = () => {
    if (!selected) return;
    const widths = [1, 1.4, 2, 3];
    const current = Number(selected.style?.width) || 1.4;
    const index = Math.max(0, widths.findIndex(value => Math.abs(value - current) < 0.01));
    patchSelected({ style: { width: widths[(index + 1) % widths.length] } });
  };

  const cycleSelectedDash = () => {
    if (!selected) return;
    const styles = ['solid', 'dashed', 'dotted'];
    const index = Math.max(0, styles.indexOf(selected.style?.dash || 'solid'));
    patchSelected({ style: { dash: styles[(index + 1) % styles.length] } });
  };

  const moveSelectedLayer = direction => {
    if (!selectedId) return;
    commit(current => {
      const index = current.findIndex(item => item.id === selectedId);
      if (index < 0) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (direction === 'front') next.push(item);
      else next.unshift(item);
      return next;
    });
    setContextMenu(null);
  };

  return (
    <div className="pointer-events-none absolute left-0 top-0" style={{ width: coordinateApi?.plotSize?.().width || '100%', height: coordinateApi?.plotSize?.().height || '100%', zIndex: settingsOpen ? 60 : selected ? 40 : 16 }}>
      <svg
        ref={svgRef}
        className="size-full touch-none"
        onPointerMove={pointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={cancelPointer}
        onPointerDown={() => setContextMenu(null)}
      >
        <rect
          width="100%"
          height="100%"
          fill="transparent"
          className={drawingTool && coordinateApi ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}
          onPointerDown={startCreate}
        />
        {visibleDrawings.map(drawing => (
          <DrawingShape
            key={drawing.id}
            drawing={drawing}
            selected={drawing.id === selectedId}
            resolvePoint={resolvePoint}
            size={size}
            onSelect={selectDrawing}
            onStartHandle={startHandle}
            onContextMenu={openContext}
            onDoubleClick={openSettings}
            riskMetrics={riskMetricsFor(drawing)}
            instrument={instrument}
            accountCurrency={accountCurrency}
            timeframe={timeframe}
            barsBetween={coordinateApi?.barsBetween}
            globallyLocked={lockAll}
          />
        ))}
        {draft && (
          <>
            <DrawingShape
              drawing={draft}
              selected
              resolvePoint={resolvePoint}
              size={size}
              onSelect={() => {}}
              onStartHandle={() => {}}
              onContextMenu={() => {}}
              onDoubleClick={() => {}}
              riskMetrics={riskMetricsFor(draft)}
              instrument={instrument}
              accountCurrency={accountCurrency}
              timeframe={timeframe}
              barsBetween={coordinateApi?.barsBetween}
              interactive={false}
            />
            <DraftPointMarker point={draftStartScreen} />
            {draftHasVisibleExtent && <DraftPointMarker point={draftEndScreen} secondary />}
          </>
        )}
      </svg>

      {showHistoryControls && (
        <div className="acg-mobile-history-controls pointer-events-auto absolute bottom-9 left-2 z-20 flex h-8 items-center overflow-hidden rounded-md border border-white/[0.08] bg-[#080808]/94 shadow-xl backdrop-blur-sm lg:bottom-8 lg:left-auto lg:right-[124px]">
          <button type="button" disabled={!canUndo} onClick={undo} className="grid size-8 place-items-center text-[#8194a7] hover:bg-white/[0.04] hover:text-white disabled:opacity-25" title="Undo (Ctrl/Cmd+Z)"><RotateCcw size={13}/></button>
          <button type="button" disabled={!canRedo} onClick={redo} className="grid size-8 place-items-center border-l border-white/[0.07] text-[#8194a7] hover:bg-white/[0.04] hover:text-white disabled:opacity-25" title="Redo (Ctrl/Cmd+Shift+Z)"><RotateCw size={13}/></button>
        </div>
      )}

      {selected && !disabled && !settingsOpen && (
        <div
          className="acg-chart-tools acg-drawing-toolbar pointer-events-auto absolute z-30 flex min-h-9 max-w-[calc(100%-16px)] items-center gap-0.5 overflow-hidden rounded-[7px] border border-white/[0.08] bg-[#07090b]/97 p-1 shadow-[0_12px_34px_rgba(0,0,0,.52)] backdrop-blur-md"
          style={selectedToolbarStyle}
        >
          <span className="hidden max-w-[96px] truncate border-r border-white/[0.07] px-2 text-[8px] font-bold uppercase tracking-[0.08em] text-[#7e91a3] sm:block">{drawingLabel(selected)}</span>
          {!isRiskDrawingTool(selected.type) && (
            <label className="relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-white/[0.05]" title="Drawing color">
              <span className="size-3.5 rounded-full border border-white/20" style={{ backgroundColor: selected.style?.color || DEFAULT_STYLE.color }} />
              <input type="color" value={selected.style?.color || DEFAULT_STYLE.color} onChange={event => patchSelected({ style: { color: event.target.value } })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Drawing color" />
            </label>
          )}
          {selected.type !== 'text' && !isRiskDrawingTool(selected.type) && (
            <>
              <button type="button" onClick={cycleSelectedWidth} className="h-7 min-w-7 rounded-md px-1.5 font-mono text-[8px] font-bold text-[#8fa0ae] hover:bg-white/[0.05] hover:text-white" title="Cycle line width">{Number(selected.style?.width || 1.4).toFixed(Number(selected.style?.width || 1.4) % 1 ? 1 : 0)}</button>
              <button type="button" onClick={cycleSelectedDash} className="grid size-7 place-items-center rounded-md text-[#8194a7] hover:bg-white/[0.05] hover:text-white" title={`Line style: ${selected.style?.dash || 'solid'}`}><MoreHorizontal size={14}/></button>
            </>
          )}
          {isRiskDrawingTool(selected.type) && (() => {
            const metrics = riskMetricsFor(selected);
            return <button type="button" disabled={!metrics?.canCreateOrder} onClick={createOrderFromSelectedRisk} className="h-7 shrink-0 rounded-md border border-[#195be1] bg-[#0d1a22] px-2 text-[8px] font-black text-[#195be1] hover:bg-[#102431] disabled:cursor-not-allowed disabled:border-white/[0.07] disabled:bg-[#0a0a0a] disabled:text-[#52616e]" title={metrics?.canCreateOrder ? 'Load this risk setup into the order planner' : (metrics?.message || 'Risk setup cannot create an order')}>Create order</button>;
          })()}
          <button type="button" onClick={() => patchSelected({ hidden: true })} className="grid size-7 shrink-0 place-items-center rounded-md text-[#8194a7] hover:bg-white/[0.05] hover:text-white" title="Hide drawing"><EyeOff size={13}/></button>
          <button type="button" disabled={lockAll} onClick={() => patchSelected({ locked: !selected.locked })} className={`grid size-7 shrink-0 place-items-center rounded-md ${selected.locked || lockAll ? 'bg-[#10202a] text-[#195be1]' : 'text-[#8194a7] hover:bg-white/[0.05]'} disabled:cursor-not-allowed disabled:opacity-50`} title={lockAll ? 'All drawings are locked' : selected.locked ? 'Unlock drawing' : 'Lock drawing'}>{selected.locked || lockAll ? <Lock size={13}/> : <LockOpen size={13}/>}</button>
          <button type="button" onClick={duplicateSelected} className="grid size-7 shrink-0 place-items-center rounded-md text-[#8194a7] hover:bg-white/[0.05] hover:text-white" title="Duplicate drawing"><Copy size={13}/></button>
          <button type="button" onClick={() => setSettingsOpen(value => !value)} className={`grid size-7 shrink-0 place-items-center rounded-md ${settingsOpen ? 'bg-[#10202a] text-[#195be1]' : 'text-[#8194a7] hover:bg-white/[0.05]'}`} title="Drawing properties"><Settings2 size={13}/></button>
          <button type="button" onClick={deleteSelected} className="grid size-7 shrink-0 place-items-center rounded-md text-[#d76d77] hover:bg-[#35151d] hover:text-[#ff7b86]" title="Delete drawing"><Trash2 size={13}/></button>
          <button type="button" onClick={() => { setSelectedId(null); setSettingsOpen(false); }} className="grid size-7 shrink-0 place-items-center rounded-md text-[#8194a7] hover:bg-white/[0.05] hover:text-white" title="Deselect"><X size={13}/></button>
        </div>
      )}

      {selected && settingsOpen && (
        <div className="acg-drawing-properties pointer-events-auto absolute z-40" style={settingsPanelStyle}>
          <DrawingProperties key={selected.id} drawing={selected} riskPercent={riskPercent} lockAll={lockAll} onApply={patchSelected} onClose={() => setSettingsOpen(false)} />
        </div>
      )}

      {contextMenu && selected && (
        <div className="acg-drawing-menu pointer-events-auto absolute z-40 w-[210px] rounded-md border border-white/[0.10] bg-[#0b0d0f]/98 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.62)]" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button type="button" onClick={() => { setSettingsOpen(true); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white"><Settings2 size={12}/>Properties</button>
          <button type="button" onClick={duplicateSelected} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white"><Copy size={12}/>Duplicate</button>
          <button type="button" onClick={() => { patchSelected({ locked: !selected.locked }); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white">{selected.locked ? <LockOpen size={12}/> : <Lock size={12}/>} {selected.locked ? 'Unlock' : 'Lock'}</button>
          <button type="button" onClick={() => { patchSelected({ hidden: !selected.hidden }); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white">{selected.hidden ? <Eye size={12}/> : <EyeOff size={12}/>} {selected.hidden ? 'Show' : 'Hide'}</button>
          <div className="my-1 border-t border-white/[0.07]"/>
          <button type="button" onClick={() => moveSelectedLayer('front')} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white"><span className="w-3 text-center">↑</span>Bring to front</button>
          <button type="button" onClick={() => moveSelectedLayer('back')} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white"><span className="w-3 text-center">↓</span>Send to back</button>
          <div className="my-1 border-t border-white/[0.07]"/>
          <button type="button" onClick={deleteSelected} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#ff7380] hover:bg-[#35151d]"><Trash2 size={12}/>Delete</button>
        </div>
      )}

      {drawingTool && !settingsOpen && <div className="acg-drawing-hint" role="status">{catalogDrawingToolLabel(tool)} · {draft ? 'Place the second point' : 'Click or drag to draw'} · Esc to cancel{!compactDrawingUi && ' · Shift: constrain · Ctrl/⌘: magnet'}</div>}

      {drawings.some(item => item.hidden) && (
        <button
          type="button"
          onClick={() => commit(current => current.map(item => ({ ...item, hidden: false })))}
          className="pointer-events-auto absolute bottom-9 left-[78px] z-20 flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#080808]/94 px-2.5 text-[8px] font-semibold text-[#8194a7] shadow-xl hover:text-white lg:bottom-8 lg:left-auto lg:right-[196px]"
          title="Show hidden drawings"
        >
          <Eye size={12}/>Show hidden
        </button>
      )}
    </div>
  );
}
