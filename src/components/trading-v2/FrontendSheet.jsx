import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Bell, UserRound, Activity, Star, Clock3, Settings, ShieldCheck } from 'lucide-react';
import IndicatorManager from './IndicatorManager.jsx';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import ShareProfileEditor from './ShareProfileEditor.jsx';

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
  const [marketGroupFilter, setMarketGroupFilter] = useState('Forex');
  const [visibleMarketLimit, setVisibleMarketLimit] = useState(60);
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

  useEffect(() => {
    setVisibleMarketLimit(60);
  }, [marketGroupFilter, query, type]);

  const titleMap = { search: 'Search markets', notifications: 'Notifications', profile: 'Account', instruments: 'Select instrument', indicators: 'Indicators', watchlist: 'Watchlist', markets: 'Markets', history: 'History', more: 'Terminal', platform: 'Platform settings', help: 'Help & support' };

  const renderMarkets = favoritesOnly => {
    const watched = new Set(watchlists?.activeSymbols || []);
    const source = favoritesOnly ? filteredMarkets.filter(item => watched.has(item.symbol)) : filteredMarkets;
    const list = source.slice(0, visibleMarketLimit);

    if (!source.length) {
      return (
        <div className="grid min-h-36 place-items-center border-y border-dashed border-white/[0.08] bg-black px-5 text-center">
          <div>
            <b className="text-[10px] text-[#9eafbe]">No instruments found</b>
            <p className="mt-1 text-[8px] text-[#5d7185]">Try another symbol, name or market group.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="border-t border-white/[0.08]">
        {list.map(item => {
          const isWatched = watched.has(item.symbol);
          const isActive = activeSymbol === item.symbol;

          return (
            <div
              key={item.symbol}
              className={`flex items-center gap-2 border-b border-white/[0.08] ${isActive ? 'bg-[#080808]' : 'bg-black'}`}
            >
              <button
                type="button"
                onClick={() => { onSelectSymbol(item.symbol); onClose(); }}
                className="flex min-w-0 flex-1 items-center justify-between px-1 py-3 text-left"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <InstrumentAvatar instrument={item} size={28}/>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-[12px] font-black text-[#f1f5f8]">{item.displaySymbol || symbolLabel(item.symbol)}</strong>
                      <span className="rounded-md bg-[#101010] px-1.5 py-0.5 text-[7px] font-black text-[#738ba0]">{marketGroup(item)}</span>
                    </div>
                    <p className="mt-1 truncate text-[8px] text-[#60758a]">{item.name || 'Market instrument'}</p>
                  </div>
                </div>
                <div className="ml-3 text-right">
                  <b className="block font-mono text-[11px] font-bold text-[#dce5ec]">{item.subscribed ? (item.bid ?? '—') : '—'}</b>
                  <span className={`mt-1 block text-[8px] ${item.live ? 'text-[#31d79d]' : item.isStale ? 'text-[#e8c35f]' : 'text-[#60758a]'}`}>
                    {item.subscribed ? (item.sessionOpen === false ? 'Closed' : item.live ? 'Live' : item.isStale ? 'Stale' : item.marketState || 'Waiting') : 'Open for quote'}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => watchlists?.toggleSymbol?.(item.symbol)}
                aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
                className={`grid size-10 shrink-0 place-items-center ${isWatched ? 'text-[#f6c95d]' : 'text-[#7b8ea0] hover:text-[#f6c95d]'}`}
              >
                <Star size={16} fill={isWatched ? 'currentColor' : 'none'}/>
              </button>
            </div>
          );
        })}
        {source.length > list.length && (
          <button
            type="button"
            onClick={() => setVisibleMarketLimit(limit => limit + 60)}
            className="h-11 w-full border-b border-white/[0.08] bg-black text-[9px] font-bold text-[#69cfff]"
          >
            Show more · {source.length - list.length} remaining
          </button>
        )}
      </div>
    );
  };

  const isIndicators = type === 'indicators';
  const isMarketSheet = type === 'search' || type === 'instruments' || type === 'markets';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 px-2 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section onMouseDown={event => event.stopPropagation()} className={`${isMarketSheet ? 'flex h-[84dvh] min-h-0 flex-col bg-black' : isIndicators ? 'max-h-[90dvh] bg-[#080808]' : 'max-h-[84dvh] bg-[#080808]'} mb-[max(8px,env(safe-area-inset-bottom))] w-full max-w-[444px] overflow-hidden rounded-[24px] border border-white/[0.08] shadow-[0_30px_90px_rgba(0,0,0,.65)]`}>
        <header className={`flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] ${isMarketSheet ? 'bg-black px-4 pb-4 pt-4' : 'px-4 py-3.5'}`}><div><h2 className={`${isMarketSheet ? 'text-[20px] tracking-[-0.035em]' : 'text-[15px]'} font-black text-[#f3f7fb]`}>{titleMap[type] || 'ACG Trader'}</h2><p className={`${isMarketSheet ? 'mt-1 text-[9px] text-[#718397]' : 'mt-0.5 text-[9px] text-[#6e8195]'}`}>{isIndicators ? 'Technical studies · live chart' : type === 'more' ? 'Profiles, preferences and shortcuts' : type === 'platform' ? 'Terminal preferences and trading profiles' : type === 'notifications' ? 'Terminal and risk alerts' : type === 'profile' ? 'Trading account summary' : type === 'help' ? 'Using ACG Trader' : 'Markets and terminal tools'}</p></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#93a6b8]"><X size={17}/></button></header>
        <div className={`${isMarketSheet ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2' : isIndicators ? 'max-h-[calc(90dvh-70px)] overflow-y-auto p-3' : 'max-h-[calc(84dvh-70px)] overflow-y-auto p-3'} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          {message && <div className="mb-3 rounded-md border border-white/[0.08] bg-[#101010] px-3 py-2.5 text-[9px] leading-4 text-[#a9c5d8]">{message}</div>}
          {isMarketSheet && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0">
                <div className="mb-2 flex h-11 items-center gap-2 border-y border-white/[0.08] bg-black px-1"><Search size={15} className="text-[#6f8295]"/><input autoFocus={type === 'search'} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search 300 markets…" className="min-w-0 flex-1 bg-transparent text-[12px] text-[#eef4f8] outline-none placeholder:text-[#53677b]"/></div>
                <div className="mb-3 flex gap-1 overflow-x-auto border-b border-white/[0.08] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{MARKET_GROUPS.map(group => <button key={group} type="button" onClick={() => setMarketGroupFilter(group)} className={`shrink-0 border-b-2 px-2.5 py-1.5 text-[8px] font-black ${marketGroupFilter === group ? 'border-[#62cbff] text-[#dce9f2]' : 'border-transparent text-[#60758a]'}`}>{group}</button>)}</div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {renderMarkets(false)}
              </div>
            </div>
          )}
          {type === 'watchlist' && renderMarkets(true)}
          {type === 'notifications' && <div className="space-y-2"><div className="rounded-md border border-white/[0.08] bg-[#080808] p-3"><div className="flex items-start gap-2"><Bell size={16} className="mt-0.5 text-[#55c7ff]"/><div><b className="text-[11px] text-[#edf3f7]">Terminal alerts</b><p className="mt-1 text-[9px] leading-4 text-[#73869a]">Execution, connection and market-state alerts appear automatically while you trade.</p></div></div></div><div className="rounded-md border border-white/[0.08] bg-[#080808] p-3"><div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 text-[#42d7a2]"/><div><b className="text-[11px] text-[#edf3f7]">Risk alerts</b><p className="mt-1 text-[9px] leading-4 text-[#73869a]">Challenge limits and exposure blocks are shown beside the order ticket.</p></div></div></div></div>}
          {type === 'profile' && <div className="space-y-3"><div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#080808] p-3"><div className="grid size-11 place-items-center rounded-full bg-[#101010] text-[#67ccff]"><UserRound size={21}/></div><div className="min-w-0"><b className="block truncate text-[12px] text-[#f0f5f9]">{account.accountCode || 'Trading account'}</b><p className="mt-1 text-[9px] text-[#718398]">{account.accountType || 'ACG Trader'} · {account.status || 'UNKNOWN'}</p></div></div><div className="grid grid-cols-2 gap-2"><Pref label="Currency" value={account.currency || 'USD'}/><Pref label="Leverage" value={account.leverage ? `1:${account.leverage}` : '—'}/><Pref label="Valuation" value={account.valuationStatus || 'Waiting'}/><Pref label="Trading" value={account.tradingEnabled === false ? 'Disabled' : 'Enabled'}/></div><ShareProfileEditor compact /></div>}
          {type === 'indicators' && <IndicatorManager applied={indicators} favorites={indicatorFavorites} onAdd={onAddIndicator} onRemove={onRemoveIndicator} onToggleVisible={onToggleIndicator} onUpdate={onUpdateIndicator} onToggleFavorite={onToggleIndicatorFavorite} />}
          {type === 'history' && <div className="grid h-40 place-items-center text-center"><div className="rounded-2xl px-6 py-5"><Clock3 size={24} className="mx-auto text-[#526b80]"/><b className="mt-3 block text-[11px] text-[#a8b7c5]">History is available from the History tab</b><p className="mt-1 text-[9px] text-[#62768a]">Executed deals, orders and this browser session are shown there.</p></div></div>}
          {type === 'more' && (
            <div className="space-y-4">
              <section>
                <div className="mb-2 flex items-center justify-between px-1"><b className="text-[9px] uppercase tracking-[0.12em] text-[#6b8195]">Trading profiles</b><span className="text-[8px] text-[#52687b]">One tap setup</span></div>
                <div className="grid grid-cols-2 gap-2">{tradingProfiles.map(profile => <button key={profile.id} type="button" onClick={() => { onApplyTradingProfile(profile); setMessage(`${profile.name} profile applied.`); }} className="rounded-md border border-white/[0.08] bg-[#080808] p-3 text-left active:bg-[#101010]"><b className="text-[10px] text-[#edf3f7]">{profile.name}</b><p className="mt-1.5 text-[8px] leading-4 text-[#6f8396]">{profile.description}</p></button>)}</div>
              </section>

              <section className="rounded-lg border border-white/[0.08] bg-[#080808] p-3">
                <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Activity size={14} className="text-[#59c8ff]"/><b className="text-[10px] text-[#dbe5ed]">Desktop hotkeys</b></div><p className="mt-1 text-[8px] text-[#64798d]">Fast execution without leaving the chart.</p></div><button type="button" onClick={onToggleHotkeys} className={`relative h-6 w-11 rounded-full transition ${terminalPrefs.hotkeysEnabled !== false ? 'bg-[#101010]' : 'bg-[#101010]'}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${terminalPrefs.hotkeysEnabled !== false ? 'left-6' : 'left-1'}`} /></button></div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[8px]"><Shortcut keys="B / S" label="Buy / Sell"/><Shortcut keys="+ / −" label="Lots"/><Shortcut keys="1 2 3 4" label="1m 5m 15m 1h"/><Shortcut keys="F" label="Fullscreen"/><Shortcut keys="C" label="Close latest"/><Shortcut keys="Shift+C" label="Close all"/><Shortcut keys="Esc" label="Cancel planner"/></div>
              </section>

              <section className="rounded-lg border border-white/[0.08] bg-[#080808] p-3">
                <div className="flex items-center gap-2"><Settings size={14} className="text-[#7d91a5]"/><b className="text-[10px] text-[#dbe5ed]">Saved terminal preferences</b></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[8px]"><Pref label="Timeframe" value={terminalPrefs.timeframe || '1m'}/><Pref label="Chart" value={terminalPrefs.chartMode || 'candles'}/><Pref label="Sizing" value={terminalPrefs.sizingMode || 'lots'}/><Pref label="Risk" value={`${Number(terminalPrefs.riskPercent || 0.5).toFixed(2)}%`}/><Pref label="Lots" value={Number(terminalPrefs.lots || 0.1).toFixed(2)}/><Pref label="Order" value={terminalPrefs.orderType || 'market'}/></div>
              </section></div>
          )}
          {type === 'platform' && (
            <div className="space-y-4">
              <section>
                <div className="mb-2 px-1"><b className="text-[9px] uppercase tracking-[0.12em] text-[#6b8195]">Terminal preferences</b></div>
                <div className="grid grid-cols-2 gap-2">
                  <Pref label="Timeframe" value={terminalPrefs.timeframe || '1m'}/>
                  <Pref label="Chart" value={terminalPrefs.chartMode || 'candles'}/>
                  <Pref label="Sizing" value={terminalPrefs.sizingMode || 'lots'}/>
                  <Pref label="Risk" value={`${Number(terminalPrefs.riskPercent || 0.5).toFixed(2)}%`}/>
                  <Pref label="Lots" value={Number(terminalPrefs.lots || 0.1).toFixed(2)}/>
                  <Pref label="Order" value={terminalPrefs.orderType || 'market'}/>
                </div>
                <p className="mt-2 px-1 text-[8px] leading-4 text-[#60758a]">These preferences are saved automatically as you trade.</p>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between px-1"><b className="text-[9px] uppercase tracking-[0.12em] text-[#6b8195]">Trading profiles</b><span className="text-[8px] text-[#52687b]">One tap setup</span></div>
                <div className="grid grid-cols-2 gap-2">{tradingProfiles.map(profile => <button key={profile.id} type="button" onClick={() => { onApplyTradingProfile(profile); setMessage(`${profile.name} profile applied.`); }} className="rounded-md border border-white/[0.08] bg-[#080808] p-3 text-left active:bg-[#101010]"><b className="text-[10px] text-[#edf3f7]">{profile.name}</b><p className="mt-1.5 text-[8px] leading-4 text-[#6f8396]">{profile.description}</p></button>)}</div>
              </section>
            </div>
          )}
           {type === 'help' && <div className="space-y-2"><div className="rounded-lg border border-white/[0.08] bg-[#080808] p-4"><b className="text-[11px] text-[#edf3f7]">Trading help</b><p className="mt-2 text-[9px] leading-4 text-[#71869a]">Use Search to find markets, Chart to place and manage trades, Trade for positions and orders, and History for completed activity.</p></div><div className="rounded-lg border border-white/[0.08] bg-[#080808] p-4"><b className="text-[11px] text-[#edf3f7]">Account or challenge support</b><p className="mt-2 text-[9px] leading-4 text-[#71869a]">Account, payment and challenge support is handled from your ACG Funded account.</p></div></div>}
       </div>
      </section>
    </div>
  );
}

function Shortcut({ keys, label }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-[#61768a]">{label}</span><kbd className="rounded-md border border-white/[0.08] bg-[#101010] px-1.5 py-1 font-mono text-[7px] font-bold text-[#b9c7d2]">{keys}</kbd></div>;
}

function Pref({ label, value }) {
  return <div className="rounded-lg border border-white/[0.08] bg-[#080808] px-2.5 py-2"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#5d7286]">{label}</span><b className="mt-1 block truncate text-[9px] capitalize text-[#c8d4de]">{value}</b></div>;
}
