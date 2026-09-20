import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  CandlestickChart,
  ChartNoAxesCombined,
  ChevronDown,
  Columns2,
  Grid2X2,
  History,
  Link2,
  Link2Off,
  List,
  Maximize2,
  MoreHorizontal,
  Search,
  Settings,
  ShieldAlert,
  Square,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import DesktopOrderTicket from './desktop/DesktopOrderTicket.jsx';
import DesktopMultiChart from './desktop/DesktopMultiChart.jsx';
import DesktopTradeReview from './desktop/DesktopTradeReview.jsx';
import DesktopWorkspaceMenu from './desktop/DesktopWorkspaceMenu.jsx';
import DesktopWatchlist from './desktop/DesktopWatchlist.jsx';
import ResizeHandle from './desktop/ResizeHandle.jsx';
import PositionsPanel from './PositionsPanel.jsx';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import { calculateAccountRiskSummary } from '../../utils/accountRisk.js';

const timeframes = [['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'], ['1H', '1H'], ['4H', '4H'], ['1D', '1D'], ['1W', '1W']];
const navItems = [['trade', CandlestickChart, 'Trade'], ['watchlist', Star, 'Watchlist'], ['markets', List, 'Markets'], ['history', History, 'History'], ['more', MoreHorizontal, 'More']];
const DESKTOP_LAYOUT_KEY = 'acg-trader-desktop-layout-v1';
const MULTI_CHART_KEY = 'acg-trader-multi-chart-v1';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function desktopWidthBounds(viewportWidth) {
  const width = Number(viewportWidth) || 1440;
  const navWidth = width >= 1536 ? 54 : 50;
  const workspaceWidth = Math.max(0, width - navWidth);
  const sidebarMin = 320;
  const tierMax = width < 1400 ? 500 : width < 1700 ? 580 : width < 2200 ? 620 : 680;
  const percentageMax = workspaceWidth * (width >= 2200 ? 0.40 : 0.42);
  const chartProtectedMax = workspaceWidth - 700;
  const sidebarMax = Math.max(sidebarMin, Math.floor(Math.min(tierMax, percentageMax, chartProtectedMax)));
  const defaultSidebar = width >= 1600 ? Math.min(420, sidebarMax) : Math.min(380, sidebarMax);
  return { sidebarMin, sidebarMax, defaultSidebar };
}

function desktopHeightBounds(viewportHeight, dockCollapsed = false, dockHeight = 0) {
  const height = Number(viewportHeight) || 900;
  const compact = height <= 900;
  const dockMin = 140;
  const dockMax = compact ? 180 : height <= 1050 ? 240 : 340;
  const defaultDock = compact ? 165 : height <= 1050 ? 200 : 230;
  const effectiveDock = dockCollapsed ? 0 : clamp(dockHeight || defaultDock, dockMin, dockMax);
  const upperWorkspaceHeight = Math.max(0, height - 52 - effectiveDock);

  // On laptop-height screens the order ticket is independently scrollable, so
  // reserve only the execution-critical portion instead of forcing the entire
  // ticket to remain visible. This lets Favorites/Markets use more of the rail.
  const minOrderTicketHeight = compact ? 190 : 260;
  const watchlistShareCap = upperWorkspaceHeight * (compact ? 0.70 : 0.62);
  const watchlistRoomCap = upperWorkspaceHeight - minOrderTicketHeight - 4;
  const watchlistMax = clamp(Math.min(watchlistShareCap, watchlistRoomCap), 180, compact ? 480 : 520);
  const defaultWatchlist = compact ? Math.min(230, watchlistMax) : Math.min(250, watchlistMax);
  const balancedWatchlist = clamp(upperWorkspaceHeight * 0.36, 180, watchlistMax);
  const marketFocusWatchlist = clamp(upperWorkspaceHeight * (compact ? 0.68 : 0.60), 180, watchlistMax);
  return { compact, dockMin, dockMax, defaultDock, watchlistMin: 140, watchlistMax, defaultWatchlist, balancedWatchlist, marketFocusWatchlist };
}

