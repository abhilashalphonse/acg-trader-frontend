import React from 'react';
import { BarChart3, ChartNoAxesCombined, Clock3, UserRound, List } from 'lucide-react';

const items = [
  { id: 'watchlist', label: 'Watchlist', Icon: List },
  { id: 'chart', label: 'Chart', Icon: ChartNoAxesCombined },
  { id: 'trade', label: 'Trade', Icon: BarChart3 },
  { id: 'history', label: 'History', Icon: Clock3 },
  { id: 'account', label: 'Account', Icon: UserRound },
];

export default function BottomNavbar({ active = 'chart', onChange = () => {} }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 h-[calc(46px+env(safe-area-inset-bottom))] w-full max-w-[460px] -translate-x-1/2 border-t border-white/[0.07] bg-[#0d0d10] pb-[env(safe-area-inset-bottom)]" aria-label="Primary navigation">
      <div className="grid h-[46px] grid-cols-5">
        {items.map(({ id, label, Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`relative flex h-[46px] min-w-0 flex-col items-center justify-center gap-0.5 text-[7px] font-semibold transition ${selected ? 'text-[#f3f3f4]' : 'text-[#77777d]'}`}
            >
              <span className={`absolute top-0 h-0.5 w-6 transition ${selected ? 'bg-[#53c7ff]' : 'bg-transparent'}`} />
              <Icon size={17} className={selected ? 'text-[#53c7ff]' : 'text-[#85858b]'} strokeWidth={1.8} />
              <span className="leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
