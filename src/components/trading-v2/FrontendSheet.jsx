import React, { useMemo, useState } from 'react';
import { X, Search, Bell, UserRound, Activity, Star, Clock3, Settings, HelpCircle, ShieldCheck } from 'lucide-react';

function symbolLabel(symbol = '') {
  return symbol.length === 6 ? `${symbol.slice(0, 3)}/${symbol.slice(3)}` : symbol;
}

const indicators = ['Moving Average', 'EMA', 'RSI', 'MACD', 'Bollinger Bands', 'ATR', 'Stochastic'];

export default function FrontendSheet({
  type,
  onClose,
  markets = [],
  activeSymbol,
  onSelectSymbol = () => {},
}) {
  const [query, setQuery] = useState('');
  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const filteredMarkets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter(item => String(item.symbol || '').toLowerCase().includes(q));
  }, [markets, query]);

  const titleMap = {
    search: 'Search markets',
    notifications: 'Notifications',
    profile: 'Account',
    instruments: 'Select instrument',
    indicators: 'Indicators',
    watchlist: 'Watchlist',
    markets: 'Markets',
    history: 'History',
    more: 'More',
  };

  const renderMarkets = favoritesOnly => {
    const list = filteredMarkets.length ? filteredMarkets : markets;
    return <div className="space-y-1.5">{list.slice(0, favoritesOnly ? 8 : 20).map(item => <button key={item.symbol} type="button" onClick={() => { onSelectSymbol(item.symbol); onClose(); }} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${activeSymbol === item.symbol ? 'border-[#245071] bg-[#0d2536]' : 'border-[#182b3b] bg-[#08131c]'}`}><div><strong className="text-[12px] text-[#eef4f8]">{symbolLabel(item.symbol)}</strong><p className="mt-1 text-[9px] text-[#6f8296]">{item.name || 'Market instrument'}</p></div><div className="text-right"><b className="block text-[11px] text-[#dce5ec]">{item.bid ?? '—'}</b><span className="mt-1 block text-[8px] text-[#31d79d]">Live</span></div></button>)}</div>;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 px-2 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section onMouseDown={event => event.stopPropagation()} className="mb-[max(8px,env(safe-area-inset-bottom))] max-h-[78dvh] w-full max-w-[444px] overflow-hidden rounded-[24px] border border-[#203343] bg-[#071019] shadow-[0_30px_90px_rgba(0,0,0,.65)]">
        <header className="flex items-center justify-between border-b border-[#152634] px-4 py-3.5"><div><h2 className="text-[15px] font-black text-[#f3f7fb]">{titleMap[type] || 'ACG Trader'}</h2><p className="mt-0.5 text-[9px] text-[#6e8195]">Frontend preview</p></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl border border-[#1c2e3d] bg-[#0b1721] text-[#93a6b8]"><X size={17}/></button></header>
        <div className="max-h-[calc(78dvh-70px)] overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(type === 'search' || type === 'instruments' || type === 'markets') && <><div className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-[#1b2d3d] bg-[#0a151f] px-3"><Search size={16} className="text-[#6f8295]"/><input autoFocus={type === 'search'} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search EURUSD, XAUUSD…" className="min-w-0 flex-1 bg-transparent text-[12px] text-[#eef4f8] outline-none placeholder:text-[#53677b]"/></div>{renderMarkets(false)}</>}

          {type === 'watchlist' && <>{renderMarkets(true)}</>}

          {type === 'notifications' && <div className="space-y-2"><div className="rounded-xl border border-[#1a2e3e] bg-[#0a151f] p-3"><div className="flex items-start gap-2"><Bell size={16} className="mt-0.5 text-[#55c7ff]"/><div><b className="text-[11px] text-[#edf3f7]">Price alert ready</b><p className="mt-1 text-[9px] leading-4 text-[#73869a]">Frontend alerts and broker notifications will appear here.</p></div></div></div><div className="rounded-xl border border-[#1a2e3e] bg-[#0a151f] p-3"><div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 text-[#42d7a2]"/><div><b className="text-[11px] text-[#edf3f7]">Risk status</b><p className="mt-1 text-[9px] leading-4 text-[#73869a]">No frontend risk warnings right now.</p></div></div></div></div>}

          {type === 'profile' && <div className="space-y-2"><div className="flex items-center gap-3 rounded-2xl border border-[#1a2d3d] bg-[#0a151f] p-3"><div className="grid size-11 place-items-center rounded-full bg-[#10283a] text-[#67ccff]"><UserRound size={21}/></div><div><b className="text-[12px] text-[#f0f5f9]">Scalper Prime</b><p className="mt-1 text-[9px] text-[#718398]">Demo account interface</p></div></div>{[['Account settings', Settings], ['Trading preferences', Activity], ['Help & support', HelpCircle]].map(([label, Icon]) => <button key={label} type="button" className="flex w-full items-center justify-between rounded-xl border border-[#172a39] bg-[#08131c] px-3 py-3 text-[11px] font-semibold text-[#cbd6df]"><span className="flex items-center gap-2"><Icon size={15} className="text-[#7b91a6]"/>{label}</span><span className="text-[#4e6579]">›</span></button>)}</div>}

          {type === 'indicators' && <div className="space-y-1.5">{indicators.map(name => { const active = selectedIndicators.includes(name); return <button key={name} type="button" onClick={() => setSelectedIndicators(current => active ? current.filter(item => item !== name) : [...current, name])} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${active ? 'border-[#245070] bg-[#0c2536]' : 'border-[#182b3a] bg-[#08131c]'}`}><span><b className="block text-[11px] text-[#eaf1f6]">{name}</b><small className="mt-1 block text-[8px] text-[#6c8094]">Frontend selection</small></span><span className={`grid size-5 place-items-center rounded-md text-[10px] ${active ? 'bg-[#1a4f6e] text-[#6ed0ff]' : 'bg-[#101d27] text-[#53697b]'}`}>{active ? '✓' : '+'}</span></button>})}</div>}

          {type === 'history' && <div className="grid h-40 place-items-center text-center"><div><Clock3 size={24} className="mx-auto text-[#526b80]"/><b className="mt-3 block text-[11px] text-[#a8b7c5]">No synced history yet</b><p className="mt-1 text-[9px] text-[#62768a]">Closed frontend demo positions appear in the Positions panel.</p></div></div>}

          {type === 'more' && <div className="space-y-1.5">{[['Trading settings', Settings], ['Favorites', Star], ['Platform status', Activity], ['Help', HelpCircle]].map(([label, Icon]) => <button key={label} type="button" className="flex w-full items-center justify-between rounded-xl border border-[#182b3a] bg-[#08131c] px-3 py-3 text-[11px] font-semibold text-[#cbd6df]"><span className="flex items-center gap-2"><Icon size={15} className="text-[#7b91a6]"/>{label}</span><span className="text-[#4e6579]">›</span></button>)}</div>}
        </div>
      </section>
    </div>
  );
}
