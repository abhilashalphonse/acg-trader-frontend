import React from 'react';
import { ChevronRight, CircleHelp, Settings, ShieldCheck, X } from 'lucide-react';

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

function accountLabel(account) {
  const type = String(account?.accountType || account?.mode || '').toUpperCase();
  if (type === 'DEMO') return 'Trial account';
  if (type === 'FUNDED') return 'Master account';
  return 'Evaluation account';
}

function Action({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-white/[0.08] px-3 py-3.5 text-left last:border-b-0">
      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#718da3]"><Icon size={15}/></div>
      <div className="min-w-0 flex-1">
        <b className="block text-[10px] text-[#dce5ec]">{title}</b>
        <p className="mt-0.5 truncate text-[8px] text-[#61768b]">{subtitle}</p>
      </div>
      <ChevronRight size={14} className="text-[#4e6478]"/>
    </button>
  );
}

export default function MobileAccountSheet({
  account = {},
  onClose = () => {},
  onPlatformSettings = () => {},
  onHelp = () => {},
}) {
  const currency = account?.currency || 'USD';
  const status = String(account?.status || 'UNKNOWN').toUpperCase();
  const live = status === 'ACTIVE';

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 px-2 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section onMouseDown={event => event.stopPropagation()} className="mb-[max(8px,env(safe-area-inset-bottom))] w-full max-w-[444px] overflow-hidden rounded-t-[20px] border border-white/[0.09] bg-black shadow-[0_30px_90px_rgba(0,0,0,.7)]">
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.08] bg-[#080808] px-3 py-3">
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.12em] text-[#62778a]">ACG Trader</p>
            <h2 className="mt-1 text-[17px] font-black tracking-[-0.035em] text-[#f3f7fb]">Account</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#91a0ad]" aria-label="Close account"><X size={15}/></button>
        </header>

        <div className="px-3 py-3">
          <div className="border-b border-white/[0.08] pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#60758a]">{accountLabel(account)}</span>
                <strong className="mt-1.5 block text-[17px] font-black tracking-[-0.03em] text-[#eef4f8]">{account?.accountCode || 'Trading account'}</strong>
                <p className="mt-1 text-[8px] text-[#667b8e]">{currency}{account?.leverage ? ` · 1:${account.leverage}` : ''}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[7px] font-black ${live ? 'border-[#176247] bg-[#0c2d23] text-[#45dda9]' : 'border-white/[0.08] bg-[#101010] text-[#8999a8]'}`}>{status}</span>
            </div>

            <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.08] border-y border-white/[0.08] bg-[#080808] py-2.5">
              <div className="px-2"><span className="block text-[6px] font-bold uppercase tracking-[0.08em] text-[#5f7488]">Balance</span><b className="mt-1 block truncate font-mono text-[9px] text-[#dce5ec]">{money(account?.balance, currency)}</b></div>
              <div className="px-2"><span className="block text-[6px] font-bold uppercase tracking-[0.08em] text-[#5f7488]">Equity</span><b className="mt-1 block truncate font-mono text-[9px] text-[#dce5ec]">{money(account?.equity, currency)}</b></div>
              <div className="px-2"><span className="block text-[6px] font-bold uppercase tracking-[0.08em] text-[#5f7488]">Free margin</span><b className="mt-1 block truncate font-mono text-[9px] text-[#dce5ec]">{money(account?.freeMargin, currency)}</b></div>
            </div>
          </div>

          <div className="mt-3 overflow-hidden border-y border-white/[0.08] bg-[#080808]">
            <Action icon={ShieldCheck} title="Account" subtitle="Trading account and challenge status" onClick={() => {}} />
            <Action icon={Settings} title="Platform settings" subtitle="Terminal preferences and profiles" onClick={onPlatformSettings} />
            <Action icon={CircleHelp} title="Help & support" subtitle="Trading and account assistance" onClick={onHelp} />
          </div>
        </div>
      </section>
    </div>
  );
}
