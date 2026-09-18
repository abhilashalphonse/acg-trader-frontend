import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';

const STORAGE_PREFIX = 'acg-trader-drawings-v2';
const storageKey = (symbol, timeframe) => `${STORAGE_PREFIX}:${symbol}:${timeframe}`;

function loadDrawings(symbol, timeframe) {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(symbol, timeframe)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function lineStyle(selected, color = '#64caff') {
  return { stroke: selected ? '#ffffff' : color, strokeWidth: selected ? 2 : 1.4, vectorEffect: 'non-scaling-stroke' };
}

function Handle({ point, onPointerDown }) {
  if (!point) return null;
  return <circle cx={point.x} cy={point.y} r="5" fill="#071019" stroke="#7bd4ff" strokeWidth="2" vectorEffect="non-scaling-stroke" className="pointer-events-auto cursor-grab" onPointerDown={onPointerDown} />;
}

function DrawingShape({ drawing, selected, resolvePoint, size, onSelect, onStartHandle }) {
  const a = resolvePoint(drawing.a);
  const b = resolvePoint(drawing.b || drawing.a);
  if (!a || !b) return null;

  const common = { className: 'pointer-events-auto cursor-move', onPointerDown: event => onSelect(event, drawing.id) };

  if (drawing.type === 'hline') return <line x1="0" y1={a.y} x2={size.width} y2={a.y} {...lineStyle(selected, '#f0c35c')} {...common} />;
  if (drawing.type === 'vline') return <line x1={a.x} y1="0" x2={a.x} y2={size.height} {...lineStyle(selected, '#f0c35c')} {...common} />;

  if (drawing.type === 'rectangle') {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(a.x - b.x);
    const height = Math.abs(a.y - b.y);
    return <g><rect x={x} y={y} width={width} height={height} fill="rgba(83,199,255,0.07)" stroke={selected ? '#ffffff' : '#53c7ff'} strokeWidth={selected ? 2 : 1.2} vectorEffect="non-scaling-stroke" {...common} />{selected && <><Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} /><Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} /></>}</g>;
  }

  if (drawing.type === 'fibonacci') {
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    return <g>{levels.map(level => { const y = a.y + (b.y - a.y) * level; return <g key={level}><line x1={left} y1={y} x2={right} y2={y} stroke={selected ? '#ffffff' : '#b78cff'} strokeWidth={level === 0.5 ? 1.5 : 1} strokeDasharray={level === 0.5 ? '0' : '3 3'} vectorEffect="non-scaling-stroke" {...common}/><text x={left + 5} y={y - 4} fill="#9caec0" fontSize="8" className="pointer-events-none">{Math.round(level * 1000) / 10}%</text></g>; })}{selected && <><Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} /><Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} /></>}</g>;
  }

  if (drawing.type === 'text') {
    return <g {...common}><text x={a.x} y={a.y} fill={selected ? '#ffffff' : '#d8e4ee'} fontSize="10" fontWeight="600" style={{ paintOrder: 'stroke', stroke: '#071019', strokeWidth: 3 }}>{drawing.text || 'Text'}</text>{selected && <Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />}</g>;
  }

  return <g><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...lineStyle(selected)} {...common} />{selected && <><Handle point={a} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} /><Handle point={b} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} /></>}</g>;
}

