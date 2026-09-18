import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
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
import ExecutionPanel from './ExecutionPanel.jsx';
import PositionsPanel from './PositionsPanel.jsx';
import PropRiskStrip from './PropRiskStrip.jsx';

const timeframes = [['1s', '1s'], ['5s', '5s'], ['15s', '15s'], ['30s', '30s'], ['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['1h', '1h'], ['4h', '4h'], ['D', '1d']];
const chartTimeframeMap = { '1s': 'S1', '5s': 'S5', '15s': 'S15', '30s': 'S30', '1m': 'M1', '5m': 'M5', '15m': 'M15', '1h': 'H1', '4h': 'H4', '1d': 'D1' };
const navItems = [['trade', CandlestickChart, 'Trade'], ['watchlist', Star, 'Watchlist'], ['markets', List, 'Markets'], ['history', History, 'History'], ['more', MoreHorizontal, 'More']];

function displaySymbol(symbol = '') {
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol || '—';
}

function money(value, currency = 'USD') {
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
}) {
  const shellRef = useRef(null);
  const searchRef = useRef(null);
  const [activeNav, setActiveNav] = useState('trade');
  const [search, setSearch] = useState('');
  const [favorite, setFavorite] = useState(true);
  const [notice, setNotice] = useState('');

  const currency = account?.currency || 'USD';
  const accountPnl = Number(account?.floatingPnl ?? (Number(account?.equity) - Number(account?.balance)));
  const valuationStatus = String(account?.valuationStatus || 'WAITING').toUpperCase();
  const accountStatus = String(account?.status || 'UNKNOWN').toUpperCase();
  const canOpen = executableMarket(market) && accountStatus === 'ACTIVE' && account?.tradingEnabled === true && valuationStatus === 'LIVE';

  const filteredMarkets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return markets;
    return markets.filter(item => `${item.symbol} ${item.name || ''} ${item.assetClass || ''}`.toLowerCase().includes(query));
  }, [markets, search]);

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
      setNotice('New exposure is unavailable until account, valuation and market state are live.');
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
    <div ref={shellRef} className="relative h-dvh min-h-[720px] overflow-hidden bg-[#02070c] text-[#f4f8fb]">
      {notice && <div className="absolute right-4 top-[72px] z-[120] flex max-w-[390px] items-center gap-3 rounded-xl border border-[#24445a] bg-[#0b1b28]/95 px-3 py-2.5 text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)]"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="grid size-6 place-items-center rounded-md text-[#8094a7]"><X size={13}/></button></div>}

      <header className="flex h-16 items-center border-b border-[#172737] bg-[#060d14] px-4 shadow-[0_1px_0_rgba(255,255,255,0.015)]">
        <div className="flex min-w-[205px] items-center gap-2"><span className="text-[17px] font-extrabold tracking-[-0.03em]">ACG Trader</span><span className="rounded-md bg-[#0d2b42] px-1.5 py-1 text-[9px] font-extrabold tracking-[0.05em] text-[#56c6ff]">V2</span></div>
        <div className="ml-3 hidden items-stretch divide-x divide-[#172737] rounded-xl border border-[#172737] bg-[#08111a] xl:flex">{[
          ['Balance', money(account?.balance, currency)],
          ['Equity', money(account?.equity, currency)],
          ['Floating P/L', formatPnl(accountPnl, currency)],
          ['Free margin', money(account?.freeMargin, currency)],
        ].map(([label, value]) => <div key={label} className="min-w-[112px] px-3 py-2"><span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#52667a]">{label}</span><strong className={`mt-0.5 block text-[11px] font-bold ${label === 'Floating P/L' ? (accountPnl >= 0 ? 'text-[#3dd9a4]' : 'text-[#ff6570]') : 'text-[#dce6ef]'}`}>{value}</strong></div>)}</div>
        <div className="ml-auto flex items-center gap-2">
          {hotkeysEnabled && <span className="hidden rounded-md border border-[#1d3c50] bg-[#0c2230] px-2 py-1 text-[7px] font-bold text-[#5bc9ff] 2xl:inline">HOTKEYS ON</span>}
          <button type="button" onClick={() => searchRef.current?.focus()} className="grid size-9 place-items-center rounded-lg text-[#8fa2b7] hover:bg-white/[0.035] hover:text-white" aria-label="Search"><Search size={18}/></button>
          <button type="button" onClick={() => setNotice('Notification delivery is not connected to a backend event inbox yet.')} className="grid size-9 place-items-center rounded-lg border border-[#192a39] bg-[#08121b] text-[#8fa2b7]" aria-label="Notifications"><Bell size={17}/></button>
          <button type="button" onClick={() => setNotice(`${account?.accountCode || 'Trading account'} • ${accountStatus} • ${valuationStatus}`)} className="flex h-9 items-center gap-2 rounded-lg border border-[#192a39] bg-[#08121b] px-3 text-left"><span className={`size-1.5 rounded-full ${canOpen ? 'bg-[#2fd9a0]' : valuationStatus === 'STALE' ? 'bg-[#e8bd55]' : 'bg-[#6f8091]'}`}/><div className="leading-none"><strong className="block text-[10px]">{money(account?.equity, currency)}</strong><span className="mt-1 block text-[8px] text-[#64788d]">{account?.accountCode || accountStatus}</span></div></button>
          <button type="button" onClick={() => setNotice(`Account ${accountStatus.toLowerCase()} • valuation ${valuationStatus.toLowerCase()}`)} className="grid size-9 place-items-center rounded-full border border-[#192a39] bg-[#0a151f] text-[#8ea3ba]" aria-label="Profile"><UserRound size={17}/></button>
        </div>
      </header>

      <div className="grid h-[calc(100dvh-64px)] min-h-[656px] grid-cols-[58px_230px_minmax(0,1fr)] 2xl:grid-cols-[62px_270px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col items-center border-r border-[#172737] bg-[#050c13] py-2">
          {navItems.map(([id, Icon, label]) => { const active = activeNav === id; return <button key={id} type="button" title={label} onClick={() => handleNav(id)} className={`mb-1 flex h-12 w-11 flex-col items-center justify-center gap-1 rounded-xl text-[7px] font-semibold transition ${active ? 'bg-[#0d2537] text-[#53c7ff]' : 'text-[#65798e] hover:bg-white/[0.03] hover:text-[#c8d6e3]'}`}><Icon size={18} strokeWidth={1.8}/><span>{label}</span></button>; })}
          <div className="flex-1" />
          <button type="button" onClick={onOpenSettings} title="Settings" className="grid size-11 place-items-center rounded-xl text-[#65798e] hover:bg-white/[0.03] hover:text-white"><Settings size={18}/></button>
        </aside>

        <aside className="min-h-0 overflow-hidden border-r border-[#172737] bg-[#071019]">
          <div className="flex h-14 items-center justify-between border-b border-[#172737] px-3"><div><strong className="block text-[10px] font-extrabold tracking-[0.08em] text-[#dce7f1]">MARKET WATCH</strong><span className="mt-1 block text-[8px] text-[#5f7388]">{markets.length} backend instruments</span></div><button type="button" onClick={() => searchRef.current?.focus()} className="grid size-7 place-items-center rounded-md text-[#65798d] hover:bg-white/[0.03]" title="Search"><Search size={14}/></button></div>
          <div className="p-2"><div className="flex h-8 items-center gap-2 rounded-lg border border-[#182938] bg-[#09131d] px-2 text-[#687c91]"><Search size={13}/><input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search instruments" className="min-w-0 flex-1 bg-transparent text-[9px] text-[#c7d4e0] outline-none placeholder:text-[#52667a]"/></div></div>
          <div className="grid grid-cols-[1fr_.72fr_.72fr] border-y border-[#152433] px-3 py-2 text-[7px] font-bold uppercase tracking-[0.08em] text-[#52667a]"><span>Instrument</span><span className="text-right">Bid</span><span className="text-right">Ask</span></div>
          <div className="max-h-[calc(100dvh-160px)] overflow-y-auto">{filteredMarkets.map(item => { const selected = item.symbol === activeSymbol; return <button key={item.symbol} type="button" onClick={() => onSelectSymbol(item.symbol)} className={`grid w-full grid-cols-[1fr_.72fr_.72fr] items-center border-b border-[#111f2c] px-3 py-2.5 text-left transition ${selected ? 'bg-[#0d2232] shadow-[inset_2px_0_#49bfff]' : 'hover:bg-[#0a1722]'}`}><span className="min-w-0"><b className="block text-[10px] text-[#dce7f1]">{displaySymbol(item.symbol)}</b><small className={`mt-1 block truncate text-[7px] ${item.live ? 'text-[#38d6a2]' : item.isStale ? 'text-[#e7bd58]' : 'text-[#687d92]'}`}>{item.live ? 'LIVE' : item.isStale ? 'STALE' : item.marketState || 'WAITING'}</small></span><b className="text-right font-mono text-[9px] text-[#a9bac9]">{item.bid || '—'}</b><span className="text-right font-mono text-[9px] text-[#8ea1b5]">{item.ask || '—'}</span></button>; })}</div>
        </aside>

        <section className="grid min-h-0 grid-rows-[60px_36px_44px_minmax(0,1fr)_104px_250px] bg-[#060d14] 2xl:grid-rows-[62px_36px_46px_minmax(0,1fr)_108px_260px]">
          <div className="flex items-center border-b border-[#172737] bg-[#08111a] px-4"><div className="min-w-[240px]"><button type="button" onClick={() => searchRef.current?.focus()} className="flex items-center gap-1 text-[15px] font-extrabold tracking-[-0.025em] text-[#f3f7fb]">{displaySymbol(market?.symbol)}<ChevronDown size={14}/></button><span className="mt-1 block text-[8px] text-[#5f7388]">{marketLabel(market)}</span></div><div className="ml-4"><strong className="block font-mono text-[17px] tracking-[-0.02em] text-[#edf5fb]">{market?.bid || '—'}</strong><span className={`mt-1 block text-[8px] font-semibold ${market?.live ? 'text-[#35d49f]' : market?.isStale ? 'text-[#e7bd58]' : 'text-[#718398]'}`}>{market?.sessionOpen === false ? 'SESSION CLOSED' : market?.live ? 'LIVE' : market?.isStale ? 'STALE' : market?.marketState || 'WAITING'}</span></div><div className="ml-auto flex items-center gap-4"><div className="hidden text-right xl:block"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#506477]">Valuation</span><b className={`mt-1 block text-[9px] ${valuationStatus === 'LIVE' ? 'text-[#3dd9a4]' : valuationStatus === 'STALE' ? 'text-[#e7bd58]' : 'text-[#a0b0bf]'}`}>{valuationStatus}</b></div><button type="button" onClick={() => setFavorite(v => !v)} className={`grid size-8 place-items-center rounded-lg hover:bg-white/[0.035] ${favorite ? 'text-[#f6c95d]' : 'text-[#687d92]'}`}><Star size={16} fill={favorite ? 'currentColor' : 'none'}/></button></div></div>

          <PropRiskStrip account={account} plannedRisk={plannedRisk} compact />

          <div className="flex items-center gap-2 border-b border-[#172737] bg-[#071019] px-3"><div className="flex items-center gap-0.5 rounded-lg border border-[#1a2c3c] bg-[#09131d] p-1">{timeframes.map(([label, value]) => <button key={value} type="button" onClick={() => onTimeframeChange(value)} disabled={Boolean(tradePlan)} className={`h-7 min-w-8 rounded-md px-2 text-[8px] font-bold ${timeframe === value ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298] hover:bg-white/[0.035] hover:text-[#d7e2ec]'} disabled:opacity-30`}>{label}</button>)}</div><div className="h-5 w-px bg-[#1b2c3b]"/><div className="flex items-center gap-0.5 rounded-lg border border-[#1a2c3c] bg-[#09131d] p-1"><button type="button" onClick={() => onChartModeChange('candles')} disabled={Boolean(tradePlan)} className={`grid size-7 place-items-center rounded-md ${chartMode === 'candles' ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298]'} disabled:opacity-30`} title="Candlesticks"><CandlestickChart size={15}/></button><button type="button" onClick={() => onChartModeChange('line')} disabled={Boolean(tradePlan)} className={`grid size-7 place-items-center rounded-md ${chartMode === 'line' ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298]'} disabled:opacity-30`} title="Line chart"><ChartNoAxesCombined size={15}/></button><button type="button" onClick={onOpenIndicators} className={`relative grid size-7 place-items-center rounded-md text-[10px] font-black hover:text-white ${indicators.length ? 'bg-[#102b3d] text-[#5bc9ff]' : 'text-[#6d8298]'}`} title="Indicators">ƒx{indicators.length > 0 && <span className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full bg-[#1e5a7d] text-[6px] text-white">{indicators.length}</span>}</button></div><button type="button" onClick={toggleFullscreen} className="ml-auto grid size-8 place-items-center rounded-lg border border-[#1a2c3c] bg-[#09131d] text-[#73889d] hover:text-white" title="Fullscreen"><Maximize2 size={15}/></button></div>

          <div className="min-h-0 min-w-0 bg-[#080f17]"><ChartArea symbol={market?.symbol} chartTimeframe={chartTimeframeMap[timeframe] || 'M1'} tick={tick} price={market?.bid} ask={market?.ask} chartMode={chartMode} selectedTool={selectedTool} onSelectTool={onSelectedToolChange} embedded tradePlan={tradePlan} onTradePlanChange={onTradePlanChange} indicators={indicators} positions={positions}/></div>

          <div className="border-t border-[#172737] bg-[#071019] px-2 pb-2"><ExecutionPanel market={market} focusMode lots={lots} onLotsChange={onLotsChange} sizingMode={sizingMode} onSizingModeChange={onSizingModeChange} riskPercent={riskPercent} onRiskPercentChange={onRiskPercentChange} orderType={orderType} onOrderTypeChange={onOrderTypeChange} tradePlan={tradePlan} onStartPlan={onStartPlan} onCancelPlan={onCancelPlan} onExecutePlan={onExecutePlan} onModifyPlan={onModifyPlan} onManualOrder={submitOneClick} onTradePlanChange={onTradePlanChange}/></div>

          <div className="min-h-0 overflow-y-auto border-t border-[#172737] bg-[#050c13] px-2 pb-2"><PositionsPanel positions={positions} positionHistory={positionHistory} pendingOrders={pendingOrders} journal={journal} onClosePosition={onClosePosition} onCloseAll={onCloseAllPositions} onBreakEven={onBreakEven} onReverse={onReversePosition} onUpdatePosition={onUpdatePosition} onSetTrailing={onSetTrailing} onDuplicate={onDuplicatePosition} onCancelPending={onCancelPending} onModifyPending={onModifyPending}/></div>
        </section>
      </div>
    </div>
  );
}
