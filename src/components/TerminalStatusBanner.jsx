import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CircleDot, ShieldAlert, WifiOff, X } from 'lucide-react';

const TONES = {
  info: 'border-[#24455b] bg-[#0b2230]/96 text-[#b9d7e8]',
  warning: 'border-[#5a4724] bg-[#2a210f]/96 text-[#f0d696]',
  danger: 'border-[#653039] bg-[#2a1419]/96 text-[#ffb3bb]',
};

function StatusIcon({ code, severity }) {
  if (code === 'REALTIME_RECONNECTING' || code === 'MARKET_UNAVAILABLE') return <WifiOff size={14} />;
  if (severity === 'danger') return <ShieldAlert size={14} />;
  if (severity === 'warning') return <AlertTriangle size={14} />;
  return <CircleDot size={14} />;
}

export default function TerminalStatusBanner({ status }) {
  const [dismissedKey, setDismissedKey] = useState(null);
  const previousKeyRef = useRef(null);
  const pointerStartRef = useRef(null);
  const statusKey = status ? `${status.code || ''}|${status.message || ''}` : null;

  useEffect(() => {
    if (!statusKey) {
      previousKeyRef.current = null;
      setDismissedKey(null);
      return;
    }
    if (previousKeyRef.current !== statusKey) {
      previousKeyRef.current = statusKey;
      setDismissedKey(null);
    }
  }, [statusKey]);

  useEffect(() => {
    if (!status || dismissedKey === statusKey || status.severity === 'danger') return undefined;
    const timer = window.setTimeout(() => setDismissedKey(statusKey), 5200);
    return () => window.clearTimeout(timer);
  }, [dismissedKey, status, statusKey]);

  if (!status || dismissedKey === statusKey) return null;

  const dismiss = () => setDismissedKey(statusKey);
  const onPointerDown = event => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = event => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const deltaY = event.clientY - start.y;
    const deltaX = Math.abs(event.clientX - start.x);
    if (deltaY < -24 && deltaX < 80) dismiss();
  };

  return (
    <div className="pointer-events-none fixed left-1/2 top-[64px] z-[200] w-[calc(100%-16px)] max-w-[460px] -translate-x-1/2 px-1">
      <div
        role="status"
        aria-live="polite"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className={`pointer-events-auto flex touch-pan-y items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-[0_14px_38px_rgba(0,0,0,.38)] backdrop-blur-xl ${TONES[status.severity] || TONES.info}`}
      >
        <span className="mt-0.5 shrink-0"><StatusIcon code={status.code} severity={status.severity} /></span>
        <div className="min-w-0 flex-1">
          <strong className="block text-[10px] font-black tracking-[-0.01em]">{status.title}</strong>
          <p className="mt-0.5 text-[8px] font-medium leading-relaxed opacity-80">{status.message}</p>
          {status.severity !== 'danger' && <span className="mt-1 block text-[7px] font-semibold opacity-50">Swipe up or close</span>}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss status"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-current opacity-60 transition hover:bg-white/10 hover:opacity-100 active:scale-95"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
