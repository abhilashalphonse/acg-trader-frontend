import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  Check,
  CandlestickChart,
  ChartNoAxesCombined,
  ChevronDown,
  Columns2,
  Grid2X2,
  History,
  Link2,
  Link2Off,
  List,
  Loader2,
  Layers3,
  Maximize2,
  MoreHorizontal,
  Search,
  Settings,
  Square,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import DesktopOrderTicket from './desktop/DesktopOrderTicket.jsx';
import DesktopPositionManager from './desktop/DesktopPositionManager.jsx';
import DesktopMultiChart from './desktop/DesktopMultiChart.jsx';
import DesktopTradeReview from './desktop/DesktopTradeReview.jsx';
import DesktopWorkspaceMenu from './desktop/DesktopWorkspaceMenu.jsx';
import DesktopWatchlist from './desktop/DesktopWatchlist.jsx';
import ChartObjectManager from './desktop/ChartObjectManager.jsx';
import ResizeHandle from './desktop/ResizeHandle.jsx';
import PositionsPanel from './PositionsPanel.jsx';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import IndicatorManager from './IndicatorManager.jsx';
import { accountStatusLabel, accountTypeBadge, accountTypeLabel } from '../../utils/accountPresentation.js';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
import { marketApi } from '../../api/market.js';

const timeframes = [['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'], ['1H', '1H'], ['4H', '4H'], ['1D', '1D'], ['1W', '1W']];
const DESKTOP_LAYOUT_KEY = 'acg-trader-desktop-layout-v1';
const MULTI_CHART_KEY = 'acg-trader-multi-chart-v1';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function desktopWidthBounds(viewportWidth) {
  const width = Number(viewportWidth) || 1440;
  const workspaceWidth = width;
  const sidebarMin = 330;
  const tierMax = width < 1400 ? 360 : width < 1700 ? 380 : width < 2200 ? 400 : 420;
  const percentageMax = workspaceWidth * 0.30;
  const chartProtectedMax = workspaceWidth - 760;
  const sidebarMax = Math.max(sidebarMin, Math.floor(Math.min(tierMax, percentageMax, chartProtectedMax)));
  const defaultSidebar = Math.min(width >= 1700 ? 380 : 360, sidebarMax);
  return { sidebarMin, sidebarMax, defaultSidebar };
}

function desktopMarketPanelBounds(viewportWidth, orderPanelWidth = 380) {
  const width = Number(viewportWidth) || 1440;
  const available = Math.max(0, width - Number(orderPanelWidth || 0));
  const panelMin = 260;
  const tierMax = width < 1400 ? 320 : width < 1700 ? 360 : width < 2200 ? 420 : 460;
  const chartProtectedMax = available - 700;
  const panelMax = Math.max(panelMin, Math.floor(Math.min(tierMax, chartProtectedMax)));
  const defaultPanel = Math.min(width >= 1700 ? 330 : 300, panelMax);
  return { panelMin, panelMax, defaultPanel };
}

function desktopHeightBounds(viewportHeight, dockCollapsed = false, dockHeight = 0) {
  const height = Number(viewportHeight) || 900;
  const compact = height <= 900;
  const dockMin = 110;
  const dockMax = compact ? Math.min(320, Math.floor(height * 0.44)) : height <= 1050 ? Math.min(420, Math.floor(height * 0.46)) : Math.min(520, Math.floor(height * 0.48));
  const defaultDock = compact ? 165 : height <= 1050 ? 200 : 230;
  const effectiveDock = dockCollapsed ? 0 : clamp(dockHeight || defaultDock, dockMin, dockMax);
  const upperWorkspaceHeight = Math.max(0, height - 58 - effectiveDock);

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
    marketPanelWidth: desktopMarketPanelBounds(viewportWidth, widthBounds.defaultSidebar).defaultPanel,
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
      marketPanelWidth: clamp(
        stored.marketPanelWidth || fallback.marketPanelWidth,
        desktopMarketPanelBounds(viewportWidth, stored.sidebarWidth || fallback.sidebarWidth).panelMin,
        desktopMarketPanelBounds(viewportWidth, stored.sidebarWidth || fallback.sidebarWidth).panelMax,
      ),
      watchlistHeight: clamp(stored.watchlistHeight || fallback.watchlistHeight, bounds.watchlistMin, bounds.watchlistMax),
    };
  } catch {
    return fallback;
  }
}

function cloneIndicators(items) {
  return Array.isArray(items) ? items.map(item => ({ ...item, settings: { ...(item?.settings || {}) } })) : [];
}

function sameIndicators(a, b) {
  try { return JSON.stringify(a || []) === JSON.stringify(b || []); } catch { return false; }
}

