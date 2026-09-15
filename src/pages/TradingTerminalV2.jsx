import React, { useEffect, useRef, useState } from 'react';
import TopBar from '../components/trading-v2/TopBar.jsx';
import MarketPanel from '../components/trading-v2/MarketPanel.jsx';
import ExecutionPanel from '../components/trading-v2/ExecutionPanel.jsx';
import PositionsPanel from '../components/trading-v2/PositionsPanel.jsx';
import BottomNavbar from '../components/trading-v2/BottomNavbar.jsx';

export default function TradingTerminalV2({ market, tick }) {
  const shellRef = useRef(null);
  const [timeframe, setTimeframe] = useState('1m');
  const [chartMode, setChartMode] = useState('candles');
  const [selectedTool, setSelectedTool] = useState('cursor');
  const [activeNav, setActiveNav] = useState('trade');
  const [favorite, setFavorite] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await shellRef.current?.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (error) {
      console.warn('Fullscreen request was not available', error);
    }
  };

  return (
    <div className="min-h-dvh bg-[#02070c] font-sans text-[#f5f8fb] antialiased">
      <main
        ref={shellRef}
        className="relative mx-auto min-h-dvh w-full max-w-[460px] overflow-x-hidden bg-[#050b12] bg-[radial-gradient(circle_at_top,rgba(26,79,116,0.20),transparent_36%)] pb-[98px]"
      >
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
            fullscreen={fullscreen}
            onFullscreen={toggleFullscreen}
          />

          <ExecutionPanel market={market} />
          <PositionsPanel />
        </div>

        <BottomNavbar active={activeNav} onChange={setActiveNav} />
      </main>
    </div>
  );
}
