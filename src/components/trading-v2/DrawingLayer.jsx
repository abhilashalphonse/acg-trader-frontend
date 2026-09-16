import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';

const clamp01 = value => Math.max(0, Math.min(1, value));
const pointFromEvent = (event, rect) => ({
  x: clamp01((event.clientX - rect.left) / rect.width),
  y: clamp01((event.clientY - rect.top) / rect.height),
});

const STORAGE_PREFIX = 'acg-trader-drawings-v1';
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

function lineHitProps(selected, color = '#64caff') {
  return { stroke: selected ? '#ffffff' : color, strokeWidth: selected ? 2 : 1.4, vectorEffect: 'non-scaling-stroke' };
}

function Handle({ x, y, onPointerDown }) {
  return <circle cx={`${x * 100}%`} cy={`${y * 100}%`} r="5" fill="#071019" stroke="#7bd4ff" strokeWidth="2" vectorEffect="non-scaling-stroke" className="pointer-events-auto cursor-grab" onPointerDown={onPointerDown} />;
}

function DrawingShape({ drawing, selected, onSelect, onStartHandle }) {
  const a = drawing.a || { x: 0, y: 0 };
  const b = drawing.b || a;
  const common = { className: 'pointer-events-auto cursor-move', onPointerDown: event => onSelect(event, drawing.id) };

  if (drawing.type === 'hline') return <line x1="0" y1={`${a.y * 100}%`} x2="100%" y2={`${a.y * 100}%`} {...lineHitProps(selected, '#f0c35c')} {...common} />;
  if (drawing.type === 'vline') return <line x1={`${a.x * 100}%`} y1="0" x2={`${a.x * 100}%`} y2="100%" {...lineHitProps(selected, '#f0c35c')} {...common} />;

  if (drawing.type === 'rectangle') {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(a.x - b.x);
    const height = Math.abs(a.y - b.y);
    return <g><rect x={`${x * 100}%`} y={`${y * 100}%`} width={`${width * 100}%`} height={`${height * 100}%`} fill="rgba(83,199,255,0.07)" stroke={selected ? '#ffffff' : '#53c7ff'} strokeWidth={selected ? 2 : 1.2} vectorEffect="non-scaling-stroke" {...common} />{selected && <><Handle x={a.x} y={a.y} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} /><Handle x={b.x} y={b.y} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} /></>}</g>;
  }

  if (drawing.type === 'fibonacci') {
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    return <g>{levels.map(level => { const y = a.y + (b.y - a.y) * level; return <g key={level}><line x1={`${Math.min(a.x, b.x) * 100}%`} y1={`${y * 100}%`} x2={`${Math.max(a.x, b.x) * 100}%`} y2={`${y * 100}%`} stroke={selected ? '#ffffff' : '#b78cff'} strokeWidth={level === 0.5 ? 1.5 : 1} strokeDasharray={level === 0.5 ? '0' : '3 3'} vectorEffect="non-scaling-stroke" {...common}/><text x={`${Math.min(a.x, b.x) * 100 + 1}%`} y={`${y * 100 - 0.8}%`} fill="#9caec0" fontSize="8" className="pointer-events-none">{Math.round(level * 1000) / 10}%</text></g>; })}{selected && <><Handle x={a.x} y={a.y} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} /><Handle x={b.x} y={b.y} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} /></>}</g>;
  }

  if (drawing.type === 'text') {
    return <g {...common}><text x={`${a.x * 100}%`} y={`${a.y * 100}%`} fill={selected ? '#ffffff' : '#d8e4ee'} fontSize="10" fontWeight="600" style={{ paintOrder: 'stroke', stroke: '#071019', strokeWidth: 3 }}>{drawing.text || 'Text'}</text>{selected && <Handle x={a.x} y={a.y} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} />}</g>;
  }

  return <g><line x1={`${a.x * 100}%`} y1={`${a.y * 100}%`} x2={`${b.x * 100}%`} y2={`${b.y * 100}%`} {...lineHitProps(selected)} {...common} />{selected && <><Handle x={a.x} y={a.y} onPointerDown={event => onStartHandle(event, drawing.id, 'a')} /><Handle x={b.x} y={b.y} onPointerDown={event => onStartHandle(event, drawing.id, 'b')} /></>}</g>;
}

export default function DrawingLayer({ symbol, timeframe, tool = 'cursor', onToolChange = () => {}, disabled = false }) {
  const svgRef = useRef(null);
  const [drawings, setDrawings] = useState(() => loadDrawings(symbol, timeframe));
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    setDrawings(loadDrawings(symbol, timeframe));
    setSelectedId(null);
    setDraft(null);
    setDrag(null);
  }, [symbol, timeframe]);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey(symbol, timeframe), JSON.stringify(drawings));
  }, [drawings, symbol, timeframe]);

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
  const makeDrawing = (type, a, b = a, text = '') => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, a, b, text });

  const startCreate = event => {
    if (!drawingTool) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event, rect);

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
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = pointFromEvent(event, rect);
    if (draft) { setDraft(current => current ? { ...current, b: point } : current); return; }
    if (!drag) return;
    event.preventDefault();
    setDrawings(current => current.map(item => {
      if (item.id !== drag.id) return item;
      if (drag.mode === 'a' || drag.mode === 'b') return { ...item, [drag.mode]: point };
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      return { ...item, a: { x: clamp01(drag.original.a.x + dx), y: clamp01(drag.original.a.y + dy) }, b: { x: clamp01(drag.original.b.x + dx), y: clamp01(drag.original.b.y + dy) } };
    }));
  };

  const finishPointer = event => {
    if (draft) {
      const rect = svgRef.current?.getBoundingClientRect();
      const end = rect ? pointFromEvent(event, rect) : draft.b;
      const created = { ...draft, b: end };
      if (Math.hypot(created.b.x - created.a.x, created.b.y - created.a.y) > 0.015) {
        setDrawings(current => [...current, created]);
        setSelectedId(created.id);
      }
      setDraft(null);
      onToolChange('cursor');
    }
    setDrag(null);
  };

  const selectDrawing = (event, id) => {
    if (disabled || tool !== 'cursor') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const drawing = drawings.find(item => item.id === id);
    if (!drawing) return;
    const point = pointFromEvent(event, rect);
    setSelectedId(id);
    setDrag({ id, mode: 'move', start: point, original: { a: { ...drawing.a }, b: { ...(drawing.b || drawing.a) } } });
  };

  const startHandle = (event, id, mode) => {
    if (disabled) return;
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
        <rect width="100%" height="100%" fill="transparent" className={drawingTool ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'} onPointerDown={startCreate} />
        {drawings.map(drawing => <DrawingShape key={drawing.id} drawing={drawing} selected={drawing.id === selectedId} onSelect={selectDrawing} onStartHandle={startHandle} />)}
        {draft && <DrawingShape drawing={draft} selected onSelect={() => {}} onStartHandle={() => {}} />}
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
