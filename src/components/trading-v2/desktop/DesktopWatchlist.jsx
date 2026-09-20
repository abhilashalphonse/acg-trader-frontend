import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, ListFilter, Plus, Search, Settings2, Star } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import { instrumentPipSize } from '../../../utils/instrumentFormatting.js';

const PREFS_KEY = 'acg-trader-desktop-watchlist-v1';
const RECENT_KEY = 'acg-trader-recent-markets-v1';
const COLUMN_OPTIONS = [
  ['bid', 'Bid'],
  ['ask', 'Ask'],
  ['spread', 'Spread'],
  ['change', 'Day %'],
  ['high', 'High'],
  ['low', 'Low'],
  ['volume', 'Volume'],
];
const MARKET_VIEWS = [
  ['all', 'All'],
  ['popular', 'Popular'],
  ['movers', 'Movers'],
  ['active', 'Active'],
  ['recent', 'Recent'],
];
const CATEGORY_OPTIONS = [
  ['all', 'All'],
  ['forex', 'Forex'],
  ['metals', 'Metals'],
  ['indices', 'Indices'],
  ['crypto', 'Crypto'],
  ['stocks', 'Stocks'],
];
const POPULAR_SYMBOLS = ['EURUSD','GBPUSD','USDJPY','XAUUSD','XAGUSD','BTCUSD','ETHUSD','US100','NAS100','US30','SPX500','GER40','UK100'];

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

