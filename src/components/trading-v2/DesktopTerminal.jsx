import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  CandlestickChart,
  ChartNoAxesCombined,
  ChevronDown,
  Copy,
  Crosshair,
  History,
  LineChart,
  List,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Repeat2,
  Ruler,
  Search,
  Settings,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Star,
  Type,
  UserRound,
  X,
} from 'lucide-react';
import ChartArea from './ChartArea.jsx';
import PropRiskStrip, { calculateRiskSummary } from './PropRiskStrip.jsx';

const timeframes = [['1s', '1s'], ['5s', '5s'], ['15s', '15s'], ['30s', '30s'], ['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['1h', '1h'], ['4h', '4h'], ['D', '1d']];
const chartTimeframeMap = { '1s': 'S1', '5s': 'S5', '15s': 'S15', '30s': 'S30', '1m': 'M1', '5m': 'M5', '15m': 'M15', '1h': 'H1', '4h': 'H4', '1d': 'D1' };
const drawingTools = [['cursor', MousePointer2, 'Select'], ['trendline', LineChart, 'Trend line'], ['hline', SlidersHorizontal, 'Horizontal line'], ['vline', Ruler, 'Vertical line'], ['rectangle', Square, 'Rectangle'], ['fibonacci', Shapes, 'Fibonacci'], ['text', Type, 'Text']];
const orderTypes = [['market', 'Market'], ['limit', 'Limit'], ['stop', 'Stop'], ['stop-limit', 'Stop Limit']];
const navItems = [['trade', CandlestickChart, 'Trade'], ['watchlist', Star, 'Watchlist'], ['markets', List, 'Markets'], ['history', History, 'History'], ['more', MoreHorizontal, 'More']];

function displaySymbol(symbol = '') {
  if (symbol.includes('/')) return symbol;
  if (symbol.length === 6) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}

function marketName(symbol) {
  const names = { AUDCAD: 'Australian Dollar / Canadian Dollar', EURUSD: 'Euro / US Dollar', GBPUSD: 'British Pound / US Dollar', USDJPY: 'US Dollar / Japanese Yen', XAUUSD: 'Gold / US Dollar', US30: 'Dow Jones 30' };
  return names[symbol] || symbol;
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toFixed(Math.abs(number) > 100 ? 2 : 5);
}

function formatPnl(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? '+' : '-'}$${Math.abs(number).toFixed(2)}`;
}

function planMetrics(plan, riskPercent, lots, equity) {
  if (!plan) return null;
  const entry = Number(plan.entry) || 0;
  const sl = Number(plan.sl) || entry;
  const tp = Number(plan.tp) || entry;
  const pip = entry > 100 ? 0.01 : 0.0001;
  const slPips = Math.max(0.1, Math.abs(entry - sl) / pip);
  const tpPips = Math.max(0.1, Math.abs(tp - entry) / pip);
  const volume = plan.sizingMode === 'risk' ? Math.max(0.01, (Number(equity) * (Number(riskPercent) / 100)) / Math.max(slPips * 10, 0.01)) : Number(plan.manualLots ?? lots);
  return { slPips, tpPips, lots: volume, rr: tpPips / slPips };
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
  const watchSearchRef = useRef(null);
  const [activeNav, setActiveNav] = useState('trade');
  const [tab, setTab] = useState('positions');
  const [watchSearch, setWatchSearch] = useState('');
  const [favorite, setFavorite] = useState(true);
  const [positionMenuId, setPositionMenuId] = useState(null);
  const [notice, setNotice] = useState('');
  const [orderOpen, setOrderOpen] = useState(false);
  const [sizingOpen, setSizingOpen] = useState(false);

  const filteredMarkets = useMemo(() => {
    const query = watchSearch.trim().toLowerCase();
    return query ? markets.filter(item => item.symbol.toLowerCase().includes(query)) : markets;
  }, [markets, watchSearch]);

  const symbolLabel = displaySymbol(market?.symbol || 'AUDCAD');
  const positive = !String(market?.change || '').startsWith('-');
  const notify = message => setNotice(message);
  const riskSummary = calculateRiskSummary(account, plannedRisk);
  const metrics = planMetrics(tradePlan, riskPercent, lots, account?.equity);
  const accountPnl = Number(account?.equity || 0) - Number(account?.balance || 0);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await shellRef.current?.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (error) {
      console.warn('Fullscreen unavailable', error);
    }
  };

  const clickSide = side => {
    if (orderType !== 'market') { onStartPlan(side, orderType); return; }
    if (sizingMode === 'risk') { onStartPlan(side, 'market'); return; }
    onManualOrder({ side, lots, price: side === 'buy' ? market?.ask : market?.bid, symbol: market?.symbol });
  };

  const handleNav = id => {
    setActiveNav(id);
    if (id === 'more') { onOpenSettings(); return; }
    if (id === 'history') { setTab('history'); return; }
    if (id !== 'trade') notify(`${navItems.find(item => item[0] === id)?.[2]} workspace is available from the mobile-first shell`);
  };

  return (
    <div ref={shellRef} className="relative h-dvh min-h-[720px] overflow-hidden bg-[#02070c] text-[#f4f8fb]">
      {notice && <div className="absolute right-4 top-[72px] z-50 flex max-w-[360px] items-center gap-3 rounded-xl border border-[#24445a] bg-[#0b1b28]/95 px-3 py-2.5 text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)]"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="grid size-6 place-items-center rounded-md text-[#8094a7]"><X size={13}/></button></div>}

      <header className="flex h-16 items-center border-b border-[#172737] bg-[#060d14] px-4 shadow-[0_1px_0_rgba(255,255,255,0.015)]">
        <div className="flex min-w-[205px] items-center gap-2"><span className="text-[17px] font-extrabold tracking-[-0.03em]">ACG Trader</span><span className="rounded-md bg-[#0d2b42] px-1.5 py-1 text-[9px] font-extrabold tracking-[0.05em] text-[#56c6ff]">V2</span></div>
        <div className="ml-3 hidden items-stretch divide-x divide-[#172737] rounded-xl border border-[#172737] bg-[#08111a] xl:flex">{[
          ['Balance', `$${Number(account?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
          ['Equity', `$${Number(account?.equity || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
          ['P/L', formatPnl(accountPnl)],
          ['Daily room', `$${riskSummary.remainingDaily.toFixed(0)}`],
        ].map(([label, value]) => <div key={label} className="min-w-[106px] px-3 py-2"><span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#52667a]">{label}</span><strong className={`mt-0.5 block text-[11px] font-bold ${label === 'P/L' ? (accountPnl >= 0 ? 'text-[#3dd9a4]' : 'text-[#ff6570]') : 'text-[#dce6ef]'}`}>{value}</strong></div>)}</div>
        <div className="ml-auto flex items-center gap-2">
          {hotkeysEnabled && <span className="hidden rounded-md border border-[#1d3c50] bg-[#0c2230] px-2 py-1 text-[7px] font-bold text-[#5bc9ff] 2xl:inline">HOTKEYS ON</span>}
          <button type="button" onClick={() => watchSearchRef.current?.focus()} className="grid size-9 place-items-center rounded-lg text-[#8fa2b7] hover:bg-white/[0.035] hover:text-white" aria-label="Search"><Search size={18}/></button>
          <button type="button" onClick={() => notify('Notifications frontend state opened')} className="relative grid size-9 place-items-center rounded-lg border border-[#192a39] bg-[#08121b] text-[#8fa2b7]" aria-label="Notifications"><Bell size={17}/><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#ff5968]"/></button>
          <button type="button" onClick={() => notify('Account summary frontend state opened')} className="flex h-9 items-center gap-2 rounded-lg border border-[#192a39] bg-[#08121b] px-3 text-left"><span className="size-1.5 rounded-full bg-[#2fd9a0]"/><div className="leading-none"><strong className="block text-[10px]">${Number(account?.equity || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong><span className="mt-1 block text-[8px] text-[#64788d]">Challenge</span></div></button>
          <button type="button" onClick={() => notify('Profile frontend state opened')} className="grid size-9 place-items-center rounded-full border border-[#192a39] bg-[#0a151f] text-[#8ea3ba]" aria-label="Profile"><UserRound size={17}/></button>
        </div>
      </header>

      <div className="grid h-[calc(100dvh-64px)] min-h-[656px] grid-cols-[58px_220px_minmax(0,1fr)] 2xl:grid-cols-[62px_260px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col items-center border-r border-[#172737] bg-[#050c13] py-2">
          {navItems.map(([id, Icon, label]) => { const active = activeNav === id; return <button key={id} type="button" title={label} onClick={() => handleNav(id)} className={`mb-1 flex h-12 w-11 flex-col items-center justify-center gap-1 rounded-xl text-[7px] font-semibold transition ${active ? 'bg-[#0d2537] text-[#53c7ff]' : 'text-[#65798e] hover:bg-white/[0.03] hover:text-[#c8d6e3]'}`}><Icon size={18} strokeWidth={1.8}/><span>{label}</span></button>; })}
          <div className="flex-1" />
          <button type="button" onClick={onOpenSettings} title="Settings" className="grid size-11 place-items-center rounded-xl text-[#65798e] hover:bg-white/[0.03] hover:text-white"><Settings size={18}/></button>
        </aside>

        <aside className="min-h-0 overflow-hidden border-r border-[#172737] bg-[#071019]">
          <div className="flex h-14 items-center justify-between border-b border-[#172737] px-3"><div><strong className="block text-[10px] font-extrabold tracking-[0.08em] text-[#dce7f1]">MARKET WATCH</strong><span className="mt-1 block text-[8px] text-[#5f7388]">{markets.length} symbols</span></div><div className="flex items-center gap-1"><button type="button" onClick={() => watchSearchRef.current?.focus()} className="grid size-7 place-items-center rounded-md text-[#65798d] hover:bg-white/[0.03]" title="Add symbol"><Plus size={16}/></button><button type="button" onClick={() => notify('Market Watch options frontend state opened')} className="grid size-7 place-items-center rounded-md text-[#65798d] hover:bg-white/[0.03]" title="Market Watch options"><MoreHorizontal size={17}/></button></div></div>
          <div className="p-2"><div className="flex h-8 items-center gap-2 rounded-lg border border-[#182938] bg-[#09131d] px-2 text-[#687c91]"><Search size={13}/><input ref={watchSearchRef} value={watchSearch} onChange={event => setWatchSearch(event.target.value)} placeholder="Search symbols" className="min-w-0 flex-1 bg-transparent text-[9px] text-[#c7d4e0] outline-none placeholder:text-[#52667a]"/></div></div>
          <div className="grid grid-cols-[1fr_.72fr_.72fr] border-y border-[#152433] px-3 py-2 text-[7px] font-bold uppercase tracking-[0.08em] text-[#52667a]"><span>Symbol</span><span className="text-right">Bid</span><span className="text-right">Ask</span></div>
          <div className="overflow-y-auto">{filteredMarkets.map(item => { const selected = item.symbol === activeSymbol; return <button key={item.symbol} type="button" onClick={() => onSelectSymbol(item.symbol)} className={`grid w-full grid-cols-[1fr_.72fr_.72fr] items-center border-b border-[#111f2c] px-3 py-2.5 text-left transition ${selected ? 'bg-[#0d2232] shadow-[inset_2px_0_#49bfff]' : 'hover:bg-[#0a1722]'}`}><span className="min-w-0"><b className="block text-[10px] text-[#dce7f1]">{displaySymbol(item.symbol)}</b><small className={`mt-1 block text-[7px] ${String(item.change).startsWith('-') ? 'text-[#ff6570]' : 'text-[#38d6a2]'}`}>{item.change}</small></span><b className="text-right font-mono text-[9px] text-[#a9bac9]">{item.bid}</b><span className="text-right font-mono text-[9px] text-[#8ea1b5]">{item.ask}</span></button>; })}</div>
        </aside>

        <section className="grid min-h-0 grid-rows-[58px_36px_46px_minmax(0,1fr)_82px_210px] bg-[#060d14] 2xl:grid-rows-[62px_36px_48px_minmax(0,1fr)_86px_220px]">
          <div className="flex items-center border-b border-[#172737] bg-[#08111a] px-4"><div className="min-w-[220px]"><button type="button" onClick={() => watchSearchRef.current?.focus()} className="flex items-center gap-1 text-[15px] font-extrabold tracking-[-0.025em] text-[#f3f7fb]">{symbolLabel}<ChevronDown size={14}/></button><span className="mt-1 block text-[8px] text-[#5f7388]">{marketName(market?.symbol)}</span></div><div className="ml-4"><strong className="block font-mono text-[17px] tracking-[-0.02em] text-[#edf5fb]">{market?.bid}</strong><span className={`mt-1 block text-[8px] font-semibold ${positive ? 'text-[#35d49f]' : 'text-[#ff626e]'}`}>{market?.change || '+0.05%'}</span></div><div className="ml-auto hidden items-center gap-7 xl:flex"><div><span className="block text-[7px] uppercase tracking-[0.08em] text-[#506477]">Max room</span><b className="mt-1 block text-[9px] text-[#a8b8c7]">${riskSummary.remainingMax.toFixed(0)}</b></div><div><span className="block text-[7px] uppercase tracking-[0.08em] text-[#506477]">Target</span><b className="mt-1 block text-[9px] text-[#3dd9a4]">${riskSummary.profit.toFixed(0)} / ${riskSummary.profitTarget.toFixed(0)}</b></div><button type="button" onClick={() => setFavorite(v => !v)} className={`grid size-8 place-items-center rounded-lg hover:bg-white/[0.035] ${favorite ? 'text-[#f6c95d]' : 'text-[#687d92]'}`}><Star size={16} fill={favorite ? 'currentColor' : 'none'}/></button></div></div>

          <PropRiskStrip account={account} plannedRisk={plannedRisk} compact />

          <div className="flex items-center gap-2 border-b border-[#172737] bg-[#071019] px-3">
            <div className="flex items-center gap-0.5 rounded-lg border border-[#1a2c3c] bg-[#09131d] p-1">{timeframes.map(([label, value]) => <button key={value} type="button" onClick={() => onTimeframeChange(value)} disabled={Boolean(tradePlan)} className={`h-7 min-w-8 rounded-md px-2 text-[8px] font-bold ${timeframe === value ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298] hover:bg-white/[0.035] hover:text-[#d7e2ec]'} disabled:opacity-30`}>{label}</button>)}</div>
            <div className="h-5 w-px bg-[#1b2c3b]" />
            <div className="flex items-center gap-0.5 rounded-lg border border-[#1a2c3c] bg-[#09131d] p-1"><button type="button" onClick={() => onChartModeChange('candles')} disabled={Boolean(tradePlan)} className={`grid size-7 place-items-center rounded-md ${chartMode === 'candles' ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298]'} disabled:opacity-30`} title="Candlesticks"><CandlestickChart size={15}/></button><button type="button" onClick={() => onChartModeChange('line')} disabled={Boolean(tradePlan)} className={`grid size-7 place-items-center rounded-md ${chartMode === 'line' ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298]'} disabled:opacity-30`} title="Line chart"><ChartNoAxesCombined size={15}/></button><button type="button" onClick={onOpenIndicators} className={`relative grid size-7 place-items-center rounded-md text-[10px] font-black hover:text-white ${indicators.length ? 'bg-[#102b3d] text-[#5bc9ff]' : 'text-[#6d8298]'}`} title="Indicators">ƒx{indicators.length > 0 && <span className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full bg-[#1e5a7d] text-[6px] text-white">{indicators.length}</span>}</button></div>
            <div className="ml-2 flex items-center gap-0.5">{drawingTools.map(([id, Icon, label]) => <button key={id} type="button" title={label} onClick={() => !tradePlan && onSelectedToolChange(id)} disabled={Boolean(tradePlan)} className={`grid size-7 place-items-center rounded-md ${selectedTool === id ? 'bg-[#113149] text-[#58c8ff]' : 'text-[#687d92] hover:bg-white/[0.035] hover:text-white'} disabled:opacity-30`}><Icon size={14}/></button>)}</div>
            <button type="button" onClick={toggleFullscreen} className="ml-auto grid size-8 place-items-center rounded-lg border border-[#1a2c3c] bg-[#09131d] text-[#73889d] hover:text-white" title="Fullscreen"><Maximize2 size={15}/></button>
          </div>

          <div className="min-h-0 min-w-0 bg-[#080f17]"><ChartArea symbol={market?.symbol} chartTimeframe={chartTimeframeMap[timeframe] || 'M1'} tick={tick} price={market?.bid} ask={market?.ask} chartMode={chartMode} selectedTool={selectedTool} onSelectTool={onSelectedToolChange} embedded hideToolbar tradePlan={tradePlan} onTradePlanChange={onTradePlanChange} indicators={indicators} /></div>

          {tradePlan ? (
            <div className="grid grid-cols-[110px_minmax(0,1fr)_160px] items-center gap-2 border-t border-[#172737] bg-[#071019] p-2">
              <button type="button" onClick={onCancelPlan} className="h-full rounded-xl border border-[#3b2b32] bg-[#171116] text-[9px] font-bold text-[#d2bdc4]">{tradePlan.open ? 'CLOSE' : 'CANCEL'}</button>
              <div className="grid h-full grid-cols-5 divide-x divide-[#172938] overflow-hidden rounded-xl border border-[#172938] bg-[#09131d]">{[
                ['Type', tradePlan.pending ? `${String(tradePlan.side).toUpperCase()} ${String(tradePlan.orderType).toUpperCase()}` : String(tradePlan.side).toUpperCase()],
                ['Lots', metrics?.lots.toFixed(2)], ['SL', `${metrics?.slPips.toFixed(1)}p`], ['R:R', `1:${metrics?.rr.toFixed(1)}`], ['Risk', tradePlan.sizingMode === 'risk' ? `${riskPercent.toFixed(2)}%` : 'Manual'],
              ].map(([label, value]) => <div key={label} className="flex flex-col justify-center px-3"><span className="text-[7px] uppercase tracking-[0.08em] text-[#53697d]">{label}</span><b className="mt-1 truncate text-[9px] text-[#d4dfe7]">{value}</b></div>)}</div>
              {tradePlan.open ? <button type="button" onClick={() => onModifyPlan(tradePlan.stage === 'modifying' ? 'open' : 'modifying')} className="h-full rounded-xl border border-[#24445a] bg-[#0d2130] text-[9px] font-bold text-[#63caff]">{tradePlan.stage === 'modifying' ? 'DONE' : 'MODIFY'}</button> : <button type="button" onClick={onExecutePlan} className={`h-full rounded-xl border text-[9px] font-black ${tradePlan.side === 'buy' ? 'border-[#1c6049] bg-[#103126] text-[#52dfa9]' : 'border-[#6d2934] bg-[#31151d] text-[#ff7480]'}`}>{tradePlan.pending ? (tradePlan.editingOrderId ? 'UPDATE ORDER' : 'PLACE ORDER') : `EXECUTE ${String(tradePlan.side).toUpperCase()}`}</button>}
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(180px,1fr)_230px_minmax(180px,1fr)_minmax(240px,.95fr)] items-stretch gap-2 border-t border-[#172737] bg-[#071019] p-2">
              <button type="button" onClick={() => clickSide('sell')} className="flex items-center justify-between rounded-xl border border-[#4a232b] bg-gradient-to-r from-[#2b151b] to-[#1a1115] px-4 text-[#ff6c76] active:scale-[0.995]"><span><b className="block text-[9px] tracking-[0.08em]">SELL</b><strong className="mt-1 block font-mono text-[15px]">{market?.bid}</strong></span><span className="text-[8px] text-[#9f6268]">Bid</span></button>
              <div className="relative grid grid-cols-[1fr_1fr] gap-1 rounded-xl border border-[#1b2d3c] bg-[#0a141e] p-1.5">
                <button type="button" onClick={() => setOrderOpen(v => !v)} className="rounded-lg bg-[#0d1b26] px-2 text-left"><span className="block text-[7px] text-[#5d7286]">ORDER</span><b className="mt-1 block text-[9px] text-[#d3dee6]">{orderTypes.find(([id]) => id === orderType)?.[1]}</b></button>
                <button type="button" onClick={() => setSizingOpen(v => !v)} className="rounded-lg bg-[#0d1b26] px-2 text-left"><span className="block text-[7px] text-[#5d7286]">SIZE</span><b className="mt-1 block text-[9px] text-[#d3dee6]">{sizingMode === 'risk' ? `${riskPercent.toFixed(2)}% Risk` : `${lots.toFixed(2)} Lots`}</b></button>
                {orderOpen && <div className="absolute bottom-[72px] left-0 z-40 w-[150px] rounded-xl border border-[#223746] bg-[#09151f] p-1.5 shadow-xl">{orderTypes.map(([id, label]) => <button key={id} type="button" onClick={() => { onOrderTypeChange(id); setOrderOpen(false); }} className={`w-full rounded-lg px-2.5 py-2 text-left text-[8px] font-bold ${orderType === id ? 'bg-[#102d42] text-[#61caff]' : 'text-[#a9b8c5]'}`}>{label}</button>)}</div>}
                {sizingOpen && <div className="absolute bottom-[72px] right-0 z-40 w-[160px] rounded-xl border border-[#223746] bg-[#09151f] p-1.5 shadow-xl"><button type="button" onClick={() => { onSizingModeChange('lots'); setSizingOpen(false); }} className={`w-full rounded-lg px-2.5 py-2 text-left text-[8px] font-bold ${sizingMode === 'lots' ? 'bg-[#102d42] text-[#61caff]' : 'text-[#a9b8c5]'}`}>Manual lots</button><button type="button" onClick={() => { onSizingModeChange('risk'); setSizingOpen(false); }} className={`mt-1 w-full rounded-lg px-2.5 py-2 text-left text-[8px] font-bold ${sizingMode === 'risk' ? 'bg-[#102d42] text-[#61caff]' : 'text-[#a9b8c5]'}`}>Risk % planner</button></div>}
              </div>
              <button type="button" onClick={() => clickSide('buy')} className="flex items-center justify-between rounded-xl border border-[#204a3c] bg-gradient-to-r from-[#10231d] to-[#142a22] px-4 text-[#48dda9] active:scale-[0.995]"><span className="text-[8px] text-[#629b85]">Ask</span><span className="text-right"><b className="block text-[9px] tracking-[0.08em]">BUY</b><strong className="mt-1 block font-mono text-[15px]">{market?.ask}</strong></span></button>
              <div className="grid grid-cols-[32px_1fr_32px] items-center rounded-xl border border-[#172938] bg-[#09131d] px-2"><button type="button" onClick={() => sizingMode === 'risk' ? onRiskPercentChange(Math.max(0.05, +(riskPercent - 0.05).toFixed(2))) : onLotsChange(Math.max(0.01, +(lots - 0.01).toFixed(2)))} className="grid size-7 place-items-center rounded-md bg-[#101e2a] text-[#73879c]">−</button><div className="text-center"><strong className="block text-[12px]">{sizingMode === 'risk' ? `${riskPercent.toFixed(2)}%` : lots.toFixed(2)}</strong><span className="mt-1 block text-[7px] text-[#5f7388]">{sizingMode === 'risk' ? 'Risk' : 'Lots'}</span></div><button type="button" onClick={() => sizingMode === 'risk' ? onRiskPercentChange(+(riskPercent + 0.05).toFixed(2)) : onLotsChange(+(lots + 0.01).toFixed(2))} className="grid size-7 place-items-center rounded-md bg-[#101e2a] text-[#73879c]">+</button></div>
            </div>
          )}

          <div className="min-h-0 overflow-hidden border-t border-[#172737] bg-[#071019]">
            <div className="flex h-10 items-center justify-between border-b border-[#172737] px-3"><div className="flex h-full items-center gap-1">{[['positions', 'Positions', positions.length], ['orders', 'Orders', pendingOrders.length], ['history', 'History', positionHistory.length], ['journal', 'Journal', journal.length]].map(([id, label, count]) => <button key={id} type="button" onClick={() => setTab(id)} className={`relative h-full px-3 text-[9px] font-bold ${tab === id ? 'text-[#e8f1f8] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[2px] after:bg-[#45bfff]' : 'text-[#607489]'}`}>{label}<span className="ml-1.5 rounded-full bg-[#0d2c43] px-1.5 py-0.5 text-[7px] text-[#50c1ff]">{count}</span></button>)}</div><button type="button" onClick={onCloseAllPositions} disabled={!positions.length} className="rounded-md border border-[#203240] bg-[#0b1721] px-3 py-1.5 text-[8px] font-bold text-[#8ea0b1] hover:text-white disabled:opacity-35">Close All</button></div>

            {tab === 'positions' && <><div className="grid grid-cols-[1.08fr_.48fr_.52fr_.78fr_.68fr_.68fr_.62fr_210px] border-b border-[#13222f] px-3 py-2 text-[7px] font-bold uppercase tracking-[0.07em] text-[#506477]"><span>Symbol</span><span>Type</span><span>Volume</span><span>Open Price</span><span>S/L</span><span>T/P</span><span>Profit</span><span className="text-right">Quick management</span></div>{positions.length ? positions.map(position => { const menuOpen = positionMenuId === position.id; return <div key={position.id} className="relative grid grid-cols-[1.08fr_.48fr_.52fr_.78fr_.68fr_.68fr_.62fr_210px] items-center border-b border-[#111f2c] px-3 py-2 text-[9px] text-[#aab9c8]"><div className="flex items-center gap-1.5"><b className="text-[#dce7f1]">{displaySymbol(position.symbol)}</b>{position.trailingEnabled && <span className="rounded bg-[#0c2636] px-1 py-0.5 text-[6px] font-bold text-[#58c8ff]">T{position.trailingPips}</span>}</div><span className={`font-bold ${position.side === 'BUY' ? 'text-[#3dd9a4]' : 'text-[#ff6570]'}`}>{position.side}</span><span>{Number(position.volume).toFixed(2)}</span><span className="font-mono">{formatPrice(position.entry)}</span><span className="font-mono">{formatPrice(position.sl)}</span><span className="font-mono">{formatPrice(position.tp)}</span><b className={Number(position.pnl) >= 0 ? 'text-[#3dd9a4]' : 'text-[#ff6570]'}>{formatPnl(position.pnl)}</b><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => onClosePosition(position.id, 50)} className="h-7 rounded-md border border-[#22333f] bg-[#0b1720] px-2 text-[7px] font-bold text-[#aebbc7]">50%</button><button type="button" onClick={() => onBreakEven(position.id)} className="h-7 rounded-md border border-[#1d4639] bg-[#0c2019] px-2 text-[7px] font-bold text-[#48d7a4]">BE</button><button type="button" onClick={() => onReversePosition(position.id)} className="h-7 rounded-md border border-[#244156] bg-[#0b1c28] px-2 text-[7px] font-bold text-[#5fc9ff]">REV</button><button type="button" onClick={() => onClosePosition(position.id, 100)} className="h-7 rounded-md border border-[#5b2931] bg-[#241217] px-2 text-[7px] font-bold text-[#ff7882]">CLOSE</button><button type="button" onClick={() => setPositionMenuId(menuOpen ? null : position.id)} className="grid size-7 place-items-center rounded-md border border-[#22333f] bg-[#0b1720] text-[#708398]"><MoreHorizontal size={13}/></button></div>{menuOpen && <div className="absolute right-3 top-9 z-30 w-[218px] rounded-xl border border-[#213543] bg-[#09131d] p-2 shadow-xl"><div className="grid grid-cols-2 gap-1.5"><button type="button" onClick={() => onDuplicatePosition(position.id)} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#1c3241] bg-[#0b1822] text-[8px] font-bold text-[#b9c6d1]"><Copy size={11}/>Duplicate</button><button type="button" onClick={() => onSetTrailing(position.id, !position.trailingEnabled, position.trailingPips || 5)} className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border text-[8px] font-bold ${position.trailingEnabled ? 'border-[#24506a] bg-[#0d293b] text-[#62ccff]' : 'border-[#1c3241] bg-[#0b1822] text-[#b9c6d1]'}`}><ShieldCheck size={11}/>Trail {position.trailingEnabled ? 'On' : 'Off'}</button></div><div className="mt-1.5 grid grid-cols-3 gap-1.5"><button type="button" onClick={() => onClosePosition(position.id, 25)} className="h-7 rounded-lg bg-[#171117] text-[7px] font-bold text-[#cbbbc1]">Close 25%</button><button type="button" onClick={() => onClosePosition(position.id, 75)} className="h-7 rounded-lg bg-[#171117] text-[7px] font-bold text-[#cbbbc1]">Close 75%</button><button type="button" onClick={() => onReversePosition(position.id)} className="flex h-7 items-center justify-center gap-1 rounded-lg bg-[#0b1a24] text-[7px] font-bold text-[#67cfff]"><Repeat2 size={10}/>Reverse</button></div></div>}</div>; }) : <div className="grid h-[100px] place-items-center text-[9px] text-[#607489]">No open positions</div>}</>}

            {tab === 'orders' && <div className="overflow-y-auto">{pendingOrders.length ? pendingOrders.map(order => <div key={order.id} className="grid grid-cols-[1fr_.7fr_.7fr_.7fr_90px] items-center border-b border-[#111f2c] px-4 py-2.5 text-[8px]"><b className="text-[#dce7f1]">{displaySymbol(order.symbol || market?.symbol)}</b><span className={order.side === 'buy' ? 'text-[#3dd9a4]' : 'text-[#ff6570]'}>{String(order.side).toUpperCase()} {String(order.orderType).toUpperCase()}</span><span>{Number(order.lots || 0).toFixed(2)}</span><span className="font-mono">{formatPrice(order.entry)}</span><div className="flex justify-end gap-1"><button type="button" onClick={() => onModifyPending(order.id)} className="grid size-7 place-items-center rounded-md border border-[#203747] bg-[#0b1822] text-[#8fa5b8]"><SlidersHorizontal size={11}/></button><button type="button" onClick={() => onCancelPending(order.id)} className="grid size-7 place-items-center rounded-md border border-[#5b2931] bg-[#251217] text-[#ff7480]"><X size={11}/></button></div></div>) : <div className="grid h-[130px] place-items-center text-[9px] text-[#607489]">No pending orders</div>}</div>}
            {tab === 'history' && <div className="overflow-y-auto">{positionHistory.length ? positionHistory.map((row, index) => <div key={`${row.id}-${index}`} className="flex items-center justify-between border-b border-[#111f2c] px-4 py-3 text-[9px]"><span><b className="text-[#dce7f1]">{displaySymbol(row.symbol)}</b><span className="ml-2 text-[#64788d]">{row.side} {Number(row.volume).toFixed(2)} · {row.closeType || 'Closed'}</span></span><span className={Number(row.pnl) >= 0 ? 'text-[#3dd9a4]' : 'text-[#ff6570]'}>{formatPnl(row.pnl)} · {row.closedAt}</span></div>) : <div className="grid h-[130px] place-items-center text-[9px] text-[#607489]">Closed positions appear here</div>}</div>}
            {tab === 'journal' && <div className="max-h-[170px] overflow-y-auto">{journal.length ? journal.map(item => <div key={item.id} className="grid grid-cols-[66px_1fr] gap-2 border-b border-[#111f2c] px-4 py-2 text-[8px]"><span className="font-mono text-[#52687b]">{item.time}</span><span className="text-[#b8c6d2]">{item.message}{item.latencyMs != null && <b className="ml-2 text-[#5fcaff]">{item.latencyMs}ms</b>}</span></div>) : <div className="grid h-[130px] place-items-center text-[9px] text-[#607489]">Execution events will appear here</div>}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
