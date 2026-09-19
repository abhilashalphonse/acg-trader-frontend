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
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[460px] -translate-x-1/2 border-t border-[#202022] bg-[#080808]/96 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl" aria-label="Primary navigation">
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ id, label, Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`relative mx-auto flex h-[54px] w-[68px] max-w-full flex-col items-center justify-center gap-1 text-[9px] font-semibold transition ${selected ? 'text-[#f3f3f4]' : 'text-[#77777d]'}`}
            >
              <span className={`absolute top-0 h-0.5 w-7 rounded-full transition ${selected ? 'bg-[#53c7ff]' : 'bg-transparent'}`} /><Icon size={22} className={selected ? 'text-[#53c7ff]' : 'text-[#8a8a90]'} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
