import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
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
  color: '#53c7ff',
  width: 1.4,
  dash: 'solid',
  fillOpacity: 0.07,
};

const TOOL_DEFAULTS = {
  hline: { color: '#f0c35c' },
  vline: { color: '#f0c35c' },
  fibonacci: { color: '#b78cff' },
  text: { color: '#d8e4ee', width: 1 },
  'long-position': { color: '#35d79d' },
  'short-position': { color: '#ff6673' },
};

function dashArray(style) {
  if (style?.dash === 'dashed') return '6 4';
  if (style?.dash === 'dotted') return '2 3';
  return undefined;
}

function lineStyle(drawing, selected) {
  const style = drawing.style || DEFAULT_STYLE;
  return {
    stroke: selected ? '#ffffff' : style.color,
    strokeWidth: selected ? Math.max(2, Number(style.width) || 1.4) : Number(style.width) || 1.4,
    strokeDasharray: dashArray(style),
    vectorEffect: 'non-scaling-stroke',
  };
}

function Handle({ point, onPointerDown }) {
  if (!point) return null;
  return (
    <circle
      cx={point.x}
      cy={point.y}
      r="5"
      fill="#000000"
      stroke="#7bd4ff"
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
      className="pointer-events-auto cursor-grab"
      onPointerDown={onPointerDown}
    />
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
}) {
  const a = resolvePoint(drawing.a);
  const b = resolvePoint(drawing.b || drawing.a);
  if (!a || !b || drawing.hidden) return null;

  const common = {
    className: drawing.locked ? 'pointer-events-auto cursor-default' : 'pointer-events-auto cursor-move',
    onPointerDown: event => onSelect(event, drawing.id),
    onContextMenu: event => onContextMenu(event, drawing.id),
    onDoubleClick: event => onDoubleClick(event, drawing.id),
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
    return (
      <g>
        <rect x={left} y={rewardTop} width={width} height={Math.max(1, rewardHeight)} fill="rgba(53,215,157,0.13)" stroke="rgba(53,215,157,0.55)" strokeWidth="1" {...common}/>
        <rect x={left} y={riskTop} width={width} height={Math.max(1, riskHeight)} fill="rgba(255,102,115,0.13)" stroke="rgba(255,102,115,0.55)" strokeWidth="1" {...common}/>
        <line x1={left} y1={entryY} x2={boxRight} y2={entryY} stroke="#59c7ff" strokeWidth={selected ? 2 : 1.2} vectorEffect="non-scaling-stroke" {...common}/>
        <line x1={left} y1={stopY} x2={boxRight} y2={stopY} stroke="#ff6673" strokeWidth="1.2" vectorEffect="non-scaling-stroke" {...common}/>
        <line x1={left} y1={targetY} x2={boxRight} y2={targetY} stroke="#35d79d" strokeWidth="1.2" vectorEffect="non-scaling-stroke" {...common}/>
        <rect x={left + 4} y={Math.min(entryY + 5, size.height - 65)} rx="4" width="206" height="58" fill="rgba(6,9,11,0.94)" stroke={ready ? 'rgba(53,215,157,0.28)' : 'rgba(255,102,115,0.32)'} strokeWidth="1" className="pointer-events-none"/>
        <text x={left + 10} y={Math.min(entryY + 18, size.height - 52)} fill="#dce7ef" fontSize="8" fontWeight="700" className="pointer-events-none">{isLong ? 'LONG' : 'SHORT'} · {Number.isFinite(rr) ? `R:R ${rr.toFixed(2)}` : 'R:R —'}</text>
        <text x={left + 10} y={Math.min(entryY + 31, size.height - 39)} fill="#8296a7" fontSize="7" className="pointer-events-none">Risk {Number.isFinite(riskPct) ? `${riskPct.toFixed(2)}%` : '—'} · {money(riskMoney)} · {Number.isFinite(lots) ? `${lots.toFixed(2)} lot` : '— lot'}</text>
        <text x={left + 10} y={Math.min(entryY + 45, size.height - 25)} fill={ready ? '#35d79d' : '#ff7b86'} fontSize="7" fontWeight="700" className="pointer-events-none">{statusText.length > 40 ? `${statusText.slice(0, 39)}…` : statusText}</text>
        <text x={boxRight - 4} y={entryY - 4} textAnchor="end" fill="#59c7ff" fontSize="7" fontWeight="700" className="pointer-events-none">ENTRY {formatInstrumentPrice(drawing.a?.price, instrument)}</text>
        <text x={boxRight - 4} y={stopY - 4} textAnchor="end" fill="#ff6673" fontSize="7" fontWeight="700" className="pointer-events-none">SL {formatInstrumentPrice(drawing.b?.price, instrument)}</text>
        <text x={boxRight - 4} y={targetY - 4} textAnchor="end" fill="#35d79d" fontSize="7" fontWeight="700" className="pointer-events-none">TP {formatInstrumentPrice(drawing.riskTarget?.price, instrument)}</text>
        {selected && !drawing.locked && (
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
    return <line x1="0" y1={a.y} x2={size.width} y2={a.y} {...lineStyle(drawing, selected)} {...common} />;
  }
  if (drawing.type === 'vline') {
    return <line x1={a.x} y1="0" x2={a.x} y2={size.height} {...lineStyle(drawing, selected)} {...common} />;
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
        {selected && !drawing.locked && (
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
                stroke={selected ? '#ffffff' : style.color}
                strokeWidth={level === 0.5 ? Math.max(1.5, Number(style.width) || 1) : Number(style.width) || 1}
                strokeDasharray={level === 0.5 ? undefined : dashArray(style) || '3 3'}
                vectorEffect="non-scaling-stroke"
                {...common}
              />
              <text x={left + 5} y={y - 4} fill="#9caec0" fontSize="8" className="pointer-events-none">
                {Math.round(level * 1000) / 10}%
              </text>
            </g>
          );
        })}
        {selected && !drawing.locked && (
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
          fontSize="10"
          fontWeight="600"
          style={{ paintOrder: 'stroke', stroke: '#000000', strokeWidth: 3 }}
        >
          {drawing.text || 'Text'}
        </text>
        {selected && !drawing.locked && <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />}
      </g>
    );
  }

  return (
    <g>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...lineStyle(drawing, selected)} {...common} />
      {selected && !drawing.locked && (
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
  snapEnabled = false,
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
}) {
  const svgRef = useRef(null);
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

  const undo = () => {
    if (undoDrawings(symbol)) {
      setSelectedId(null);
      setContextMenu(null);
    }
  };

  const redo = () => {
    if (redoDrawings(symbol)) {
      setSelectedId(null);
      setContextMenu(null);
    }
  };


  useEffect(() => {
    if (!interactionEnabled) return undefined;
    const onKey = event => {
      const tag = document.activeElement?.tagName;
      const editingText = ['INPUT', 'TEXTAREA'].includes(tag);
      const command = event.ctrlKey || event.metaKey;

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
        setDraft(null);
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
  }, [interactionEnabled, onToolChange, selectedId, symbol, tool]);

  const selected = useMemo(() => drawings.find(item => item.id === selectedId), [drawings, selectedId]);
  const drawingTool = interactionEnabled && !disabled && ['trendline', 'hline', 'vline', 'rectangle', 'fibonacci', 'text', 'long-position', 'short-position'].includes(tool);
  const resolvePoint = point => coordinateApi?.toScreen?.(point) || null;

  const eventScreenPoint = event => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const snapDataPoint = point => {
    if (!point || !snapEnabled) return point;
    const step = Number(snapStep);
    if (!Number.isFinite(step) || step <= 0) return point;
    return { ...point, price: Math.round(Number(point.price) / step) * step };
  };

  const eventDataPoint = event => {
    const screen = eventScreenPoint(event);
    const point = screen ? coordinateApi?.toData?.(screen) || null : null;
    return snapDataPoint(point);
  };

  const makeDrawing = (type, a, b = a, text = '') => ({
    id: drawingId(type),
    type,
    a,
    b,
    text,
    riskTarget: null,
    riskPercent: ['long-position', 'short-position'].includes(type) ? Number(riskPercent) || 0.5 : null,
    locked: false,
    hidden: false,
    timeframeVisibility: 'all',
    style: { ...DEFAULT_STYLE, ...(TOOL_DEFAULTS[type] || {}) },
  });

  const finishTool = () => {
    if (!keepToolActive) onToolChange('cursor');
  };

  const startCreate = event => {
    if (!drawingTool || !coordinateApi) return;
    const point = eventDataPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (tool === 'text') {
      const created = makeDrawing('text', point, point, 'Text');
      commit(current => [...current, created]);
      setSelectedId(created.id);
      setSettingsOpen(true);
      finishTool();
      return;
    }

    if (tool === 'hline' || tool === 'vline') {
      const created = makeDrawing(tool, point);
      commit(current => [...current, created]);
      setSelectedId(created.id);
      finishTool();
      return;
    }

    setDraft(makeDrawing(tool, point, point));
  };

  const pointerMove = event => {
    if (!coordinateApi) return;
    const screen = eventScreenPoint(event);
    const rawData = screen ? coordinateApi.toData?.(screen) : null;
    const data = snapDataPoint(rawData);
    if (!screen || !data) return;

    if (draft) {
      setDraft(current => {
        if (!current) return current;
        if (current.type === 'long-position' || current.type === 'short-position') {
          const entry = Number(current.a?.price);
          const pointer = Number(data.price);
          const distance = Math.abs(pointer - entry);
          const fallback = Number(snapStep) > 0 ? Number(snapStep) * 10 : Math.max(Math.abs(entry) * 0.001, 0.0001);
          const riskDistance = Number.isFinite(distance) && distance > 0 ? distance : fallback;
          const isLong = current.type === 'long-position';
          const sl = isLong ? entry - riskDistance : entry + riskDistance;
          const tp = isLong ? entry + riskDistance * 2 : entry - riskDistance * 2;
          return { ...current, b: { ...data, price: sl }, riskTarget: { ...data, price: tp } };
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
          if (item.type === 'long-position' || item.type === 'short-position') {
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
          if (item.type === 'long-position' || item.type === 'short-position') {
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
          return snapDataPoint(coordinateApi.toData?.({ x: originalScreen.x + dx, y: originalScreen.y + dy }) || point);
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
    if (draft) {
      const end = eventDataPoint(event) || draft.b;
      let created = { ...draft, b: end };
      if (created.type === 'long-position' || created.type === 'short-position') {
        const entry = Number(created.a?.price);
        const pointerStop = Number(end?.price);
        const distance = Math.abs(pointerStop - entry);
        const pipFallback = Number(snapStep) > 0 ? Number(snapStep) * 10 : Math.max(Math.abs(entry) * 0.001, 0.0001);
        const riskDistance = Number.isFinite(distance) && distance > 0 ? distance : pipFallback;
        const isLong = created.type === 'long-position';
        const sl = isLong ? entry - riskDistance : entry + riskDistance;
        const tp = isLong ? entry + riskDistance * 2 : entry - riskDistance * 2;
        created = {
          ...created,
          b: { ...end, price: sl },
          riskTarget: { ...end, price: tp },
        };
      }
      const a = coordinateApi?.toScreen?.(created.a);
      const b = coordinateApi?.toScreen?.(created.b);
      if (a && b && Math.hypot(b.x - a.x, b.y - a.y) > 8) {
        commit(current => [...current, created]);
        setSelectedId(created.id);
      }
      setDraft(null);
      finishTool();
    }

    if (drag?.before) {
      commitLiveDrawingTransaction(symbol, drag.before);
    }
    setDrag(null);
  };

  const selectDrawing = (event, id) => {
    if (!interactionEnabled || disabled || tool !== 'cursor' || !coordinateApi) return;
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
    if (!interactionEnabled || disabled || !coordinateApi || drawing?.locked || lockAll) return;
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
    if (!drawing || !['long-position', 'short-position'].includes(drawing.type)) return null;
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
    if (!selected || !['long-position', 'short-position'].includes(selected.type)) return;
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

  return (
    <div className="pointer-events-none absolute inset-0 z-[16]">
      <svg
        ref={svgRef}
        className="size-full touch-none"
        onPointerMove={pointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
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
          />
        ))}
        {draft && (
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
          />
        )}
      </svg>

      <div className="pointer-events-auto absolute bottom-9 left-2 z-20 flex h-8 items-center overflow-hidden rounded-md border border-white/[0.08] bg-[#080808]/94 shadow-xl backdrop-blur-sm">
        <button type="button" disabled={!canUndo} onClick={undo} className="grid size-8 place-items-center text-[#8194a7] hover:bg-white/[0.04] hover:text-white disabled:opacity-25" title="Undo (Ctrl/Cmd+Z)"><RotateCcw size={13}/></button>
        <button type="button" disabled={!canRedo} onClick={redo} className="grid size-8 place-items-center border-l border-white/[0.07] text-[#8194a7] hover:bg-white/[0.04] hover:text-white disabled:opacity-25" title="Redo (Ctrl/Cmd+Shift+Z)"><RotateCw size={13}/></button>
      </div>

      {selected && !disabled && (
        <div className="pointer-events-auto absolute right-2 top-11 z-20 flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-[#080808]/96 p-1 shadow-xl backdrop-blur-sm">
          <span className="max-w-[88px] truncate px-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#74899d]">{selected.type}</span>
          {['long-position', 'short-position'].includes(selected.type) && (() => {
            const metrics = riskMetricsFor(selected);
            return <button type="button" disabled={!metrics?.canCreateOrder} onClick={createOrderFromSelectedRisk} className="h-7 rounded-md border border-[#245070] bg-[#0d1a22] px-2.5 text-[8px] font-black text-[#59c8ff] hover:bg-[#102431] disabled:cursor-not-allowed disabled:border-white/[0.07] disabled:bg-[#0a0a0a] disabled:text-[#52616e]" title={metrics?.canCreateOrder ? 'Load this risk setup into the order planner' : (metrics?.message || 'Risk setup cannot create an order')}>Create order</button>;
          })()}
                    <button type="button" onClick={() => patchSelected({ locked: !selected.locked })} className={`grid size-7 place-items-center rounded-md ${selected.locked ? 'bg-[#172229] text-[#59c8ff]' : 'text-[#8194a7] hover:bg-white/[0.04]'}`} title={selected.locked ? 'Unlock drawing' : 'Lock drawing'}>{selected.locked ? <Lock size={13}/> : <LockOpen size={13}/>}</button>
          <button type="button" onClick={duplicateSelected} className="grid size-7 place-items-center rounded-md text-[#8194a7] hover:bg-white/[0.04] hover:text-white" title="Duplicate drawing"><Copy size={13}/></button>
          <button type="button" onClick={() => setSettingsOpen(value => !value)} className={`grid size-7 place-items-center rounded-md ${settingsOpen ? 'bg-white/[0.06] text-[#59c8ff]' : 'text-[#8194a7] hover:bg-white/[0.04]'}`} title="Drawing settings"><Settings2 size={13}/></button>
          <button type="button" onClick={deleteSelected} className="grid size-7 place-items-center rounded-md text-[#ff7480] hover:bg-[#35151d]" title="Delete drawing"><Trash2 size={13}/></button>
          <button type="button" onClick={() => { setSelectedId(null); setSettingsOpen(false); }} className="grid size-7 place-items-center rounded-md text-[#8194a7] hover:bg-white/[0.04]" title="Deselect"><X size={13}/></button>
        </div>
      )}

      {selected && settingsOpen && (
        <div className="pointer-events-auto absolute right-2 top-[82px] z-30 w-[238px] rounded-md border border-white/[0.10] bg-[#0b0d0f]/98 p-3 shadow-[0_18px_50px_rgba(0,0,0,.62)] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <strong className="text-[10px] text-[#e7eef4]">Drawing settings</strong>
            <button type="button" onClick={() => setSettingsOpen(false)} className="grid size-6 place-items-center rounded text-[#71869a] hover:bg-white/[0.04]"><X size={12}/></button>
          </div>

          {['long-position', 'short-position'].includes(selected.type) && (() => {
            const metrics = riskMetricsFor(selected);
            return <>
              <label className="mt-3 block">
                <span className="mb-1 block text-[7px] font-bold uppercase tracking-[0.08em] text-[#64798d]">Risk %</span>
                <input type="number" min="0.01" max="100" step="0.05" value={selected.riskPercent ?? riskPercent} onChange={event => patchSelected({ riskPercent: Math.min(100, Math.max(0.01, Number(event.target.value) || 0.01)) })} className="h-9 w-full rounded-md border border-white/[0.08] bg-[#080808] px-2.5 text-[10px] text-[#dbe5ed] outline-none focus:border-[#53c7ff]" />
              </label>
              <div className={`mt-2 rounded-md border px-2.5 py-2 text-[8px] leading-[1.45] ${metrics?.canCreateOrder ? 'border-[#1f4b3d] bg-[#0d1915] text-[#74d9b5]' : 'border-[#4a2026] bg-[#180d10] text-[#e9858d]'}`}>
                {metrics?.message || 'Risk sizing unavailable'}
                {Number.isFinite(metrics?.sizing?.requiredMargin) && <span className="mt-1 block text-[#72879a]">Margin {new Intl.NumberFormat('en-US', { style: 'currency', currency: accountCurrency || 'USD', maximumFractionDigits: 2 }).format(metrics.sizing.requiredMargin)} · Free {Number.isFinite(metrics?.sizing?.freeMargin) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: accountCurrency || 'USD', maximumFractionDigits: 2 }).format(metrics.sizing.freeMargin) : '—'}</span>}
              </div>
            </>;
          })()}
                    {selected.type === 'text' && (
            <label className="mt-3 block">
              <span className="mb-1 block text-[7px] font-bold uppercase tracking-[0.08em] text-[#64798d]">Text</span>
              <input value={selected.text || ''} onChange={event => patchSelected({ text: event.target.value })} className="h-9 w-full rounded-md border border-white/[0.08] bg-[#080808] px-2.5 text-[10px] text-[#dbe5ed] outline-none focus:border-[#53c7ff]" />
            </label>
          )}

          <div className="mt-3">
            <span className="mb-1.5 block text-[7px] font-bold uppercase tracking-[0.08em] text-[#64798d]">Color</span>
            <div className="flex gap-1.5">
              {['#53c7ff','#f0c35c','#b78cff','#35d79d','#ff5968','#d8e4ee'].map(color => (
                <button key={color} type="button" onClick={() => patchSelected({ style: { color } })} className={`size-6 rounded-full border-2 ${selected.style?.color === color ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} aria-label={`Set color ${color}`} />
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-[7px] font-bold uppercase tracking-[0.08em] text-[#64798d]">Width</span>
              <select value={selected.style?.width || 1.4} onChange={event => patchSelected({ style: { width: Number(event.target.value) } })} className="h-8 w-full rounded-md border border-white/[0.08] bg-[#080808] px-2 text-[9px] text-[#dbe5ed] outline-none">
                <option value="1">1 px</option><option value="1.4">1.4 px</option><option value="2">2 px</option><option value="3">3 px</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[7px] font-bold uppercase tracking-[0.08em] text-[#64798d]">Style</span>
              <select value={selected.style?.dash || 'solid'} onChange={event => patchSelected({ style: { dash: event.target.value } })} className="h-8 w-full rounded-md border border-white/[0.08] bg-[#080808] px-2 text-[9px] text-[#dbe5ed] outline-none">
                <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => patchSelected({ hidden: true })} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-[#080808] text-[8px] font-semibold text-[#8ea0b1] hover:text-white"><EyeOff size={12}/>Hide</button>
            <button type="button" onClick={() => patchSelected({ locked: !selected.locked })} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-[#080808] text-[8px] font-semibold text-[#8ea0b1] hover:text-white">{selected.locked ? <LockOpen size={12}/> : <Lock size={12}/>} {selected.locked ? 'Unlock' : 'Lock'}</button>
          </div>
        </div>
      )}

      {contextMenu && selected && (
        <div className="pointer-events-auto absolute z-40 w-[182px] rounded-md border border-white/[0.10] bg-[#0b0d0f]/98 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.62)]" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button type="button" onClick={() => { setSettingsOpen(true); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white"><Settings2 size={12}/>Properties</button>
          <button type="button" onClick={duplicateSelected} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white"><Copy size={12}/>Duplicate</button>
          <button type="button" onClick={() => { patchSelected({ locked: !selected.locked }); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white">{selected.locked ? <LockOpen size={12}/> : <Lock size={12}/>} {selected.locked ? 'Unlock' : 'Lock'}</button>
          <button type="button" onClick={() => { patchSelected({ hidden: !selected.hidden }); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#a9b7c4] hover:bg-white/[0.04] hover:text-white">{selected.hidden ? <Eye size={12}/> : <EyeOff size={12}/>} {selected.hidden ? 'Show' : 'Hide'}</button>
          <div className="my-1 border-t border-white/[0.07]"/>
          <button type="button" onClick={deleteSelected} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[9px] text-[#ff7380] hover:bg-[#35151d]"><Trash2 size={12}/>Delete</button>
        </div>
      )}

      {drawings.some(item => item.hidden) && (
        <button
          type="button"
          onClick={() => commit(current => current.map(item => ({ ...item, hidden: false })))}
          className="pointer-events-auto absolute bottom-9 left-[78px] z-20 flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#080808]/94 px-2.5 text-[8px] font-semibold text-[#8194a7] shadow-xl hover:text-white"
          title="Show hidden drawings"
        >
          <Eye size={12}/>Show hidden
        </button>
      )}
    </div>
  );
}
