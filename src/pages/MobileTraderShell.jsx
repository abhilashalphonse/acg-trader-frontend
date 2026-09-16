import React, { useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '../components/trading-v2/TopBar.jsx';
import MarketPanel from '../components/trading-v2/MarketPanel.jsx';
import ExecutionPanel from '../components/trading-v2/ExecutionPanel.jsx';
import PositionsPanel from '../components/trading-v2/PositionsPanel.jsx';
import BottomNavbar from '../components/trading-v2/BottomNavbar.jsx';
import MobileScalperMode from '../components/trading-v2/MobileScalperMode.jsx';
import FrontendSheet from '../components/trading-v2/FrontendSheet.jsx';
import WatchlistSection from '../components/trading-v2/WatchlistSection.jsx';
import PropRiskStrip from '../components/trading-v2/PropRiskStrip.jsx';
import ExecutionStatus from '../components/trading-v2/ExecutionStatus.jsx';
import TradeSection from '../components/trading-v2/TradeSection.jsx';
import HistorySection from '../components/trading-v2/HistorySection.jsx';
import AccountSection from '../components/trading-v2/AccountSection.jsx';
import { createIndicator, INDICATOR_LIBRARY } from '../utils/indicators.js';

const INDICATOR_STORAGE_KEY = 'acg-trader-indicators-v1';
const INDICATOR_FAVORITES_KEY = 'acg-trader-indicator-favorites-v1';
const TERMINAL_PREFS_KEY = 'acg-trader-terminal-prefs-v1';

const DEFAULT_ACCOUNT = {
  initialBalance: 12500,
  balance: 12458.32,
  equity: 12503.18,
  dailyStartEquity: 12520,
  dailyLossLimit: 625,
  maxLossLimit: 1250,
  profitTarget: 1250,
  margin: 74.60,
};

function loadIndicators() {
  if (typeof window === 'undefined') return [createIndicator('volume')].filter(Boolean);
  try {
    const stored = JSON.parse(window.localStorage.getItem(INDICATOR_STORAGE_KEY) || 'null');
    if (Array.isArray(stored)) return stored;
  } catch (_) { /* use default */ }
  return [createIndicator('volume')].filter(Boolean);
}

function loadIndicatorFavorites() {
  const defaults = INDICATOR_LIBRARY.filter(item => item.favorite).map(item => item.id);
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = JSON.parse(window.localStorage.getItem(INDICATOR_FAVORITES_KEY) || 'null');
    if (Array.isArray(stored)) return stored;
  } catch (_) { /* use default */ }
  return defaults;
}

function loadTerminalPrefs() {
  if (typeof window === 'undefined') return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(TERMINAL_PREFS_KEY) || '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch (_) {
    return {};
  }
}

function initialPositions() {
  return [
    { id: 1, symbol: 'AUDCAD', side: 'BUY', volume: 0.01, entry: 0.99342, pnl: 0.18, tp: 0.995, sl: 0.99, trailingEnabled: false, trailingPips: 5, openedAt: 'Earlier today', source: 'market' },
    { id: 2, symbol: 'EURUSD', side: 'SELL', volume: 0.02, entry: 1.0846, pnl: 0.78, tp: 1.08, sl: 1.09, trailingEnabled: false, trailingPips: 5, openedAt: 'Earlier today', source: 'market' },
  ];
}

function pipSize(price) { return Number(price) > 100 ? 0.01 : 0.0001; }
function formatVolume(value) { return Math.max(0.01, Number(value) || 0.01).toFixed(2); }

function calculatedLots(plan, riskPercent, manualLots, equity = DEFAULT_ACCOUNT.equity) {
  if (!plan || plan.sizingMode !== 'risk') return Number(manualLots) || 0.01;
  const pip = pipSize(plan.entry);
  const slPips = Math.max(0.1, Math.abs(Number(plan.entry) - Number(plan.sl)) / pip);
  const riskDollars = Number(equity) * (Number(riskPercent) / 100);
  return Math.max(0.01, Math.min(100, riskDollars / Math.max(slPips * 10, 0.01)));
}

