import React, { useEffect, useRef, useState } from 'react';
import TopBar from '../components/trading-v2/TopBar.jsx';
import MarketPanel from '../components/trading-v2/MarketPanel.jsx';
import ExecutionPanel from '../components/trading-v2/ExecutionPanel.jsx';
import PositionsPanel from '../components/trading-v2/PositionsPanel.jsx';
import BottomNavbar from '../components/trading-v2/BottomNavbar.jsx';
import DesktopTerminal from '../components/trading-v2/DesktopTerminal.jsx';
import MobileScalperMode from '../components/trading-v2/MobileScalperMode.jsx';
import FrontendSheet from '../components/trading-v2/FrontendSheet.jsx';
import HelpCenter from '../help/HelpCenter.jsx';
import WatchlistSection from '../components/trading-v2/WatchlistSection.jsx';
import PropRiskStrip from '../components/trading-v2/PropRiskStrip.jsx';
import ExecutionStatus from '../components/trading-v2/ExecutionStatus.jsx';
import TradingPermissionNotice from '../components/trading-v2/TradingPermissionNotice.jsx';
import useTradingHotkeys from '../hooks/useTradingHotkeys.js';
import { useTradingTerminal } from '../hooks/useTradingTerminal.js';
import { createIndicator, INDICATOR_LIBRARY } from '../utils/indicators.js';
import { normalizePriceToTick, normalizeProtectionPrice, normalizeVolumeToStep, pendingPriceDirection } from '../utils/tradingCommandNormalization.js';
import {defaultPlannerStopDistance, estimateOpeningRequirement, estimateStopRisk, evaluateRiskToolSetup, estimateLossAtStopWithCosts } from '../utils/tradingRisk.js';
import { exposureAvailability } from '../utils/exposureAvailability.js';
import { formatInstrumentPrice, instrumentPipSize } from '../utils/instrumentFormatting.js';
import { normalizeTradePlanPatch } from '../utils/tradePlanNormalization.js';
import { buildChartPendingAmendment, isActiveChartProtection } from '../utils/pendingOrderChartMove.js';
import { DEFAULT_RISK_GUARD_SETTINGS, evaluateRiskGuard } from '../utils/riskGuard.js';
import { createDefaultTradePlan, effectiveTradePlan, validateTradePlanForExecution } from '../utils/tradePlanExecution.js';
import { estimateExecutionPrice, resolveExecutionPreview } from '../utils/executionPricing.js';
import { deriveAccountCapabilities, protectionRequirement } from '../utils/accountCapabilities.js';
import { validateOpenPositionProtection } from '../utils/openPositionPresentation.js';
import { marketForSymbol, positionCloseAvailability, summarizeCloseAllResult } from '../utils/marketExecutionAvailability.js';

const INDICATOR_STORAGE_KEY = 'acg-trader-indicators-v1';
const INDICATOR_FAVORITES_KEY = 'acg-trader-indicator-favorites-v1';
const TERMINAL_PREFS_KEY = 'acg-trader-terminal-prefs-v1';
const RISK_GUARD_STORAGE_KEY = 'acg-trader-risk-guard-v1';
const JOURNAL_STORAGE_PREFIX = 'acg-trader-journal-v1';

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

function loadRiskGuardSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_RISK_GUARD_SETTINGS };
  try {
    const stored = JSON.parse(window.localStorage.getItem(RISK_GUARD_STORAGE_KEY) || 'null');
    return { ...DEFAULT_RISK_GUARD_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
  } catch {
    return { ...DEFAULT_RISK_GUARD_SETTINGS };
  }
}

function loadJournal(accountId) {
  if (typeof window === 'undefined' || !accountId) return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(`${JOURNAL_STORAGE_PREFIX}:${accountId}`) || '[]');
    return Array.isArray(stored) ? stored.slice(0, 300) : [];
  } catch {
    return [];
  }
}

