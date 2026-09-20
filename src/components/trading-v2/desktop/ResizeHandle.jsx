import React from 'react';

export default function ResizeHandle({
  axis = 'x',
  value,
  min,
  max,
  onChange,
  className = '',
  ariaLabel = 'Resize panel',
}) {
  const onPointerDown = event => {
    event.preventDefault();
    const startPoint = axis === 'x' ? event.clientX : event.clientY;
    const startValue = Number(value);

    const move = moveEvent => {
      const point = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      const delta = point - startPoint;
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
      className={`group relative z-40 shrink-0 touch-none bg-transparent outline-none ${axis === 'x' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} ${className}`}
    >
      <span className={`absolute bg-white/[0.06] transition group-hover:bg-[#53c7ff]/70 ${axis === 'x' ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'}`} />
    </button>
  );
}
