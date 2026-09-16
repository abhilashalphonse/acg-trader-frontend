import React, { useMemo, useState } from 'react';
import { MoreHorizontal, Trash2, X, SlidersHorizontal } from 'lucide-react';

const initialPositions = [
  { id: 1, flags: '🇺🇸🇨🇦', symbol: 'D/CAD', side: 'BUY', volume: '0.01', entry: '0.99342', pnl: '+$0.18', tp: '0.99500', sl: '0.99000' },
  { id: 2, flags: '🇪🇺🇺🇸', symbol: 'EUR/USD', side: 'SELL', volume: '0.02', entry: '1.08460', pnl: '+$0.78', tp: '1.08000', sl: '1.09000' },
];

const tabs = [
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'history', label: 'History' },
];

export default function PositionsPanel() {
  const [tab, setTab] = useState('positions');
  const [positions, setPositions] = useState(initialPositions);
  const [menuId, setMenuId] = useState(null);
  const [history, setHistory] = useState([]);

  const closePosition = id => {
    const closing = positions.find(item => item.id === id);
    if (!closing) return;
    setPositions(current => current.filter(item => item.id !== id));
    setHistory(current => [{ ...closing, closedAt: 'Just now' }, ...current]);
    setMenuId(null);
  };

  const closeAll = () => {
    if (!positions.length) return;
    setHistory(current => [...positions.map(item => ({ ...item, closedAt: 'Just now' })), ...current]);
    setPositions([]);
    setMenuId(null);
  };

  const counts = useMemo(() => ({ positions: positions.length, orders: 0, history: history.length }), [positions, history]);

  return (
    <section className="mt-3 overflow-hidden rounded-[20px] border border-[#182938] bg-gradient-to-b from-[#0a141e] to-[#071019] shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
      <div className="flex h-[50px] items-center justify-between gap-2 border-b border-[#132331] px-3">
        <div className="flex h-full min-w-0 items-stretch gap-1">
          {tabs.map(item => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`relative flex h-full items-center gap-1.5 px-2 text-[11px] font-bold ${tab === item.id ? 'text-[#f3f7fb]' : 'text-[#7b8da1]'}`}>
              <span>{item.label}</span>
              <span className="rounded-full bg-[#0d3048] px-1.5 py-0.5 text-[8px] font-extrabold text-[#55c3ff]">{counts[item.id]}</span>
              {tab === item.id && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#3dbdff] shadow-[0_0_8px_rgba(61,189,255,0.35)]" />}
            </button>
          ))}
        </div>

        <button type="button" onClick={closeAll} disabled={!positions.length} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#26384a] bg-[#0b151f] px-2.5 text-[9px] font-bold text-[#d6dee7] disabled:cursor-not-allowed disabled:opacity-35">
          <Trash2 size={13} className="text-[#8fa2b7]" /> Close All
        </button>
      </div>

      {tab === 'positions' && (
        <div className="space-y-1.5 p-2">
          {!positions.length && <div className="grid h-[110px] place-items-center text-[10px] font-medium text-[#607387]">No open positions</div>}
          {positions.map(position => (
            <div key={position.id} className="relative grid min-h-[64px] grid-cols-[minmax(0,1.55fr)_0.62fr_0.66fr_0.66fr_22px] items-center gap-1.5 rounded-xl border border-[#142533] bg-[#08121b] px-2.5 py-2 shadow-[inset_0_1px_rgba(255,255,255,0.015)]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 pr-1 text-[22px] leading-none tracking-[-0.32em]">{position.flags}</span>
                <div className="min-w-0"><div className="flex min-w-0 items-center gap-1.5"><strong className="truncate text-[11px] font-extrabold tracking-[-0.02em] text-[#f3f6fa]">{position.symbol}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black leading-none ${position.side === 'BUY' ? 'bg-[#0c3b2e] text-[#38dba4]' : 'bg-[#3b1820] text-[#ff707a]'}`}>{position.side}</span></div><p className="mt-1 whitespace-nowrap text-[9px] text-[#718398]"><span className="text-[#2bcf98]">{position.volume}</span> · {position.entry}</p></div>
              </div>
              <div><span className="block text-[8px] text-[#62758a]">P&amp;L</span><b className="mt-1 block text-[11px] font-extrabold text-[#31d79d]">{position.pnl}</b></div>
              <div><span className="block text-[8px] text-[#62758a]">TP</span><b className="mt-1 block text-[9px] font-medium text-[#bac6d3]">{position.tp}</b></div>
              <div><span className="block text-[8px] text-[#62758a]">SL</span><b className="mt-1 block text-[9px] font-medium text-[#bac6d3]">{position.sl}</b></div>
              <button type="button" onClick={() => setMenuId(menuId === position.id ? null : position.id)} aria-label="Position actions" className="grid size-6 place-items-center rounded-md text-[#76899f] hover:bg-white/[0.04] hover:text-white"><MoreHorizontal size={17} /></button>
              {menuId === position.id && <div className="absolute right-2 top-[54px] z-20 w-[132px] overflow-hidden rounded-xl border border-[#223443] bg-[#0a141e] p-1.5 shadow-[0_16px_44px_rgba(0,0,0,.5)]"><button type="button" onClick={() => setMenuId(null)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold text-[#c9d4df] hover:bg-white/[0.04]"><SlidersHorizontal size={13}/>Modify UI</button><button type="button" onClick={() => closePosition(position.id)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold text-[#ff818b] hover:bg-[#3b1720]"><X size={13}/>Close position</button></div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'orders' && <div className="grid h-[138px] place-items-center text-center text-[10px] font-medium text-[#607387]"><div><b className="block text-[#9fb0c2]">No pending orders</b><span className="mt-1 block">Pending-order UI will appear here</span></div></div>}

      {tab === 'history' && <div className="space-y-1.5 p-2">{!history.length ? <div className="grid h-[122px] place-items-center text-[10px] font-medium text-[#607387]">Closed demo positions will appear here</div> : history.map((item, index) => <div key={`${item.id}-${index}`} className="flex items-center justify-between rounded-xl border border-[#142533] bg-[#08121b] px-3 py-2.5"><div><strong className="text-[11px] text-[#f0f5f9]">{item.symbol}</strong><span className="ml-2 text-[8px] font-bold text-[#74879c]">{item.side} {item.volume}</span><p className="mt-1 text-[8px] text-[#63758a]">Closed {item.closedAt}</p></div><b className="text-[11px] text-[#31d79d]">{item.pnl}</b></div>)}</div>}
    </section>
  );
}
