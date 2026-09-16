import React, { useMemo, useState } from 'react';
import { X, Search, Bell, UserRound, Activity, Star, Clock3, Settings, HelpCircle, ShieldCheck } from 'lucide-react';
import IndicatorManager from './IndicatorManager.jsx';

function symbolLabel(symbol = '') {
  return symbol.length === 6 ? `${symbol.slice(0, 3)}/${symbol.slice(3)}` : symbol;
}

export default function FrontendSheet({
  type,
  onClose,
  markets = [],
  activeSymbol,
  onSelectSymbol = () => {},
  indicators = [],
  indicatorFavorites = [],
  onAddIndicator = () => {},
  onRemoveIndicator = () => {},
  onToggleIndicator = () => {},
  onUpdateIndicator = () => {},
  onToggleIndicatorFavorite = () => {},
}) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const filteredMarkets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter(item => String(item.symbol || '').toLowerCase().includes(q));
  }, [markets, query]);

  const titleMap = { search: 'Search markets', notifications: 'Notifications', profile: 'Account', instruments: 'Select instrument', indicators: 'Indicators', watchlist: 'Watchlist', markets: 'Markets', history: 'History', more: 'More' };
  const trigger = label => setMessage(`${label} is wired as a frontend state. Backend integration comes later.`);

  const renderMarkets = favoritesOnly => {
    const list = filteredMarkets.length ? filteredMarkets : markets;
    return <div className="space-y-1.5">{list.slice(0, favoritesOnly ? 8 : 20).map(item => <button key={item.symbol} type="button" onClick={() => { onSelectSymbol(item.symbol); onClose(); }} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${activeSymbol === item.symbol ? 'border-[#245071] bg-[#0d2536]' : 'border-[#182b3b] bg-[#08131c]'}`}><div><strong className="text-[12px] text-[#eef4f8]">{symbolLabel(item.symbol)}</strong><p className="mt-1 text-[9px] text-[#6f8296]">{item.name || 'Market instrument'}</p></div><div className="text-right"><b className="block text-[11px] text-[#dce5ec]">{item.bid ?? '—'}</b><span className="mt-1 block text-[8px] text-[#31d79d]">Live</span></div></button>)}</div>;
  };

  const actionRows = rows => <div className="space-y-1.5">{rows.map(([label, Icon]) => <button key={label} type="button" onClick={() => trigger(label)} className="flex w-full items-center justify-between rounded-xl border border-[#182b3a] bg-[#08131c] px-3 py-3 text-[11px] font-semibold text-[#cbd6df] active:bg-[#0c2130]"><span className="flex items-center gap-2"><Icon size={15} className="text-[#7b91a6]"/>{label}</span><span className="text-[#4e6579]">›</span></button>)}</div>;

  const isIndicators = type === 'indicators';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 px-2 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section onMouseDown={event => event.stopPropagation()} className={`${isIndicators ? 'max-h-[90dvh]' : 'max-h-[78dvh]'} mb-[max(8px,env(safe-area-inset-bottom))] w-full max-w-[444px] overflow-hidden rounded-[24px] border border-[#203343] bg-[#071019] shadow-[0_30px_90px_rgba(0,0,0,.65)]`}>
        <header className="flex items-center justify-between border-b border-[#152634] px-4 py-3.5"><div><h2 className="text-[15px] font-black text-[#f3f7fb]">{titleMap[type] || 'ACG Trader'}</h2><p className="mt-0.5 text-[9px] text-[#6e8195]">{isIndicators ? 'Technical studies · live chart' : 'Frontend preview'}</p></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl border border-[#1c2e3d] bg-[#0b1721] text-[#93a6b8]"><X size={17}/></button></header>
        <div className={`${isIndicators ? 'max-h-[calc(90dvh-70px)]' : 'max-h-[calc(78dvh-70px)]'} overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          {message && <div className="mb-3 rounded-xl border border-[#24445a] bg-[#0d2332] px-3 py-2.5 text-[9px] leading-4 text-[#a9c5d8]">{message}</div>}
          {(type === 'search' || type === 'instruments' || type === 'markets') && <><div className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-[#1b2d3d] bg-[#0a151f] px-3"><Search size={16} className="text-[#6f8295]"/><input autoFocus={type === 'search'} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search EURUSD, XAUUSD…" className="min-w-0 flex-1 bg-transparent text-[12px] text-[#eef4f8] outline-none placeholder:text-[#53677b]"/></div>{renderMarkets(false)}</>}
          {type === 'watchlist' && renderMarkets(true)}
          {type === 'notifications' && <div className="space-y-2"><button type="button" onClick={() => trigger('Price alerts')} className="w-full rounded-xl border border-[#1a2e3e] bg-[#0a151f] p-3 text-left"><div className="flex items-start gap-2"><Bell size={16} className="mt-0.5 text-[#55c7ff]"/><div><b className="text-[11px] text-[#edf3f7]">Price alert ready</b><p className="mt-1 text-[9px] leading-4 text-[#73869a]">Tap to open the frontend alert state.</p></div></div></button><button type="button" onClick={() => trigger('Risk notifications')} className="w-full rounded-xl border border-[#1a2e3e] bg-[#0a151f] p-3 text-left"><div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 text-[#42d7a2]"/><div><b className="text-[11px] text-[#edf3f7]">Risk status</b><p className="mt-1 text-[9px] leading-4 text-[#73869a]">Tap to inspect the frontend risk-notification state.</p></div></div></button></div>}
          {type === 'profile' && <div className="space-y-2"><div className="flex items-center gap-3 rounded-2xl border border-[#1a2d3d] bg-[#0a151f] p-3"><div className="grid size-11 place-items-center rounded-full bg-[#10283a] text-[#67ccff]"><UserRound size={21}/></div><div><b className="text-[12px] text-[#f0f5f9]">Scalper Prime</b><p className="mt-1 text-[9px] text-[#718398]">Demo account interface</p></div></div>{actionRows([['Account settings', Settings], ['Trading preferences', Activity], ['Help & support', HelpCircle]])}</div>}
          {type === 'indicators' && <IndicatorManager applied={indicators} favorites={indicatorFavorites} onAdd={onAddIndicator} onRemove={onRemoveIndicator} onToggleVisible={onToggleIndicator} onUpdate={onUpdateIndicator} onToggleFavorite={onToggleIndicatorFavorite} />}
          {type === 'history' && <div className="grid h-40 place-items-center text-center"><button type="button" onClick={() => trigger('Trade history')} className="rounded-2xl px-6 py-5"><Clock3 size={24} className="mx-auto text-[#526b80]"/><b className="mt-3 block text-[11px] text-[#a8b7c5]">No synced history yet</b><p className="mt-1 text-[9px] text-[#62768a]">Closed frontend demo positions appear in the Positions panel.</p></button></div>}
          {type === 'more' && actionRows([['Trading settings', Settings], ['Favorites', Star], ['Platform status', Activity], ['Help', HelpCircle]])}
        </div>
      </section>
    </div>
  );
}
