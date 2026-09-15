import React, { useEffect, useRef, useState } from 'react';
import TopBar from '../components/trading-v2/TopBar.jsx';
import MarketPanel from '../components/trading-v2/MarketPanel.jsx';
import ExecutionPanel from '../components/trading-v2/ExecutionPanel.jsx';
import PositionsPanel from '../components/trading-v2/PositionsPanel.jsx';
import BottomNavbar from '../components/trading-v2/BottomNavbar.jsx';
import DesktopTerminal from '../components/trading-v2/DesktopTerminal.jsx';
import MobileScalperMode from '../components/trading-v2/MobileScalperMode.jsx';

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

export default function TradingTerminalV2({
  market,
  tick,
  markets = [],
  activeSymbol = market?.symbol,
  onSelectSymbol = () => {},
}) {
  const shellRef = useRef(null);
  const nativeFullscreenRequestedRef = useRef(false);
  const isDesktop = useDesktopLayout();
  const [timeframe, setTimeframe] = useState('1m');
  const [chartMode, setChartMode] = useState('candles');
  const [selectedTool, setSelectedTool] = useState('cursor');
  const [activeNav, setActiveNav] = useState('trade');
  const [favorite, setFavorite] = useState(true);
  const [chartFocus, setChartFocus] = useState(false);
  const [lots, setLots] = useState(0.10);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (nativeFullscreenRequestedRef.current && !document.fullscreenElement) {
        nativeFullscreenRequestedRef.current = false;
        setChartFocus(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const enterChartFocus = async () => {
    setChartFocus(true);
    try {
      if (!document.fullscreenElement && shellRef.current?.requestFullscreen) {
        nativeFullscreenRequestedRef.current = true;
        await shellRef.current.requestFullscreen();
      }
    } catch (error) {
      nativeFullscreenRequestedRef.current = false;
      console.warn('Native fullscreen was unavailable; using in-app chart focus mode instead', error);
    }
  };

  const exitChartFocus = async () => {
    setChartFocus(false);
    nativeFullscreenRequestedRef.current = false;
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
    } catch (error) {
      console.warn('Unable to exit native fullscreen', error);
    }
  };

  if (isDesktop) {
    return (
      <DesktopTerminal
        market={market}
        tick={tick}
        markets={markets}
        activeSymbol={activeSymbol}
        onSelectSymbol={onSelectSymbol}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#02070c] font-sans text-[#f5f8fb] antialiased">
      <main
        ref={shellRef}
        className={chartFocus
          ? 'relative mx-auto h-dvh w-full max-w-[460px] overflow-hidden bg-[#050b12]'
          : 'relative mx-auto min-h-dvh w-full max-w-[460px] overflow-x-hidden bg-[#050b12] bg-[radial-gradient(circle_at_top,rgba(26,79,116,0.20),transparent_36%)] pb-[98px]'}
      >
        {chartFocus ? (
          <MobileScalperMode
            market={market}
            tick={tick}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            chartMode={chartMode}
            setChartMode={setChartMode}
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            lots={lots}
            setLots={setLots}
            onExit={exitChartFocus}
          />
        ) : (
          <>
            <TopBar />

            <div className="px-2">
              <MarketPanel
                market={market}
                tick={tick}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                chartMode={chartMode}
                setChartMode={setChartMode}
                selectedTool={selectedTool}
                setSelectedTool={setSelectedTool}
                favorite={favorite}
                setFavorite={setFavorite}
                fullscreen={chartFocus}
                onFullscreen={enterChartFocus}
              />

              <ExecutionPanel market={market} lots={lots} onLotsChange={setLots} />
              <PositionsPanel />
            </div>

            <BottomNavbar active={activeNav} onChange={setActiveNav} />
          </>
        )}
      </main>
    </div>
  );
}
