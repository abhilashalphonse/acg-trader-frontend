import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus } from 'lucide-react';
import { canonicalDrawingColor, DRAWING_PALETTE_ROWS, drawingOpacity } from '../../utils/drawingAppearance.js';
import './DrawingColorPicker.css';

const RECENT_KEY = 'acg-trader-drawing-colors-recent-v1';
const PANEL_WIDTH = 268;
const PANEL_HEIGHT = 367;

const loadRecent = () => {
  try {
    const colors = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(colors) ? colors.filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6) : [];
  } catch { return []; }
};

export default function DrawingColorPicker({
  color,
  opacity = 1,
  onChange,
  className = '',
  title = 'Drawing color',
}) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  const [position, setPosition] = useState({ top: 48, left: 8 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const customRef = useRef(null);
  const selected = canonicalDrawingColor(color);
  const percent = Math.round(drawingOpacity({ opacity }) * 100);

  const place = useCallback(() => {
    const anchor = triggerRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const width = window.innerWidth, height = window.innerHeight;
    const left = Math.max(8, Math.min(width - PANEL_WIDTH - 8, anchor.left - 12));
    const below = anchor.bottom + 8;
    const top = below + PANEL_HEIGHT <= height - 8 || anchor.top < PANEL_HEIGHT + 16
      ? Math.min(below, Math.max(8, height - PANEL_HEIGHT - 8))
      : Math.max(8, anchor.top - PANEL_HEIGHT - 8);
    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    place();
    const closeIfOutside = event => {
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const keydown = event => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); }
    };
    const reposition = () => place();
    document.addEventListener('pointerdown', closeIfOutside, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, place]);

  const choose = picked => {
    const next = canonicalDrawingColor(picked);
    onChange?.({ color: next });
    setRecent(current => {
      const updated = [next, ...current.filter(c => c !== next)].slice(0, 6);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch { /* optional */ }
      return updated;
    });
  };

  const picker = open && typeof document !== 'undefined' && createPortal(
    <div ref={panelRef} role="dialog" aria-label={`${title} palette`} className="acg-drawing-color-panel"
      style={{ position: 'fixed', top: position.top, left: position.left }}
      onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
      <div className="acg-drawing-color-panel-title">Color</div>
      <div className="acg-drawing-color-grid" role="group" aria-label="Preset drawing colors">
        {DRAWING_PALETTE_ROWS.flatMap((row, rowIndex) =>
          row.map((swatch, column) => (
            <button key={`${rowIndex}-${column}`} type="button"
              className="acg-drawing-color-swatch" style={{ backgroundColor: swatch }}
              aria-label={`Select ${swatch}`} aria-pressed={selected === swatch}
              title={swatch} onClick={() => choose(swatch)}>
              {selected === swatch && <Check size={12} strokeWidth={2.5} color={column < 5 && rowIndex === 0 ? '#17202b' : '#ffffff'} />}
            </button>
          ))
        )}
      </div>
      <div className="acg-drawing-color-panel-footer">
        <div className="acg-drawing-color-recent" aria-label="Recent drawing colors">
          {recent.slice(0, 4).map(swatch => (
            <button key={swatch} type="button" className="acg-drawing-color-recent-swatch"
              style={{ backgroundColor: swatch }} title={swatch}
              aria-label={`Recent color ${swatch}`} onClick={() => choose(swatch)} />
          ))}
          <button type="button" className="acg-drawing-custom-trigger" aria-label="Custom drawing color"
            title="Custom color" onClick={() => customRef.current?.click()}><Plus size={16}/></button>
          <input ref={customRef} className="acg-drawing-native-color" type="color" tabIndex={-1}
            aria-label="Choose custom drawing color" value={selected}
            onChange={event => choose(event.target.value)} />
        </div>
        <div className="acg-drawing-color-opacity-label">
          <span>Opacity</span><output>{percent}%</output>
        </div>
        <input type="range" className="acg-drawing-opacity-slider" min="0" max="100" step="1"
          value={percent} aria-label={title === 'Drawing color' ? 'Drawing opacity' : `${title} opacity`}
          onChange={event => onChange?.({ opacity: Number(event.target.value) / 100 })} />
      </div>
    </div>, document.body);

  return <>
    <button ref={triggerRef} type="button" className={`acg-drawing-color-trigger ${className}`}
      title={title} aria-label={title} aria-expanded={open} aria-haspopup="dialog"
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}>
      <span className="acg-drawing-color-trigger-dot" style={{ backgroundColor: selected, opacity: drawingOpacity({opacity}) }} />
    </button>
    {picker}
  </>;
}