function loadDesktopLayout() {
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const initialBounds = desktopHeightBounds(viewportHeight);
  const widthBounds = desktopWidthBounds(viewportWidth);
  const fallback = {
    sidebarWidth: widthBounds.defaultSidebar,
    dockHeight: initialBounds.defaultDock,
    sidebarCollapsed: false,
    dockCollapsed: false,
    watchlistHeight: initialBounds.defaultWatchlist,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(DESKTOP_LAYOUT_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    const dockCollapsed = stored.dockCollapsed === true;
    const dockHeight = clamp(stored.dockHeight || fallback.dockHeight, initialBounds.dockMin, initialBounds.dockMax);
    const bounds = desktopHeightBounds(viewportHeight, dockCollapsed, dockHeight);
    return {
      sidebarWidth: clamp(stored.sidebarWidth || fallback.sidebarWidth, widthBounds.sidebarMin, widthBounds.sidebarMax),
      dockHeight,
      sidebarCollapsed: stored.sidebarCollapsed === true,
      dockCollapsed,
      watchlistHeight: clamp(stored.watchlistHeight || fallback.watchlistHeight, bounds.watchlistMin, bounds.watchlistMax),
    };
  } catch {
    return fallback;
  }
}

function loadMultiChart(activeSymbol, timeframe) {
  const fallback = {
    layout: 1,
    linked: false,
    activeCell: 0,
    cells: [
      { symbol: activeSymbol || '', timeframe: timeframe || '1m' },
      { symbol: '', timeframe: '5m' },
      { symbol: '', timeframe: '15m' },
      { symbol: '', timeframe: '1H' },
    ],
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(MULTI_CHART_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    return {
      ...fallback,
      ...stored,
      layout: [1,2,4].includes(Number(stored.layout)) ? Number(stored.layout) : 1,
      activeCell: Math.max(0, Math.min(3, Number(stored.activeCell) || 0)),
      cells: Array.from({ length: 4 }, (_, index) => ({
        ...fallback.cells[index],
        ...(stored.cells?.[index] || {}),
      })),
    };
  } catch {
    return fallback;
  }
}

function displaySymbol(symbol = '') {
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol || '—';
}

function money(value, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  } catch {
    return `${number.toFixed(2)} ${currency}`;
  }
}

function formatPnl(value, currency = 'USD') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const absolute = money(Math.abs(number), currency);
  return `${number >= 0 ? '+' : '-'}${absolute}`;
}

function marketLabel(item) {
  return item?.name || item?.displaySymbol || displaySymbol(item?.symbol);
}

function executableMarket(market) {
  const bid = Number(market?.bid);
  const ask = Number(market?.ask);
  return Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) && ask > 0
    && market?.sessionOpen !== false
    && market?.isStale !== true
    && !['WAITING', 'DISCONNECTED', 'ERROR', 'DISABLED'].includes(String(market?.marketState || '').toUpperCase());
}

