import React from 'react';
import { ChevronDown, List, MoreVertical } from 'lucide-react';
import { formatMobileFloatingPnl, mobilePnlTone, openPositionsBadge } from '../../utils/mobileHeaderPresentation.js';
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

export default function MobileTradingHeader({
  market,
  account,
  positionsCount = 0,
  onSelectInstrument = () => {},
  onOpenTrades = () => {},
  onOpenPnl = () => {},
  onOpenAccount = () => {},
}) {
  const symbol = market?.displaySymbol || displaySymbol(market?.symbol);
  const category = marketCategory(market);
  const marketStatus = market?.sessionOpen === false ? 'CLOSED' : market?.live ? 'LIVE' : String(market?.marketState || 'WAIT').toUpperCase();
  const pnl = account?.floatingPnl;
  const currency = account?.currency || 'USD';
  const pnlTone = mobilePnlTone(pnl);
  const pnlClass = pnlTone === 'profit' ? 'text-[#32ddb0]' : pnlTone === 'loss' ? 'text-[#ff6675]' : 'text-[#e8e8e8]';
  const badge = openPositionsBadge(positionsCount);

  return (
    <header className="acg-mobile-reference-header acg-mobile-option-c-header grid h-[calc(66px+env(safe-area-inset-top))] w-full shrink-0 items-center pt-[env(safe-area-inset-top)]">
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
        onClick={onOpenPnl}
        aria-label={`Floating profit and loss ${formatMobileFloatingPnl(pnl, currency, false)}. Open account breakdown`}
        title={formatMobileFloatingPnl(pnl, currency, false)}
        className="acg-mobile-inline-pnl flex h-11 min-w-0 items-center justify-end overflow-hidden px-0.5 text-right active:opacity-70"
      >
        <strong className={`block max-w-full truncate whitespace-nowrap font-mono text-[12px] font-semibold tabular-nums tracking-[-0.035em] transition-colors duration-200 motion-reduce:transition-none ${pnlClass}`}>
          {formatMobileFloatingPnl(pnl, currency)}
        </strong>
      </button>

      <button
        type="button"
        onClick={onOpenTrades}
        aria-label={`Open trades${badge ? `, ${badge} open positions` : ''}`}
        className="acg-mobile-trades-hit flex h-11 min-w-0 items-center justify-center px-0.5 active:opacity-85"
      >
        <span className="acg-mobile-trades-pill relative inline-flex h-[32px] min-w-0 items-center justify-center gap-1 rounded-full px-2.5 text-[#eaeaea]">
          <List size={13} strokeWidth={1.9} className="shrink-0" aria-hidden="true"/>
          <span className="whitespace-nowrap text-[11px] font-medium tracking-[-0.01em]">Trades</span>
          {badge && (
            <span className="absolute -right-1.5 -top-1 grid min-h-[15px] min-w-[15px] place-items-center rounded-full border border-[#090909] bg-[#363636] px-1 text-[9px] font-semibold leading-none text-white" aria-hidden="true">
              {badge}
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenAccount}
        className="acg-mobile-menu-hit grid h-11 w-11 place-items-center text-[#b8b8b8] active:text-white"
        aria-label="Open account and platform menu"
      >
        <MoreVertical size={20} strokeWidth={2}/>
      </button>
    </header>
  );
}
