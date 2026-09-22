import React from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight, Star } from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';

function displaySymbol(symbol = '') {
  const normalized = String(symbol || '').toUpperCase();
  if (normalized.length === 6 && /^[A-Z]+$/.test(normalized)) {
    return `${normalized.slice(0, 3)}/${normalized.slice(3)}`;
  }
  return normalized;
}

function marketCategory(market) {
  const explicit = String(
    market?.assetClass ||
    market?.category ||
    market?.marketType ||
    market?.instrumentType ||
    market?.type ||
    ''
  ).toUpperCase();

  if (explicit.includes('FOREX') || explicit.includes('FX')) return 'FOREX';
  if (explicit.includes('METAL')) return 'METALS';
  if (explicit.includes('CRYPTO')) return 'CRYPTO';
  if (explicit.includes('IND')) return 'INDICES';
  if (explicit.includes('STOCK') || explicit.includes('EQUITY')) return 'STOCKS';

  const symbol = String(market?.symbol || '').toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)/.test(symbol)) return 'METALS';
  if (/^(BTC|ETH|SOL|XRP|LTC|DOGE|ADA|BNB)/.test(symbol)) return 'CRYPTO';
  if (/^(US30|NAS100|USTEC|SPX500|US500|GER40|UK100|FRA40|JP225)/.test(symbol)) return 'INDICES';
  if (/^[A-Z]{6}$/.test(symbol)) return 'FOREX';
  return 'MARKET';
}

function money(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: numeric > 0 ? 'always' : 'auto',
    }).format(numeric);
  } catch {
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(2)} ${currency || ''}`.trim();
  }
}

export default function MobileTradingHeader({
  market,
  account,
  positionsCount = 0,
  favorite = false,
  onFavorite = () => {},
  onSelectInstrument = () => {},
  onOpenTrades = () => {},
  onOpenAccount = () => {},
}) {
  const symbol = market?.displaySymbol || displaySymbol(market?.symbol);
  const category = marketCategory(market);
  const marketStatus = market?.sessionOpen === false ? 'CLOSED' : market?.live ? 'LIVE' : String(market?.marketState || 'WAIT').toUpperCase();
  const floatingPnl = Number(account?.floatingPnl);
  const pnl = Number.isFinite(floatingPnl) ? floatingPnl : 0;
  const pnlTone = pnl > 0 ? 'text-[#31d79b]' : pnl < 0 ? 'text-[#f05d68]' : 'text-[#b7c0c8]';
  const openPositionsCount = Math.max(0, Number(positionsCount) || 0);

  return (
    <header className="acg-mobile-metal-surface grid h-[44px] w-full shrink-0 grid-cols-[minmax(0,1fr)_60px_84px_58px] bg-[#0b0b0d]">
      <div className="relative flex min-w-0 items-center px-1">
        <button
          type="button"
          onClick={onSelectInstrument}
          className="flex min-w-0 flex-1 items-center gap-1 text-left active:opacity-80"
          aria-label="Open markets and watchlist"
        >
          <InstrumentAvatar instrument={market} size={21}/>
          <div className="min-w-0">
            <div className="flex items-center gap-0.5">
              <strong className="truncate text-[10px] font-black tracking-[-0.025em] text-[#f4f6f8] min-[360px]:text-[10.5px]">{symbol || '—'}</strong>
              <ChevronDown size={10} className="shrink-0 text-[#8d99a4]" strokeWidth={2.2}/>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[5.8px] font-bold uppercase tracking-[0.055em]">
              <span className="text-[#687783]">{category}</span>
              <span className={marketStatus === 'LIVE' ? 'text-[#31d79b]' : 'text-[#7e8993]'}>{marketStatus}</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onFavorite}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`grid size-5 shrink-0 place-items-center active:scale-95 ${favorite ? 'text-[#f6c95d]' : 'text-[#65747f]'}`}
        >
          <Star size={10} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.8}/>
        </button>

        <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-[#53c7ff]" />
      </div>

      <button
        type="button"
        onClick={onOpenTrades}
        className="relative flex min-w-0 flex-col items-center justify-center overflow-visible text-[#c8d1d8] active:bg-white/[0.045]"
        aria-label={`Open trades${openPositionsCount ? `, ${openPositionsCount} open positions` : ''}`}
      >
        <span className="relative grid size-[22px] place-items-center overflow-visible">
          <ArrowUpDown size={15} strokeWidth={2.15} className="text-[#d8e0e6]"/>
          {openPositionsCount > 0 && (
            <span className="absolute -right-1.5 -top-1 inline-flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-blue-500 px-[3px] text-[6.5px] font-bold leading-none text-white ring-1 ring-black shadow-sm">
              {openPositionsCount > 9 ? '9+' : openPositionsCount}
            </span>
          )}
        </span>
        <span className="mt-[2px] text-[6.5px] font-black uppercase tracking-[0.07em] text-[#aeb9c2]">Trades</span>
      </button>

      <div className="flex min-w-0 flex-col items-center justify-center px-1">
        <span className="rounded-[2px] bg-white/[0.10] px-1.5 py-[1px] text-[6px] font-black uppercase leading-none tracking-[0.09em] text-[#dfe6ec]">P&amp;L</span>
        <strong className={`mt-[3px] max-w-full truncate font-mono text-[10.5px] font-black leading-none tabular-nums tracking-[-0.045em] min-[360px]:text-[11px] ${pnlTone}`}>{money(pnl, account?.currency || 'USD')}</strong>
      </div>

      <button type="button" onClick={onOpenAccount} className="flex items-center justify-center gap-0.5 px-1 text-[10.5px] font-black tracking-[-0.025em] text-[#f4f7f9] active:bg-white/[0.045]" aria-label="Open ACG account">
        <span>ACG</span>
        <ChevronRight size={12} strokeWidth={2.6} className="text-[#a8b4be]"/>
      </button>
    </header>
  );
}
