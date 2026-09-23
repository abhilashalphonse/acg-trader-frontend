import React, { useEffect, useMemo, useRef, useState } from 'react';
import MobileTradingHeader from '../components/trading-v2/MobileTradingHeader.jsx';
import MarketPanel from '../components/trading-v2/MarketPanel.jsx';
import ExecutionPanel from '../components/trading-v2/ExecutionPanel.jsx';
import MobileScalperMode from '../components/trading-v2/MobileScalperMode.jsx';
import FrontendSheet from '../components/trading-v2/FrontendSheet.jsx';
import PropRiskStrip from '../components/trading-v2/PropRiskStrip.jsx';
import ExecutionStatus from '../components/trading-v2/ExecutionStatus.jsx';
import MobileInstrumentSheet from '../components/trading-v2/MobileInstrumentSheet.jsx';
import MobileTradesSheet from '../components/trading-v2/MobileTradesSheet.jsx';
import MobileAccountSheet from '../components/trading-v2/MobileAccountSheet.jsx';
import { useTradingTerminal } from '../hooks/useTradingTerminal.js';
import { createIndicator, INDICATOR_LIBRARY } from '../utils/indicators.js';
import { calculateRiskOrderSizing, defaultPlannerStopDistance, estimateStopRisk, evaluateRiskToolSetup } from '../utils/tradingRisk.js';
import { exposureAvailability } from '../utils/exposureAvailability.js';
import {
  normalizePriceToTick,
  normalizeProtectionPrice,
  normalizeVolumeToStep,
  pendingPriceDirection,
} from '../utils/tradingCommandNormalization.js';
import { formatInstrumentPrice, instrumentPipSize } from '../utils/instrumentFormatting.js';
import { normalizeTradePlanPatch } from '../utils/tradePlanNormalization.js';
import { effectiveTradePlan } from '../utils/tradePlanExecution.js';

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

const ALLOWED_TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W']);

function normalizeTimeframePreference(value) {
  const raw = String(value || '');
  const aliases = { '1h': '1H', '4h': '4H', '1d': '1D', D: '1D', '1w': '1W' };
  const normalized = aliases[raw] || raw;
  return ALLOWED_TIMEFRAMES.has(normalized) ? normalized : '1m';
}

function loadTerminalPrefs() {
  if (typeof window === 'undefined') return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(TERMINAL_PREFS_KEY) || '{}');
    if (!stored || typeof stored !== 'object') return {};
    return { ...stored, timeframe: normalizeTimeframePreference(stored.timeframe) };
  } catch {
    return {};
  }
}

function formatMoneyForNotice(value, currency = 'USD') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(number);
  } catch {
    return `${number.toFixed(2)} ${currency || ''}`.trim();
  }
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

