import React from 'react';
import { Check, ChevronLeft, ChevronRight, CircleHelp, Loader2, Settings } from 'lucide-react';
import { accountStatusLabel, accountStatusToneClass, accountTypeLabel } from '../../utils/accountPresentation.js';

function money(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency || ''}`.trim();
  }
}

function Action({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[62px] w-full items-center gap-3 border-b border-white/[0.06] px-3 text-left last:border-b-0 active:bg-white/[0.03]">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-[#101216] text-[#8b99a6]"><Icon size={17}/></div>
      <div className="min-w-0 flex-1">
        <b className="block text-[11px] font-bold text-[#e4e9ee]">{title}</b>
        <p className="mt-1 truncate text-[9px] text-[#697580]">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-[#56616b]"/>
    </button>
  );
}

export default function MobileAccountSheet({
  account = {},
  accounts = [],
  activeAccountId = null,
  accountSwitching = false,
  accountSwitchError = null,
  onSelectAccount = () => false,
  onClose = () => {},
  onPlatformSettings = () => {},
  onHelp = () => {},
}) {
  const currency = account?.currency || 'USD';
  const status = String(account?.status || 'UNKNOWN').toUpperCase();
  const floatingPnl = Number(account?.floatingPnl);
  const pnlTone = floatingPnl > 0 ? 'text-[#31d79b]' : floatingPnl < 0 ? 'text-[#ff6975]' : 'text-[#d5dbe1]';

  return (
    <section className="fixed inset-0 z-[110] flex h-dvh w-full min-h-0 flex-col overflow-hidden bg-[#050505] text-[#f4f7fa]">
      <header className="shrink-0 border-b border-white/[0.07] bg-[#070707] pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-2 px-3">
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl text-[#c4ccd4] active:bg-white/[0.06]" aria-label="Back to chart">
            <ChevronLeft size={22} strokeWidth={2}/>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-black tracking-[-0.035em] text-white">Account</h2>
            <p className="mt-0.5 text-[9px] font-medium text-[#727d87]">ACG Trader</p>
          </div>
          {accountSwitching && <div className="flex items-center gap-1.5 rounded-lg border border-[#195be1]/25 bg-[#195be1]/[0.06] px-2 py-1.5 text-[8px] font-bold text-[#8baaff]"><Loader2 size={11} className="animate-spin"/>Syncing</div>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0d10]">
          <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
            <div className="min-w-0">
              <span className="text-[8px] font-black uppercase tracking-[0.11em] text-[#73808b]">{accountTypeLabel(account)}</span>
              <strong className="mt-1.5 block truncate text-[20px] font-black tracking-[-0.04em] text-white">{account?.accountCode || 'Trading account'}</strong>
              <p className="mt-1.5 text-[9px] font-medium text-[#707c87]">{currency}{account?.leverage ? ` · Leverage 1:${account.leverage}` : ''}</p>
            </div>
            <span className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-black ${accountStatusToneClass(status)}`}>{accountStatusLabel(status)}</span>
          </div>

          <div className="grid grid-cols-2 border-t border-white/[0.06]">
            {[
              ['Balance', money(account?.balance, currency), 'text-[#e3e8ed]'],
              ['Equity', money(account?.equity, currency), 'text-[#e3e8ed]'],
              ['Free margin', money(account?.freeMargin, currency), 'text-[#e3e8ed]'],
              ['Floating P&L', money(floatingPnl, currency), pnlTone],
            ].map(([label, value, tone], index) => (
              <div key={label} className={`px-4 py-3 ${index % 2 === 0 ? 'border-r border-white/[0.06]' : ''} ${index < 2 ? 'border-b border-white/[0.06]' : ''}`}>
                <span className="block text-[7px] font-black uppercase tracking-[0.10em] text-[#626e79]">{label}</span>
                <b className={`mt-1.5 block truncate font-mono text-[11px] font-bold tabular-nums ${tone}`}>{value}</b>
              </div>
            ))}
          </div>
        </section>

        {accounts.length > 1 && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090b0e]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <strong className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#a2adb7]">Trading accounts</strong>
              <span className="mt-1 block text-[8px] leading-4 text-[#68737e]">Switch account here. Execution stays locked until positions, orders, history and risk state finish syncing.</span>
            </div>
            {accountSwitchError && <div className="border-b border-[#54262f] bg-[#1a0d11] px-4 py-2.5 text-[8px] font-semibold leading-4 text-[#f08a95]">{accountSwitchError} · Tap the account again to retry.</div>}
            {accounts.map(item => {
              const id = String(item.id);
              const selected = id === String(activeAccountId || '');
              const itemStatus = String(item.status || 'UNKNOWN').toUpperCase();
              return (
                <button
                  key={id}
                  type="button"
                  disabled={accountSwitching && !selected}
                  onClick={() => onSelectAccount(id)}
                  className={`flex min-h-[66px] w-full items-center gap-3 border-b border-white/[0.055] px-4 text-left last:border-b-0 disabled:cursor-wait disabled:opacity-45 ${selected ? 'bg-[#11141a]' : 'active:bg-white/[0.025]'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="truncate text-[11px] font-black text-[#e9edf1]">{item.accountCode || 'Trading account'}</strong>
                      <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.05em] text-[#939faa]">{accountTypeLabel(item)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[8px] text-[#6c7883]">
                      <span className="font-mono text-[#a8b1ba]">{money(item.balance, item.currency || 'USD')}</span>
                      <span>·</span>
                      <span className={accountStatusToneClass(itemStatus)}>{accountStatusLabel(itemStatus)}</span>
                    </div>
                  </div>
                  {selected && (accountSwitching ? <Loader2 size={15} className="shrink-0 animate-spin text-[#195be1]"/> : <Check size={15} className="shrink-0 text-[#195be1]"/>)}
                </button>
              );
            })}
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090b0e]">
          <Action icon={Settings} title="Platform settings" subtitle="Chart, terminal and trading preferences" onClick={onPlatformSettings} />
          <Action icon={CircleHelp} title="Help & support" subtitle="Trading, platform and account assistance" onClick={onHelp} />
        </section>
      </div>
    </section>
  );
}
