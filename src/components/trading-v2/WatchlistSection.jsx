import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ChevronDown, Plus, Search, Star, X } from 'lucide-react';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';

const STORAGE_KEY = 'acg-trader-watchlists-v1';

function displaySymbol(symbol = '') {
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}

function marketName(item) {
  if (item?.name) return item.name;
  const names = {
    EURUSD: 'Euro / US Dollar', GBPUSD: 'British Pound / US Dollar', USDJPY: 'US Dollar / Japanese Yen', AUDUSD: 'Australian Dollar / US Dollar', USDCAD: 'US Dollar / Canadian Dollar', USDCHF: 'US Dollar / Swiss Franc', NZDUSD: 'New Zealand Dollar / US Dollar', XAUUSD: 'Gold / US Dollar', XAGUSD: 'Silver / US Dollar', US30: 'Dow Jones 30', NAS100: 'Nasdaq 100', SPX500: 'S&P 500', BTCUSD: 'Bitcoin / US Dollar', ETHUSD: 'Ethereum / US Dollar',
  };
  return names[item?.symbol] || displaySymbol(item?.symbol);
}

function numericChange(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace('%', '').replace('+', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferGroup(symbol = '') {
  if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) return 'Metals';
  if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL') || symbol.includes('XRP')) return 'Crypto';
  if (/^(US30|NAS100|SPX500|GER40|UK100|JP225)/.test(symbol)) return 'Indices';
  if (/^[A-Z]{6}$/.test(symbol)) return 'Forex';
  return 'Other';
}

function loadWorkspace() {
  if (typeof window === 'undefined') return { activeListId: 'favorites', lists: [] };
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored?.lists?.length) return stored;
  } catch (_) { /* defaults below */ }
  return { activeListId: 'favorites', lists: [] };
}

function defaultLists(markets) {
  const available = new Set(markets.map(item => item.symbol));
  const filter = symbols => symbols.filter(symbol => available.has(symbol));
  return [
    { id: 'favorites', name: 'Favorites', symbols: markets.slice(0, Math.min(8, markets.length)).map(item => item.symbol) },
    { id: 'fx-majors', name: 'FX Majors', symbols: filter(['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD']) },
    { id: 'gold-scalping', name: 'Gold Scalping', symbols: filter(['XAUUSD', 'XAGUSD']) },
  ];
}

