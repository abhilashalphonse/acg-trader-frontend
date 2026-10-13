import { CircleHelp } from 'lucide-react';
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
import DesktopOrderTicketV4 from './desktop/DesktopOrderTicketV4.jsx';
import DesktopManagePositionV4 from './desktop/DesktopManagePositionV4.jsx';
import DesktopManagePendingV4 from './desktop/DesktopManagePendingV4.jsx';
import './desktop/DesktopTerminal.theme.css';
import './desktop/DesktopHeaderV4.css';
import DesktopPositionManager from './desktop/DesktopPositionManager.jsx';
import DesktopMultiChart from './desktop/DesktopMultiChart.jsx';
import DesktopTradeReview from './desktop/DesktopTradeReview.jsx';
import DesktopWorkspaceMenu from './desktop/DesktopWorkspaceMenu.jsx';
import DesktopWatchlist from './desktop/DesktopWatchlist.jsx';
import DesktopChartSettingsPopover from './desktop/DesktopChartSettingsPopover.jsx';
import ChartObjectManager from './desktop/ChartObjectManager.jsx';
import ResizeHandle from './desktop/ResizeHandle.jsx';
import PositionsPanel from './PositionsPanel.jsx';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import IndicatorManager from './IndicatorManager.jsx';
import { accountStatusLabel, accountTypeBadge, accountTypeLabel } from '../../utils/accountPresentation.js';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
import { marketApi } from '../../api/market.js';
import { normalizeProtectionPrice } from '../../utils/tradingCommandNormalization.js';
import { effectiveTradePlan } from '../../utils/tradePlanExecution.js';
import { resolveExecutionPreview } from '../../utils/executionPricing.js';
import { validateOpenPositionProtection } from '../../utils/openPositionPresentation.js';
import { loadDesktopChartSettings, normalizeDesktopChartSettings, saveDesktopChartSettings } from '../../utils/desktopChartSettings.js';
import { isChartOrderAuditEnabled } from '../../utils/chartOrderPresentation.js';
import { v4HeaderMarketStatus, v4HeaderAccountLabel } from '../../utils/v4HeaderPresentation.js';

// Explicit opt-in only. Disabled in all existing builds unless configured.
// ACG V4 is an owner-initiated production audit, not a global ticket rollout.
 // The approved baseline may be inspected in the live site using
 // ?acg_v4_audit=1. Without BOTH the deployment flag and this opt-in,
 // every existing customer continues to receive the legacy execution ticket.
const V4_DESKTOP_EXECUTION_ENABLED = isChartOrderAuditEnabled(
  import.meta.env.VITE_ACG_EXECUTION_V4_ENABLED,
  typeof window !== 'undefined' ? window.location.search : '',
);

const timeframes = [['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'], ['1H', '1H'], ['4H', '4H'], ['1D', '1D'], ['1W', '1W']];

