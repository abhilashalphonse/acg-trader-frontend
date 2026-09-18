import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import TerminalStatusBanner from './components/TerminalStatusBanner.jsx';
import { useInstrumentCatalog } from './hooks/useInstrumentCatalog.js';
import { useMarketData } from './hooks/useMarketData.js';
import { useTraderAuth } from './hooks/useTraderAuth.js';
import { useTradingStore } from './hooks/useTradingStore.js';
import { deriveTerminalStatus } from './utils/terminalStatus.js';

const TradingTerminalV2 = lazy(() => import('./pages/TradingTerminalV2.jsx'));
const MobileTraderShell = lazy(() => import('./pages/MobileTraderShell.jsx'));

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
  const [activeSymbol, setActiveSymbol] = useState(null);

  useEffect(() => {
    if (!instruments.length) return;
    const currentExists = activeSymbol && instruments.some(item => item.symbol === activeSymbol);
    if (!currentExists) setActiveSymbol(instruments.find(item => item.sessionOpen)?.symbol || instruments[0].symbol);
  }, [activeSymbol, instruments]);

  const { markets, activeTick, activeMarket, status, error: marketError } = useMarketData(instruments, activeSymbol);
  const market = activeMarket || markets[0] || null;

  const primaryAccount = useMemo(() => {
    const granted = auth.principal?.accountIds?.map(String) || [];
    const id = granted.find(accountId => trading.accountsById[accountId]) || granted[0] || Object.keys(trading.accountsById)[0];
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
  }, [auth.principal?.accountIds, trading.accountsById, trading.valuationsByAccountId]);

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
    return <div className="grid min-h-dvh place-items-center bg-[#050b12] text-sm font-semibold text-[#7e93a7]">Loading ACG markets…</div>;
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
  };

  return (
    <>
      <TerminalStatusBanner status={terminalStatus} />
      <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-[#050b12] text-sm font-semibold text-[#7e93a7]">Loading trading terminal…</div>}>
        {isDesktop
          ? <TradingTerminalV2 {...sharedProps} />
          : <MobileTraderShell {...sharedProps} />}
      </Suspense>
    </>
  );
}
