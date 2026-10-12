import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, ListFilter, MoreHorizontal, Plus, Search, Settings2, Star, X } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import { formatInstrumentPrice, instrumentPipSize } from '../../../utils/instrumentFormatting.js';
import { isChartOrderAuditEnabled } from '../../../utils/chartOrderPresentation.js';
import { selectV4Markets, v4MarketPricePresentation } from '../../../utils/v4MarketsDiscovery.js';
import { marketCategoryId, marketVenue } from '../../../utils/marketClassification.js';
import { commodityDisplaySymbol, commoditySearchTerms, commoditySubgroup, isCommodityInstrument } from '../../../utils/commodityPresentation.js';

const V4_MARKETS_AUDIT = isChartOrderAuditEnabled(
  import.meta.env.VITE_ACG_EXECUTION_V4_ENABLED,
  typeof window !== 'undefined' ? window.location.search : '',
);
const PREFS_KEY = 'acg-trader-desktop-watchlist-v1';
const RECENT_KEY = 'acg-trader-recent-markets-v1';
const COLUMN_OPTIONS = [
  ['last', 'Last'],
  ['bid', 'Bid'],
  ['ask', 'Ask'],
  ['spread', 'Spread'],
  ['changeValue', 'Chg'],
  ['change', 'Chg%'],
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
const V4_MARKET_CATEGORIES = [
  ['all','All'],
  ['forex','Forex'],
  ['commodities','Commodities'],
  ['stocks','Stocks'],
  ['crypto','Crypto'],
];
const CATEGORY_OPTIONS = [
  ['all', 'All'],
  ['forex', 'Forex'],
  ['commodities', 'Commodities'],
  ['indices', 'Indices'],
  ['india', 'India'],
  ['crypto', 'Crypto'],
  ['stocks', 'Stocks'],
];
const COMMODITY_VIEWS = [
  ['all', 'All'],
  ['metals', 'Metals'],
  ['energy', 'Energy'],
];
const POPULAR_SYMBOLS = ['EURUSD','GBPUSD','USDJPY','XAUUSD','XAGUSD','BTCUSD','ETHUSD','US100','NAS100','US30','SPX500','GER40','UK100','RELIANCE','TCS','HDFCBANK','INFY','SBIN'];

function loadPrefs() {
  const fallback = { columns: ['last', 'changeValue', 'change'] };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PREFS_KEY) || 'null');
    let columns = Array.isArray(stored?.columns)
      ? stored.columns.filter(item => COLUMN_OPTIONS.some(([id]) => id === item)).slice(0, 5)
      : fallback.columns;
    if ((columns.length === 4 && columns.join(',') === 'bid,ask,spread,change') || columns.join(',') === 'bid,ask,change') columns = fallback.columns;
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
    if (value === null || value === undefined || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function dayChange(item) {
  return finite(item?.changePercent, item?.percentChange, item?.changePct, item?.dailyChangePercent, item?.dayChangePercent);
}
function dayChangeValue(item) {
  return finite(item?.change, item?.changeValue, item?.dailyChange, item?.dayChange);
}
function dayHigh(item) { return finite(item?.dayHigh, item?.high, item?.sessionHigh); }
function dayLow(item) { return finite(item?.dayLow, item?.low, item?.sessionLow); }
function volume(item) { return finite(item?.volume, item?.dayVolume, item?.sessionVolume); }

function assetCategory(item) {
  if (isCommodityInstrument(item)) return 'commodities';
  return marketCategoryId(item);
}

function categoryLabel(item) {
  const category = assetCategory(item);
  if (category === 'commodities') {
    const subgroup = commoditySubgroup(item);
    return subgroup === 'metals' ? 'Metal' : subgroup === 'energy' ? 'Energy' : 'Agriculture';
  }
  return marketVenue(item) || (category === 'forex' ? 'Forex'
    : category === 'indices' ? 'Index'
      : category === 'crypto' ? 'Crypto'
        : category === 'stocks' ? 'Stock'
          : String(item?.assetClass || 'Market'));
}

function quoteReady(item) {
  const bid = finite(item?.bid);
  const ask = finite(item?.ask);
  return bid != null && ask != null && bid > 0 && ask > 0 && ask >= bid;
}

function lastReady(item) {
  const last = finite(item?.last, item?.price, item?.mid);
  return last != null && last > 0;
}

function signedPrice(value, item) {
  const numeric = finite(value);
  if (numeric == null) return '—';
  const digits = Number.isFinite(Number(item?.digits)) ? Math.max(0, Math.min(8, Number(item.digits))) : 5;
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(digits)}`;
}

function cellValue(column, item) {
  if (!quoteReady(item) && ['bid','ask','spread'].includes(column)) return '—';
  if (column === 'last') return lastReady(item) ? (item?.last ?? item?.price ?? item?.mid) : '—';
  if (column === 'bid') return item?.bid ?? '—';
  if (column === 'ask') return item?.ask ?? '—';
  if (column === 'spread') {
    const bid = finite(item?.bid);
    const ask = finite(item?.ask);
    const pip = instrumentPipSize(item);
    return bid != null && ask != null && Number.isFinite(pip) && pip > 0 ? `${(Math.abs(ask - bid) / pip).toFixed(1)}p` : '—';
  }
  if (column === 'changeValue') return signedPrice(dayChangeValue(item), item);
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
  const state = String(item?.marketState || '').toUpperCase();
  // Exchange closure takes precedence over provider availability. On weekends
  // and exchange holidays keep the last known values visible and label CLOSED.
  if (item?.sessionOpen === false || state === 'CLOSED') {
    return { label: 'CLOSED', tone: 'text-[#75889a]' };
  }
  if (['ERROR','SUBSCRIPTION_ERROR','DISCONNECTED','DISABLED','UNAVAILABLE'].includes(state)) {
    return { label: 'QUOTE UNAVAILABLE', tone: 'text-[#FF6F7A]' };
  }
  if (!lastReady(item)) return { label: 'REFRESHING', tone: 'text-[#6f8599]' };
  if (item?.isStale) return { label: 'STALE', tone: 'text-[#E7BD58]' };
  return { label: 'LIVE', tone: 'text-[#42D7A1]' };
}

function sortValue(item, key) {
  if (key === 'symbol') return String(item?.symbol || '');
  if (key === 'last') return finite(item?.last, item?.price, item?.mid);
  if (key === 'changeValue') return dayChangeValue(item);
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
  onModeChange = () => {},
  onClose = () => {},
  searchRef,
  onNotice = () => {},
  onViewportQuoteSymbolsChange = () => {},
}) {
  const [search, setSearch] = useState('');
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [dragSymbol, setDragSymbol] = useState(null);
  const [category, setCategory] = useState('all');
  const [stockCountry, setStockCountry] = useState('us');
  const [v4SearchOpen, setV4SearchOpen] = useState(false);
  const [v4SortOpen, setV4SortOpen] = useState(false);
  const v4SortRef = useRef(null);
  const [commodityView, setCommodityView] = useState('all');
  const [marketView, setMarketView] = useState(V4_MARKETS_AUDIT ? 'popular' : 'all');
  const [sort, setSort] = useState({ key: 'symbol', direction: 'asc' });
  const [recent, setRecent] = useState(loadRecent);
  const rowRefs = useRef(new Map());
  const scrollRef = useRef(null);

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
  const v4Category = V4_MARKETS_AUDIT && mode === 'watchlist' ? 'favorites' : category;
  useEffect(() => {
    if(!V4_MARKETS_AUDIT || !v4SearchOpen)return;
    searchRef?.current?.focus();
  },[v4SearchOpen,searchRef]);
  useEffect(() => {
    if(!v4SortOpen)return undefined;
    const outside=e=>{if(!v4SortRef.current?.contains(e.target))setV4SortOpen(false);};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[v4SortOpen]);
  const availableMarkets = useMemo(
    () => markets.filter(item => item?.marketDataAvailable !== false),
    [markets],
  );
  const availableCategories = useMemo(() => {
    const present = new Set(availableMarkets.map(assetCategory));
    return CATEGORY_OPTIONS.filter(([id]) => id === 'all' || present.has(id));
  }, [availableMarkets]);

  const rows = useMemo(() => {
    if (V4_MARKETS_AUDIT && (mode === 'markets' || mode === 'watchlist')) return selectV4Markets({
      markets: availableMarkets, category: v4Category, commodityView, stockCountry,
      watched: [...watched], search, view: marketView, recent, popularSymbols: POPULAR_SYMBOLS,
    });
    const query = search.trim().toLowerCase();
    let base = mode === 'markets'
      ? availableMarkets
      : query
        ? availableMarkets
        : availableMarkets.filter(item => watched.has(item.symbol));

    if (mode === 'markets' && !query && category !== 'all') base = base.filter(item => assetCategory(item) === category);
    if (mode === 'markets' && !query && category === 'commodities' && commodityView !== 'all') {
      base = base.filter(item => commoditySubgroup(item) === commodityView);
    }

    if (query) {
      base = base.filter(item => `${item.symbol} ${item.displaySymbol || ''} ${item.name || ''} ${item.assetClass || ''} ${commoditySearchTerms(item)}`.toLowerCase().includes(query));
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
  }, [availableMarkets, category, commodityView, stockCountry, v4Category, marketView, mode, recent, search, sort, watched]);

  const rowSymbolKey = rows.map(item => item.symbol).join('|');

  useEffect(() => {
    if (mode !== 'markets') {
      onViewportQuoteSymbolsChange([]);
      return undefined;
    }

    const root = scrollRef.current;
    if (!root) return undefined;
    const symbols = rowSymbolKey ? rowSymbolKey.split('|').filter(Boolean) : [];
    let frame = null;

    const publish = () => {
      frame = null;
      if (!symbols.length) {
        onViewportQuoteSymbolsChange([]);
        return;
      }

      const viewport = root.getBoundingClientRect();
      let first = -1;
      let last = -1;

      for (let index = 0; index < symbols.length; index += 1) {
        const node = rowRefs.current.get(symbols[index]);
        if (!node) continue;
        const row = node.getBoundingClientRect();
        if (row.bottom >= viewport.top && row.top <= viewport.bottom) {
          if (first < 0) first = index;
          last = index;
        }
      }

      if (first < 0) {
        first = 0;
        last = Math.min(symbols.length - 1, 18);
      }

      const start = Math.max(0, first - 6);
      const end = Math.min(symbols.length - 1, last + 8);
      onViewportQuoteSymbolsChange(symbols.slice(start, end + 1));
    };

    const schedule = () => {
      if (frame != null) return;
      frame = window.requestAnimationFrame(publish);
    };

    schedule();
    root.addEventListener('scroll', schedule, { passive: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(root);

    return () => {
      root.removeEventListener('scroll', schedule);
      resizeObserver?.disconnect();
      if (frame != null) window.cancelAnimationFrame(frame);
      onViewportQuoteSymbolsChange([]);
    };
  }, [mode, onViewportQuoteSymbolsChange, rowSymbolKey]);

  const columns = mode === 'markets' ? ['last','changeValue','change'] : prefs.columns;
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


  // The V4 audit combines the legacy Watchlist and Markets routes into one
  // discovery surface. Watchlist data, row callbacks, and old non-audit UI remain intact.
  if (V4_MARKETS_AUDIT && (mode === 'markets' || mode === 'watchlist')) {
    const changeV4Category=id=>{
      setCategory(id);
      setCommodityView('all');
      if(id==='stocks')setStockCountry('us');
      if(mode==='watchlist' && id!=='favorites')onModeChange('markets');
    };
    const closeSearch=()=>{setSearch('');setV4SearchOpen(false);};
    return (
      <section data-v4-markets-panel aria-label="Markets discovery"
        className="acg-v3-watchlist relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#09090B]"
        onKeyDown={onKeyDown}>
        <header className="relative flex min-h-12 shrink-0 items-center justify-between border-b border-white/[0.07] px-3">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#F2F2F4]">Markets</h2>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Search markets" aria-expanded={v4SearchOpen}
              onClick={()=>{if(v4SearchOpen)closeSearch();else setV4SearchOpen(true);}}
              className={`grid size-8 place-items-center rounded-md hover:bg-[#242427] hover:text-white ${v4SearchOpen?'text-[#F2F2F4]':'text-[#9A9BA4]'}`}>
              <Search size={15}/>
            </button>
            <div className="relative" ref={v4SortRef}>
              <button type="button" aria-label="Market options" aria-expanded={v4SortOpen}
                aria-controls="v4-market-sort-options" onClick={()=>setV4SortOpen(open=>!open)}
                className={`grid size-8 place-items-center rounded-md hover:bg-[#242427] hover:text-white ${v4SortOpen?'text-[#F2F2F4]':'text-[#9A9BA4]'}`}>
                <MoreHorizontal size={16}/>
              </button>
              {v4SortOpen&&<div id="v4-market-sort-options" role="menu" aria-label="Sort markets"
                onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setV4SortOpen(false);}}}
                className="absolute right-0 top-9 z-50 w-40 overflow-hidden rounded-lg border border-[#37373D] bg-[#1A1A1E] p-1.5 shadow-[0_12px_36px_rgba(0,0,0,.6)]">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-[#8C8F9A]">SORT BY</div>
                {MARKET_VIEWS.map(([id,label])=><button key={id} type="button" role="menuitemradio" aria-checked={marketView===id}
                  onClick={()=>{setMarketView(id);setV4SortOpen(false);}}
                  className={`flex min-h-8 w-full items-center justify-between rounded-md px-2 text-left text-[11px] ${marketView===id?'bg-[#303035] font-semibold text-[#F2F2F4]':'text-[#ADB0BB] hover:bg-[#27272C] hover:text-white'}`}>
                  {id==='all'?'A–Z':id==='movers'?'Top movers':id==='active'?'Most active':label}
                  {marketView===id&&<span aria-hidden="true" className="size-1.5 rounded-full bg-[#E4E5E9]"/>}
                </button>)}
              </div>}
            </div>
            <button type="button" onClick={onClose} title="Close markets panel" aria-label="Close markets panel"
              className="grid size-8 place-items-center rounded-md text-[#9A9BA4] hover:bg-[#242427] hover:text-white">
              <X size={15}/>
            </button>
          </div>
        </header>
        <div className={`shrink-0 overflow-hidden transition-[height,opacity] duration-150 ${v4SearchOpen?'h-14 opacity-100':'h-0 opacity-0'}`}>
          <label className="mx-3 mt-2 flex h-9 items-center gap-2 rounded-lg border border-[#33343A] bg-[#17171A] px-2.5 text-[#888D98] focus-within:border-[#777A85]">
            <Search size={14} className="shrink-0"/>
            <input ref={searchRef} aria-label="Search markets input" value={search}
              onChange={event=>setSearch(event.target.value)}
              onFocus={()=>setV4SearchOpen(true)}
              onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();closeSearch();}}}
              tabIndex={v4SearchOpen?0:-1} aria-hidden={!v4SearchOpen}
              placeholder="Search instruments..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#F2F2F4] outline-none placeholder:text-[#777C87]"/>
            {search&&<button type="button" aria-label="Clear market search" onClick={()=>setSearch('')}
              className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-[#29292D]"><X size={13}/></button>}
            <button type="button" aria-label="Close search" onClick={closeSearch}
              className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-[#29292D]"><X size={13}/></button>
          </label>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] pl-3 pr-2 py-2">
          <button type="button" aria-label="Favorites" title="Favorites" aria-pressed={v4Category==='favorites'}
            onClick={()=>changeV4Category('favorites')}
            className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${v4Category==='favorites'?'bg-[#F2F2F4] text-[#161619]':'bg-[#1A1A1D] text-[#A2A3AD] hover:bg-[#29292E] hover:text-white'}`}>
            <Star size={14} fill={v4Category==='favorites'?'currentColor':'none'}/>
          </button>
          <nav aria-label="Asset categories"
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {V4_MARKET_CATEGORIES.map(([id,label])=><button key={id} type="button" aria-pressed={v4Category===id}
              onClick={()=>changeV4Category(id)}
              className={`min-h-8 shrink-0 rounded-lg px-2.5 text-[10px] font-semibold transition-colors ${v4Category===id?'bg-[#F2F2F4] text-[#161619]':'bg-[#1A1A1D] text-[#A2A3AD] hover:bg-[#29292E] hover:text-[#F2F2F4]'}`}>
              {label}
            </button>)}
          </nav>
        </div>
        {v4Category==='stocks'&&<nav aria-label="Stock markets" className="flex shrink-0 gap-1.5 border-b border-white/[0.06] px-3 py-2">
          {[['us','US'],['india','India']].map(([id,label])=><button type="button" key={id} aria-pressed={stockCountry===id}
            onClick={()=>setStockCountry(id)} className={`min-h-7 rounded-md px-3 text-[10px] font-medium ${stockCountry===id?'bg-[#303035] text-[#F2F2F4]':'text-[#9497A2] hover:bg-[#242427] hover:text-white'}`}>{label}</button>)}
        </nav>}
        {v4Category==='commodities'&&<nav aria-label="Commodity categories" className="flex shrink-0 gap-1.5 border-b border-white/[0.06] px-3 py-2">
          {COMMODITY_VIEWS.map(([id,label])=><button key={id} type="button" aria-pressed={commodityView===id}
            onClick={()=>setCommodityView(id)} className={`min-h-7 rounded-md px-2.5 text-[10px] ${commodityView===id?'bg-[#303035] font-semibold text-white':'text-[#92949E] hover:bg-[#242427] hover:text-white'}`}>{label}</button>)}
        </nav>}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]" tabIndex={0} aria-label="Market instruments">
          {!rows.length&&<div className="grid min-h-32 place-items-center px-5 text-center text-[11px] text-[#888D98]">
            {search?'No instruments match this search and category.':marketView==='recent'?'Recently viewed instruments appear here.':'No instruments in this category.'}
          </div>}
          {rows.map(item=>{
            const selected=item.symbol===activeSymbol;
            const isWatched=watchlists?.isWatched?.(item.symbol)===true;
            const status=statusFor(item);
            const forex=assetCategory(item)==='forex';
            const presentation=v4MarketPricePresentation(item,forex);
            return (
              <div key={item.symbol} ref={node=>{if(node)rowRefs.current.set(item.symbol,node);else rowRefs.current.delete(item.symbol);}}
                data-market-symbol={item.symbol} data-market-selected={selected?'true':'false'}
                className={`flex min-h-[66px] items-stretch border-b border-white/[0.06] transition-colors ${selected?'border-l-2 border-l-[#E2E3E7] bg-[#232327]':'border-l-2 border-l-transparent hover:bg-[#18181B]'}`}>
                <button type="button" onClick={()=>selectInstrument(item.symbol)} aria-label={`Open ${displaySymbol(item.symbol)} chart`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pl-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#C6C8CF]">
                  <span className="flex min-w-0 items-center gap-2">
                    <InstrumentAvatar instrument={item} size={26}/>
                    <span className="min-w-0">
                      <strong className="block truncate text-[11px] font-semibold tracking-[-0.01em] text-[#E9EAF0]">{commodityDisplaySymbol(item)||item.displaySymbol||displaySymbol(item.symbol)}</strong>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[9px] text-[#898C96]">
                        <span className={`inline-block size-1.5 shrink-0 rounded-full ${status.label==='LIVE'?'bg-[#42D7A1]':status.label==='STALE'?'bg-[#E7BD58]':status.label==='QUOTE UNAVAILABLE'?'bg-[#FF6F7A]':'bg-[#676D78]'}`}/>
                        <span className="truncate">{status.label==='LIVE'?(item.name||categoryLabel(item)):status.label}</span>
                      </span>
                    </span>
                  </span>
                  {forex?<span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    <span className="flex gap-2 font-mono text-[10px] font-semibold tabular-nums text-[#D3D6DE]">
                      <span><span className="mr-1 text-[9px] font-normal text-[#898C96]">B</span>{presentation.bid}</span>
                      <span><span className="mr-1 text-[9px] font-normal text-[#898C96]">A</span>{presentation.ask}</span>
                    </span>
                    <small className="text-[9px] tabular-nums text-[#8B8E99]">Spread {presentation.spread}</small>
                  </span>:<span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    <strong className="font-mono text-[11px] font-semibold tabular-nums text-[#E7E8EF]">{presentation.last}</strong>
                    <span className={`font-mono text-[10px] tabular-nums ${presentation.changeValue==null?'text-[#8B8E99]':presentation.changeValue>=0?'text-[#42D7A1]':'text-[#FF6F7A]'}`}>{presentation.change}</span>
                  </span>}
                </button>
                <button type="button" onClick={()=>toggleWatch(item)} aria-label={isWatched?`Remove ${item.symbol} from watchlist`:`Add ${item.symbol} to watchlist`}
                  title={isWatched?'Remove from watchlist':'Add to watchlist'} aria-pressed={isWatched}
                  className={`grid w-8 shrink-0 place-items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A8ABB5] ${isWatched?'text-[#E3E4E8]':'text-[#777B85] hover:text-[#E3E4E8]'}`}>
                  <Star size={14} fill={isWatched?'currentColor':'none'}/>
                </button>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="acg-v3-watchlist flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden" onKeyDown={onKeyDown}>
      <div className="grid h-8 shrink-0 grid-cols-2 border-b border-white/[0.06] bg-[#09090B] p-0.5">
        <button type="button" onClick={() => onModeChange('watchlist')} className={mode === 'watchlist' ? "relative rounded text-[8px] font-bold text-[#f0f4f7]" : "rounded text-[8px] font-semibold text-[#687988] hover:text-white"}>Watchlist{mode === 'watchlist' && <span className="acg-active-underline absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#C9CDD2]"/>}</button>
        <button type="button" onClick={() => onModeChange('markets')} className={mode === 'markets' ? "relative rounded text-[8px] font-bold text-[#f0f4f7]" : "rounded text-[8px] font-semibold text-[#687988] hover:text-white"}>Markets{mode === 'markets' && <span className="acg-active-underline absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#C9CDD2]"/>}</button>
      </div>
      <div className="relative flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-2.5">
        <div className="min-w-0">
          {mode === 'markets' ? (
            <>
              <strong className="block text-[11px] font-bold tracking-[0.05em] text-[#E6EDF3]">MARKETS</strong>
              <span className="mt-0.5 block text-[8px] text-[#6F8191]">{availableMarkets.length} instruments · discover &amp; trade</span>
            </>
          ) : (
            <button type="button" onClick={() => setListMenuOpen(value => !value)} className="flex min-w-0 items-center gap-1.5 text-left">
              <span className="min-w-0">
                <strong className="block truncate text-[11px] font-bold tracking-[0.04em] text-[#E6EDF3]">{watchlists?.activeList?.name || 'Favorites'}</strong>
                <span className="mt-0.5 block text-[8px] text-[#6F8191]">{availableMarkets.filter(item => watched.has(item.symbol)).length} instruments</span>
              </span>
              <ChevronDown size={11} className="text-[#6F8191]"/>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {mode !== 'markets' && <button type="button" onClick={() => setColumnsOpen(value => !value)} className="grid size-6 place-items-center rounded text-[#6F8191] hover:bg-white/[0.03] hover:text-white" title="Watchlist columns"><Settings2 size={12}/></button>}
          <button type="button" onClick={() => searchRef?.current?.focus()} className="grid size-6 place-items-center rounded text-[#6F8191] hover:bg-white/[0.03] hover:text-white" title="Search markets"><Search size={13}/></button>
          <button type="button" onClick={onClose} className="grid size-6 place-items-center rounded text-[#6F8191] hover:bg-white/[0.03] hover:text-white" title="Close markets panel"><X size={13}/></button>
        </div>

        {listMenuOpen && mode !== 'markets' && (
          <div className="acg-motion-popover absolute left-2 top-10 z-50 w-[210px] overflow-hidden rounded-md border border-white/[0.10] bg-[#111113] p-1 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
            {(watchlists?.workspace?.lists || []).map(list => (
              <button key={list.id} type="button" onClick={() => { watchlists?.setActiveListId?.(list.id); setListMenuOpen(false); }} className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] ${list.id === watchlists?.activeList?.id ? 'bg-[#222225] text-[#CBD0D5]' : 'text-[#aab7c3] hover:bg-white/[0.03]'}`}>
                <span className="truncate font-bold">{list.name}</span><span className="font-mono text-[8px] text-[#6F8191]">{list.symbols.length}</span>
              </button>
            ))}
            <button type="button" onClick={createWatchlist} className="mt-1 flex w-full items-center gap-1.5 border-t border-white/[0.06] px-2 pt-2 text-[8px] font-bold text-[#C9CDD2]"><Plus size={11}/>New watchlist</button>
          </div>
        )}

        {columnsOpen && mode !== 'markets' && (
          <div className="acg-motion-popover absolute right-2 top-10 z-50 w-[176px] rounded-md border border-white/[0.10] bg-[#111113] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[8px] font-black uppercase tracking-[0.08em] text-[#6F8191]"><ListFilter size={10}/>Columns</div>
            {COLUMN_OPTIONS.map(([id, label]) => {
              const active = columns.includes(id);
              return <button key={id} type="button" onClick={() => toggleColumn(id)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-[8px] ${active ? 'text-[#dce7ef]' : 'text-[#6F8191]'}`}><span>{label}</span><span className={`size-2 rounded-sm border ${active ? 'border-[#CCD1D6] bg-[#CCD1D6]' : 'border-white/[0.12]'}`}/></button>;
            })}
            <div className="mt-1 border-t border-white/[0.06] px-2 pt-1 text-[8px] text-[#53677a]">Choose 2–5 columns</div>
          </div>
        )}
      </div>

      {mode === 'markets' && (
        <>
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {availableCategories.map(([id, label]) => <button key={id} type="button" onClick={() => { setCategory(id); if (id !== 'commodities') setCommodityView('all'); }} className={`h-7 shrink-0 rounded px-2.5 text-[8px] font-semibold ${category === id ? 'bg-[#222225] text-[#CBD0D5]' : 'text-[#6F8191] hover:bg-white/[0.03] hover:text-white'}`}>{label}</button>)}
          </div>
          {category === 'commodities' && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {COMMODITY_VIEWS.map(([id, label]) => <button key={id} type="button" onClick={() => setCommodityView(id)} className={`h-7 shrink-0 rounded border px-2.5 text-[8px] font-semibold ${commodityView === id ? 'border-[#55595F] bg-[#222225] text-[#CBD0D5]' : 'border-white/[0.06] text-[#6F8191]'}`}>{label}</button>)}
            </div>
          )}
          <div className="flex shrink-0 gap-1 overflow-x-auto px-1.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MARKET_VIEWS.map(([id, label]) => <button key={id} type="button" onClick={() => setMarketView(id)} className={`h-7 shrink-0 rounded border px-2.5 text-[8px] font-semibold ${marketView === id ? 'border-[#55595F] bg-[#222225] text-[#CBD0D5]' : 'border-white/[0.06] text-[#6F8191]'}`}>{label}</button>)}
          </div>
        </>
      )}

      <div className="shrink-0 p-1.5">
        <div className="flex h-8 items-center gap-2 rounded-md border border-white/[0.06] bg-black/20 px-2 text-[#687c91]">
          <Search size={11}/>
          <input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder={mode === 'markets' ? 'Search symbol or market' : 'Search all markets'} className="min-w-0 flex-1 bg-transparent text-[9px] text-[#E6EDF3] outline-none placeholder:text-[#6F8191]"/>
          {search && <button type="button" onClick={() => setSearch('')} className="text-[8px] text-[#6F8191]">Clear</button>}
        </div>
      </div>

      <div className="grid shrink-0 border-y border-white/[0.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.07em] text-[#6F8191]" style={{ gridTemplateColumns: gridTemplate }}>
        <button type="button" onClick={() => changeSort('symbol')} className="text-left"><SortLabel id="symbol" label="Instrument" sort={sort}/></button>
        {columns.map(column => (
          <button key={column} type="button" onClick={() => changeSort(column)} className="text-right">
            <SortLabel id={column} label={COLUMN_OPTIONS.find(([id]) => id === column)?.[1] || column} sort={sort}/>
          </button>
        ))}
        <span />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [scrollbar-gutter:stable] [scrollbar-width:thin]" tabIndex={0}>
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
              className={`acg-motion-row grid items-center border-b border-white/[0.06] px-2 py-0.5 transition ${selected ? 'border-l border-[#CCD1D6] bg-[#222225]' : 'border-l border-transparent hover:bg-white/[0.018]'} ${dragSymbol === item.symbol ? 'opacity-45' : ''}`}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <button type="button" onClick={() => selectInstrument(item.symbol)} className="flex min-w-0 items-center gap-1.5 py-2 text-left">
                {mode !== 'markets' && !search && isWatched && <GripVertical size={9} className="shrink-0 text-[#44515D]"/>}
                <InstrumentAvatar instrument={item} size={21}/>
                <span className="min-w-0">
                  <b className="block truncate text-[11px] font-semibold text-[#E6EDF3]">{commodityDisplaySymbol(item) || item.displaySymbol || displaySymbol(item.symbol)}</b>
                  <small className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[8px]">
                    {mode === 'markets' && <span className="truncate text-[#6F8191]">{categoryLabel(item)}</span>}
                    {mode === 'markets' && <span className="text-[#44515D]">·</span>}
                    <span className={statusTone}>{statusLabel}</span>
                  </small>
                </span>
              </button>

              {columns.map(column => {
                const change = column === 'change' ? dayChange(item) : null;
                const value = cellValue(column, item);
                return (
                  <button key={column} type="button" onClick={() => selectInstrument(item.symbol)} className={`truncate py-1.5 text-right font-mono text-[10px] tabular-nums ${
                    ['change', 'changeValue'].includes(column) && (column === 'change' ? change : dayChangeValue(item)) != null
                      ? ((column === 'change' ? change : dayChangeValue(item)) >= 0 ? 'text-[#42D7A1]' : 'text-[#FF6F7A]')
                      : column === 'last'
                        ? (item.direction === 'up' ? 'font-semibold text-[#42D7A1]' : item.direction === 'down' ? 'font-semibold text-[#FF6F7A]' : 'font-semibold text-[#D8E0E7]')
                        : column === 'bid'
                          ? 'font-bold text-[#A1AFBC]'
                          : 'text-[#A1AFBC]'
                  }`}>
                    <span key={`${item.symbol}-${column}-${String(value)}`} className="acg-motion-value inline-block">{value}</span>
                  </button>
                );
              })}

              <button type="button" onClick={() => toggleWatch(item)} className={`grid size-6 place-items-center rounded ${isWatched ? 'text-[#CDD1D6]' : 'text-[#6F8191] hover:bg-white/[0.04] hover:text-[#CDD1D6]'}`} title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={isWatched ? `Remove ${item.symbol} from watchlist` : `Add ${item.symbol} to watchlist`}><Star key={isWatched ? 'watched-on' : 'watched-off'} className="acg-favorite-icon" data-active={isWatched ? 'true' : 'false'} size={10} fill={isWatched ? 'currentColor' : 'none'}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
