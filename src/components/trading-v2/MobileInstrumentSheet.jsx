import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search, Star } from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import { isIndiaInstrument } from '../../utils/marketClassification.js';
import { commodityDisplaySymbol, commoditySearchTerms } from '../../utils/commodityPresentation.js';
import { v4StockListingCountry } from '../../utils/v4MarketsDiscovery.js';

function symbolLabel(symbol = '') {
  const normalized = String(symbol || '').toUpperCase();
  return normalized.length === 6 && /^[A-Z]+$/.test(normalized)
    ? `${normalized.slice(0, 3)}/${normalized.slice(3)}`
    : normalized;
}

function marketGroup(item, auditMobile = false) {
  if (!auditMobile && isIndiaInstrument(item)) return 'India';

  const assetClass = String(item?.assetClass || '').toUpperCase();
  if (assetClass === 'FOREX') return 'Forex';
  if (assetClass === 'METAL') return 'Metals';
  if (assetClass === 'EQUITY' || (auditMobile && ['STOCK','STOCKS'].includes(assetClass))) return 'Stocks';
  if (assetClass === 'CRYPTO') return 'Crypto';
  if (assetClass === 'ENERGY' || assetClass === 'OTHER') return 'Commodities';
  return 'Other';
}

const GROUPS = ['All', 'Forex', 'Metals', 'Commodities', 'India', 'Stocks', 'Crypto'];

function finiteValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '' || value === '—') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return value;
  }
  return null;
}

function marketPrice(item) {
  return finiteValue(item?.last, item?.price, item?.mid, item?.bid, item?.ask) ?? '—';
}

function marketStatus(item) {
  const state = String(item?.marketState || '').toUpperCase();
  if (item?.sessionOpen === false) return { label: 'Closed', tone: 'text-[#68737e]' };
  if (['DISCONNECTED'].includes(state)) return { label: 'Offline', tone: 'text-[#ff7882]' };
  if (item?.isStale === true || state === 'STALE') return { label: 'Stale', tone: 'text-[#e8c35f]' };
  if (item?.live === true || state === 'LIVE') return { label: 'Live', tone: 'text-[#31d79d]' };
  if (['REFRESHING', 'WAITING'].includes(state)) return { label: 'Refreshing', tone: 'text-[#68737e]' };
  return { label: item?.subscribed ? 'Refreshing' : 'Loading', tone: 'text-[#68737e]' };
}

function displayMarketSymbol(item) {
  return commodityDisplaySymbol(item) || item?.displaySymbol || symbolLabel(item?.symbol);
}

