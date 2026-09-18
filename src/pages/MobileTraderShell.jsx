import React, { useEffect, useRef, useState } from 'react';
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
import { useTradingTerminal } from '../hooks/useTradingTerminal.js';
import { createIndicator, INDICATOR_LIBRARY } from '../utils/indicators.js';
import { calculateRiskSizedLots, estimateStopRisk } from '../utils/tradingRisk.js';
import { exposureAvailability } from '../utils/exposureAvailability.js';
import { formatInstrumentPrice, instrumentPipSize } from '../utils/instrumentFormatting.js';
import { normalizeTradePlanPatch } from '../utils/tradePlanNormalization.js';

const INDICATOR_STORAGE_KEY = 'acg-trader-indicators-v1';
const INDICATOR_FAVORITES_KEY = 'acg-trader-indicator-favorites-v1';
const TERMINAL_PREFS_KEY = 'acg-trader-terminal-prefs-v1';

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

function normalizeExecutionVolume(value, instrument) {
  const step = Math.max(Number(instrument?.volumeStep) || 0.01, 0.00000001);
  const min = Math.max(Number(instrument?.minVolume) || step, step);
  const max = Math.max(Number(instrument?.maxVolume) || 100, min);
  const requested = Math.max(min, Math.min(max, Number(value) || min));
  const units = Math.floor((requested + step * 1e-8) / step);
  const normalized = Math.max(min, Math.min(max, units * step));
  const decimals = Math.max(0, String(step).split('.')[1]?.length || 0);
  return Number(normalized.toFixed(decimals));
}

function normalizePriceToTick(value, instrument, direction = 'nearest') {
  if (value === null || value === undefined || value === '') return value;
  const numeric = Number(value);
  const tick = Number(instrument?.tickSize);
  if (!Number.isFinite(numeric) || !Number.isFinite(tick) || tick <= 0) return value;
  const decimals = Math.max(0, String(instrument?.tickSize ?? tick).split('.')[1]?.length || 0);
  const units = numeric / tick;
  const snappedUnits = direction === 'down'
    ? Math.floor(units + 1e-10)
    : direction === 'up'
      ? Math.ceil(units - 1e-10)
      : Math.round(units);
  return Number((snappedUnits * tick).toFixed(decimals));
}

function estimatedRisk(plan, riskPercent, manualLots, equity, instrument, accountCurrency) {
  if (!plan) return 0;
  const sizedLots = plan.sizingMode === 'risk'
    ? calculateRiskSizedLots(plan, riskPercent, equity, instrument, accountCurrency)
    : Number(plan.manualLots ?? manualLots);
  if (sizedLots == null) return null;
  return estimateStopRisk(plan, normalizeExecutionVolume(sizedLots, instrument), instrument, accountCurrency);
}

function stamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
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

