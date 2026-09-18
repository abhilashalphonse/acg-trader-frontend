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
import PropRiskStrip from '../components/trading-v2/PropRiskStrip.jsx';
import ExecutionStatus from '../components/trading-v2/ExecutionStatus.jsx';
import useTradingHotkeys from '../hooks/useTradingHotkeys.js';
import { useTradingTerminal } from '../hooks/useTradingTerminal.js';
import { createIndicator, INDICATOR_LIBRARY } from '../utils/indicators.js';
import { normalizePriceToTick, normalizeProtectionPrice, normalizeVolumeToStep, pendingPriceDirection } from '../utils/tradingCommandNormalization.js';
import { calculateRiskSizedLots, estimateStopRisk } from '../utils/tradingRisk.js';
import { exposureAvailability } from '../utils/exposureAvailability.js';
import { formatInstrumentPrice, instrumentPipSize } from '../utils/instrumentFormatting.js';
import { normalizeTradePlanPatch } from '../utils/tradePlanNormalization.js';

const INDICATOR_STORAGE_KEY = 'acg-trader-indicators-v1';
const INDICATOR_FAVORITES_KEY = 'acg-trader-indicator-favorites-v1';
const TERMINAL_PREFS_KEY = 'acg-trader-terminal-prefs-v1';

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
  } catch { /* defaults below */ }
  return [createIndicator('volume')].filter(Boolean);
}

function loadIndicatorFavorites() {
  const defaults = INDICATOR_LIBRARY.filter(item => item.favorite).map(item => item.id);
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = JSON.parse(window.localStorage.getItem(INDICATOR_FAVORITES_KEY) || 'null');
    if (Array.isArray(stored)) return stored;
  } catch { /* defaults below */ }
  return defaults;
}