function loadRecent() {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) ? value.filter(Boolean).slice(0, 12) : [];
  } catch {
    return [];
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
function dayHigh(item) { return finite(item?.dayHigh, item?.high, item?.sessionHigh); }
function dayLow(item) { return finite(item?.dayLow, item?.low, item?.sessionLow); }
function volume(item) { return finite(item?.volume, item?.dayVolume, item?.sessionVolume); }

function assetCategory(item) {
  const raw = String(item?.assetClass || item?.category || '').toUpperCase();
  if (['FOREX','FX'].includes(raw)) return 'forex';
  if (['METAL','METALS'].includes(raw)) return 'metals';
  if (['INDEX','INDICES'].includes(raw)) return 'indices';
  if (raw === 'CRYPTO') return 'crypto';
  if (['EQUITY','STOCK','STOCKS'].includes(raw)) return 'stocks';
  return 'other';
}

function categoryLabel(item) {
  const category = assetCategory(item);
  return category === 'forex' ? 'Forex'
    : category === 'metals' ? 'Metal'
      : category === 'indices' ? 'Index'
        : category === 'crypto' ? 'Crypto'
          : category === 'stocks' ? 'Stock'
            : String(item?.assetClass || 'Market');
}

function quoteReady(item) {
  const bid = finite(item?.bid);
  const ask = finite(item?.ask);
  return bid != null && ask != null && bid > 0 && ask > 0 && ask >= bid;
}

function cellValue(column, item) {
  if (!quoteReady(item) && ['bid','ask','spread'].includes(column)) return '—';
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
  if (item?.sessionOpen === false) return { label: 'CLOSED', tone: 'text-[#75889a]' };
  if (!quoteReady(item)) {
    const state = String(item?.marketState || '').toUpperCase();
    if (['ERROR','SUBSCRIPTION_ERROR','DISCONNECTED','DISABLED'].includes(state)) return { label: 'QUOTE UNAVAILABLE', tone: 'text-[#FF6F7A]' };
    return { label: 'REFRESHING', tone: 'text-[#6f8599]' };
  }
  if (item?.isStale) return { label: 'STALE', tone: 'text-[#E7BD58]' };
  return { label: 'LIVE', tone: 'text-[#42D7A1]' };
}

function sortValue(item, key) {
  if (key === 'symbol') return String(item?.symbol || '');
  if (key === 'change') return dayChange(item);
  if (key === 'volume') return volume(item);
  if (key === 'spread') {
    const bid = finite(item?.bid);
    const ask = finite(item?.ask);
    const pip = instrumentPipSize(item);
    return bid != null && ask != null && pip > 0 ? Math.abs(ask - bid) / pip : null;
  }
  if (key === 'bid') return finite(item?.bid);
  if (key === 'ask') return finite(item?.ask);
  return null;
}

function SortLabel({ id, label, sort }) {
  const active = sort.key === id;
  return <span className="inline-flex items-center justify-end gap-0.5">{label}{active ? (sort.direction === 'asc' ? <ChevronUp size={8}/> : <ChevronDown size={8}/>) : null}</span>;
}

export default function DesktopWatchlist({
  markets = [],
  activeSymbol,
  onSelectSymbol = () => {},
  watchlists = null,
  mode = 'watchlist',
  searchRef,
  onNotice = () => {},
}) {
  const [search, setSearch] = useState('');
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [dragSymbol, setDragSymbol] = useState(null);
  const [category, setCategory] = useState('all');
  const [marketView, setMarketView] = useState('all');
  const [sort, setSort] = useState({ key: 'symbol', direction: 'asc' });
  const [recent, setRecent] = useState(loadRecent);
  const rowRefs = useRef(new Map());

  useEffect(() => {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* optional preference */ }
  }, [prefs]);

  useEffect(() => {
    if (!activeSymbol) return;
    setRecent(current => {
      const next = [activeSymbol, ...current.filter(symbol => symbol !== activeSymbol)].slice(0, 12);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  }, [activeSymbol]);

  const watched = useMemo(() => new Set(watchlists?.activeSymbols || []), [watchlists?.activeSymbols]);
  const availableCategories = useMemo(() => {
    const present = new Set(markets.map(assetCategory));
    return CATEGORY_OPTIONS.filter(([id]) => id === 'all' || present.has(id));
  }, [markets]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    let base = mode === 'markets'
      ? markets
      : query
        ? markets
        : markets.filter(item => watched.has(item.symbol));

    if (mode === 'markets' && category !== 'all') base = base.filter(item => assetCategory(item) === category);

    if (query) {
      base = base.filter(item => `${item.symbol} ${item.displaySymbol || ''} ${item.name || ''} ${item.assetClass || ''}`.toLowerCase().includes(query));
    }

    if (mode === 'markets' && !query) {
      if (marketView === 'popular') {
        const rank = new Map(POPULAR_SYMBOLS.map((symbol, index) => [symbol, index]));
        base = base.filter(item => rank.has(String(item.symbol || '').toUpperCase()))
          .sort((a, b) => rank.get(String(a.symbol).toUpperCase()) - rank.get(String(b.symbol).toUpperCase()));
      } else if (marketView === 'movers') {
        base = base.filter(item => dayChange(item) != null)
          .sort((a, b) => Math.abs(dayChange(b)) - Math.abs(dayChange(a)));
      } else if (marketView === 'active') {
        base = base.filter(item => volume(item) != null)
          .sort((a, b) => volume(b) - volume(a));
      } else if (marketView === 'recent') {
        const rank = new Map(recent.map((symbol, index) => [symbol, index]));
        base = base.filter(item => rank.has(item.symbol)).sort((a, b) => rank.get(a.symbol) - rank.get(b.symbol));
      }
    }

    if (mode !== 'markets' || marketView === 'all' || query) {
      const direction = sort.direction === 'asc' ? 1 : -1;
      base = [...base].sort((a, b) => {
        const left = sortValue(a, sort.key);
        const right = sortValue(b, sort.key);
        if (left == null && right == null) return String(a.symbol).localeCompare(String(b.symbol));
        if (left == null) return 1;
        if (right == null) return -1;
        return typeof left === 'string' ? left.localeCompare(right) * direction : (left - right) * direction;
      });
    }

    return base;
  }, [category, marketView, markets, mode, recent, search, sort, watched]);

  const columns = mode === 'markets' ? ['bid','ask','change'] : prefs.columns;
  const gridTemplate = `minmax(118px,1.32fr) repeat(${columns.length},minmax(54px,.72fr)) 24px`;

  const toggleColumn = id => {
    setPrefs(current => {
      const exists = current.columns.includes(id);
      if (exists && current.columns.length <= 2) return current;
      if (!exists && current.columns.length >= 5) return current;
      return { ...current, columns: exists ? current.columns.filter(item => item !== id) : [...current.columns, id] };
    });
  };

  const changeSort = key => setSort(current => current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: key === 'symbol' ? 'asc' : 'desc' });

  const createWatchlist = () => {
    const name = window.prompt('New watchlist name', 'My Watchlist');
    if (!name?.trim()) return;
    watchlists?.createList?.(name.trim());
    setListMenuOpen(false);
  };

  const selectInstrument = symbol => {
    onSelectSymbol(symbol);
    setRecent(current => {
      const next = [symbol, ...current.filter(item => item !== symbol)].slice(0, 12);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  };

  const toggleWatch = item => {
    const watchedNow = watchlists?.isWatched?.(item.symbol) === true;
    watchlists?.toggleSymbol?.(item.symbol);
    onNotice(`${item.displaySymbol || displaySymbol(item.symbol)} ${watchedNow ? 'removed from' : 'added to'} watchlist`);
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
    selectInstrument(symbol);
    rowRefs.current.get(symbol)?.scrollIntoView?.({ block: 'nearest' });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden" onKeyDown={onKeyDown}>
      <div className="relative flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-2.5">
        <div className="min-w-0">
          {mode === 'markets' ? (
            <>
              <strong className="block text-[11px] font-bold tracking-[0.05em] text-[#E6EDF3]">MARKETS</strong>
              <span className="mt-0.5 block text-[8px] text-[#6F8191]">{markets.length} instruments · discover &amp; trade</span>
            </>
          ) : (
            <button type="button" onClick={() => setListMenuOpen(value => !value)} className="flex min-w-0 items-center gap-1.5 text-left">
              <span className="min-w-0">
                <strong className="block truncate text-[11px] font-bold tracking-[0.04em] text-[#E6EDF3]">{watchlists?.activeList?.name || 'Favorites'}</strong>
                <span className="mt-0.5 block text-[7px] text-[#6F8191]">{watchlists?.activeSymbols?.length || 0} instruments</span>
              </span>
              <ChevronDown size={11} className="text-[#6F8191]"/>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {mode !== 'markets' && <button type="button" onClick={() => setColumnsOpen(value => !value)} className="grid size-6 place-items-center rounded text-[#6F8191] hover:bg-white/[0.03] hover:text-white" title="Watchlist columns"><Settings2 size={12}/></button>}
          <button type="button" onClick={() => searchRef?.current?.focus()} className="grid size-6 place-items-center rounded text-[#6F8191] hover:bg-white/[0.03] hover:text-white" title="Search markets"><Search size={13}/></button>
        </div>

        {listMenuOpen && mode !== 'markets' && (
          <div className="absolute left-2 top-10 z-50 w-[210px] overflow-hidden rounded-md border border-white/[0.10] bg-[#0C1013] p-1 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
            {(watchlists?.workspace?.lists || []).map(list => (
              <button key={list.id} type="button" onClick={() => { watchlists?.setActiveListId?.(list.id); setListMenuOpen(false); }} className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] ${list.id === watchlists?.activeList?.id ? 'bg-[#0d1a22] text-[#63caff]' : 'text-[#aab7c3] hover:bg-white/[0.03]'}`}>
                <span className="truncate font-bold">{list.name}</span><span className="font-mono text-[7px] text-[#6F8191]">{list.symbols.length}</span>
              </button>
            ))}
            <button type="button" onClick={createWatchlist} className="mt-1 flex w-full items-center gap-1.5 border-t border-white/[0.06] px-2 pt-2 text-[8px] font-bold text-[#7fcfff]"><Plus size={11}/>New watchlist</button>
          </div>
        )}

        {columnsOpen && mode !== 'markets' && (
          <div className="absolute right-2 top-10 z-50 w-[176px] rounded-md border border-white/[0.10] bg-[#0C1013] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[7px] font-black uppercase tracking-[0.08em] text-[#6F8191]"><ListFilter size={10}/>Columns</div>
            {COLUMN_OPTIONS.map(([id, label]) => {
              const active = columns.includes(id);
              return <button key={id} type="button" onClick={() => toggleColumn(id)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-[8px] ${active ? 'text-[#dce7ef]' : 'text-[#6F8191]'}`}><span>{label}</span><span className={`size-2 rounded-sm border ${active ? 'border-[#53c7ff] bg-[#53c7ff]' : 'border-white/[0.12]'}`}/></button>;
            })}
            <div className="mt-1 border-t border-white/[0.06] px-2 pt-1 text-[6.5px] text-[#53677a]">Choose 2–5 columns</div>
          </div>
        )}
      </div>

      {mode === 'markets' && (
        <>
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {availableCategories.map(([id, label]) => <button key={id} type="button" onClick={() => setCategory(id)} className={`h-7 shrink-0 rounded px-2.5 text-[8px] font-semibold ${category === id ? 'bg-[#0d1a22] text-[#63caff]' : 'text-[#6F8191] hover:bg-white/[0.03] hover:text-white'}`}>{label}</button>)}
          </div>
          <div className="flex shrink-0 gap-1 overflow-x-auto px-1.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MARKET_VIEWS.map(([id, label]) => <button key={id} type="button" onClick={() => setMarketView(id)} className={`h-7 shrink-0 rounded border px-2.5 text-[8px] font-semibold ${marketView === id ? 'border-[#315b72] bg-[#0d1a22] text-[#63caff]' : 'border-white/[0.06] text-[#6F8191]'}`}>{label}</button>)}
          </div>
        </>
      )}

      <div className="shrink-0 p-1.5">
        <div className="flex h-8 items-center gap-2 rounded-md border border-white/[0.06] bg-black/20 px-2 text-[#687c91]">
          <Search size={11}/>
          <input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder={mode === 'markets' ? 'Search symbol or market' : 'Search all markets'} className="min-w-0 flex-1 bg-transparent text-[9px] text-[#E6EDF3] outline-none placeholder:text-[#6F8191]"/>
          {search && <button type="button" onClick={() => setSearch('')} className="text-[7px] text-[#6F8191]">Clear</button>}
        </div>
      </div>

      <div className="grid shrink-0 border-y border-white/[0.06] px-2 py-1.5 text-[8px] font-semibold uppercase tracking-[0.07em] text-[#6F8191]" style={{ gridTemplateColumns: gridTemplate }}>
        <button type="button" onClick={() => changeSort('symbol')} className="text-left"><SortLabel id="symbol" label="Instrument" sort={sort}/></button>
        {columns.map(column => (
          <button key={column} type="button" onClick={() => changeSort(column)} className="text-right">
            <SortLabel id={column} label={COLUMN_OPTIONS.find(([id]) => id === column)?.[1] || column} sort={sort}/>
          </button>
        ))}
        <span />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable] [scrollbar-width:thin]" tabIndex={0}>
        {!rows.length && <div className="grid h-28 place-items-center px-4 text-center text-[8px] text-[#6F8191]">{search ? 'No markets match this search.' : marketView === 'recent' ? 'Recently viewed markets will appear here.' : 'No instruments are available for this filter.'}</div>}
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
              className={`grid items-center border-b border-white/[0.06] px-2 py-1 transition ${selected ? 'border-l-[3px] border-[#53c7ff] bg-[#08131a]' : 'border-l-[3px] border-transparent hover:bg-white/[0.018]'} ${dragSymbol === item.symbol ? 'opacity-45' : ''}`}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <button type="button" onClick={() => selectInstrument(item.symbol)} className="flex min-w-0 items-center gap-1.5 py-2 text-left">
                {mode !== 'markets' && !search && isWatched && <GripVertical size={9} className="shrink-0 text-[#44515D]"/>}
                <InstrumentAvatar instrument={item} size={21}/>
                <span className="min-w-0">
                  <b className="block truncate text-[11px] font-semibold text-[#E6EDF3]">{item.displaySymbol || displaySymbol(item.symbol)}</b>
                  <small className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[7.5px]">
                    {mode === 'markets' && <span className="truncate text-[#6F8191]">{categoryLabel(item)}</span>}
                    {mode === 'markets' && <span className="text-[#44515D]">·</span>}
                    <span className={statusTone}>{statusLabel}</span>
                  </small>
                </span>
              </button>

              {columns.map(column => {
                const change = column === 'change' ? dayChange(item) : null;
                return (
                  <button key={column} type="button" onClick={() => selectInstrument(item.symbol)} className={`truncate py-1.5 text-right font-mono text-[9.5px] tabular-nums ${column === 'change' && change != null ? (change >= 0 ? 'text-[#42D7A1]' : 'text-[#FF6F7A]') : column === 'bid' ? 'font-bold text-[#A1AFBC]' : 'text-[#A1AFBC]'}`}>
                    {cellValue(column, item)}
                  </button>
                );
              })}

              <button type="button" onClick={() => toggleWatch(item)} className={`grid size-6 place-items-center rounded ${isWatched ? 'text-[#f6c95d]' : 'text-[#6F8191] hover:bg-white/[0.04] hover:text-[#f6c95d]'}`} title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={isWatched ? `Remove ${item.symbol} from watchlist` : `Add ${item.symbol} to watchlist`}><Star size={10} fill={isWatched ? 'currentColor' : 'none'}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
