import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  CandlestickChart,
  ChartNoAxesCombined,
  ChevronDown,
  Crosshair,
  History,
  LineChart,
  List,
  Magnet,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Search,
  Settings,
  Shapes,
  Square,
  Star,
  Target,
  Type,
  UserRound,
  X,
} from 'lucide-react';
import TradingChart from '../TradingChart.jsx';

const timeframes = [
  ['1s', 'S1'], ['5s', 'S5'], ['15s', 'S15'], ['30s', 'S30'],
  ['1m', 'M1'], ['5m', 'M5'], ['15m', 'M15'], ['1h', 'H1'], ['4h', 'H4'], ['D', 'D1'],
];

const initialPositions = [
  { id: 1, symbol: 'AUD/CAD', side: 'BUY', volume: '0.01', entry: '0.99342', sl: '0.99000', tp: '0.99500', pnl: '+$0.18' },
  { id: 2, symbol: 'EUR/USD', side: 'SELL', volume: '0.02', entry: '1.08460', sl: '1.09000', tp: '1.08000', pnl: '+$0.78' },
];

const drawingTools = [
  ['pointer', MousePointer2], ['crosshair', Crosshair], ['trendline', LineChart], ['rectangle', Square],
  ['text', Type], ['shape', Shapes], ['measure', Target], ['magnet', Magnet],
];

const navItems = [
  ['trade', CandlestickChart, 'Trade'], ['watchlist', Star, 'Watchlist'], ['markets', List, 'Markets'],
  ['history', History, 'History'], ['more', MoreHorizontal, 'More'],
];

function displaySymbol(symbol = '') {
  if (symbol.includes('/')) return symbol;
  if (symbol.length === 6) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}

function marketName(symbol) {
  const names = { AUDCAD: 'Australian Dollar / Canadian Dollar', EURUSD: 'Euro / US Dollar', GBPUSD: 'British Pound / US Dollar', USDJPY: 'US Dollar / Japanese Yen', XAUUSD: 'Gold / US Dollar', US30: 'Dow Jones 30' };
  return names[symbol] || symbol;
}

