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

function pipSize(price) {
  return Number(price) > 100 ? 0.01 : 0.0001;
}

function calculatedLots(plan, riskPercent, manualLots) {
  if (!plan || plan.sizingMode !== 'risk') return manualLots;
  const pip = pipSize(plan.entry);
  const slPips = Math.max(0.1, Math.abs(Number(plan.entry) - Number(plan.sl)) / pip);
  const riskDollars = 12500 * (riskPercent / 100);
  return Math.max(0.01, Math.min(100, riskDollars / Math.max(slPips * 10, 0.01)));
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
  const [orderType, setOrderType] = useState('market');
  const [tradePlan, setTradePlan] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
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

  const startPlan = (side, requestedType = orderType) => {
    const marketPrice = Number(side === 'buy' ? market?.ask : market?.bid) || 1.0944;
    const pip = pipSize(marketPrice);
    const pending = requestedType !== 'market';
    let entry = marketPrice;

    if (requestedType === 'limit') entry = side === 'buy' ? marketPrice - 5 * pip : marketPrice + 5 * pip;
    if (requestedType === 'stop' || requestedType === 'stop-limit') entry = side === 'buy' ? marketPrice + 5 * pip : marketPrice - 5 * pip;

    const sl = side === 'buy' ? entry - 4.2 * pip : entry + 4.2 * pip;
    const tp = side === 'buy' ? entry + 8.4 * pip : entry - 8.4 * pip;
    const limitPrice = requestedType === 'stop-limit'
      ? (side === 'buy' ? entry - 1.5 * pip : entry + 1.5 * pip)
      : null;

    setTradePlan({
      side,
      entry,
      sl,
      tp,
      limitPrice,
      marketPrice,
      orderType: requestedType,
      pending,
      sizingMode,
      manualLots: lots,
      expiration: 'GTC',
      stage: 'planning',
      open: false,
    });
  };

  const cancelPlan = () => {
    if (tradePlan?.open) showNotice('Demo position closed locally');
    setTradePlan(null);
  };

  const executePlan = () => {
    if (!tradePlan) return;

    if (tradePlan.pending) {
      const pending = {
        ...tradePlan,
        id: tradePlan.editingOrderId || Date.now(),
        lots: calculatedLots(tradePlan, riskPercent, tradePlan.manualLots ?? lots),
        status: 'pending',
        createdAt: 'Just now',
      };
      setPendingOrders(current => tradePlan.editingOrderId
        ? current.map(order => order.id === tradePlan.editingOrderId ? pending : order)
        : [pending, ...current]);
      showNotice(`${tradePlan.side.toUpperCase()} ${tradePlan.orderType.toUpperCase()} order saved locally`);
      setTradePlan(null);
      return;
    }

    setTradePlan(plan => plan ? { ...plan, open: true, stage: 'open' } : plan);
    showNotice('Frontend demo position opened');
  };

  const modifyPlan = stage => setTradePlan(plan => plan ? { ...plan, stage } : plan);
  const updatePlan = patch => setTradePlan(plan => plan ? { ...plan, ...patch } : plan);

  const manualOrder = order => {
    const side = order.side?.toUpperCase();
    showNotice(`Frontend demo: ${side} ${Number(order.lots).toFixed(2)} ${order.symbol} @ ${order.price}`);
  };

  const cancelPendingOrder = id => {
    setPendingOrders(current => current.filter(order => order.id !== id));
    showNotice('Pending order cancelled locally');
  };

  const modifyPendingOrder = id => {
    const order = pendingOrders.find(item => item.id === id);
    if (!order) return;
    setTradePlan({ ...order, editingOrderId: id, stage: 'ready', open: false, pending: true });
    setOrderType(order.orderType);
    setSizingMode(order.sizingMode || 'lots');
    if (Number.isFinite(order.manualLots)) setLots(order.manualLots);
    showNotice('Pending order loaded on chart');
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
            orderType={orderType}
            setOrderType={setOrderType}
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
                orderType={orderType}
                onOrderTypeChange={setOrderType}
                tradePlan={tradePlan}
                onStartPlan={startPlan}
                onCancelPlan={cancelPlan}
                onExecutePlan={executePlan}
                onModifyPlan={modifyPlan}
                onManualOrder={manualOrder}
                onTradePlanChange={updatePlan}
              />
              <PositionsPanel
                pendingOrders={pendingOrders}
                onCancelPending={cancelPendingOrder}
                onModifyPending={modifyPendingOrder}
              />
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
