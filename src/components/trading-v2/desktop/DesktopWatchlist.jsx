import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, GripVertical, ListFilter, Plus, Search, Settings2, Star } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import { instrumentPipSize } from '../../../utils/instrumentFormatting.js';

const PREFS_KEY = 'acg-trader-desktop-watchlist-v1';
const COLUMN_OPTIONS = [
  ['bid', 'Bid'],
  ['ask', 'Ask'],
  ['spread', 'Spread'],
  ['change', 'Day %'],
  ['high', 'High'],
  ['low', 'Low'],
  ['volume', 'Volume'],
];

function loadPrefs() {
  const fallback = { columns: ['bid', 'ask', 'change'] };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PREFS_KEY) || 'null');
    let columns = Array.isArray(stored?.columns)
      ? stored.columns.filter(item => COLUMN_OPTIONS.some(([id]) => id === item)).slice(0, 5)
      : fallback.columns;
    if (columns.length === 4 && columns.join(',') === 'bid,ask,spread,change') columns = fallback.columns;
    return { columns: columns.length ? columns : fallback.columns };
  } catch {
    return fallback;
  }
}

function displaySymbol(symbol = '') {
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol || '—';
}

function finite(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function dayChange(item) {
  return finite(item?.changePercent, item?.percentChange, item?.changePct, item?.dailyChangePercent, item?.dayChangePercent);
}

function dayHigh(item) {
  return finite(item?.dayHigh, item?.high, item?.sessionHigh);
}

function dayLow(item) {
  return finite(item?.dayLow, item?.low, item?.sessionLow);
}

function volume(item) {
  return finite(item?.volume, item?.dayVolume, item?.sessionVolume);
}

function cellValue(column, item) {
  if (column === 'bid') return item?.bid ?? '—';
  if (column === 'ask') return item?.ask ?? '—';
  if (column === 'spread') {
    const bid = finite(item?.bid);
    const ask = finite(item?.ask);
    const pip = instrumentPipSize(item);
    return bid != null && ask != null && Number.isFinite(pip) && pip > 0 ? `${(Math.abs(ask - bid) / pip).toFixed(1)}p` : '—';
  }
  if (column === 'change') {
    const value = dayChange(item);
    return value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
  if (column === 'high') return dayHigh(item) ?? '—';
  if (column === 'low') return dayLow(item) ?? '—';
  if (column === 'volume') {
    const value = volume(item);
    return value == null ? '—' : Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return '—';
}

function statusFor(item) {
  const label = item?.sessionOpen === false ? 'CLOSED' : item?.live ? 'LIVE' : item?.isStale ? 'STALE' : String(item?.marketState || 'WAITING').toUpperCase();
  const tone = item?.sessionOpen === false
    ? 'text-[#75889a]'
    : item?.live
      ? 'text-[#38d6a2]'
      : item?.isStale
        ? 'text-[#e7bd58]'
        : ['ERROR', 'SUBSCRIPTION_ERROR', 'DISCONNECTED'].includes(label)
          ? 'text-[#ff7882]'
          : 'text-[#687d92]';
  return { label, tone };
}

export default function DesktopWatchlist({
  markets = [],
  activeSymbol,
  onSelectSymbol = () => {},
  watchlists = null,
  mode = 'watchlist',
  searchRef,
}) {
  const [search, setSearch] = useState('');
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [dragSymbol, setDragSymbol] = useState(null);
  const rowRefs = useRef(new Map());

  useEffect(() => {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* optional preference */ }
  }, [prefs]);

  const watched = useMemo(() => new Set(watchlists?.activeSymbols || []), [watchlists?.activeSymbols]);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = mode === 'markets'
      ? markets
      : query
        ? markets
        : markets.filter(item => watched.has(item.symbol));
    if (!query) return base;
    return base.filter(item => `${item.symbol} ${item.displaySymbol || ''} ${item.name || ''} ${item.assetClass || ''}`.toLowerCase().includes(query));
  }, [markets, mode, search, watched]);

  const columns = prefs.columns;
  const gridTemplate = `minmax(118px,1.32fr) repeat(${columns.length},minmax(54px,.72fr)) 24px`;

  const toggleColumn = id => {
    setPrefs(current => {
      const exists = current.columns.includes(id);
      if (exists && current.columns.length <= 2) return current;
      if (!exists && current.columns.length >= 5) return current;
      return { ...current, columns: exists ? current.columns.filter(item => item !== id) : [...current.columns, id] };
    });
  };

  const createWatchlist = () => {
    const name = window.prompt('New watchlist name', 'My Watchlist');
    if (!name?.trim()) return;
    watchlists?.createList?.(name.trim());
    setListMenuOpen(false);
  };

  const onKeyDown = event => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !rows.length) return;
    event.preventDefault();
    const current = rows.findIndex(item => item.symbol === activeSymbol);
    const nextIndex = event.key === 'ArrowDown'
      ? Math.min(rows.length - 1, current < 0 ? 0 : current + 1)
      : Math.max(0, current < 0 ? 0 : current - 1);
    const symbol = rows[nextIndex]?.symbol;
    if (!symbol) return;
    onSelectSymbol(symbol);
    rowRefs.current.get(symbol)?.scrollIntoView?.({ block: 'nearest' });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div className="relative flex h-11 shrink-0 items-center justify-between border-b border-white/[0.08] px-2.5">
        <div className="min-w-0">
          {mode === 'markets' ? (
            <>
              <strong className="block text-[9px] font-extrabold tracking-[0.08em] text-[#dce7f1]">MARKETS</strong>
              <span className="mt-0.5 block text-[7px] text-[#5f7388]">{markets.length} instruments</span>
            </>
          ) : (
            <button type="button" onClick={() => setListMenuOpen(value => !value)} className="flex min-w-0 items-center gap-1.5 text-left">
              <span className="min-w-0">
                <strong className="block truncate text-[9px] font-extrabold tracking-[0.06em] text-[#dce7f1]">{watchlists?.activeList?.name || 'Favorites'}</strong>
                <span className="mt-0.5 block text-[7px] text-[#5f7388]">{watchlists?.activeSymbols?.length || 0} instruments</span>
              </span>
              <ChevronDown size={11} className="text-[#60758a]"/>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setColumnsOpen(value => !value)} className="grid size-6 place-items-center rounded text-[#65798d] hover:bg-white/[0.03] hover:text-white" title="Watchlist columns"><Settings2 size={12}/></button>
          <button type="button" onClick={() => searchRef?.current?.focus()} className="grid size-6 place-items-center rounded text-[#65798d] hover:bg-white/[0.03] hover:text-white" title="Search markets"><Search size={13}/></button>
        </div>

        {listMenuOpen && mode !== 'markets' && (
          <div className="absolute left-2 top-10 z-50 w-[210px] overflow-hidden rounded-md border border-white/[0.10] bg-[#0a0a0a] p-1 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
            {(watchlists?.workspace?.lists || []).map(list => (
              <button key={list.id} type="button" onClick={() => { watchlists?.setActiveListId?.(list.id); setListMenuOpen(false); }} className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] ${list.id === watchlists?.activeList?.id ? 'bg-[#0d1a22] text-[#63caff]' : 'text-[#aab7c3] hover:bg-white/[0.03]'}`}>
                <span className="truncate font-bold">{list.name}</span><span className="font-mono text-[7px] text-[#5f7388]">{list.symbols.length}</span>
              </button>
            ))}
            <button type="button" onClick={createWatchlist} className="mt-1 flex w-full items-center gap-1.5 border-t border-white/[0.06] px-2 pt-2 text-[8px] font-bold text-[#7fcfff]"><Plus size={11}/>New watchlist</button>
          </div>
        )}

        {columnsOpen && (
          <div className="absolute right-2 top-10 z-50 w-[176px] rounded-md border border-white/[0.10] bg-[#0a0a0a] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[7px] font-black uppercase tracking-[0.08em] text-[#60758a]"><ListFilter size={10}/>Columns</div>
            {COLUMN_OPTIONS.map(([id, label]) => {
              const active = columns.includes(id);
              return <button key={id} type="button" onClick={() => toggleColumn(id)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-[8px] ${active ? 'text-[#dce7ef]' : 'text-[#60758a]'}`}><span>{label}</span><span className={`size-2 rounded-sm border ${active ? 'border-[#53c7ff] bg-[#53c7ff]' : 'border-white/[0.12]'}`}/></button>;
            })}
            <div className="mt-1 border-t border-white/[0.06] px-2 pt-1 text-[6.5px] text-[#53677a]">Choose 2–5 columns</div>
          </div>
        )}
      </div>

      <div className="shrink-0 p-1.5">
        <div className="flex h-7 items-center gap-2 rounded-md border border-white/[0.07] bg-black/20 px-2 text-[#687c91]">
          <Search size={11}/>
          <input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search all markets" className="min-w-0 flex-1 bg-transparent text-[8px] text-[#c7d4e0] outline-none placeholder:text-[#52667a]"/>
          {search && <button type="button" onClick={() => setSearch('')} className="text-[7px] text-[#65798d]">Clear</button>}
        </div>
      </div>

      <div className="grid shrink-0 border-y border-white/[0.07] px-2 py-1.5 text-[6.5px] font-bold uppercase tracking-[0.07em] text-[#52667a]" style={{ gridTemplateColumns: gridTemplate }}>
        <span>Instrument</span>
        {columns.map(column => <span key={column} className="text-right">{COLUMN_OPTIONS.find(([id]) => id === column)?.[1] || column}</span>)}
        <span />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto outline-none" tabIndex={0}>
        {!rows.length && <div className="grid h-28 place-items-center px-4 text-center text-[8px] text-[#5f7388]">{search ? 'No markets match this search.' : 'This watchlist is empty. Search above and star instruments to add them.'}</div>}
        {rows.map(item => {
          const selected = item.symbol === activeSymbol;
          const isWatched = watchlists?.isWatched?.(item.symbol) === true;
          const { label: statusLabel, tone: statusTone } = statusFor(item);
          return (
            <div
              key={item.symbol}
              ref={node => { if (node) rowRefs.current.set(item.symbol, node); else rowRefs.current.delete(item.symbol); }}
              draggable={mode !== 'markets' && !search && isWatched}
              onDragStart={() => setDragSymbol(item.symbol)}
              onDragEnd={() => setDragSymbol(null)}
              onDragOver={event => { if (dragSymbol) event.preventDefault(); }}
              onDrop={() => { if (dragSymbol && dragSymbol !== item.symbol) watchlists?.moveSymbol?.(dragSymbol, item.symbol); setDragSymbol(null); }}
              className={`grid items-center border-b border-white/[0.05] px-2 py-0.5 transition ${selected ? 'border-l-2 border-[#53c7ff] bg-[#081118]' : 'hover:bg-white/[0.018]'} ${dragSymbol === item.symbol ? 'opacity-45' : ''}`}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <button type="button" onClick={() => onSelectSymbol(item.symbol)} className="flex min-w-0 items-center gap-1.5 py-1.5 text-left">
                {mode !== 'markets' && !search && isWatched && <GripVertical size={9} className="shrink-0 text-[#405263]"/>}
                <InstrumentAvatar instrument={item} size={21}/>
                <span className="min-w-0">
                  <b className="block truncate text-[10px] text-[#dce7f1]">{item.displaySymbol || displaySymbol(item.symbol)}</b>
                  <small className={`mt-0.5 block truncate text-[6.5px] ${statusTone}`}>{statusLabel}</small>
                </span>
              </button>

              {columns.map(column => {
                const change = column === 'change' ? dayChange(item) : null;
                return (
                  <button key={column} type="button" onClick={() => onSelectSymbol(item.symbol)} className={`truncate py-1.5 text-right font-mono text-[8.5px] tabular-nums ${column === 'change' && change != null ? (change >= 0 ? 'text-[#38d6a2]' : 'text-[#ff7882]') : column === 'bid' ? 'font-bold text-[#a9bac9]' : 'text-[#8397aa]'}`}>
                    {cellValue(column, item)}
                  </button>
                );
              })}

              <button type="button" onClick={() => watchlists?.toggleSymbol?.(item.symbol)} className={`grid size-6 place-items-center rounded ${isWatched ? 'text-[#f6c95d]' : 'text-[#53687b] hover:bg-white/[0.04] hover:text-[#f6c95d]'}`} title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={isWatched ? `Remove ${item.symbol} from watchlist` : `Add ${item.symbol} to watchlist`}><Star size={10} fill={isWatched ? 'currentColor' : 'none'}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
