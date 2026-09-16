import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Filter, Share2 } from 'lucide-react';

function money(value, signed = false) {
  const number = Number(value) || 0;
  const sign = signed && number > 0 ? '+' : '';
  return `${sign}${number < 0 ? '-' : ''}$${Math.abs(number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function price(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toFixed(Math.abs(number) > 100 ? 2 : 5);
}

function symbolLabel(symbol = '') {
  if (symbol.includes('/')) return symbol;
  return /^[A-Z]{6}$/.test(symbol) ? `${symbol.slice(0, 3)}/${symbol.slice(3)}` : symbol;
}

function sideTone(side) {
  return String(side).toUpperCase() === 'BUY' || String(side).toLowerCase() === 'buy'
    ? 'bg-[#0d3328] text-[#43d9a6]'
    : 'bg-[#351820] text-[#ff717d]';
}

const periodOptions = ['Today', 'Yesterday', '7D', '30D', 'This month', 'Custom'];

export default function HistorySection({ positionHistory = [], journal = [], onOpenChart = () => {}, onNotice = () => {} }) {
  const [tab, setTab] = useState('positions');
  const [period, setPeriod] = useState('Today');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState('All symbols');
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const symbols = useMemo(() => [...new Set(positionHistory.map(item => item.symbol).filter(Boolean))], [positionHistory]);
  const filteredPositions = useMemo(() => symbolFilter === 'All symbols' ? positionHistory : positionHistory.filter(item => item.symbol === symbolFilter), [positionHistory, symbolFilter]);

  const stats = useMemo(() => {
    const realized = filteredPositions.reduce((sum, item) => sum + (Number(item.pnl) || 0), 0);
    const commission = filteredPositions.reduce((sum, item) => sum + (Number(item.commission) || 0), 0);
    const swap = filteredPositions.reduce((sum, item) => sum + (Number(item.swap) || 0), 0);
    const wins = filteredPositions.filter(item => Number(item.pnl) > 0).length;
    const losses = filteredPositions.filter(item => Number(item.pnl) < 0).length;
    const lots = filteredPositions.reduce((sum, item) => sum + (Number(item.volume) || 0), 0);
    return { realized, commission, swap, wins, losses, lots };
  }, [filteredPositions]);

  const orderEvents = useMemo(() => journal.filter(item => item.type === 'order'), [journal]);
  const dealEvents = useMemo(() => journal.filter(item => item.type === 'fill' || item.type === 'position'), [journal]);

  const shareSummary = async () => {
    const text = `ACG Trader · ${period}\nRealized P&L ${money(stats.realized, true)}\n${filteredPositions.length} positions · ${stats.wins} wins · ${stats.losses} losses`;
    try {
      if (navigator.share) await navigator.share({ title: 'ACG Trader performance', text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); onNotice('Performance summary copied'); }
    } catch (_) { /* user cancelled native share */ }
  };

  return (
    <section className="min-h-[calc(100dvh-98px)] px-3 pb-6 pt-3">
      <header className="flex items-start justify-between gap-3 pb-3">
        <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5f7488]">Trading record</p><h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">History</h1><p className="mt-1 text-[10px] text-[#718397]">Performance first. Execution detail one tap away.</p></div>
        <button type="button" onClick={shareSummary} className="mt-1 grid size-10 place-items-center rounded-xl border border-[#21445b] bg-[#0c2230] text-[#63cbff]" aria-label="Share trading performance"><Share2 size={16}/></button>
      </header>

      <div className="grid grid-cols-3 rounded-[15px] border border-[#182d3d] bg-[#08131c] p-1">
        {[['positions', 'Positions'], ['orders', 'Orders'], ['deals', 'Deals']].map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`relative h-10 rounded-xl text-[9px] font-extrabold transition ${tab === id ? 'bg-[#102a3d] text-[#edf5fa] shadow-[0_5px_16px_rgba(0,0,0,.2)]' : 'text-[#71869a]'}`}>{label}{tab === id && <span className="absolute bottom-0.5 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-[#4ac5ff]"/>}</button>)}
      </div>

      <div className="relative mt-3 flex gap-2">
        <button type="button" onClick={() => { setPeriodOpen(value => !value); setSymbolOpen(false); }} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#192e3e] bg-[#08141d] px-3 text-[8px] font-bold text-[#b5c2cd]">{period}<ChevronDown size={11}/></button>
        <button type="button" onClick={() => { setSymbolOpen(value => !value); setPeriodOpen(false); }} className="flex h-9 min-w-0 items-center gap-1.5 rounded-xl border border-[#192e3e] bg-[#08141d] px-3 text-[8px] font-bold text-[#b5c2cd]"><span className="max-w-[120px] truncate">{symbolFilter}</span><ChevronDown size={11}/></button>
        <button type="button" className="ml-auto grid size-9 place-items-center rounded-xl border border-[#192e3e] bg-[#08141d] text-[#71869a]" aria-label="History filters"><Filter size={13}/></button>

        {periodOpen && <Menu className="left-0 top-11">{periodOptions.map(item => <MenuItem key={item} active={period === item} onClick={() => { setPeriod(item); setPeriodOpen(false); }}>{item}</MenuItem>)}</Menu>}
        {symbolOpen && <Menu className="left-[86px] top-11 min-w-[150px]"><MenuItem active={symbolFilter === 'All symbols'} onClick={() => { setSymbolFilter('All symbols'); setSymbolOpen(false); }}>All symbols</MenuItem>{symbols.map(item => <MenuItem key={item} active={symbolFilter === item} onClick={() => { setSymbolFilter(item); setSymbolOpen(false); }}>{symbolLabel(item)}</MenuItem>)}</Menu>}
      </div>

      {tab === 'positions' && <>
        <div className="mt-4 rounded-[22px] border border-[#193044] bg-[linear-gradient(145deg,#0d1e2b,#08131d_65%)] p-4 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#62788c]">Realized P&amp;L · {period}</p>
          <strong className={`mt-1.5 block text-[30px] font-black tracking-[-0.05em] ${stats.realized >= 0 ? 'text-[#43d9a6]' : 'text-[#ff6f7a]'}`}>{money(stats.realized, true)}</strong>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#173044] pt-3"><SummaryStat label="Positions" value={filteredPositions.length}/><SummaryStat label="W / L" value={`${stats.wins} / ${stats.losses}`}/><SummaryStat label="Volume" value={`${stats.lots.toFixed(2)} lots`}/></div>
          {(stats.commission !== 0 || stats.swap !== 0) && <div className="mt-3 flex gap-4 text-[8px] text-[#667b90]"><span>Commission <b className="text-[#a8b6c2]">{money(stats.commission)}</b></span><span>Swap <b className="text-[#a8b6c2]">{money(stats.swap)}</b></span></div>}
        </div>

        <div className="mt-5 flex items-center justify-between px-1"><div><h2 className="text-[11px] font-black text-[#e8eff5]">{period.toUpperCase()}</h2><p className="mt-0.5 text-[8px] text-[#60758a]">Closed positions</p></div><span className="text-[8px] font-bold text-[#5d7287]">{filteredPositions.length}</span></div>
        <div className="mt-2 space-y-2">
          {!filteredPositions.length && <Empty title="No closed positions yet" subtitle="Close a position and it will appear here." />}
          {filteredPositions.map(position => {
            const expanded = expandedId === position.id;
            const positive = Number(position.pnl) >= 0;
            const closePrice = position.closePrice ?? position.exit ?? position.entry;
            return <article key={position.id} className="overflow-hidden rounded-[18px] border border-[#172b3a] bg-[#08131c]"><button type="button" onClick={() => setExpandedId(expanded ? null : position.id)} className="w-full px-3.5 py-3 text-left"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong className="text-[12px] font-black text-[#f0f5f8]">{symbolLabel(position.symbol)}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${sideTone(position.side)}`}>{String(position.side).toUpperCase()} · {Number(position.volume).toFixed(2)}</span></div><div className="mt-2 flex items-center gap-2 font-mono text-[9px] text-[#74889b]"><span>{price(position.entry)}</span><span className="text-[#354d60]">→</span><span className="text-[#b3c0cb]">{price(closePrice)}</span></div><p className="mt-2 text-[8px] text-[#5f7488]">{position.openedAt || 'Opened'} → {position.closedAt || 'Closed'} · {position.closeType || 'Closed'}</p></div><div className="text-right"><b className={`block text-[15px] font-black ${positive ? 'text-[#43d9a6]' : 'text-[#ff6f7a]'}`}>{money(position.pnl, true)}</b><span className="mt-1 block text-[8px] text-[#5e7387]">realized</span></div></div></button>{expanded && <div className="border-t border-[#152938] bg-[#07111a] p-3.5"><div className="grid grid-cols-2 gap-x-5 gap-y-3"><Detail label="Entry" value={price(position.entry)}/><Detail label="Exit" value={price(closePrice)}/><Detail label="Stop loss" value={price(position.sl)}/><Detail label="Take profit" value={price(position.tp)}/><Detail label="Swap" value={money(position.swap || 0)}/><Detail label="Commission" value={money(position.commission || 0)}/><Detail label="Position" value={`#${String(position.id).slice(-8)}`}/><Detail label="Close type" value={position.closeType || 'Closed'}/></div><button type="button" onClick={() => onOpenChart(position.symbol)} className="mt-3 h-10 w-full rounded-xl border border-[#21445b] bg-[#0c2230] text-[9px] font-bold text-[#62cbff]">View {symbolLabel(position.symbol)} on Chart</button></div>}</article>;
          })}
        </div>
      </>}

      {tab === 'orders' && <EventList title="Order history" subtitle="Placed, modified and cancelled orders" events={orderEvents} empty="No order history yet" />}
      {tab === 'deals' && <EventList title="Deals" subtitle="Execution-level audit trail" events={dealEvents} empty="No deals yet" />}
    </section>
  );
}