export default function MobileTraderShell({ market, tick, markets = [], activeSymbol, onSelectSymbol = () => {}, watchlists = null }) {
  const shellRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const executionDismissRef = useRef(null);
  const nativeFullscreenRef = useRef(false);
  const prefsRef = useRef(loadTerminalPrefs());
  const trading = useTradingTerminal(markets);
  const { account, positions, pendingOrders, positionHistory } = trading;

  const [timeframe, setTimeframe] = useState(prefsRef.current.timeframe || '1m');
  const [chartMode, setChartMode] = useState(prefsRef.current.chartMode || 'candles');
  const [selectedTool, setSelectedTool] = useState('cursor');
  const favorite = watchlists?.isWatched?.(activeSymbol) === true;
  const setFavorite = () => watchlists?.toggleSymbol?.(activeSymbol);
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

  useEffect(() => {
    if (chartFocus || typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    });
  }, [activeSymbol, chartFocus]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;

    const syncFullscreenState = () => {
      const shellIsNativeFullscreen = document.fullscreenElement === shellRef.current;
      if (shellIsNativeFullscreen) {
        nativeFullscreenRef.current = true;
      } else if (nativeFullscreenRef.current) {
        nativeFullscreenRef.current = false;
        setChartFocus(false);
      }

      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      });
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || chartFocus) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, [chartFocus]);

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
    if (!position) return false;
    try {
      await trading.closePosition(id, percentage);
      if (tradePlan?.positionId === id && Number(percentage) >= 100) setTradePlan(null);
      logEvent('position', `${percentage >= 100 ? 'Closed' : `Closed ${percentage}% of`} ${position.symbol} ${position.side}`);
      showNotice(percentage >= 100 ? 'Position closed' : `${percentage}% of position closed`);
      return true;
    } catch (error) {
      handleTradingError(error, `Close ${position.symbol}`);
      return false;
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
    if (!position) return false;
    try {
      await trading.movePositionToBreakEven(id);
      if (tradePlan?.positionId === id) setTradePlan(plan => plan ? { ...plan, sl: position.entry } : plan);
      logEvent('modify', `${position.symbol} stop moved to break even`);
      showNotice('Stop moved to break even');
      return true;
    } catch (error) {
      handleTradingError(error, `Break-even ${position.symbol}`);
      return false;
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
    const sideUpper = String(side).toUpperCase();
    entry = normalizePriceToTick(entry, market, pendingPriceDirection(requestedType, sideUpper, 'entry'));
    const stopDistance = defaultPlannerStopDistance(market, entry) || 10 * pip;
    const sl = normalizeProtectionPrice(side === 'buy' ? entry - stopDistance : entry + stopDistance, market, sideUpper, 'sl');
    const tp = normalizeProtectionPrice(side === 'buy' ? entry + stopDistance * 2 : entry - stopDistance * 2, market, sideUpper, 'tp');
    const limitPrice = requestedType === 'stop-limit'
      ? normalizePriceToTick(side === 'buy' ? entry + 1.5 * pip : entry - 1.5 * pip, market, pendingPriceDirection(requestedType, sideUpper, 'limit'))
      : null;
    setTradePlan({ symbol: market?.symbol, side, entry, sl, tp, limitPrice, marketPrice, orderType: requestedType, pending, sizingMode, manualLots: lots, expiration: 'GTC', stage: 'planning', open: false });
  };


  const createPlanFromRiskTool = setup => {
    if (!setup?.symbol || !setup?.side) return;
    const instrument = markets.find(item => item.symbol === setup.symbol) || (market?.symbol === setup.symbol ? market : null);
    if (!instrument) {
      showNotice('Instrument is unavailable for this risk setup');
      return;
    }

    const side = String(setup.side).toLowerCase();
    if (!['buy', 'sell'].includes(side)) return;
    const livePrice = Number(side === 'buy' ? instrument.ask : instrument.bid);
    if (!Number.isFinite(livePrice) || livePrice <= 0) {
      showNotice('Live market price is unavailable — risk setup was not loaded');
      return;
    }

    const rawEntry = Number(setup.entry);
    const rawSl = Number(setup.sl);
    const rawTp = Number(setup.tp);
    const numericRisk = Math.max(0.1, Math.min(5, Number(setup.riskPercent) || riskPercent));
    const evaluation = evaluateRiskToolSetup({
      plan: { entry: rawEntry, sl: rawSl, tp: rawTp, side },
      riskPercent: numericRisk,
      account,
      instrument,
    });
    if (!evaluation.canCreateOrder) {
      showNotice(evaluation.message || 'Risk setup cannot create an order');
      return;
    }

    const tickSize = Number(instrument.tickSize) > 0 ? Number(instrument.tickSize) : Number(instrumentPipSize(instrument));
    const nearMarket = Number.isFinite(tickSize) && tickSize > 0 && Math.abs(rawEntry - livePrice) <= tickSize * 1.5;
    let nextOrderType = 'market';
    if (!nearMarket) {
      if (side === 'buy') nextOrderType = rawEntry < livePrice ? 'limit' : 'stop';
      else nextOrderType = rawEntry > livePrice ? 'limit' : 'stop';
    }

    const sideUpper = side.toUpperCase();
    const entry = nextOrderType === 'market'
      ? normalizePriceToTick(livePrice, instrument, 'nearest')
      : normalizePriceToTick(rawEntry, instrument, pendingPriceDirection(nextOrderType, sideUpper, 'entry'));
    const sl = normalizeProtectionPrice(rawSl, instrument, sideUpper, 'sl');
    const tp = normalizeProtectionPrice(rawTp, instrument, sideUpper, 'tp');
    const sizedLots = Number(evaluation.sizing?.requestedLots);
    const normalizedLots = Number.isFinite(sizedLots) && sizedLots > 0
      ? normalizeVolumeToStep(sizedLots, instrument)
      : lots;

    if (setup.symbol !== activeSymbol) onSelectSymbol(setup.symbol);
    setRiskPercent(numericRisk);
    setSizingMode('risk');
    setOrderType(nextOrderType);
    setLots(normalizedLots);
    setTradePlan({
      symbol: setup.symbol,
      side,
      entry,
      sl,
      tp,
      limitPrice: null,
      marketPrice: livePrice,
      orderType: nextOrderType,
      pending: nextOrderType !== 'market',
      sizingMode: 'risk',
      manualLots: normalizedLots,
      expiration: 'GTC',
      stage: 'ready',
      open: false,
      sourceDrawingId: setup.sourceDrawingId || null,
    });
    setSelectedTool('cursor');
    setOverlay(null);
    logEvent('planner', `${sideUpper} risk setup loaded from chart · ${numericRisk.toFixed(2)}% risk`, {
      symbol: setup.symbol,
      entry,
      stopLoss: sl,
      takeProfit: tp,
      lots: normalizedLots,
      riskPercent: numericRisk,
      orderType: nextOrderType,
    });
    showNotice('Risk setup loaded into order planner — review and confirm');
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

    const planSymbol = String(tradePlan.symbol || '').toUpperCase();
    if (!planSymbol) {
      showNotice('This order plan has no instrument. Cancel it and create a new order.');
      return;
    }
    if (String(market?.symbol || '').toUpperCase() !== planSymbol) {
      showNotice(`This order plan belongs to ${planSymbol}. Return to ${planSymbol} to execute it.`);
      return;
    }
    const planMarket = markets.find(item => String(item?.symbol || '').toUpperCase() === planSymbol) || market;
    if (!planMarket) {
      showNotice(`${planSymbol} is unavailable. Cancel this plan and try again.`);
      return;
    }
    const executionPlan = tradePlan.open ? tradePlan : effectiveTradePlan(tradePlan, planMarket);

    let calculated;
    if (executionPlan.sizingMode === 'risk') {
      const sizing = calculateRiskOrderSizing(executionPlan, riskPercent, account, planMarket);
      if (!sizing) {
        showNotice('Risk % sizing is unavailable because this instrument P&L requires currency conversion. Use Lots sizing.');
        return;
      }
      if (!sizing.canExecute) {
        if (sizing.blockReason === 'INSUFFICIENT_MARGIN') {
          showNotice(`Risk size requires ${formatMoneyForNotice(sizing.requiredMargin, account.currency)} margin; only ${formatMoneyForNotice(sizing.freeMargin, account.currency)} is free.`);
        } else if (sizing.blockReason === 'MAX_VOLUME') {
          showNotice(`Selected risk requires ${sizing.requestedRaw.toFixed(2)} lots, above the instrument maximum. Widen the stop or reduce risk.`);
        } else {
          showNotice('The minimum tradable volume exceeds the selected risk. Increase risk or use Lots sizing.');
        }
        return;
      }
      calculated = sizing.requestedLots;
    } else {
      calculated = Math.max(0.01, Number(executionPlan.manualLots ?? lots) || 0.01);
    }
    const volume = normalizeVolumeToStep(calculated, planMarket);
    if (executionPlan.pending) {
      const request = {
        symbol: planSymbol,
        side: executionPlan.side,
        type: executionPlan.orderType,
        volume,
        entry: executionPlan.entry,
        limitPrice: executionPlan.limitPrice,
        stopLoss: executionPlan.sl,
        takeProfit: executionPlan.tp,
        timeInForce: executionPlan.expiration || 'GTC',
        expiresAt: executionPlan.expirationAt || executionPlan.expiresAt || null,
      };
      setExecutionEvent({ side: executionPlan.side, lots: volume, symbol: planSymbol, requestedPrice: executionPlan.entry, status: 'submitting' });
      try {
        const result = executionPlan.editingOrderId
          ? await trading.replacePendingOrder(executionPlan.editingOrderId, request)
          : await trading.placePendingOrder(request);
        setExecutionEvent({ side: executionPlan.side, lots: volume, symbol: planSymbol, requestedPrice: executionPlan.entry, status: 'pending', message: `${String(executionPlan.orderType).toUpperCase()} order waiting for trigger` });
        logEvent('order', `${String(executionPlan.side).toUpperCase()} ${String(executionPlan.orderType).toUpperCase()} ${volume.toFixed(2)} ${planSymbol} placed`, { orderId: result?.order?.id });
        setTradePlan(null);
        dismissExecutionLater();
      } catch (error) {
        handleTradingError(error, 'Pending order');
      }
      return;
    }

    const result = await runMarketExecution({
      side: executionPlan.side,
      executionLots: volume,
      symbol: planSymbol,
      requestedPrice: executionPlan.entry,
      stopLoss: executionPlan.sl,
      takeProfit: executionPlan.tp,
    });
    if (result?.position || result?.reconciled || String(result?.order?.status || '').toUpperCase() === 'FILLED') setTradePlan(null);
  };

  const manualOrder = order => {
    if (trading.commandState.pending || !exposure.allowed) { if (!exposure.allowed) showNotice(exposure.reason); return; }
    const instrument = markets.find(item => item.symbol === order.symbol) || market;
    const executionLots = normalizeVolumeToStep(order.lots, instrument);
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
    setTradePlan(plan => {
      if (!plan) return plan;
      const planMarket = markets.find(item => String(item?.symbol || '').toUpperCase() === String(plan.symbol || '').toUpperCase()) || market;
      return { ...plan, ...normalizeTradePlanPatch(plan, patch, planMarket) };
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
    if (order.symbol && order.symbol !== activeSymbol) onSelectSymbol(order.symbol);
    setTradePlan({ ...order, editingOrderId: id, stage: 'ready', open: false, pending: true });
    setOrderType(order.orderType);
    setSizingMode('lots');
    if (Number.isFinite(Number(order.manualLots))) setLots(Number(order.manualLots));
    setOverlay(null);
    showNotice('Pending order loaded for modification');
  };

  const openChart = symbol => {
    if (symbol) onSelectSymbol(symbol);
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
    if (settings.timeframe) setTimeframe(normalizeTimeframePreference(settings.timeframe));
    if (settings.chartMode) setChartMode(settings.chartMode);
    if (settings.sizingMode) setSizingMode(settings.sizingMode);
    if (Number.isFinite(Number(settings.riskPercent))) setRiskPercent(Number(settings.riskPercent));
    if (Number.isFinite(Number(settings.lots))) setLots(Math.max(0.01, Number(settings.lots)));
    if (settings.orderType) setOrderType(settings.orderType);
    if (Array.isArray(profile.indicators)) setIndicators(profile.indicators.map(item => createIndicator(item.id, item.settings || {})).filter(Boolean));
    if (profile.symbol && markets.some(item => item.symbol === profile.symbol)) onSelectSymbol(profile.symbol);
    setSelectedTool('cursor');
    setTradePlan(null);
    setOverlay(null);
    showNotice(`${profile.name || 'Trading'} profile applied`);
  };

  const enterChartFocus = async () => {
    setChartFocus(true);
    try {
      if (!document.fullscreenElement && shellRef.current?.requestFullscreen) {
        await shellRef.current.requestFullscreen();
        nativeFullscreenRef.current = document.fullscreenElement === shellRef.current;
      }
    } catch {
      nativeFullscreenRef.current = false;
      // Native fullscreen is optional; keep the in-app focus layout available.
    }

    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  };

  const exitChartFocus = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
    } catch {
      // The in-app focus state still needs to close even if the browser rejects exitFullscreen.
    } finally {
      nativeFullscreenRef.current = false;
      setChartFocus(false);
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      });
    }
  };

  const plannedRiskInstrument = markets.find(item => String(item?.symbol || '').toUpperCase() === String(tradePlan?.symbol || '').toUpperCase()) || market;
  const canonicalTradePlan = useMemo(() => {
    if (!tradePlan || tradePlan.open) return tradePlan;
    return effectiveTradePlan(tradePlan, plannedRiskInstrument);
  }, [plannedRiskInstrument, tradePlan]);
  const canonicalRiskSizing = useMemo(() => {
    if (!canonicalTradePlan || canonicalTradePlan.sizingMode !== 'risk') return null;
    return calculateRiskOrderSizing(canonicalTradePlan, riskPercent, account, plannedRiskInstrument);
  }, [account, canonicalTradePlan, plannedRiskInstrument, riskPercent]);
  const tradePlanLots = canonicalTradePlan
    ? normalizeVolumeToStep(
      canonicalTradePlan.sizingMode === 'risk'
        ? (canonicalRiskSizing?.requestedLots ?? canonicalTradePlan.manualLots ?? lots)
        : (canonicalTradePlan.manualLots ?? lots),
      plannedRiskInstrument,
    )
    : lots;
  const plannedRisk = canonicalTradePlan && Number.isFinite(Number(tradePlanLots))
    ? estimateStopRisk(canonicalTradePlan, tradePlanLots, plannedRiskInstrument, account.currency)
    : 0;
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
    <div className="acg-mobile-chart-shell flex h-dvh min-h-0 flex-col overflow-hidden overscroll-none bg-black">
      <MobileTradingHeader
        market={market}
        account={account}
        positionsCount={positions.length}
        pendingCount={pendingOrders.length}
        favorite={favorite}
        onFavorite={setFavorite}
        onSelectInstrument={() => setOverlay('markets')}
        onOpenTrades={() => setOverlay('trades')}
        onOpenAccount={() => setOverlay('account')}
      />
      <div className="acg-mobile-reference-content flex min-h-0 flex-1 flex-col px-2 pt-[10px]">
        <div className="acg-mobile-reference-chart-wrap min-h-0 flex-1">
          <MarketPanel market={market} tick={tick} timeframe={timeframe} setTimeframe={setTimeframe} chartMode={chartMode} setChartMode={setChartMode} selectedTool={selectedTool} setSelectedTool={setSelectedTool} favorite={favorite} setFavorite={setFavorite} fullscreen={chartFocus} onFullscreen={enterChartFocus} tradePlan={canonicalTradePlan} tradePlanLots={tradePlanLots} accountCurrency={account.currency} account={account} riskPercent={riskPercent} onCreateRiskOrder={createPlanFromRiskTool} onTradePlanChange={updatePlan} positions={positions} pendingOrders={pendingOrders} onModifyPending={modifyPendingOrder} onCancelPending={cancelPendingOrder} onUpdatePosition={updatePosition} onClosePosition={closePosition} onSelectInstrument={() => setOverlay('markets')} onIndicators={() => setOverlay('indicators')} indicators={indicators} showInstrumentHeader={false} compactMobileToolbar fillAvailableHeight />
        </div>
        <div className="acg-mobile-reference-order-wrap mt-1.5 shrink-0">
          <ExecutionPanel
            market={market}
            account={account}
            exposureAllowed={exposure.allowed}
            exposureBlockReason={exposure.reason}
            lots={lots}
            onLotsChange={setLots}
            sizingMode={sizingMode}
            onSizingModeChange={setSizingMode}
            riskPercent={riskPercent}
            onRiskPercentChange={setRiskPercent}
            orderType={orderType}
            onOrderTypeChange={setOrderType}
            tradePlan={canonicalTradePlan}
            onStartPlan={startPlan}
            onCancelPlan={cancelPlan}
            onExecutePlan={executePlan}
            onModifyPlan={modifyPlan}
            onManualOrder={manualOrder}
            onTradePlanChange={updatePlan}
            mobileDocked
            riskContent={<PropRiskStrip account={account} plannedRisk={plannedRisk} embedded />}
          />
        </div>
        <div className="h-[max(5px,env(safe-area-inset-bottom))] shrink-0 bg-black" aria-hidden="true" />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-black font-sans text-[#f5f8fb] antialiased">
      <main ref={shellRef} className="relative mx-auto h-dvh w-full max-w-[460px] overflow-hidden overscroll-none bg-black">
        {chartFocus ? (
          <MobileScalperMode market={market} tick={tick} timeframe={timeframe} setTimeframe={setTimeframe} chartMode={chartMode} setChartMode={setChartMode} selectedTool={selectedTool} setSelectedTool={setSelectedTool} lots={lots} setLots={setLots} sizingMode={sizingMode} setSizingMode={setSizingMode} riskPercent={riskPercent} setRiskPercent={setRiskPercent} orderType={orderType} setOrderType={setOrderType} tradePlan={canonicalTradePlan} tradePlanLots={tradePlanLots} onStartPlan={startPlan} onCancelPlan={cancelPlan} onExecutePlan={executePlan} onModifyPlan={modifyPlan} onManualOrder={manualOrder} onTradePlanChange={updatePlan} onCreateRiskOrder={createPlanFromRiskTool} positions={positions} pendingOrders={pendingOrders} onModifyPending={modifyPendingOrder} onCancelPending={cancelPendingOrder} onUpdatePosition={updatePosition} onClosePosition={closePosition} onIndicators={() => setOverlay('indicators')} indicators={indicators} account={account} plannedRisk={plannedRisk} exposureAllowed={exposure.allowed} exposureBlockReason={exposure.reason} onExit={exitChartFocus} />
        ) : chartContent}

        <ExecutionStatus event={executionEvent} instrument={market} onDismiss={() => setExecutionEvent(null)} />
        {notice && <div className="fixed left-1/2 top-[52px] z-[120] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 rounded-xl border border-white/[0.08] bg-[#101010]/95 px-3 py-2.5 text-center text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)] backdrop-blur-xl">{notice}</div>}

        {overlay === 'markets' && (
          <MobileInstrumentSheet
            markets={markets}
            activeSymbol={activeSymbol}
            watchlists={watchlists}
            onSelectSymbol={onSelectSymbol}
            onClose={() => setOverlay(null)}
          />
        )}

        {overlay === 'trades' && (
          <MobileTradesSheet
            onClose={() => setOverlay(null)}
            account={account}
            positions={positions}
            pendingOrders={pendingOrders}
            positionHistory={positionHistory}
            journal={journal}
            markets={markets}
            onOpenChart={openChart}
            onClosePosition={closePosition}
            onCloseAll={closeAllPositions}
            onCancelPending={cancelPendingOrder}
            onModifyPending={modifyPendingOrder}
            onUpdatePosition={updatePosition}
            onBreakEven={movePositionToBreakEven}
            onNotice={showNotice}
          />
        )}

        {overlay === 'account' && (
          <MobileAccountSheet
            account={account}
            onClose={() => setOverlay(null)}
            onPlatformSettings={() => setOverlay('platform')}
            onHelp={() => setOverlay('help')}
          />
        )}

        {overlay && !['markets', 'trades', 'account'].includes(overlay) && (
          <FrontendSheet
            type={overlay}
            onClose={() => setOverlay(null)}
            markets={markets}
            activeSymbol={activeSymbol}
            watchlists={watchlists}
            onSelectSymbol={symbol => { onSelectSymbol(symbol); setOverlay(null); }}
            {...indicatorSheetProps}
          />
        )}
      </main>
    </div>
  );
}
