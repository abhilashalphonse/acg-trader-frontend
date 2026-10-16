import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import TerminalStatusBanner from './components/TerminalStatusBanner.jsx';
import ACGStartupLoader from './components/ACGStartupLoader.jsx';
import { useInstrumentCatalog } from './hooks/useInstrumentCatalog.js';
import { useMarketData } from './hooks/useMarketData.js';
import { useTraderAuth } from './hooks/useTraderAuth.js';
import { useTradingStore } from './hooks/useTradingStore.js';
import { useWatchlists } from './hooks/useWatchlists.js';
import { deriveTerminalStatus } from './utils/terminalStatus.js';
import { formatInstrumentPrice } from './utils/instrumentFormatting.js';
import { resolveActiveAccountId } from './utils/accountLifecycleRouting.js';
import { riskCriticalMarketSymbols } from './utils/marketSubscriptions.js';
import { conversionQuoteSymbolsForInstrument } from './utils/verifiedFxConversion.js';
import { isV4DefaultEnabled } from './utils/chartOrderPresentation.js';

const TradingTerminalV2 = lazy(() => import('./pages/TradingTerminalV2.jsx'));
const MobileTraderShell = lazy(() => import('./pages/MobileTraderShell.jsx'));
// Opt-in view only. Ordinary mobile and all desktop traffic keep their current shells.
const MOBILE_AUDIT_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('acg_mobile_audit') === '1';

const LAST_SYMBOL_STORAGE_KEY = 'acg-trader-last-symbol-v1';
const FX_PRIORITY = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'];
const V4_FX_ENABLED = isV4DefaultEnabled(
  import.meta.env.VITE_ACG_EXECUTION_V4_ENABLED,
  typeof window !== 'undefined' ? window.location.search : '',
);

