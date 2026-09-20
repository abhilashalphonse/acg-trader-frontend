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
    event.stopPropagation();

    const startPoint = axis === 'x' ? event.clientX : event.clientY;
    const startValue = Number(value);
    const pointerId = event.pointerId;
    const target = event.currentTarget;

    try {
      target.setPointerCapture?.(pointerId);
    } catch {
      // Pointer capture is an enhancement; document listeners below remain authoritative.
    }

    const move = moveEvent => {
      const point = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      const delta = (point - startPoint) * deltaMultiplier;
      const next = Math.max(Number(min), Math.min(Number(max), startValue + delta));
      onChange(next);
    };

    const finish = () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', finish, true);
      try {
        if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
      } catch {
        // Ignore browsers that release capture automatically.
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title={ariaLabel}
      className={`group relative z-50 shrink-0 touch-none border-0 bg-transparent p-0 outline-none ${axis === 'x' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'} ${className}`}
      style={style}
    >
      {axis === 'x' && (
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/[0.08] transition group-hover:bg-[#53c7ff]/70" />
      )}
    </button>
  );
}
