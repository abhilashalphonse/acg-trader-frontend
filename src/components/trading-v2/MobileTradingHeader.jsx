import React from 'react';
import { ChevronDown, Star } from 'lucide-react';
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
  pendingCount = 0,
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
  const tradeCount = Math.max(0, Number(positionsCount) || 0) + Math.max(0, Number(pendingCount) || 0);

  return (
    <header className="grid h-[44px] w-full shrink-0 grid-cols-[minmax(0,1.35fr)_70px_68px_48px] border-b border-white/[0.08] bg-[#080808]">
      <div className="relative flex min-w-0 items-center border-r border-white/[0.06] px-1.5">
        <button
          type="button"
          onClick={onSelectInstrument}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left active:opacity-80"
          aria-label="Open markets and watchlist"
        >
          <InstrumentAvatar instrument={market} size={22}/>
          <div className="min-w-0">
            <div className="flex items-center gap-0.5">
              <strong className="truncate text-[10.5px] font-black tracking-[-0.025em] text-[#f4f6f8]">{symbol || '—'}</strong>
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
          className={`ml-0.5 grid size-6 shrink-0 place-items-center active:scale-95 ${favorite ? 'text-[#f6c95d]' : 'text-[#6f7d88]'}`}
        >
          <Star size={12} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.8}/>
        </button>

        <span className="absolute bottom-0 left-1.5 right-1.5 h-0.5 bg-[#53c7ff]" />
      </div>

      <button type="button" onClick={onOpenTrades} className="relative flex min-w-0 flex-col items-center justify-center border-r border-white/[0.06] text-[#9ba6af] active:bg-white/[0.035]">
        <span className="text-[7px] font-black uppercase tracking-[0.08em]">Trades</span>
        <span className="mt-1 font-mono text-[7px] font-bold tabular-nums text-[#d7dfe5]">{tradeCount ? tradeCount : '—'}</span>
      </button>

      <div className="flex min-w-0 flex-col items-center justify-center border-r border-white/[0.06]">
        <span className="text-[6px] font-black uppercase tracking-[0.09em] text-[#6f7b85]">P&amp;L</span>
        <strong className={`mt-1 max-w-full truncate px-1 font-mono text-[8px] font-black tabular-nums ${pnlTone}`}>{money(pnl, account?.currency || 'USD')}</strong>
      </div>

      <button type="button" onClick={onOpenAccount} className="flex items-center justify-center text-[10px] font-black tracking-[-0.02em] text-[#f4f6f8] active:bg-white/[0.035]" aria-label="Open ACG account">
        ACG
      </button>
    </header>
  );
}
