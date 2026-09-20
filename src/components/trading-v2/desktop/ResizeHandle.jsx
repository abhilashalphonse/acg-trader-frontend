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
      title={axis === 'y' ? 'Drag to resize chart and positions. Double-click to reset.' : ariaLabel}
      className={`group relative z-50 shrink-0 touch-none outline-none ${axis === 'x' ? 'w-2 cursor-col-resize bg-transparent' : 'h-3 cursor-row-resize bg-[#090b0d]/95 hover:bg-[#0d1419]'} ${className}`}
      style={style}
    >
      <span className={`absolute transition ${axis === 'x' ? 'inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/[0.08] group-hover:bg-[#53c7ff]/80' : 'inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.12] group-hover:bg-[#53c7ff]/80'}`} />
      {axis === 'y' && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-4 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-[#11161a] shadow-[0_3px_12px_rgba(0,0,0,.5)] transition group-hover:border-[#53c7ff]/60 group-hover:bg-[#10202a]">
          <span className="flex items-center gap-1">
            <span className="size-1 rounded-full bg-[#6f8191] group-hover:bg-[#53c7ff]" />
            <span className="size-1 rounded-full bg-[#6f8191] group-hover:bg-[#53c7ff]" />
            <span className="size-1 rounded-full bg-[#6f8191] group-hover:bg-[#53c7ff]" />
          </span>
        </span>
      )}
    </button>
  );
}
