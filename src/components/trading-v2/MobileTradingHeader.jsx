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
  const pnlTone = pnl > 0 ? 'text-[#32ddb0]' : pnl < 0 ? 'text-[#ff6675]' : 'text-[#d7dce3]';
  const openPositionsCount = Math.max(0, Number(positionsCount) || 0);

  return (
    <header className="acg-mobile-reference-header grid h-[calc(66px+env(safe-area-inset-top))] w-full shrink-0 grid-cols-[minmax(0,1fr)_46px_88px_72px] pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        onClick={onSelectInstrument}
        className="flex min-w-0 items-center gap-2.5 px-3 text-left active:opacity-80"
        aria-label="Open markets and watchlist"
      >
        <span className="acg-mobile-instrument-icon-shell grid shrink-0 place-items-center">
          <InstrumentAvatar instrument={market} size={30}/>
        </span>
        <div className="acg-mobile-instrument-meta min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <strong className="truncate text-[17px] font-black leading-none tracking-[-0.035em] text-[#f7f9fb]">{symbol || '—'}</strong>
            <ChevronDown size={16} className="shrink-0 text-[#c4ccd5]" strokeWidth={2.2}/>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.065em]">
            <span className="text-[#8b94a3]">{category}</span>
            <span className="size-1.5 rounded-full bg-[#22d3b6]" aria-hidden="true"/>
            <span className={marketStatus === 'LIVE' ? 'text-[#31e1bc]' : 'text-[#89929f]'}>{marketStatus}</span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onFavorite}
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        className={`acg-mobile-header-star acg-mobile-header-divider grid place-items-center active:scale-95 ${favorite ? 'text-[#f5c85b]' : 'text-[#eef2f7]'}`}
      >
        <Star size={21} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.9}/>
      </button>

      <button
        type="button"
        onClick={onOpenTrades}
        className="acg-mobile-pnl-card mx-2 my-2 flex min-w-0 flex-col items-center justify-center rounded-[8px] px-1 active:brightness-110"
        aria-label={`Open trades and floating P&L${openPositionsCount ? `, ${openPositionsCount} open positions` : ''}`}
      >
        <span className="text-[10px] font-extrabold uppercase tracking-[0.035em] text-[#aab4c3]">P&amp;L</span>
        <strong className={`mt-1 max-w-full truncate font-mono text-[15px] font-black leading-none tabular-nums tracking-[-0.035em] ${pnlTone}`}>{money(pnl, account?.currency || 'USD')}</strong>
      </button>

      <button
        type="button"
        onClick={onOpenAccount}
        className="acg-mobile-account-selector acg-mobile-header-divider flex flex-col items-center justify-center px-1 text-[#f5f7fa] active:bg-white/[0.035]"
        aria-label="Open ACG account"
      >
        <span className="flex items-center gap-1 text-[14px] font-black tracking-[-0.04em]">
          ACG
          <ChevronDown size={13} strokeWidth={2.5} className="text-[#b5bfcb]"/>
        </span>
        <span className="mt-1.5 flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#8f9baa]">
          Trader
          <span className="size-1.5 rounded-full bg-[#22d3b6]" aria-hidden="true"/>
        </span>
      </button>
    </header>
  );
}
