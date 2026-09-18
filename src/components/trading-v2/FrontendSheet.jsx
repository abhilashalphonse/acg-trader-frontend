import React, { useMemo, useState } from 'react';
import { X, Search, Bell, UserRound, Activity, Star, Clock3, Settings, HelpCircle, ShieldCheck } from 'lucide-react';
import IndicatorManager from './IndicatorManager.jsx';
import InstrumentAvatar from './InstrumentAvatar.jsx';

function symbolLabel(symbol = '') {
  return symbol.length === 6 ? `${symbol.slice(0, 3)}/${symbol.slice(3)}` : symbol;
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

const MARKET_GROUPS = ['All', 'Forex', 'Metals', 'Commodities', 'Indices', 'Stocks', 'Crypto'];

const tradingProfiles = [
  { id: 'scalp', name: 'SCALP', description: '5s · Risk 0.25% · EMA 9/20 + VWAP', settings: { timeframe: '5s', chartMode: 'candles', sizingMode: 'risk', riskPercent: 0.25, orderType: 'market' }, indicators: [{ id: 'ema', settings: { period: 9 } }, { id: 'ema', settings: { period: 20 } }, { id: 'vwap' }, { id: 'volume' }] },
  { id: 'intraday', name: 'INTRADAY', description: '5m · Risk 0.50% · EMA 20/50 + RSI', settings: { timeframe: '5m', chartMode: 'candles', sizingMode: 'risk', riskPercent: 0.5, orderType: 'market' }, indicators: [{ id: 'ema', settings: { period: 20 } }, { id: 'ema', settings: { period: 50 } }, { id: 'rsi', settings: { period: 14 } }, { id: 'volume' }] },
  { id: 'gold', name: 'GOLD', description: '15s · Risk 0.50% · VWAP + ATR', settings: { timeframe: '15s', chartMode: 'candles', sizingMode: 'risk', riskPercent: 0.5, orderType: 'market' }, symbol: 'XAUUSD', indicators: [{ id: 'vwap' }, { id: 'atr', settings: { period: 14 } }, { id: 'volume' }] },
  { id: 'classic', name: 'MT5 CLASSIC', description: '1m · Manual lots · clean chart', settings: { timeframe: '1m', chartMode: 'candles', sizingMode: 'lots', orderType: 'market' }, indicators: [{ id: 'volume' }] },
];

export default function FrontendSheet({
  type,
  onClose,
  markets = [],
  activeSymbol,
  onSelectSymbol = () => {},
  watchlists = null,
  indicators = [],
  indicatorFavorites = [],
  onAddIndicator = () => {},
  onRemoveIndicator = () => {},
  onToggleIndicator = () => {},
  onUpdateIndicator = () => {},
  onToggleIndicatorFavorite = () => {},
  terminalPrefs = {},
  onToggleHotkeys = () => {},
  onApplyTradingProfile = () => {},
  account = {},
}) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [marketGroupFilter, setMarketGroupFilter] = useState('All');
  const filteredMarkets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter(item => {
      const group = marketGroup(item);
      if (marketGroupFilter !== 'All' && group !== marketGroupFilter) return false;
      if (!q) return true;
      const searchable = `${item.symbol || ''} ${item.displaySymbol || ''} ${item.name || ''} ${item.assetClass || ''} ${group}`.toLowerCase();
      return searchable.includes(q);
    });
  }, [marketGroupFilter, markets, query]);

  const titleMap = { search: 'Search markets', notifications: 'Notifications', profile: 'Account', instruments: 'Select instrument', indicators: 'Indicators', watchlist: 'Watchlist', markets: 'Markets', history: 'History', more: 'Terminal' };
  const trigger = label => setMessage(`${label} is not available in this terminal build.`);

  const renderMarkets = favoritesOnly => {
    const watched = new Set(watchlists?.activeSymbols || []);
    const list = favoritesOnly ? filteredMarkets.filter(item => watched.has(item.symbol)) : filteredMarkets;
    if (!list.length) return <div className="grid min-h-36 place-items-center rounded-xl border border-[#182b3b] bg-[#08131c] px-5 text-center text-[9px] text-[#687d91]">No instruments match this search.</div>;
    return <div className="space-y-1.5">{list.map(item => {
      const isWatched = watched.has(item.symbol);
      return <div key={item.symbol} className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${activeSymbol === item.symbol ? 'border-[#245071] bg-[#0d2536]' : 'border-[#182b3b] bg-[#08131c]'}`}><button type="button" onClick={() => { onSelectSymbol(item.symbol); onClose(); }} className="flex min-w-0 flex-1 items-center justify-between px-1 py-1 text-left"><div className="flex min-w-0 items-center gap-2.5"><InstrumentAvatar instrument={item} size={32}/><div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-[12px] text-[#eef4f8]">{item.displaySymbol || symbolLabel(item.symbol)}</strong><span className="rounded-md bg-[#10202d] px-1.5 py-0.5 text-[7px] font-bold text-[#738ba0]">{marketGroup(item)}</span></div><p className="mt-1 truncate text-[9px] text-[#6f8296]">{item.name || 'Market instrument'}</p></div></div><div className="ml-3 text-right"><b className="block text-[11px] text-[#dce5ec]">{item.bid ?? '—'}</b><span className={`mt-1 block text-[8px] ${item.live ? 'text-[#31d79d]' : item.isStale ? 'text-[#e8c35f]' : 'text-[#71869a]'}`}>{item.subscribed ? (item.live ? 'Live' : item.isStale ? 'Stale' : item.marketState || 'Waiting') : 'Open for quote'}</span></div></button><button type="button" onClick={() => watchlists?.toggleSymbol?.(item.symbol)} aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'} className={`grid size-9 shrink-0 place-items-center rounded-lg ${isWatched ? 'text-[#f6c95d]' : 'text-[#60758a] hover:bg-white/[0.04] hover:text-[#f6c95d]'}`}><Star size={16} fill={isWatched ? 'currentColor' : 'none'}/></button></div>;
    })}</div>;
  };

  const actionRows = rows => <div className="space-y-1.5">{rows.map(([label, Icon]) => <button key={label} type="button" onClick={() => trigger(label)} className="flex w-full items-center justify-between rounded-xl border border-[#182b3a] bg-[#08131c] px-3 py-3 text-[11px] font-semibold text-[#cbd6df] active:bg-[#0c2130]"><span className="flex items-center gap-2"><Icon size={15} className="text-[#7b91a6]"/>{label}</span><span className="text-[#4e6579]">›</span></button>)}</div>;

  const isIndicators = type === 'indicators';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 px-2 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section onMouseDown={event => event.stopPropagation()} className={`${isIndicators ? 'max-h-[90dvh]' : 'max-h-[84dvh]'} mb-[max(8px,env(safe-area-inset-bottom))] w-full max-w-[444px] overflow-hidden rounded-[24px] border border-[#203343] bg-[#071019] shadow-[0_30px_90px_rgba(0,0,0,.65)]`}>
        <header className="flex items-center justify-between border-b border-[#152634] px-4 py-3.5"><div><h2 className="text-[15px] font-black text-[#f3f7fb]">{titleMap[type] || 'ACG Trader'}</h2><p className="mt-0.5 text-[9px] text-[#6e8195]">{isIndicators ? 'Technical studies · live chart' : type === 'more' ? 'Profiles, preferences and shortcuts' : 'Frontend preview'}</p></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl border border-[#1c2e3d] bg-[#0b1721] text-[#93a6b8]"><X size={17}/></button></header>
        <div className={`${isIndicators ? 'max-h-[calc(90dvh-70px)]' : 'max-h-[calc(84dvh-70px)]'} overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          {message && <div className="mb-3 rounded-xl border border-[#24445a] bg-[#0d2332] px-3 py-2.5 text-[9px] leading-4 text-[#a9c5d8]">{message}</div>}
          {(type === 'search' || type === 'instruments' || type === 'markets') && <><div className="mb-2 flex h-11 items-center gap-2 rounded-xl border border-[#1b2d3d] bg-[#0a151f] px-3"><Search size={16} className="text-[#6f8295]"/><input autoFocus={type === 'search'} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search 300 markets…" className="min-w-0 flex-1 bg-transparent text-[12px] text-[#eef4f8] outline-none placeholder:text-[#53677b]"/></div><div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{MARKET_GROUPS.map(group => <button key={group} type="button" onClick={() => setMarketGroupFilter(group)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[8px] font-bold ${marketGroupFilter === group ? 'border-[#245071] bg-[#113149] text-[#62cbff]' : 'border-[#1a2d3d] bg-[#08131c] text-[#71869a]'}`}>{group}</button>)}</div>{renderMarkets(false)}</>}
          {type === 'watchlist' && renderMarkets(true)}
          {type === 'notifications' && <div className="space-y-2"><button type="button" onClick={() => trigger('Price alerts')} className="w-full rounded-xl border border-[#1a2e3e] bg-[#0a151f] p-3 text-left"><div className="flex items-start gap-2"><Bell size={16} className="mt-0.5 text-[#55c7ff]"/><div><b className="text-[11px] text-[#edf3f7]">Price alert ready</b><p className="mt-1 text-[9px] leading-4 text-[#73869a]">Tap to open the frontend alert state.</p></div></div></button><button type="button" onClick={() => trigger('Risk notifications')} className="w-full rounded-xl border border-[#1a2e3e] bg-[#0a151f] p-3 text-left"><div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 text-[#42d7a2]"/><div><b className="text-[11px] text-[#edf3f7]">Risk status</b><p className="mt-1 text-[9px] leading-4 text-[#73869a]">Pre-trade challenge risk is now shown beside the ticket.</p></div></div></button></div>}
          {type === 'profile' && <div className="space-y-2"><div className="flex items-center gap-3 rounded-2xl border border-[#1a2d3d] bg-[#0a151f] p-3"><div className="grid size-11 place-items-center rounded-full bg-[#10283a] text-[#67ccff]"><UserRound size={21}/></div><div><b className="text-[12px] text-[#f0f5f9]">{account.accountCode || 'Trading account'}</b><p className="mt-1 text-[9px] text-[#718398]">{account.accountType || 'ACG Trader'} · {account.status || 'UNKNOWN'}</p></div></div>{actionRows([['Account settings', Settings], ['Trading preferences', Activity], ['Help & support', HelpCircle]])}</div>}
          {type === 'indicators' && <IndicatorManager applied={indicators} favorites={indicatorFavorites} onAdd={onAddIndicator} onRemove={onRemoveIndicator} onToggleVisible={onToggleIndicator} onUpdate={onUpdateIndicator} onToggleFavorite={onToggleIndicatorFavorite} />}
          {type === 'history' && <div className="grid h-40 place-items-center text-center"><button type="button" onClick={() => trigger('Trade history')} className="rounded-2xl px-6 py-5"><Clock3 size={24} className="mx-auto text-[#526b80]"/><b className="mt-3 block text-[11px] text-[#a8b7c5]">History is in the terminal panel</b><p className="mt-1 text-[9px] text-[#62768a]">Closed positions and the execution journal now update locally.</p></button></div>}
          {type === 'more' && (
            <div className="space-y-4">
              <section>
                <div className="mb-2 flex items-center justify-between px-1"><b className="text-[9px] uppercase tracking-[0.12em] text-[#6b8195]">Trading profiles</b><span className="text-[8px] text-[#52687b]">One tap setup</span></div>
                <div className="grid grid-cols-2 gap-2">{tradingProfiles.map(profile => <button key={profile.id} type="button" onClick={() => { onApplyTradingProfile(profile); setMessage(`${profile.name} profile applied.`); }} className="rounded-xl border border-[#193143] bg-[#09151f] p-3 text-left active:bg-[#0d2433]"><b className="text-[10px] text-[#edf3f7]">{profile.name}</b><p className="mt-1.5 text-[8px] leading-4 text-[#6f8396]">{profile.description}</p></button>)}</div>
              </section>

              <section className="rounded-2xl border border-[#193143] bg-[#08131c] p-3">
                <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Activity size={14} className="text-[#59c8ff]"/><b className="text-[10px] text-[#dbe5ed]">Desktop hotkeys</b></div><p className="mt-1 text-[8px] text-[#64798d]">Fast execution without leaving the chart.</p></div><button type="button" onClick={onToggleHotkeys} className={`relative h-6 w-11 rounded-full transition ${terminalPrefs.hotkeysEnabled !== false ? 'bg-[#14557a]' : 'bg-[#172735]'}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${terminalPrefs.hotkeysEnabled !== false ? 'left-6' : 'left-1'}`} /></button></div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[8px]"><Shortcut keys="B / S" label="Buy / Sell"/><Shortcut keys="+ / −" label="Lots"/><Shortcut keys="1 2 3 4" label="1m 5m 15m 1h"/><Shortcut keys="F" label="Fullscreen"/><Shortcut keys="C" label="Close latest"/><Shortcut keys="Shift+C" label="Close all"/><Shortcut keys="Esc" label="Cancel planner"/></div>
              </section>

              <section className="rounded-2xl border border-[#193143] bg-[#08131c] p-3">
                <div className="flex items-center gap-2"><Settings size={14} className="text-[#7d91a5]"/><b className="text-[10px] text-[#dbe5ed]">Saved terminal preferences</b></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[8px]"><Pref label="Timeframe" value={terminalPrefs.timeframe || '1m'}/><Pref label="Chart" value={terminalPrefs.chartMode || 'candles'}/><Pref label="Sizing" value={terminalPrefs.sizingMode || 'lots'}/><Pref label="Risk" value={`${Number(terminalPrefs.riskPercent || 0.5).toFixed(2)}%`}/><Pref label="Lots" value={Number(terminalPrefs.lots || 0.1).toFixed(2)}/><Pref label="Order" value={terminalPrefs.orderType || 'market'}/></div>
              </section>

              {actionRows([['Favorites', Star], ['Platform status', Activity], ['Help', HelpCircle]])}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Shortcut({ keys, label }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-[#61768a]">{label}</span><kbd className="rounded-md border border-[#263a49] bg-[#0d1a24] px-1.5 py-1 font-mono text-[7px] font-bold text-[#b9c7d2]">{keys}</kbd></div>;
}

function Pref({ label, value }) {
  return <div className="rounded-lg border border-[#162a38] bg-[#0a161f] px-2.5 py-2"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#5d7286]">{label}</span><b className="mt-1 block truncate text-[9px] capitalize text-[#c8d4de]">{value}</b></div>;
}
