import React, { useState } from 'react';
import { ChevronDown, MoreVertical } from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';

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
}) {
  const [timeOpen, setTimeOpen] = useState(false);
  const pnl = Number(account?.floatingPnl);
  const status = market?.sessionOpen === false ? 'CLOSED' : market?.live === true ? 'LIVE' : String(market?.marketState || 'WAIT').toUpperCase();
  const statusColor = status === 'LIVE' ? 'text-emerald-400' : status === 'STALE' ? 'text-amber-400' : 'text-[#89939e]';
  return (
    <header data-acg-mobile-audit-header className="relative z-40 flex h-[calc(48px+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b border-white/[0.08] bg-black px-2 pt-[env(safe-area-inset-top)]">
      <InstrumentAvatar instrument={market} size={22}/>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-1">
          <button type="button" onClick={onSelectInstrument} className="flex min-w-0 items-center gap-0.5 text-[13px] font-semibold text-[#f0f2f4]" aria-label="Select instrument">
            <span className="truncate">{displaySymbol(market) || '—'}</span><ChevronDown size={12}/>
          </button>
          <span className="text-[12px] text-[#777e86]" aria-hidden="true">·</span>
          <div className="relative shrink-0">
            <button type="button" className="flex min-h-8 items-center gap-0.5 text-[12px] text-[#a4adb5]" onClick={() => setTimeOpen(open => !open)} aria-label="Select chart timeframe" aria-expanded={timeOpen}>
              {timeframe}<ChevronDown size={12}/>
            </button>
            {timeOpen && <div className="absolute left-0 top-full z-[100] mt-1 grid w-[160px] grid-cols-2 gap-1 rounded-md border border-white/[0.12] bg-[#111419] p-1 shadow-xl" role="group" aria-label="Chart timeframes">
              {TIMES.map(tf => <button type="button" key={tf} className={`min-h-9 rounded px-2 text-[12px] ${tf === timeframe ? 'bg-[#e4e7ea] font-semibold text-black' : 'text-[#d0d4d8]'}`} onClick={() => { onTimeframe(tf); setTimeOpen(false); }}>{tf}</button>)}
            </div>}
          </div>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-medium ${statusColor}`}>
          <span className={`size-1.5 rounded-full ${status === 'LIVE' ? 'bg-emerald-400' : status === 'STALE' ? 'bg-amber-400' : 'bg-[#6e7882]'}`}/>
          {status}
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-end justify-center overflow-hidden px-1">
        <strong className={`max-w-[98px] truncate font-mono text-[12px] font-semibold tabular-nums ${Number.isFinite(pnl) && pnl < 0 ? 'text-[#ef6771]' : Number.isFinite(pnl) && pnl > 0 ? 'text-[#36c99b]' : 'text-[#cbd2d8]'}`}>{money(account?.floatingPnl, account?.currency)}</strong>
        <span className="text-[9px] text-[#858f99]">P&amp;L</span>
      </div>
      <button type="button" onClick={onOpenTrades} className="flex min-w-9 min-h-9 flex-col items-center justify-center rounded text-[#d1d7dc]" aria-label={`Open positions, ${positionsCount} active`}>
        <strong className="font-mono text-[12px] font-semibold tabular-nums">{positionsCount}</strong><span className="text-[9px] text-[#89929a]">Pos</span>
      </button>
      <button type="button" onClick={onOpenAccount} className="grid min-h-9 min-w-8 place-items-center text-[#d0d7dd]" aria-label="Account and menu"><MoreVertical size={18}/></button>
    </header>
  );
}
