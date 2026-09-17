import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Share2 } from 'lucide-react';

function money(value, signed = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
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
  return String(side).toUpperCase() === 'BUY'
    ? 'bg-[#0d3328] text-[#43d9a6]'
    : 'bg-[#351820] text-[#ff717d]';
}

const periodOptions = ['Recent', 'Today', 'Yesterday', '7D', '30D', 'This month'];

function matchesPeriod(item, period, now = new Date()) {
  if (period === 'Recent') return true;
  const value = item?.executedAt || item?.closedAt;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'Today') return date >= startToday;
  if (period === 'Yesterday') {
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);
    return date >= startYesterday && date < startToday;
  }
  if (period === '7D') return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === '30D') return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (period === 'This month') return date >= new Date(now.getFullYear(), now.getMonth(), 1);
  return true;
}

export default function HistorySection({ positionHistory = [], journal = [], onOpenChart = () => {}, onNotice = () => {} }) {
  const [tab, setTab] = useState('closed');
  const [period, setPeriod] = useState('Recent');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState('All symbols');
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const symbols = useMemo(() => [...new Set(positionHistory.map(item => item.symbol).filter(Boolean))], [positionHistory]);
  const filteredPositions = useMemo(() => positionHistory.filter(item => (
    (symbolFilter === 'All symbols' || item.symbol === symbolFilter) && matchesPeriod(item, period)
  )), [period, positionHistory, symbolFilter]);

  const stats = useMemo(() => {
    const realized = filteredPositions.reduce((sum, item) => sum + (Number(item.pnl) || 0), 0);
    const commission = filteredPositions.reduce((sum, item) => sum + (Number(item.commission) || 0), 0);
    const wins = filteredPositions.filter(item => Number(item.pnl) > 0).length;
    const losses = filteredPositions.filter(item => Number(item.pnl) < 0).length;
    const lots = filteredPositions.reduce((sum, item) => sum + (Number(item.volume) || 0), 0);
    return { realized, commission, wins, losses, lots };
  }, [filteredPositions]);

  const shareSummary = async () => {
    const text = `ACG Trader · ${period} loaded history\nRealized P&L ${money(stats.realized, true)}\n${filteredPositions.length} closing deals · ${stats.wins} wins · ${stats.losses} losses`;
    try {
      if (navigator.share) await navigator.share({ title: 'ACG Trader recent performance', text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); onNotice('Recent performance summary copied'); }
    } catch (_) { /* user cancelled native share */ }
  };

  return (
    <section className="min-h-[calc(100dvh-98px)] px-3 pb-6 pt-3">
      <header className="flex items-start justify-between gap-3 pb-3">
        <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5f7488]">Server-synced activity</p><h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">Recent History</h1><p className="mt-1 max-w-[280px] text-[10px] leading-relaxed text-[#718397]">Shows the recent fills included in the authenticated trading snapshot. Full paginated history requires the backend history endpoint.</p></div>
        <button type="button" onClick={shareSummary} className="mt-1 grid size-10 place-items-center rounded-xl border border-[#21445b] bg-[#0c2230] text-[#63cbff]" aria-label="Share recent trading performance"><Share2 size={16}/></button>
      </header>

      <div className="grid grid-cols-2 rounded-[15px] border border-[#182d3d] bg-[#08131c] p-1">
        {[['closed', 'Closed deals'], ['session', 'Session log']].map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`relative h-10 rounded-xl text-[9px] font-extrabold transition ${tab === id ? 'bg-[#102a3d] text-[#edf5fa] shadow-[0_5px_16px_rgba(0,0,0,.2)]' : 'text-[#71869a]'}`}>{label}{tab === id && <span className="absolute bottom-0.5 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-[#4ac5ff]"/>}</button>)}
      </div>

      {tab === 'closed' && <>
        <div className="relative mt-3 flex gap-2">
          <button type="button" onClick={() => { setPeriodOpen(value => !value); setSymbolOpen(false); }} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#192e3e] bg-[#08141d] px-3 text-[8px] font-bold text-[#b5c2cd]">{period}<ChevronDown size={11}/></button>
          <button type="button" onClick={() => { setSymbolOpen(value => !value); setPeriodOpen(false); }} className="flex h-9 min-w-0 items-center gap-1.5 rounded-xl border border-[#192e3e] bg-[#08141d] px-3 text-[8px] font-bold text-[#b5c2cd]"><span className="max-w-[120px] truncate">{symbolFilter}</span><ChevronDown size={11}/></button>
          {periodOpen && <Menu className="left-0 top-11">{periodOptions.map(item => <MenuItem key={item} active={period === item} onClick={() => { setPeriod(item); setPeriodOpen(false); }}>{item}</MenuItem>)}</Menu>}
          {symbolOpen && <Menu className="left-[86px] top-11 min-w-[150px]"><MenuItem active={symbolFilter === 'All symbols'} onClick={() => { setSymbolFilter('All symbols'); setSymbolOpen(false); }}>All symbols</MenuItem>{symbols.map(item => <MenuItem key={item} active={symbolFilter === item} onClick={() => { setSymbolFilter(item); setSymbolOpen(false); }}>{symbolLabel(item)}</MenuItem>)}</Menu>}
        </div>

        <div className="mt-4 rounded-[22px] border border-[#193044] bg-[linear-gradient(145deg,#0d1e2b,#08131d_65%)] p-4 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#62788c]">Loaded realized P&amp;L · {period}</p>
          <strong className={`mt-1.5 block text-[30px] font-black tracking-[-0.05em] ${stats.realized >= 0 ? 'text-[#43d9a6]' : 'text-[#ff6f7a]'}`}>{money(stats.realized, true)}</strong>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#173044] pt-3"><SummaryStat label="Deals" value={filteredPositions.length}/><SummaryStat label="W / L" value={`${stats.wins} / ${stats.losses}`}/><SummaryStat label="Volume" value={`${stats.lots.toFixed(2)} lots`}/></div>
          {stats.commission !== 0 && <div className="mt-3 text-[8px] text-[#667b90]">Commission <b className="text-[#a8b6c2]">{money(stats.commission)}</b></div>}
        </div>

        <div className="mt-4 space-y-2">
          {!filteredPositions.length && <Empty title="No matching closing deals" subtitle="Recent server fills matching this filter will appear here." />}
          {filteredPositions.map(position => {
            const expanded = expandedId === position.id;
            const positive = Number(position.pnl) >= 0;
            return <article key={position.id} className="overflow-hidden rounded-[18px] border border-[#172b3a] bg-[#08131c]"><button type="button" onClick={() => setExpandedId(expanded ? null : position.id)} className="w-full px-3.5 py-3 text-left"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong className="text-[12px] font-black text-[#f0f5f8]">{symbolLabel(position.symbol)}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${sideTone(position.side)}`}>{String(position.side).toUpperCase()} · {Number(position.volume).toFixed(2)}</span></div><p className="mt-2 text-[8px] text-[#5f7488]">{position.closedAt || 'Executed'} · {position.closeType || 'CLOSE'}</p></div><div className="text-right"><b className={`block text-[15px] font-black ${positive ? 'text-[#43d9a6]' : 'text-[#ff6f7a]'}`}>{money(position.pnl, true)}</b><span className="mt-1 block text-[8px] text-[#5e7387]">realized</span></div></div></button>{expanded && <div className="border-t border-[#152938] bg-[#07111a] p-3.5"><div className="grid grid-cols-2 gap-x-5 gap-y-3"><Detail label="Execution price" value={price(position.closePrice ?? position.entry)}/><Detail label="Commission" value={money(position.commission || 0)}/><Detail label="Position" value={`#${String(position.positionId || position.id).slice(-8)}`}/><Detail label="Deal type" value={position.closeType || 'CLOSE'}/></div><button type="button" onClick={() => onOpenChart(position.symbol)} className="mt-3 h-10 w-full rounded-xl border border-[#21445b] bg-[#0c2230] text-[9px] font-bold text-[#62cbff]">View {symbolLabel(position.symbol)} on Chart</button></div>}</article>;
          })}
        </div>
      </>}

      {tab === 'session' && <div className="mt-4"><div className="px-1"><h2 className="text-[11px] font-black text-[#e8eff5]">Terminal session activity</h2><p className="mt-1 text-[8px] text-[#60758a]">UI command log for this browser session. This is not a substitute for durable backend order history.</p></div><div className="mt-2 space-y-2">{!journal.length && <Empty title="No session activity yet" subtitle="Commands submitted in this terminal session will appear here."/>}{journal.map(event => <article key={event.id} className="rounded-[17px] border border-[#172b3a] bg-[#08131c] px-3.5 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="truncate text-[11px] font-black text-[#eef4f8]">{symbolLabel(event.symbol) || 'Account'}</strong><p className="mt-2 text-[9px] leading-4 text-[#8da0b1]">{event.message}</p></div><span className="shrink-0 text-[8px] font-semibold text-[#596f83]">{event.time || '—'}</span></div></article>)}</div></div>}
    </section>
  );
}

function Menu({ children, className = '' }) { return <div className={`absolute z-40 min-w-[132px] rounded-xl border border-[#223645] bg-[#0a151f] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)] ${className}`}>{children}</div>; }
function MenuItem({ children, active, onClick }) { return <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[9px] font-semibold ${active ? 'bg-[#102b40] text-[#61caff]' : 'text-[#b4c1cc]'}`}><span>{children}</span>{active && <Check size={11}/>}</button>; }
function SummaryStat({ label, value }) { return <div><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5e7488]">{label}</span><b className="mt-1 block text-[10px] text-[#cbd6df]">{value}</b></div>; }
function Detail({ label, value }) { return <div><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5d7287]">{label}</span><b className="mt-1 block truncate text-[9px] font-semibold text-[#c4d0da]">{value}</b></div>; }
function Empty({ title, subtitle }) { return <div className="grid h-[120px] place-items-center rounded-[18px] border border-dashed border-[#1a3040] bg-[#07121a] text-center"><div><b className="text-[10px] text-[#9eafbe]">{title}</b><p className="mt-1 text-[8px] text-[#5d7185]">{subtitle}</p></div></div>; }
