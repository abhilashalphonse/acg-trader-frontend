import React from 'react';
import { ChartNoAxesCombined, Clock3, List, MoreHorizontal, SlidersHorizontal } from 'lucide-react';

const items = [
  { id: 'watchlist', label: 'Watchlist', Icon: List },
  { id: 'trade', label: 'Trade', Icon: ChartNoAxesCombined },
  { id: 'markets', label: 'Markets', Icon: SlidersHorizontal },
  { id: 'history', label: 'History', Icon: Clock3 },
  { id: 'more', label: 'More', Icon: MoreHorizontal },
];

export default function BottomNavbar({ active='trade', onChange=()=>{} }) {
  return (
    <nav className="v2-bottom-nav" aria-label="Primary">
      {items.map(({ id, label, Icon }) => (
        <button key={id} className={active===id?'active':''} onClick={()=>onChange(id)}>
          <span className="v2-nav-icon"><Icon size={18}/></span>
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );
}