function EventList({ title, subtitle, events, empty }) {
  return <div className="mt-4"><div className="px-1"><h2 className="text-[11px] font-black text-[#e8eff5]">{title}</h2><p className="mt-1 text-[8px] text-[#60758a]">{subtitle}</p></div><div className="mt-2 space-y-2">{!events.length && <Empty title={empty} subtitle="Execution events will be recorded here."/>}{events.map(event => <article key={event.id} className="rounded-[17px] border border-[#172b3a] bg-[#08131c] px-3.5 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate text-[11px] font-black text-[#eef4f8]">{symbolLabel(event.symbol) || 'Account'}</strong>{event.side && <span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${sideTone(event.side)}`}>{String(event.side).toUpperCase()}</span>}</div><p className="mt-2 text-[9px] leading-4 text-[#8da0b1]">{event.message}</p></div><span className="shrink-0 text-[8px] font-semibold text-[#596f83]">{event.time || '—'}</span></div>{event.fillPrice != null && <div className="mt-2 flex gap-4 border-t border-[#142635] pt-2 text-[8px] text-[#60758a]"><span>Fill <b className="font-mono text-[#abb9c5]">{price(event.fillPrice)}</b></span>{event.lots != null && <span>Volume <b className="text-[#abb9c5]">{Number(event.lots).toFixed(2)}</b></span>}</div>}</article>)}</div></div>;
}

function Menu({ children, className = '' }) { return <div className={`absolute z-40 min-w-[132px] rounded-xl border border-[#223645] bg-[#0a151f] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)] ${className}`}>{children}</div>; }
function MenuItem({ children, active, onClick }) { return <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[9px] font-semibold ${active ? 'bg-[#102b40] text-[#61caff]' : 'text-[#b4c1cc]'}`}><span>{children}</span>{active && <Check size={11}/>}</button>; }
function SummaryStat({ label, value }) { return <div><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5e7488]">{label}</span><b className="mt-1 block text-[10px] text-[#cbd6df]">{value}</b></div>; }
function Detail({ label, value }) { return <div><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5d7287]">{label}</span><b className="mt-1 block truncate text-[9px] font-semibold text-[#c4d0da]">{value}</b></div>; }
function Empty({ title, subtitle }) { return <div className="grid h-[120px] place-items-center rounded-[18px] border border-dashed border-[#1a3040] bg-[#07121a] text-center"><div><b className="text-[10px] text-[#9eafbe]">{title}</b><p className="mt-1 text-[8px] text-[#5d7185]">{subtitle}</p></div></div>; }
