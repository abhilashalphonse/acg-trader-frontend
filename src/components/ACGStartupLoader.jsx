import React from 'react';

export default function ACGStartupLoader({ canvas = false }) {
  const shellClass = canvas
    ? 'absolute inset-0 z-[60] grid place-items-center overflow-hidden bg-[#09090b]'
    : 'grid min-h-dvh place-items-center overflow-hidden bg-black';

  return (
    <div className={shellClass} role="status" aria-label="Loading ACG Trader">
      <div className="relative grid place-items-center">
        <div className={canvas ? 'relative grid size-14 place-items-center' : 'relative grid size-24 place-items-center'}>
          <span
            className={`absolute inset-0 rounded-full border border-white/[0.06] border-t-[#195be1] ${canvas ? 'animate-spin' : 'animate-[spin_1.4s_linear_infinite]'}`}
            aria-hidden="true"
          />
          <span
            className={`absolute rounded-full bg-[#195be1]/10 blur-xl ${canvas ? 'inset-2' : 'inset-3'}`}
            aria-hidden="true"
          />
          <img
            src="/favicon.svg"
            alt=""
            className={canvas ? 'relative size-7 select-none' : 'relative size-12 select-none'}
            draggable="false"
          />
        </div>
        {!canvas && (
          <div className="mt-4 text-center">
            <div className="text-[22px] font-black tracking-[-0.055em] text-white">ACG</div>
            <div className="mx-auto mt-3 h-px w-10 overflow-hidden bg-white/[0.07]">
              <span className="block h-full w-1/2 animate-[acg-loader-sweep_1.15s_ease-in-out_infinite] bg-[#195be1]" />
            </div>
          </div>
        )}
      </div>
      {!canvas && (
        <style>{`
          @keyframes acg-loader-sweep {
            0% { transform: translateX(-110%); opacity: .35; }
            50% { opacity: 1; }
            100% { transform: translateX(210%); opacity: .35; }
          }
        `}</style>
      )}
    </div>
  );
}
