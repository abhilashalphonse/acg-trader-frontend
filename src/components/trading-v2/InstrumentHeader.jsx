import React from 'react';
import { ChevronDown, Star } from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';

const names = {
  AUDCAD: 'Australian Dollar / Canadian Dollar',
  EURUSD: 'Euro / US Dollar',
  GBPUSD: 'British Pound / US Dollar',
  USDJPY: 'US Dollar / Japanese Yen',
  XAUUSD: 'Gold / US Dollar',
  US30: 'Dow Jones Industrial Average',
};

function displaySymbol(symbol = '') {
  if (symbol.length === 6 && /^[A-Z]+$/.test(symbol)) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}

export default function InstrumentHeader({ market, favorite, onFavorite, onSelectInstrument = () => {} }) {
  const symbol = displaySymbol(market?.symbol);
  const status = market?.sessionOpen === false
    ? 'CLOSED'
    : market?.live
      ? 'LIVE'
      : market?.isStale
        ? 'STALE'
        : String(market?.marketState || 'WAITING').toUpperCase();
  const statusTone = status === 'LIVE'
    ? 'text-[#39d7a1]'
    : status === 'STALE'
      ? 'text-[#e7bd58]'
      : status === 'CLOSED'
        ? 'text-[#7d8fa1]'
        : 'text-[#8fa0b1]';

  return (
    <div className="flex items-center gap-2.5 px-3 pb-3 pt-3 sm:px-4 sm:pt-4">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <InstrumentAvatar instrument={market} size={34}/>
        <div className="min-w-0">
          <button type="button" onClick={onSelectInstrument} className="flex max-w-full items-center gap-1 border-0 bg-transparent p-0 text-left text-[18px] font-black tracking-[-0.04em] text-[#f5f7fb] active:scale-[0.99] sm:text-[20px]">
            <span className="truncate">{market?.displaySymbol || symbol}</span>
            <ChevronDown size={16} className="shrink-0 text-[#dce6ee]" strokeWidth={2.3} />
          </button>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[8px] font-semibold">
            <span className="truncate text-[#74879b]">{market?.name || names[market?.symbol] || symbol}</span>
            <span className={`shrink-0 ${statusTone}`}>{status}</span>
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-x-2 text-right">
        <div>
          <span className="block text-[7px] font-bold uppercase tracking-[0.08em] text-[#607488]">Bid</span>
          <strong className="mt-1 block font-mono text-[12px] font-black text-[#dfe8ef] sm:text-[14px]">{market?.bid || '—'}</strong>
        </div>
        <div>
          <span className="block text-[7px] font-bold uppercase tracking-[0.08em] text-[#607488]">Ask</span>
          <strong className="mt-1 block font-mono text-[12px] font-black text-[#aebdca] sm:text-[14px]">{market?.ask || '—'}</strong>
        </div>
      </div>

      <button
        type="button"
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={onFavorite}
        className={`grid size-8 shrink-0 place-items-center rounded-lg border border-[#1c2d3e] bg-[#0a141e] shadow-[inset_0_1px_rgba(255,255,255,0.02)] active:scale-95 ${favorite ? 'text-[#ffc856]' : 'text-[#667b8f]'}`}
      >
        <Star size={16} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.8} />
      </button>
    </div>
  );
}
