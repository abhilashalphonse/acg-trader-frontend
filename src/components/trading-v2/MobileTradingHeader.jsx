import React from 'react';
import { ArrowUpDown, ChevronDown, MoreVertical } from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import { marketVenue } from '../../utils/marketClassification.js';

function displaySymbol(symbol = '') {
  const normalized = String(symbol || '').toUpperCase();
  if (normalized.length === 6 && /^[A-Z]+$/.test(normalized)) {
    return `${normalized.slice(0, 3)}/${normalized.slice(3)}`;
  }
  return normalized;
}

function marketCategory(market) {
  const venue = marketVenue(market);
  if (venue) return venue;

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
  const activityCount = Math.max(0, Number(positionsCount) || 0) + Math.max(0, Number(pendingCount) || 0);

  return (
    <header className="acg-mobile-reference-header grid h-[calc(66px+env(safe-area-inset-top))] w-full shrink-0 grid-cols-[minmax(0,1fr)_68px_86px_42px] pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        onClick={onSelectInstrument}
        className="acg-mobile-instrument-selector relative flex min-w-0 items-center gap-2.5 px-3 text-left active:opacity-80"
        aria-label="Open markets and watchlist"
      >
        <span className="acg-mobile-instrument-icon-shell grid shrink-0 place-items-center">
          <InstrumentAvatar instrument={market} size={26}/>
        </span>
        <div className="acg-mobile-instrument-meta min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <strong className="truncate text-[17px] font-black leading-none tracking-[-0.035em] text-[#f7f9fb]">{symbol || '—'}</strong>
            <ChevronDown size={16} className="shrink-0 text-[#c4ccd5]" strokeWidth={2.2}/>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.065em]">
            <span className="text-[#8b94a3]">{category}</span>
            <span className={`size-1.5 rounded-full ${marketStatus === 'LIVE' ? 'bg-[#22d3b6]' : marketStatus === 'STALE' ? 'bg-[#e7bd58]' : 'bg-[#566575]'}`} aria-hidden="true"/>
            <span className={marketStatus === 'LIVE' ? 'text-[#31e1bc]' : 'text-[#89929f]'}>{marketStatus}</span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onOpenTrades}
        className="acg-mobile-trades-button acg-mobile-header-divider flex min-w-0 flex-col items-center justify-center gap-1 text-[#dfe6ee] active:bg-white/[0.035]"
        aria-label={`Open trades${activityCount ? `, ${activityCount} active` : ''}`}
      >
        <span className="relative grid place-items-center">
          <ArrowUpDown size={17} strokeWidth={2}/>
          {activityCount > 0 && (
            <span className="absolute -right-3 -top-1 min-w-3.5 rounded-full bg-[#195be1] px-1 text-center text-[7px] font-bold leading-[14px] text-white">
              {activityCount > 99 ? '99+' : activityCount}
            </span>
          )}
        </span>
        <span className="text-[9px] font-semibold tracking-[-0.01em] text-[#b9c3ce]">Trades</span>
      </button>

      <div className="acg-mobile-pnl-card mx-1.5 my-2 flex min-w-0 flex-col items-center justify-center rounded-[8px] px-1" aria-label="Floating P&L">
        <span className="text-[9px] font-semibold uppercase tracking-[0.035em] text-[#98a4b2]">P&amp;L</span>
        <strong className={`mt-1 max-w-full truncate font-mono text-[14px] font-semibold leading-none tabular-nums tracking-[-0.025em] ${pnlTone}`}>{money(pnl, account?.currency || 'USD')}</strong>
      </div>

      <button
        type="button"
        onClick={onOpenAccount}
        className="acg-mobile-menu-button acg-mobile-header-divider grid place-items-center text-[#dce3ea] active:bg-white/[0.035]"
        aria-label="Open account and platform menu"
      >
        <MoreVertical size={20} strokeWidth={2}/>
      </button>
    </header>
  );
}