export default function MobileInstrumentSheet({
  auditMobile = false,
  markets = [],
  activeSymbol,
  watchlists = null,
  onSelectSymbol = () => {},
  onClose = () => {},
  onViewportQuoteSymbolsChange = () => {},
}) {
  const [tab, setTab] = useState('markets');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('Forex');
  const [stockCountry, setStockCountry] = useState('us');
  const [limit, setLimit] = useState(60);
  const watched = useMemo(() => new Set(watchlists?.activeSymbols || []), [watchlists?.activeSymbols]);
  const scrollRef = useRef(null);
  const rowRefs = useRef(new Map());

  const visibleMarkets = useMemo(
    () => markets.filter(item => (
      item?.marketDataAvailable !== false
      && String(item?.assetClass || '').toUpperCase() !== 'INDEX'
    )),
    [markets],
  );

  const availableGroups = useMemo(() => {
    const present = new Set(visibleMarkets.map(item => marketGroup(item, auditMobile)));
    return GROUPS.filter(item => (!auditMobile || item !== 'India') && (item === 'All' || present.has(item)));
  }, [auditMobile, visibleMarkets]);

  const visibleSavedCount = useMemo(
    () => visibleMarkets.filter(item => watched.has(item.symbol)).length,
    [visibleMarkets, watched],
  );

  const source = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleMarkets.filter(item => {
      if (tab === 'watchlist' && !watched.has(item.symbol)) return false;
      const itemGroup = marketGroup(item, auditMobile);
      if (!q && group !== 'All' && itemGroup !== group) return false;
      if (!q && auditMobile && group === 'Stocks' && v4StockListingCountry(item) !== stockCountry) return false;
      if (!q) return true;
      return `${item.symbol || ''} ${item.displaySymbol || ''} ${item.name || ''} ${item.assetClass || ''} ${itemGroup} ${auditMobile ? v4StockListingCountry(item) || '' : ''} ${commoditySearchTerms(item)}`
        .toLowerCase()
        .includes(q);
    });
  }, [auditMobile, group, stockCountry, query, tab, visibleMarkets, watched]);

  useEffect(() => {
    setLimit(60);
    scrollRef.current?.scrollTo({top:0});
  }, [group, stockCountry, query, tab]);

  const list = source.slice(0, limit);
  const rowSymbolKey = list.map(item => item.symbol).join('|');

  useEffect(() => {
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
        last = Math.min(symbols.length - 1, 12);
      }

      const start = Math.max(0, first - 4);
      const end = Math.min(symbols.length - 1, last + 6);
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
  }, [onViewportQuoteSymbolsChange, rowSymbolKey]);

  const select = symbol => {
    onSelectSymbol(symbol);
    onClose();
  };

  return (
    <section data-mobile-v4-surface={auditMobile ? 'MobileInstrumentSheet' : undefined} className={`${auditMobile ? 'acg-mobile-v4-sheet ' : ''}fixed inset-0 z-[110] flex h-dvh w-full min-h-0 flex-col overflow-hidden bg-[#050505] text-[#f4f7fa]`}>
      <header className="shrink-0 border-b border-white/[0.07] bg-[#070707] pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-2 px-3">
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl text-[#c4ccd4] active:bg-white/[0.06]" aria-label="Back to chart">
            <ChevronLeft size={22} strokeWidth={2}/>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-black tracking-[-0.035em] text-white">Markets</h2>
            <p className="mt-0.5 text-[9px] font-medium text-[#737e89]">{visibleMarkets.length} instruments · tap one to open its chart</p>
          </div>
          <span className="rounded-lg border border-white/[0.07] bg-[#0d0f12] px-2 py-1 text-[8px] font-bold text-[#84909c]">{visibleSavedCount} saved</span>
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
        <div role="group" aria-label="Market categories" className={auditMobile ? 'mt-2 flex flex-wrap gap-1.5 pb-1' : 'mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}>
          {availableGroups.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => { setGroup(item); setLimit(60); }}
              aria-pressed={group === item}
              className={`shrink-0 rounded-lg border px-3 py-2 text-[9px] font-bold transition ${group === item ? 'border-[#195be1]/60 bg-[#11151d] text-white' : 'border-white/[0.06] bg-[#090a0c] text-[#76818c]'}`}
            >
              {item}
            </button>
          ))}
        </div>
        {auditMobile && group === 'Stocks' && !query.trim() && <div role="group" aria-label="Stock listing country" className="mt-1 flex gap-1.5 border-t border-white/[0.07] pt-2">
          {[['us','US'],['india','India']].map(([id,label]) => <button key={id} type="button" aria-pressed={stockCountry === id} onClick={() => setStockCountry(id)} className={`min-h-8 rounded-md px-3 text-[11px] font-medium ${stockCountry === id ? 'bg-[#303035] text-[#f2f2f4]' : 'text-[#9497a2]'}`}>{label}</button>)}
        </div>}
      </div>

      <div ref={scrollRef} data-mobile-market-list aria-label="Market instruments" tabIndex={0} onScroll={auditMobile ? event => {
        const node = event.currentTarget;
        if (node.scrollHeight - node.scrollTop - node.clientHeight < 180) setLimit(current => Math.min(source.length, current + 60));
      } : undefined} className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-[max(12px,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            <div
              key={item.symbol}
              data-mobile-market-symbol={item.symbol}
              ref={node => {
                if (node) rowRefs.current.set(item.symbol, node);
                else rowRefs.current.delete(item.symbol);
              }}
              className={`relative flex min-h-[64px] items-center border-b border-white/[0.055] ${active ? 'bg-[#0b0d11]' : 'bg-transparent'}`}
            >
              {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[#195be1]" aria-hidden="true"/>}
              <button type="button" onClick={() => select(item.symbol)} className="flex min-w-0 flex-1 items-center justify-between py-3 pl-2 text-left">
                <div className="flex min-w-0 items-center gap-3">
                  <InstrumentAvatar instrument={item} size={30}/>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-[12px] font-black text-[#f2f5f8]">{displayMarketSymbol(item)}</b>
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.05em] text-[#6f7b87]">{marketGroup(item, auditMobile)}</span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-[#68737e]">{item.name || item.symbol}</p>
                  </div>
                </div>
                <div className="ml-3 text-right">
                  <b className="block font-mono text-[11px] font-bold tabular-nums text-[#dce3e9]">{marketPrice(item)}</b>
                  {(() => {
                    const status = marketStatus(item);
                    return <span className={`mt-1 block text-[8px] font-semibold ${status.tone}`}>{status.label}</span>;
                  })()}
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
