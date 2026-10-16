import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, ChartNoAxesCombined, ChevronDown, CircleHelp, MoreVertical, Search, Settings2, UserRound } from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
import { mapTimeframe } from './ChartControls.jsx';

const TIMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];
function displaySymbol(market) {
  const symbol = String(market?.displaySymbol || market?.symbol || '').toUpperCase();
  return /^[A-Z]{6}$/.test(symbol) ? symbol.slice(0, 3) + '/' + symbol.slice(3) : symbol;
}
function money(value, currency) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2, signDisplay: Number(value) > 0 ? 'always' : 'auto' }).format(Number(value));
  } catch { return '—'; }
}
export default function MobileAuditHeader({
  market, account, timeframe, onTimeframe, positionsCount = 0,
  onSelectInstrument, onOpenTrades, onOpenAccount,
  onOpenIndicators, onOpenSettings, onOpenHelp, chartReadout = null,
}) {
  const [panel, setPanel] = useState(null);
  const timeOpen = panel === 'time';
  const headerRef = useRef(null);
  const menuRef = useRef(null);
  const menuTrigger = useRef(null);
  const timeTrigger = useRef(null);
  useEffect(() => {
    if (!panel) return undefined;
    const dismiss = event => { if (!headerRef.current?.contains(event.target)) setPanel(null); };
    const escape = event => {
      if (event.key !== 'Escape') return;
      setPanel(null);
      (panel === 'menu' ? menuTrigger : timeTrigger).current?.focus({preventScroll:true});
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    if (panel === 'menu') menuRef.current?.querySelector('[role="menuitem"]')?.focus({preventScroll:true});
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [panel]);
  const destinations = [
    ['Markets', Search, onSelectInstrument], ['Trades', ArrowUpDown, onOpenTrades],
    ['Accounts', UserRound, onOpenAccount], ['Indicators', ChartNoAxesCombined, onOpenIndicators],
    ['Platform settings', Settings2, onOpenSettings], ['Help & support', CircleHelp, onOpenHelp],
  ].filter(([, , action]) => typeof action === 'function');
  const readout = chartReadout?.symbol === String(market?.symbol || '').toUpperCase() && chartReadout?.timeframe === mapTimeframe(timeframe) ? chartReadout : null;
  const summaryPrice = formatInstrumentPrice(readout?.close ?? market?.bid, market);
  const change = readout?.changePercent;
  const changeText = Number.isFinite(change) ? `${Math.abs(change) < 0.005 ? '0.00' : change.toFixed(2)}%` : null;
  const changeTone = !Number.isFinite(change) || Math.abs(change) < 0.005 ? 'text-[#96969f]' : change > 0 ? 'text-[#36c99b]' : 'text-[#ef6771]';
  const pnl = Number(account?.floatingPnl);
  const status = market?.sessionOpen === false ? 'CLOSED' : market?.live === true ? 'LIVE' : String(market?.marketState || 'WAIT').toUpperCase();
  const statusColor = status === 'LIVE' ? 'text-emerald-400' : status === 'STALE' ? 'text-amber-400' : 'text-[#89939e]';
  return (
    <header ref={headerRef} data-acg-mobile-audit-header className="relative z-[80] flex h-[calc(48px+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b border-white/[0.08] bg-black px-2 pt-[env(safe-area-inset-top)]">
      <InstrumentAvatar instrument={market} size={22}/>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-1">
          <button type="button" onClick={() => { setPanel(null); onSelectInstrument(); }} className="flex min-w-0 items-center gap-0.5 text-[13px] font-semibold text-[#f0f2f4]" aria-label="Select instrument">
            <span className="truncate">{displaySymbol(market) || '—'}</span><ChevronDown size={12}/>
          </button>
          <span className="text-[12px] text-[#777e86]" aria-hidden="true">·</span>
          <div className="relative shrink-0">
            <button ref={timeTrigger} type="button" className="flex min-h-8 items-center gap-0.5 text-[12px] text-[#a4adb5]" onClick={() => setPanel(timeOpen ? null : 'time')} aria-label="Select chart timeframe" aria-expanded={timeOpen}>
              {timeframe}<ChevronDown size={12}/>
            </button>
            {timeOpen && <div className="absolute left-0 top-full z-[100] mt-1 grid w-[160px] grid-cols-2 gap-1 rounded-md border border-white/[0.12] bg-[#111419] p-1 shadow-xl" role="group" aria-label="Chart timeframes">
              {TIMES.map(tf => <button type="button" key={tf} className={`min-h-9 rounded px-2 text-[12px] ${tf === timeframe ? 'bg-[#e4e7ea] font-semibold text-black' : 'text-[#d0d4d8]'}`} onClick={() => { onTimeframe(tf); setPanel(null); }}>{tf}</button>)}
            </div>}
          </div>
        </div>
        <div data-mobile-header-readout title={readout ? `${readout.inspecting ? 'Selected' : 'Latest'} candle close ${summaryPrice}; candle change ${changeText}` : 'Current bid'} className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] font-medium tabular-nums">
          <span className={`size-1.5 rounded-full ${status === 'LIVE' ? 'bg-emerald-400' : status === 'STALE' ? 'bg-amber-400' : 'bg-[#6e7882]'}`}/>
          <span className={`shrink-0 ${statusColor}`}>{readout?.inspecting ? 'CANDLE' : status}</span>
          <span className="shrink-0 text-[#66666f]">·</span>
          <span className="truncate text-[#b9b9c1]">{summaryPrice || '—'}</span>
          {changeText && <span className={`shrink-0 ${changeTone}`}>{change > 0 && Math.abs(change) >= 0.005 ? '+' : ''}{changeText}</span>}
        </div>
      </div>
      <button type="button" onClick={() => { setPanel(null); onOpenTrades(); }} aria-label={`Open positions, ${positionsCount} active`} className="flex min-h-9 shrink-0 items-center gap-1.5 px-1">
      <span className="flex min-w-0 flex-col items-end justify-center overflow-hidden">
        <span className="text-[9px] text-[#858f99]">P&amp;L</span>
        <strong className={`max-w-[98px] truncate font-mono text-[12px] font-semibold tabular-nums ${Number.isFinite(pnl) && pnl < 0 ? 'text-[#ef6771]' : Number.isFinite(pnl) && pnl > 0 ? 'text-[#36c99b]' : 'text-[#cbd2d8]'}`}>{money(account?.floatingPnl, account?.currency)}</strong>
      </span>
      <span className="grid min-w-5 h-5 place-items-center rounded-[4px] bg-[#202023] px-1 text-[10px] tabular-nums text-[#d1d7dc]">{positionsCount}</span>
      </button>
      <button ref={menuTrigger} type="button" onClick={() => setPanel(panel === 'menu' ? null : 'menu')} className="grid min-h-9 min-w-8 place-items-center text-[#d0d7dd]" aria-label="Open terminal menu" aria-haspopup="menu" aria-expanded={panel === 'menu'}><MoreVertical size={18}/></button>
      {panel === 'menu' && <div ref={menuRef} role="menu" aria-label="Terminal navigation" onKeyDown={event => {
        const items = Array.from(event.currentTarget.querySelectorAll('[role="menuitem"]'));
        const index = items.indexOf(document.activeElement);
        let next;
        if (event.key === 'ArrowDown') next = (index + 1) % items.length;
        if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = items.length - 1;
        if (next != null) { event.preventDefault(); items[next]?.focus(); }
      }} className="absolute right-2 top-full z-[100] mt-1 w-[208px] max-h-[calc(100dvh-64px)] overflow-y-auto overscroll-contain rounded-[6px] border border-white/[0.12] bg-[#17171a] p-1">
        {destinations.map(([label, Icon, action]) => <button key={label} role="menuitem" type="button" onClick={() => { setPanel(null); action(); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-[4px] px-2.5 text-left text-[12px] text-[#dedee3] hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none"><Icon size={15} strokeWidth={1.5}/><span>{label}</span></button>)}
      </div>}
    </header>
  );
}
