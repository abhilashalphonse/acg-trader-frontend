import React from 'react';
import { AlertTriangle, CircleDot, ShieldAlert, WifiOff } from 'lucide-react';

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
  if (!status) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-[64px] z-[200] w-[calc(100%-16px)] max-w-[460px] -translate-x-1/2 px-1">
      <div className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-[0_14px_38px_rgba(0,0,0,.38)] backdrop-blur-xl ${TONES[status.severity] || TONES.info}`}>
        <span className="mt-0.5 shrink-0"><StatusIcon code={status.code} severity={status.severity} /></span>
        <div className="min-w-0">
          <strong className="block text-[10px] font-black tracking-[-0.01em]">{status.title}</strong>
          <p className="mt-0.5 text-[8px] font-medium leading-relaxed opacity-80">{status.message}</p>
        </div>
      </div>
    </div>
  );
}