function normalizeDesktopTimeframe(value) {
  const raw = String(value || '');
  const aliases = { '1h': '1H', '4h': '4H', '1d': '1D', D: '1D', '1w': '1W' };
  const normalized = aliases[raw] || raw;
  return timeframes.some(([id]) => id === normalized) ? normalized : '1m';
}
const DESKTOP_LAYOUT_KEY = 'acg-trader-desktop-layout-v2';
const MULTI_CHART_KEY = 'acg-trader-multi-chart-v1';
const FLOATING_ORDER_KEY = 'acg-trader-floating-order-v1';

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
  const dockMin = 52;
  const dockMax = compact ? Math.min(320, Math.floor(height * 0.44)) : height <= 1050 ? Math.min(420, Math.floor(height * 0.46)) : Math.min(520, Math.floor(height * 0.48));
  const defaultDock = 52;
  const effectiveDock = dockCollapsed ? 0 : clamp(dockHeight || defaultDock, dockMin, dockMax);
  const upperWorkspaceHeight = Math.max(0, height - 48 - effectiveDock);

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
    sidebarCollapsed: true,
    dockCollapsed: false,
    marketPanelWidth: desktopMarketPanelBounds(viewportWidth, widthBounds.defaultSidebar).defaultPanel,
    watchlistHeight: initialBounds.defaultWatchlist,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(DESKTOP_LAYOUT_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    const dockCollapsed = stored.dockCollapsed === true;
    const storedDockHeight = Number(stored.dockHeight);
    const requestedDockHeight = Number.isFinite(storedDockHeight) && storedDockHeight > 72
      ? storedDockHeight
      : fallback.dockHeight;
    const dockHeight = clamp(requestedDockHeight, initialBounds.dockMin, initialBounds.dockMax);
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

function loadFloatingOrder() {
  const fallback = { x: 72, y: 18, collapsed: false };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(FLOATING_ORDER_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    return {
      x: Number.isFinite(Number(stored.x)) ? Math.max(8, Number(stored.x)) : fallback.x,
      y: Number.isFinite(Number(stored.y)) ? Math.max(8, Number(stored.y)) : fallback.y,
      collapsed: stored.collapsed === true,
    };
  } catch {
    return fallback;
  }
}

function cloneIndicators(items) {
  return Array.isArray(items) ? items.map(item => ({ ...item, settings: { ...(item.settings || {}) } })) : [];
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

function accountSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  if (numeric >= 1_000_000) return (numeric / 1_000_000).toFixed(numeric % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (numeric >= 1_000) return (numeric / 1_000).toFixed(numeric % 1_000 === 0 ? 0 : 1) + 'K';
  return numeric.toLocaleString('en-US');
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
  onViewportQuoteSymbolsChange = () => {},
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
  onMovePending = () => {},
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
  positionProtectionDraft = null,
  onPositionProtectionDraftChange = () => {},
  onBeginPositionProtection = () => false,
  onApplyPositionProtection = async () => false,
  onCancelPositionProtection = () => {},
  positionProtectionSaving = false,
  onOpenSettings = () => {},
  onOpenHelp = () => {},
  exposureAllowed = true,
  exposureBlockReason = 'New exposure is temporarily unavailable',
  executionCommandPending = false,
  riskGuardSettings = null,
  onRiskGuardSettingsChange = () => {},
  readOnly = false,
}) {
  // One authoritative preview for the chart, fixed ticket, and floating ticket.
  // Derive market entries from the same quote before position sizing.
  const orderExecutionPreview = React.useMemo(() => {
    if (!tradePlan || !market) return null;
    const previewPlan = effectiveTradePlan(tradePlan, market);
    return resolveExecutionPreview({
      plan: previewPlan,
      riskPercent,
      manualLots: previewPlan?.manualLots ?? lots,
      account,
      instrument: market,
    });
  }, [account, lots, market, riskPercent, tradePlan]);

  const shellRef = useRef(null);
  const chartWorkspaceRef = useRef(null);
  const floatingOrderRef = useRef(null);
  const searchRef = useRef(null);
  const [activeNav, setActiveNav] = useState('trade');
  const [notice, setNotice] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState(null);
  const [selectedPendingId,setSelectedPendingId]=useState(null);
  const [pendingOrderDraft,setPendingOrderDraft]=useState(null);
  const [positionEditRequest, setPositionEditRequest] = useState(null);
  const [requestedDockTab, setRequestedDockTab] = useState(null);
  const [positionsExpanded, setPositionsExpanded] = useState(false);
  const [desktopLayout, setDesktopLayout] = useState(loadDesktopLayout);
  const [floatingOrder, setFloatingOrder] = useState(loadFloatingOrder);
  const [viewportHeight, setViewportHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight : 900);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1440);
  const [market24hStats, setMarket24hStats] = useState({ symbol: null, high: null, low: null, volume: null });
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const [chartSettings, setChartSettings] = useState(loadDesktopChartSettings);
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const [indicatorFocusId, setIndicatorFocusId] = useState(null);
  const [objectManagerOpen, setObjectManagerOpen] = useState(false);
  // Single active desktop overlay in the V4 owner audit; legacy logic stays intact.
  const [v4HeaderMenu, setV4HeaderMenu] = useState(null);
  const v4IsOpen = (name, legacy) => V4_DESKTOP_EXECUTION_ENABLED ? v4HeaderMenu === name : legacy;
  const v4Toggle = (name, setter) => {
    if (V4_DESKTOP_EXECUTION_ENABLED) setV4HeaderMenu(previous => previous === name ? null : name);
    else setter(previous => !previous);
  };
  const v4Close = () => { if (V4_DESKTOP_EXECUTION_ENABLED) setV4HeaderMenu(null); };
  useEffect(() => {
    if (!V4_DESKTOP_EXECUTION_ENABLED || !v4HeaderMenu) return undefined;
    const keydown = event => { if (event.key === 'Escape') setV4HeaderMenu(null); };
    const pointerdown = event => {
      if (!event.target.closest('.acg-v4-header, [data-v4-chart-settings]')) setV4HeaderMenu(null);
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('pointerdown', pointerdown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('pointerdown', pointerdown);
    };
  }, [v4HeaderMenu]);
  const [multiChart, setMultiChart] = useState(() => loadMultiChart(activeSymbol, timeframe, indicators));
  const selectedPosition = positions.find(position => String(position?.id) === String(selectedPositionId)) || null;
  const selectedPending = pendingOrders.find(order=>String(order?.id??order?.orderId)===String(selectedPendingId) && ['PENDING','ACCEPTED','TRIGGERED'].includes(String(order?.status||'PENDING').toUpperCase())) || null;
  const lastManagedAccountId = useRef(activeAccountId);
  useEffect(() => {
    if (lastManagedAccountId.current === activeAccountId) return;
    lastManagedAccountId.current = activeAccountId;
    setSelectedPositionId(null);
    setSelectedPendingId(null);
    setPendingOrderDraft(null);
    setPositionEditRequest(null);
    onCancelPositionProtection();
  }, [activeAccountId]);
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
  useEffect(()=>{
    if(selectedPendingId!=null&&!pendingOrders.some(order=>String(order?.id??order?.orderId)===String(selectedPendingId)&&['PENDING','ACCEPTED','TRIGGERED'].includes(String(order?.status||'PENDING').toUpperCase()))){
      setSelectedPendingId(null);setPendingOrderDraft(null);
    }
  },[pendingOrders,selectedPendingId]);

  const selectPosition = positionOrId => {
    const id = typeof positionOrId === 'object' ? positionOrId?.id : positionOrId;
    if (id === null || id === undefined) {
      setSelectedPositionId(null);
      setPositionEditRequest(null);
      return;
    }
    const position = positions.find(item => String(item?.id) === String(id));
    if (!position) return;
    if (positionProtectionDraft && String(positionProtectionDraft.positionId) !== String(position.id)) {
      if (positionProtectionSaving) {
        setNotice('Wait for the current protection update before selecting another position.');
        return;
      }
      onCancelPositionProtection();
    }
    setSelectedPositionId(position.id);
    setSelectedPendingId(null);
    setPendingOrderDraft(null);
    setPositionEditRequest(null);
    // Chart and dock selection reveal the same Trade sidebar; a new position
    // never stacks a separate position drawer beneath the execution ticket.
    setActiveNav('trade');
    setDesktopLayout(current => ({ ...current, sidebarCollapsed:false }));
    if (position.symbol && position.symbol !== activeSymbol) onSelectSymbol(position.symbol);
  };

  const selectPending = orderOrId => {
    const id=typeof orderOrId==='object'?orderOrId?.id:orderOrId;
    if(id==null){setSelectedPendingId(null);setPendingOrderDraft(null);return;}
    const order=pendingOrders.find(item=>String(item?.id??item?.orderId)===String(id)&&['PENDING','ACCEPTED','TRIGGERED'].includes(String(item?.status||'PENDING').toUpperCase()));
    if(!order)return;
    if(positionProtectionSaving)return setNotice('Wait for the current protection save before switching orders.');
    setSelectedPendingId(order.id??order.orderId);
    setSelectedPositionId(null);
    setPendingOrderDraft(null);
    setPositionEditRequest(null);
    onCancelPositionProtection();
    setActiveNav('trade');
    setDesktopLayout(current=>({...current,sidebarCollapsed:false}));
    if(order.symbol&&order.symbol!==activeSymbol)onSelectSymbol(order.symbol);
  };
  const clearPendingDraft=()=>setPendingOrderDraft(null);

  const favorite = watchlists?.isWatched?.(activeSymbol) === true;

  useEffect(() => {
    try {
      window.localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(desktopLayout));
    } catch {
      // Layout persistence is optional.
    }
  }, [desktopLayout]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FLOATING_ORDER_KEY, JSON.stringify(floatingOrder));
    } catch {
      // Floating widget persistence is optional.
    }
  }, [floatingOrder]);

  useEffect(() => {
    saveDesktopChartSettings(chartSettings);
  }, [chartSettings]);

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
    const nextTimeframe = normalizeDesktopTimeframe(timeframe);
    setMultiChart(current => {
      const layout = [1, 2, 4].includes(Number(current?.layout)) ? Number(current.layout) : 1;
      const index = Math.min(Math.max(0, Number(current?.activeCell) || 0), layout - 1);
      const cells = Array.from({ length: 4 }, (_, cellIndex) => current?.cells?.[cellIndex] || {});
      if (cells[index]?.timeframe === nextTimeframe) return current;
      cells[index] = { ...cells[index], timeframe: nextTimeframe };
      return { ...current, cells };
    });
  }, [timeframe]);

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
    const normalized = normalizeDesktopTimeframe(value);
    onTimeframeChange(normalized);
    setMultiChart(current => {
      const layout = [1, 2, 4].includes(Number(current?.layout)) ? Number(current.layout) : 1;
      const index = Math.min(Math.max(0, Number(current?.activeCell) || 0), layout - 1);
      const cells = Array.from({ length: 4 }, (_, cellIndex) => current?.cells?.[cellIndex] || {});
      if (cells[index]?.timeframe === normalized) return current;
      cells[index] = { ...cells[index], timeframe: normalized };
      return { ...current, cells };
    });
  };

  const heightBounds = desktopHeightBounds(viewportHeight, desktopLayout.dockCollapsed, desktopLayout.dockHeight);
  const widthBounds = desktopWidthBounds(viewportWidth);
  const sidebarRailWidth = 40;
  const sidebarContentWidth = positionsExpanded || desktopLayout.sidebarCollapsed ? 0 : desktopLayout.sidebarWidth;
  const sidebarWidth = sidebarContentWidth + sidebarRailWidth;
  const marketPanelOpen = activeNav === 'watchlist' || activeNav === 'markets';
  const marketBounds = desktopMarketPanelBounds(viewportWidth, sidebarContentWidth);
  const collapsedDockHeight = 44;
  const compactDockThreshold = 60;
  const expandedChartStripHeight = 150;
  const expandedDockHeight = Math.max(
    260,
    viewportHeight - 46 - 12 - expandedChartStripHeight,
  );
  const visibleDockHeight = clamp(
    Math.max(180, Math.round(viewportHeight * 0.22)),
    heightBounds.dockMin,
    heightBounds.dockMax,
  );
  const dockHeight = positionsExpanded
    ? expandedDockHeight
    : desktopLayout.dockCollapsed
      ? collapsedDockHeight
      : desktopLayout.dockHeight;
  const dockBodyVisible = positionsExpanded
    || (!desktopLayout.dockCollapsed && dockHeight > compactDockThreshold);
  const tradeSidebarOpen = !desktopLayout.sidebarCollapsed && activeNav === 'trade' && !positionsExpanded;
  const floatingExecutionVisible = !readOnly && !positionsExpanded && !tradeSidebarOpen;
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

  const beginFloatingOrderDrag = event => {
    if (event.button !== 0) return;
    const workspace = chartWorkspaceRef.current;
    const widget = floatingOrderRef.current;
    if (!workspace || !widget) return;

    event.preventDefault();
    event.stopPropagation();

    const bounds = workspace.getBoundingClientRect();
    const widgetBounds = widget.getBoundingClientRect();
    const startX = Number(event.clientX);
    const startY = Number(event.clientY);
    const startLeft = Number(floatingOrder.x) || 8;
    const startTop = Number(floatingOrder.y) || 8;

    const move = moveEvent => {
      const maxX = Math.max(8, bounds.width - widgetBounds.width - 8);
      const maxY = Math.max(8, bounds.height - widgetBounds.height - 8);
      const nextX = clamp(startLeft + Number(moveEvent.clientX) - startX, 8, maxX);
      const nextY = clamp(startTop + Number(moveEvent.clientY) - startY, 8, maxY);
      setFloatingOrder(current => ({ ...current, x: nextX, y: nextY }));
    };

    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', finish, { once: true });
  };
  const toggleDock = () => {
    if (positionsExpanded) {
      setPositionsExpanded(false);
      setDesktopLayout(current => ({
        ...current,
        dockCollapsed: false,
        dockHeight: current.dockHeight <= compactDockThreshold ? visibleDockHeight : current.dockHeight,
      }));
      return;
    }

    setDesktopLayout(current => {
      if (current.dockCollapsed || current.dockHeight <= compactDockThreshold) {
        return {
          ...current,
          dockCollapsed: false,
          dockHeight: current.dockHeight <= compactDockThreshold ? visibleDockHeight : current.dockHeight,
        };
      }
      return { ...current, dockCollapsed: true };
    });
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
  const v4HeaderStatus = v4HeaderMarketStatus(market);
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

  const submitOneClick = (order, options = {}) => {
    if (!canOpen) {
      setNotice(exposureBlockReason || 'New exposure is unavailable until account, valuation and market state are live.');
      return;
    }
    return onManualOrder(order, options);
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

  const updateDesktopProtection = async (positionId, patch) => {
    const position = positions.find(item => String(item?.id) === String(positionId));
    if (!position || !patch || typeof patch !== 'object') return false;
    const instrument = markets.find(item => item.symbol === position.symbol) || market;
    const side = String(position.side || '').toUpperCase();
    const normalizedPatch = {};

    for (const field of ['sl', 'tp']) {
      if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
      const raw = patch[field];
      normalizedPatch[field] = raw === null || raw === undefined || raw === ''
        ? null
        : normalizeProtectionPrice(raw, instrument, side, field);
    }

    if (!Object.keys(normalizedPatch).length) return false;
    const validation = validateOpenPositionProtection(position, instrument, normalizedPatch);
    if (!validation.ok) {
      setNotice(validation.message);
      return false;
    }

    const saved = await onUpdatePosition(position.id, normalizedPatch);
    return saved !== false;
  };

  const editPositionProtection = (positionId, field, initialPrice = null) => {
    selectPosition(positionId);
    setDesktopLayout(current => ({ ...current, sidebarCollapsed: false }));
    setActiveNav('trade');
    const started = onBeginPositionProtection(field, positionId, {
      useCurrentReference: true,
      initialPrice,
    });
    if (started === false) return false;
    setPositionEditRequest(current => ({
      positionId: String(positionId),
      field,
      nonce: Number(current?.nonce || 0) + 1,
    }));
    return true;
  };

  return (
    <div ref={shellRef} className="acg-terminal acg-desktop-v3 relative flex h-dvh min-h-0 flex-col gap-1 overflow-hidden bg-black p-1 text-[#E6EDF3]">
      {notice && <div className="acg-motion-notice absolute right-3 top-[66px] z-[120] flex max-w-[390px] items-center gap-3 rounded-md border border-white/[0.06] bg-[#101010]/95 px-3 py-2.5 text-[10px] font-semibold text-[#E6EDF3] shadow-[0_16px_48px_rgba(0,0,0,.45)]"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="grid size-6 place-items-center rounded-md text-[#8094a7]"><X size={13}/></button></div>}


      <header data-v4-header={V4_DESKTOP_EXECUTION_ENABLED ? 'true' : undefined}
        style={V4_DESKTOP_EXECUTION_ENABLED ? {
          '--acg-v4-sidebar-width': `${sidebarContentWidth}px`,
          '--acg-v4-rail-width': `${sidebarRailWidth}px`,
        } : undefined}
        className={`acg-desktop-market-strip flex h-[46px] w-full min-w-0 shrink-0 items-center overflow-visible rounded-[10px] border border-white/[0.07] bg-[#09090B] px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_6px_18px_rgba(0,0,0,.22)] ${V4_DESKTOP_EXECUTION_ENABLED ? 'acg-v4-header' : ''}`}>
        <div className="acg-v4-header-instrument flex min-w-[178px] items-center gap-2.5 text-left 2xl:min-w-[210px]">
          <button type="button" data-v4-header-instrument-image={V4_DESKTOP_EXECUTION_ENABLED ? 'true' : undefined}
            onClick={() => openMarketPanel('markets', false)} className="shrink-0"
            title="Open markets and watchlist" aria-label="Open markets and watchlist">
            <InstrumentAvatar instrument={market} size={30}/>
          </button>
          <div className="acg-v4-header-identity min-w-0">
            <div className="acg-v4-header-primary flex min-w-0 items-center gap-1">
              <button type="button" onClick={() => openMarketPanel('markets', false)} className="flex min-w-0 items-center gap-1 text-left" title="Open markets and watchlist">
                <strong key={activeSymbol || 'symbol'} className="acg-motion-symbol truncate text-[14px] font-extrabold tracking-[-0.025em] text-[#f3f6f8]">{market?.displaySymbol || displaySymbol(market?.symbol)}</strong>
                <ChevronDown size={12} className="shrink-0 text-[#f3f6f8]"/>
              </button>
              <button
                type="button"
                onClick={() => watchlists?.toggleSymbol?.(activeSymbol)}
                className={favorite ? "grid size-5 shrink-0 place-items-center rounded text-[#CDD1D6] hover:bg-white/[0.05]" : "grid size-5 shrink-0 place-items-center rounded text-[#71808e] hover:bg-white/[0.05] hover:text-white"}
                title={favorite ? "Remove from favorites" : "Add to favorites"}
                aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star key={favorite ? 'favorite-on' : 'favorite-off'} className="acg-favorite-icon" data-active={favorite ? 'true' : 'false'} size={12} fill={favorite ? 'currentColor' : 'none'}/>
              </button>
            </div>
            {V4_DESKTOP_EXECUTION_ENABLED ? (
              <div className="acg-v4-header-secondary" role="status" data-market-status={v4HeaderStatus}>
                <span className="acg-v4-header-status-dot" aria-hidden="true"/>
                <span>{v4HeaderStatus === 'open' ? 'Market open' : v4HeaderStatus === 'closed' ? 'Market closed' : 'Market unavailable'}</span>
              </div>
            ) : (
              <button type="button" onClick={() => openMarketPanel('markets', false)} className="mt-0.5 flex min-w-0 items-center gap-1.5 text-left text-[8px] font-bold text-[#697988]" title="Open markets and watchlist">
                <span className="truncate">{marketLabel(market)}</span>
                <span className="shrink-0 text-[#697988]">
                  {market?.sessionOpen === false || String(market?.marketState || '').toUpperCase() === 'CLOSED' ? 'MARKET CLOSED' : 'MARKET OPEN'}
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="acg-desktop-chart-toolbar flex min-w-0 shrink-0 items-center border-l border-white/[0.06] bg-transparent px-2.5">
          <div className="terminal-toolbar-group acg-v4-header-timeframes flex h-9 min-w-0 shrink-0 items-center overflow-x-auto rounded-[12px] border border-white/[0.09] bg-[#080808] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.015)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {timeframes.map(([label, value]) => (
              <button key={value} type="button" data-v4-timeframe={value} aria-pressed={activeChartTimeframe === value} onClick={() => setDesktopTimeframe(value)} disabled={Boolean(tradePlan && !tradePlan.open)} className={activeChartTimeframe === value ? "relative grid h-full min-w-9 place-items-center px-2 text-[10px] font-bold text-[#f2f2f2] transition" : "relative grid h-full min-w-9 place-items-center px-2 text-[10px] font-bold text-[#8f9aa8] transition hover:text-[#e9edf3]"}>{label}{activeChartTimeframe === value && <span className="acg-active-underline absolute bottom-0 left-[18%] right-[18%] h-[2px] rounded-full bg-[#C9CDD2]" aria-hidden="true"/>}</button>
            ))}
          </div>
          {V4_DESKTOP_EXECUTION_ENABLED && (
            <div className="acg-v4-header-compact-timeframe">
              <button type="button" aria-label="Choose chart timeframe"
                aria-haspopup="true" aria-expanded={v4HeaderMenu === 'timeframes'}
                disabled={Boolean(tradePlan && !tradePlan.open)}
                onClick={() => setV4HeaderMenu(current => current === 'timeframes' ? null : 'timeframes')}>
                <span>{activeChartTimeframe}</span><ChevronDown size={12} aria-hidden="true"/>
              </button>
              {v4HeaderMenu === 'timeframes' && (
                <div data-v4-header-menu="timeframes" role="group" aria-label="Chart timeframes">
                  {timeframes.map(([label, value]) => (
                    <button key={value} type="button" aria-pressed={activeChartTimeframe === value}
                      disabled={Boolean(tradePlan && !tradePlan.open)}
                      onClick={() => { setDesktopTimeframe(value); setV4HeaderMenu(null); }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="acg-v4-header-tools ml-1.5 flex h-full shrink-0 items-center gap-1.5" role="group" aria-label="Chart tools">
            <div className="relative">
              <button type="button" data-v4-header-tool="chart-type" aria-label={V4_DESKTOP_EXECUTION_ENABLED ? 'Chart type' : undefined} aria-expanded={v4IsOpen('chart',chartMenuOpen)} onClick={() => v4Toggle('chart',setChartMenuOpen)} className={chartMenuOpen ? "flex h-7 items-center gap-1.5 rounded-md border border-[#C9CDD2]/60 bg-[#222427] px-2.5 text-[8px] font-semibold text-[#f1f4f6]" : "flex h-7 items-center gap-1.5 rounded-md border border-white/[0.06] px-2.5 text-[8px] font-semibold text-[#8996a1] hover:text-white"} title={V4_DESKTOP_EXECUTION_ENABLED ? 'Chart type' : 'Chart settings'}><CandlestickChart size={V4_DESKTOP_EXECUTION_ENABLED ? 18 : 12}/><span className="acg-v4-header-tool-label">Charts</span><ChevronDown className="acg-v4-header-tool-chevron" size={10}/></button>
              {v4IsOpen('chart',chartMenuOpen) && (
                <div data-v4-header-menu={V4_DESKTOP_EXECUTION_ENABLED ? 'chart' : undefined} className="acg-motion-popover absolute right-0 top-8 z-[100] w-[205px] rounded-md border border-white/[0.10] bg-[#111113] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
                  <div className="px-2 pb-1 pt-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[#5f6d79]">Chart type</div>
                  <button type="button" onClick={() => { onChartModeChange('candles'); setChartMenuOpen(false); v4Close(); }} className={chartMode === 'candles' ? "flex w-full items-center gap-2 rounded bg-[#24262A] px-2 py-2 text-left text-[8px] font-semibold text-[#C9CDD2]" : "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><CandlestickChart size={12}/>Candlesticks</button>
                  <button type="button" onClick={() => { onChartModeChange('line'); setChartMenuOpen(false); v4Close(); }} className={chartMode === 'line' ? "flex w-full items-center gap-2 rounded bg-[#24262A] px-2 py-2 text-left text-[8px] font-semibold text-[#C9CDD2]" : "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><ChartNoAxesCombined size={12}/>Line</button>
                  {!V4_DESKTOP_EXECUTION_ENABLED && <>
                  <div className="my-1 border-t border-white/[0.06]"/>
                  <div className="px-2 pb-1 pt-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[#5f6d79]">Chart grid</div>
                  {[[1, Square, 'Single chart'], [2, Columns2, 'Two charts'], [4, Grid2X2, 'Four charts']].map(([value, Icon, label]) => (
                    <button key={value} type="button" onClick={() => setChartLayout(value)} className={chartLayout === value ? "flex w-full items-center gap-2 rounded bg-[#24262A] px-2 py-2 text-left text-[8px] font-semibold text-[#C9CDD2]" : "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><Icon size={12}/>{label}</button>
                  ))}
                  {chartLayout > 1 && <>
                    <div className="my-1 border-t border-white/[0.06]"/>
                    <button type="button" onClick={toggleChartLink} className={chartLinked ? "flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#C9CDD2] hover:bg-white/[0.03]" : "flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><span className="flex items-center gap-2">{chartLinked ? <Link2 size={12}/> : <Link2Off size={12}/>}Link symbols</span><span className="text-[#6F8191]">{chartLinked ? 'On' : 'Off'}</span></button>
                    <button type="button" onClick={applyActiveIndicatorsToAllCharts} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><span>Copy indicators to all</span><span className="text-[#6F8191]">ƒx {indicators.length}</span></button>
                  </>}
                  </>}
                </div>
              )}
            </div>
            <div className="relative">
              <button type="button" data-v4-header-tool="indicators" aria-label={V4_DESKTOP_EXECUTION_ENABLED ? 'Indicators' : undefined} aria-expanded={v4IsOpen('indicators',indicatorPanelOpen)} onClick={() => {
                setIndicatorFocusId(null); setObjectManagerOpen(false); v4Toggle('indicators',setIndicatorPanelOpen);
              }} className={indicatorPanelOpen ? "flex h-7 items-center gap-1.5 rounded-md border border-[#C9CDD2]/60 bg-[#222427] px-2.5 text-[8px] font-semibold text-[#f1f4f6]" : "flex h-7 items-center gap-1.5 rounded-md border border-white/[0.06] px-2.5 text-[8px] font-semibold text-[#8996a1] hover:text-white"} title="Indicators"><span className="acg-v4-header-fx text-[11px] font-black">ƒx</span><span className="acg-v4-header-tool-label">Indicators</span>{indicators.length > 0 && <span className="acg-v4-header-indicator-count grid min-w-3 place-items-center rounded bg-[#181b20] px-1 text-[6px] text-[#aab5bf]">{indicators.length}</span>}<ChevronDown className="acg-v4-header-tool-chevron" size={10}/></button>
              {v4IsOpen('indicators',indicatorPanelOpen) && (
                <div data-v4-header-menu={V4_DESKTOP_EXECUTION_ENABLED ? 'indicators' : undefined} className="acg-motion-popover absolute right-0 top-8 z-[110] w-[390px] max-h-[min(680px,calc(100dvh-150px))] overflow-y-auto rounded-lg border border-white/[0.10] bg-[#09090B]/98 p-3 shadow-[0_24px_70px_rgba(0,0,0,.68)] backdrop-blur-xl [scrollbar-width:thin]">
                  <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-2.5"><div><strong className="block text-[11px] text-[#EDF3F7]">Indicators</strong><span className="mt-0.5 block text-[8px] text-[#687D91]">Active chart · {activeSymbol} · {activeChartTimeframe}</span></div><button type="button" onClick={() => { setIndicatorPanelOpen(false); v4Close(); }} className="grid size-7 place-items-center rounded text-[#7D91A4] hover:bg-white/[0.04] hover:text-white"><X size={13}/></button></div>
                  <IndicatorManager desktop applied={indicators} favorites={indicatorFavorites} onAdd={onAddIndicator} onRemove={onRemoveIndicator} onToggleVisible={onToggleIndicator} onUpdate={onUpdateIndicator} onToggleFavorite={onToggleIndicatorFavorite} focusInstanceId={indicatorFocusId} onClearFocus={() => setIndicatorFocusId(null)}/>
                </div>
              )}
            </div>
            <DesktopWorkspaceMenu snapshot={workspaceSnapshot} onApply={applyWorkspace}
              compact={V4_DESKTOP_EXECUTION_ENABLED} chartLayout={chartLayout} onChartLayoutChange={setChartLayout}
              chartLinked={chartLinked} onToggleChartLink={toggleChartLink}
              onCopyIndicators={applyActiveIndicatorsToAllCharts} indicatorCount={indicators.length}
              open={V4_DESKTOP_EXECUTION_ENABLED ? v4HeaderMenu === 'layout' : undefined}
              onOpenChange={V4_DESKTOP_EXECUTION_ENABLED ? next => setV4HeaderMenu(next ? 'layout' : null) : undefined}/>
          </div>
        </div>

        {!V4_DESKTOP_EXECUTION_ENABLED && viewportWidth >= 1500 && (
          <div className="ml-2 flex h-full items-center">
            <div className="min-w-[92px] border-l border-white/[0.055] px-3">
              <span className="block text-[7px] uppercase tracking-[0.07em] text-[#637484]">24h High</span>
              <strong key={marketHigh == null ? 'high-empty' : `high-${marketHigh}`} className="acg-motion-value mt-1 block font-mono text-[9px] font-bold text-[#cdd7df]">{marketHigh == null ? '—' : formatInstrumentPrice(marketHigh, market)}</strong>
            </div>
            <div className="min-w-[92px] border-l border-white/[0.055] px-3">
              <span className="block text-[7px] uppercase tracking-[0.07em] text-[#637484]">24h Low</span>
              <strong key={marketLow == null ? 'low-empty' : `low-${marketLow}`} className="acg-motion-value mt-1 block font-mono text-[9px] font-bold text-[#cdd7df]">{marketLow == null ? '—' : formatInstrumentPrice(marketLow, market)}</strong>
            </div>
            {marketVolume != null && (
              <div className="min-w-[92px] border-l border-white/[0.055] px-3">
                <span className="block text-[7px] uppercase tracking-[0.07em] text-[#637484]">24h Volume</span>
                <strong key={`volume-${marketVolume}`} className="acg-motion-value mt-1 block font-mono text-[9px] font-bold text-[#cdd7df]">{formatMarketVolume(marketVolume)}</strong>
              </div>
            )}
          </div>
        )}
        {V4_DESKTOP_EXECUTION_ENABLED && <div className="acg-v4-header-spacer" aria-hidden="true"/>}
        <div className="acg-v4-header-right ml-auto flex items-center gap-2">
          {readOnly && <span className="hidden rounded-md border border-rose-400/20 bg-rose-400/[0.08] px-2 py-1 text-[7px] font-black uppercase tracking-[0.09em] text-rose-300 2xl:inline-flex">Read-only · Breached</span>}
          <div className="acg-v4-header-valuation hidden text-right 2xl:block">
            <span className="block text-[7px] uppercase tracking-[0.08em] text-[#637484]">Valuation</span>
            <b className={valuationStatus === 'LIVE' ? "mt-0.5 block text-[8px] text-[#42D7A1]" : valuationStatus === 'STALE' ? "mt-0.5 block text-[8px] text-[#E7BD58]" : "mt-0.5 block text-[8px] text-[#A1AFBC]"}>{valuationStatus}</b>
          </div>
          <div className={V4_DESKTOP_EXECUTION_ENABLED ? "relative acg-v4-header-account-wrap" : "relative"}>
            <button type="button" data-v4-header-account onClick={() => v4Toggle('account',setAccountMenuOpen)} className="flex h-8 min-w-[176px] items-center gap-2 rounded-md border border-white/[0.07] bg-black/20 px-2.5 text-left hover:bg-white/[0.025]" aria-label="Switch trading account" aria-expanded={v4IsOpen('account',accountMenuOpen)} title={account?.accountCode || 'Trading account'}>
              {accountSwitching ? <Loader2 size={11} className="shrink-0 animate-spin text-[#C9CDD2]"/> : <span className={`acg-v4-header-account-dot ${canOpen ? "size-1.5 shrink-0 rounded-full bg-[#9FA5AA]" : valuationStatus === 'STALE' ? "size-1.5 shrink-0 rounded-full bg-[#e8bd55]" : "size-1.5 shrink-0 rounded-full bg-[#343434]"}`}/>}
              <div className="min-w-0 flex-1 leading-none">
                <strong data-v4-header-account-name className="block truncate text-[9px]">{V4_DESKTOP_EXECUTION_ENABLED ? v4HeaderAccountLabel(account) : account?.accountCode || accountStatus}</strong>
                <span className="mt-1 block truncate text-[8px] text-[#6F8191]">{accountTypeBadge(account)} · {accountSize(account?.initialBalance ?? account?.startingBalance ?? account?.challenge?.accountSize ?? account?.balance)}{Number(account?.leverage) > 0 ? ` · 1:${Number(account.leverage)}` : ''}</span>
              </div>
              <ChevronDown size={11} className={v4IsOpen('account',accountMenuOpen) ? "acg-motion-chevron shrink-0 rotate-180 text-[#6F8191]" : "acg-motion-chevron shrink-0 text-[#6F8191]"}/>
            </button>
            {v4IsOpen('account',accountMenuOpen) && (
              <div data-v4-header-menu={V4_DESKTOP_EXECUTION_ENABLED ? 'account' : undefined} className="acg-motion-popover absolute right-0 top-10 z-[140] w-[330px] overflow-hidden rounded-md border border-white/[0.10] bg-[#111113] shadow-[0_20px_60px_rgba(0,0,0,.65)]">
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
                              if (changed !== false) { setAccountMenuOpen(false); v4Close(); }
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
                                <span className="font-bold text-[#A1AFBC]">{accountSize(item.initialBalance ?? item.startingBalance ?? item.challenge?.accountSize ?? item.balance)}</span>
                                {phase && <><span>·</span><span>{phase}</span></>}<span>·</span><span>{accountStatusLabel(itemStatus)}</span>
                              </div>
                              <span className="mt-0.5 block text-[7px] text-[#556572]">Equity {money(item.equity, item.currency || 'USD')}</span>
                            </div>
                            {selected && (accountSwitching ? <Loader2 size={13} className="shrink-0 animate-spin text-[#C9CDD2]"/> : <Check size={13} className="shrink-0 text-[#C9CDD2]"/>)}
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
            <button type="button" data-v4-header-more onClick={() => v4Toggle('more',setToolsMenuOpen)} aria-expanded={v4IsOpen('more',toolsMenuOpen)} className={v4IsOpen('more',toolsMenuOpen) ? "grid size-8 place-items-center rounded-md border border-[#C9CDD2]/60 bg-[#222427] text-[#f1f4f6]" : "grid size-8 place-items-center rounded-md border border-white/[0.07] bg-black/20 text-[#8996a1] hover:bg-white/[0.025] hover:text-white"} title="More" aria-label="More terminal actions"><MoreHorizontal size={16}/></button>
            {v4IsOpen('more',toolsMenuOpen) && (
              <div data-v4-header-menu={V4_DESKTOP_EXECUTION_ENABLED ? 'more' : undefined} className="acg-motion-popover absolute right-0 top-10 z-[105] w-[230px] rounded-md border border-white/[0.10] bg-[#111113] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
                <button type="button" onClick={() => { handleNav('markets'); setToolsMenuOpen(false); v4Close(); }} className={activeNav === 'markets' ? "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#C9CDD2]" : "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"}><List size={12}/>Markets / Watchlist</button>
                <button type="button" onClick={() => { handleNav('history'); setToolsMenuOpen(false); v4Close(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><History size={12}/>History</button>
                <button type="button" onClick={() => { setReviewOpen(true); setToolsMenuOpen(false); v4Close(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><BookOpen size={12}/>Trade review</button>
                <button type="button" onClick={() => {
                  setIndicatorPanelOpen(false);
                  if (V4_DESKTOP_EXECUTION_ENABLED) setV4HeaderMenu('manager');
                  else setObjectManagerOpen(value => !value);
                  setToolsMenuOpen(false);
                }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><Layers3 size={12}/>Chart manager</button>
                <button type="button" onClick={() => { void toggleFullscreen(); setToolsMenuOpen(false); v4Close(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><Maximize2 size={12}/>Fullscreen</button>
                <div className="my-1 border-t border-white/[0.06]"/>
                <button type="button" onClick={() => { toggleSidebar(); setToolsMenuOpen(false); v4Close(); }} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><span>Side panel</span><span className="text-[#6F8191]">{desktopLayout.sidebarCollapsed ? 'Closed' : 'Open'}</span></button>
                <button type="button" onClick={() => { toggleDock(); setToolsMenuOpen(false); v4Close(); }} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><span>Positions dock</span><span className="text-[#6F8191]">{dockBodyVisible ? 'Shown' : 'Hidden'}</span></button>
                <button type="button" onClick={() => { resetDesktopLayout(); setToolsMenuOpen(false); v4Close(); }} className="w-full rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]">Reset desktop layout</button>
                <div className="my-1 border-t border-white/[0.06]"/>
                <button type="button" onClick={() => { onOpenSettings(); setToolsMenuOpen(false); v4Close(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[8px] font-semibold text-[#A1AFBC] hover:bg-white/[0.03]"><Settings size={12}/>Settings</button>
              </div>
            )}
            {v4IsOpen('manager',objectManagerOpen) && <div data-v4-header-menu={V4_DESKTOP_EXECUTION_ENABLED ? 'manager' : undefined} className="acg-motion-popover absolute right-0 top-10 z-[115]"><ChartObjectManager symbol={activeSymbol} timeframe={activeChartTimeframe === '1m' ? 'M1' : activeChartTimeframe === '5m' ? 'M5' : activeChartTimeframe === '15m' ? 'M15' : activeChartTimeframe === '30m' ? 'M30' : activeChartTimeframe === '1H' ? 'H1' : activeChartTimeframe === '4H' ? 'H4' : activeChartTimeframe === '1D' ? 'D1' : activeChartTimeframe === '1W' ? 'W1' : activeChartTimeframe} indicators={indicators} chartInstanceId={'desktop-chart-' + Math.min(Math.max(0, Number(multiChart?.activeCell) || 0), chartLayout - 1)} onToggleIndicator={onToggleIndicator} onRemoveIndicator={onRemoveIndicator} onOpenIndicatorSettings={instanceId => { setObjectManagerOpen(false); setIndicatorFocusId(instanceId); if (V4_DESKTOP_EXECUTION_ENABLED) setV4HeaderMenu('indicators'); else setIndicatorPanelOpen(true); }} onClose={() => { setObjectManagerOpen(false); v4Close(); }}/></div>}
          </div>
        </div>
      </header>


      <div className="min-h-0 flex-1">
        <div
          className="relative grid h-full min-h-0 min-w-0 gap-x-1 gap-y-1 bg-black transition-[grid-template-columns,grid-template-rows] duration-300 ease-out"
          style={{
            gridTemplateColumns: `minmax(0, 1fr) ${sidebarContentWidth}px ${sidebarRailWidth}px`,
            gridTemplateRows: `minmax(0, 1fr) ${dockHeight}px`,
          }}
        >
          <section ref={chartWorkspaceRef} className="relative grid min-h-0 min-w-0 overflow-hidden bg-black grid-rows-[minmax(0,1fr)]" style={{ gridColumn: '1', gridRow: '1' }}>
            <div className="min-h-0 min-w-0 bg-black p-0">
              <DesktopMultiChart
                compactContext={positionsExpanded}
                chartOrderV4={V4_DESKTOP_EXECUTION_ENABLED}
                chartSettings={chartSettings}
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
                  if (V4_DESKTOP_EXECUTION_ENABLED) setV4HeaderMenu('indicators');
                  else setIndicatorPanelOpen(true);
                }}
                onRemoveIndicator={onRemoveIndicator}
                positions={positions}
                pendingOrders={pendingOrders}
                onModifyPending={onModifyPending}
                onCancelPending={onCancelPending}
                onMovePending={onMovePending}
                onCancelTradePlan={onCancelPlan}
                selectedTool={selectedTool}
                onSelectedToolChange={onSelectedToolChange}
                chartMode={chartMode}
                onActiveTimeframeChange={onTimeframeChange}
                tradePlan={tradePlan}
                tradePlanLots={lots}
                orderExecutionPreview={orderExecutionPreview}
                accountCurrency={account?.currency || 'USD'}
                account={account}
                riskPercent={riskPercent}
                onCreateRiskOrder={onCreateRiskOrder}
                onTradePlanChange={onTradePlanChange}
                onUpdatePosition={updateDesktopProtection}
                positionProtectionDraft={positionProtectionDraft}
                onPositionProtectionDraftChange={onPositionProtectionDraftChange}
                onCancelPositionProtection={onCancelPositionProtection}
                onRemovePositionProtection={(positionId, field) => updateDesktopProtection(positionId, { [field]: null })}
                onRequestPositionProtection={(positionId, field, price) => editPositionProtection(positionId, field, price)}
                selectedPositionId={selectedPositionId}
                onSelectPosition={selectPosition}
                onSelectPending={selectPending}
                pendingOrderDraft={pendingOrderDraft}
                onPendingOrderDraftChange={setPendingOrderDraft}
                onCancelPendingOrderDraft={clearPendingDraft}
                onClosePosition={onClosePosition}
              />
            </div>

            {floatingExecutionVisible && (
              <div ref={floatingOrderRef} className="absolute z-[90] hidden lg:block" style={{ left: floatingOrder.x, top: floatingOrder.y }}>
                <DesktopOrderTicket
                  key={`floating-order-${account?.id || 'none'}`}
                  variant="floating"
                  onFloatingDragStart={beginFloatingOrderDrag}
                  onOpenFullTrade={() => openSidebarView('trade')}
                  market={market}
                  account={account}
                  exposureAllowed={exposureAllowed}
                  exposureBlockReason={exposureBlockReason}
                  lots={lots}
                  onLotsChange={onLotsChange}
                  sizingMode={sizingMode}
                  onSizingModeChange={onSizingModeChange}
                  riskPercent={riskPercent}
                  onRiskPercentChange={onRiskPercentChange}
                  orderType={orderType}
                  onOrderTypeChange={onOrderTypeChange}
                  tradePlan={tradePlan}
                  orderExecutionPreview={orderExecutionPreview}
                  onStartPlan={onStartPlan}
                  onCancelPlan={onCancelPlan}
                  onExecutePlan={onExecutePlan}
                  onManualOrder={submitOneClick}
                  onTradePlanChange={onTradePlanChange}
                  onNotice={setNotice}
                />
              </div>
            )}
          </section>

          {!desktopLayout.sidebarCollapsed && !positionsExpanded && (
            <aside className="acg-motion-side-panel relative flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#09090B] shadow-[inset_0_1px_0_rgba(255,255,255,0.018),0_12px_30px_rgba(0,0,0,.22)]" style={{ gridColumn: '2', gridRow: '1' }}>
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
                    onViewportQuoteSymbolsChange={onViewportQuoteSymbolsChange}
                  />
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1">
<React.Fragment>
                      {V4_DESKTOP_EXECUTION_ENABLED ? (selectedPending ? (
                        <DesktopManagePendingV4 key={`v4-manage-pending-${account?.id||'none'}-${selectedPending.id}`}
                          order={selectedPending}
                          instrument={markets.find(item=>item.symbol===selectedPending.symbol)||market}
                          account={account} draft={pendingOrderDraft}
                          onDraftChange={setPendingOrderDraft} onDiscard={clearPendingDraft}
                          onMovePending={onMovePending} onCancelPending={onCancelPending}
                          onNotice={setNotice} readOnly={readOnly}
                          onDismiss={()=>{setSelectedPendingId(null);setPendingOrderDraft(null);}}/>
                      ) : selectedPosition ? (
                        <DesktopManagePositionV4
                          key={`v4-manage-position-${account?.id || 'none'}-${selectedPosition.id}`}
                          position={selectedPosition}
                          instrument={markets.find(item => item.symbol === selectedPosition.symbol) || market}
                          account={account} protectionDraft={positionProtectionDraft}
                          protectionSaving={positionProtectionSaving}
                          onBeginProtection={field => editPositionProtection(selectedPosition.id,field)}
                          onProtectionDraftChange={onPositionProtectionDraftChange}
                          onApplyProtection={onApplyPositionProtection}
                          onCancelProtection={onCancelPositionProtection}
                          onUpdateProtection={updateDesktopProtection}
                          onClosePosition={onClosePosition} onBreakEven={onBreakEven}
                          onSetTrailing={onSetTrailing}
                          onNotice={setNotice} readOnly={readOnly}
                          onDismiss={() => { setSelectedPositionId(null); setPositionEditRequest(null); onCancelPositionProtection(); }}
                        />
                      ) : (
                        <DesktopOrderTicketV4 key={`v4-order-ticket-${account?.id || 'none'}-${market?.symbol || 'none'}`}
                          market={market} account={account} conversionMarkets={markets} exposureAllowed={exposureAllowed} exposureBlockReason={exposureBlockReason}
                          lots={lots} onLotsChange={onLotsChange} sizingMode={sizingMode} onSizingModeChange={onSizingModeChange}
                          riskPercent={riskPercent} onRiskPercentChange={onRiskPercentChange}
                          orderType={orderType} onOrderTypeChange={onOrderTypeChange} tradePlan={tradePlan}
                          onStartPlan={onStartPlan} onCancelPlan={onCancelPlan} onExecutePlan={onExecutePlan}
                          onManualOrder={submitOneClick} onTradePlanChange={onTradePlanChange} onNotice={setNotice}
                          executionCommandPending={executionCommandPending}
                          onOpenMarkets={() => openMarketPanel('markets', true)}
                          onCloseTicket={() => setDesktopLayout(current => ({ ...current, sidebarCollapsed: true }))}
                        />
                      )) : (
                        <DesktopOrderTicket key={`order-ticket-${account?.id || 'none'}`} market={market} account={account} exposureAllowed={exposureAllowed} exposureBlockReason={exposureBlockReason} lots={lots} onLotsChange={onLotsChange} sizingMode={sizingMode} onSizingModeChange={onSizingModeChange} riskPercent={riskPercent} onRiskPercentChange={onRiskPercentChange} orderType={orderType} onOrderTypeChange={onOrderTypeChange} tradePlan={tradePlan} orderExecutionPreview={orderExecutionPreview} onStartPlan={onStartPlan} onCancelPlan={onCancelPlan} onExecutePlan={onExecutePlan} onManualOrder={submitOneClick} onTradePlanChange={onTradePlanChange} onNotice={setNotice}/>
                      )}
                    </React.Fragment>
                  </div>
                  {selectedPosition && !V4_DESKTOP_EXECUTION_ENABLED && (
                    <div className="acg-motion-panel-stack max-h-[46%] shrink-0 overflow-y-auto [scrollbar-width:thin]">
                      <DesktopPositionManager
                        position={selectedPosition}
                        instrument={markets.find(item => item.symbol === selectedPosition.symbol) || market}
                        account={account}
                        editRequest={positionEditRequest && String(positionEditRequest.positionId) === String(selectedPosition.id) ? positionEditRequest : null}
                        onClose={onClosePosition}
                        onBreakEven={onBreakEven}
                        onUpdate={updateDesktopProtection}
                        onSetTrailing={onSetTrailing}
                        protectionDraft={positionProtectionDraft}
                        onProtectionDraftChange={onPositionProtectionDraftChange}
                        onBeginProtection={field => editPositionProtection(selectedPosition.id, field)}
                        onApplyProtection={onApplyPositionProtection}
                        onCancelProtection={onCancelPositionProtection}
                        protectionSaving={positionProtectionSaving}
                        onNotice={setNotice}
                        onDismiss={() => { setSelectedPositionId(null); setPositionEditRequest(null); onCancelPositionProtection(); }}
                      />
                    </div>
                  )}
                </>
              )}
            </aside>
          )}

          <aside className="flex min-h-0 flex-col items-center overflow-hidden rounded-[10px] border border-white/[0.07] bg-[#09090B] py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.018),0_8px_22px_rgba(0,0,0,.20)]" style={{ gridColumn: '3', gridRow: '1' }} aria-label="Desktop panel dock">
            <button
              type="button"
              onClick={() => {
                if (!desktopLayout.sidebarCollapsed && activeNav === 'trade') toggleSidebar();
                else openSidebarView('trade');
              }}
              className={!desktopLayout.sidebarCollapsed && activeNav === 'trade'
                ? "mb-1 grid size-9 place-items-center rounded-md bg-[#222225] text-[#C9CDD2] ring-1 ring-inset ring-[#C9CDD2]/70"
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
                ? "mb-1 grid size-9 place-items-center rounded-md bg-[#222225] text-[#C9CDD2] ring-1 ring-inset ring-[#C9CDD2]/70"
                : "mb-1 grid size-9 place-items-center rounded-md text-[#7F8D99] hover:bg-white/[0.04] hover:text-white"}
              title="Markets"
              aria-label="Markets"
            >
              <List size={17}/>
            </button>
            <button
              type="button"
              onClick={toggleDock}
              className={dockBodyVisible
                ? "mb-1 grid size-9 place-items-center rounded-md bg-[#222225] text-[#C9CDD2] ring-1 ring-inset ring-[#C9CDD2]/70"
                : "mb-1 grid size-9 place-items-center rounded-md text-[#7F8D99] hover:bg-white/[0.04] hover:text-white"}
              title={dockBodyVisible ? "Close positions dock" : "Open positions dock"}
              aria-label={dockBodyVisible ? "Close positions dock" : "Open positions dock"}
            >
              <Layers3 size={17}/>
            </button>
            <button type="button" onClick={onOpenHelp}
              className="mt-auto mb-1 grid size-9 place-items-center rounded-md text-[#7F8D99] hover:bg-white/[0.04] hover:text-white"
              title="Help Center" aria-label="Help Center">
              <CircleHelp size={17}/>
            </button>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                v4Toggle('settings',setChartSettingsOpen);
              }}
              className={v4IsOpen('settings',chartSettingsOpen)
                ? "grid size-9 place-items-center rounded-md bg-[#222225] text-[#C9CDD2] ring-1 ring-inset ring-[#C9CDD2]/70"
                : "grid size-9 place-items-center rounded-md text-[#7F8D99] hover:bg-white/[0.04] hover:text-white"}
              title="Chart appearance settings"
              aria-label="Chart appearance settings"
            >
              <Settings size={17}/>
            </button>
          </aside>

          <DesktopChartSettingsPopover
            open={v4IsOpen('settings',chartSettingsOpen)}
            v4Theme={V4_DESKTOP_EXECUTION_ENABLED}
            settings={chartSettings}
            onChange={next => setChartSettings(normalizeDesktopChartSettings(next))}
            onClose={() => { setChartSettingsOpen(false); v4Close(); }}
          />

          <div className="acg-desktop-dock-shell min-h-0 overflow-hidden rounded-[9px] border border-[#292d31] bg-[#09090B] transition-[height,transform,opacity] duration-300 ease-out" style={{ gridColumn: '1 / 4', gridRow: '2' }}>
            <PositionsPanel desktopDense collapsed={desktopLayout.dockCollapsed} compactDock={dockHeight <= compactDockThreshold && !positionsExpanded} expanded={positionsExpanded} onToggleExpanded={togglePositionsExpanded} requestedTab={requestedDockTab} activeSymbol={activeSymbol} account={account} positions={positions} markets={markets} positionHistory={positionHistory} pendingOrders={pendingOrders} journal={journal} onClosePosition={onClosePosition} onCloseAll={onCloseAllPositions} onCloseWinners={onCloseWinners} onCloseLosers={onCloseLosers} onCloseSymbol={onCloseSymbolPositions} onBreakEven={onBreakEven} onReverse={onReversePosition} onUpdatePosition={updateDesktopProtection} onSetTrailing={onSetTrailing} onDuplicate={onDuplicatePosition} onCancelPending={onCancelPending} onModifyPending={onModifyPending} selectedPositionId={selectedPositionId} onSelectPosition={selectPosition} onEditProtection={editPositionProtection}/>
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
