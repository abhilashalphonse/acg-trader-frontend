import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  CandlestickChart,
  ChartNoAxesCombined,
  ChevronDown,
  History,
  List,
  Maximize2,
  MoreHorizontal,
  Search,
  Settings,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import ChartArea from './ChartArea.jsx';
import DesktopOrderTicket from './desktop/DesktopOrderTicket.jsx';
import DesktopTradeReview from './desktop/DesktopTradeReview.jsx';
import DesktopWorkspaceMenu from './desktop/DesktopWorkspaceMenu.jsx';
import DesktopWatchlist from './desktop/DesktopWatchlist.jsx';
import ResizeHandle from './desktop/ResizeHandle.jsx';
import PositionsPanel from './PositionsPanel.jsx';
import PropRiskStrip from './PropRiskStrip.jsx';
import InstrumentAvatar from './InstrumentAvatar.jsx';

const timeframes = [['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'], ['1H', '1H'], ['4H', '4H'], ['1D', '1D'], ['1W', '1W']];
const chartTimeframeMap = { '1m': 'M1', '5m': 'M5', '15m': 'M15', '30m': 'M30', '1H': 'H1', '4H': 'H4', '1D': 'D1', '1W': 'W1' };
const navItems = [['trade', CandlestickChart, 'Trade'], ['watchlist', Star, 'Watchlist'], ['markets', List, 'Markets'], ['history', History, 'History'], ['more', MoreHorizontal, 'More']];
const DESKTOP_LAYOUT_KEY = 'acg-trader-desktop-layout-v1';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function loadDesktopLayout() {
  const fallback = {
    sidebarWidth: typeof window !== 'undefined' && window.innerWidth >= 1536 ? 390 : 360,
    dockHeight: 200,
    sidebarCollapsed: false,
    dockCollapsed: false,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(DESKTOP_LAYOUT_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    return {
      sidebarWidth: clamp(stored.sidebarWidth || fallback.sidebarWidth, 310, 480),
      dockHeight: clamp(stored.dockHeight || fallback.dockHeight, 150, 340),
      sidebarCollapsed: stored.sidebarCollapsed === true,
      dockCollapsed: stored.dockCollapsed === true,
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
  const [activeNav, setActiveNav] = useState('trade');
  const [notice, setNotice] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [desktopLayout, setDesktopLayout] = useState(loadDesktopLayout);
  const favorite = watchlists?.isWatched?.(activeSymbol) === true;

  useEffect(() => {
    try {
      window.localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(desktopLayout));
    } catch {
      // Layout persistence is optional.
    }
  }, [desktopLayout]);

  const sidebarWidth = desktopLayout.sidebarCollapsed ? 0 : desktopLayout.sidebarWidth;
  const dockHeight = desktopLayout.dockCollapsed ? 0 : desktopLayout.dockHeight;
  const updateSidebarWidth = value => setDesktopLayout(current => ({ ...current, sidebarWidth: clamp(value, 310, 480), sidebarCollapsed: false }));
  const updateDockHeight = value => setDesktopLayout(current => ({ ...current, dockHeight: clamp(value, 150, 340), dockCollapsed: false }));
  const toggleSidebar = () => setDesktopLayout(current => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed }));
  const toggleDock = () => setDesktopLayout(current => ({ ...current, dockCollapsed: !current.dockCollapsed }));
  const resetDesktopLayout = () => setDesktopLayout({
    sidebarWidth: window.innerWidth >= 1536 ? 390 : 360,
    dockHeight: 200,
    sidebarCollapsed: false,
    dockCollapsed: false,
  });

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
    },
  };

  const applyWorkspace = workspace => {
    if (!workspace) return;
    const layout = workspace.layout || {};
    setDesktopLayout(current => ({
      ...current,
      ...layout,
      sidebarWidth: clamp(layout.sidebarWidth ?? current.sidebarWidth, 310, 480),
      dockHeight: clamp(layout.dockHeight ?? current.dockHeight, 150, 340),
    }));
    const trading = workspace.trading || {};
    if (trading.timeframe) onTimeframeChange(trading.timeframe);
    if (trading.chartMode) onChartModeChange(trading.chartMode);
    if (trading.sizingMode) onSizingModeChange(trading.sizingMode);
    if (Number.isFinite(Number(trading.riskPercent))) onRiskPercentChange(Number(trading.riskPercent));
    if (trading.orderType) onOrderTypeChange(trading.orderType);
    if (trading.symbol && markets.some(item => item.symbol === trading.symbol)) onSelectSymbol(trading.symbol);
    if (trading.activeListId) watchlists?.setActiveListId?.(trading.activeListId);
    if (Array.isArray(trading.indicators)) onIndicatorsChange(trading.indicators);
    setNotice(`${workspace.name || 'Workspace'} applied`);
  };

  const currency = account?.currency || 'USD';
  const accountPnl = Number(account?.floatingPnl ?? (Number(account?.equity) - Number(account?.balance)));
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
    if (id === 'more') onOpenSettings();
    else if (id === 'history') setNotice('Use the History tab below for recent server-synced fills.');
    else if (id !== 'trade') searchRef.current?.focus();
  };

  return (
    <div ref={shellRef} className="relative h-dvh min-h-0 overflow-hidden bg-black text-[#f4f8fb]">
      {notice && <div className="absolute right-3 top-[60px] z-[120] flex max-w-[390px] items-center gap-3 rounded-md border border-white/[0.08] bg-[#101010]/95 px-3 py-2.5 text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)]"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="grid size-6 place-items-center rounded-md text-[#8094a7]"><X size={13}/></button></div>}

      <header className="flex h-[52px] items-center border-b border-white/[0.08] bg-[#080808] px-3 shadow-[0_1px_0_rgba(255,255,255,0.015)]">
        <div className="flex min-w-[178px] items-center gap-2">
          <span className="text-[16px] font-extrabold tracking-[-0.03em]">ACG Trader</span>
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-extrabold tracking-[0.06em] text-[#56c6ff]">V2</span>
        </div>

        <div className="ml-2 hidden items-stretch divide-x divide-white/[0.07] rounded-md border border-white/[0.07] bg-black/25 xl:flex">
          {[
            ['Balance', money(account?.balance, currency)],
            ['Equity', money(account?.equity, currency)],
            ['Floating P/L', formatPnl(accountPnl, currency)],
            ['Free margin', money(account?.freeMargin, currency)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-[102px] px-3 py-1.5">
              <span className="block text-[7px] font-semibold uppercase tracking-[0.08em] text-[#52667a]">{label}</span>
              <strong className={`mt-0.5 block text-[10px] font-bold ${label === 'Floating P/L' ? (accountPnl >= 0 ? 'text-[#3dd9a4]' : 'text-[#ff6570]') : 'text-[#dce6ef]'}`}>{value}</strong>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {hotkeysEnabled && <span className="hidden rounded border border-white/[0.07] bg-black/30 px-2 py-1 text-[7px] font-bold text-[#5bc9ff] 2xl:inline">HOTKEYS ON</span>}
          <button type="button" onClick={() => searchRef.current?.focus()} className="grid size-8 place-items-center rounded-md text-[#8fa2b7] hover:bg-white/[0.035] hover:text-white" aria-label="Search"><Search size={16}/></button>
          <button type="button" onClick={() => setNotice('Notification delivery is not connected to a backend event inbox yet.')} className="grid size-8 place-items-center rounded-md border border-white/[0.07] bg-black/20 text-[#8fa2b7]" aria-label="Notifications"><Bell size={15}/></button>
          <button type="button" onClick={() => setNotice(`${account?.accountCode || 'Trading account'} • ${accountStatus} • ${valuationStatus}`)} className="flex h-8 items-center gap-2 rounded-md border border-white/[0.07] bg-black/20 px-2.5 text-left">
            <span className={`size-1.5 rounded-full ${canOpen ? 'bg-[#2fd9a0]' : valuationStatus === 'STALE' ? 'bg-[#e8bd55]' : 'bg-[#343434]'}`}/>
            <div className="leading-none"><strong className="block text-[9px]">{money(account?.equity, currency)}</strong><span className="mt-1 block text-[7px] text-[#64788d]">{account?.accountCode || accountStatus}</span></div>
          </button>
          <button type="button" onClick={() => setNotice(`Account ${accountStatus.toLowerCase()} • valuation ${valuationStatus.toLowerCase()}`)} className="grid size-8 place-items-center rounded-full border border-white/[0.07] bg-black/20 text-[#8ea3ba]" aria-label="Profile"><UserRound size={15}/></button>
        </div>
      </header>

      <div className="grid h-[calc(100dvh-52px)] min-h-0 grid-cols-[48px_minmax(0,1fr)] 2xl:grid-cols-[52px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col items-center border-r border-white/[0.08] bg-[#080808] py-1.5">
          {navItems.map(([id, Icon, label]) => {
            const active = activeNav === id;
            return (
              <button key={id} type="button" title={label} onClick={() => handleNav(id)} className={`mb-0.5 flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded text-[6.5px] font-semibold transition ${active ? 'border-l-2 border-[#53c7ff] bg-white/[0.02] text-[#53c7ff]' : 'text-[#65798e] hover:bg-white/[0.03] hover:text-[#c8d6e3]'}`}>
                <Icon size={16} strokeWidth={1.8}/><span>{label}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <button type="button" onClick={onOpenSettings} title="Settings" className="grid size-10 place-items-center rounded-md text-[#65798e] hover:bg-white/[0.03] hover:text-white"><Settings size={16}/></button>
        </aside>

        <div
          className="relative grid min-h-0 min-w-0 bg-[#080808]"
          style={{
            gridTemplateColumns: `minmax(0, 1fr) ${sidebarWidth}px`,
            gridTemplateRows: `minmax(0, 1fr) ${dockHeight}px`,
          }}
        >
          <section className="grid min-h-0 min-w-0 grid-rows-[48px_28px_38px_minmax(0,1fr)]">
            <div className="flex items-center border-b border-white/[0.08] bg-[#080808] px-3">
              <div className="flex min-w-[210px] items-center gap-2">
                <InstrumentAvatar instrument={market} size={28}/>
                <div className="min-w-0">
                  <button type="button" onClick={() => searchRef.current?.focus()} className="flex items-center gap-1 text-[13px] font-extrabold tracking-[-0.025em] text-[#f3f7fb]">{market?.displaySymbol || displaySymbol(market?.symbol)}<ChevronDown size={12}/></button>
                  <span className="mt-0.5 block truncate text-[7px] text-[#5f7388]">{marketLabel(market)}</span>
                </div>
              </div>
              <div className="ml-3">
                <strong className="block font-mono text-[15px] tracking-[-0.02em] text-[#edf5fb]">{market?.bid || '—'}</strong>
                <span className={`mt-0.5 block text-[7px] font-semibold ${market?.live ? 'text-[#35d49f]' : market?.isStale ? 'text-[#e7bd58]' : 'text-[#718398]'}`}>{market?.sessionOpen === false ? 'SESSION CLOSED' : market?.live ? 'LIVE' : market?.isStale ? 'STALE' : market?.marketState || 'WAITING'}</span>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="hidden text-right xl:block"><span className="block text-[6.5px] uppercase tracking-[0.08em] text-[#506477]">Valuation</span><b className={`mt-0.5 block text-[8px] ${valuationStatus === 'LIVE' ? 'text-[#3dd9a4]' : valuationStatus === 'STALE' ? 'text-[#e7bd58]' : 'text-[#a0b0bf]'}`}>{valuationStatus}</b></div>
                <button type="button" onClick={() => watchlists?.toggleSymbol?.(activeSymbol)} className={`grid size-7 place-items-center rounded-md hover:bg-white/[0.035] ${favorite ? 'text-[#f6c95d]' : 'text-[#687d92]'}`}><Star size={14} fill={favorite ? 'currentColor' : 'none'}/></button>
              </div>
            </div>

            <div className="min-h-0 overflow-hidden border-b border-white/[0.07]">
              <PropRiskStrip account={account} plannedRisk={plannedRisk} compact />
            </div>

            <div className="flex items-center gap-1.5 border-b border-white/[0.08] bg-[#080808] px-2.5">
              <div className="flex items-center gap-0.5">
                {timeframes.map(([label, value]) => (
                  <button key={value} type="button" onClick={() => onTimeframeChange(value)} disabled={Boolean(tradePlan && !tradePlan.open)} className={`h-6 min-w-7 rounded px-1.5 text-[7px] font-bold ${timeframe === value ? 'bg-white/[0.05] text-[#58c7ff]' : 'text-[#6d8298] hover:bg-white/[0.035] hover:text-[#d7e2ec]'} disabled:opacity-30`}>{label}</button>
                ))}
              </div>
              <div className="mx-1 h-4 w-px bg-white/[0.07]"/>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => onChartModeChange('candles')} disabled={Boolean(tradePlan && !tradePlan.open)} className={`grid size-6 place-items-center rounded ${chartMode === 'candles' ? 'bg-white/[0.05] text-[#58c7ff]' : 'text-[#6d8298]'} disabled:opacity-30`} title="Candlesticks"><CandlestickChart size={13}/></button>
                <button type="button" onClick={() => onChartModeChange('line')} disabled={Boolean(tradePlan && !tradePlan.open)} className={`grid size-6 place-items-center rounded ${chartMode === 'line' ? 'bg-white/[0.05] text-[#58c7ff]' : 'text-[#6d8298]'} disabled:opacity-30`} title="Line chart"><ChartNoAxesCombined size={13}/></button>
                <button type="button" onClick={onOpenIndicators} className={`relative grid size-6 place-items-center rounded text-[9px] font-black hover:text-white ${indicators.length ? 'bg-white/[0.05] text-[#5bc9ff]' : 'text-[#6d8298]'}`} title="Indicators">ƒx{indicators.length > 0 && <span className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-[#151515] text-[5px] text-white">{indicators.length}</span>}</button>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <DesktopWorkspaceMenu snapshot={workspaceSnapshot} onApply={applyWorkspace}/>
                <button type="button" onClick={() => setReviewOpen(true)} className="flex h-7 items-center gap-1 rounded-md border border-white/[0.07] bg-black/20 px-2 text-[7px] font-bold text-[#73889d] hover:text-white" title="Trade review"><BookOpen size={12}/>Review</button>
                <button type="button" onClick={toggleSidebar} className={`h-6 rounded border px-2 text-[7px] font-bold uppercase tracking-[0.05em] transition ${desktopLayout.sidebarCollapsed ? 'border-[#315b72] bg-[#0d1a22] text-[#58c7ff]' : 'border-white/[0.07] bg-black/20 text-[#73889d] hover:text-white'}`} title={desktopLayout.sidebarCollapsed ? 'Show right panel' : 'Hide right panel'}>Right</button>
                <button type="button" onClick={toggleDock} className={`h-6 rounded border px-2 text-[7px] font-bold uppercase tracking-[0.05em] transition ${desktopLayout.dockCollapsed ? 'border-[#315b72] bg-[#0d1a22] text-[#58c7ff]' : 'border-white/[0.07] bg-black/20 text-[#73889d] hover:text-white'}`} title={desktopLayout.dockCollapsed ? 'Show positions dock' : 'Hide positions dock'}>Dock</button>
                <button type="button" onClick={resetDesktopLayout} className="h-6 rounded border border-white/[0.07] bg-black/20 px-2 text-[7px] font-bold uppercase tracking-[0.05em] text-[#73889d] hover:text-white" title="Reset desktop layout">Reset</button>
                <button type="button" onClick={toggleFullscreen} className="grid size-7 place-items-center rounded-md border border-white/[0.07] bg-black/20 text-[#73889d] hover:text-white" title="Fullscreen"><Maximize2 size={13}/></button>
              </div>
            </div>

            <div className="min-h-0 min-w-0 bg-[#080808]">
              <ChartArea desktopEnhanced symbol={market?.symbol} instrument={market} chartTimeframe={chartTimeframeMap[timeframe] || 'M1'} tick={tick} price={market?.bid} ask={market?.ask} chartMode={chartMode} selectedTool={selectedTool} onSelectTool={onSelectedToolChange} embedded tradePlan={tradePlan} onTradePlanChange={onTradePlanChange} onUpdatePosition={onUpdatePosition} indicators={indicators} positions={positions}/>
            </div>
          </section>

          <aside className={`min-h-0 flex-col border-l border-white/[0.08] bg-[#080808] ${desktopLayout.sidebarCollapsed ? 'hidden' : 'flex'}`}>
            <DesktopWatchlist
              markets={markets}
              activeSymbol={activeSymbol}
              onSelectSymbol={onSelectSymbol}
              watchlists={watchlists}
              mode={activeNav === 'markets' ? 'markets' : 'watchlist'}
              searchRef={searchRef}
            />

            <DesktopOrderTicket market={market} markets={markets} account={account} positions={positions} positionHistory={positionHistory} exposureAllowed={exposureAllowed} exposureBlockReason={exposureBlockReason} lots={lots} onLotsChange={onLotsChange} sizingMode={sizingMode} onSizingModeChange={onSizingModeChange} riskPercent={riskPercent} onRiskPercentChange={onRiskPercentChange} orderType={orderType} onOrderTypeChange={onOrderTypeChange} tradePlan={tradePlan} onStartPlan={onStartPlan} onCancelPlan={onCancelPlan} onExecutePlan={onExecutePlan} onModifyPlan={onModifyPlan} onManualOrder={submitOneClick} onTradePlanChange={onTradePlanChange} riskGuardSettings={riskGuardSettings} onRiskGuardSettingsChange={onRiskGuardSettingsChange}/>
          </aside>

          <div className={`col-span-2 min-h-0 overflow-auto border-t border-white/[0.08] bg-[#080808] ${desktopLayout.dockCollapsed ? 'hidden' : ''}`}>
            <PositionsPanel desktopDense positions={positions} markets={markets} positionHistory={positionHistory} pendingOrders={pendingOrders} journal={journal} onClosePosition={onClosePosition} onCloseAll={onCloseAllPositions} onBreakEven={onBreakEven} onReverse={onReversePosition} onUpdatePosition={onUpdatePosition} onSetTrailing={onSetTrailing} onDuplicate={onDuplicatePosition} onCancelPending={onCancelPending} onModifyPending={onModifyPending}/>
          </div>

          {!desktopLayout.sidebarCollapsed && (
            <ResizeHandle
              axis="x"
              value={desktopLayout.sidebarWidth}
              min={310}
              max={480}
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
              min={150}
              max={340}
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
