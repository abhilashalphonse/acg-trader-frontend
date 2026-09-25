import React from 'react';

export default function ACGStartupLoader({ canvas = false }) {
  const shellClass = canvas
    ? 'absolute inset-0 z-[60] grid place-items-center overflow-hidden bg-[#09090b]'
    : 'grid min-h-dvh place-items-center overflow-hidden bg-black';

  return (
    <div className={shellClass} role="status" aria-label="Loading ACG Trader">
      <div className="flex flex-col items-center justify-center">
        <img
          src="/acg-logo.png"
          alt="ACG"
          className={canvas
            ? 'h-auto w-[64px] select-none opacity-90'
            : 'h-auto w-[112px] select-none'}
          draggable="false"
        />
        <div
          className={canvas
            ? 'mt-3 h-px w-10 overflow-hidden rounded-full bg-white/[0.07]'
            : 'mt-5 h-px w-16 overflow-hidden rounded-full bg-white/[0.07]'}
          aria-hidden="true"
        >
          <span className="block h-full w-1/2 animate-[acg-loader-sweep_1.05s_ease-in-out_infinite] bg-[#195be1]" />
        </div>
      </div>
      <style>{`
        @keyframes acg-loader-sweep {
          0% { transform: translateX(-110%); opacity: .28; }
          50% { opacity: 1; }
          100% { transform: translateX(210%); opacity: .28; }
        }
      `}</style>
    </div>
  );
}
