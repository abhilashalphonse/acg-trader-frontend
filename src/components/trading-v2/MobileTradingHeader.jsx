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
  favorite = false,
  onFavorite = () => {},
  onSelectInstrument = () => {},
}) {
  const symbol = market?.displaySymbol || displaySymbol(market?.symbol);
  const category = marketCategory(market);
  const marketStatus = market?.sessionOpen === false ? 'MARKET CLOSED' : 'LIVE';
  const floatingPnl = Number(account?.floatingPnl);
  const pnl = Number.isFinite(floatingPnl) ? floatingPnl : 0;
  const pnlTone = pnl > 0 ? 'text-[#31d79b]' : pnl < 0 ? 'text-[#f05d68]' : 'text-[#a5a5a9]';

  return (
    <header className="flex h-[46px] w-full items-center justify-between gap-1.5 border-b border-white/[0.07] bg-[#080808] px-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <InstrumentAvatar instrument={market} size={26} />

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={onSelectInstrument}
              className="flex min-w-0 items-center gap-0.5 border-0 bg-transparent p-0 text-left text-[14px] font-black tracking-[-0.035em] text-[#f7f7f8] active:scale-[0.99]"
              aria-label="Select instrument"
            >
              <span className="truncate">{symbol || '—'}</span>
              <ChevronDown size={13} className="shrink-0 text-[#9a9a9f]" strokeWidth={2.2} />
            </button>

            <button
              type="button"
              onClick={onFavorite}
              aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`grid size-5 shrink-0 place-items-center border-0 bg-transparent p-0 active:scale-95 ${favorite ? 'text-[#ffc856]' : 'text-[#737378]'}`}
            >
              <Star size={12} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.8} />
            </button>
          </div>

          <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[6.5px] font-bold tracking-[0.035em]">
            <span className="text-[#717176]">{category}</span>
            <span className={marketStatus === 'LIVE' ? 'text-[#31d79b]' : 'text-[#85858a]'}>{marketStatus}</span>
          </div>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="min-w-[44px] text-right leading-none">
          <span className="block text-[6.5px] font-bold uppercase tracking-[0.08em] text-[#77777c]">P&amp;L</span>
          <strong className={`mt-1 block whitespace-nowrap text-[8.5px] font-extrabold ${pnlTone}`}>
            {money(pnl, account?.currency || 'USD')}
          </strong>
        </div>

        <div className="min-w-0 text-right leading-none">
          <div className="flex items-center justify-end gap-1 whitespace-nowrap text-[12px] font-extrabold tracking-[-0.025em] text-[#f7f7f8]">
            <span>ACG Trader</span>
            <span className="rounded bg-[#101010] px-1 py-0.5 text-[6.5px] font-extrabold tracking-[0.04em] text-[#55bdff]">V2</span>
          </div>
          <p className="mt-1 max-w-[105px] truncate text-[6.5px] font-medium text-[#77777d]">
            {account?.accountCode || 'Trading terminal'}
          </p>
        </div>
      </div>
    </header>
  );
}