export default function DrawingLayer({
  symbol,
  timeframe,
  tool = 'cursor',
  onToolChange = () => {},
  disabled = false,
  coordinateApi = null,
}) {
  const svgRef = useRef(null);
  const [drawings, setDrawings] = useState(() => loadDrawings(symbol, timeframe));
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [drag, setDrag] = useState(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [, setCoordinateRevision] = useState(0);

  useEffect(() => {
    setDrawings(loadDrawings(symbol, timeframe));
    setSelectedId(null);
    setDraft(null);
    setDrag(null);
  }, [symbol, timeframe]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(storageKey(symbol, timeframe), JSON.stringify(drawings)); } catch { /* drawings remain available for the current session */ }
  }, [drawings, symbol, timeframe]);

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
    const onKey = event => {
      if (!selectedId || !['Delete', 'Backspace'].includes(event.key)) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      event.preventDefault();
      setDrawings(current => current.filter(item => item.id !== selectedId));
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const selected = useMemo(() => drawings.find(item => item.id === selectedId), [drawings, selectedId]);
  const drawingTool = !disabled && ['trendline', 'hline', 'vline', 'rectangle', 'fibonacci', 'text'].includes(tool);
  const resolvePoint = point => coordinateApi?.toScreen?.(point) || null;

  const eventScreenPoint = event => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const eventDataPoint = event => {
    const screen = eventScreenPoint(event);
    return screen ? coordinateApi?.toData?.(screen) || null : null;
  };

  const makeDrawing = (type, a, b = a, text = '') => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, a, b, text });

  const startCreate = event => {
    if (!drawingTool || !coordinateApi) return;
    const point = eventDataPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (tool === 'text') {
      const text = window.prompt('Chart text', 'Note');
      if (text?.trim()) {
        const created = makeDrawing('text', point, point, text.trim());
        setDrawings(current => [...current, created]);
        setSelectedId(created.id);
      }
      onToolChange('cursor');
      return;
    }

    if (tool === 'hline' || tool === 'vline') {
      const created = makeDrawing(tool, point);
      setDrawings(current => [...current, created]);
      setSelectedId(created.id);
      onToolChange('cursor');
      return;
    }

    setDraft(makeDrawing(tool, point, point));
  };

  const pointerMove = event => {
    if (!coordinateApi) return;
    const screen = eventScreenPoint(event);
    const data = screen ? coordinateApi.toData?.(screen) : null;
    if (!screen || !data) return;

    if (draft) {
      setDraft(current => current ? { ...current, b: data } : current);
      return;
    }

    if (!drag) return;
    event.preventDefault();

    setDrawings(current => current.map(item => {
      if (item.id !== drag.id) return item;
      if (drag.mode === 'a' || drag.mode === 'b') return { ...item, [drag.mode]: data };

      const dx = screen.x - drag.startScreen.x;
      const dy = screen.y - drag.startScreen.y;
      const movePoint = point => {
        const originalScreen = coordinateApi.toScreen?.(point);
        if (!originalScreen) return point;
        return coordinateApi.toData?.({ x: originalScreen.x + dx, y: originalScreen.y + dy }) || point;
      };
      return { ...item, a: movePoint(drag.original.a), b: movePoint(drag.original.b || drag.original.a) };
    }));
  };

  const finishPointer = event => {
    if (draft) {
      const end = eventDataPoint(event) || draft.b;
      const created = { ...draft, b: end };
      const a = coordinateApi?.toScreen?.(created.a);
      const b = coordinateApi?.toScreen?.(created.b);
      if (a && b && Math.hypot(b.x - a.x, b.y - a.y) > 8) {
        setDrawings(current => [...current, created]);
        setSelectedId(created.id);
      }
      setDraft(null);
      onToolChange('cursor');
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
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedId(id);
    setDrag({ id, mode: 'move', startScreen: screen, original: { a: { ...drawing.a }, b: { ...(drawing.b || drawing.a) } } });
  };

  const startHandle = (event, id, mode) => {
    if (disabled || !coordinateApi) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedId(id);
    setDrag({ id, mode });
  };

  const deleteSelected = () => {
    setDrawings(current => current.filter(item => item.id !== selectedId));
    setSelectedId(null);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[16]">
      <svg ref={svgRef} className="size-full touch-none" onPointerMove={pointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer}>
        <rect width="100%" height="100%" fill="transparent" className={drawingTool && coordinateApi ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'} onPointerDown={startCreate} />
        {drawings.map(drawing => <DrawingShape key={drawing.id} drawing={drawing} selected={drawing.id === selectedId} resolvePoint={resolvePoint} size={size} onSelect={selectDrawing} onStartHandle={startHandle} />)}
        {draft && <DrawingShape drawing={draft} selected resolvePoint={resolvePoint} size={size} onSelect={() => {}} onStartHandle={() => {}} />}
      </svg>

      {selected && !disabled && (
        <div className="pointer-events-auto absolute right-2 top-11 z-20 flex items-center gap-1 rounded-lg border border-[#243746] bg-[#08131d]/94 p-1 shadow-xl">
          <span className="px-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#74899d]">{selected.type}</span>
          <button type="button" onClick={deleteSelected} className="grid size-7 place-items-center rounded-md text-[#ff7480] hover:bg-[#35151d]" aria-label="Delete drawing"><Trash2 size={13}/></button>
          <button type="button" onClick={() => setSelectedId(null)} className="grid size-7 place-items-center rounded-md text-[#8194a7] hover:bg-white/[0.04]" aria-label="Deselect drawing"><X size={13}/></button>
        </div>
      )}
    </div>
  );
}
