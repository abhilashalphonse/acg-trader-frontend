import React, { useMemo, useState } from 'react';
import { ChevronLeft, Search, Star } from 'lucide-react';
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
    <section className="fixed inset-0 z-[110] flex h-dvh w-full min-h-0 flex-col overflow-hidden bg-[#050505] text-[#f4f7fa]">
      <header className="shrink-0 border-b border-white/[0.07] bg-[#070707] pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-2 px-3">
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl text-[#c4ccd4] active:bg-white/[0.06]" aria-label="Back to chart">
            <ChevronLeft size={22} strokeWidth={2}/>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-black tracking-[-0.035em] text-white">Markets</h2>
            <p className="mt-0.5 text-[9px] font-medium text-[#737e89]">{markets.length} instruments · tap one to open its chart</p>
          </div>
          <span className="rounded-lg border border-white/[0.07] bg-[#0d0f12] px-2 py-1 text-[8px] font-bold text-[#84909c]">{watched.size} saved</span>
        </div>

        <div className="grid grid-cols-2 px-3">
          {[['markets','Markets'],['watchlist','Watchlist']].map(([id,label]) => (
            <button key={id} type="button" onClick={() => { setTab(id); setLimit(60); }} className={`relative h-11 text-[10px] font-black uppercase tracking-[0.08em] ${tab === id ? 'text-white' : 'text-[#697580]'}`}>
              {label}
              {tab === id && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-[#195be1]"/>}
            </button>
          ))}
        </div>
      </header>

      <div className="shrink-0 bg-[#050505] px-3 pb-2 pt-3">
        <label className="flex h-11 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#0d0f12] px-3">
          <Search size={16} className="shrink-0 text-[#7c8792]"/>
          <input
            value={query}
            onChange={event => { setQuery(event.target.value); setLimit(60); }}
            placeholder={tab === 'watchlist' ? 'Search watchlist' : 'Search markets'}
            className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-[#eef2f6] outline-none placeholder:text-[#59636d]"
          />
        </label>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GROUPS.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => { setGroup(item); setLimit(60); }}
              className={`shrink-0 rounded-lg border px-3 py-2 text-[9px] font-bold transition ${group === item ? 'border-[#195be1]/60 bg-[#11151d] text-white' : 'border-white/[0.06] bg-[#090a0c] text-[#76818c]'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(12px,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!list.length && (
          <div className="grid min-h-52 place-items-center text-center">
            <div>
              <b className="text-[12px] text-[#b3bdc6]">{tab === 'watchlist' ? 'No matching watchlist instruments' : 'No instruments found'}</b>
              <p className="mt-1.5 text-[10px] text-[#66717c]">Try another search or market group.</p>
            </div>
          </div>
        )}

        {list.map(item => {
          const active = String(item.symbol) === String(activeSymbol);
          const favorite = watched.has(item.symbol);
          return (
            <div key={item.symbol} className={`relative flex min-h-[64px] items-center border-b border-white/[0.055] ${active ? 'bg-[#0b0d11]' : 'bg-transparent'}`}>
              {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[#195be1]" aria-hidden="true"/>}
              <button type="button" onClick={() => select(item.symbol)} className="flex min-w-0 flex-1 items-center justify-between py-3 pl-2 text-left">
                <div className="flex min-w-0 items-center gap-3">
                  <InstrumentAvatar instrument={item} size={30}/>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-[12px] font-black text-[#f2f5f8]">{item.displaySymbol || symbolLabel(item.symbol)}</b>
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.05em] text-[#6f7b87]">{marketGroup(item)}</span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-[#68737e]">{item.name || item.symbol}</p>
                  </div>
                </div>
                <div className="ml-3 text-right">
                  <b className="block font-mono text-[11px] font-bold tabular-nums text-[#dce3e9]">{item.subscribed ? (item.bid ?? '—') : '—'}</b>
                  <span className={`mt-1 block text-[8px] font-semibold ${item.live ? 'text-[#31d79d]' : 'text-[#68737e]'}`}>{item.sessionOpen === false ? 'Closed' : item.live ? 'Live' : item.subscribed ? 'Waiting' : 'Quote on open'}</span>
                </div>
              </button>
              <button type="button" onClick={() => watchlists?.toggleSymbol?.(item.symbol)} className={`grid size-11 shrink-0 place-items-center ${favorite ? 'text-[#f6c95d]' : 'text-[#687580]'}`} aria-label={favorite ? 'Remove from watchlist' : 'Add to watchlist'}>
                <Star size={17} fill={favorite ? 'currentColor' : 'none'}/>
              </button>
            </div>
          );
        })}

        {source.length > list.length && (
          <button type="button" onClick={() => setLimit(current => current + 60)} className="h-12 w-full border-b border-white/[0.06] text-[9px] font-bold text-[#195be1]">
            Show more · {source.length - list.length} remaining
          </button>
        )}
      </div>
    </section>
  );
}
