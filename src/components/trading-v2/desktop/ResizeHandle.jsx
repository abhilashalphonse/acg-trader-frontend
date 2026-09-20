import React from 'react';

export default function ResizeHandle({
  axis = 'x',
  value,
  min,
  max,
  onChange,
  className = '',
  ariaLabel = 'Resize panel',
  deltaMultiplier = 1,
  style,
  onDoubleClick,
}) {
  const onPointerDown = event => {
    event.preventDefault();
    const startPoint = axis === 'x' ? event.clientX : event.clientY;
    const startValue = Number(value);

    const move = moveEvent => {
      const point = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      const delta = (point - startPoint) * deltaMultiplier;
      const next = Math.max(min, Math.min(max, startValue + delta));
      onChange(next);
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={`group relative z-40 shrink-0 touch-none bg-transparent outline-none ${axis === 'x' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'} ${className}`}
      style={style}
    >
      <span className={`absolute bg-white/[0.08] transition group-hover:bg-[#53c7ff]/80 ${axis === 'x' ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'}`} />
      {axis === 'y' && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-3 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-[#0b0e11]/95 shadow-[0_2px_10px_rgba(0,0,0,.35)] transition group-hover:border-[#53c7ff]/50">
          <span className="h-px w-4 bg-[#6f8191] transition group-hover:bg-[#53c7ff]" />
        </span>
      )}
    </button>
  );
}