function storedLastSymbol() {
  if (typeof window === 'undefined') return null;
  try {
    return String(window.localStorage.getItem(LAST_SYMBOL_STORAGE_KEY) || '').trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

function chooseStartupSymbol(instruments, watchlistSymbols, lastSymbol) {
  const bySymbol = new Map(instruments.map(item => [String(item.symbol).toUpperCase(), item]));
  const exists = symbol => Boolean(symbol && bySymbol.has(symbol));
  const isOpen = symbol => exists(symbol) && bySymbol.get(symbol)?.sessionOpen === true;
  const watched = (watchlistSymbols || []).map(symbol => String(symbol).toUpperCase()).filter(exists);

  // Returning traders should land back in their own trading context, not a catalog default.
  if (lastSymbol && watched.includes(lastSymbol) && isOpen(lastSymbol)) return lastSymbol;

  const openWatched = watched.find(isOpen);
  if (openWatched) return openWatched;

  // First-use / empty-watchlist priority: liquid FX majors first.
  const openFx = FX_PRIORITY.find(isOpen);
  if (openFx) return openFx;

  if (isOpen('XAUUSD')) return 'XAUUSD';

  // Crypto is the sensible continuity fallback when conventional sessions are closed.
  if (isOpen('BTCUSD')) return 'BTCUSD';

  const anyOpen = instruments.find(item => item.sessionOpen === true)?.symbol;
  if (anyOpen) return anyOpen;

  // Last-resort display only when the backend reports every configured market closed.
  if (exists('BTCUSD')) return 'BTCUSD';
  if (lastSymbol && exists(lastSymbol)) return lastSymbol;
  return watched[0] || instruments[0]?.symbol || null;
}

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = event => setIsDesktop(event.matches);
    setIsDesktop(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  return isDesktop;
}

export default function App() {
  const isDesktop = useDesktopLayout();
  const auth = useTraderAuth();
  const { trading, connection } = useTradingStore();
  const { instruments, loading: instrumentsLoading, error: instrumentsError } = useInstrumentCatalog();
  const watchlists = useWatchlists(instruments);
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [viewportQuoteSymbols, setViewportQuoteSymbols] = useState([]);

  useEffect(() => {
    if (!instruments.length) return;
    const currentExists = activeSymbol && instruments.some(item => item.symbol === activeSymbol);
    if (currentExists) return;

    setActiveSymbol(
      chooseStartupSymbol(
        instruments,
        watchlists.activeSymbols,
        storedLastSymbol(),
      ),
    );
  }, [activeSymbol, instruments, watchlists.activeSymbols]);

  useEffect(() => {
    if (!activeSymbol || typeof window === 'undefined') return;
    try { window.localStorage.setItem(LAST_SYMBOL_STORAGE_KEY, activeSymbol); } catch { /* non-critical preference */ }
  }, [activeSymbol]);

  const handleViewportQuoteSymbols = useCallback(symbols => {
    const normalized = [...new Set((Array.isArray(symbols) ? symbols : [])
      .map(symbol => String(symbol || '').trim().toUpperCase())
      .filter(Boolean))];
    setViewportQuoteSymbols(current => (
      current.length === normalized.length && current.every((symbol, index) => symbol === normalized[index])
        ? current
        : normalized
    ));
  }, []);

  const riskCriticalSymbols = useMemo(() => riskCriticalMarketSymbols({
    positionsById: trading.positionsById,
    ordersById: trading.ordersById,
    grantedAccountIds: auth.principal?.accountIds,
  }), [auth.principal?.accountIds, trading.ordersById, trading.positionsById]);

  // Keep FX conversion quotes subscribed for selected cross-currency instruments,
  // even when the conversion pair is not on the visible watchlist.
  const fxConversionSymbols = useMemo(()=>V4_FX_ENABLED
    ? conversionQuoteSymbolsForInstrument(
      instruments.find(item=>item.symbol===activeSymbol),instruments,'USD')
    : [],[activeSymbol,instruments]);
  const subscriptionSymbols = useMemo(
    () => [...new Set([
      ...fxConversionSymbols,
      ...riskCriticalSymbols,
      ...watchlists.activeSymbols,
      ...viewportQuoteSymbols,
      activeSymbol,
    ].filter(Boolean))],
    [activeSymbol, fxConversionSymbols, riskCriticalSymbols, viewportQuoteSymbols, watchlists.activeSymbols],
  );

  const { markets, activeTick, activeMarket, status, error: marketError } = useMarketData(instruments, activeSymbol, subscriptionSymbols);

  useEffect(() => {
    if (!isDesktop || !activeSymbol || activeMarket?.marketDataAvailable !== false) return;

    const supported = markets.filter(item => (
      item.symbol !== activeSymbol
      && item.marketDataAvailable !== false
    ));
    if (!supported.length) return;

    const watchedRank = new Map((watchlists.activeSymbols || []).map((symbol, index) => [String(symbol).toUpperCase(), index]));
    const watchedFallback = [...supported]
      .filter(item => watchedRank.has(String(item.symbol).toUpperCase()))
      .sort((a, b) => watchedRank.get(String(a.symbol).toUpperCase()) - watchedRank.get(String(b.symbol).toUpperCase()))[0];
    const sameClassLive = supported.find(item => (
      item.assetClass === activeMarket?.assetClass
      && item.live === true
    ));
    const anyLive = supported.find(item => item.live === true);
    const priced = supported.find(item => {
      const value = Number(item.last);
      return Number.isFinite(value) && value > 0;
    });
    const replacement = watchedFallback || sameClassLive || anyLive || priced || supported[0];

    if (replacement?.symbol) setActiveSymbol(replacement.symbol);
  }, [activeMarket?.assetClass, activeMarket?.marketDataAvailable, activeSymbol, isDesktop, markets, watchlists.activeSymbols]);

  const market = activeMarket?.marketDataAvailable === false
    ? (markets.find(item => item.marketDataAvailable !== false) || null)
    : (activeMarket || markets[0] || null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const symbol = String(market?.symbol || activeSymbol || '').replace('/', '').toUpperCase();
    const livePrice = activeTick?.price ?? activeTick?.last ?? activeTick?.mid ?? market?.last ?? market?.bid;
    const formattedPrice = formatInstrumentPrice(livePrice, market, '');

    document.title = symbol && formattedPrice
      ? `${symbol} ${formattedPrice}`
      : symbol
        ? symbol
        : 'ACG Trader';
  }, [activeSymbol, activeTick?.last, activeTick?.mid, activeTick?.price, market?.bid, market?.digits, market?.last, market?.pipSize, market?.symbol, market?.tickSize]);

  const primaryAccount = useMemo(() => {
    const granted = auth.principal?.accountIds?.map(String) || [];
    const id = resolveActiveAccountId({
      selectedAccountId: auth.principal?.selectedAccountId,
      grantedAccountIds: granted,
      snapshotAccountIds: Object.keys(trading.accountsById),
    });
    if (!id) return null;
    const account = trading.accountsById[id] || null;
    const valuation = trading.valuationsByAccountId[id] || null;
    if (!account) return null;
    return {
      ...account,
      id: String(account.id || id),
      valuationStatus: valuation?.valuationStatus || null,
      staleSymbols: valuation?.staleSymbols || [],
    };
  }, [auth.principal?.accountIds, auth.principal?.selectedAccountId, trading.accountsById, trading.valuationsByAccountId]);

  const terminalStatus = deriveTerminalStatus({
    authStatus: auth.status,
    authenticated: auth.authenticated,
    connectionStatus: connection.status,
    account: primaryAccount,
    valuationStatus: primaryAccount?.valuationStatus,
    marketStatus: status,
    activeMarket: market,
  });

  if (instrumentsLoading && !market) {
    return <ACGStartupLoader />;
  }

  if ((instrumentsError || marketError) && !market) {
    const message = instrumentsError?.message || marketError?.message || 'Unable to load ACG Trader markets';
    return <div className="grid min-h-dvh place-items-center bg-[#050b12] px-6 text-center text-sm font-semibold text-[#ff7882]">{message}</div>;
  }

  const sharedProps = {
    market,
    tick: activeTick,
    markets,
    marketStatus: status,
    activeSymbol: market?.symbol || activeSymbol,
    onSelectSymbol: setActiveSymbol,
    watchlists,
    onViewportQuoteSymbolsChange: handleViewportQuoteSymbols,
  };

  return (
    <>
      <TerminalStatusBanner
        status={terminalStatus}
        actionLabel={auth.status === 'reauth-required' ? 'Reconnect' : null}
        actionBusy={auth.refreshing}
        onAction={auth.status === 'reauth-required' ? () => { void auth.refreshSession().catch(() => {}); } : null}
      />
      <Suspense fallback={<ACGStartupLoader />}>
        {isDesktop
          ? <TradingTerminalV2 {...sharedProps} />
          : <MobileTraderShell {...sharedProps} mobileAudit={MOBILE_AUDIT_ENABLED} />}
      </Suspense>
    </>
  );
}