function loadMultiChart(activeSymbol, timeframe, indicators = []) {
  const fallback = {
    layout: 1,
    linked: false,
    activeCell: 0,
    cells: [
      { symbol: activeSymbol || '', timeframe: timeframe || '1m', indicators: cloneIndicators(indicators) },
      { symbol: '', timeframe: '5m', indicators: cloneIndicators(indicators) },
      { symbol: '', timeframe: '15m', indicators: cloneIndicators(indicators) },
      { symbol: '', timeframe: '1H', indicators: cloneIndicators(indicators) },
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
      cells: Array.from({ length: 4 }, (_, index) => {
        const storedCell = stored.cells?.[index] || {};
        return {
          ...fallback.cells[index],
          ...storedCell,
          indicators: Array.isArray(storedCell.indicators)
            ? cloneIndicators(storedCell.indicators)
            : cloneIndicators(fallback.cells[index].indicators),
        };
      }),
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

function accountSize(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  const code = String(currency || 'USD').toUpperCase();
  const symbol = code === 'USD' ? '$' : code + ' ';
  if (numeric >= 1_000_000) return symbol + (numeric / 1_000_000).toFixed(numeric % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (numeric >= 1_000) return symbol + (numeric / 1_000).toFixed(numeric % 1_000 === 0 ? 0 : 1) + 'K';
  return symbol + numeric.toLocaleString('en-US');
}

function accountGroups(accounts = []) {
  const groups = [
    { id: 'trading', label: 'Trading', items: [] },
    { id: 'trial', label: 'Trial', items: [] },
    { id: 'closed', label: 'Breached / closed', items: [] },
  ];
  for (const item of accounts) {
    const status = String(item?.status || '').toUpperCase();
    if (['BREACHED', 'DISABLED', 'CLOSED'].includes(status)) groups[2].items.push(item);
    else if (accountTypeBadge(item) === 'TRIAL') groups[1].items.push(item);
    else groups[0].items.push(item);
  }
  return groups.filter(group => group.items.length);
}

function formatPnl(value, currency = 'USD') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const absolute = money(Math.abs(number), currency);
  return (number >= 0 ? '+' : '-') + absolute;
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
  indicatorFavorites = [],
  onAddIndicator = () => {},
  onRemoveIndicator = () => {},
  onToggleIndicator = () => {},
  onUpdateIndicator = () => {},
  onToggleIndicatorFavorite = () => {},
  onIndicatorsChange = () => {},
  account = {},
  accounts = [],
  activeAccountId = null,
  accountSwitching = false,
  accountSwitchError = null,
  onSelectAccount = () => false,
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
  onCreateRiskOrder = () => {},
  onOpenSettings = () => {},
  exposureAllowed = true,
  exposureBlockReason = 'New exposure is temporarily unavailable',
  riskGuardSettings = null,
  onRiskGuardSettingsChange = () => {},
  readOnly = false,
}) {
  const shellRef = useRef(null);
  const searchRef = useRef(null);
  const [activeNav, setActiveNav] = useState('trade');
  const [notice, setNotice] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState(null);
  const [positionEditRequest, setPositionEditRequest] = useState(null);
  const [requestedDockTab, setRequestedDockTab] = useState(null);
  const [positionsExpanded, setPositionsExpanded] = useState(false);
  const [desktopLayout, setDesktopLayout] = useState(loadDesktopLayout);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight : 900);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1440);
  const [market24hStats, setMarket24hStats] = useState({ symbol: null, high: null, low: null, volume: null });
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const [indicatorFocusId, setIndicatorFocusId] = useState(null);
  const [objectManagerOpen, setObjectManagerOpen] = useState(false);
  const [multiChart, setMultiChart] = useState(() => loadMultiChart(activeSymbol, timeframe, indicators));
  const selectedPosition = positions.find(position => String(position?.id) === String(selectedPositionId)) || null;
  const groupedAccounts = accountGroups(accounts);

  useEffect(() => {
    if (!readOnly) return;
    setRequestedDockTab('history');
    setDesktopLayout(current => ({ ...current, dockCollapsed: false }));
    setNotice('Read-only account: trading is disabled. Review your executed deals and orders in History.');
  }, [activeAccountId, readOnly]);

  useEffect(() => {
    if (selectedPositionId == null) return;
    if (!positions.some(position => String(position?.id) === String(selectedPositionId))) setSelectedPositionId(null);
  }, [positions, selectedPositionId]);

  const selectPosition = positionOrId => {
    const id = typeof positionOrId === 'object' ? positionOrId?.id : positionOrId;
    if (id === null || id === undefined) {
      setSelectedPositionId(null);
      setPositionEditRequest(null);
      return;
    }
    const position = positions.find(item => String(item?.id) === String(id));
    if (!position) return;
    setSelectedPositionId(position.id);
    setPositionEditRequest(null);
    if (position.symbol && position.symbol !== activeSymbol) onSelectSymbol(position.symbol);
  };

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
    if (!activeSymbol) {
      setMarket24hStats({ symbol: null, high: null, low: null, volume: null });
      return undefined;
    }

    let disposed = false;
    let controller = new AbortController();
    let timer = null;

    const refresh = async () => {
      try {
        const response = await marketApi.candles({
          symbol: activeSymbol,
          timeframe: '1h',
          limit: 30,
        }, controller.signal);
        if (disposed || controller.signal.aborted) return;

        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const candles = (response?.candles || []).filter(candle => {
          const time = Number(candle?.openTimeMs);
          return Number.isFinite(time) && time >= cutoff;
        });
        const highs = candles.map(candle => Number(candle?.high)).filter(value => Number.isFinite(value) && value > 0);
        const lows = candles.map(candle => Number(candle?.low)).filter(value => Number.isFinite(value) && value > 0);
        const providerVolumes = candles.map(candle => Number(candle?.providerVolume)).filter(value => Number.isFinite(value) && value > 0);

        setMarket24hStats({
          symbol: activeSymbol,
          high: highs.length ? Math.max(...highs) : null,
          low: lows.length ? Math.min(...lows) : null,
          volume: providerVolumes.length ? providerVolumes.reduce((sum, value) => sum + value, 0) : null,
        });
      } catch (error) {
        if (!disposed && error?.name !== 'AbortError') {
          setMarket24hStats({ symbol: activeSymbol, high: null, low: null, volume: null });
        }
      } finally {
        if (!disposed) {
          timer = window.setTimeout(() => {
            controller = new AbortController();
            void refresh();
          }, 60000);
        }
      }
    };

    void refresh();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [activeSymbol]);

  useEffect(() => {
    setDesktopLayout(current => {
      const bounds = desktopHeightBounds(viewportHeight, current.dockCollapsed, current.dockHeight);
      const widthBounds = desktopWidthBounds(viewportWidth);
      const dockHeight = clamp(current.dockHeight, bounds.dockMin, bounds.dockMax);
      const adjustedBounds = desktopHeightBounds(viewportHeight, current.dockCollapsed, dockHeight);
      const watchlistHeight = clamp(current.watchlistHeight, adjustedBounds.watchlistMin, adjustedBounds.watchlistMax);
      const sidebarWidth = clamp(current.sidebarWidth, widthBounds.sidebarMin, widthBounds.sidebarMax);
      const marketBounds = desktopMarketPanelBounds(viewportWidth, sidebarWidth);
      const marketPanelWidth = clamp(current.marketPanelWidth || marketBounds.defaultPanel, marketBounds.panelMin, marketBounds.panelMax);
      if (dockHeight === current.dockHeight && watchlistHeight === current.watchlistHeight && sidebarWidth === current.sidebarWidth && marketPanelWidth === current.marketPanelWidth) return current;
      return { ...current, dockHeight, watchlistHeight, sidebarWidth, marketPanelWidth };
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

  useEffect(() => {
    setMultiChart(current => {
      const layout = [1, 2, 4].includes(Number(current?.layout)) ? Number(current.layout) : 1;
      const index = Math.min(Math.max(0, Number(current?.activeCell) || 0), layout - 1);
      const cells = Array.from({ length: 4 }, (_, cellIndex) => current?.cells?.[cellIndex] || {});
      const active = cells[index] || {};
      if (sameIndicators(active.indicators, indicators)) return current;
      cells[index] = { ...active, indicators: cloneIndicators(indicators) };
      return { ...current, cells };
    });
  }, [indicators]);

  const activeChartIndex = Math.min(Math.max(0, Number(multiChart?.activeCell) || 0), Math.max(0, Number(multiChart?.layout || 1) - 1));
  const activeChartTimeframe = multiChart?.cells?.[activeChartIndex]?.timeframe || timeframe;
  const chartLayout = [1, 2, 4].includes(Number(multiChart?.layout)) ? Number(multiChart.layout) : 1;
  const chartLinked = multiChart?.linked === true;

  const setChartLayout = layout => {
    const nextIndex = Math.min(Number(multiChart?.activeCell) || 0, layout - 1);
    const nextIndicators = multiChart?.cells?.[nextIndex]?.indicators;
    if (Array.isArray(nextIndicators) && !sameIndicators(nextIndicators, indicators)) {
      onIndicatorsChange(cloneIndicators(nextIndicators));
    }
    setMultiChart(current => ({
      ...current,
      layout,
      activeCell: Math.min(Number(current?.activeCell) || 0, layout - 1),
    }));
    setChartMenuOpen(false);
  };

  const toggleChartLink = () => setMultiChart(current => ({ ...current, linked: !current?.linked }));

  const applyActiveIndicatorsToAllCharts = () => {
    setMultiChart(current => ({
      ...current,
      cells: Array.from({ length: 4 }, (_, index) => ({
        ...(current?.cells?.[index] || {}),
        indicators: cloneIndicators(indicators),
      })),
    }));
    setNotice('Active chart indicators copied to all chart cells');
    setChartMenuOpen(false);
  };

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
  const sidebarRailWidth = 48;
  const sidebarContentWidth = positionsExpanded || desktopLayout.sidebarCollapsed ? 0 : desktopLayout.sidebarWidth;
  const sidebarWidth = sidebarContentWidth + sidebarRailWidth;
  const marketPanelOpen = activeNav === 'watchlist' || activeNav === 'markets';
  const marketBounds = desktopMarketPanelBounds(viewportWidth, sidebarContentWidth);
  const collapsedDockHeight = 52;
  const expandedChartStripHeight = 118;
  const expandedDockHeight = Math.max(260, viewportHeight - 56 - 24 - expandedChartStripHeight);
  const dockHeight = positionsExpanded
    ? expandedDockHeight
    : desktopLayout.dockCollapsed
      ? collapsedDockHeight
      : desktopLayout.dockHeight;
  const updateSidebarWidth = value => setDesktopLayout(current => {
    const nextSidebar = clamp(value, widthBounds.sidebarMin, widthBounds.sidebarMax);
    const nextMarketBounds = desktopMarketPanelBounds(viewportWidth, nextSidebar);
    return {
      ...current,
      sidebarWidth: nextSidebar,
      sidebarCollapsed: false,
      marketPanelWidth: clamp(current.marketPanelWidth || nextMarketBounds.defaultPanel, nextMarketBounds.panelMin, nextMarketBounds.panelMax),
    };
  });
  const updateDockHeight = value => setDesktopLayout(current => {
    const bounds = desktopHeightBounds(viewportHeight, false, value);
    const nextDock = clamp(value, bounds.dockMin, bounds.dockMax);
    return { ...current, dockHeight: nextDock, dockCollapsed: false };
  });
  const toggleSidebar = () => setDesktopLayout(current => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed }));
  const openSidebarView = view => {
    setDesktopLayout(current => ({ ...current, sidebarCollapsed: false }));
    setSelectedPositionId(null);
    setPositionEditRequest(null);
    setActiveNav(view === 'markets' || view === 'watchlist' ? view : 'trade');
  };
  const toggleDock = () => {
    if (positionsExpanded) setPositionsExpanded(false);
    setDesktopLayout(current => ({ ...current, dockCollapsed: !current.dockCollapsed }));
  };
  const togglePositionsExpanded = () => {
    setDesktopLayout(current => ({ ...current, dockCollapsed: false }));
    setPositionsExpanded(value => !value);
  };
  const resetDesktopLayout = () => {
    const bounds = desktopHeightBounds(window.innerHeight);
    setDesktopLayout({
      sidebarWidth: desktopWidthBounds(window.innerWidth).defaultSidebar,
      dockHeight: bounds.defaultDock,
      sidebarCollapsed: false,
      dockCollapsed: false,
      marketPanelWidth: desktopMarketPanelBounds(window.innerWidth, desktopWidthBounds(window.innerWidth).defaultSidebar).defaultPanel,
      watchlistHeight: bounds.defaultWatchlist,
    });
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
        marketPanelWidth: clamp(
          layout.marketPanelWidth ?? current.marketPanelWidth ?? marketBounds.defaultPanel,
          marketBounds.panelMin,
          marketBounds.panelMax,
        ),
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
    if (trading.multiChart && typeof trading.multiChart === 'object') {
      const incoming = trading.multiChart;
      const layoutCount = [1, 2, 4].includes(Number(incoming.layout)) ? Number(incoming.layout) : 1;
      const incomingActive = Math.min(Math.max(0, Number(incoming.activeCell) || 0), layoutCount - 1);
      const fallbackIndicators = Array.isArray(trading.indicators) ? trading.indicators : indicators;
      const normalized = {
        ...incoming,
        layout: layoutCount,
        activeCell: incomingActive,
        cells: Array.from({ length: 4 }, (_, index) => ({
          ...(multiChart?.cells?.[index] || {}),
          ...(incoming.cells?.[index] || {}),
          indicators: cloneIndicators(
            Array.isArray(incoming.cells?.[index]?.indicators)
              ? incoming.cells[index].indicators
              : fallbackIndicators,
          ),
        })),
      };
      setMultiChart(normalized);
      onIndicatorsChange(cloneIndicators(normalized.cells[incomingActive]?.indicators || fallbackIndicators));
    } else if (Array.isArray(trading.indicators)) {
      onIndicatorsChange(cloneIndicators(trading.indicators));
    }
    setNotice(`${workspace.name || 'Workspace'} applied`);
  };

  const currency = account?.currency || 'USD';
  const accountPnl = Number(account?.floatingPnl ?? (Number(account?.equity) - Number(account?.balance)));
  const valuationStatus = String(account?.valuationStatus || 'WAITING').toUpperCase();
  const accountStatus = String(account?.status || 'UNKNOWN').toUpperCase();
  const canOpen = exposureAllowed && executableMarket(market) && accountStatus === 'ACTIVE' && account?.tradingEnabled === true && valuationStatus === 'LIVE';
  const firstPositive = (...values) => {
    for (const value of values) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) return numeric;
    }
    return null;
  };
  const resolved24hStats = market24hStats.symbol === activeSymbol ? market24hStats : { high: null, low: null, volume: null };
  const marketHigh = firstPositive(resolved24hStats.high, tick?.dayHigh, tick?.high24h, tick?.sessionHigh, market?.dayHigh, market?.high24h, market?.sessionHigh);
  const marketLow = firstPositive(resolved24hStats.low, tick?.dayLow, tick?.low24h, tick?.sessionLow, market?.dayLow, market?.low24h, market?.sessionLow);
  const marketVolume = firstPositive(resolved24hStats.volume, tick?.dayVolume, tick?.volume24h, tick?.sessionVolume, market?.dayVolume, market?.volume24h, market?.sessionVolume);
  const formatMarketVolume = value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return new Intl.NumberFormat('en-US', {
      notation: numeric >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: 2,
    }).format(numeric);
  };

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

  const openMarketPanel = (mode = 'markets', focusSearch = false) => {
    setDesktopLayout(current => ({ ...current, sidebarCollapsed: false }));
    setSelectedPositionId(null);
    setPositionEditRequest(null);
    setActiveNav(mode === 'watchlist' ? 'watchlist' : 'markets');
    if (focusSearch) window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const handleNav = id => {
    if (id === 'more') {
      onOpenSettings();
      return;
    }
    if (id === 'history') {
      setActiveNav('trade');
      setRequestedDockTab('history');
      setDesktopLayout(current => ({ ...current, dockCollapsed: false }));
      return;
    }
    if (id === 'watchlist' || id === 'markets') {
      setActiveNav(current => current === id ? 'trade' : id);
      return;
    }
    setActiveNav('trade');
  };

  const editPositionProtection = (positionId, field) => {
    selectPosition(positionId);
    setPositionEditRequest(current => ({
      positionId: String(positionId),
      field,
      nonce: Number(current?.nonce || 0) + 1,
    }));
  };

  return (
    <div ref={shellRef} className="acg-terminal relative flex h-dvh min-h-0 flex-col gap-2 overflow-hidden bg-black p-2 text-[#E6EDF3]">
      {notice && <div className="absolute right-3 top-[66px] z-[120] flex max-w-[390px] items-center gap-3 rounded-md border border-white/[0.06] bg-[#101010]/95 px-3 py-2.5 text-[10px] font-semibold text-[#E6EDF3] shadow-[0_16px_48px_rgba(0,0,0,.45)]"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="grid size-6 place-items-center rounded-md text-[#8094a7]"><X size={13}/></button></div>}


      <header className="acg-desktop-market-strip flex h-[56px] w-full min-w-0 shrink-0 items-center overflow-visible rounded-[14px] border border-white/[0.07] bg-[#0A0C0F] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_8px_24px_rgba(0,0,0,.24)]">
        <div className="flex min-w-[178px] items-center gap-2.5 text-left 2xl:min-w-[210px]">
          <button type="button" onClick={() => openMarketPanel('markets', false)} className="shrink-0" title="Open markets and watchlist" aria-label="Open markets and watchlist">
            <InstrumentAvatar instrument={market} size={30}/>
          </button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <button type="button" onClick={() => openMarketPanel('markets', false)} className="flex min-w-0 items-center gap-1 text-left" title="Open markets and watchlist">
                <strong className="truncate text-[14px] font-extrabold tracking-[-0.025em] text-[#f3f6f8]">{market?.displaySymbol || displaySymbol(market?.symbol)}</strong>
                <ChevronDown size={12} className="shrink-0 text-[#f3f6f8]"/>
              </button>
              <button
                type="button"
                onClick={() => watchlists?.toggleSymbol?.(activeSymbol)}
                className={favorite ? "grid size-5 shrink-0 place-items-center rounded text-[#f6c95d] hover:bg-white/[0.05]" : "grid size-5 shrink-0 place-items-center rounded text-[#71808e] hover:bg-white/[0.05] hover:text-white"}
                title={favorite ? "Remove from favorites" : "Add to favorites"}
                aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star size={12} fill={favorite ? 'currentColor' : 'none'}/>
              </button>
            </div>
            <button type="button" onClick={() => openMarketPanel('markets', false)} className="mt-0.5 flex min-w-0 items-center gap-1.5 text-left text-[8px] font-bold text-[#697988]" title="Open markets and watchlist">
              <span className="truncate">{marketLabel(market)}</span>
              <span className="shrink-0 text-[#697988]">
                {market?.sessionOpen === false || String(market?.marketState || '').toUpperCase() === 'CLOSED' ? 'MARKET CLOSED' : 'MARKET OPEN'}
              </span>
            </button>
          </div>
        </div>
        <div className="acg-desktop-chart-toolbar flex min-w-0 shrink-0 items-center border-l border-white/[0.06] bg-transparent px-2.5">
          <div className="terminal-toolbar-group flex h-9 min-w-0 shrink-0 items-center overflow-x-auto rounded-[12px] border border-white/[0.09] bg-[#080808] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.015)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {timeframes.map(([label, value]) => (
              <button key={value} type="button" onClick={() => setDesktopTimeframe(value)} disabled={Boolean(tradePlan && !tradePlan.open)} className={activeChartTimeframe === value ? "relative grid h-full min-w-9 place-items-center px-2 text-[10px] font-bold text-[#f2f2f2] transition" : "relative grid h-full min-w-9 place-items-center px-2 text-[10px] font-bold text-[#8f9aa8] transition hover:text-[#e9edf3]"}>{label}{activeChartTimeframe === value && <span className="absolute bottom-0 left-[18%] right-[18%] h-[2px] rounded-full bg-[#195be1]" aria-hidden="true"/>}</button>
            ))}
          </div>
          <div className="ml-1.5 flex h-full shrink-0 items-center gap-1.5">
            <div className="relative">
              <button type="button" onClick={() => setChartMenuOpen(value => !value)} className={chartMenuOpen ? "flex h-7 items-center gap-1.5 rounded-md border border-[#195be1]/60 bg-[#14171b] px-2.5 text-[8px] font-semibold text-[#f1f4f6]" : "flex h-7 items-center gap-1.5 rounded-md border border-white/[0.06] px-2.5 text-[8px] font-semibold text-[#8996a1] hover:text-white"} title="Chart settings"><CandlestickChart size={12}/><span>Charts</span><ChevronDown size={10}/></button>
              {chartMenuOpen && (
                <div className="absolute right-0 top-8 z-[100] w-[205px] rounded-md border border-white/[0.10] bg-[#0C1013] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
                  <div className="px-2 pb-1 pt-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[#5f6d79]">Chart type</div>
                  <button type="button" onClick={() => { onChartModeChange('candles'); setChartMenuOpen(false); }} className={chartMode === 'candles' ? "flex w-full items-center gap-2 rounded bg-[#15181d] px-2 py-2 text-left text-[8px] font-semibold text-[#195be1]" : "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><CandlestickChart size={12}/>Candlesticks</button>
                  <button type="button" onClick={() => { onChartModeChange('line'); setChartMenuOpen(false); }} className={chartMode === 'line' ? "flex w-full items-center gap-2 rounded bg-[#15181d] px-2 py-2 text-left text-[8px] font-semibold text-[#195be1]" : "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><ChartNoAxesCombined size={12}/>Line</button>
                  <div className="my-1 border-t border-white/[0.06]"/>
                  <div className="px-2 pb-1 pt-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[#5f6d79]">Chart grid</div>
                  {[[1, Square, 'Single chart'], [2, Columns2, 'Two charts'], [4, Grid2X2, 'Four charts']].map(([value, Icon, label]) => (
                    <button key={value} type="button" onClick={() => setChartLayout(value)} className={chartLayout === value ? "flex w-full items-center gap-2 rounded bg-[#15181d] px-2 py-2 text-left text-[8px] font-semibold text-[#195be1]" : "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><Icon size={12}/>{label}</button>
                  ))}
                  {chartLayout > 1 && <>
                    <div className="my-1 border-t border-white/[0.06]"/>
                    <button type="button" onClick={toggleChartLink} className={chartLinked ? "flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#195be1] hover:bg-white/[0.03]" : "flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><span className="flex items-center gap-2">{chartLinked ? <Link2 size={12}/> : <Link2Off size={12}/>}Link symbols</span><span className="text-[#6F8191]">{chartLinked ? 'On' : 'Off'}</span></button>
                    <button type="button" onClick={applyActiveIndicatorsToAllCharts} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><span>Copy indicators to all</span><span className="text-[#6F8191]">ƒx {indicators.length}</span></button>
                  </>}
                </div>
              )}
            </div>
            <div className="relative">
              <button type="button" onClick={() => { setIndicatorFocusId(null); setObjectManagerOpen(false); setIndicatorPanelOpen(value => !value); }} className={indicatorPanelOpen ? "flex h-7 items-center gap-1.5 rounded-md border border-[#195be1]/60 bg-[#14171b] px-2.5 text-[8px] font-semibold text-[#f1f4f6]" : "flex h-7 items-center gap-1.5 rounded-md border border-white/[0.06] px-2.5 text-[8px] font-semibold text-[#8996a1] hover:text-white"} title="Indicators"><span className="text-[11px] font-black">ƒx</span><span>Indicators</span>{indicators.length > 0 && <span className="grid min-w-3 place-items-center rounded bg-[#181b20] px-1 text-[6px] text-[#aab5bf]">{indicators.length}</span>}<ChevronDown size={10}/></button>
              {indicatorPanelOpen && (
                <div className="absolute right-0 top-8 z-[110] w-[390px] max-h-[min(680px,calc(100dvh-150px))] overflow-y-auto rounded-lg border border-white/[0.10] bg-[#0B0D0F]/98 p-3 shadow-[0_24px_70px_rgba(0,0,0,.68)] backdrop-blur-xl [scrollbar-width:thin]">
                  <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-2.5"><div><strong className="block text-[11px] text-[#EDF3F7]">Indicators</strong><span className="mt-0.5 block text-[8px] text-[#687D91]">Active chart · {activeSymbol} · {activeChartTimeframe}</span></div><button type="button" onClick={() => setIndicatorPanelOpen(false)} className="grid size-7 place-items-center rounded text-[#7D91A4] hover:bg-white/[0.04] hover:text-white"><X size={13}/></button></div>
                  <IndicatorManager desktop applied={indicators} favorites={indicatorFavorites} onAdd={onAddIndicator} onRemove={onRemoveIndicator} onToggleVisible={onToggleIndicator} onUpdate={onUpdateIndicator} onToggleFavorite={onToggleIndicatorFavorite} focusInstanceId={indicatorFocusId}/>
                </div>
              )}
            </div>
            <DesktopWorkspaceMenu snapshot={workspaceSnapshot} onApply={applyWorkspace}/>
          </div>
        </div>

        {viewportWidth >= 1500 && (
          <div className="ml-2 flex h-full items-center">
            <div className="min-w-[92px] border-l border-white/[0.055] px-3">
              <span className="block text-[7px] uppercase tracking-[0.07em] text-[#637484]">24h High</span>
              <strong className="mt-1 block font-mono text-[9px] font-bold text-[#cdd7df]">{marketHigh == null ? '—' : formatInstrumentPrice(marketHigh, market)}</strong>
            </div>
            <div className="min-w-[92px] border-l border-white/[0.055] px-3">
              <span className="block text-[7px] uppercase tracking-[0.07em] text-[#637484]">24h Low</span>
              <strong className="mt-1 block font-mono text-[9px] font-bold text-[#cdd7df]">{marketLow == null ? '—' : formatInstrumentPrice(marketLow, market)}</strong>
            </div>
            {marketVolume != null && (
              <div className="min-w-[92px] border-l border-white/[0.055] px-3">
                <span className="block text-[7px] uppercase tracking-[0.07em] text-[#637484]">24h Volume</span>
                <strong className="mt-1 block font-mono text-[9px] font-bold text-[#cdd7df]">{formatMarketVolume(marketVolume)}</strong>
              </div>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {readOnly && <span className="hidden rounded-md border border-rose-400/20 bg-rose-400/[0.08] px-2 py-1 text-[7px] font-black uppercase tracking-[0.09em] text-rose-300 2xl:inline-flex">Read-only · Breached</span>}
          <div className="hidden text-right 2xl:block">
            <span className="block text-[7px] uppercase tracking-[0.08em] text-[#637484]">Valuation</span>
            <b className={valuationStatus === 'LIVE' ? "mt-0.5 block text-[8px] text-[#42D7A1]" : valuationStatus === 'STALE' ? "mt-0.5 block text-[8px] text-[#E7BD58]" : "mt-0.5 block text-[8px] text-[#A1AFBC]"}>{valuationStatus}</b>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setAccountMenuOpen(value => !value)} className="flex h-8 min-w-[176px] items-center gap-2 rounded-md border border-white/[0.07] bg-black/20 px-2.5 text-left hover:bg-white/[0.025]" aria-label="Switch trading account" aria-expanded={accountMenuOpen}>
              {accountSwitching ? <Loader2 size={11} className="shrink-0 animate-spin text-[#195be1]"/> : <span className={canOpen ? "size-1.5 shrink-0 rounded-full bg-[#2fd9a0]" : valuationStatus === 'STALE' ? "size-1.5 shrink-0 rounded-full bg-[#e8bd55]" : "size-1.5 shrink-0 rounded-full bg-[#343434]"}/>}
              <div className="min-w-0 flex-1 leading-none">
                <strong className="block truncate text-[9px]">{account?.accountCode || accountStatus}</strong>
                <span className="mt-1 block truncate text-[8px] text-[#6F8191]">{accountTypeBadge(account)} · {currency}{Number(account?.leverage) > 0 ? ` · 1:${Number(account.leverage)}` : ''}</span>
              </div>
              <ChevronDown size={11} className={accountMenuOpen ? "shrink-0 rotate-180 text-[#6F8191] transition" : "shrink-0 text-[#6F8191] transition"}/>
            </button>
            {accountMenuOpen && (
              <div className="absolute right-0 top-10 z-[140] w-[330px] overflow-hidden rounded-md border border-white/[0.10] bg-[#0C1013] shadow-[0_20px_60px_rgba(0,0,0,.65)]">
                <div className="border-b border-white/[0.07] px-3 py-2.5">
                  <strong className="block text-[10px] text-[#E6EDF3]">Trading accounts</strong>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[8px] text-[#6F8191]">
                    <span>Balance <b className="ml-1 text-[#C7D1D9]">{money(account?.balance, currency)}</b></span>
                    <span>Equity <b className="ml-1 text-[#C7D1D9]">{money(account?.equity, currency)}</b></span>
                    <span>P/L <b className={accountPnl >= 0 ? "ml-1 text-[#42D7A1]" : "ml-1 text-[#FF5968]"}>{formatPnl(accountPnl, currency)}</b></span>
                    <span>Free <b className="ml-1 text-[#C7D1D9]">{money(account?.freeMargin, currency)}</b></span>
                  </div>
                  <span className="mt-2 block text-[8px] leading-4 text-[#6F8191]">Execution stays locked until the selected account has a fresh snapshot and history.</span>
                </div>
                {accountSwitchError && <div className="border-b border-[#553038] bg-[#190d10] px-3 py-2 text-[8px] font-semibold text-[#e99aa3]">{accountSwitchError} · Select the account again to retry.</div>}
                <div className="max-h-[420px] overflow-y-auto [scrollbar-width:thin]">
                  {groupedAccounts.map(group => (
                    <div key={group.id}>
                      <div className="border-b border-white/[0.05] bg-black/25 px-3 py-1.5 text-[7px] font-black uppercase tracking-[0.10em] text-[#53616c]">{group.label}</div>
                      {group.items.map(item => {
                        const id = String(item.id);
                        const selected = id === String(activeAccountId || '');
                        const itemStatus = String(item.status || 'UNKNOWN').toUpperCase();
                        const phase = item?.challenge?.phase ? 'Phase ' + item.challenge.phase : null;
                        return (
                          <button key={id} type="button" disabled={accountSwitching && !selected} onClick={() => {
                            try {
                              const changed = onSelectAccount(id);
                              if (changed !== false) setAccountMenuOpen(false);
                            } catch (error) {
                              setNotice(error?.message || 'Unable to switch account');
                            }
                          }} className={selected ? "flex w-full items-center gap-3 border-b border-white/[0.06] bg-white/[0.045] px-3 py-3 text-left disabled:cursor-wait disabled:opacity-45" : "flex w-full items-center gap-3 border-b border-white/[0.06] px-3 py-3 text-left hover:bg-white/[0.025] disabled:cursor-wait disabled:opacity-45"}>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <strong className="truncate text-[10px] text-[#E6EDF3]">{item.accountCode || 'Trading account'}</strong>
                                <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.06em] text-[#9fb0bd]">{accountTypeBadge(item)}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-[8px] text-[#6F8191]">
                                <span className="font-bold text-[#A1AFBC]">{accountSize(item.initialBalance, item.currency || 'USD')}</span>
                                {phase && <><span>·</span><span>{phase}</span></>}<span>·</span><span>{accountStatusLabel(itemStatus)}</span>
                              </div>
                              <span className="mt-0.5 block text-[7px] text-[#556572]">Equity {money(item.equity, item.currency || 'USD')}</span>
                            </div>
                            {selected && (accountSwitching ? <Loader2 size={13} className="shrink-0 animate-spin text-[#195be1]"/> : <Check size={13} className="shrink-0 text-[#195be1]"/>)}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {!groupedAccounts.length && <div className="px-3 py-4 text-center text-[8px] text-[#6F8191]">No trading accounts are available.</div>}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" onClick={() => setToolsMenuOpen(value => !value)} className={toolsMenuOpen ? "grid size-8 place-items-center rounded-md border border-[#195be1]/60 bg-[#14171b] text-[#f1f4f6]" : "grid size-8 place-items-center rounded-md border border-white/[0.07] bg-black/20 text-[#8996a1] hover:bg-white/[0.025] hover:text-white"} title="More" aria-label="More terminal actions"><MoreHorizontal size={16}/></button>
            {toolsMenuOpen && (
              <div className="absolute right-0 top-10 z-[105] w-[230px] rounded-md border border-white/[0.10] bg-[#0C1013] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
                <button type="button" onClick={() => { handleNav('markets'); setToolsMenuOpen(false); }} className={activeNav === 'markets' ? "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#195be1]" : "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><List size={12}/>Markets / Watchlist</button>
                <button type="button" onClick={() => { handleNav('history'); setToolsMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><History size={12}/>History</button>
                <button type="button" onClick={() => { setReviewOpen(true); setToolsMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><BookOpen size={12}/>Trade review</button>
                <button type="button" onClick={() => { setIndicatorPanelOpen(false); setObjectManagerOpen(value => !value); setToolsMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><Layers3 size={12}/>Chart manager</button>
                <button type="button" onClick={() => { void toggleFullscreen(); setToolsMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><Maximize2 size={12}/>Fullscreen</button>
                <div className="my-1 border-t border-white/[0.06]"/>
                <button type="button" onClick={() => { toggleSidebar(); setToolsMenuOpen(false); }} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><span>Side panel</span><span className="text-[#6F8191]">{desktopLayout.sidebarCollapsed ? 'Closed' : 'Open'}</span></button>
                <button type="button" onClick={() => { toggleDock(); setToolsMenuOpen(false); }} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><span>Positions dock</span><span className="text-[#6F8191]">{desktopLayout.dockCollapsed ? 'Hidden' : 'Shown'}</span></button>
                <button type="button" onClick={() => { resetDesktopLayout(); setToolsMenuOpen(false); }} className="w-full rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]">Reset desktop layout</button>
                <div className="my-1 border-t border-white/[0.06]"/>
                <button type="button" onClick={() => { onOpenSettings(); setToolsMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><Settings size={12}/>Settings</button>
              </div>
            )}
            {objectManagerOpen && <div className="absolute right-0 top-10 z-[115]"><ChartObjectManager symbol={activeSymbol} timeframe={activeChartTimeframe === '1m' ? 'M1' : activeChartTimeframe === '5m' ? 'M5' : activeChartTimeframe === '15m' ? 'M15' : activeChartTimeframe === '30m' ? 'M30' : activeChartTimeframe === '1H' ? 'H1' : activeChartTimeframe === '4H' ? 'H4' : activeChartTimeframe === '1D' ? 'D1' : activeChartTimeframe === '1W' ? 'W1' : activeChartTimeframe} indicators={indicators} chartInstanceId={'desktop-chart-' + Math.min(Math.max(0, Number(multiChart?.activeCell) || 0), chartLayout - 1)} onToggleIndicator={onToggleIndicator} onRemoveIndicator={onRemoveIndicator} onOpenIndicatorSettings={instanceId => { setObjectManagerOpen(false); setIndicatorFocusId(instanceId); setIndicatorPanelOpen(true); }} onClose={() => setObjectManagerOpen(false)}/></div>}
          </div>
        </div>
      </header>


      <div className="min-h-0 flex-1">
        <div
          className="relative grid h-full min-h-0 min-w-0 gap-x-2 gap-y-2 bg-black transition-[grid-template-columns,grid-template-rows] duration-300 ease-out"
          style={{
            gridTemplateColumns: `minmax(0, 1fr) ${sidebarContentWidth}px ${sidebarRailWidth}px`,
            gridTemplateRows: `minmax(0, 1fr) ${dockHeight}px`,
          }}
        >
          <section className="grid min-h-0 min-w-0 overflow-hidden rounded-[16px] border border-white/[0.06] bg-[#080A0C] shadow-[inset_0_1px_0_rgba(255,255,255,0.015),0_12px_30px_rgba(0,0,0,.22)] grid-rows-[minmax(0,1fr)]" style={{ gridColumn: '1', gridRow: '1' }}>
            <div className="min-h-0 min-w-0 bg-[#080A0C] p-1.5">
              <DesktopMultiChart
                config={multiChart}
                onChange={setMultiChart}
                markets={markets}
                activeSymbol={activeSymbol}
                onSelectSymbol={onSelectSymbol}
                indicators={indicators}
                onActiveIndicatorsChange={nextIndicators => {
                  if (!sameIndicators(nextIndicators, indicators)) onIndicatorsChange(cloneIndicators(nextIndicators));
                }}
                onToggleIndicator={onToggleIndicator}
                onOpenIndicatorSettings={instanceId => {
                  setObjectManagerOpen(false);
                  setIndicatorFocusId(instanceId);
                  setIndicatorPanelOpen(true);
                }}
                onRemoveIndicator={onRemoveIndicator}
                positions={positions}
                pendingOrders={pendingOrders}
                onModifyPending={onModifyPending}
                onCancelPending={onCancelPending}
                selectedTool={selectedTool}
                onSelectedToolChange={onSelectedToolChange}
                chartMode={chartMode}
                onActiveTimeframeChange={onTimeframeChange}
                tradePlan={tradePlan}
                tradePlanLots={lots}
                accountCurrency={account?.currency || 'USD'}
                account={account}
                riskPercent={riskPercent}
                onCreateRiskOrder={onCreateRiskOrder}
                onTradePlanChange={onTradePlanChange}
                onUpdatePosition={onUpdatePosition}
                selectedPositionId={selectedPositionId}
                onSelectPosition={selectPosition}
                onClosePosition={onClosePosition}
              />
            </div>
          </section>

          {!desktopLayout.sidebarCollapsed && !positionsExpanded && (
            <aside className="relative flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#0A0C0F] shadow-[inset_0_1px_0_rgba(255,255,255,0.018),0_12px_30px_rgba(0,0,0,.22)]" style={{ gridColumn: '2', gridRow: '1' }}>
              {marketPanelOpen ? (
                <div className="min-h-0 flex-1">
                  <DesktopWatchlist
                    markets={markets}
                    activeSymbol={activeSymbol}
                    onSelectSymbol={onSelectSymbol}
                    watchlists={watchlists}
                    mode={activeNav === 'markets' ? 'markets' : 'watchlist'}
                    onModeChange={mode => openMarketPanel(mode, false)}
                    onClose={() => setDesktopLayout(current => ({ ...current, sidebarCollapsed: true }))}
                    searchRef={searchRef}
                    onNotice={setNotice}
                  />
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1">
                    <DesktopOrderTicket key={`order-ticket-${account?.id || 'none'}`} market={market} markets={markets} account={account} positions={positions} positionHistory={positionHistory} exposureAllowed={exposureAllowed} exposureBlockReason={exposureBlockReason} lots={lots} onLotsChange={onLotsChange} sizingMode={sizingMode} onSizingModeChange={onSizingModeChange} riskPercent={riskPercent} onRiskPercentChange={onRiskPercentChange} orderType={orderType} onOrderTypeChange={onOrderTypeChange} tradePlan={tradePlan} onStartPlan={onStartPlan} onCancelPlan={onCancelPlan} onExecutePlan={onExecutePlan} onModifyPlan={onModifyPlan} onManualOrder={submitOneClick} onTradePlanChange={onTradePlanChange} riskGuardSettings={riskGuardSettings} onRiskGuardSettingsChange={onRiskGuardSettingsChange}/>
                  </div>
                  {selectedPosition && (
                    <div className="max-h-[46%] shrink-0 overflow-y-auto [scrollbar-width:thin]">
                      <DesktopPositionManager
                        position={selectedPosition}
                        instrument={markets.find(item => item.symbol === selectedPosition.symbol) || market}
                        account={account}
                        editRequest={positionEditRequest && String(positionEditRequest.positionId) === String(selectedPosition.id) ? positionEditRequest : null}
                        onClose={onClosePosition}
                        onBreakEven={onBreakEven}
                        onUpdate={onUpdatePosition}
                        onSetTrailing={onSetTrailing}
                        onDismiss={() => { setSelectedPositionId(null); setPositionEditRequest(null); }}
                      />
                    </div>
                  )}
                </>
              )}
            </aside>
          )}

          <aside className="flex min-h-0 flex-col items-center overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#0A0C0F] py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.018),0_12px_30px_rgba(0,0,0,.22)]" style={{ gridColumn: '3', gridRow: '1' }} aria-label="Desktop panel dock">
            <button
              type="button"
              onClick={() => {
                if (!desktopLayout.sidebarCollapsed && activeNav === 'trade') toggleSidebar();
                else openSidebarView('trade');
              }}
              className={!desktopLayout.sidebarCollapsed && activeNav === 'trade'
                ? "mb-1 grid size-9 place-items-center rounded-md bg-[#111820] text-[#195be1] ring-1 ring-inset ring-[#195be1]/70"
                : "mb-1 grid size-9 place-items-center rounded-md text-[#7F8D99] hover:bg-white/[0.04] hover:text-white"}
              title="Trade"
              aria-label="Trade"
            >
              <ChartNoAxesCombined size={17}/>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!desktopLayout.sidebarCollapsed && activeNav === 'markets') toggleSidebar();
                else openSidebarView('markets');
              }}
              className={!desktopLayout.sidebarCollapsed && activeNav === 'markets'
                ? "mb-1 grid size-9 place-items-center rounded-md bg-[#111820] text-[#195be1] ring-1 ring-inset ring-[#195be1]/70"
                : "mb-1 grid size-9 place-items-center rounded-md text-[#7F8D99] hover:bg-white/[0.04] hover:text-white"}
              title="Markets"
              aria-label="Markets"
            >
              <List size={17}/>
            </button>
            <button
              type="button"
              onClick={toggleDock}
              className={!desktopLayout.dockCollapsed
                ? "mb-1 grid size-9 place-items-center rounded-md bg-[#111820] text-[#195be1] ring-1 ring-inset ring-[#195be1]/70"
                : "mb-1 grid size-9 place-items-center rounded-md text-[#7F8D99] hover:bg-white/[0.04] hover:text-white"}
              title={desktopLayout.dockCollapsed ? "Open positions dock" : "Close positions dock"}
              aria-label={desktopLayout.dockCollapsed ? "Open positions dock" : "Close positions dock"}
            >
              <Layers3 size={17}/>
            </button>
          </aside>

          <div className="min-h-0 overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#0A0C0F] shadow-[inset_0_1px_0_rgba(255,255,255,0.018),0_12px_30px_rgba(0,0,0,.22)] transition-[height,transform,opacity] duration-300 ease-out" style={{ gridColumn: '1 / 4', gridRow: '2' }}>
            <PositionsPanel desktopDense collapsed={desktopLayout.dockCollapsed} expanded={positionsExpanded} onToggleExpanded={togglePositionsExpanded} requestedTab={requestedDockTab} activeSymbol={activeSymbol} account={account} positions={positions} markets={markets} positionHistory={positionHistory} pendingOrders={pendingOrders} journal={journal} onClosePosition={onClosePosition} onCloseAll={onCloseAllPositions} onCloseWinners={onCloseWinners} onCloseLosers={onCloseLosers} onCloseSymbol={onCloseSymbolPositions} onBreakEven={onBreakEven} onReverse={onReversePosition} onUpdatePosition={onUpdatePosition} onSetTrailing={onSetTrailing} onDuplicate={onDuplicatePosition} onCancelPending={onCancelPending} onModifyPending={onModifyPending} selectedPositionId={selectedPositionId} onSelectPosition={selectPosition} onEditProtection={editPositionProtection}/>
          </div>

          {!desktopLayout.sidebarCollapsed && !positionsExpanded && (
            <ResizeHandle
              axis="x"
              value={desktopLayout.sidebarWidth}
              min={widthBounds.sidebarMin}
              max={widthBounds.sidebarMax}
              deltaMultiplier={-1}
              onChange={updateSidebarWidth}
              ariaLabel="Resize trade dock"
              className="absolute bottom-0 top-0"
              style={{ right: sidebarContentWidth + sidebarRailWidth + 10 }}
            />
          )}

          {!desktopLayout.dockCollapsed && !positionsExpanded && (
            <ResizeHandle
              axis="y"
              value={desktopLayout.dockHeight}
              min={heightBounds.dockMin}
              max={heightBounds.dockMax}
              deltaMultiplier={-1}
              onChange={updateDockHeight}
              onDoubleClick={() => updateDockHeight(heightBounds.defaultDock)}
              ariaLabel="Resize chart and positions dock"
              className="absolute left-0 right-0"
              style={{ bottom: dockHeight + 4 }}
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
