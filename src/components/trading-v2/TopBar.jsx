import React from 'react';
import { Bell, Search, UserRound } from 'lucide-react';

export default function TopBar({ balance = '$12,458.32', live = true }) {
  return (
    <header className="flex h-[60px] items-center justify-between gap-2 px-3">
      <div className="min-w-0 leading-none">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-[15px] font-extrabold tracking-[-0.025em] text-[#f7f9fc]">
          <span>ACG Trader</span>
          <span className="rounded-md bg-[#0d2b42] px-1.5 py-1 text-[9px] font-extrabold tracking-[0.04em] text-[#55bdff]">V2</span>
        </div>
        <p className="mt-1.5 truncate text-[9px] font-medium text-[#65788e]">Trade Without Limits</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" aria-label="Search" className="grid size-8 place-items-center rounded-lg text-[#9db0c6] transition hover:bg-white/[0.04] hover:text-white">
          <Search size={20} strokeWidth={2} />
        </button>

        <button type="button" aria-label="Notifications" className="relative grid size-9 place-items-center rounded-xl border border-[#192b3b] bg-[#09131d] text-[#9eb0c4] shadow-[inset_0_1px_rgba(255,255,255,0.02)]">
          <Bell size={18} />
          <span className="absolute right-[6px] top-[6px] size-1.5 rounded-full bg-[#ff5363] shadow-[0_0_0_2px_#09131d]" />
        </button>

        <div className="flex h-9 min-w-[94px] flex-col justify-center rounded-xl border border-[#1a2b3b] bg-[#09131d] px-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.02)]">
          <strong className="whitespace-nowrap text-[11px] font-extrabold tracking-[-0.015em] text-[#f6f9fc]">{balance}</strong>
          <span className="mt-0.5 flex items-center gap-1 text-[8px] font-medium text-[#77899d]">
            <span className={`size-1.5 rounded-full ${live ? 'bg-[#31dfa3]' : 'bg-[#66788c]'}`} />
            {live ? 'Live' : 'Offline'}
          </span>
        </div>

        <button type="button" aria-label="Profile" className="grid size-9 place-items-center rounded-full border border-[#1a2b3b] bg-gradient-to-br from-[#102235] to-[#0a131e] text-[#99adc3] shadow-[0_5px_18px_rgba(0,0,0,0.25)]">
          <UserRound size={18} fill="currentColor" className="opacity-90" />
        </button>
      </div>
    </header>
  );
}
