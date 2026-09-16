import React, { useEffect, useRef, useState } from 'react';
import TopBar from '../components/trading-v2/TopBar.jsx';
import MarketPanel from '../components/trading-v2/MarketPanel.jsx';
import ExecutionPanel from '../components/trading-v2/ExecutionPanel.jsx';
import PositionsPanel from '../components/trading-v2/PositionsPanel.jsx';
import BottomNavbar from '../components/trading-v2/BottomNavbar.jsx';
import DesktopTerminal from '../components/trading-v2/DesktopTerminal.jsx';
import MobileScalperMode from '../components/trading-v2/MobileScalperMode.jsx';
import FrontendSheet from '../components/trading-v2/FrontendSheet.jsx';

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
  const noticeTimerRef = useRef(null);
  const isDesktop = useDesktopLayout();
  const [timeframe, setTimeframe] = useState('1m');
  const [chartMode, setChartMode] = useState('candles');
  const [selectedTool, setSelectedTool] = useState('cursor');
  const [activeNav, setActiveNav] = useState('trade');
  const [favorite, setFavorite] = useState(true);
  const [chartFocus, setChartFocus] = useState(false);
  const [lots, setLots] = useState(0.10);
  const [sizingMode, setSizingMode] = useState('lots');
  const [riskPercent, setRiskPercent] = useState(0.5);
  const [tradePlan, setTradePlan] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [notice, setNotice] = useState('');

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

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  const showNotice = message => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 2400);
  };

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

  const startPlan = side => {
    const entry = Number(side === 'buy' ? market?.ask : market?.bid) || 1.0944;
    const pip = entry > 100 ? 0.01 : 0.0001;
    const sl = side === 'buy' ? entry - 4.2 * pip : entry + 4.2 * pip;
    const tp = side === 'buy' ? entry + 8.4 * pip : entry - 8.4 * pip;
    setTradePlan({ side, entry, sl, tp, stage: 'planning', open: false });
  };

  const cancelPlan = () => {
    if (tradePlan?.open) showNotice('Demo position closed locally');
    setTradePlan(null);
  };
  const executePlan = () => {
    setTradePlan(plan => plan ? { ...plan, open: true, stage: 'open' } : plan);
    showNotice('Frontend demo position opened');
  };
  const modifyPlan = stage => setTradePlan(plan => plan ? { ...plan, stage } : plan);
  const updatePlan = patch => setTradePlan(plan => plan ? { ...plan, ...patch } : plan);

  const manualOrder = order => {
    const side = order.side?.toUpperCase();
    showNotice(`Frontend demo: ${side} ${Number(order.lots).toFixed(2)} ${order.symbol} @ ${order.price}`);
  };

  const handleNav = id => {
    setActiveNav(id);
    if (id === 'trade') {
      setOverlay(null);
      return;
    }
    setOverlay(id);
  };

  if (isDesktop) {
    return <DesktopTerminal market={market} tick={tick} markets={markets} activeSymbol={activeSymbol} onSelectSymbol={onSelectSymbol} />;
  }

  return (
    <div className="min-h-dvh bg-[#02070c] font-sans text-[#f5f8fb] antialiased">
      <main ref={shellRef} className={chartFocus ? 'relative mx-auto h-dvh w-full max-w-[460px] overflow-hidden bg-[#050b12]' : 'relative mx-auto min-h-dvh w-full max-w-[460px] overflow-x-hidden bg-[#050b12] bg-[radial-gradient(circle_at_top,rgba(26,79,116,0.20),transparent_36%)] pb-[98px]'}>
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
            sizingMode={sizingMode}
            setSizingMode={setSizingMode}
            riskPercent={riskPercent}
            setRiskPercent={setRiskPercent}
            tradePlan={tradePlan}
            onStartPlan={startPlan}
            onCancelPlan={cancelPlan}
            onExecutePlan={executePlan}
            onModifyPlan={modifyPlan}
            onManualOrder={manualOrder}
            onTradePlanChange={updatePlan}
            onIndicators={() => setOverlay('indicators')}
            onExit={exitChartFocus}
          />
        ) : (
          <>
            <TopBar onSearch={() => setOverlay('search')} onNotifications={() => setOverlay('notifications')} onProfile={() => setOverlay('profile')} />
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
                tradePlan={tradePlan}
                onTradePlanChange={updatePlan}
                onSelectInstrument={() => setOverlay('instruments')}
                onIndicators={() => setOverlay('indicators')}
              />

              <ExecutionPanel
                market={market}
                lots={lots}
                onLotsChange={setLots}
                sizingMode={sizingMode}
                onSizingModeChange={setSizingMode}
                riskPercent={riskPercent}
                onRiskPercentChange={setRiskPercent}
                tradePlan={tradePlan}
                onStartPlan={startPlan}
                onCancelPlan={cancelPlan}
                onExecutePlan={executePlan}
                onModifyPlan={modifyPlan}
                onManualOrder={manualOrder}
              />
              <PositionsPanel />
            </div>
            <BottomNavbar active={activeNav} onChange={handleNav} />
          </>
        )}

        {notice && <div className="fixed left-1/2 top-[74px] z-[120] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 rounded-xl border border-[#254155] bg-[#0b1b28]/95 px-3 py-2.5 text-center text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)] backdrop-blur-xl">{notice}</div>}
        {overlay && <FrontendSheet type={overlay} onClose={() => { setOverlay(null); if (activeNav !== 'trade') setActiveNav('trade'); }} markets={markets} activeSymbol={activeSymbol} onSelectSymbol={onSelectSymbol} />}
      </main>
    </div>
  );
}