function estimatedRisk(plan, riskPercent, manualLots, equity) {
  if (!plan) return 0;
  const entry = Number(plan.entry) || 0;
  const sl = Number(plan.sl) || entry;
  const pip = pipSize(entry);
  const slPips = Math.max(0.1, Math.abs(entry - sl) / pip);
  if (plan.sizingMode === 'risk') return Number(equity) * (Number(riskPercent) / 100);
  return slPips * (Number(plan.manualLots ?? manualLots) || 0) * 10;
}

function stamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function MobileTraderShell({ market, tick, markets = [], activeSymbol, onSelectSymbol = () => {} }) {
  const shellRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const executionTimersRef = useRef([]);
  const prefsRef = useRef(loadTerminalPrefs());

  const [activeNav, setActiveNav] = useState('chart');
  const [timeframe, setTimeframe] = useState(prefsRef.current.timeframe || '1m');
  const [chartMode, setChartMode] = useState(prefsRef.current.chartMode || 'candles');
  const [selectedTool, setSelectedTool] = useState('cursor');
  const [favorite, setFavorite] = useState(true);
  const [chartFocus, setChartFocus] = useState(false);
  const [lots, setLots] = useState(Number(prefsRef.current.lots) || 0.10);
  const [sizingMode, setSizingMode] = useState(prefsRef.current.sizingMode || 'lots');
  const [riskPercent, setRiskPercent] = useState(Number(prefsRef.current.riskPercent) || 0.5);
  const [orderType, setOrderType] = useState(prefsRef.current.orderType || 'market');
  const [tradePlan, setTradePlan] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [positions, setPositions] = useState(initialPositions);
  const [positionHistory, setPositionHistory] = useState([]);
  const [journal, setJournal] = useState([]);
  const [executionEvent, setExecutionEvent] = useState(null);
  const [account] = useState(DEFAULT_ACCOUNT);
  const [indicators, setIndicators] = useState(loadIndicators);
  const [indicatorFavorites, setIndicatorFavorites] = useState(loadIndicatorFavorites);
  const [overlay, setOverlay] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    executionTimersRef.current.forEach(timer => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(indicators));
  }, [indicators]);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(INDICATOR_FAVORITES_KEY, JSON.stringify(indicatorFavorites));
  }, [indicatorFavorites]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TERMINAL_PREFS_KEY, JSON.stringify({ timeframe, chartMode, lots, sizingMode, riskPercent, orderType }));
  }, [timeframe, chartMode, lots, sizingMode, riskPercent, orderType]);

  const showNotice = message => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 2400);
  };

  const logEvent = (type, message, details = {}) => {
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: stamp(), type, message, ...details };
    setJournal(current => [item, ...current].slice(0, 200));
  };

  const currentPriceFor = (symbol, side) => {
    const quote = symbol === market?.symbol ? market : markets.find(item => item.symbol === symbol);
    return Number(String(side).toUpperCase() === 'BUY' ? quote?.ask : quote?.bid) || 0;
  };

  const addPosition = ({ symbol, side, volume, entry, sl = null, tp = null, source = 'market' }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setPositions(current => [{
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
      openedAt: stamp(),
    }, ...current]);
    return id;
  };

  const clearExecutionTimers = () => {
    executionTimersRef.current.forEach(timer => window.clearTimeout(timer));
    executionTimersRef.current = [];
  };

  const runExecution = ({ side, lots: executionLots, symbol, requestedPrice, onFill }) => {
    if (['submitting', 'accepted'].includes(executionEvent?.status)) return;
    clearExecutionTimers();
    const base = { side, lots: Number(executionLots), symbol, requestedPrice: Number(requestedPrice) };
    setExecutionEvent({ ...base, status: 'submitting' });
    logEvent('execution', `${String(side).toUpperCase()} ${Number(executionLots).toFixed(2)} ${symbol} submitted`, base);

    executionTimersRef.current.push(window.setTimeout(() => {
      setExecutionEvent({ ...base, status: 'accepted', latencyMs: 74 });
      logEvent('execution', `${String(side).toUpperCase()} ${symbol} accepted`, { ...base, latencyMs: 74 });
    }, 90));

    executionTimersRef.current.push(window.setTimeout(() => {
      const fill = { ...base, status: 'filled', fillPrice: Number(requestedPrice), slippage: 0, latencyMs: 118 };
      setExecutionEvent(fill);
      onFill?.(fill);
      logEvent('fill', `${String(side).toUpperCase()} ${Number(executionLots).toFixed(2)} ${symbol} filled @ ${Number(requestedPrice).toFixed(Number(requestedPrice) > 100 ? 2 : 5)}`, fill);
    }, 220));

    executionTimersRef.current.push(window.setTimeout(() => setExecutionEvent(null), 2200));
  };

  const closePosition = (id, percentage = 100) => {
    const position = positions.find(item => item.id === id);
    if (!position) return;
    const currentVolume = Number(position.volume);
    const requested = Math.max(1, Math.min(100, Number(percentage) || 100));
    const closeVolume = Math.min(currentVolume, Math.max(0.01, Number((currentVolume * requested / 100).toFixed(2))));
    const fullyClosed = closeVolume >= currentVolume - 0.000001;
    const closePrice = currentPriceFor(position.symbol, position.side) || Number(position.entry);
    const record = {
      ...position,
      id: `${position.id}-${Date.now()}`,
      volume: closeVolume,
      closePrice,
      closedAt: stamp(),
      closeType: fullyClosed ? 'Manual close' : `${requested}% partial`,
    };
    setPositionHistory(current => [record, ...current]);
    setPositions(current => fullyClosed ? current.filter(item => item.id !== id) : current.map(item => item.id === id ? { ...item, volume: Number((currentVolume - closeVolume).toFixed(2)) } : item));
    if (tradePlan?.positionId === id && fullyClosed) setTradePlan(null);
    logEvent('position', `${fullyClosed ? 'Closed' : `Closed ${requested}% of`} ${position.symbol} ${position.side} ${closeVolume.toFixed(2)}`, { symbol: position.symbol, side: position.side, volume: closeVolume, fillPrice: closePrice, lots: closeVolume });
    showNotice(fullyClosed ? 'Position closed locally' : `${requested}% of position closed locally`);
  };

  const closeAllPositions = () => {
    if (!positions.length) return;
    const now = stamp();
    const closed = positions.map(position => ({ ...position, id: `${position.id}-${Date.now()}-${Math.random()}`, closePrice: currentPriceFor(position.symbol, position.side) || position.entry, closedAt: now, closeType: 'Close all' }));
    setPositionHistory(current => [...closed, ...current]);
    positions.forEach(position => logEvent('position', `Closed ${position.symbol} ${position.side} ${Number(position.volume).toFixed(2)}`, { symbol: position.symbol, side: position.side, volume: position.volume }));
    setPositions([]);
    setTradePlan(null);
    showNotice('All positions closed locally');
  };

  const updatePosition = (id, patch) => setPositions(current => current.map(position => position.id === id ? { ...position, ...patch } : position));

  const movePositionToBreakEven = id => {
    const position = positions.find(item => item.id === id);
    if (!position) return;
    updatePosition(id, { sl: Number(position.entry) });
    logEvent('modify', `${position.symbol} stop moved to break even`, { symbol: position.symbol });
    showNotice('Stop moved to break even');
  };

  const reversePosition = id => {
    const position = positions.find(item => item.id === id);
    if (!position) return;
    const nextSide = position.side === 'BUY' ? 'SELL' : 'BUY';
    const quote = currentPriceFor(position.symbol, nextSide) || Number(position.entry);
    updatePosition(id, { side: nextSide, entry: quote, pnl: 0, openedAt: stamp() });
    logEvent('position', `${position.symbol} reversed ${position.side} → ${nextSide}`, { symbol: position.symbol, side: nextSide });
    showNotice('Position reversed locally');
  };

  const setPositionTrailing = (id, enabled, pips) => {
    const position = positions.find(item => item.id === id);
    updatePosition(id, { trailingEnabled: Boolean(enabled), trailingPips: Math.max(1, Number(pips) || 5) });
    if (position) logEvent('modify', `${position.symbol} trailing stop ${enabled ? `${Math.max(1, Number(pips) || 5)} pips` : 'disabled'}`, { symbol: position.symbol });
  };

  const duplicatePosition = id => {
    const position = positions.find(item => item.id === id);
    if (!position) return;
    const quote = currentPriceFor(position.symbol, position.side) || Number(position.entry);
    addPosition({ ...position, entry: quote, source: 'duplicate' });
    showNotice('Position duplicated locally');
  };

  const startPlan = (side, requestedType = orderType) => {
    const marketPrice = Number(side === 'buy' ? market?.ask : market?.bid) || 1;
    const pip = pipSize(marketPrice);
    const pending = requestedType !== 'market';
    let entry = marketPrice;
    if (requestedType === 'limit') entry = side === 'buy' ? marketPrice - 5 * pip : marketPrice + 5 * pip;
    if (requestedType === 'stop' || requestedType === 'stop-limit') entry = side === 'buy' ? marketPrice + 5 * pip : marketPrice - 5 * pip;
    const sl = side === 'buy' ? entry - 4.2 * pip : entry + 4.2 * pip;
    const tp = side === 'buy' ? entry + 8.4 * pip : entry - 8.4 * pip;
    const limitPrice = requestedType === 'stop-limit' ? (side === 'buy' ? entry - 1.5 * pip : entry + 1.5 * pip) : null;
    setTradePlan({ side, entry, sl, tp, limitPrice, marketPrice, orderType: requestedType, pending, sizingMode, manualLots: lots, expiration: 'GTC', stage: 'planning', open: false });
  };

  const cancelPlan = () => {
    if (tradePlan?.open && tradePlan.positionId) { closePosition(tradePlan.positionId, 100); return; }
    setTradePlan(null);
  };

  const executePlan = () => {
    if (!tradePlan || ['submitting', 'accepted'].includes(executionEvent?.status)) return;
    if (tradePlan.pending) {
      const pending = {
        ...tradePlan,
        symbol: market?.symbol,
        id: tradePlan.editingOrderId || Date.now(),
        lots: calculatedLots(tradePlan, riskPercent, tradePlan.manualLots ?? lots, account.equity),
        status: 'pending',
        createdAt: stamp(),
      };
      setPendingOrders(current => tradePlan.editingOrderId ? current.map(order => order.id === tradePlan.editingOrderId ? pending : order) : [pending, ...current]);
      logEvent('order', `${tradePlan.side.toUpperCase()} ${String(tradePlan.orderType).toUpperCase()} ${pending.lots.toFixed(2)} ${market?.symbol} placed @ ${Number(tradePlan.entry).toFixed(Number(tradePlan.entry) > 100 ? 2 : 5)}`, { symbol: market?.symbol, side: tradePlan.side, lots: pending.lots, requestedPrice: tradePlan.entry });
      setExecutionEvent({ side: tradePlan.side, lots: pending.lots, symbol: market?.symbol, requestedPrice: tradePlan.entry, status: 'pending', message: `${String(tradePlan.orderType).toUpperCase()} order waiting for trigger` });
      executionTimersRef.current.push(window.setTimeout(() => setExecutionEvent(null), 2200));
      setTradePlan(null);
      return;
    }
    const volume = calculatedLots(tradePlan, riskPercent, tradePlan.manualLots ?? lots, account.equity);
    const plannedSide = tradePlan.side;
    const plannedSl = tradePlan.sl;
    const plannedTp = tradePlan.tp;
    runExecution({ side: plannedSide, lots: volume, symbol: market?.symbol, requestedPrice: tradePlan.entry, onFill: fill => {
      const positionId = addPosition({ symbol: market?.symbol, side: plannedSide, volume, entry: fill.fillPrice, sl: plannedSl, tp: plannedTp, source: 'risk-plan' });
      setTradePlan(plan => plan ? { ...plan, entry: fill.fillPrice, positionId, open: true, stage: 'open' } : plan);
    } });
  };

  const manualOrder = order => {
    if (['submitting', 'accepted'].includes(executionEvent?.status)) return;
    const side = String(order.side).toUpperCase();
    runExecution({ side, lots: order.lots, symbol: order.symbol, requestedPrice: order.price, onFill: fill => addPosition({ symbol: order.symbol, side, volume: order.lots, entry: fill.fillPrice, source: 'one-click' }) });
  };

  const updatePlan = patch => {
    if (tradePlan?.open && tradePlan.positionId) {
      const positionPatch = {};
      if (patch.sl != null) positionPatch.sl = patch.sl;
      if (patch.tp != null) positionPatch.tp = patch.tp;
      if (Object.keys(positionPatch).length) updatePosition(tradePlan.positionId, positionPatch);
    }
    setTradePlan(plan => plan ? { ...plan, ...patch } : plan);
  };

  const cancelPendingOrder = id => {
    const order = pendingOrders.find(item => item.id === id);
    setPendingOrders(current => current.filter(item => item.id !== id));
    if (order) logEvent('order', `${String(order.side).toUpperCase()} ${String(order.orderType).toUpperCase()} ${order.symbol} cancelled`, { symbol: order.symbol, side: order.side, lots: order.lots });
    showNotice('Pending order cancelled locally');
  };

  const modifyPendingOrder = id => {
    const order = pendingOrders.find(item => item.id === id);
    if (!order) return;
    if (order.symbol && order.symbol !== activeSymbol) onSelectSymbol(order.symbol);
    setTradePlan({ ...order, editingOrderId: id, stage: 'ready', open: false, pending: true });
    setOrderType(order.orderType);
    setSizingMode(order.sizingMode || 'lots');
    if (Number.isFinite(Number(order.manualLots))) setLots(Number(order.manualLots));
    setActiveNav('chart');
    setOverlay(null);
    showNotice('Pending order loaded on Chart');
  };

  const openChart = symbol => {
    if (symbol) onSelectSymbol(symbol);
    setActiveNav('chart');
    setOverlay(null);
  };

  const addIndicator = id => {
    setIndicators(current => {
      const created = createIndicator(id);
      return created ? [...current, created] : current;
    });
  };
  const removeIndicator = instanceId => setIndicators(current => current.filter(item => item.instanceId !== instanceId));
  const toggleIndicator = instanceId => setIndicators(current => current.map(item => item.instanceId === instanceId ? { ...item, visible: item.visible === false } : item));
  const updateIndicator = (instanceId, patch) => setIndicators(current => current.map(item => item.instanceId === instanceId ? { ...item, settings: { ...item.settings, ...patch } } : item));
  const toggleIndicatorFavorite = id => setIndicatorFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const applyTradingProfile = profile => {
    if (!profile) return;
    const settings = profile.settings || {};
    if (settings.timeframe) setTimeframe(settings.timeframe);
    if (settings.chartMode) setChartMode(settings.chartMode);
    if (settings.sizingMode) setSizingMode(settings.sizingMode);
    if (Number.isFinite(Number(settings.riskPercent))) setRiskPercent(Number(settings.riskPercent));
    if (Number.isFinite(Number(settings.lots))) setLots(Math.max(0.01, Number(settings.lots)));
    if (settings.orderType) setOrderType(settings.orderType);
    if (Array.isArray(profile.indicators)) setIndicators(profile.indicators.map(item => createIndicator(item.id, item.settings || {})).filter(Boolean));
    if (profile.symbol && markets.some(item => item.symbol === profile.symbol)) onSelectSymbol(profile.symbol);
    setSelectedTool('cursor');
    setTradePlan(null);
    setActiveNav('chart');
    setOverlay(null);
    showNotice(`${profile.name || 'Trading'} profile applied`);
  };

  const enterChartFocus = async () => {
    setChartFocus(true);
    try { if (!document.fullscreenElement && shellRef.current?.requestFullscreen) await shellRef.current.requestFullscreen(); } catch (_) { /* in-app focus remains */ }
  };
  const exitChartFocus = async () => {
    setChartFocus(false);
    try { if (document.fullscreenElement) await document.exitFullscreen?.(); } catch (_) { /* ignore */ }
  };

  const plannedRisk = estimatedRisk(tradePlan, riskPercent, lots, account.equity);
  const indicatorSheetProps = {
    indicators,
    indicatorFavorites,
    onAddIndicator: addIndicator,
    onRemoveIndicator: removeIndicator,
    onToggleIndicator: toggleIndicator,
    onUpdateIndicator: updateIndicator,
    onToggleIndicatorFavorite: toggleIndicatorFavorite,
    terminalPrefs: { timeframe, chartMode, lots, sizingMode, riskPercent, orderType, hotkeysEnabled: false },
    onToggleHotkeys: () => {},
    onApplyTradingProfile: applyTradingProfile,
  };

  const chartContent = (
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
        <PropRiskStrip account={account} plannedRisk={plannedRisk} />
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
          onModifyPlan={stage => setTradePlan(plan => plan ? { ...plan, stage } : plan)}
          onManualOrder={manualOrder}
          onTradePlanChange={updatePlan}
        />
        <PositionsPanel
          positions={positions}
          positionHistory={positionHistory}
          pendingOrders={pendingOrders}
          journal={journal}
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
  );

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
            onModifyPlan={stage => setTradePlan(plan => plan ? { ...plan, stage } : plan)}
            onManualOrder={manualOrder}
            onTradePlanChange={updatePlan}
            onIndicators={() => setOverlay('indicators')}
            indicators={indicators}
            account={account}
            plannedRisk={plannedRisk}
            onExit={exitChartFocus}
          />
        ) : (
          <>
            {activeNav === 'watchlist' && <WatchlistSection markets={markets} activeSymbol={activeSymbol} onOpenTrade={openChart} onAddInstrument={() => setOverlay('search')} />}
            {activeNav === 'chart' && chartContent}
            {activeNav === 'trade' && <TradeSection account={account} positions={positions} pendingOrders={pendingOrders} markets={markets} onOpenChart={openChart} onClosePosition={closePosition} onCloseAll={closeAllPositions} onCancelPending={cancelPendingOrder} onModifyPending={modifyPendingOrder} onNewOrder={() => openChart(activeSymbol)} />}
            {activeNav === 'history' && <HistorySection positionHistory={positionHistory} journal={journal} onOpenChart={openChart} onNotice={showNotice} />}
            {activeNav === 'account' && <AccountSection account={account} onOpenSheet={setOverlay} />}
            <BottomNavbar active={activeNav} onChange={id => { setActiveNav(id); setOverlay(null); }} />
          </>
        )}

        <ExecutionStatus event={executionEvent} onDismiss={() => setExecutionEvent(null)} />
        {notice && <div className="fixed left-1/2 top-[74px] z-[120] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 rounded-xl border border-[#254155] bg-[#0b1b28]/95 px-3 py-2.5 text-center text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)] backdrop-blur-xl">{notice}</div>}
        {overlay && <FrontendSheet type={overlay} onClose={() => setOverlay(null)} markets={markets} activeSymbol={activeSymbol} onSelectSymbol={symbol => { onSelectSymbol(symbol); if (overlay === 'search' || overlay === 'instruments') setActiveNav('chart'); }} {...indicatorSheetProps} />}
      </main>
    </div>
  );
}