export default function WatchlistSection({
  markets = [],
  activeSymbol,
  onOpenTrade = () => {},
  onAddInstrument = () => {},
}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('watchlist');
  const [sort, setSort] = useState('symbol');
  const [sortOpen, setSortOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [workspace, setWorkspace] = useState(loadWorkspace);

  useEffect(() => {
    if (!markets.length || workspace.lists.length) return;
    setWorkspace({ activeListId: 'favorites', lists: defaultLists(markets) });
  }, [markets, workspace.lists.length]);

  useEffect(() => {
    if (typeof window !== 'undefined' && workspace.lists.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  const activeList = workspace.lists.find(item => item.id === workspace.activeListId) || workspace.lists[0] || { id: 'favorites', name: 'Favorites', symbols: [] };
  const favorites = useMemo(() => new Set(activeList.symbols), [activeList.symbols]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = markets.filter(item => {
      const searchable = `${item.symbol} ${marketName(item)} ${inferGroup(item.symbol)}`.toLowerCase();
      return !q || searchable.includes(q);
    });
    if (scope === 'watchlist') list = list.filter(item => favorites.has(item.symbol));
    return [...list].sort((a, b) => {
      if (sort === 'change') return Math.abs(numericChange(b.change)) - Math.abs(numericChange(a.change));
      if (sort === 'spread') return Math.abs(Number(a.ask) - Number(a.bid)) - Math.abs(Number(b.ask) - Number(b.bid));
      return String(a.symbol).localeCompare(String(b.symbol));
    });
  }, [markets, query, scope, sort, favorites]);

  const updateActiveSymbols = updater => setWorkspace(current => ({
    ...current,
    lists: current.lists.map(list => list.id === current.activeListId ? { ...list, symbols: updater(list.symbols) } : list),
  }));

  const toggleFavorite = symbol => updateActiveSymbols(symbols => symbols.includes(symbol) ? symbols.filter(item => item !== symbol) : [...symbols, symbol]);

  const createList = () => {
    const name = window.prompt('Watchlist name', 'New Watchlist')?.trim();
    if (!name) return;
    const id = `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
    setWorkspace(current => ({ ...current, activeListId: id, lists: [...current.lists, { id, name, symbols: [] }] }));
    setScope('watchlist');
    setListOpen(false);
  };

  const gainers = markets.filter(item => numericChange(item.change) > 0).length;
  const losers = markets.filter(item => numericChange(item.change) < 0).length;

  return (
    <section className="min-h-[calc(100dvh-98px)] px-3 pb-5 pt-2">
      <header className="pb-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5e7489]">Markets</p><h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">Watchlist</h1><p className="mt-1 text-[10px] text-[#6f8296]">Your fast route into the next trade.</p></div>
          <button type="button" onClick={onAddInstrument} className="mt-1 flex h-10 items-center gap-1.5 rounded-xl border border-[#234258] bg-[#0c2130] px-3 text-[10px] font-extrabold text-[#64c9ff] shadow-[inset_0_1px_rgba(255,255,255,.03)]"><Plus size={15} /> Add</button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 pb-3"><Stat label="Watching" value={activeList.symbols.length} /><Stat label="Up" value={gainers} positive /><Stat label="Down" value={losers} negative /></div>

      <div className="sticky top-0 z-20 -mx-1 bg-[#050b12]/95 px-1 pb-2 pt-1 backdrop-blur-xl">
        <div className="flex h-11 items-center gap-2 rounded-[14px] border border-[#1a2d3d] bg-[#09141e] px-3 shadow-[inset_0_1px_rgba(255,255,255,.02)]"><Search size={16} className="shrink-0 text-[#64798e]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search EURUSD, Gold, Nasdaq…" className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#e9f0f5] outline-none placeholder:font-medium placeholder:text-[#52677b]" />{query && <button type="button" onClick={() => setQuery('')} className="grid size-7 place-items-center rounded-lg text-[#71859a] hover:bg-white/[0.04] hover:text-white"><X size={14} /></button>}</div>

        <div className="mt-2 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <button type="button" onClick={() => setListOpen(value => !value)} className="flex h-10 w-full items-center justify-between rounded-xl border border-[#192c3c] bg-[#08131d] px-3 text-left"><span className="min-w-0"><b className="block truncate text-[9px] text-[#d9e4ec]">{activeList.name}</b><small className="mt-0.5 block text-[7px] text-[#5d7286]">{activeList.symbols.length} instruments</small></span><ChevronDown size={12} className="text-[#6e8296]"/></button>
            {listOpen && <div className="absolute left-0 top-12 z-40 w-full min-w-[190px] overflow-hidden rounded-xl border border-[#223544] bg-[#0a151f] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.5)]">{workspace.lists.map(list => <button key={list.id} type="button" onClick={() => { setWorkspace(current => ({ ...current, activeListId: list.id })); setScope('watchlist'); setListOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold ${activeList.id === list.id ? 'bg-[#102c40] text-[#61caff]' : 'text-[#b3c0cc] hover:bg-white/[0.04]'}`}><span>{list.name}</span><span className="text-[7px] text-[#62778b]">{list.symbols.length}</span></button>)}<button type="button" onClick={createList} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-[#172938] px-2.5 py-2.5 text-left text-[9px] font-bold text-[#62caff]"><Plus size={12}/>New watchlist</button></div>}
          </div>

          <div className="flex rounded-xl border border-[#192c3c] bg-[#08131d] p-1"><button type="button" onClick={() => setScope('watchlist')} className={`h-8 rounded-lg px-2.5 text-[8px] font-extrabold transition ${scope === 'watchlist' ? 'bg-[#113149] text-[#62cbff]' : 'text-[#73879b]'}`}>LIST</button><button type="button" onClick={() => setScope('all')} className={`h-8 rounded-lg px-2.5 text-[8px] font-extrabold transition ${scope === 'all' ? 'bg-[#113149] text-[#62cbff]' : 'text-[#73879b]'}`}>ALL</button></div>

          <div className="relative"><button type="button" onClick={() => setSortOpen(value => !value)} className="flex h-10 items-center gap-1.5 rounded-xl border border-[#192c3c] bg-[#08131d] px-2.5 text-[8px] font-bold text-[#8396aa]"><ArrowDownUp size={12} /> {sort === 'symbol' ? 'A–Z' : sort === 'change' ? 'Move' : 'Spread'} <ChevronDown size={10} /></button>{sortOpen && <div className="absolute right-0 top-12 z-40 w-[132px] overflow-hidden rounded-xl border border-[#223544] bg-[#0a151f] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.5)]">{[['symbol', 'A–Z'], ['change', 'Biggest move'], ['spread', 'Tightest spread']].map(([id, label]) => <button key={id} type="button" onClick={() => { setSort(id); setSortOpen(false); }} className={`w-full rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold ${sort === id ? 'bg-[#102c40] text-[#61caff]' : 'text-[#b3c0cc] hover:bg-white/[0.04]'}`}>{label}</button>)}</div>}</div>
        </div>
      </div>

      <div className="mt-1 overflow-hidden rounded-[20px] border border-[#172a39] bg-gradient-to-b from-[#09141d] to-[#071019] shadow-[0_16px_45px_rgba(0,0,0,.22)]">
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_28px] gap-1 border-b border-[#152634] px-3 py-2.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#52677b]"><span>Instrument</span><span className="text-right">Bid</span><span className="text-right">Ask</span><span /></div>

        {rows.length ? rows.map(item => {
          const selected = item.symbol === activeSymbol;
          const change = numericChange(item.change);
          const positive = change >= 0;
          const watched = favorites.has(item.symbol);
          const spread = Math.abs(Number(item.ask) - Number(item.bid));
          const spreadText = Number.isFinite(spread) ? formatInstrumentPrice(spread, item) : '—';
          return <div key={item.symbol} className={`relative border-b border-[#111f2c] last:border-b-0 ${selected ? 'bg-[#0b2030]' : ''}`}>{selected && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r bg-[#4ac4ff]" />}<div className="grid grid-cols-[minmax(0,1fr)_72px_72px_28px] items-center gap-1 px-3 py-3"><button type="button" onClick={() => onOpenTrade(item.symbol)} className="min-w-0 text-left"><div className="flex items-center gap-2"><div className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-[#1b3040] bg-[#0c1822] text-[9px] font-black text-[#9eb1c3]">{displaySymbol(item.symbol).replace('/', '').slice(0, 2)}</div><div className="min-w-0"><div className="flex items-center gap-1.5"><strong className="truncate text-[12px] font-black tracking-[-0.02em] text-[#eef4f8]">{displaySymbol(item.symbol)}</strong><span className={`rounded-md px-1.5 py-0.5 text-[7px] font-extrabold ${positive ? 'bg-[#0d3228] text-[#43d9a6]' : 'bg-[#351820] text-[#ff707b]'}`}>{positive ? '+' : ''}{item.change ?? '0.00%'}</span></div><div className="mt-1 flex items-center gap-1.5 text-[8px] text-[#60758a]"><span className="truncate">{marketName(item)}</span><span className="size-0.5 rounded-full bg-[#40566a]"/><span>{inferGroup(item.symbol)}</span></div></div></div></button><button type="button" onClick={() => onOpenTrade(item.symbol)} className="text-right"><strong className="block font-mono text-[10px] text-[#cbd7df]">{formatInstrumentPrice(item.bid, item)}</strong><span className="mt-1 block text-[7px] text-[#5f7387]">Spread {spreadText}</span></button><button type="button" onClick={() => onOpenTrade(item.symbol)} className="text-right"><strong className="block font-mono text-[10px] text-[#9fb2c2]">{formatInstrumentPrice(item.ask, item)}</strong><span className="mt-1 block text-[7px] text-[#52677a]">Tap to trade</span></button><button type="button" onClick={() => toggleFavorite(item.symbol)} aria-label={watched ? `Remove from ${activeList.name}` : `Add to ${activeList.name}`} className={`grid size-7 place-items-center rounded-lg ${watched ? 'text-[#f6c85c]' : 'text-[#50667a] hover:bg-white/[0.04] hover:text-[#f6c85c]'}`}><Star size={15} fill={watched ? 'currentColor' : 'none'} /></button></div></div>;
        }) : <div className="grid min-h-[240px] place-items-center px-8 text-center"><div><Star size={26} className="mx-auto text-[#466075]"/><strong className="mt-3 block text-[12px] text-[#aebdca]">{scope === 'watchlist' ? `${activeList.name} is empty` : 'No markets found'}</strong><p className="mt-1 text-[9px] leading-4 text-[#62778b]">{scope === 'watchlist' ? 'Switch to All markets and star the instruments you want in this list.' : 'Try another symbol or market name.'}</p>{scope === 'watchlist' && <button type="button" onClick={() => setScope('all')} className="mt-3 rounded-xl border border-[#214057] bg-[#0d2231] px-4 py-2.5 text-[10px] font-bold text-[#61caff]">Browse all markets</button>}</div></div>}
      </div>
    </section>
  );
}

function Stat({ label, value, positive, negative }) {
  return <div className="rounded-[14px] border border-[#172a39] bg-[#08131c] px-3 py-2.5"><span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#596e82]">{label}</span><strong className={`mt-1 block text-[16px] font-black ${positive ? 'text-[#3cd6a1]' : negative ? 'text-[#ff6874]' : 'text-[#dfe8ef]'}`}>{value}</strong></div>;
}
