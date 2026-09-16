import React, { useEffect, useRef, useState } from 'react';
import TopBar from '../components/trading-v2/TopBar.jsx';
import MarketPanel from '../components/trading-v2/MarketPanel.jsx';
import ExecutionPanel from '../components/trading-v2/ExecutionPanel.jsx';
import PositionsPanel from '../components/trading-v2/PositionsPanel.jsx';
import BottomNavbar from '../components/trading-v2/BottomNavbar.jsx';
import DesktopTerminal from '../components/trading-v2/DesktopTerminal.jsx';
import MobileScalperMode from '../components/trading-v2/MobileScalperMode.jsx';
import FrontendSheet from '../components/trading-v2/FrontendSheet.jsx';
import WatchlistSection from '../components/trading-v2/WatchlistSection.jsx';
import { createIndicator, INDICATOR_LIBRARY } from '../utils/indicators.js';

const INDICATOR_STORAGE_KEY = 'acg-trader-indicators-v1';
const INDICATOR_FAVORITES_KEY = 'acg-trader-indicator-favorites-v1';

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

function loadIndicators() {
  if (typeof window === 'undefined') return [createIndicator('volume')].filter(Boolean);
  try {
    const stored = JSON.parse(window.localStorage.getItem(INDICATOR_STORAGE_KEY) || 'null');
    if (Array.isArray(stored)) return stored;
  } catch (_) { /* fall back to defaults */ }
  return [createIndicator('volume')].filter(Boolean);
}

function loadIndicatorFavorites() {
  const defaults = INDICATOR_LIBRARY.filter(item => item.favorite).map(item => item.id);
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = JSON.parse(window.localStorage.getItem(INDICATOR_FAVORITES_KEY) || 'null');
    if (Array.isArray(stored)) return stored;
  } catch (_) { /* fall back to defaults */ }
  return defaults;
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

function formatVolume(value) {
  return Math.max(0.01, Number(value) || 0.01).toFixed(2);
}

