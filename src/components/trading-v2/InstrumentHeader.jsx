import React from 'react';
import { ChevronDown, Star } from 'lucide-react';

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
  const positive = !String(market.change || '').startsWith('-');
  const symbol = displaySymbol(market.symbol);

  return (
    <div className="grid grid-cols-[minmax(0,1.15fr)_auto_auto_auto] items-center gap-2 px-4 pb-3 pt-4">
      <div className="min-w-0">
        <button type="button" onClick={onSelectInstrument} className="flex items-center gap-1 border-0 bg-transparent p-0 text-left text-[21px] font-black tracking-[-0.045em] text-[#f5f7fb] active:scale-[0.99]">
          <span>{symbol}</span>
          <ChevronDown size={18} className="mt-0.5 shrink-0 text-[#e8eef5]" strokeWidth={2.3} />
        </button>
        <p className="mt-1.5 truncate text-[10px] font-medium tracking-[-0.01em] text-[#788aa0]">{names[market.symbol] || symbol}</p>
      </div>

      <div className="text-right">
        <strong className="block text-[21px] font-black tracking-[-0.04em] text-[#f7f9fc]">{market.bid}</strong>
        <span className={`mt-1 block whitespace-nowrap text-[10px] font-bold ${positive ? 'text-[#31d59b]' : 'text-[#ff6670]'}`}>
          {positive ? '+0.00052 (+0.05%)' : market.change}
        </span>
      </div>

      <div className="grid grid-cols-[auto_auto] gap-x-2 gap-y-1 text-[9px] leading-none">
        <span className="text-[#6d8096]">High</span><b className="font-semibold text-[#c2cddd]">0.99421</b>
        <span className="text-[#6d8096]">Low</span><b className="font-semibold text-[#c2cddd]">0.99283</b>
        <span className="text-[#6d8096]">Vol</span><b className="font-semibold text-[#c2cddd]">12.4K</b>
      </div>

      <button
        type="button"
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={onFavorite}
        className="grid size-9 place-items-center rounded-xl border border-[#1c2d3e] bg-[#0a141e] text-[#ffc856] shadow-[inset_0_1px_rgba(255,255,255,0.02)] active:scale-95"
      >
        <Star size={18} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.8} />
      </button>
    </div>
  );
}
