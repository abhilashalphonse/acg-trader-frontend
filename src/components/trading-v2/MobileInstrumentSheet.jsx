import React, { useMemo, useState } from 'react';
import { Search, Star, X } from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';

function symbolLabel(symbol = '') {
  const normalized = String(symbol || '').toUpperCase();
  return normalized.length === 6 && /^[A-Z]+$/.test(normalized)
    ? `${normalized.slice(0, 3)}/${normalized.slice(3)}`
    : normalized;
}

function marketGroup(item) {
  const assetClass = String(item?.assetClass || '').toUpperCase();
  if (assetClass === 'FOREX') return 'Forex';
  if (assetClass === 'METAL') return 'Metals';
  if (assetClass === 'INDEX') return 'Indices';
  if (assetClass === 'EQUITY') return 'Stocks';
  if (assetClass === 'CRYPTO') return 'Crypto';
  if (assetClass === 'ENERGY' || assetClass === 'OTHER') return 'Commodities';
  return 'Other';
}

const GROUPS = ['All', 'Forex', 'Metals', 'Commodities', 'Indices', 'Stocks', 'Crypto'];

export default function MobileInstrumentSheet({
  markets = [],
  activeSymbol,
  watchlists = null,
  onSelectSymbol = () => {},
  onClose = () => {},
}) {
  const [tab, setTab] = useState('markets');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('Forex');
  const [limit, setLimit] = useState(60);
  const watched = useMemo(() => new Set(watchlists?.activeSymbols || []), [watchlists?.activeSymbols]);

  const source = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter(item => {
      if (tab === 'watchlist' && !watched.has(item.symbol)) return false;
      const itemGroup = marketGroup(item);
      if (group !== 'All' && itemGroup !== group) return false;
      if (!q) return true;
      return `${item.symbol || ''} ${item.displaySymbol || ''} ${item.name || ''} ${itemGroup}`.toLowerCase().includes(q);
    });
  }, [group, markets, query, tab, watched]);

  const list = source.slice(0, limit);

  const select = symbol => {
    onSelectSymbol(symbol);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 px-2 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section onMouseDown={event => event.stopPropagation()} className="mb-[max(8px,env(safe-area-inset-bottom))] flex h-[84dvh] w-full max-w-[444px] min-h-0 flex-col overflow-hidden rounded-t-[18px] border border-white/[0.08] bg-black shadow-[0_30px_90px_rgba(0,0,0,.7)]">
        <div className="mx-auto mt-1.5 h-1 w-9 shrink-0 rounded-full bg-white/[0.14]" aria-hidden="true" />
        <header className="shrink-0 border-b border-white/[0.06] bg-[#080808] px-3 pt-3">
          <div className="flex items-start justify-between gap-3 pb-2.5">
            <div><h2 className="text-[17px] font-black tracking-[-0.035em] text-[#f3f7fb]">Markets</h2><p className="mt-0.5 text-[8px] text-[#667b8e]">Switch instrument without leaving the chart.</p></div>
            <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-md border border-white/[0.06] bg-[#101010] text-[#91a0ad]" aria-label="Close markets"><X size={15}/></button>
          </div>
          <div className="grid grid-cols-2">
            {[['markets','Markets'],['watchlist','Watchlist']].map(([id,label]) => (
              <button key={id} type="button" onClick={() => { setTab(id); setLimit(60); }} className={`relative h-9 text-[8px] font-black uppercase tracking-[0.07em] ${tab === id ? 'text-[#e8f2f8]' : 'text-[#62778a]'}`}>
                {label}{tab === id && <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-[#53c7ff]"/>}
              </button>
            ))}
          </div>
        </header>

        <div className="shrink-0 px-3 pt-2">
          <div className="flex h-9 items-center gap-2 border-y border-white/[0.08] px-1"><Search size={14} className="text-[#6f8295]"/><input value={query} onChange={event => { setQuery(event.target.value); setLimit(60); }} placeholder="Search markets..." className="min-w-0 flex-1 bg-transparent text-[10px] text-[#eef4f8] outline-none placeholder:text-[#53677b]"/></div>
          <div className="flex gap-1 overflow-x-auto border-b border-white/[0.08] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GROUPS.map(item => <button key={item} type="button" onClick={() => { setGroup(item); setLimit(60); }} className={`shrink-0 border-b-2 px-2 py-1 text-[7px] font-black ${group === item ? 'border-[#53c7ff] text-[#dce9f2]' : 'border-transparent text-[#60758a]'}`}>{item}</button>)}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!list.length && <div className="grid h-32 place-items-center border-b border-white/[0.08] text-center"><div><b className="text-[10px] text-[#9eafbe]">{tab === 'watchlist' ? 'No matching watchlist instruments' : 'No instruments found'}</b><p className="mt-1 text-[8px] text-[#5d7185]">Try another search or market group.</p></div></div>}
          {list.map(item => {
            const active = String(item.symbol) === String(activeSymbol);
            const favorite = watched.has(item.symbol);
            return (
              <div key={item.symbol} className={`flex items-center border-b border-white/[0.08] ${active ? 'bg-[#080808]' : 'bg-black'}`}>
                <button type="button" onClick={() => select(item.symbol)} className="flex min-w-0 flex-1 items-center justify-between py-2.5 text-left">
                  <div className="flex min-w-0 items-center gap-2.5"><InstrumentAvatar instrument={item} size={26}/><div className="min-w-0"><div className="flex items-center gap-2"><b className="text-[11px] text-[#f1f5f8]">{item.displaySymbol || symbolLabel(item.symbol)}</b><span className="text-[6px] font-black uppercase text-[#60758a]">{marketGroup(item)}</span></div><p className="mt-1 truncate text-[7px] text-[#54697d]">{item.name || item.symbol}</p></div></div>
                  <div className="ml-3 text-right"><b className="block font-mono text-[10px] text-[#dce5ec]">{item.subscribed ? (item.bid ?? '—') : '—'}</b><span className={`mt-1 block text-[7px] ${item.live ? 'text-[#31d79d]' : 'text-[#60758a]'}`}>{item.sessionOpen === false ? 'Closed' : item.live ? 'Live' : item.subscribed ? 'Waiting' : 'Quote on open'}</span></div>
                </button>
                <button type="button" onClick={() => watchlists?.toggleSymbol?.(item.symbol)} className={`grid size-9 shrink-0 place-items-center ${favorite ? 'text-[#f6c95d]' : 'text-[#728394]'}`} aria-label={favorite ? 'Remove from watchlist' : 'Add to watchlist'}><Star size={14} fill={favorite ? 'currentColor' : 'none'}/></button>
              </div>
            );
          })}
          {source.length > list.length && <button type="button" onClick={() => setLimit(current => current + 60)} className="h-10 w-full border-b border-white/[0.08] text-[8px] font-bold text-[#61caff]">Show more · {source.length - list.length} remaining</button>}
        </div>
      </section>
    </div>
  );
}