function initialPositionRows() {
  return [
    { id: 1, symbol: 'AUDCAD', side: 'BUY', volume: 0.01, entry: 0.99342, pnl: 0.18, tp: 0.995, sl: 0.99, trailingEnabled: false, trailingPips: 5 },
    { id: 2, symbol: 'EURUSD', side: 'SELL', volume: 0.02, entry: 1.0846, pnl: 0.78, tp: 1.08, sl: 1.09, trailingEnabled: false, trailingPips: 5 },
  ];
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
  const [positions, setPositions] = useState(initialPositionRows);
  const [positionHistory, setPositionHistory] = useState([]);
  const [indicators, setIndicators] = useState(loadIndicators);
  const [indicatorFavorites, setIndicatorFavorites] = useState(loadIndicatorFavorites);
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

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(indicators));
  }, [indicators]);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(INDICATOR_FAVORITES_KEY, JSON.stringify(indicatorFavorites));
  }, [indicatorFavorites]);

  const showNotice = message => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 2400);
  };

  const addIndicator = id => {
    setIndicators(current => {
      if (id === 'volume') {
        const existing = current.find(item => item.id === 'volume');
        if (existing) return current.map(item => item.instanceId === existing.instanceId ? { ...item, visible: true } : item);
      }
      const created = createIndicator(id);
      return created ? [...current, created] : current;
    });
  };

  const removeIndicator = instanceId => setIndicators(current => current.filter(item => item.instanceId !== instanceId));
  const toggleIndicator = instanceId => setIndicators(current => current.map(item => item.instanceId === instanceId ? { ...item, visible: item.visible === false } : item));
  const updateIndicator = (instanceId, patch) => setIndicators(current => current.map(item => item.instanceId === instanceId ? { ...item, settings: { ...item.settings, ...patch } } : item));
  const toggleIndicatorFavorite = id => setIndicatorFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const indicatorSheetProps = {
    indicators,
    indicatorFavorites,
    onAddIndicator: addIndicator,
    onRemoveIndicator: removeIndicator,
    onToggleIndicator: toggleIndicator,
    onUpdateIndicator: updateIndicator,
    onToggleIndicatorFavorite: toggleIndicatorFavorite,
  };

  const currentPriceFor = (symbol, side) => {
    if (symbol === market?.symbol) return Number(side === 'BUY' ? market?.ask : market?.bid) || 0;
    const quote = markets.find(item => item.symbol === symbol);
    return Number(side === 'BUY' ? quote?.ask : quote?.bid) || 0;
  };

  const addPosition = ({ symbol, side, volume, entry, sl = null, tp = null, source = 'market' }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const position = {
      id,
      symbol,
      side: String(side).toUpperCase(),
      volume: Number(formatVolume(volume)),
      entry: Number(entry),
      sl: sl == null ? null : Number(sl),
      tp: tp == null ? null : Number(tp),
      pnl: 0,
      source,
      trailingEnabled: false,
      trailingPips: 5,
      openedAt: 'Just now',
    };
    setPositions(current => [position, ...current]);
    return id;
  };

  const closePosition = (id, percentage = 100) => {
    const position = positions.find(item => item.id === id);
    if (!position) return;

    const currentVolume = Number(position.volume);
    const requested = Math.max(1, Math.min(100, Number(percentage) || 100));
    const closeVolume = Math.min(currentVolume, Math.max(0.01, Number((currentVolume * requested / 100).toFixed(2))));
    const fullyClosed = closeVolume >= currentVolume - 0.000001;

    setPositionHistory(current => [{
      ...position,
      id: `${position.id}-${Date.now()}`,
      volume: closeVolume,
      closedAt: 'Just now',
      closeType: fullyClosed ? 'Closed' : `${requested}% partial`,
    }, ...current]);

    setPositions(current => fullyClosed
      ? current.filter(item => item.id !== id)
      : current.map(item => item.id === id ? { ...item, volume: Number((currentVolume - closeVolume).toFixed(2)) } : item));

    if (tradePlan?.positionId === id && fullyClosed) setTradePlan(null);
    showNotice(fullyClosed ? 'Position closed locally' : `${requested}% of position closed locally`);
  };

  const closeAllPositions = () => {
    if (!positions.length) return;
    const closed = positions.map(position => ({ ...position, id: `${position.id}-${Date.now()}`, closedAt: 'Just now', closeType: 'Close all' }));
    setPositionHistory(current => [...closed, ...current]);
    setPositions([]);
    if (tradePlan?.open) setTradePlan(null);
    showNotice('All frontend positions closed');
  };

  const updatePosition = (id, patch) => {
    setPositions(current => current.map(position => position.id === id ? { ...position, ...patch } : position));
  };

  const movePositionToBreakEven = id => {
    const position = positions.find(item => item.id === id);
    if (!position) return;
    const sl = Number(position.entry);
    updatePosition(id, { sl });
    if (tradePlan?.positionId === id) setTradePlan(plan => plan ? { ...plan, sl } : plan);
    showNotice('Stop loss moved to break even');
  };

  const reversePosition = id => {
    const position = positions.find(item => item.id === id);
    if (!position) return;

    const nextSide = position.side === 'BUY' ? 'SELL' : 'BUY';
    const quote = currentPriceFor(position.symbol, nextSide) || Number(position.entry);
    const oldEntry = Number(position.entry);
    const slDistance = position.sl == null ? null : Math.abs(oldEntry - Number(position.sl));
    const tpDistance = position.tp == null ? null : Math.abs(Number(position.tp) - oldEntry);
    const nextSl = slDistance == null ? null : (nextSide === 'BUY' ? quote - slDistance : quote + slDistance);
    const nextTp = tpDistance == null ? null : (nextSide === 'BUY' ? quote + tpDistance : quote - tpDistance);

    updatePosition(id, {
      side: nextSide,
      entry: quote,
      sl: nextSl,
      tp: nextTp,
      pnl: 0,
      openedAt: 'Reversed just now',
    });

    if (tradePlan?.positionId === id) {
      setTradePlan(plan => plan ? {
        ...plan,
        side: nextSide.toLowerCase(),
        entry: quote,
        sl: nextSl,
        tp: nextTp,
        stage: 'open',
      } : plan);
    }
    showNotice('Position reversed locally');
  };

  const setPositionTrailing = (id, enabled, pips) => {
    updatePosition(id, { trailingEnabled: Boolean(enabled), trailingPips: Math.max(1, Number(pips) || 5) });
    showNotice(enabled ? `Trailing stop set to ${Math.max(1, Number(pips) || 5)} pips` : 'Trailing stop disabled');
  };

  const duplicatePosition = id => {
    const position = positions.find(item => item.id === id);
    if (!position) return;
    const quote = currentPriceFor(position.symbol, position.side) || Number(position.entry);
    addPosition({ ...position, entry: quote, source: 'duplicate' });
    showNotice('Position duplicated locally');
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
    if (tradePlan?.open && tradePlan?.positionId) {
      closePosition(tradePlan.positionId, 100);
      return;
    }
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

    const volume = calculatedLots(tradePlan, riskPercent, tradePlan.manualLots ?? lots);
    const positionId = addPosition({
      symbol: market?.symbol,
      side: tradePlan.side,
      volume,
      entry: tradePlan.entry,
      sl: tradePlan.sl,
      tp: tradePlan.tp,
      source: 'risk-plan',
    });
    setTradePlan(plan => plan ? { ...plan, positionId, open: true, stage: 'open' } : plan);
    showNotice('Frontend demo position opened');
  };

  const modifyPlan = stage => setTradePlan(plan => plan ? { ...plan, stage } : plan);
  const updatePlan = patch => {
    if (tradePlan?.open && tradePlan.positionId) {
      const positionPatch = {};
      if (patch.sl != null) positionPatch.sl = patch.sl;
      if (patch.tp != null) positionPatch.tp = patch.tp;
      if (Object.keys(positionPatch).length) updatePosition(tradePlan.positionId, positionPatch);
    }
    setTradePlan(plan => plan ? { ...plan, ...patch } : plan);
  };

  const manualOrder = order => {
    const side = order.side?.toUpperCase();
    addPosition({
      symbol: order.symbol,
      side,
      volume: order.lots,
      entry: order.price,
      source: 'one-click',
    });
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
    setActiveNav('trade');
    setOverlay(null);
    showNotice('Pending order loaded on chart');
  };

  const openTradeFromWatchlist = symbol => {
    onSelectSymbol(symbol);
    setActiveNav('trade');
    setOverlay(null);
  };

  const handleNav = id => {
    setActiveNav(id);
    if (id === 'trade' || id === 'watchlist') {
      setOverlay(null);
      return;
    }
    setOverlay(id);
  };

  if (isDesktop) {
    return (
      <>
        <DesktopTerminal
          market={market}
          tick={tick}
          markets={markets}
          activeSymbol={activeSymbol}
          onSelectSymbol={onSelectSymbol}
          positions={positions}
          positionHistory={positionHistory}
          onClosePosition={closePosition}
          onCloseAllPositions={closeAllPositions}
          onBreakEven={movePositionToBreakEven}
          onReversePosition={reversePosition}
          onUpdatePosition={updatePosition}
          onSetTrailing={setPositionTrailing}
          onDuplicatePosition={duplicatePosition}
          onManualOrder={manualOrder}
          indicators={indicators}
          onOpenIndicators={() => setOverlay('indicators')}
        />
        {overlay === 'indicators' && <FrontendSheet type="indicators" onClose={() => setOverlay(null)} markets={markets} activeSymbol={activeSymbol} onSelectSymbol={onSelectSymbol} {...indicatorSheetProps} />}
      </>
    );
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
            indicators={indicators}
            onExit={exitChartFocus}
          />
        ) : (
          <>
            {activeNav === 'watchlist' ? (
              <WatchlistSection
                markets={markets}
                activeSymbol={activeSymbol}
                onOpenTrade={openTradeFromWatchlist}
                onAddInstrument={() => setOverlay('search')}
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
                    indicators={indicators}
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
                    positions={positions}
                    positionHistory={positionHistory}
                    pendingOrders={pendingOrders}
                    onClosePosition={closePosition}
                    onCloseAll={closeAllPositions}
                    onBreakEven={movePositionToBreakEven}
                    onReverse={reversePosition}
                    onUpdatePosition={updatePosition}
                    onSetTrailing={setPositionTrailing}
                    onDuplicate={duplicatePosition}
                    onCancelPending={cancelPendingOrder}
                    onModifyPending={modifyPendingOrder}
                  />
                </div>
              </>
            )}
            <BottomNavbar active={activeNav} onChange={handleNav} />
          </>
        )}

        {notice && <div className="fixed left-1/2 top-[74px] z-[120] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 rounded-xl border border-[#254155] bg-[#0b1b28]/95 px-3 py-2.5 text-center text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)] backdrop-blur-xl">{notice}</div>}
        {overlay && <FrontendSheet type={overlay} onClose={() => setOverlay(null)} markets={markets} activeSymbol={activeSymbol} onSelectSymbol={symbol => { onSelectSymbol(symbol); if (activeNav === 'watchlist') setActiveNav('trade'); }} {...indicatorSheetProps} />}
      </main>
    </div>
  );
}
