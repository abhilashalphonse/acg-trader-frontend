import React, { useMemo } from 'react';
import { Bell, Search, UserRound } from 'lucide-react';
import { useTraderAuth } from '../../hooks/useTraderAuth.js';
import { useTradingStore } from '../../hooks/useTradingStore.js';

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
  const stateLabel = live ? 'Live' : connection.status !== 'ready' ? 'Reconnecting' : valuationStatus !== 'LIVE' ? valuationStatus : accountStatus;

  return (
    <header className="flex h-[60px] items-center justify-between gap-2 px-3">
      <div className="min-w-0 leading-none">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-[15px] font-extrabold tracking-[-0.025em] text-[#f7f9fc]">
          <span>ACG Trader</span>
          <span className="rounded-md bg-[#0d2b42] px-1.5 py-1 text-[9px] font-extrabold tracking-[0.04em] text-[#55bdff]">V2</span>
        </div>
        <p className="mt-1.5 truncate text-[9px] font-medium text-[#65788e]">{account?.accountCode || 'Trading terminal'}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onSearch} aria-label="Search" className="grid size-8 place-items-center rounded-lg text-[#9db0c6] transition hover:bg-white/[0.04] hover:text-white active:scale-95">
          <Search size={20} strokeWidth={2} />
        </button>

        <button type="button" onClick={onNotifications} aria-label="Notifications" className="relative grid size-9 place-items-center rounded-xl border border-[#192b3b] bg-[#09131d] text-[#9eb0c4] shadow-[inset_0_1px_rgba(255,255,255,0.02)] active:scale-95">
          <Bell size={18} />
        </button>

        <button type="button" onClick={onProfile} className="flex h-9 min-w-[94px] flex-col justify-center rounded-xl border border-[#1a2b3b] bg-[#09131d] px-2.5 text-left shadow-[inset_0_1px_rgba(255,255,255,0.02)] active:scale-[0.99]">
          <strong className="whitespace-nowrap text-[11px] font-extrabold tracking-[-0.015em] text-[#f6f9fc]">{money(balance, currency)}</strong>
          <span className="mt-0.5 flex items-center gap-1 text-[8px] font-medium text-[#77899d]">
            <span className={`size-1.5 rounded-full ${live ? 'bg-[#31dfa3]' : valuationStatus === 'STALE' ? 'bg-[#eab84e]' : 'bg-[#66788c]'}`} />
            {stateLabel}
          </span>
        </button>

        <button type="button" onClick={onProfile} aria-label="Profile" className="grid size-9 place-items-center rounded-full border border-[#1a2b3b] bg-gradient-to-br from-[#102235] to-[#0a131e] text-[#99adc3] shadow-[0_5px_18px_rgba(0,0,0,0.25)] active:scale-95">
          <UserRound size={18} fill="currentColor" className="opacity-90" />
        </button>
      </div>
    </header>
  );
}
