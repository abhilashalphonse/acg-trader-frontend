import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const STORAGE_PREFIX = 'acg-trader-drawings-v3';
const LEGACY_STORAGE_PREFIX = 'acg-trader-drawings-v2';
const storageKey = symbol => `${STORAGE_PREFIX}:${String(symbol || '').toUpperCase()}`;
const legacyStorageKey = (symbol, timeframe) => `${LEGACY_STORAGE_PREFIX}:${symbol}:${timeframe}`;

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
};

function normalizeDrawing(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.type || !raw.a) return null;
  return {
    ...raw,
    b: raw.b || raw.a,
    text: raw.text || '',
    locked: raw.locked === true,
    hidden: raw.hidden === true,
    timeframeVisibility: raw.timeframeVisibility || 'all',
    style: {
      ...DEFAULT_STYLE,
      ...(TOOL_DEFAULTS[raw.type] || {}),
      ...(raw.style || {}),
    },
  };
}

function loadDrawings(symbol, timeframe) {
  if (typeof window === 'undefined') return [];
  try {
    const current = JSON.parse(window.localStorage.getItem(storageKey(symbol)) || 'null');
    if (Array.isArray(current)) return current.map(normalizeDrawing).filter(Boolean);

    const legacy = JSON.parse(window.localStorage.getItem(legacyStorageKey(symbol, timeframe)) || '[]');
    if (Array.isArray(legacy) && legacy.length) {
      const migrated = legacy.map(normalizeDrawing).filter(Boolean);
      window.localStorage.setItem(storageKey(symbol), JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // Fall through to an empty workspace.
  }
  return [];
}

function visibleOnTimeframe(drawing, timeframe) {
  if (drawing.hidden) return false;
  if (drawing.timeframeVisibility === 'all' || !drawing.timeframeVisibility) return true;
  if (Array.isArray(drawing.timeframeVisibility)) return drawing.timeframeVisibility.includes(timeframe);
  return true;
}

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

function cloneDrawings(items) {
  return items.map(item => ({
    ...item,
    a: { ...item.a },
    b: item.b ? { ...item.b } : item.b,
    style: { ...(item.style || {}) },
    timeframeVisibility: Array.isArray(item.timeframeVisibility) ? [...item.timeframeVisibility] : item.timeframeVisibility,
  }));
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
}) {
  const svgRef = useRef(null);
  const [history, setHistory] = useState(() => ({ past: [], present: loadDrawings(symbol, timeframe), future: [] }));
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [drag, setDrag] = useState(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [, setCoordinateRevision] = useState(0);

  const drawings = history.present;

  useEffect(() => {
    setHistory({ past: [], present: loadDrawings(symbol, timeframe), future: [] });
    setSelectedId(null);
    setDraft(null);
    setDrag(null);
    setSettingsOpen(false);
    setContextMenu(null);
  }, [symbol]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(storageKey(symbol), JSON.stringify(drawings)); } catch { /* Keep current session state. */ }
    onDrawingCountChange(drawings.length);
    window.dispatchEvent(new CustomEvent('acg-trader-drawings-change', {
      detail: {
        symbol: String(symbol || '').toUpperCase(),
        drawings: cloneDrawings(drawings),
        selectedId,
      },
    }));
  }, [drawings, onDrawingCountChange, selectedId, symbol]);

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

    const publish = () => {
      window.dispatchEvent(new CustomEvent('acg-trader-drawings-change', {
        detail: {
          symbol: normalizedSymbol,
          drawings: cloneDrawings(history.present),
          selectedId,
        },
      }));
    };

    const handleRequest = event => {
      const requestedSymbol = String(event?.detail?.symbol || '').toUpperCase();
      if (requestedSymbol && requestedSymbol !== normalizedSymbol) return;
      publish();
    };

    const handleCommand = event => {
      const detail = event?.detail || {};
      const requestedSymbol = String(detail.symbol || '').toUpperCase();
      if (requestedSymbol !== normalizedSymbol || !detail.id) return;
      const drawing = history.present.find(item => item.id === detail.id);
      if (!drawing) return;

      if (detail.action === 'select' || detail.action === 'focus' || detail.action === 'settings') {
        setSelectedId(detail.id);
        setContextMenu(null);
        if (detail.action === 'settings') setSettingsOpen(true);
        if (detail.action === 'focus') coordinateApi?.focusTime?.(drawing.a?.time);
        return;
      }

      if (detail.action === 'toggle-lock') {
        commit(current => current.map(item => item.id === detail.id ? { ...item, locked: !item.locked } : item));
        return;
      }

      if (detail.action === 'toggle-visibility') {
        commit(current => current.map(item => item.id === detail.id ? { ...item, hidden: !item.hidden } : item));
        return;
      }

      if (detail.action === 'delete') {
        commit(current => current.filter(item => item.id !== detail.id));
        if (selectedId === detail.id) setSelectedId(null);
        setSettingsOpen(false);
      }
    };

    window.addEventListener('acg-trader-drawings-request', handleRequest);
    window.addEventListener('acg-trader-drawing-command', handleCommand);
    return () => {
      window.removeEventListener('acg-trader-drawings-request', handleRequest);
      window.removeEventListener('acg-trader-drawing-command', handleCommand);
    };
  }, [coordinateApi, history.present, selectedId, symbol]);

  const commit = next => {
    setHistory(current => ({
      past: [...current.past.slice(-99), cloneDrawings(current.present)],
      present: typeof next === 'function' ? next(current.present) : next,
      future: [],
    }));
  };

  const undo = () => {
    setHistory(current => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: cloneDrawings(previous),
        future: [cloneDrawings(current.present), ...current.future.slice(0, 99)],
      };
    });
    setSelectedId(null);
    setContextMenu(null);
  };

  const redo = () => {
    setHistory(current => {
      if (!current.future.length) return current;
      const next = current.future[0];
      return {
        past: [...current.past.slice(-99), cloneDrawings(current.present)],
        present: cloneDrawings(next),
        future: current.future.slice(1),
      };
    });
    setSelectedId(null);
    setContextMenu(null);
  };

  useEffect(() => {
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
        commit(current => current.filter(item => item.id !== selectedId));
        setSelectedId(null);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selected = useMemo(() => drawings.find(item => item.id === selectedId), [drawings, selectedId]);
  const drawingTool = !disabled && ['trendline', 'hline', 'vline', 'rectangle', 'fibonacci', 'text'].includes(tool);
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
      setDraft(current => current ? { ...current, b: data } : current);
      return;
    }

    if (!drag) return;
    event.preventDefault();

    setHistory(current => ({
      ...current,
      present: current.present.map(item => {
        if (item.id !== drag.id || item.locked || lockAll) return item;
        if (drag.mode === 'a' || drag.mode === 'b') return { ...item, [drag.mode]: data };

        const dx = screen.x - drag.startScreen.x;
        const dy = screen.y - drag.startScreen.y;
        const movePoint = point => {
          const originalScreen = coordinateApi.toScreen?.(point);
          if (!originalScreen) return point;
          return snapDataPoint(coordinateApi.toData?.({ x: originalScreen.x + dx, y: originalScreen.y + dy }) || point);
        };
        return { ...item, a: movePoint(drag.original.a), b: movePoint(drag.original.b || drag.original.a) };
      }),
    }));
  };

  const finishPointer = event => {
    if (draft) {
      const end = eventDataPoint(event) || draft.b;
      const created = { ...draft, b: end };
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
      setHistory(current => ({
        past: [...current.past.slice(-99), cloneDrawings(drag.before)],
        present: current.present,
        future: [],
      }));
    }
    setDrag(null);
  };

  const selectDrawing = (event, id) => {
    if (disabled || tool !== 'cursor' || !coordinateApi) return;
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
      original: { a: { ...drawing.a }, b: { ...(drawing.b || drawing.a) } },
      before: cloneDrawings(drawings),
    });
  };

  const startHandle = (event, id, mode) => {
    const drawing = drawings.find(item => item.id === id);
    if (disabled || !coordinateApi || drawing?.locked || lockAll) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedId(id);
    setDrag({ id, mode, before: cloneDrawings(drawings) });
  };

  const patchSelected = patch => {
    if (!selectedId) return;
    commit(current => current.map(item => item.id === selectedId ? {
      ...item,
      ...patch,
      style: patch.style ? { ...item.style, ...patch.style } : item.style,
    } : item));
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

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const visibleDrawings = drawings.filter(item => visibleOnTimeframe(item, timeframe));

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
