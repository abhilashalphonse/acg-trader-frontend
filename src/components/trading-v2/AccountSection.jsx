import React from 'react';
import { Bell, ChevronRight, CircleHelp, Gauge, Settings, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';

function money(value) {
  const number = Number(value) || 0;
  return `$${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function progress(value, total) {
  if (!Number(total)) return 0;
  return Math.max(0, Math.min(100, (Number(value) / Number(total)) * 100));
}

export default function AccountSection({ account = {}, onOpenSheet = () => {} }) {
  const initial = Number(account.initialBalance) || 0;
  const equity = Number(account.equity) || Number(account.balance) || initial;
  const target = Number(account.profitTarget) || 0;
  const targetProfit = Math.max(0, equity - initial);
  const dailyLoss = Math.max(0, (Number(account.dailyStartEquity) || equity) - equity);
  const maxLoss = Math.max(0, initial - equity);

  return (
    <section className="min-h-[calc(100dvh-98px)] px-3 pb-6 pt-3">
      <header className="pb-4"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5f7488]">ACG Funded</p><h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">Account</h1><p className="mt-1 text-[10px] text-[#718397]">Challenge progress, limits and trading preferences.</p></header>

      <div className="rounded-[22px] border border-[#193044] bg-[linear-gradient(145deg,#0d1e2b,#08131d_65%)] p-4 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
        <div className="flex items-start justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#60768a]">Trading account</span><strong className="mt-1.5 block text-[22px] font-black tracking-[-0.04em] text-[#f0f5f8]">{money(initial)}</strong><p className="mt-1 text-[9px] text-[#71869a]">ACG Challenge</p></div><span className="rounded-full border border-[#176247] bg-[#0c2d23] px-2.5 py-1.5 text-[8px] font-black text-[#45dda9]">ACTIVE</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><Stat label="Balance" value={money(account.balance ?? initial)}/><Stat label="Equity" value={money(equity)}/></div>
      </div>

      <div className="mt-5 px-1"><h2 className="text-[11px] font-black text-[#e9f0f5]">Challenge progress</h2><p className="mt-1 text-[8px] text-[#60758a]">Live limits stay visible without cluttering the Chart.</p></div>
      <div className="mt-2 space-y-2">
        <ProgressCard icon={Gauge} label="Profit target" value={targetProfit} total={target} valueLabel={`${money(targetProfit)} / ${money(target)}`} tone="blue" />
        <ProgressCard icon={ShieldCheck} label="Daily loss" value={dailyLoss} total={account.dailyLossLimit} valueLabel={`${money(dailyLoss)} / ${money(account.dailyLossLimit)}`} tone="green" invert />
        <ProgressCard icon={ShieldCheck} label="Maximum loss" value={maxLoss} total={account.maxLossLimit} valueLabel={`${money(maxLoss)} / ${money(account.maxLossLimit)}`} tone="green" invert />
      </div>

      <div className="mt-5 px-1"><h2 className="text-[11px] font-black text-[#e9f0f5]">Account &amp; platform</h2></div>
      <div className="mt-2 overflow-hidden rounded-[18px] border border-[#172b3a] bg-[#08131c]">
        <Action icon={UserRound} label="Account details" subtitle="Profile and trading account" onClick={() => onOpenSheet('profile')} />
        <Action icon={SlidersHorizontal} label="Trading preferences" subtitle="Profiles, sizing and chart defaults" onClick={() => onOpenSheet('more')} />
        <Action icon={Bell} label="Notifications" subtitle="Price alerts and risk events" onClick={() => onOpenSheet('notifications')} />
        <Action icon={Settings} label="Platform settings" subtitle="Appearance and terminal preferences" onClick={() => onOpenSheet('more')} />
        <Action icon={CircleHelp} label="Help & support" subtitle="Trading and account assistance" onClick={() => onOpenSheet('profile')} last />
      </div>
    </section>
  );
}

function Stat({ label, value }) { return <div className="rounded-xl border border-[#172d3e] bg-[#091722] px-3 py-2.5"><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5d7287]">{label}</span><b className="mt-1 block text-[11px] text-[#d6e0e8]">{value}</b></div>; }

function ProgressCard({ icon: Icon, label, value, total, valueLabel, tone = 'blue', invert = false }) {
  const pct = progress(value, total);
  const safePct = invert ? Math.max(0, 100 - pct) : pct;
  const bar = tone === 'green' ? 'bg-[#40d9a4]' : 'bg-[#4fc5ff]';
  return <div className="rounded-[17px] border border-[#172b3a] bg-[#08131c] p-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-xl border border-[#1b3446] bg-[#0b1c28] text-[#69cfff]"><Icon size={14}/></div><div><b className="block text-[10px] text-[#dbe4eb]">{label}</b><span className="mt-0.5 block text-[8px] text-[#60758a]">{valueLabel}</span></div></div><strong className="text-[10px] text-[#aebdca]">{safePct.toFixed(0)}%</strong></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#122533]"><div className={`h-full rounded-full ${bar}`} style={{ width: `${invert ? pct : safePct}%` }} /></div></div>;
}

function Action({ icon: Icon, label, subtitle, onClick, last = false }) { return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${last ? '' : 'border-b border-[#142635]'}`}><div className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#183142] bg-[#0b1a25] text-[#718da3]"><Icon size={15}/></div><div className="min-w-0 flex-1"><b className="block text-[10px] text-[#dce5ec]">{label}</b><p className="mt-0.5 truncate text-[8px] text-[#61768b]">{subtitle}</p></div><ChevronRight size={14} className="text-[#4e6478]"/></button>; }