function loadTerminalPrefs() {
  if (typeof window === 'undefined') return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(TERMINAL_PREFS_KEY) || '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

function calculatedLots(plan, riskPercent, manualLots, equity, instrument, accountCurrency) {
  if (!plan || plan.sizingMode !== 'risk') return Math.max(0.01, Number(manualLots) || 0.01);
  return calculateRiskSizedLots(plan, riskPercent, equity, instrument, accountCurrency);
}

function estimatedRisk(plan, riskPercent, manualLots, equity, instrument, accountCurrency) {
  if (!plan) return 0;
  const lots = plan.sizingMode === 'risk'
    ? calculateRiskSizedLots(plan, riskPercent, equity, instrument, accountCurrency)
    : Number(plan.manualLots ?? manualLots);
  if (lots == null) return null;
  return estimateStopRisk(plan, normalizeVolumeToStep(lots, instrument), instrument, accountCurrency);
}

function fillEvent(result, fallback) {
  const deal = result?.deal;
  return {
    ...fallback,
    status: 'filled',
    fillPrice: Number(deal?.price ?? result?.order?.acceptedPrice ?? fallback.requestedPrice),
    slippage: Number(deal?.slippage || 0),
    positionId: result?.position?.id || deal?.positionId || null,
  };
}

export default function TradingTerminalV2({
  market,
  tick,
  markets = [],
  activeSymbol = market?.symbol,
  onSelectSymbol = () => {},
  watchlists = null,
}) {
  const shellRef = useRef(null);
  const nativeFullscreenRequestedRef = useRef(false);
  const noticeTimerRef = useRef(null);
  const executionDismissRef = useRef(null);
  const prefsRef = useRef(loadTerminalPrefs());
  const isDesktop = useDesktopLayout();
  const trading = useTradingTerminal(markets);
  const { account, positions, pendingOrders, positionHistory } = trading;

  const [timeframe, setTimeframe] = useState(prefsRef.current.timeframe || '1m');
  const [chartMode, setChartMode] = useState(prefsRef.current.chartMode || 'candles');
  const [selectedTool, setSelectedTool] = useState('cursor');
  const [activeNav, setActiveNav] = useState('trade');
  const favorite = watchlists?.isWatched?.(activeSymbol) === true;
  const setFavorite = () => watchlists?.toggleSymbol?.(activeSymbol);
  const [chartFocus, setChartFocus] = useState(false);
  const [lots, setLots] = useState(Number(prefsRef.current.lots) || 0.10);
  const [sizingMode, setSizingMode] = useState(prefsRef.current.sizingMode || 'lots');
  const [riskPercent, setRiskPercent] = useState(Number(prefsRef.current.riskPercent) || 0.5);
  const [orderType, setOrderType] = useState(prefsRef.current.orderType || 'market');
  const [hotkeysEnabled, setHotkeysEnabled] = useState(prefsRef.current.hotkeysEnabled === true);
  const [tradePlan, setTradePlan] = useState(null);
  const [journal, setJournal] = useState([]);
  const [executionEvent, setExecutionEvent] = useState(null);
  const [indicators, setIndicators] = useState(loadIndicators);
  const [indicatorFavorites, setIndicatorFavorites] = useState(loadIndicatorFavorites);
  const [overlay, setOverlay] = useState(null);
  const [notice, setNotice] = useState('');
  const exposure = exposureAvailability({ account, connectionStatus: trading.connection.status, market, commandState: trading.commandState });

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
    if (executionDismissRef.current) window.clearTimeout(executionDismissRef.current);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') try { window.localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(indicators)); } catch { /* preferences are non-critical */ }
  }, [indicators]);

  useEffect(() => {
    if (typeof window !== 'undefined') try { window.localStorage.setItem(INDICATOR_FAVORITES_KEY, JSON.stringify(indicatorFavorites)); } catch { /* preferences are non-critical */ }
  }, [indicatorFavorites]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(TERMINAL_PREFS_KEY, JSON.stringify({ timeframe, chartMode, lots, sizingMode, riskPercent, orderType, hotkeysEnabled })); } catch { /* preferences are non-critical */ }
  }, [timeframe, chartMode, lots, sizingMode, riskPercent, orderType, hotkeysEnabled]);

  const showNotice = message => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 2600);
  };

  const logEvent = (type, message, details = {}) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setJournal(current => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time, type, message, ...details }, ...current].slice(0, 150));
  };

  const dismissExecutionLater = () => {
    if (executionDismissRef.current) window.clearTimeout(executionDismissRef.current);
    executionDismissRef.current = window.setTimeout(() => setExecutionEvent(null), 2200);
  };

  const handleTradingError = (error, context = 'Trading command') => {
    const message = trading.errorMessage(error);
    const unknown = error?.code === 'EXECUTION_STATUS_UNKNOWN';
    setExecutionEvent(current => current ? { ...current, status: unknown ? 'unknown' : 'rejected', message } : { status: unknown ? 'unknown' : 'rejected', message });
    logEvent(unknown ? 'warning' : 'error', `${context}: ${message}`);
    showNotice(message);
    dismissExecutionLater();
  };

  const runMarketExecution = async ({ side, executionLots, symbol, requestedPrice, stopLoss = null, takeProfit = null }) => {
    if (!symbol || !trading.accountId) return null;
    if (!exposure.allowed) { showNotice(exposure.reason); return null; }
    const base = { side: String(side).toUpperCase(), lots: Number(executionLots), symbol, requestedPrice: Number(requestedPrice) };
    setExecutionEvent({ ...base, status: 'submitting' });
    logEvent('execution', `${base.side} ${base.lots.toFixed(2)} ${symbol} submitted`, base);
    try {
      const result = await trading.openMarketOrder({
        symbol,
        side: base.side,
        volume: base.lots,
        stopLoss,
        takeProfit,
        requestedPrice: Number.isFinite(base.requestedPrice) ? base.requestedPrice : null,
      });
      const filled = fillEvent(result, base);
      setExecutionEvent(filled);
      const instrument = markets.find(item => item.symbol === symbol) || market;
      logEvent('fill', `${base.side} ${base.lots.toFixed(2)} ${symbol} filled @ ${formatInstrumentPrice(filled.fillPrice, instrument)}`, filled);
      dismissExecutionLater();
      return result;
    } catch (error) {
      handleTradingError(error, `${base.side} ${symbol}`);
      return null;
    }
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
    setActiveNav('trade');
    setOverlay(null);
    logEvent('profile', `${profile.name || 'Trading'} profile applied`);
    showNotice(`${profile.name || 'Trading'} profile applied`);
  };

  const indicatorSheetProps = {
    indicators,
    indicatorFavorites,
    onAddIndicator: addIndicator,
    onRemoveIndicator: removeIndicator,
    onToggleIndicator: toggleIndicator,
    onUpdateIndicator: updateIndicator,
    onToggleIndicatorFavorite: toggleIndicatorFavorite,
    terminalPrefs: { timeframe, chartMode, lots, sizingMode, riskPercent, orderType, hotkeysEnabled },
    onToggleHotkeys: () => setHotkeysEnabled(value => !value),
    onApplyTradingProfile: applyTradingProfile,
    account,
  };

  const closePosition = async (id, percentage = 100) => {
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return;
    try {
      await trading.closePosition(id, percentage);
      if (tradePlan?.positionId === id && Number(percentage) >= 100) setTradePlan(null);
      logEvent('position', `${percentage >= 100 ? 'Closed' : `Closed ${percentage}% of`} ${position.symbol} ${position.side}`);
      showNotice(percentage >= 100 ? 'Position closed' : `${percentage}% of position closed`);
    } catch (error) {
      handleTradingError(error, `Close ${position.symbol}`);
    }
  };

  const closeAllPositions = async () => {
    if (!positions.length) return;
    try {
      const result = await trading.closeAllPositions();
      trading.refreshState();
      if (tradePlan?.open) setTradePlan(null);
      if (result?.complete === false) {
        logEvent('warning', `Close all partially completed: ${result.closed || 0} closed, ${result.failed || 0} failed`);
        showNotice(`${result.closed || 0} positions closed; ${result.failed || 0} still require attention`);
      } else {
        logEvent('position', `Close all completed for ${result?.closed ?? positions.length} positions`);
        showNotice('All positions closed');
      }
    } catch (error) {
      handleTradingError(error, 'Close all');
    }
  };

  const updatePosition = async (id, patch) => {
    const position = positions.find(item => String(item.id) === String(id));
    if (!position || (!Object.prototype.hasOwnProperty.call(patch, 'sl') && !Object.prototype.hasOwnProperty.call(patch, 'tp'))) return;
    try {
      await trading.updatePosition(id, patch);
      if (tradePlan?.positionId === id) setTradePlan(plan => plan ? { ...plan, ...patch } : plan);
      logEvent('modify', `${position.symbol} protection updated`);
      showNotice('Position protection updated');
      return true;
    } catch (error) {
      handleTradingError(error, `Modify ${position.symbol}`);
      return false;
    }
  };

  const movePositionToBreakEven = async id => {
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return;
    try {
      await trading.movePositionToBreakEven(id);
      if (tradePlan?.positionId === id) setTradePlan(plan => plan ? { ...plan, sl: position.entry } : plan);
      logEvent('modify', `${position.symbol} stop moved to break even`);
      showNotice('Stop loss moved to break even');
    } catch (error) {
      handleTradingError(error, `Break-even ${position.symbol}`);
    }
  };

  const reversePosition = async id => {
    if (!exposure.allowed) { showNotice(exposure.reason); return; }
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return;
    try {
      const result = await trading.reversePosition(id);
      setTradePlan(null);
      logEvent('position', `${position.symbol} reverse completed as close + opposite market order`);
      showNotice('Position reversed');
      if (result?.position?.symbol && result.position.symbol !== activeSymbol) onSelectSymbol(result.position.symbol);
    } catch (error) {
      handleTradingError(error, `Reverse ${position.symbol}`);
    }
  };

  const setPositionTrailing = async (id, enabled, pips) => {
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return;
    try {
      await trading.setPositionTrailing(id, enabled, pips);
      logEvent('modify', `${position.symbol} trailing stop ${enabled ? `${Math.max(1, Number(pips) || 5)} pips` : 'disabled'}`);
      showNotice(enabled ? 'Trailing stop updated' : 'Trailing stop disabled');
    } catch (error) {
      handleTradingError(error, `Trailing stop ${position.symbol}`);
    }
  };

  const duplicatePosition = async id => {
    if (!exposure.allowed) { showNotice(exposure.reason); return null; }
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return;
    try {
      const result = await trading.duplicatePosition(id);
      logEvent('execution', `${position.symbol} ${position.side} duplicated`);
      showNotice('Position duplicated');
      return result;
    } catch (error) {
      handleTradingError(error, `Duplicate ${position.symbol}`);
      return null;
    }
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

  const toggleDesktopFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (error) {
      console.warn('Desktop fullscreen unavailable', error);
    }
  };

  const startPlan = (side, requestedType = orderType) => {
    const marketPrice = Number(side === 'buy' ? market?.ask : market?.bid);
    if (!Number.isFinite(marketPrice) || marketPrice <= 0) {
      showNotice('Executable market price is unavailable');
      return;
    }
    const pip = instrumentPipSize(market);
    const pending = requestedType !== 'market';
    const sideUpper = String(side).toUpperCase();
    let entry = marketPrice;
    if (requestedType === 'limit') entry = side === 'buy' ? marketPrice - 5 * pip : marketPrice + 5 * pip;
    if (requestedType === 'stop' || requestedType === 'stop-limit') entry = side === 'buy' ? marketPrice + 5 * pip : marketPrice - 5 * pip;
    entry = normalizePriceToTick(entry, market, pendingPriceDirection(requestedType, sideUpper, 'entry'));
    const sl = normalizeProtectionPrice(side === 'buy' ? entry - 4.2 * pip : entry + 4.2 * pip, market, sideUpper, 'sl');
    const tp = normalizeProtectionPrice(side === 'buy' ? entry + 8.4 * pip : entry - 8.4 * pip, market, sideUpper, 'tp');
    const limitPrice = requestedType === 'stop-limit'
      ? normalizePriceToTick(side === 'buy' ? entry + 1.5 * pip : entry - 1.5 * pip, market, pendingPriceDirection(requestedType, sideUpper, 'limit'))
      : null;
    setTradePlan({ side, entry, sl, tp, limitPrice, marketPrice, orderType: requestedType, pending, sizingMode, manualLots: lots, expiration: 'GTC', stage: 'planning', open: false });
  };

  const cancelPlan = () => {
    if (tradePlan?.open && tradePlan?.positionId) {
      void closePosition(tradePlan.positionId, 100);
      return;
    }
    setTradePlan(null);
  };

  const executePlan = async () => {
    if (!tradePlan || trading.commandState.pending) return;
    if (!exposure.allowed) { showNotice(exposure.reason); return; }
    const calculated = calculatedLots(tradePlan, riskPercent, tradePlan.manualLots ?? lots, account.equity, market, account.currency);
    if (calculated == null) { showNotice('Risk % sizing is unavailable because this instrument P&L requires currency conversion. Use Lots sizing.'); return; }
    const volume = normalizeVolumeToStep(calculated, market);
    if (tradePlan.pending) {
      const request = {
        symbol: market?.symbol,
        side: tradePlan.side,
        type: tradePlan.orderType,
        volume,
        entry: tradePlan.entry,
        limitPrice: tradePlan.limitPrice,
        stopLoss: tradePlan.sl,
        takeProfit: tradePlan.tp,
        timeInForce: tradePlan.expiration || 'GTC',
        expiresAt: tradePlan.expirationAt || tradePlan.expiresAt || null,
      };
      setExecutionEvent({ side: tradePlan.side, lots: volume, symbol: market?.symbol, requestedPrice: tradePlan.entry, status: 'submitting' });
      try {
        const result = tradePlan.editingOrderId
          ? await trading.replacePendingOrder(tradePlan.editingOrderId, request)
          : await trading.placePendingOrder(request);
        setExecutionEvent({ side: tradePlan.side, lots: volume, symbol: market?.symbol, requestedPrice: tradePlan.entry, status: 'pending', message: `${String(tradePlan.orderType).toUpperCase()} order waiting for trigger` });
        logEvent('order', `${String(tradePlan.side).toUpperCase()} ${String(tradePlan.orderType).toUpperCase()} ${volume.toFixed(2)} ${market?.symbol} placed`, { orderId: result?.order?.id });
        setTradePlan(null);
        dismissExecutionLater();
      } catch (error) {
        handleTradingError(error, 'Pending order');
      }
      return;
    }

    const result = await runMarketExecution({
      side: tradePlan.side,
      executionLots: volume,
      symbol: market?.symbol,
      requestedPrice: tradePlan.entry,
      stopLoss: tradePlan.sl,
      takeProfit: tradePlan.tp,
    });
    if (result?.position || result?.reconciled || String(result?.order?.status || '').toUpperCase() === 'FILLED') {
      setTradePlan(null);
    }
  };

  const modifyPlan = async stage => {
    if (tradePlan?.open && tradePlan.positionId && stage === 'open' && tradePlan.stage === 'modifying') {
      const applied = await updatePosition(tradePlan.positionId, { sl: tradePlan.sl, tp: tradePlan.tp });
      if (!applied) return;
    }
    setTradePlan(plan => plan ? { ...plan, stage } : plan);
  };
  const updatePlan = patch => {
    setTradePlan(plan => plan ? { ...plan, ...normalizeTradePlanPatch(plan, patch, market) } : plan);
  };

  const manualOrder = order => {
    if (trading.commandState.pending || !exposure.allowed) { if (!exposure.allowed) showNotice(exposure.reason); return; }
    void runMarketExecution({
      side: order.side,
      executionLots: normalizeVolumeToStep(order.lots, markets.find(item => item.symbol === order.symbol) || market),
      symbol: order.symbol,
      requestedPrice: order.price,
    });
  };

  const cancelPendingOrder = async id => {
    const order = pendingOrders.find(item => String(item.id) === String(id));
    if (!order) return;
    try {
      await trading.cancelPendingOrder(id);
      logEvent('order', `${String(order.side).toUpperCase()} ${String(order.orderType).toUpperCase()} ${order.symbol} cancelled`);
      showNotice('Pending order cancelled');
    } catch (error) {
      handleTradingError(error, `Cancel ${order.symbol}`);
    }
  };

  const modifyPendingOrder = id => {
    const order = pendingOrders.find(item => String(item.id) === String(id));
    if (!order) return;
    if (order.symbol && order.symbol !== market?.symbol) onSelectSymbol(order.symbol);
    setTradePlan({ ...order, editingOrderId: id, stage: 'ready', open: false, pending: true });
    setOrderType(order.orderType);
    setSizingMode('lots');
    if (Number.isFinite(order.manualLots)) setLots(order.manualLots);
    setActiveNav('trade');
    setOverlay(null);
    logEvent('order', `${String(order.side).toUpperCase()} ${String(order.orderType).toUpperCase()} loaded for cancel-and-replace modification`);
    showNotice('Pending order loaded for modification');
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

  const hotkeyTrade = side => {
    if (tradePlan || trading.commandState.pending || !exposure.allowed) return;
    if (orderType !== 'market') startPlan(side, orderType);
    else if (sizingMode === 'risk') startPlan(side, 'market');
    else manualOrder({ side, lots, price: side === 'buy' ? market?.ask : market?.bid, symbol: market?.symbol });
  };

  useTradingHotkeys({
    enabled: isDesktop && hotkeysEnabled,
    onBuy: () => hotkeyTrade('buy'),
    onSell: () => hotkeyTrade('sell'),
    onFullscreen: () => toggleDesktopFullscreen(),
    onCancel: () => tradePlan && cancelPlan(),
    onCloseLatest: () => positions[0] && void closePosition(positions[0].id, 100),
    onCloseAll: () => void closeAllPositions(),
    onLotsDelta: delta => setLots(value => normalizeVolumeToStep(Number(value) + delta, market, { rounding: 'nearest' })),
    onTimeframe: setTimeframe,
  });

  const plannedRisk = estimatedRisk(tradePlan, riskPercent, lots, account.equity, market, account.currency);

  if (isDesktop) {
    return (
      <>
        <DesktopTerminal
          market={market}
          tick={tick}
          markets={markets}
          activeSymbol={activeSymbol}
          onSelectSymbol={onSelectSymbol}
          watchlists={watchlists}
          positions={positions}
          positionHistory={positionHistory}
          pendingOrders={pendingOrders}
          journal={journal}
          onClosePosition={closePosition}
          onCloseAllPositions={closeAllPositions}
          onBreakEven={movePositionToBreakEven}
          onReversePosition={reversePosition}
          onUpdatePosition={updatePosition}
          onSetTrailing={setPositionTrailing}
          onDuplicatePosition={duplicatePosition}
          onCancelPending={cancelPendingOrder}
          onModifyPending={modifyPendingOrder}
          onManualOrder={manualOrder}
          indicators={indicators}
          onOpenIndicators={() => setOverlay('indicators')}
          account={account}
          plannedRisk={plannedRisk}
          hotkeysEnabled={hotkeysEnabled}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          chartMode={chartMode}
          onChartModeChange={setChartMode}
          selectedTool={selectedTool}
          onSelectedToolChange={setSelectedTool}
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
          onTradePlanChange={updatePlan}
          onOpenSettings={() => setOverlay('more')}
          exposureAllowed={exposure.allowed}
          exposureBlockReason={exposure.reason}
        />
        <ExecutionStatus event={executionEvent} instrument={market} onDismiss={() => setExecutionEvent(null)} />
        {overlay && <FrontendSheet type={overlay} onClose={() => setOverlay(null)} markets={markets} activeSymbol={activeSymbol} watchlists={watchlists} onSelectSymbol={symbol => { onSelectSymbol(symbol); setOverlay(null); }} {...indicatorSheetProps} />}
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
            positions={positions}
            onUpdatePosition={updatePosition}
            onIndicators={() => setOverlay('indicators')}
            indicators={indicators}
            account={account}
            plannedRisk={plannedRisk}
            exposureAllowed={exposure.allowed}
            exposureBlockReason={exposure.reason}
            onExit={exitChartFocus}
          />
        ) : (
          <>
            {activeNav === 'watchlist' ? (
              <WatchlistSection markets={markets} activeSymbol={activeSymbol} onOpenTrade={openTradeFromWatchlist} onAddInstrument={() => setOverlay('search')} watchlists={watchlists} />
            ) : (
              <>
                <TopBar balance={`${account.currency === 'EUR' ? '€' : '$'}${Number(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} live={trading.connection.status === 'ready'} onSearch={() => setOverlay('search')} onNotifications={() => setOverlay('notifications')} onProfile={() => setOverlay('profile')} />
                <div className="px-2">
                  <MarketPanel market={market} tick={tick} timeframe={timeframe} setTimeframe={setTimeframe} chartMode={chartMode} setChartMode={setChartMode} selectedTool={selectedTool} setSelectedTool={setSelectedTool} favorite={favorite} setFavorite={setFavorite} fullscreen={chartFocus} onFullscreen={enterChartFocus} tradePlan={tradePlan} onTradePlanChange={updatePlan} positions={positions} onUpdatePosition={updatePosition} onSelectInstrument={() => setOverlay('instruments')} onIndicators={() => setOverlay('indicators')} indicators={indicators} />
                  <PropRiskStrip account={account} plannedRisk={plannedRisk} />
                  <ExecutionPanel market={market} account={account} exposureAllowed={exposure.allowed} exposureBlockReason={exposure.reason} lots={lots} onLotsChange={setLots} sizingMode={sizingMode} onSizingModeChange={setSizingMode} riskPercent={riskPercent} onRiskPercentChange={setRiskPercent} orderType={orderType} onOrderTypeChange={setOrderType} tradePlan={tradePlan} onStartPlan={startPlan} onCancelPlan={cancelPlan} onExecutePlan={executePlan} onModifyPlan={modifyPlan} onManualOrder={manualOrder} onTradePlanChange={updatePlan} />
                  <PositionsPanel positions={positions} markets={markets} positionHistory={positionHistory} pendingOrders={pendingOrders} journal={journal} onClosePosition={closePosition} onCloseAll={closeAllPositions} onBreakEven={movePositionToBreakEven} onReverse={reversePosition} onUpdatePosition={updatePosition} onSetTrailing={setPositionTrailing} onDuplicate={duplicatePosition} onCancelPending={cancelPendingOrder} onModifyPending={modifyPendingOrder} />
                </div>
              </>
            )}
            <BottomNavbar active={activeNav} onChange={handleNav} />
          </>
        )}
        <ExecutionStatus event={executionEvent} instrument={market} onDismiss={() => setExecutionEvent(null)} />
        {notice && <div className="fixed left-1/2 top-[74px] z-[120] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 rounded-xl border border-[#254155] bg-[#0b1b28]/95 px-3 py-2.5 text-center text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)] backdrop-blur-xl">{notice}</div>}
        {overlay && <FrontendSheet type={overlay} onClose={() => setOverlay(null)} markets={markets} activeSymbol={activeSymbol} onSelectSymbol={symbol => { onSelectSymbol(symbol); if (activeNav === 'watchlist') setActiveNav('trade'); }} {...indicatorSheetProps} />}
      </main>
    </div>
  );
}