function estimatedRisk(plan, riskPercent, manualLots, account, instrument) {
  if (!plan) return 0;
  const preview = resolveExecutionPreview({ plan, riskPercent, manualLots, account, instrument });
  if (!Number.isFinite(Number(preview.sizing?.lots))) return null;
  const riskPlan = preview.riskPlan || preview.plan || plan;
  return estimateLossAtStopWithCosts(riskPlan, preview.sizing.lots, instrument, account);
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
  onViewportQuoteSymbolsChange = () => {},
}) {
  const shellRef = useRef(null);
  const nativeFullscreenRequestedRef = useRef(false);
  const noticeTimerRef = useRef(null);
  const executionDismissRef = useRef(null);
  const prefsRef = useRef(loadTerminalPrefs());
  const journalAccountRef = useRef(null);
  const isDesktop = useDesktopLayout();
  const trading = useTradingTerminal(markets);
  const { account, positions, pendingOrders, positionHistory } = trading;
  const readOnly = String(account?.status || '').toUpperCase() === 'BREACHED';
  const executionCommandState = {
    ...trading.commandState,
    accountSwitching: trading.accountSwitching || trading.accountGrantMissing,
    accountSwitchError: trading.accountSwitchError,
  };

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
  const [selectedOpenPositionId, setSelectedOpenPositionId] = useState(null);
  const [positionProtectionDraft, setPositionProtectionDraft] = useState(null);
  const [positionProtectionSaving, setPositionProtectionSaving] = useState(false);
  const [journal, setJournal] = useState([]);
  const [executionEvent, setExecutionEvent] = useState(null);
  const [indicators, setIndicators] = useState(loadIndicators);
  const [indicatorFavorites, setIndicatorFavorites] = useState(loadIndicatorFavorites);
  const [overlay, setOverlay] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [riskGuardSettings, setRiskGuardSettings] = useState(loadRiskGuardSettings);
  const [tradingPolicyStatus, setTradingPolicyStatus] = useState(null);
  const accountCapabilities = deriveAccountCapabilities(account);
  const exposure = exposureAvailability({ account, connectionStatus: trading.connection.status, market, commandState: executionCommandState });
  const executionMarketFor = symbol => {
    const found = marketForSymbol(markets, symbol, null);
    if (found) return found;
    return String(market?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase() ? market : null;
  };
  const closeAvailabilityFor = position => positionCloseAvailability(executionMarketFor(position?.symbol));


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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(RISK_GUARD_STORAGE_KEY, JSON.stringify(riskGuardSettings)); } catch { /* preferences are non-critical */ }
  }, [riskGuardSettings]);

  useEffect(() => {
    if (!trading.accountId) return;
    journalAccountRef.current = trading.accountId;
    setJournal(loadJournal(trading.accountId));
  }, [trading.accountId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !trading.accountId || journalAccountRef.current !== trading.accountId) return;
    try { window.localStorage.setItem(`${JOURNAL_STORAGE_PREFIX}:${trading.accountId}`, JSON.stringify(journal.slice(0, 300))); } catch { /* journal persistence is best-effort */ }
  }, [journal, trading.accountId]);

  const showNotice = message => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 2600);
  };

  useEffect(() => {
    if (!trading.lifecycleEvent?.id) return;
    showNotice(trading.lifecycleEvent.message);
    trading.clearLifecycleEvent?.();
  }, [trading.lifecycleEvent?.id]);

  useEffect(() => {
    setTradingPolicyStatus(null);
    if (!trading.accountId || !activeSymbol || trading.connection.status !== 'ready') return undefined;

    let active = true;
    let controller = null;
    const loadPolicy = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await trading.getPolicyStatus(activeSymbol, controller.signal);
        if (active && !controller.signal.aborted) setTradingPolicyStatus(result || null);
      } catch {
        if (active && !controller.signal.aborted) setTradingPolicyStatus(null);
      }
    };

    void loadPolicy();
    const timer = window.setInterval(() => void loadPolicy(), 30 * 1000);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [activeSymbol, trading.accountId, trading.connection.status, trading.getPolicyStatus]);

  const selectTradingAccount = nextAccountId => {
    const target = String(nextAccountId || '').trim();
    if (!target) return false;
    try {
      if (tradePlan) setTradePlan(null);
      setSelectedOpenPositionId(null);
      setPositionProtectionDraft(null);
      setExecutionEvent(null);
      trading.selectAccount(target);
      showNotice('Switching account — synchronizing trading state…');
      return true;
    } catch (error) {
      showNotice(error?.message || 'Unable to switch trading account');
      return false;
    }
  };

  const selectSymbol = symbol => {
    const normalized = String(symbol || '').toUpperCase();
    if (!normalized) return;
    if (tradePlan && tradePlan.symbol && tradePlan.symbol !== normalized) {
      setTradePlan(null);
      showNotice('Trade plan cancelled because the active symbol changed');
    }
    if (positionProtectionDraft?.symbol && positionProtectionDraft.symbol !== normalized) {
      setPositionProtectionDraft(null);
    }
    onSelectSymbol(normalized);
  };

  useEffect(() => {
    if (!tradePlan?.symbol || !activeSymbol || tradePlan.symbol === activeSymbol) return;
    setTradePlan(null);
  }, [activeSymbol, tradePlan?.symbol]);

  useEffect(() => {
    if (isDesktop) return;
    const activePositions = positions.filter(position =>
      String(position?.symbol || '').toUpperCase() === String(activeSymbol || '').toUpperCase()
    );
    const explicitlySelected = positions.find(position => String(position?.id) === String(selectedOpenPositionId));
    const selectedStillValid = explicitlySelected
      && String(explicitlySelected?.symbol || '').toUpperCase() === String(activeSymbol || '').toUpperCase();
    const nextSelectedId = selectedStillValid
      ? explicitlySelected.id
      : activePositions.length === 1
        ? activePositions[0].id
        : null;

    if (String(nextSelectedId ?? '') !== String(selectedOpenPositionId ?? '')) {
      setSelectedOpenPositionId(nextSelectedId);
    }

    if (positionProtectionDraft) {
      const draftPositionExists = positions.some(position => String(position?.id) === String(positionProtectionDraft.positionId));
      const draftMatchesSymbol = String(positionProtectionDraft.symbol || '').toUpperCase() === String(activeSymbol || '').toUpperCase();
      if (!draftPositionExists || !draftMatchesSymbol) setPositionProtectionDraft(null);
    }
  }, [activeSymbol, isDesktop, positionProtectionDraft, positions, selectedOpenPositionId]);

  const logEvent = (type, message, details = {}) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour12: false });
    setJournal(current => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time,
      timestamp: now.toISOString(),
      type,
      message,
      ...details,
    }, ...current].slice(0, 300));
  };

  const dismissExecutionLater = (delayMs = 6000) => {
    if (executionDismissRef.current) window.clearTimeout(executionDismissRef.current);
    executionDismissRef.current = window.setTimeout(() => setExecutionEvent(null), delayMs);
  };

  const handleTradingError = (error, context = 'Trading command') => {
    if (String(error?.code || '').toUpperCase() === 'MARKET_SESSION_CLOSED') {
      const message = 'Market closed · trading resumes when the session opens.';
      setExecutionEvent(null);
      logEvent('info', `${context}: ${message}`);
      showNotice(message);
      return;
    }
    const message = trading.errorMessage(error);
    const unknown = error?.code === 'EXECUTION_STATUS_UNKNOWN';
    setExecutionEvent(current => current ? { ...current, status: unknown ? 'unknown' : 'rejected', message } : { status: unknown ? 'unknown' : 'rejected', message });
    logEvent(unknown ? 'warning' : 'error', `${context}: ${message}`);
    showNotice(message);
    dismissExecutionLater();
  };

  const runMarketExecution = async ({
    side,
    executionLots,
    symbol,
    requestedPrice,
    stopLoss = null,
    takeProfit = null,
    executionSizingMode = sizingMode,
    skipRiskGuard = false,
  }) => {
    if (!symbol || !trading.accountId) return null;
    const instrument = markets.find(item => item.symbol === symbol) || market;
    const executionExposure = exposureAvailability({ account, connectionStatus: trading.connection.status, market: instrument, commandState: executionCommandState });
    if (!executionExposure.allowed) { showNotice(executionExposure.reason); return null; }
    const protection = protectionRequirement({
      account,
      sizingMode: executionSizingMode,
      stopLoss,
    });
    if (!protection.valid) {
      showNotice(protection.message);
      return null;
    }

    const modeledPrice = Number(estimateExecutionPrice(instrument, side, executionLots)?.price);
    const effectiveRequestedPrice = Number.isFinite(modeledPrice) && modeledPrice > 0
      ? modeledPrice
      : Number(requestedPrice);
    const openingRequirement = estimateOpeningRequirement(effectiveRequestedPrice, executionLots, instrument, account);
    const freeMargin = Number(account?.freeMargin);
    if (Number.isFinite(openingRequirement) && Number.isFinite(freeMargin) && openingRequirement > freeMargin + 1e-8) {
      showNotice(`Opening requirement ${openingRequirement.toFixed(2)} ${account?.currency || 'USD'} exceeds available free margin.`);
      return null;
    }
    const proposedRisk = stopLoss == null
      ? null
      : estimateLossAtStopWithCosts({ entry: effectiveRequestedPrice, sl: stopLoss, side }, executionLots, instrument, account);
    if (!skipRiskGuard) {
      const guard = evaluateRiskGuard({
        account,
        positions,
        positionHistory,
        markets,
        proposedRisk,
        settings: riskGuardSettings,
      });
      if (!guard.allowed) {
        const message = guard.blocks[0]?.message || 'Risk Guard blocked this trade.';
        logEvent('warning', `Risk Guard: ${message}`);
        showNotice(message);
        return null;
      }
    }
    const base = {
      side: String(side).toUpperCase(),
      lots: Number(executionLots),
      symbol,
      requestedPrice: effectiveRequestedPrice,
      timeframe,
      sizingMode,
      riskPercent,
      orderType,
      stopLoss,
      takeProfit,
      plannedRisk: proposedRisk,
      challengePhase: account?.challenge?.phase || account?.challenge?.step || null,
    };
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
        riskBudget: executionSizingMode === 'risk' ? Number(account?.equity) * Number(riskPercent) / 100 : null,
      });
      const filled = fillEvent(result, base);
      setExecutionEvent(filled);
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
    if (settings.timeframe) setTimeframe(normalizeTimeframePreference(settings.timeframe));
    if (settings.chartMode) setChartMode(settings.chartMode);
    if (settings.sizingMode) setSizingMode(settings.sizingMode);
    if (Number.isFinite(Number(settings.riskPercent))) setRiskPercent(Number(settings.riskPercent));
    if (Number.isFinite(Number(settings.lots))) setLots(Math.max(0.01, Number(settings.lots)));
    if (settings.orderType) setOrderType(settings.orderType);
    if (Array.isArray(profile.indicators)) setIndicators(profile.indicators.map(item => createIndicator(item.id, item.settings || {})).filter(Boolean));
    if (profile.symbol && markets.some(item => item.symbol === profile.symbol)) selectSymbol(profile.symbol);
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
    if (!position) return false;
    const availability = closeAvailabilityFor(position);
    if (!availability.allowed) {
      showNotice(availability.reason);
      return false;
    }
    try {
      await trading.closePosition(id, percentage);
      if (tradePlan?.positionId === id && Number(percentage) >= 100) setTradePlan(null);
      logEvent('position', `${percentage >= 100 ? 'Closed' : `Closed ${percentage}% of`} ${position.symbol} ${position.side}`, { positionId: position.id, symbol: position.symbol, side: position.side, lots: position.volume, entry: position.entry, pnl: position.pnl, percentage, timeframe });
      showNotice(percentage >= 100 ? 'Position closed' : `${percentage}% of position closed`);
      return true;
    } catch (error) {
      handleTradingError(error, `Close ${position.symbol}`);
      return false;
    }
  };

  const closeAllPositions = async () => {
    if (!positions.length) return false;

    const closable = positions.filter(position => closeAvailabilityFor(position).allowed);
    if (!closable.length) {
      showNotice('Markets are closed · positions remain open until their sessions resume.');
      return false;
    }

    try {
      // Keep account-level close orchestration authoritative on the backend.
      // It closes sequentially and classifies closed-session positions as
      // skipped instead of racing multiple client-side close requests.
      const result = await trading.closeAllPositions();
      trading.refreshState();
      if (tradePlan?.open) setTradePlan(null);

      const summary = summarizeCloseAllResult(result, positions.length);
      const level = summary.failed > 0 ? 'warning' : summary.skipped > 0 ? 'info' : 'position';
      logEvent(level, `Close all: ${summary.message}`, {
        requested: summary.requested,
        closed: summary.closed,
        skipped: summary.skipped,
        failed: summary.failed,
      });
      showNotice(summary.message);
      return summary.complete;
    } catch (error) {
      handleTradingError(error, 'Close all');
      return false;
    }
  };

  const closePositionSet = async (predicate, label) => {
    const targets = positions.filter(predicate);
    if (!targets.length) {
      showNotice(`No ${label.toLowerCase()} positions to close`);
      return false;
    }

    const availabilityById = new Map(targets.map(position => [String(position.id), closeAvailabilityFor(position)]));
    const closable = targets.filter(position => availabilityById.get(String(position.id))?.allowed);
    const preflightClosed = targets.filter(position => availabilityById.get(String(position.id))?.code === 'MARKET_CLOSED').length;
    const preflightUnavailable = targets.length - closable.length - preflightClosed;

    if (!closable.length) {
      const parts = [];
      if (preflightClosed) parts.push(`${preflightClosed} market closed`);
      if (preflightUnavailable) parts.push(`${preflightUnavailable} waiting for market data`);
      showNotice(parts.join(' · ') || 'Selected positions are not currently executable.');
      return false;
    }

    const results = [];
    for (const position of closable) {
      try {
        await trading.closePosition(position.id, 100);
        results.push({ status: 'fulfilled', positionId: position.id });
      } catch (error) {
        results.push({ status: 'rejected', positionId: position.id, reason: error });
      }
    }
    const closed = results.filter(item => item.status === 'fulfilled').length;
    const racedClosed = results.filter(item => item.status === 'rejected' && String(item.reason?.code || '').toUpperCase() === 'MARKET_SESSION_CLOSED').length;
    const failed = results.length - closed - racedClosed;
    const skipped = preflightClosed + racedClosed;

    trading.refreshState();
    const parts = [];
    if (closed) parts.push(`${closed} closed`);
    if (skipped) parts.push(`${skipped} market closed`);
    if (preflightUnavailable) parts.push(`${preflightUnavailable} waiting for market data`);
    if (failed) parts.push(`${failed} failed`);
    const message = parts.join(' · ') || 'No positions were closed';

    logEvent(failed ? 'warning' : skipped || preflightUnavailable ? 'info' : 'position', `${label}: ${message}`);
    showNotice(message);
    return closed > 0 && failed === 0;
  };

  const closeWinners = () => closePositionSet(position => Number(position.pnl) > 0, 'Close winners');
  const closeLosers = () => closePositionSet(position => Number(position.pnl) < 0, 'Close losers');
  const closeSymbolPositions = symbol => closePositionSet(position => position.symbol === symbol, `Close ${symbol}`);

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

  const selectOpenPosition = positionOrId => {
    const id = typeof positionOrId === 'object' ? positionOrId?.id : positionOrId;
    const position = positions.find(item => String(item?.id) === String(id));
    if (!position) return false;
    setSelectedOpenPositionId(position.id);
    if (positionProtectionDraft && String(positionProtectionDraft.positionId) !== String(position.id)) {
      setPositionProtectionDraft(null);
    }
    if (position.symbol && position.symbol !== activeSymbol) selectSymbol(position.symbol);
    return true;
  };

  const beginPositionProtection = (field, requestedPositionId = null, options = {}) => {
    if (!['sl', 'tp'].includes(field)) return false;
    if (tradePlan) {
      showNotice('Finish or cancel the current order plan before editing an open position');
      return false;
    }

    const requestedPosition = requestedPositionId == null
      ? null
      : positions.find(item => String(item?.id) === String(requestedPositionId));
    const targetSymbol = requestedPosition?.symbol || activeSymbol;
    const candidates = positions.filter(position =>
      String(position?.symbol || '').toUpperCase() === String(targetSymbol || '').toUpperCase()
    );
    let position = requestedPosition;
    if (!position) position = candidates.find(item => String(item?.id) === String(selectedOpenPositionId));
    if (!position && candidates.length === 1) position = candidates[0];

    if (!position) {
      showNotice(candidates.length > 1
        ? 'Select the position badge on the chart, then choose SL or TP'
        : 'There is no open position on this chart to protect');
      return false;
    }

    const instrument = markets.find(item => item.symbol === position.symbol) || market;
    const side = String(position.side || '').toUpperCase();
    const entry = Number(position.entry ?? position.entryPrice);
    if (!['BUY', 'SELL'].includes(side) || !Number.isFinite(entry) || entry <= 0) {
      showNotice('This position does not have a valid entry price');
      return false;
    }

    const existingPrice = value => {
      if (value === null || value === undefined || value === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    };
    const stopDistance = defaultPlannerStopDistance(instrument, entry)
      || Math.max(Number(instrumentPipSize(instrument)) || 0, Number(instrument?.tickSize) || 0) * 10
      || entry * 0.005;
    const liveReference = Number(
      position.closePrice
        ?? position.currentPrice
        ?? (side === 'BUY' ? instrument?.bid : instrument?.ask)
    );
    const reference = options?.useCurrentReference === true && Number.isFinite(liveReference) && liveReference > 0
      ? liveReference
      : entry;
    const initialPrice = existingPrice(options?.initialPrice);

    setSelectedOpenPositionId(position.id);
    setPositionProtectionDraft(current => {
      const samePosition = current && String(current.positionId) === String(position.id);
      const draft = samePosition ? { ...current } : {
        positionId: position.id,
        symbol: position.symbol,
        side: side.toLowerCase(),
        entry,
        sl: existingPrice(position.sl),
        tp: existingPrice(position.tp),
        manualLots: Number(position.volume ?? position.lots) || lots,
        sizingMode: 'lots',
        pending: false,
        open: false,
        source: 'open-position',
      };

      if (initialPrice != null) {
        draft[field] = normalizeProtectionPrice(initialPrice, instrument, side, field);
      } else if (existingPrice(draft[field]) == null) {
        const multiplier = field === 'tp' ? 2 : 1;
        const direction = field === 'sl'
          ? (side === 'BUY' ? -1 : 1)
          : (side === 'BUY' ? 1 : -1);
        const proposed = reference + direction * stopDistance * multiplier;
        draft[field] = normalizeProtectionPrice(proposed, instrument, side, field);
      }

      return { ...draft, activeField: field, stage: 'draft' };
    });
    setSelectedTool('cursor');
    return true;
  };

  const updatePositionProtectionDraft = patch => {
    if (!patch || typeof patch !== 'object') return;
    setPositionProtectionDraft(current => {
      if (!current) return current;
      const instrument = markets.find(item => item.symbol === current.symbol) || market;
      const side = String(current.side || '').toUpperCase();
      const next = { ...current, ...patch };
      for (const field of ['sl', 'tp']) {
        if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
        const raw = patch[field];
        next[field] = raw === null || raw === undefined || raw === ''
          ? null
          : normalizeProtectionPrice(raw, instrument, side, field);
      }
      return next;
    });
  };

  const cancelPositionProtection = () => {
    if (positionProtectionSaving) return;
    setPositionProtectionDraft(null);
  };

  const applyPositionProtection = async (overrides = null, options = {}) => {
    const draft = positionProtectionDraft;
    if (!draft || positionProtectionSaving) return false;
    const position = positions.find(item => String(item?.id) === String(draft.positionId));
    if (!position) {
      setPositionProtectionDraft(null);
      showNotice('That position is no longer open');
      return false;
    }

    const instrument = markets.find(item => item.symbol === position.symbol) || market;
    const entry = Number(position.entry ?? position.entryPrice ?? draft.entry);
    const side = String(position.side || draft.side || '').toUpperCase();
    const hasOverrides = overrides && typeof overrides === 'object';
    const normalizedOverrides = {};
    if (hasOverrides) {
      for (const field of ['sl', 'tp']) {
        if (!Object.prototype.hasOwnProperty.call(overrides, field)) continue;
        const raw = overrides[field];
        normalizedOverrides[field] = raw === null || raw === undefined || raw === ''
          ? null
          : normalizeProtectionPrice(raw, instrument, side, field);
      }
    }

    const nextDraft = { ...draft, ...normalizedOverrides };
    const sl = nextDraft.sl == null ? null : Number(nextDraft.sl);
    const tp = nextDraft.tp == null ? null : Number(nextDraft.tp);
    if (!Number.isFinite(entry) || entry <= 0) {
      showNotice('Position entry price is unavailable');
      return false;
    }
    if (sl != null && (!Number.isFinite(sl) || sl <= 0)) {
      showNotice('Enter a valid stop-loss price');
      return false;
    }
    if (tp != null && (!Number.isFinite(tp) || tp <= 0)) {
      showNotice('Enter a valid take-profit price');
      return false;
    }

    const patch = hasOverrides ? normalizedOverrides : { sl, tp };
    if (!Object.keys(patch).length) return false;

    if (options?.validateAgainstCurrent === true) {
      const validation = validateOpenPositionProtection(position, instrument, patch);
      if (!validation.ok) {
        showNotice(validation.message);
        return false;
      }
    } else {
      if (side === 'BUY' && ((sl != null && sl >= entry) || (tp != null && tp <= entry))) {
        showNotice('For a BUY position, SL must be below entry and TP above entry');
        return false;
      }
      if (side === 'SELL' && ((sl != null && sl <= entry) || (tp != null && tp >= entry))) {
        showNotice('For a SELL position, SL must be above entry and TP below entry');
        return false;
      }
    }

    setPositionProtectionSaving(true);
    try {
      const saved = await updatePosition(position.id, patch);
      if (saved) setPositionProtectionDraft(null);
      return Boolean(saved);
    } finally {
      setPositionProtectionSaving(false);
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
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return;
    const instrument = markets.find(item => item.symbol === position.symbol) || market;
    const reverseExposure = exposureAvailability({ account, connectionStatus: trading.connection.status, market: instrument, commandState: executionCommandState });
    if (!reverseExposure.allowed) { showNotice(reverseExposure.reason); return; }

    const currentSide = String(position.side || '').toUpperCase();
    const nextSide = currentSide === 'BUY' ? 'SELL' : 'BUY';
    const requestedPrice = Number(nextSide === 'BUY' ? instrument?.ask : instrument?.bid);
    const entry = Number(position.entry);
    const oldSl = Number(position.sl);
    const oldTp = Number(position.tp);
    const slDistance = Number.isFinite(entry) && Number.isFinite(oldSl) ? Math.abs(entry - oldSl) : null;
    const tpDistance = Number.isFinite(entry) && Number.isFinite(oldTp) ? Math.abs(oldTp - entry) : null;
    const mirroredSl = Number.isFinite(requestedPrice) && Number.isFinite(slDistance)
      ? normalizeProtectionPrice(nextSide === 'BUY' ? requestedPrice - slDistance : requestedPrice + slDistance, instrument, nextSide, 'sl')
      : null;
    const mirroredTp = Number.isFinite(requestedPrice) && Number.isFinite(tpDistance)
      ? normalizeProtectionPrice(nextSide === 'BUY' ? requestedPrice + tpDistance : requestedPrice - tpDistance, instrument, nextSide, 'tp')
      : null;

    const reverseProtection = protectionRequirement({
      account,
      sizingMode: 'lots',
      stopLoss: mirroredSl,
    });
    if (!reverseProtection.valid) {
      showNotice(reverseProtection.message);
      return;
    }

    const proposedRisk = mirroredSl == null
      ? null
      : estimateStopRisk({ entry: requestedPrice, sl: mirroredSl, side: nextSide.toLowerCase() }, position.volume, instrument, account.currency);
    const guard = evaluateRiskGuard({
      account,
      positions: positions.filter(item => String(item.id) !== String(id)),
      positionHistory,
      markets,
      proposedRisk,
      settings: riskGuardSettings,
    });
    if (!guard.allowed) {
      const message = guard.blocks[0]?.message || 'Risk Guard blocked this reversal.';
      logEvent('warning', `Risk Guard: ${message}`);
      showNotice(message);
      return;
    }

    try {
      const result = await trading.reversePosition(id, {
        stopLoss: mirroredSl,
        takeProfit: mirroredTp,
        requestedPrice: Number.isFinite(requestedPrice) ? requestedPrice : null,
      });
      setTradePlan(null);
      logEvent('position', `${position.symbol} reverse completed as close + opposite market order`, {
        positionId: position.id,
        symbol: position.symbol,
        side: nextSide,
        lots: position.volume,
        stopLoss: mirroredSl,
        takeProfit: mirroredTp,
      });
      showNotice(mirroredSl != null || mirroredTp != null ? 'Position reversed with mirrored protection' : 'Position reversed');
      if (result?.position?.symbol && result.position.symbol !== activeSymbol) selectSymbol(result.position.symbol);
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
    const position = positions.find(item => String(item.id) === String(id));
    if (!position) return null;
    const instrument = markets.find(item => item.symbol === position.symbol) || market;
    const side = String(position.side || '').toLowerCase();
    const requestedPrice = Number(side === 'buy' ? instrument?.ask : instrument?.bid);
    const result = await runMarketExecution({
      side,
      executionLots: position.volume,
      symbol: position.symbol,
      requestedPrice,
      stopLoss: position.sl,
      takeProfit: position.tp,
    });
    if (result) {
      logEvent('execution', `${position.symbol} ${position.side} duplicated with protection`);
      showNotice('Position duplicated');
    }
    return result;
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

  const startPlan = (side, requestedType = orderType, options = {}) => {
    const plan = createDefaultTradePlan({
      side,
      requestedType,
      market,
      // Explicit draft overrides avoid a React batching race when the V4
      // slider changes sizing and creates the chart preview in one gesture.
      sizingMode: options?.sizingMode === 'risk' ? 'risk' : options?.sizingMode === 'lots' ? 'lots' : sizingMode,
      lots: Number.isFinite(Number(options?.manualLots)) && Number(options.manualLots) > 0
        ? Number(options.manualLots) : lots,
      protection: options?.protection || 'both',
    });
    if (!plan) {
      showNotice('Executable market price is unavailable');
      return;
    }
    setTradePlan({
      ...plan,
      ...(options?.desktopPendingDraft ? { desktopPendingDraft: true } : {}),
      ...(options?.source === 'v4-slider' ? { source: 'v4-slider' } : {}),
    });
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
    const numericRisk = Math.max(0.01, Number(setup.riskPercent) || riskPercent);
    const riskEvaluation = evaluateRiskToolSetup({
      plan: { entry: rawEntry, sl: rawSl, tp: rawTp, side },
      riskPercent: numericRisk,
      account,
      instrument,
    });
    if (!riskEvaluation.canCreateOrder) {
      showNotice(riskEvaluation.message || 'Risk setup cannot create an order');
      return;
    }

    const tick = Number(instrument.tickSize) > 0 ? Number(instrument.tickSize) : Number(instrumentPipSize(instrument));
    const nearMarket = Number.isFinite(livePrice) && Number.isFinite(tick) && tick > 0 && Math.abs(rawEntry - livePrice) <= tick * 1.5;
    let nextOrderType = 'market';
    if (!nearMarket && Number.isFinite(livePrice)) {
      if (side === 'buy') nextOrderType = rawEntry < livePrice ? 'limit' : 'stop';
      else nextOrderType = rawEntry > livePrice ? 'limit' : 'stop';
    }

    const sideUpper = side.toUpperCase();
    const entry = nextOrderType === 'market'
      ? livePrice
      : normalizePriceToTick(rawEntry, instrument, pendingPriceDirection(nextOrderType, sideUpper, 'entry'));
    const sl = normalizeProtectionPrice(rawSl, instrument, sideUpper, 'sl');
    const tp = normalizeProtectionPrice(rawTp, instrument, sideUpper, 'tp');
    const validatedLots = Number(riskEvaluation.sizing?.requestedLots);
    const normalizedLots = Number.isFinite(validatedLots) && validatedLots > 0
      ? normalizeVolumeToStep(validatedLots, instrument, { rounding: 'down' })
      : lots;

    if (setup.symbol !== activeSymbol) selectSymbol(setup.symbol);
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
    setActiveNav('trade');
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
    setTradePlan(null);
  };

  const executePlan = async (options = {}) => {
    if (!tradePlan || trading.commandState.pending) return;
    const planSymbol = tradePlan.symbol || market?.symbol;
    const planMarket = markets.find(item => item.symbol === planSymbol) || market;
    const planExposure = exposureAvailability({ account, connectionStatus: trading.connection.status, market: planMarket, commandState: executionCommandState });
    if (!planExposure.allowed) { showNotice(planExposure.reason); return; }
    const patchedTradePlan = options?.planPatch
      ? { ...tradePlan, ...normalizeTradePlanPatch(tradePlan, options.planPatch, planMarket) }
      : tradePlan;
    const baseExecutionPlan = effectiveTradePlan(patchedTradePlan, planMarket);
    const executionPreview = resolveExecutionPreview({
      plan: baseExecutionPlan,
      riskPercent,
      manualLots: baseExecutionPlan.manualLots ?? lots,
      account,
      instrument: planMarket,
    });
    const executionPlan = executionPreview.plan || baseExecutionPlan;
    const executionSizing = executionPreview.sizing;
    const planValidation = validateTradePlanForExecution(executionPlan, planMarket, { preserveEntry: true });
    if (!planValidation.valid) { showNotice(planValidation.message || 'Review the order before submitting'); return; }
    const planProtection = protectionRequirement({
      account,
      sizingMode: executionPlan.sizingMode || sizingMode,
      stopLoss: executionPlan.sl,
    });
    if (!planProtection.valid) { showNotice(planProtection.message); return; }
    if (!executionSizing.canExecute || !Number.isFinite(Number(executionSizing.lots))) {
      const reason = executionSizing.blockReason === 'UNSUPPORTED_RISK_CURRENCY'
        ? 'Risk % sizing is unavailable because this instrument P&L requires currency conversion. Use Lots sizing.'
        : executionSizing.blockReason === 'INSUFFICIENT_MARGIN'
          ? 'The selected risk requires more free margin than is currently available.'
          : executionSizing.blockReason === 'MAX_VOLUME'
            ? 'The selected risk requires more than the instrument maximum lot size.'
            : executionSizing.blockReason === 'MIN_VOLUME'
              ? 'The selected risk is below the instrument minimum lot size.'
              : 'Unable to calculate an executable position size for this order.';
      showNotice(reason);
      return;
    }
    const volume = executionSizing.lots;
    const marginReference = executionPlan.pending && String(executionPlan.orderType || '').toLowerCase() === 'stop-limit'
      ? executionPlan.limitPrice
      : executionPlan.entry;
    const openingRequirement = estimateOpeningRequirement(marginReference, volume, planMarket, account);
    const freeMargin = Number(account?.freeMargin);
    if (Number.isFinite(openingRequirement) && Number.isFinite(freeMargin) && openingRequirement > freeMargin + 1e-8) {
      showNotice(`Opening requirement ${openingRequirement.toFixed(2)} ${account?.currency || 'USD'} exceeds available free margin.`);
      return;
    }
    const riskPlan = executionPlan.pending && String(executionPlan.orderType || '').toLowerCase() === 'stop-limit'
      ? { ...executionPlan, entry: executionPlan.limitPrice }
      : executionPlan;
    const proposedRisk = estimateLossAtStopWithCosts(riskPlan, volume, planMarket, account);
    if (!options?.skipRiskGuard) {
      const guard = evaluateRiskGuard({
        account,
        positions,
        positionHistory,
        markets,
        proposedRisk,
        settings: riskGuardSettings,
      });
      if (!guard.allowed) {
        const message = guard.blocks[0]?.message || 'Risk Guard blocked this order.';
        logEvent('warning', `Risk Guard: ${message}`);
        showNotice(message);
        return;
      }
    }
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
        riskBudget: (executionPlan.sizingMode || sizingMode) === 'risk' ? Number(account?.equity) * Number(riskPercent) / 100 : null,
        timeInForce: executionPlan.expiration || 'GTC',
        expiresAt: executionPlan.expirationAt || executionPlan.expiresAt || null,
      };
      setExecutionEvent({ side: executionPlan.side, lots: volume, symbol: planSymbol, requestedPrice: executionPlan.entry, status: 'submitting' });
      try {
        const result = patchedTradePlan.editingOrderId
          ? await trading.replacePendingOrder(patchedTradePlan.editingOrderId, request)
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
      executionSizingMode: executionPlan.sizingMode || sizingMode,
      skipRiskGuard: options?.skipRiskGuard === true,
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
    setTradePlan(plan => {
      if (!plan) return plan;
      const instrument = markets.find(item => item.symbol === plan.symbol) || market;
      return { ...plan, ...normalizeTradePlanPatch(plan, patch, instrument) };
    });
  };

  const manualOrder = (order, options = {}) => {
    if (trading.commandState.pending || !exposure.allowed) { if (!exposure.allowed) showNotice(exposure.reason); return; }
    const instrument = markets.find(item => item.symbol === order.symbol) || market;
    const executionLots = normalizeVolumeToStep(order.lots, instrument);

    if (accountCapabilities.stopLossRequiredForManualLots) {
      setLots(executionLots);
      setSizingMode('lots');
      startPlan(order.side, 'market', { protection: 'sl' });
      showNotice('This account requires a stop loss for manual-lot exposure.');
      return;
    }

    const executionPrice = estimateExecutionPrice(instrument, order.side, executionLots)?.price;
    return runMarketExecution({
      side: order.side,
      executionLots,
      symbol: order.symbol,
      requestedPrice: Number.isFinite(Number(executionPrice)) ? Number(executionPrice) : order.price,
      executionSizingMode: 'lots',
      skipRiskGuard: options?.skipRiskGuard === true,
    });
  };

  const cancelPendingOrder = async id => {
    const order = pendingOrders.find(item => String(item.id) === String(id));
    if (!order) return;
    try {
      await trading.cancelPendingOrder(id);
      if (String(tradePlan?.editingOrderId || '') === String(id)) setTradePlan(null);
      logEvent('order', `${String(order.side).toUpperCase()} ${String(order.orderType).toUpperCase()} ${order.symbol} cancelled`);
      showNotice('Pending order cancelled');
    } catch (error) {
      handleTradingError(error, `Cancel ${order.symbol}`);
    }
  };

  const movePendingOrder = async (id, nextPrice, field = 'entry') => {
    const order = pendingOrders.find(item => String(item.id) === String(id));
    if (!order) return;
    const clearingProtection = nextPrice === null && (field === 'sl' || field === 'tp');
    const numericPrice = clearingProtection ? null : Number(nextPrice);
    if (!clearingProtection && (!Number.isFinite(numericPrice) || numericPrice <= 0)) return;

    const replacement = buildChartPendingAmendment(order, numericPrice, field);
    if (!replacement) return;

    try {
      await trading.replacePendingOrder(id, replacement);
      logEvent('order', `${String(order.side).toUpperCase()} ${String(order.orderType).toUpperCase()} ${order.symbol} ${field} moved on chart`, {
        orderId: id,
        field,
        price: numericPrice,
      });
      showNotice(clearingProtection ? `${field.toUpperCase()} removed` : field === 'entry' ? 'Pending price updated' : `${field === 'limitPrice' ? 'LIMIT' : field.toUpperCase()} updated`);
      return true;
    } catch (error) {
      handleTradingError(error, `Move ${order.symbol} pending ${field}`);
      return false;
    }
  };

  const modifyPendingOrder = (id, protectionField = null) => {
    const order = pendingOrders.find(item => String(item.id) === String(id));
    if (!order) return;
    if (order.symbol && order.symbol !== market?.symbol) selectSymbol(order.symbol);

    const instrument = markets.find(item => item.symbol === order.symbol) || market;
    const side = String(order.side || '').toLowerCase();
    const fillReference = String(order.orderType || '').toLowerCase() === 'stop-limit'
      ? Number(order.limitPrice)
      : Number(order.entry);
    const distance = defaultPlannerStopDistance(instrument, fillReference);
    const nextPlan = {
      ...order,
      ...(isDesktop ? { desktopPendingDraft: false } : {}),
      editingOrderId: id,
      stage: 'ready',
      open: false,
      pending: true,
    };

    if (isDesktop && ['sl', 'tp'].includes(protectionField)) {
      nextPlan.activeField = protectionField;
      if (!isActiveChartProtection(nextPlan[protectionField]) && Number.isFinite(fillReference) && fillReference > 0 && Number.isFinite(distance) && distance > 0) {
        const rawProtection = protectionField === 'sl'
          ? (side === 'sell' ? fillReference + distance : fillReference - distance)
          : (side === 'sell' ? fillReference - distance * 2 : fillReference + distance * 2);
        nextPlan[protectionField] = normalizeProtectionPrice(rawProtection, instrument, side, protectionField);
      }
    }

    setTradePlan(nextPlan);
    setOrderType(order.orderType);
    setSizingMode('lots');
    if (Number.isFinite(order.manualLots)) setLots(order.manualLots);
    else if (Number.isFinite(Number(order.volume ?? order.lots))) setLots(Number(order.volume ?? order.lots));
    setActiveNav('trade');
    setOverlay(null);
    logEvent('order', `${String(order.side).toUpperCase()} ${String(order.orderType).toUpperCase()} loaded for cancel-and-replace modification`);
    showNotice(
      isDesktop && protectionField === 'sl'
        ? 'SL active on chart — drag to adjust, then update the pending order.'
        : isDesktop && protectionField === 'tp'
          ? 'TP active on chart — drag to adjust, then update the pending order.'
          : 'Pending order loaded for modification'
    );
  };

  const openTradeFromWatchlist = symbol => {
    selectSymbol(symbol);
    setActiveNav('trade');
    setOverlay(null);
  };

  const openHelp = () => { setOverlay(null); if (!isDesktop) setActiveNav('trade'); setHelpOpen(true); };

  const handleNav = id => {
    if (id === 'help') { openHelp(); return; }
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
    enabled: isDesktop && hotkeysEnabled && !readOnly && !overlay && !helpOpen,
    onBuy: () => hotkeyTrade('buy'),
    onSell: () => hotkeyTrade('sell'),
    onFullscreen: () => toggleDesktopFullscreen(),
    onCancel: () => tradePlan && cancelPlan(),
    onCloseLatest: () => positions[0] && void closePosition(positions[0].id, 100),
    onCloseAll: () => void closeAllPositions(),
    onLotsDelta: delta => setLots(value => normalizeVolumeToStep(Number(value) + delta, market, { rounding: 'nearest' })),
    onTimeframe: setTimeframe,
  });

  const plannedRiskInstrument = markets.find(item => item.symbol === tradePlan?.symbol) || market;
  const plannedRiskPlan = effectiveTradePlan(tradePlan, plannedRiskInstrument);
  const plannedRisk = estimatedRisk(plannedRiskPlan, riskPercent, lots, account, plannedRiskInstrument);

  const activeOpenPositions = positions.filter(position =>
    String(position?.symbol || '').toUpperCase() === String(activeSymbol || '').toUpperCase()
  );
  const selectedOpenPosition = positions.find(position =>
    String(position?.id) === String(selectedOpenPositionId)
    && String(position?.symbol || '').toUpperCase() === String(activeSymbol || '').toUpperCase()
  ) || (activeOpenPositions.length === 1 ? activeOpenPositions[0] : null);
  const positionProtectionAvailable = activeOpenPositions.length > 0;

  if (isDesktop) {
    return (
      <>
        <TradingPermissionNotice status={tradingPolicyStatus} />
        <DesktopTerminal
          market={market}
          tick={tick}
          markets={markets}
          activeSymbol={activeSymbol}
          onSelectSymbol={selectSymbol}
          watchlists={watchlists}
          onViewportQuoteSymbolsChange={onViewportQuoteSymbolsChange}
          positions={positions}
          positionHistory={positionHistory}
          pendingOrders={pendingOrders}
          journal={journal}
          positionsLoading={Boolean(trading.accountSwitching || ['connecting','loading'].includes(trading.connection?.status))}
          positionsError={['error','failed','disconnected'].includes(trading.connection?.status) && (trading.activeAccountId || account?.id)
            ? (trading.errorMessage || 'Positions could not be synchronized. Check the connection and retry.') : null}
          onRetryPositions={trading.refreshState}
          onClosePosition={closePosition}
          onCloseAllPositions={closeAllPositions}
          onCloseWinners={closeWinners}
          onCloseLosers={closeLosers}
          onCloseSymbolPositions={closeSymbolPositions}
          onBreakEven={movePositionToBreakEven}
          onReversePosition={reversePosition}
          onUpdatePosition={updatePosition}
          onSetTrailing={setPositionTrailing}
          onDuplicatePosition={duplicatePosition}
          onCancelPending={cancelPendingOrder}
          onModifyPending={modifyPendingOrder}
          onMovePending={movePendingOrder}
          onManualOrder={manualOrder}
          indicators={indicators}
          indicatorFavorites={indicatorFavorites}
          onAddIndicator={addIndicator}
          onRemoveIndicator={removeIndicator}
          onToggleIndicator={toggleIndicator}
          onUpdateIndicator={updateIndicator}
          onToggleIndicatorFavorite={toggleIndicatorFavorite}
          onIndicatorsChange={setIndicators}
          account={account}
          accounts={trading.accounts}
          activeAccountId={trading.activeAccountId}
          accountSwitching={trading.accountSwitching}
          accountSwitchError={trading.accountSwitchError}
          onSelectAccount={selectTradingAccount}
          plannedRisk={plannedRisk}
          hotkeysEnabled={hotkeysEnabled}
          timeframe={timeframe}
          onTimeframeChange={value => setTimeframe(normalizeTimeframePreference(value))}
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
          onCreateRiskOrder={createPlanFromRiskTool}
          positionProtectionDraft={positionProtectionDraft}
          onPositionProtectionDraftChange={updatePositionProtectionDraft}
          onBeginPositionProtection={(field, positionId, options = {}) => beginPositionProtection(field, positionId, { ...options, useCurrentReference: true })}
          onApplyPositionProtection={overrides => applyPositionProtection(overrides, { validateAgainstCurrent: true })}
          onCancelPositionProtection={cancelPositionProtection}
          positionProtectionSaving={positionProtectionSaving}
          onOpenSettings={() => setOverlay('more')}
          onOpenHelp={openHelp}
          exposureAllowed={exposure.allowed}
          exposureBlockReason={exposure.reason}
          executionCommandPending={trading.commandState.pending === true}
          riskGuardSettings={riskGuardSettings}
          onRiskGuardSettingsChange={setRiskGuardSettings}
          readOnly={readOnly}
        />
        <ExecutionStatus event={executionEvent} instrument={market} onDismiss={() => setExecutionEvent(null)} />
        {helpOpen && <HelpCenter desktop onClose={() => setHelpOpen(false)} symbol={activeSymbol} timeframe={timeframe} />}
        {overlay && <FrontendSheet desktop type={overlay} onClose={() => setOverlay(null)} markets={markets} activeSymbol={activeSymbol} watchlists={watchlists} onSelectSymbol={symbol => { selectSymbol(symbol); setOverlay(null); }} onOpenHelp={openHelp} {...indicatorSheetProps} />}
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-black font-sans text-[#f5f8fb] antialiased">
      <TradingPermissionNotice status={tradingPolicyStatus} />
      <main ref={shellRef} className={chartFocus ? 'relative mx-auto h-dvh w-full max-w-[460px] overflow-hidden bg-black' : 'relative mx-auto min-h-dvh w-full max-w-[460px] overflow-x-hidden bg-black bg-[radial-gradient(circle_at_top,rgba(26,79,116,0.20),transparent_36%)] pb-[98px]'}>
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
            pendingOrders={pendingOrders}
            onModifyPending={modifyPendingOrder}
            onCancelPending={cancelPendingOrder}
            onUpdatePosition={updatePosition}
            onClosePosition={closePosition}
            selectedPositionId={selectedOpenPositionId}
            onSelectPosition={selectOpenPosition}
            positionProtectionDraft={positionProtectionDraft}
            onPositionProtectionDraftChange={updatePositionProtectionDraft}
            selectedPosition={selectedOpenPosition}
            positionProtectionAvailable={positionProtectionAvailable}
            onBeginPositionProtection={beginPositionProtection}
            onApplyPositionProtection={applyPositionProtection}
            onCancelPositionProtection={cancelPositionProtection}
            positionProtectionSaving={positionProtectionSaving}
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
                <TopBar account={account} accounts={trading.accounts} activeAccountId={trading.activeAccountId} connectionStatus={trading.connection.status} accountSwitching={trading.accountSwitching} accountSwitchError={trading.accountSwitchError} onSelectAccount={selectTradingAccount} onSearch={() => setOverlay('search')} onNotifications={() => setOverlay('notifications')} onProfile={() => setOverlay('profile')} />
                <div className="px-2">
                  <MarketPanel market={market} tick={tick} timeframe={timeframe} setTimeframe={setTimeframe} chartMode={chartMode} setChartMode={setChartMode} selectedTool={selectedTool} setSelectedTool={setSelectedTool} favorite={favorite} setFavorite={setFavorite} fullscreen={chartFocus} onFullscreen={enterChartFocus} tradePlan={tradePlan} onTradePlanChange={updatePlan} positions={positions} pendingOrders={pendingOrders} onModifyPending={modifyPendingOrder} onCancelPending={cancelPendingOrder} onUpdatePosition={updatePosition} onClosePosition={closePosition} selectedPositionId={selectedOpenPositionId} onSelectPosition={selectOpenPosition} positionProtectionDraft={positionProtectionDraft} onPositionProtectionDraftChange={updatePositionProtectionDraft} onSelectInstrument={() => setOverlay('instruments')} onIndicators={() => setOverlay('indicators')} indicators={indicators} />
                  <PropRiskStrip account={account} plannedRisk={plannedRisk} />
                  <ExecutionPanel key={`execution-${trading.accountId || 'none'}`} market={market} account={account} exposureAllowed={exposure.allowed} exposureBlockReason={exposure.reason} lots={lots} onLotsChange={setLots} sizingMode={sizingMode} onSizingModeChange={setSizingMode} riskPercent={riskPercent} onRiskPercentChange={setRiskPercent} orderType={orderType} onOrderTypeChange={setOrderType} tradePlan={tradePlan} onStartPlan={startPlan} onCancelPlan={cancelPlan} onExecutePlan={executePlan} onModifyPlan={modifyPlan} onManualOrder={manualOrder} onTradePlanChange={updatePlan} selectedPosition={selectedOpenPosition} positionProtectionAvailable={positionProtectionAvailable} positionProtectionDraft={positionProtectionDraft} onBeginPositionProtection={beginPositionProtection} onApplyPositionProtection={applyPositionProtection} onCancelPositionProtection={cancelPositionProtection} positionProtectionSaving={positionProtectionSaving} />
                  <PositionsPanel key={`positions-${trading.accountId || 'none'}`} positions={positions} markets={markets} positionHistory={positionHistory} pendingOrders={pendingOrders} journal={journal} onClosePosition={closePosition} onCloseAll={closeAllPositions} onBreakEven={movePositionToBreakEven} onReverse={reversePosition} onUpdatePosition={updatePosition} onSetTrailing={setPositionTrailing} onDuplicate={duplicatePosition} onCancelPending={cancelPendingOrder} onModifyPending={modifyPendingOrder} selectedPositionId={selectedOpenPositionId} onSelectPosition={selectOpenPosition} />
                </div>
              </>
            )}
            <BottomNavbar active={activeNav} onChange={handleNav} />
          </>
        )}
        <ExecutionStatus event={executionEvent} instrument={market} onDismiss={() => setExecutionEvent(null)} />
        {notice && <div className="fixed left-1/2 top-[74px] z-[120] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 rounded-xl border border-white/[0.08] bg-[#101010]/95 px-3 py-2.5 text-center text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)] backdrop-blur-xl">{notice}</div>}
        {overlay && <FrontendSheet type={overlay} onClose={() => setOverlay(null)} markets={markets} activeSymbol={activeSymbol} onSelectSymbol={symbol => { selectSymbol(symbol); if (activeNav === 'watchlist') setActiveNav('trade'); }} onOpenHelp={openHelp} {...indicatorSheetProps} />}
        {helpOpen && <HelpCenter onClose={() => setHelpOpen(false)} symbol={activeSymbol} timeframe={timeframe} />}
      </main>
    </div>
  );
}