export default function MobileTraderShell({ market, tick, markets = [], activeSymbol, onSelectSymbol = () => {} }) {
  const shellRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const executionDismissRef = useRef(null);
  const prefsRef = useRef(loadTerminalPrefs());
  const trading = useTradingTerminal(markets);
  const { account, positions, pendingOrders, positionHistory } = trading;

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
  const [journal, setJournal] = useState([]);
  const [executionEvent, setExecutionEvent] = useState(null);
  const [indicators, setIndicators] = useState(loadIndicators);
  const [indicatorFavorites, setIndicatorFavorites] = useState(loadIndicatorFavorites);
  const [overlay, setOverlay] = useState(null);
  const [notice, setNotice] = useState('');
  const exposure = exposureAvailability({ account, connectionStatus: trading.connection.status, market, commandState: trading.commandState });

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
    try { window.localStorage.setItem(TERMINAL_PREFS_KEY, JSON.stringify({ timeframe, chartMode, lots, sizingMode, riskPercent, orderType })); } catch { /* preferences are non-critical */ }
  }, [timeframe, chartMode, lots, sizingMode, riskPercent, orderType]);

  const showNotice = message => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 2600);
  };

  const logEvent = (type, message, details = {}) => {
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: stamp(), type, message, ...details };
    setJournal(current => [item, ...current].slice(0, 200));
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
      setTradePlan(null);
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
    const instrument = markets.find(item => item.symbol === position.symbol) || market;
    const isBuy = String(position.side).toUpperCase() === 'BUY';
    const slDirection = isBuy ? 'down' : 'up';
    const tpDirection = isBuy ? 'up' : 'down';
    const normalizedPatch = {
      ...(Object.prototype.hasOwnProperty.call(patch, 'sl') ? { sl: normalizePriceToTick(patch.sl, instrument, slDirection) } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, 'tp') ? { tp: normalizePriceToTick(patch.tp, instrument, tpDirection) } : {}),
    };
    try {
      await trading.updatePosition(id, normalizedPatch);
      if (tradePlan?.positionId === id) setTradePlan(plan => plan ? { ...plan, ...normalizedPatch } : plan);
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
      showNotice('Stop moved to break even');
    } catch (error) {
      handleTradingError(error, `Break-even ${position.symbol}`);
    }
  };

  const reversePosition = async id => {
    if (!exposure.allowed) { showNotice(exposure.reason); return; }
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return;
    try {
      await trading.reversePosition(id);
      setTradePlan(null);
      logEvent('position', `${position.symbol} reverse completed as close + opposite market order`);
      showNotice('Position reversed');
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
    if (!exposure.allowed) { showNotice(exposure.reason); return; }
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return;
    try {
      await trading.duplicatePosition(id);
      logEvent('execution', `${position.symbol} ${position.side} duplicated`);
      showNotice('Position duplicated');
    } catch (error) {
      handleTradingError(error, `Duplicate ${position.symbol}`);
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
    let entry = marketPrice;
    if (requestedType === 'limit') entry = side === 'buy' ? marketPrice - 5 * pip : marketPrice + 5 * pip;
    if (requestedType === 'stop' || requestedType === 'stop-limit') entry = side === 'buy' ? marketPrice + 5 * pip : marketPrice - 5 * pip;
    const entryDirection = requestedType === 'limit'
      ? (side === 'buy' ? 'down' : 'up')
      : requestedType === 'stop' || requestedType === 'stop-limit'
        ? (side === 'buy' ? 'up' : 'down')
        : 'nearest';
    entry = normalizePriceToTick(entry, market, entryDirection);
    const slDirection = side === 'buy' ? 'down' : 'up';
    const tpDirection = side === 'buy' ? 'up' : 'down';
    const sl = normalizePriceToTick(side === 'buy' ? entry - 4.2 * pip : entry + 4.2 * pip, market, slDirection);
    const tp = normalizePriceToTick(side === 'buy' ? entry + 8.4 * pip : entry - 8.4 * pip, market, tpDirection);
    const limitPrice = requestedType === 'stop-limit'
      ? normalizePriceToTick(side === 'buy' ? entry + 1.5 * pip : entry - 1.5 * pip, market, side === 'buy' ? 'up' : 'down')
      : null;
    setTradePlan({ side, entry, sl, tp, limitPrice, marketPrice, orderType: requestedType, pending, sizingMode, manualLots: lots, expiration: 'GTC', stage: 'planning', open: false });
  };

  const cancelPlan = () => {
    if (tradePlan?.open && tradePlan.positionId) {
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
    const volume = normalizeExecutionVolume(calculated, market);
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
    if (result?.position || result?.reconciled || String(result?.order?.status || '').toUpperCase() === 'FILLED') setTradePlan(null);
  };

  const manualOrder = order => {
    if (trading.commandState.pending || !exposure.allowed) { if (!exposure.allowed) showNotice(exposure.reason); return; }
    const instrument = markets.find(item => item.symbol === order.symbol) || market;
    const executionLots = normalizeExecutionVolume(order.lots, instrument);
    void runMarketExecution({ side: order.side, executionLots, symbol: order.symbol, requestedPrice: order.price });
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
    if (order.symbol && order.symbol !== activeSymbol) onSelectSymbol(order.symbol);
    setTradePlan({ ...order, editingOrderId: id, stage: 'ready', open: false, pending: true });
    setOrderType(order.orderType);
    setSizingMode('lots');
    if (Number.isFinite(Number(order.manualLots))) setLots(Number(order.manualLots));
    setActiveNav('chart');
    setOverlay(null);
    showNotice('Pending order loaded for modification');
  };

  const openChart = symbol => {
    if (symbol) onSelectSymbol(symbol);
    setActiveNav('chart');
    setOverlay(null);
  };

  const addIndicator = id => setIndicators(current => {
    if (id === 'volume') {
      const existing = current.find(item => item.id === 'volume');
      if (existing) return current.map(item => item.instanceId === existing.instanceId ? { ...item, visible: true } : item);
    }
    const created = createIndicator(id);
    return created ? [...current, created] : current;
  });
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
    try { if (!document.fullscreenElement && shellRef.current?.requestFullscreen) await shellRef.current.requestFullscreen(); } catch { /* in-app focus remains */ }
  };
  const exitChartFocus = async () => {
    setChartFocus(false);
    try { if (document.fullscreenElement) await document.exitFullscreen?.(); } catch { /* ignore */ }
  };

  const plannedRisk = estimatedRisk(tradePlan, riskPercent, lots, account.equity, market, account.currency);
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
    account,
  };

  const chartContent = (
    <>
      <TopBar balance={`${account.currency === 'EUR' ? '€' : '$'}${Number(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} live={trading.connection.status === 'ready'} onSearch={() => setOverlay('search')} onNotifications={() => setOverlay('notifications')} onProfile={() => setOverlay('profile')} />
      <div className="px-2">
        <MarketPanel market={market} tick={tick} timeframe={timeframe} setTimeframe={setTimeframe} chartMode={chartMode} setChartMode={setChartMode} selectedTool={selectedTool} setSelectedTool={setSelectedTool} favorite={favorite} setFavorite={setFavorite} fullscreen={chartFocus} onFullscreen={enterChartFocus} tradePlan={tradePlan} onTradePlanChange={updatePlan} positions={positions} onUpdatePosition={updatePosition} onSelectInstrument={() => setOverlay('instruments')} onIndicators={() => setOverlay('indicators')} indicators={indicators} />
        <PropRiskStrip account={account} plannedRisk={plannedRisk} />
        <ExecutionPanel market={market} account={account} exposureAllowed={exposure.allowed} exposureBlockReason={exposure.reason} lots={lots} onLotsChange={setLots} sizingMode={sizingMode} onSizingModeChange={setSizingMode} riskPercent={riskPercent} onRiskPercentChange={setRiskPercent} orderType={orderType} onOrderTypeChange={setOrderType} tradePlan={tradePlan} onStartPlan={startPlan} onCancelPlan={cancelPlan} onExecutePlan={executePlan} onModifyPlan={modifyPlan} onManualOrder={manualOrder} onTradePlanChange={updatePlan} />
        <PositionsPanel positions={positions} markets={markets} positionHistory={positionHistory} pendingOrders={pendingOrders} journal={journal} onClosePosition={closePosition} onCloseAll={closeAllPositions} onBreakEven={movePositionToBreakEven} onReverse={reversePosition} onUpdatePosition={updatePosition} onSetTrailing={setPositionTrailing} onDuplicate={duplicatePosition} onCancelPending={cancelPendingOrder} onModifyPending={modifyPendingOrder} />
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-[#02070c] font-sans text-[#f5f8fb] antialiased">
      <main ref={shellRef} className={chartFocus ? 'relative mx-auto h-dvh w-full max-w-[460px] overflow-hidden bg-[#050b12]' : 'relative mx-auto min-h-dvh w-full max-w-[460px] overflow-x-hidden bg-[#050b12] bg-[radial-gradient(circle_at_top,rgba(26,79,116,0.20),transparent_36%)] pb-[98px]'}>
        {chartFocus ? (
          <MobileScalperMode market={market} tick={tick} timeframe={timeframe} setTimeframe={setTimeframe} chartMode={chartMode} setChartMode={setChartMode} selectedTool={selectedTool} setSelectedTool={setSelectedTool} lots={lots} setLots={setLots} sizingMode={sizingMode} setSizingMode={setSizingMode} riskPercent={riskPercent} setRiskPercent={setRiskPercent} orderType={orderType} setOrderType={setOrderType} tradePlan={tradePlan} onStartPlan={startPlan} onCancelPlan={cancelPlan} onExecutePlan={executePlan} onModifyPlan={modifyPlan} onManualOrder={manualOrder} onTradePlanChange={updatePlan} positions={positions} onUpdatePosition={updatePosition} onIndicators={() => setOverlay('indicators')} indicators={indicators} account={account} plannedRisk={plannedRisk} exposureAllowed={exposure.allowed} exposureBlockReason={exposure.reason} onExit={exitChartFocus} />
        ) : (
          <>
            {activeNav === 'watchlist' && <WatchlistSection markets={markets} activeSymbol={activeSymbol} onOpenTrade={openChart} onAddInstrument={() => setOverlay('search')} />}
            {activeNav === 'chart' && chartContent}
            {activeNav === 'trade' && <TradeSection account={account} positions={positions} pendingOrders={pendingOrders} markets={markets} onOpenChart={openChart} onClosePosition={closePosition} onCloseAll={closeAllPositions} onCancelPending={cancelPendingOrder} onModifyPending={modifyPendingOrder} onNewOrder={() => openChart(activeSymbol)} />}
            {activeNav === 'history' && <HistorySection positionHistory={positionHistory} journal={journal} markets={markets} accountCurrency={account.currency} onOpenChart={openChart} onNotice={showNotice} />}
            {activeNav === 'account' && <AccountSection account={account} onOpenSheet={setOverlay} />}
            <BottomNavbar active={activeNav} onChange={id => { setActiveNav(id); setOverlay(null); }} />
          </>
        )}

        <ExecutionStatus event={executionEvent} instrument={market} onDismiss={() => setExecutionEvent(null)} />
        {notice && <div className="fixed left-1/2 top-[74px] z-[120] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 rounded-xl border border-[#254155] bg-[#0b1b28]/95 px-3 py-2.5 text-center text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)] backdrop-blur-xl">{notice}</div>}
        {overlay && <FrontendSheet type={overlay} onClose={() => setOverlay(null)} markets={markets} activeSymbol={activeSymbol} onSelectSymbol={symbol => { onSelectSymbol(symbol); if (overlay === 'search' || overlay === 'instruments') setActiveNav('chart'); }} {...indicatorSheetProps} />}
      </main>
    </div>
  );
}
