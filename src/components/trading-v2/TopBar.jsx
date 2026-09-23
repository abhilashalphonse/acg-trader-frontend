import React, { useMemo } from 'react';
import { Bell, Search, UserRound } from 'lucide-react';
import { useTraderAuth } from '../../hooks/useTraderAuth.js';
import { useTradingStore } from '../../hooks/useTradingStore.js';
import { accountStatusLabel, accountTypeBadge, accountTypeLabel } from '../../utils/accountPresentation.js';

function money(value, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

export default function TopBar({
  onSearch = () => {},
  onNotifications = () => {},
  onProfile = () => {},
}) {
  const auth = useTraderAuth();
  const { trading, connection } = useTradingStore();
  const accountView = useMemo(() => {
    const granted = auth.principal?.accountIds?.map(String) || [];
    const accountId = granted.find(id => trading.accountsById[id]) || granted[0] || Object.keys(trading.accountsById)[0];
    const account = accountId ? trading.accountsById[accountId] : null;
    const valuation = accountId ? trading.valuationsByAccountId[accountId] : null;
    return { account, valuation };
  }, [auth.principal?.accountIds, trading.accountsById, trading.valuationsByAccountId]);

  const { account, valuation } = accountView;
  const currency = account?.currency || 'USD';
  const balance = valuation?.balance ?? account?.state?.balance;
  const valuationStatus = String(valuation?.valuationStatus || 'WAITING').toUpperCase();
  const accountStatus = String(account?.status || 'UNKNOWN').toUpperCase();
  const live = connection.status === 'ready' && valuationStatus === 'LIVE' && accountStatus === 'ACTIVE' && account?.tradingEnabled === true;
  const stateLabel = live ? 'Live' : connection.status !== 'ready' ? 'Reconnecting' : valuationStatus !== 'LIVE' ? valuationStatus : accountStatusLabel(accountStatus);

  return (
    <header className="flex h-[60px] items-center justify-between gap-1.5 px-2.5 sm:gap-2 sm:px-3">
      <div className="min-w-0 leading-none">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-[15px] font-extrabold tracking-[-0.025em] text-[#f7f9fc]">
          <span>ACG Trader</span>
        </div>
        <p className="mt-1.5 truncate text-[9px] font-medium text-[#77777d]">
          {account ? `${account.accountCode || 'Trading account'} · ${accountTypeLabel(account)}` : 'Trading terminal'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onSearch} aria-label="Search" className="grid size-8 place-items-center rounded-lg text-[#a0a0a5] transition hover:bg-white/[0.04] hover:text-white active:scale-95">
          <Search size={20} strokeWidth={2} />
        </button>

        <button type="button" onClick={onNotifications} aria-label="Notifications" className="relative grid size-9 place-items-center rounded-md border border-white/[0.08] bg-black text-[#a0a0a5]  active:scale-95">
          <Bell size={18} />
        </button>

        <button type="button" onClick={onProfile} className="flex h-9 min-w-[78px] flex-col justify-center rounded-xl min-[390px]:min-w-[94px] border border-white/[0.08] bg-black px-2.5 text-left  active:scale-[0.99]">
          <strong className="whitespace-nowrap text-[11px] font-extrabold tracking-[-0.015em] text-[#f6f9fc]">{money(balance, currency)}</strong>
          <span className="mt-0.5 flex items-center gap-1 text-[8px] font-medium text-[#7e7e84]">
            <span className={`size-1.5 rounded-full ${live ? 'bg-[#31dfa3]' : valuationStatus === 'STALE' ? 'bg-[#eab84e]' : 'bg-[#101010]'}`} />
            {account ? `${accountTypeBadge(account)} · ${stateLabel}` : stateLabel}
          </span>
        </button>

        <button type="button" onClick={onProfile} aria-label="Profile" className="hidden size-9 place-items-center rounded-md border min-[380px]:grid border-white/[0.08] bg-[#080808] text-[#99adc3]  active:scale-95">
          <UserRound size={18} fill="currentColor" className="opacity-90" />
        </button>
      </div>
    </header>
  );
}