export default function DesktopTerminal({
  market,
  tick,
  markets = [],
  activeSymbol = market?.symbol,
  onSelectSymbol = () => {},
  watchlists = null,
  positions = [],
  positionHistory = [],
  pendingOrders = [],
  journal = [],
  onClosePosition = () => {},
  onCloseAllPositions = () => {},
  onCloseWinners = () => {},
  onCloseLosers = () => {},
  onCloseSymbolPositions = () => {},
  onBreakEven = () => {},
  onReversePosition = () => {},
  onUpdatePosition = () => {},
  onSetTrailing = () => {},
  onDuplicatePosition = () => {},
  onCancelPending = () => {},
  onModifyPending = () => {},
  onManualOrder = () => {},
  indicators = [],
  onOpenIndicators = () => {},
  onIndicatorsChange = () => {},
  account = {},
  plannedRisk = 0,
  hotkeysEnabled = true,
  timeframe = '1m',
  onTimeframeChange = () => {},
  chartMode = 'candles',
  onChartModeChange = () => {},
  selectedTool = 'cursor',
  onSelectedToolChange = () => {},
  lots = 0.10,
  onLotsChange = () => {},
  sizingMode = 'lots',
  onSizingModeChange = () => {},
  riskPercent = 0.5,
  onRiskPercentChange = () => {},
  orderType = 'market',
  onOrderTypeChange = () => {},
  tradePlan,
  onStartPlan = () => {},
  onCancelPlan = () => {},
  onExecutePlan = () => {},
  onModifyPlan = () => {},
  onTradePlanChange = () => {},
  onOpenSettings = () => {},
  exposureAllowed = true,
  exposureBlockReason = 'New exposure is temporarily unavailable',
  riskGuardSettings = null,
  onRiskGuardSettingsChange = () => {},
}) {
  const shellRef = useRef(null);
  const searchRef = useRef(null);
  const preMarketWatchlistHeightRef = useRef(null);
  const [activeNav, setActiveNav] = useState('trade');
  const [notice, setNotice] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [requestedDockTab, setRequestedDockTab] = useState(null);
  const [desktopLayout, setDesktopLayout] = useState(loadDesktopLayout);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight : 900);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1440);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const [riskPopoverOpen, setRiskPopoverOpen] = useState(false);
  const [multiChart, setMultiChart] = useState(() => loadMultiChart(activeSymbol, timeframe));
  const favorite = watchlists?.isWatched?.(activeSymbol) === true;

  useEffect(() => {
    try {
      window.localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(desktopLayout));
    } catch {
      // Layout persistence is optional.
    }
  }, [desktopLayout]);

  useEffect(() => {
    const onResize = () => {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setDesktopLayout(current => {
      const bounds = desktopHeightBounds(viewportHeight, current.dockCollapsed, current.dockHeight);
      const widthBounds = desktopWidthBounds(viewportWidth);
      const dockHeight = clamp(current.dockHeight, bounds.dockMin, bounds.dockMax);
      const adjustedBounds = desktopHeightBounds(viewportHeight, current.dockCollapsed, dockHeight);
      const watchlistHeight = clamp(current.watchlistHeight, adjustedBounds.watchlistMin, adjustedBounds.watchlistMax);
      const sidebarWidth = clamp(current.sidebarWidth, widthBounds.sidebarMin, widthBounds.sidebarMax);
      if (dockHeight === current.dockHeight && watchlistHeight === current.watchlistHeight && sidebarWidth === current.sidebarWidth) return current;
      return { ...current, dockHeight, watchlistHeight, sidebarWidth };
    });
  }, [viewportHeight, viewportWidth]);

  useEffect(() => {
    try { window.localStorage.setItem(MULTI_CHART_KEY, JSON.stringify(multiChart)); } catch { /* optional preference */ }
  }, [multiChart]);

  useEffect(() => {
    setMultiChart(current => {
      const cells = [...current.cells];
      const index = Math.min(current.activeCell || 0, Math.max(0, current.layout - 1));
      if (current.linked) {
        let changed = false;
        for (let cellIndex = 0; cellIndex < current.layout; cellIndex += 1) {
          const cell = cells[cellIndex] || {};
          if (cell.symbol !== activeSymbol) {
            cells[cellIndex] = { ...cell, symbol: activeSymbol };
            changed = true;
          }
        }
        return changed ? { ...current, cells } : current;
      }

      const active = cells[index] || {};
      if (active.symbol === activeSymbol) return current;
      cells[index] = { ...active, symbol: activeSymbol };
      return { ...current, cells };
    });
  }, [activeSymbol]);

  const activeChartIndex = Math.min(Math.max(0, Number(multiChart?.activeCell) || 0), Math.max(0, Number(multiChart?.layout || 1) - 1));
  const activeChartTimeframe = multiChart?.cells?.[activeChartIndex]?.timeframe || timeframe;
  const chartLayout = [1, 2, 4].includes(Number(multiChart?.layout)) ? Number(multiChart.layout) : 1;
  const chartLinked = multiChart?.linked === true;

  const setChartLayout = layout => {
    setMultiChart(current => ({
      ...current,
      layout,
      activeCell: Math.min(Number(current?.activeCell) || 0, layout - 1),
    }));
    setChartMenuOpen(false);
  };

  const toggleChartLink = () => setMultiChart(current => ({ ...current, linked: !current?.linked }));

  const setDesktopTimeframe = value => {
    onTimeframeChange(value);
    setMultiChart(current => {
      const layout = [1, 2, 4].includes(Number(current?.layout)) ? Number(current.layout) : 1;
      const index = Math.min(Math.max(0, Number(current?.activeCell) || 0), layout - 1);
      const cells = Array.from({ length: 4 }, (_, cellIndex) => current?.cells?.[cellIndex] || {});
      if (cells[index]?.timeframe === value) return current;
      cells[index] = { ...cells[index], timeframe: value };
      return { ...current, cells };
    });
  };

  const heightBounds = desktopHeightBounds(viewportHeight, desktopLayout.dockCollapsed, desktopLayout.dockHeight);
  const widthBounds = desktopWidthBounds(viewportWidth);
  const sidebarWidth = desktopLayout.sidebarCollapsed ? 0 : desktopLayout.sidebarWidth;
  const dockHeight = desktopLayout.dockCollapsed ? 0 : desktopLayout.dockHeight;
  const updateSidebarWidth = value => setDesktopLayout(current => ({ ...current, sidebarWidth: clamp(value, widthBounds.sidebarMin, widthBounds.sidebarMax), sidebarCollapsed: false }));
  const updateDockHeight = value => setDesktopLayout(current => {
    const bounds = desktopHeightBounds(viewportHeight, false, value);
    const nextDock = clamp(value, bounds.dockMin, bounds.dockMax);
    const nextBounds = desktopHeightBounds(viewportHeight, false, nextDock);
    return {
      ...current,
      dockHeight: nextDock,
      dockCollapsed: false,
      watchlistHeight: clamp(current.watchlistHeight, nextBounds.watchlistMin, nextBounds.watchlistMax),
    };
  });
  const updateWatchlistHeight = value => setDesktopLayout(current => {
    const bounds = desktopHeightBounds(viewportHeight, current.dockCollapsed, current.dockHeight);
    return { ...current, watchlistHeight: clamp(value, bounds.watchlistMin, bounds.watchlistMax) };
  });
  const toggleWatchlistFocus = () => setDesktopLayout(current => {
    const bounds = desktopHeightBounds(viewportHeight, current.dockCollapsed, current.dockHeight);
    const midpoint = (bounds.balancedWatchlist + bounds.marketFocusWatchlist) / 2;
    return {
      ...current,
      watchlistHeight: current.watchlistHeight >= midpoint ? bounds.balancedWatchlist : bounds.marketFocusWatchlist,
    };
  });
  const toggleSidebar = () => setDesktopLayout(current => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed }));
  const toggleDock = () => setDesktopLayout(current => ({ ...current, dockCollapsed: !current.dockCollapsed }));
  const resetDesktopLayout = () => {
    const bounds = desktopHeightBounds(window.innerHeight);
    setDesktopLayout({
      sidebarWidth: desktopWidthBounds(window.innerWidth).defaultSidebar,
      dockHeight: bounds.defaultDock,
      sidebarCollapsed: false,
      dockCollapsed: false,
      watchlistHeight: bounds.defaultWatchlist,
    });
    setLayoutMenuOpen(false);
  };

  const workspaceSnapshot = {
    layout: desktopLayout,
    trading: {
      timeframe,
      chartMode,
      sizingMode,
      riskPercent,
      orderType,
      symbol: activeSymbol,
      activeListId: watchlists?.activeList?.id || null,
      indicators,
      multiChart,
    },
  };

  const applyWorkspace = workspace => {
    if (!workspace) return;
    const layout = workspace.layout || {};
    setDesktopLayout(current => {
      const requestedDock = layout.dockHeight ?? current.dockHeight;
      const requestedCollapsed = layout.dockCollapsed ?? current.dockCollapsed;
      const bounds = desktopHeightBounds(viewportHeight, requestedCollapsed, requestedDock);
      const dockHeight = clamp(requestedDock, bounds.dockMin, bounds.dockMax);
      const adjustedBounds = desktopHeightBounds(viewportHeight, requestedCollapsed, dockHeight);
      return {
        ...current,
        ...layout,
        sidebarWidth: clamp(layout.sidebarWidth ?? current.sidebarWidth, widthBounds.sidebarMin, widthBounds.sidebarMax),
        dockHeight,
        watchlistHeight: clamp(layout.watchlistHeight ?? current.watchlistHeight ?? adjustedBounds.defaultWatchlist, adjustedBounds.watchlistMin, adjustedBounds.watchlistMax),
      };
    });
    const trading = workspace.trading || {};
    if (trading.timeframe) onTimeframeChange(trading.timeframe);
    if (trading.chartMode) onChartModeChange(trading.chartMode);
    if (trading.sizingMode) onSizingModeChange(trading.sizingMode);
    if (Number.isFinite(Number(trading.riskPercent))) onRiskPercentChange(Number(trading.riskPercent));
    if (trading.orderType) onOrderTypeChange(trading.orderType);
    if (trading.symbol && markets.some(item => item.symbol === trading.symbol)) onSelectSymbol(trading.symbol);
    if (trading.activeListId) watchlists?.setActiveListId?.(trading.activeListId);
    if (Array.isArray(trading.indicators)) onIndicatorsChange(trading.indicators);
    if (trading.multiChart && typeof trading.multiChart === 'object') setMultiChart(trading.multiChart);
    setNotice(`${workspace.name || 'Workspace'} applied`);
  };

  const currency = account?.currency || 'USD';
  const accountPnl = Number(account?.floatingPnl ?? (Number(account?.equity) - Number(account?.balance)));
  const challengeRisk = calculateAccountRiskSummary(account, plannedRisk);
  const hasChallengeRules = challengeRisk.dailyLossLimit > 0 || challengeRisk.maxLossLimit > 0 || challengeRisk.profitTarget > 0;
  const challengeWarning = challengeRisk.dailyLossLimit > 0 && plannedRisk > 0
    && (!challengeRisk.riskAvailabilityLive || plannedRisk >= challengeRisk.remainingDaily * 0.75);
  const valuationStatus = String(account?.valuationStatus || 'WAITING').toUpperCase();
  const accountStatus = String(account?.status || 'UNKNOWN').toUpperCase();
  const canOpen = exposureAllowed && executableMarket(market) && accountStatus === 'ACTIVE' && account?.tradingEnabled === true && valuationStatus === 'LIVE';

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await shellRef.current?.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (error) {
      console.warn('Fullscreen unavailable', error);
    }
  };

  const submitOneClick = order => {
    if (!canOpen) {
      setNotice(exposureBlockReason || 'New exposure is unavailable until account, valuation and market state are live.');
      return;
    }
    onManualOrder(order);
  };

  const handleNav = id => {
    setActiveNav(id);
    if (id === 'more') {
      onOpenSettings();
      return;
    }
    if (id === 'history') {
      setRequestedDockTab('history');
      setDesktopLayout(current => ({ ...current, dockCollapsed: false }));
      return;
    }
    if (id === 'markets') {
      setDesktopLayout(current => {
        const bounds = desktopHeightBounds(viewportHeight, current.dockCollapsed, current.dockHeight);
        if (activeNav !== 'markets') preMarketWatchlistHeightRef.current = current.watchlistHeight;
        return {
          ...current,
          sidebarCollapsed: false,
          watchlistHeight: Math.max(current.watchlistHeight || bounds.defaultWatchlist, bounds.marketFocusWatchlist),
        };
      });
      window.setTimeout(() => searchRef.current?.focus(), 0);
      return;
    }
    if (id === 'watchlist') {
      setDesktopLayout(current => {
        const bounds = desktopHeightBounds(viewportHeight, current.dockCollapsed, current.dockHeight);
        const restored = preMarketWatchlistHeightRef.current;
        preMarketWatchlistHeightRef.current = null;
        return {
          ...current,
          sidebarCollapsed: false,
          watchlistHeight: restored == null
            ? current.watchlistHeight
            : clamp(restored, bounds.watchlistMin, bounds.watchlistMax),
        };
      });
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  };

  return (
    <div ref={shellRef} className="relative h-dvh min-h-0 overflow-hidden bg-black text-[#E6EDF3]">
      {notice && <div className="absolute right-3 top-[60px] z-[120] flex max-w-[390px] items-center gap-3 rounded-md border border-white/[0.06] bg-[#101010]/95 px-3 py-2.5 text-[10px] font-semibold text-[#E6EDF3] shadow-[0_16px_48px_rgba(0,0,0,.45)]"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="grid size-6 place-items-center rounded-md text-[#8094a7]"><X size={13}/></button></div>}

      <header className="flex h-[52px] items-center border-b border-white/[0.06] bg-[#07090B] px-3 shadow-[0_1px_0_rgba(255,255,255,0.015)]">
        <div className="flex min-w-[178px] items-center gap-2">
          <span className="text-[16px] font-extrabold tracking-[-0.03em]">ACG Trader</span>
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-extrabold tracking-[0.06em] text-[#59C7FF]">V2</span>
        </div>

        <div className="ml-2 hidden items-stretch divide-x divide-white/[0.07] rounded-md border border-white/[0.06] bg-black/25 xl:flex">
          {[
            ['Balance', money(account?.balance, currency)],
            ['Equity', money(account?.equity, currency)],
            ['Floating P/L', formatPnl(accountPnl, currency)],
            ['Free margin', money(account?.freeMargin, currency)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-[102px] px-3 py-1.5">
              <span className="block text-[8px] font-semibold uppercase tracking-[0.07em] text-[#6F8191]">{label}</span>
              <strong className={`mt-0.5 block text-[11px] font-bold ${label === 'Floating P/L' ? (accountPnl >= 0 ? 'text-[#42D7A1]' : 'text-[#FF6F7A]') : 'text-[#E6EDF3]'}`}>{value}</strong>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          
          <button type="button" onClick={() => searchRef.current?.focus()} className="grid size-8 place-items-center rounded-md text-[#A1AFBC] hover:bg-white/[0.035] hover:text-white" aria-label="Search"><Search size={16}/></button>
          <button type="button" onClick={() => setNotice('Notification delivery is not connected to a backend event inbox yet.')} className="grid size-8 place-items-center rounded-md border border-white/[0.06] bg-black/20 text-[#A1AFBC]" aria-label="Notifications"><Bell size={15}/></button>
          <button type="button" onClick={() => setNotice(`${account?.accountCode || 'Trading account'} • ${accountStatus} • ${valuationStatus}`)} className="flex h-8 items-center gap-2 rounded-md border border-white/[0.06] bg-black/20 px-2.5 text-left">
            <span className={`size-1.5 rounded-full ${canOpen ? 'bg-[#2fd9a0]' : valuationStatus === 'STALE' ? 'bg-[#e8bd55]' : 'bg-[#343434]'}`}/>
            <div className="leading-none"><strong className="block text-[9px]">{money(account?.equity, currency)}</strong><span className="mt-1 block text-[7px] text-[#6F8191]">{account?.accountCode || accountStatus}</span></div>
          </button>
          <button type="button" onClick={() => setNotice(`Account ${accountStatus.toLowerCase()} • valuation ${valuationStatus.toLowerCase()}`)} className="grid size-8 place-items-center rounded-full border border-white/[0.06] bg-black/20 text-[#A1AFBC]" aria-label="Profile"><UserRound size={15}/></button>
        </div>
      </header>

      <div className="grid h-[calc(100dvh-52px)] min-h-0 grid-cols-[50px_minmax(0,1fr)] 2xl:grid-cols-[54px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col items-center border-r border-white/[0.06] bg-[#07090B] py-1.5">
          {navItems.map(([id, Icon, label]) => {
            const active = activeNav === id;
            return (
              <button key={id} type="button" title={label} onClick={() => handleNav(id)} className={`mb-0.5 flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded text-[8px] font-semibold transition ${active ? 'border-l-2 border-[#53c7ff] bg-white/[0.02] text-[#59C7FF]' : 'text-[#6F8191] hover:bg-white/[0.03] hover:text-[#E6EDF3]'}`}>
                <Icon size={16} strokeWidth={1.8}/><span>{label}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <button type="button" onClick={onOpenSettings} title="Settings" className="grid size-10 place-items-center rounded-md text-[#6F8191] hover:bg-white/[0.03] hover:text-white"><Settings size={16}/></button>
        </aside>

        <div
          className="relative grid min-h-0 min-w-0 bg-[#07090B] 2xl:bg-[#07090B]"
          style={{
            gridTemplateColumns: `minmax(0, 1fr) ${sidebarWidth}px`,
            gridTemplateRows: `minmax(0, 1fr) ${dockHeight}px`,
          }}
        >
          <section className="grid min-h-0 min-w-0 grid-rows-[52px_40px_minmax(0,1fr)]">
            <div className="flex items-center border-b border-white/[0.06] bg-[#07090B] px-3">
              <div className="flex min-w-[210px] items-center gap-2">
                <InstrumentAvatar instrument={market} size={28}/>
                <div className="min-w-0">
                  <button type="button" onClick={() => searchRef.current?.focus()} className="flex items-center gap-1 text-[14px] font-bold tracking-[-0.025em] text-[#f3f7fb]">{market?.displaySymbol || displaySymbol(market?.symbol)}<ChevronDown size={12}/></button>
                  <span className="mt-0.5 block truncate text-[8px] text-[#6F8191]">{marketLabel(market)}</span>
                </div>
              </div>

              <div className="ml-3">
                <strong className="block font-mono text-[16px] tracking-[-0.02em] text-[#edf5fb]">{market?.bid || '—'}</strong>
                <span className={`mt-0.5 block text-[9px] font-semibold ${market?.live ? 'text-[#42D7A1]' : market?.isStale ? 'text-[#E7BD58]' : 'text-[#6F8191]'}`}>{market?.sessionOpen === false ? 'SESSION CLOSED' : market?.live ? 'LIVE' : market?.isStale ? 'STALE' : market?.marketState || 'WAITING'}</span>
              </div>

              <div className="relative ml-5 hidden lg:block">
                <button type="button" onClick={() => setRiskPopoverOpen(value => !value)} className={`flex h-8 items-center gap-3 rounded-md border px-2.5 text-[8px] transition ${riskPopoverOpen ? 'border-[#315b72] bg-[#0d1a22]' : 'border-white/[0.06] bg-black/20 hover:bg-white/[0.025]'}`} title="Challenge risk">
                  <ShieldAlert size={12} className={challengeWarning ? 'text-[#FF6F7A]' : 'text-[#59C7FF]'}/>
                  {hasChallengeRules ? (
                    <>
                      <span className="whitespace-nowrap text-[#6F8191]">Daily <b className={challengeWarning ? 'text-[#FF6F7A]' : 'text-[#E6EDF3]'}>{money(challengeRisk.remainingDaily, currency)}</b></span>
                      <span className="hidden whitespace-nowrap text-[#6F8191] xl:inline">Max <b className="text-[#E6EDF3]">{money(challengeRisk.remainingMax, currency)}</b></span>
                      <span className="hidden whitespace-nowrap text-[#6F8191] 2xl:inline">Target <b className="text-[#42D7A1]">{money(challengeRisk.profit, currency)} / {money(challengeRisk.profitTarget, currency)}</b></span>
                    </>
                  ) : (
                    <span className="whitespace-nowrap text-[#6F8191]">Challenge <b className="text-[#A1AFBC]">No limits</b></span>
                  )}
                </button>

                {riskPopoverOpen && (
                  <div className="absolute left-0 top-10 z-[100] w-[300px] rounded-md border border-white/[0.10] bg-[#0C1013] p-3 shadow-[0_18px_50px_rgba(0,0,0,.60)]">
                    <div className="flex items-center justify-between"><strong className="text-[10px] text-[#E6EDF3]">Challenge health</strong><span className={`text-[8px] font-bold ${valuationStatus === 'LIVE' ? 'text-[#42D7A1]' : valuationStatus === 'STALE' ? 'text-[#E7BD58]' : 'text-[#A1AFBC]'}`}>{valuationStatus}</span></div>
                    {hasChallengeRules ? (
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                        <div><span className="block text-[7px] uppercase text-[#6F8191]">Daily room</span><b className="mt-0.5 block text-[10px] text-[#E6EDF3]">{money(challengeRisk.remainingDaily, currency)}</b></div>
                        <div><span className="block text-[7px] uppercase text-[#6F8191]">Max room</span><b className="mt-0.5 block text-[10px] text-[#E6EDF3]">{money(challengeRisk.remainingMax, currency)}</b></div>
                        <div><span className="block text-[7px] uppercase text-[#6F8191]">Profit</span><b className="mt-0.5 block text-[10px] text-[#42D7A1]">{money(challengeRisk.profit, currency)} / {money(challengeRisk.profitTarget, currency)}</b></div>
                        <div><span className="block text-[7px] uppercase text-[#6F8191]">After current SL</span><b className={`mt-0.5 block text-[10px] ${challengeWarning ? 'text-[#FF6F7A]' : 'text-[#59C7FF]'}`}>{plannedRisk > 0 ? money(challengeRisk.postTradeDaily, currency) : '—'}</b></div>
                      </div>
                    ) : (
                      <div className="mt-3 text-[8px] leading-4 text-[#6F8191]">Challenge limits are not configured for this account. Current free margin is <b className="text-[#E6EDF3]">{money(account?.freeMargin, currency)}</b>.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-3">
                <div className="hidden text-right xl:block"><span className="block text-[8px] uppercase tracking-[0.07em] text-[#6F8191]">Valuation</span><b className={`mt-0.5 block text-[8px] ${valuationStatus === 'LIVE' ? 'text-[#42D7A1]' : valuationStatus === 'STALE' ? 'text-[#E7BD58]' : 'text-[#A1AFBC]'}`}>{valuationStatus}</b></div>
                <button type="button" onClick={() => watchlists?.toggleSymbol?.(activeSymbol)} className={`grid size-7 place-items-center rounded-md hover:bg-white/[0.035] ${favorite ? 'text-[#f6c95d]' : 'text-[#687d92]'}`}><Star size={14} fill={favorite ? 'currentColor' : 'none'}/></button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#07090B] px-2.5">
              <div className="flex items-center gap-0.5">
                {timeframes.map(([label, value]) => (
                  <button key={value} type="button" onClick={() => setDesktopTimeframe(value)} disabled={Boolean(tradePlan && !tradePlan.open)} className={`h-7 min-w-8 rounded px-2 text-[8px] font-bold ${activeChartTimeframe === value ? 'bg-white/[0.05] text-[#59C7FF]' : 'text-[#6F8191] hover:bg-white/[0.035] hover:text-[#E6EDF3]'} disabled:opacity-30`}>{label}</button>
                ))}
              </div>
              <div className="mx-1 h-4 w-px bg-white/[0.07]"/>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => onChartModeChange('candles')} disabled={Boolean(tradePlan && !tradePlan.open)} className={`grid size-6 place-items-center rounded ${chartMode === 'candles' ? 'bg-white/[0.05] text-[#59C7FF]' : 'text-[#6F8191]'} disabled:opacity-30`} title="Candlesticks"><CandlestickChart size={13}/></button>
                <button type="button" onClick={() => onChartModeChange('line')} disabled={Boolean(tradePlan && !tradePlan.open)} className={`grid size-6 place-items-center rounded ${chartMode === 'line' ? 'bg-white/[0.05] text-[#59C7FF]' : 'text-[#6F8191]'} disabled:opacity-30`} title="Line chart"><ChartNoAxesCombined size={13}/></button>
                <button type="button" onClick={onOpenIndicators} className={`relative grid size-6 place-items-center rounded text-[9px] font-black hover:text-white ${indicators.length ? 'bg-white/[0.05] text-[#59C7FF]' : 'text-[#6F8191]'}`} title="Indicators">ƒx{indicators.length > 0 && <span className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-[#151515] text-[5px] text-white">{indicators.length}</span>}</button>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <div className="relative">
                  <button type="button" onClick={() => setChartMenuOpen(value => !value)} className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[8px] font-semibold ${chartMenuOpen || chartLayout > 1 ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] bg-black/20 text-[#6F8191] hover:text-white'}`} title="Chart layout">
                    {chartLayout === 1 ? <Square size={12}/> : chartLayout === 2 ? <Columns2 size={12}/> : <Grid2X2 size={12}/>}
                    <span className="hidden xl:inline">Charts</span>
                    <ChevronDown size={10}/>
                  </button>
                  {chartMenuOpen && (
                    <div className="absolute right-0 top-8 z-[95] w-[190px] rounded-md border border-white/[0.10] bg-[#0C1013] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
                      {[
                        [1, Square, 'Single chart'],
                        [2, Columns2, 'Two charts'],
                        [4, Grid2X2, 'Four charts'],
                      ].map(([value, Icon, label]) => (
                        <button key={value} type="button" onClick={() => setChartLayout(value)} className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold ${chartLayout === value ? 'bg-[#0d1a22] text-[#59C7FF]' : 'text-[#A1AFBC] hover:bg-white/[0.03]'}`}><Icon size={12}/>{label}</button>
                      ))}
                      {chartLayout > 1 && (
                        <>
                          <div className="my-1 border-t border-white/[0.06]"/>
                          <button type="button" onClick={toggleChartLink} className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold ${chartLinked ? 'text-[#59C7FF]' : 'text-[#A1AFBC]'} hover:bg-white/[0.03]`}><span className="flex items-center gap-2">{chartLinked ? <Link2 size={12}/> : <Link2Off size={12}/>}Link symbols</span><span className="text-[#6F8191]">{chartLinked ? 'On' : 'Off'}</span></button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <DesktopWorkspaceMenu snapshot={workspaceSnapshot} onApply={applyWorkspace}/>
                <button type="button" onClick={() => setReviewOpen(true)} className="flex h-7 items-center gap-1 rounded-md border border-white/[0.06] bg-black/20 px-2 text-[8px] font-semibold text-[#6F8191] hover:text-white" title="Trade review"><BookOpen size={12}/>Review</button>
                <div className="relative">
                  <button type="button" onClick={() => setLayoutMenuOpen(value => !value)} className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[8px] font-semibold ${layoutMenuOpen ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] bg-black/20 text-[#6F8191] hover:text-white'}`} title="Layout options"><MoreHorizontal size={12}/>Layout</button>
                  {layoutMenuOpen && (
                    <div className="absolute right-0 top-8 z-[95] w-[190px] rounded-md border border-white/[0.10] bg-[#0C1013] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
                      <button type="button" onClick={() => { toggleSidebar(); setLayoutMenuOpen(false); }} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><span>Right trading panel</span><span className="text-[#6F8191]">{desktopLayout.sidebarCollapsed ? 'Hidden' : 'Shown'}</span></button>
                      <button type="button" onClick={() => { toggleDock(); setLayoutMenuOpen(false); }} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><span>Positions dock</span><span className="text-[#6F8191]">{desktopLayout.dockCollapsed ? 'Hidden' : 'Shown'}</span></button>
                      <div className="my-1 border-t border-white/[0.06]"/>
                      <button type="button" onClick={resetDesktopLayout} className="w-full rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]">Reset layout</button>
                    </div>
                  )}
                </div>
                <button type="button" onClick={toggleFullscreen} className="grid size-7 place-items-center rounded-md border border-white/[0.06] bg-black/20 text-[#6F8191] hover:text-white" title="Fullscreen"><Maximize2 size={13}/></button>
              </div>
            </div>

            <div className="min-h-0 min-w-0 bg-[#07090B]">
              <DesktopMultiChart
                config={multiChart}
                onChange={setMultiChart}
                markets={markets}
                activeSymbol={activeSymbol}
                onSelectSymbol={onSelectSymbol}
                indicators={indicators}
                positions={positions}
                selectedTool={selectedTool}
                onSelectedToolChange={onSelectedToolChange}
                chartMode={chartMode}
                onActiveTimeframeChange={onTimeframeChange}
                tradePlan={tradePlan}
                onTradePlanChange={onTradePlanChange}
                onUpdatePosition={onUpdatePosition}
              />
            </div>
          </section>

          <aside
            className={`min-h-0 border-l border-white/[0.06] bg-[#07090B] ${desktopLayout.sidebarCollapsed ? 'hidden' : 'grid'}`}
            style={{ gridTemplateRows: `${desktopLayout.watchlistHeight || 220}px 4px minmax(0,1fr)` }}
          >
            <div className="min-h-0 overflow-hidden">
              <DesktopWatchlist
                markets={markets}
                activeSymbol={activeSymbol}
                onSelectSymbol={onSelectSymbol}
                watchlists={watchlists}
                mode={activeNav === 'markets' ? 'markets' : 'watchlist'}
                searchRef={searchRef}
                onNotice={setNotice}
              />
            </div>

            <ResizeHandle
              axis="y"
              value={desktopLayout.watchlistHeight || 220}
              min={heightBounds.watchlistMin}
              max={heightBounds.watchlistMax}
              onChange={updateWatchlistHeight}
              onDoubleClick={toggleWatchlistFocus}
              ariaLabel="Resize watchlist and order ticket"
              className="w-full"
            />

            <div className="min-h-0 overflow-y-auto [scrollbar-width:thin]">
              <DesktopOrderTicket market={market} markets={markets} account={account} positions={positions} positionHistory={positionHistory} exposureAllowed={exposureAllowed} exposureBlockReason={exposureBlockReason} lots={lots} onLotsChange={onLotsChange} sizingMode={sizingMode} onSizingModeChange={onSizingModeChange} riskPercent={riskPercent} onRiskPercentChange={onRiskPercentChange} orderType={orderType} onOrderTypeChange={onOrderTypeChange} tradePlan={tradePlan} onStartPlan={onStartPlan} onCancelPlan={onCancelPlan} onExecutePlan={onExecutePlan} onModifyPlan={onModifyPlan} onManualOrder={submitOneClick} onTradePlanChange={onTradePlanChange} riskGuardSettings={riskGuardSettings} onRiskGuardSettingsChange={onRiskGuardSettingsChange}/>
            </div>
          </aside>

          <div className={`col-span-2 min-h-0 overflow-auto border-t border-white/[0.06] bg-[#07090B] ${desktopLayout.dockCollapsed ? 'hidden' : ''}`}>
            <PositionsPanel desktopDense requestedTab={requestedDockTab} activeSymbol={activeSymbol} positions={positions} markets={markets} positionHistory={positionHistory} pendingOrders={pendingOrders} journal={journal} onClosePosition={onClosePosition} onCloseAll={onCloseAllPositions} onCloseWinners={onCloseWinners} onCloseLosers={onCloseLosers} onCloseSymbol={onCloseSymbolPositions} onBreakEven={onBreakEven} onReverse={onReversePosition} onUpdatePosition={onUpdatePosition} onSetTrailing={onSetTrailing} onDuplicate={onDuplicatePosition} onCancelPending={onCancelPending} onModifyPending={onModifyPending}/>
          </div>

          {!desktopLayout.sidebarCollapsed && (
            <ResizeHandle
              axis="x"
              value={desktopLayout.sidebarWidth}
              min={widthBounds.sidebarMin}
              max={widthBounds.sidebarMax}
              deltaMultiplier={-1}
              onChange={updateSidebarWidth}
              ariaLabel="Resize right trading panel"
              className="absolute bottom-0 top-0"
              style={{ right: sidebarWidth - 2 }}
            />
          )}

          {!desktopLayout.dockCollapsed && (
            <ResizeHandle
              axis="y"
              value={desktopLayout.dockHeight}
              min={heightBounds.dockMin}
              max={heightBounds.dockMax}
              deltaMultiplier={-1}
              onChange={updateDockHeight}
              ariaLabel="Resize positions dock"
              className="absolute left-0 right-0"
              style={{ bottom: dockHeight - 2 }}
            />
          )}
        </div>
      </div>
      <DesktopTradeReview
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        positionHistory={positionHistory}
        journal={journal}
        markets={markets}
        onSelectSymbol={symbol => { onSelectSymbol(symbol); setReviewOpen(false); }}
      />
    </div>
  );
}
