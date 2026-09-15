import React from 'react';
import { ChartNoAxesCombined, ClipboardList, Clock3, House, MoreHorizontal } from 'lucide-react';

const items = [
  { id: 'watchlist', label: 'Watchlist', Icon: House },
  { id: 'trade', label: 'Trade', Icon: ChartNoAxesCombined },
  { id: 'markets', label: 'Markets', Icon: ClipboardList },
  { id: 'history', label: 'History', Icon: Clock3 },
  { id: 'more', label: 'More', Icon: MoreHorizontal },
];

export default function BottomNavbar({ active = 'trade', onChange = () => {} }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[460px] -translate-x-1/2 rounded-t-[26px] border-t border-[#1a2b3a] bg-[#071019]/95 px-2 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl" aria-label="Primary navigation">
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ id, label, Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`mx-auto flex h-[58px] w-[70px] max-w-full flex-col items-center justify-center gap-1 rounded-[18px] text-[9px] font-semibold transition ${selected ? 'bg-[#0b2133] text-[#f1f7fc] shadow-[0_7px_24px_rgba(0,0,0,0.24)]' : 'text-[#7c90a7]'}`}
            >
              <Icon size={22} className={selected ? 'text-[#53c7ff]' : 'text-[#8ba0b8]'} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none mx-auto mt-1 h-1 w-28 rounded-full bg-white/90" />
    </nav>
  );
}