export default function DesktopTerminal({ market, tick, markets = [], activeSymbol = market?.symbol, onSelectSymbol = () => {} }) {
  const shellRef = useRef(null);
  const watchSearchRef = useRef(null);
  const [timeframe, setTimeframe] = useState('M1');
  const [chartMode, setChartMode] = useState('candles');
  const [selectedTool, setSelectedTool] = useState('pointer');
  const [activeNav, setActiveNav] = useState('trade');
  const [lots, setLots] = useState(0.10);
  const [tab, setTab] = useState('positions');
  const [watchSearch, setWatchSearch] = useState('');
  const [favorite, setFavorite] = useState(true);
  const [positions, setPositions] = useState(initialPositions);
  const [positionMenuId, setPositionMenuId] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [notice, setNotice] = useState('');

  const filteredMarkets = useMemo(() => {
    const query = watchSearch.trim().toLowerCase();
    return query ? markets.filter(item => item.symbol.toLowerCase().includes(query)) : markets;
  }, [markets, watchSearch]);

  const symbolLabel = displaySymbol(market?.symbol || 'AUDCAD');
  const positive = !String(market?.change || '').startsWith('-');
  const notify = message => setNotice(message);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await shellRef.current?.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (error) {
      console.warn('Fullscreen unavailable', error);
    }
  };

  const closePosition = id => {
    const row = positions.find(item => item.id === id);
    if (!row) return;
    setPositions(current => current.filter(item => item.id !== id));
    setHistoryRows(current => [{ ...row, closedAt: 'Just now' }, ...current]);
    setPositionMenuId(null);
    notify(`Frontend demo position ${row.symbol} closed`);
  };

  const closeAll = () => {
    if (!positions.length) return;
    setHistoryRows(current => [...positions.map(item => ({ ...item, closedAt: 'Just now' })), ...current]);
    setPositions([]);
    setPositionMenuId(null);
    notify('All frontend demo positions closed');
  };

  const manualOrder = side => notify(`Frontend demo: ${side.toUpperCase()} ${lots.toFixed(2)} ${market?.symbol} @ ${side === 'buy' ? market?.ask : market?.bid}`);

  const handleNav = id => {
    setActiveNav(id);
    if (id !== 'trade') notify(`${navItems.find(item => item[0] === id)?.[2]} frontend state selected`);
  };

  return (
    <div ref={shellRef} className="relative h-dvh min-h-[720px] overflow-hidden bg-[#02070c] text-[#f4f8fb]">
      {notice && <div className="absolute right-4 top-[72px] z-50 flex max-w-[360px] items-center gap-3 rounded-xl border border-[#24445a] bg-[#0b1b28]/95 px-3 py-2.5 text-[10px] font-semibold text-[#dce9f2] shadow-[0_16px_48px_rgba(0,0,0,.45)]"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="grid size-6 place-items-center rounded-md text-[#8094a7]"><X size={13}/></button></div>}

      <header className="flex h-16 items-center border-b border-[#172737] bg-[#060d14] px-4 shadow-[0_1px_0_rgba(255,255,255,0.015)]">
        <div className="flex min-w-[220px] items-center gap-2"><span className="text-[17px] font-extrabold tracking-[-0.03em]">ACG Trader</span><span className="rounded-md bg-[#0d2b42] px-1.5 py-1 text-[9px] font-extrabold tracking-[0.05em] text-[#56c6ff]">V2</span></div>
        <div className="ml-3 hidden items-stretch divide-x divide-[#172737] rounded-xl border border-[#172737] bg-[#08111a] xl:flex">
          {[['Balance', '$12,458.32'], ['Equity', '$12,503.18'], ['P/L', '+$44.86'], ['Free Margin', '$11,982.40']].map(([label, value]) => <div key={label} className="min-w-[112px] px-3 py-2"><span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#52667a]">{label}</span><strong className={`mt-0.5 block text-[11px] font-bold ${label === 'P/L' ? 'text-[#3dd9a4]' : 'text-[#dce6ef]'}`}>{value}</strong></div>)}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => watchSearchRef.current?.focus()} className="grid size-9 place-items-center rounded-lg text-[#8fa2b7] hover:bg-white/[0.035] hover:text-white" aria-label="Search"><Search size={18}/></button>
          <button type="button" onClick={() => notify('Notifications frontend state opened')} className="relative grid size-9 place-items-center rounded-lg border border-[#192a39] bg-[#08121b] text-[#8fa2b7]" aria-label="Notifications"><Bell size={17}/><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#ff5968]"/></button>
          <button type="button" onClick={() => notify('Account summary frontend state opened')} className="flex h-9 items-center gap-2 rounded-lg border border-[#192a39] bg-[#08121b] px-3 text-left"><span className="size-1.5 rounded-full bg-[#2fd9a0]"/><div className="leading-none"><strong className="block text-[10px]">$12,458.32</strong><span className="mt-1 block text-[8px] text-[#64788d]">Live</span></div></button>
          <button type="button" onClick={() => notify('Profile frontend state opened')} className="grid size-9 place-items-center rounded-full border border-[#192a39] bg-[#0a151f] text-[#8ea3ba]" aria-label="Profile"><UserRound size={17}/></button>
        </div>
      </header>

      <div className="grid h-[calc(100dvh-64px)] min-h-[656px] grid-cols-[58px_220px_minmax(0,1fr)] 2xl:grid-cols-[62px_260px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col items-center border-r border-[#172737] bg-[#050c13] py-2">
          {navItems.map(([id, Icon, label]) => { const active = activeNav === id; return <button key={id} type="button" title={label} onClick={() => handleNav(id)} className={`mb-1 flex h-12 w-11 flex-col items-center justify-center gap-1 rounded-xl text-[7px] font-semibold transition ${active ? 'bg-[#0d2537] text-[#53c7ff]' : 'text-[#65798e] hover:bg-white/[0.03] hover:text-[#c8d6e3]'}`}><Icon size={18} strokeWidth={1.8}/><span>{label}</span></button>; })}
          <div className="flex-1" />
          <button type="button" onClick={() => notify('Desktop settings frontend state opened')} title="Settings" className="grid size-11 place-items-center rounded-xl text-[#65798e] hover:bg-white/[0.03] hover:text-white"><Settings size={18}/></button>
        </aside>

        <aside className="min-h-0 overflow-hidden border-r border-[#172737] bg-[#071019]">
          <div className="flex h-14 items-center justify-between border-b border-[#172737] px-3"><div><strong className="block text-[10px] font-extrabold tracking-[0.08em] text-[#dce7f1]">MARKET WATCH</strong><span className="mt-1 block text-[8px] text-[#5f7388]">{markets.length} symbols</span></div><div className="flex items-center gap-1"><button type="button" onClick={() => watchSearchRef.current?.focus()} className="grid size-7 place-items-center rounded-md text-[#65798d] hover:bg-white/[0.03]" title="Add symbol"><Plus size={16}/></button><button type="button" onClick={() => notify('Market Watch options frontend state opened')} className="grid size-7 place-items-center rounded-md text-[#65798d] hover:bg-white/[0.03]" title="Market Watch options"><MoreHorizontal size={17}/></button></div></div>
          <div className="p-2"><div className="flex h-8 items-center gap-2 rounded-lg border border-[#182938] bg-[#09131d] px-2 text-[#687c91]"><Search size={13}/><input ref={watchSearchRef} value={watchSearch} onChange={event => setWatchSearch(event.target.value)} placeholder="Search symbols" className="min-w-0 flex-1 bg-transparent text-[9px] text-[#c7d4e0] outline-none placeholder:text-[#52667a]"/></div></div>
          <div className="grid grid-cols-[1fr_.72fr_.72fr] border-y border-[#152433] px-3 py-2 text-[7px] font-bold uppercase tracking-[0.08em] text-[#52667a]"><span>Symbol</span><span className="text-right">Bid</span><span className="text-right">Ask</span></div>
          <div className="overflow-y-auto">{filteredMarkets.map(item => { const selected = item.symbol === activeSymbol; return <button key={item.symbol} type="button" onClick={() => onSelectSymbol(item.symbol)} className={`grid w-full grid-cols-[1fr_.72fr_.72fr] items-center border-b border-[#111f2c] px-3 py-2.5 text-left transition ${selected ? 'bg-[#0d2232] shadow-[inset_2px_0_#49bfff]' : 'hover:bg-[#0a1722]'}`}><span className="min-w-0"><b className="block text-[10px] text-[#dce7f1]">{displaySymbol(item.symbol)}</b><small className={`mt-1 block text-[7px] ${String(item.change).startsWith('-') ? 'text-[#ff6570]' : 'text-[#38d6a2]'}`}>{item.change}</small></span><b className="text-right font-mono text-[9px] text-[#a9bac9]">{item.bid}</b><span className="text-right font-mono text-[9px] text-[#8ea1b5]">{item.ask}</span></button>; })}</div>
        </aside>

        <section className="grid min-h-0 grid-rows-[58px_46px_minmax(0,1fr)_82px_190px] bg-[#060d14] 2xl:grid-rows-[62px_48px_minmax(0,1fr)_86px_210px]">
          <div className="flex items-center border-b border-[#172737] bg-[#08111a] px-4">
            <div className="min-w-[220px]"><button type="button" onClick={() => watchSearchRef.current?.focus()} className="flex items-center gap-1 text-[15px] font-extrabold tracking-[-0.025em] text-[#f3f7fb]">{symbolLabel}<ChevronDown size={14}/></button><span className="mt-1 block text-[8px] text-[#5f7388]">{marketName(market?.symbol)}</span></div>
            <div className="ml-4"><strong className="block font-mono text-[17px] tracking-[-0.02em] text-[#edf5fb]">{market?.bid}</strong><span className={`mt-1 block text-[8px] font-semibold ${positive ? 'text-[#35d49f]' : 'text-[#ff626e]'}`}>{market?.change || '+0.05%'}</span></div>
            <div className="ml-auto hidden items-center gap-7 xl:flex">{[['High', '0.99421'], ['Low', '0.99283'], ['Vol', '12.4K']].map(([label, value]) => <div key={label}><span className="block text-[7px] uppercase tracking-[0.08em] text-[#506477]">{label}</span><b className="mt-1 block font-mono text-[9px] text-[#a8b8c7]">{value}</b></div>)}<button type="button" onClick={() => setFavorite(v => !v)} className={`grid size-8 place-items-center rounded-lg hover:bg-white/[0.035] ${favorite ? 'text-[#f6c95d]' : 'text-[#687d92]'}`}><Star size={16} fill={favorite ? 'currentColor' : 'none'}/></button></div>
          </div>

          <div className="flex items-center gap-2 border-b border-[#172737] bg-[#071019] px-3">
            <div className="flex items-center gap-0.5 rounded-lg border border-[#1a2c3c] bg-[#09131d] p-1">{timeframes.map(([label, value]) => <button key={value} type="button" onClick={() => setTimeframe(value)} className={`h-7 min-w-8 rounded-md px-2 text-[8px] font-bold ${timeframe === value ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298] hover:bg-white/[0.035] hover:text-[#d7e2ec]'}`}>{label}</button>)}</div>
            <div className="h-5 w-px bg-[#1b2c3b]" />
            <div className="flex items-center gap-0.5 rounded-lg border border-[#1a2c3c] bg-[#09131d] p-1"><button type="button" onClick={() => setChartMode('candles')} className={`grid size-7 place-items-center rounded-md ${chartMode === 'candles' ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298]'}`} title="Candlesticks"><CandlestickChart size={15}/></button><button type="button" onClick={() => setChartMode('line')} className={`grid size-7 place-items-center rounded-md ${chartMode === 'line' ? 'bg-[#123249] text-[#58c7ff]' : 'text-[#6d8298]'}`} title="Line chart"><ChartNoAxesCombined size={15}/></button><button type="button" onClick={() => notify('Indicators frontend state opened')} className="grid size-7 place-items-center rounded-md text-[10px] font-black text-[#6d8298] hover:text-white" title="Indicators">ƒx</button></div>
            <button type="button" onClick={toggleFullscreen} className="ml-auto grid size-8 place-items-center rounded-lg border border-[#1a2c3c] bg-[#09131d] text-[#73889d] hover:text-white" title="Fullscreen"><Maximize2 size={15}/></button>
          </div>

          <div className="grid min-h-0 grid-cols-[38px_minmax(0,1fr)] bg-[#080f17]"><aside className="flex flex-col items-center gap-1 border-r border-[#172737] bg-[#08111a] py-2">{drawingTools.map(([id, Icon]) => <button key={id} type="button" title={id} onClick={() => setSelectedTool(id)} className={`grid size-7 place-items-center rounded-md ${selectedTool === id ? 'bg-[#113149] text-[#58c8ff]' : 'text-[#687d92] hover:bg-white/[0.035] hover:text-white'}`}><Icon size={15}/></button>)}</aside><div className="min-h-0 min-w-0"><TradingChart symbol={market?.symbol} timeframe={timeframe} tick={tick} chartMode={chartMode} bidPrice={market?.bid} askPrice={market?.ask}/></div></div>

          <div className="grid grid-cols-[minmax(180px,1fr)_140px_minmax(180px,1fr)_minmax(280px,1.15fr)] items-stretch gap-2 border-t border-[#172737] bg-[#071019] p-2">
            <button type="button" onClick={() => manualOrder('sell')} className="flex items-center justify-between rounded-xl border border-[#4a232b] bg-gradient-to-r from-[#2b151b] to-[#1a1115] px-4 text-[#ff6c76] active:scale-[0.995]"><span><b className="block text-[9px] tracking-[0.08em]">SELL</b><strong className="mt-1 block font-mono text-[15px]">{market?.bid}</strong></span><span className="text-[8px] text-[#9f6268]">Bid</span></button>
            <div className="grid grid-cols-[34px_1fr_34px] items-center rounded-xl border border-[#1b2d3c] bg-[#0a141e] px-2"><button type="button" onClick={() => setLots(v => Math.max(0.01, +(v - 0.01).toFixed(2)))} className="grid size-7 place-items-center rounded-md bg-[#101e2a] text-[#73879c]">−</button><button type="button" onClick={() => notify(`Manual volume ${lots.toFixed(2)} lots`)} className="text-center"><strong className="block text-[13px]">{lots.toFixed(2)}</strong><span className="mt-1 block text-[7px] text-[#5f7388]">Lots</span></button><button type="button" onClick={() => setLots(v => +(v + 0.01).toFixed(2))} className="grid size-7 place-items-center rounded-md bg-[#101e2a] text-[#73879c]">+</button></div>
            <button type="button" onClick={() => manualOrder('buy')} className="flex items-center justify-between rounded-xl border border-[#204a3c] bg-gradient-to-r from-[#10231d] to-[#142a22] px-4 text-[#48dda9] active:scale-[0.995]"><span className="text-[8px] text-[#629b85]">Ask</span><span className="text-right"><b className="block text-[9px] tracking-[0.08em]">BUY</b><strong className="mt-1 block font-mono text-[15px]">{market?.ask}</strong></span></button>
            <div className="grid grid-cols-4 items-center rounded-xl border border-[#172938] bg-[#09131d] px-3">{[['Spread', '0.5 pips'], ['Commission', '$0'], ['Leverage', '1:100'], ['Margin', '$99.37']].map(([label, value]) => <button type="button" onClick={() => notify(`${label}: ${value}`)} key={label} className="border-l border-[#172938] px-3 text-left first:border-l-0"><span className="block text-[7px] text-[#506477]">{label}</span><b className="mt-1 block text-[9px] text-[#b3c0cd]">{value}</b></button>)}</div>
          </div>

          <div className="min-h-0 overflow-hidden border-t border-[#172737] bg-[#071019]">
            <div className="flex h-10 items-center justify-between border-b border-[#172737] px-3"><div className="flex h-full items-center gap-1">{[['positions', 'Positions', positions.length], ['orders', 'Orders', 0], ['history', 'History', historyRows.length]].map(([id, label, count]) => <button key={id} type="button" onClick={() => setTab(id)} className={`relative h-full px-3 text-[9px] font-bold ${tab === id ? 'text-[#e8f1f8] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[2px] after:bg-[#45bfff]' : 'text-[#607489]'}`}>{label}<span className="ml-1.5 rounded-full bg-[#0d2c43] px-1.5 py-0.5 text-[7px] text-[#50c1ff]">{count}</span></button>)}</div><button type="button" onClick={closeAll} disabled={!positions.length} className="rounded-md border border-[#203240] bg-[#0b1721] px-3 py-1.5 text-[8px] font-bold text-[#8ea0b1] hover:text-white disabled:opacity-35">Close All</button></div>
            {tab === 'positions' && <><div className="grid grid-cols-[1.15fr_.6fr_.55fr_.8fr_.75fr_.75fr_.6fr_34px] border-b border-[#13222f] px-3 py-2 text-[7px] font-bold uppercase tracking-[0.07em] text-[#506477]"><span>Symbol</span><span>Type</span><span>Volume</span><span>Open Price</span><span>S/L</span><span>T/P</span><span>Profit</span><span/></div>{positions.length ? positions.map(position => <div key={position.id} className="relative grid grid-cols-[1.15fr_.6fr_.55fr_.8fr_.75fr_.75fr_.6fr_34px] items-center border-b border-[#111f2c] px-3 py-2.5 text-[9px] text-[#aab9c8]"><b className="text-[#dce7f1]">{position.symbol}</b><span className={`font-bold ${position.side === 'BUY' ? 'text-[#3dd9a4]' : 'text-[#ff6570]'}`}>{position.side}</span><span>{position.volume}</span><span className="font-mono">{position.entry}</span><span className="font-mono">{position.sl}</span><span className="font-mono">{position.tp}</span><b className="text-[#3dd9a4]">{position.pnl}</b><button type="button" onClick={() => setPositionMenuId(positionMenuId === position.id ? null : position.id)} className="grid size-7 place-items-center rounded-md text-[#61758a] hover:bg-white/[0.035] hover:text-white"><MoreHorizontal size={15}/></button>{positionMenuId === position.id && <div className="absolute right-3 top-9 z-30 w-[120px] rounded-lg border border-[#213543] bg-[#09131d] p-1 shadow-xl"><button type="button" onClick={() => notify(`Modify ${position.symbol} frontend state`)} className="block w-full rounded-md px-2 py-1.5 text-left text-[8px] text-[#b8c6d2] hover:bg-white/[0.04]">Modify</button><button type="button" onClick={() => closePosition(position.id)} className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-[8px] text-[#ff707b] hover:bg-[#35151d]">Close</button></div>}</div>) : <div className="grid h-[100px] place-items-center text-[9px] text-[#607489]">No open positions</div>}</>}
            {tab === 'orders' && <div className="grid h-[130px] place-items-center text-[9px] text-[#607489]">No pending frontend orders</div>}
            {tab === 'history' && <div className="overflow-y-auto">{historyRows.length ? historyRows.map((row, index) => <div key={`${row.id}-${index}`} className="flex items-center justify-between border-b border-[#111f2c] px-4 py-3 text-[9px]"><span><b className="text-[#dce7f1]">{row.symbol}</b><span className="ml-2 text-[#64788d]">{row.side} {row.volume}</span></span><span className="text-[#3dd9a4]">{row.pnl} · {row.closedAt}</span></div>) : <div className="grid h-[130px] place-items-center text-[9px] text-[#607489]">Closed frontend demo positions appear here</div>}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
