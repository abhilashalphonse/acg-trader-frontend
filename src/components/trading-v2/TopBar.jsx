import React, { useEffect, useState } from 'react';
import { Bell, Check, ChevronDown, Loader2, Search, UserRound } from 'lucide-react';
import { accountStatusLabel, accountStatusToneClass, accountTypeBadge, accountTypeLabel } from '../../utils/accountPresentation.js';

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

function accountSize(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  const code = String(currency || 'USD').toUpperCase();
  const symbol = code === 'USD' ? '$' : code + ' ';
  if (numeric >= 1_000_000) return symbol + (numeric / 1_000_000).toFixed(numeric % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (numeric >= 1_000) return symbol + (numeric / 1_000).toFixed(numeric % 1_000 === 0 ? 0 : 1) + 'K';
  return symbol + numeric.toLocaleString('en-US');
}

function accountGroups(accounts = []) {
  const result = [
    { id: 'trading', label: 'Trading', items: [] },
    { id: 'trial', label: 'Trial', items: [] },
    { id: 'closed', label: 'Breached / closed', items: [] },
  ];
  for (const account of accounts) {
    const status = String(account?.status || '').toUpperCase();
    if (['BREACHED', 'DISABLED', 'CLOSED'].includes(status)) result[2].items.push(account);
    else if (accountTypeBadge(account) === 'TRIAL') result[1].items.push(account);
    else result[0].items.push(account);
  }
  return result.filter(group => group.items.length);
}

function phaseLabel(account) {
  const phase = account?.challenge?.phase;
  return phase ? 'Phase ' + phase : null;
}
export default function TopBar({
  account = null,
  accounts = [],
  activeAccountId = null,
  connectionStatus = 'disconnected',
  accountSwitching = false,
  accountSwitchError = null,
  onSelectAccount = () => false,
  onSearch = () => {},
  onNotifications = () => {},
  onProfile = () => {},
}) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [menuError, setMenuError] = useState('');

  useEffect(() => {
    if (!accountMenuOpen) setMenuError('');
  }, [accountMenuOpen]);

  const currency = account?.currency || 'USD';
  const balance = account?.balance;
  const valuationStatus = String(account?.valuationStatus || 'WAITING').toUpperCase();
  const accountStatus = String(account?.status || 'UNKNOWN').toUpperCase();
  const live = connectionStatus === 'ready' && valuationStatus === 'LIVE' && accountStatus === 'ACTIVE' && account?.tradingEnabled === true && !accountSwitching;
  const groups = accountGroups(accounts);
  const stateLabel = accountSwitching
    ? 'Switching'
    : live
      ? 'Live'
      : connectionStatus !== 'ready'
        ? 'Reconnecting'
        : valuationStatus !== 'LIVE'
          ? valuationStatus
          : accountStatusLabel(accountStatus);

  const chooseAccount = nextId => {
    try {
      const changed = onSelectAccount(nextId);
      if (changed !== false) {
        setMenuError('');
        setAccountMenuOpen(false);
      }
    } catch (error) {
      setMenuError(error?.message || 'Unable to switch account');
    }
  };

  return (
    <header className="relative flex h-[60px] items-center justify-between gap-1.5 px-2.5 sm:gap-2 sm:px-3">
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

        <button type="button" onClick={onNotifications} aria-label="Notifications" className="relative grid size-9 place-items-center rounded-md border border-white/[0.08] bg-black text-[#a0a0a5] active:scale-95">
          <Bell size={18} />
        </button>

        <button
          type="button"
          onClick={() => setAccountMenuOpen(value => !value)}
          className="flex h-9 min-w-[92px] items-center justify-between gap-1 rounded-xl border border-white/[0.08] bg-black px-2.5 text-left active:scale-[0.99]"
          aria-label="Switch trading account"
          aria-expanded={accountMenuOpen}
        >
          <div className="min-w-0">
            <strong className="block truncate text-[11px] font-extrabold tracking-[-0.015em] text-[#f6f9fc]">{money(balance, currency)}</strong>
            <span className="mt-0.5 flex items-center gap-1 text-[8px] font-medium text-[#7e7e84]">
              {accountSwitching ? <Loader2 size={9} className="animate-spin text-[#53c7ff]"/> : <span className={`size-1.5 rounded-full ${live ? 'bg-[#31dfa3]' : valuationStatus === 'STALE' ? 'bg-[#eab84e]' : 'bg-[#343434]'}`} />}
              <span className="truncate">{account ? `${accountTypeBadge(account)} · ${stateLabel}` : stateLabel}</span>
            </span>
          </div>
          <ChevronDown size={11} className={`shrink-0 text-[#7f8c96] transition ${accountMenuOpen ? 'rotate-180' : ''}`}/>
        </button>

        <button type="button" onClick={onProfile} aria-label="Profile" className="hidden size-9 place-items-center rounded-md border min-[380px]:grid border-white/[0.08] bg-[#080808] text-[#99adc3] active:scale-95">
          <UserRound size={18} fill="currentColor" className="opacity-90" />
        </button>
      </div>

      {accountMenuOpen && (
        <>
          <button type="button" aria-label="Close account switcher" onClick={() => setAccountMenuOpen(false)} className="fixed inset-0 z-[89] cursor-default bg-transparent" />
          <div className="absolute right-2 top-[54px] z-[90] w-[min(318px,calc(100vw-16px))] overflow-hidden rounded-xl border border-white/[0.10] bg-[#0b0b0d] shadow-[0_22px_70px_rgba(0,0,0,.70)]">
            <div className="border-b border-white/[0.07] px-3 py-2.5">
              <strong className="block text-[10px] font-black text-[#eef4f8]">Trading accounts</strong>
              <span className="mt-0.5 block text-[7.5px] text-[#687783]">Switching reloads positions, orders, history and risk before execution resumes.</span>
            </div>
            {accountSwitchError && <div className="border-b border-[#54262f] bg-[#1a0d11] px-3 py-2 text-[8px] font-semibold text-[#f08a95]">{accountSwitchError} · Select the account again to retry.</div>}
            {menuError && <div className="border-b border-[#54262f] bg-[#1a0d11] px-3 py-2 text-[8px] font-semibold text-[#f08a95]">{menuError}</div>}
            <div className="max-h-[55dvh] overflow-y-auto">
              {groups.map(group => (
                <div key={group.id}>
                  <div className="border-b border-white/[0.05] bg-black/25 px-3 py-1.5 text-[6.5px] font-black uppercase tracking-[0.10em] text-[#53616c]">{group.label}</div>
                  {group.items.map(item => {
                    const id = String(item.id);
                    const selected = id === String(activeAccountId || '');
                    const status = String(item.status || 'UNKNOWN').toUpperCase();
                    const phase = phaseLabel(item);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => chooseAccount(id)}
                        disabled={accountSwitching && !selected}
                        className={`flex w-full items-center gap-2.5 border-b border-white/[0.06] px-3 py-3 text-left disabled:cursor-wait disabled:opacity-45 ${selected ? 'bg-white/[0.045]' : 'bg-transparent active:bg-white/[0.035]'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <strong className="truncate text-[10px] font-black text-[#eef4f8]">{item.accountCode || 'Trading account'}</strong>
                            <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-[0.06em] text-[#aeb9c2]">{accountTypeBadge(item)}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[7.5px] text-[#6f7f8c]">
                            <span className="font-bold text-[#9aa8b2]">{accountSize(item.initialBalance, item.currency || 'USD')}</span>
                            {phase && <><span>·</span><span>{phase}</span></>}
                            <span>·</span>
                            <span className={accountStatusToneClass(status)}>{accountStatusLabel(status)}</span>
                          </div>
                          <span className="mt-0.5 block text-[7px] text-[#56636d]">Equity {money(item.equity, item.currency || 'USD')}</span>
                        </div>
                        {selected && (accountSwitching ? <Loader2 size={13} className="shrink-0 animate-spin text-[#53c7ff]"/> : <Check size={13} className="shrink-0 text-[#53c7ff]"/>)}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!groups.length && <div className="px-3 py-4 text-center text-[8px] text-[#687783]">No trading accounts are available.</div>}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
