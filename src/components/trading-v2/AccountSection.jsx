import React, { useEffect, useRef, useState } from 'react';
import { Bell, Camera, Check, ChevronRight, CircleHelp, Gauge, ImageOff, Save, Settings, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { calculateAccountRiskSummary } from '../../utils/accountRisk.js';
import { useTraderProfile } from '../../hooks/useTraderProfile.js';
import { compressShareProfileImage } from '../../utils/profileImage.js';

function money(value, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  } catch {
    return `${number.toFixed(2)} ${currency}`;
  }
}

function progress(value, total) {
  if (!Number(total)) return 0;
  return Math.max(0, Math.min(100, (Number(value) / Number(total)) * 100));
}

function statusClass(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'ACTIVE') return 'border-[#176247] bg-[#0c2d23] text-[#45dda9]';
  if (value === 'PAUSED') return 'border-[#655126] bg-[#2a220f] text-[#e7c76b]';
  return 'border-[#63313b] bg-[#2a151a] text-[#ff8994]';
}

export default function AccountSection({ account = {}, onOpenSheet = () => {} }) {
  const currency = account.currency || 'USD';
  const fileInputRef = useRef(null);
  const { profile, loading: profileLoading, saving: profileSaving, error: profileError, save: saveProfile } = useTraderProfile();
  const [profileDraft, setProfileDraft] = useState({
    displayName: 'Trader',
    sharePhotoDataUrl: null,
    shareTemplate: 'PERFORMANCE',
  });
  const [profileNotice, setProfileNotice] = useState('');
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    setProfileDraft({
      displayName: profile.displayName || 'Trader',
      sharePhotoDataUrl: profile.sharePhotoDataUrl || null,
      shareTemplate: profile.shareTemplate === 'PHOTO' ? 'PHOTO' : 'PERFORMANCE',
    });
  }, [profile.displayName, profile.sharePhotoDataUrl, profile.shareTemplate]);

  const choosePhoto = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageBusy(true);
    setProfileNotice('');
    try {
      const sharePhotoDataUrl = await compressShareProfileImage(file);
      setProfileDraft(current => ({ ...current, sharePhotoDataUrl }));
    } catch (error) {
      setProfileNotice(error?.message || 'Unable to prepare this image.');
    } finally {
      setImageBusy(false);
    }
  };

  const commitShareProfile = async () => {
    const displayName = String(profileDraft.displayName || '').trim();
    if (!displayName) {
      setProfileNotice('Enter a display name.');
      return;
    }
    setProfileNotice('');
    try {
      await saveProfile({
        displayName,
        sharePhotoDataUrl: profileDraft.sharePhotoDataUrl || null,
        shareTemplate: profileDraft.shareTemplate === 'PHOTO' ? 'PHOTO' : 'PERFORMANCE',
      });
      setProfileNotice('Share profile saved.');
    } catch (error) {
      setProfileNotice(error?.message || 'Unable to save share profile.');
    }
  };
  const balance = Number(account.balance);
  const equity = Number(account.equity);
  const risk = calculateAccountRiskSummary(account);
  const target = risk.profitTarget;
  const dailyLossLimit = risk.dailyLossLimit;
  const maxLossLimit = risk.maxLossLimit;
  const hasChallengeRules = target > 0 || dailyLossLimit > 0 || maxLossLimit > 0;
  const targetProfit = risk.profit;
  const dailyLoss = risk.dailyLossUsed;
  const maxLoss = risk.maxLossUsed;
  const status = String(account.status || 'UNKNOWN').toUpperCase();
  const valuation = String(account.valuationStatus || 'WAITING').toUpperCase();

  return (
    <section className="min-h-[calc(100dvh-98px)] px-3 pb-6 pt-3">
      <header className="pb-4"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5f7488]">ACG Trader</p><h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">Account</h1><p className="mt-1 text-[10px] text-[#718397]">Balance, equity, margin and challenge risk.</p></header>

      <div className="border-y border-white/[0.08] bg-black py-3">
        <div className="flex items-start justify-between gap-3"><div><span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#60768a]">Trading account</span><strong className="mt-1.5 block text-[20px] font-black tracking-[-0.04em] text-[#f0f5f8]">{account.accountCode || '—'}</strong><p className="mt-1 text-[9px] text-[#71869a]">{currency}{account.leverage ? ` • 1:${account.leverage}` : ''}</p></div><span className={`rounded-full border px-2.5 py-1.5 text-[8px] font-black ${statusClass(status)}`}>{status}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><Stat label="Balance" value={money(balance, currency)}/><Stat label="Equity" value={money(equity, currency)}/><Stat label="Free margin" value={money(account.freeMargin, currency)}/><Stat label="Used margin" value={money(account.usedMargin, currency)}/></div>
        <div className="mt-2 flex items-center justify-between rounded-md border border-white/[0.08] bg-[#101010] px-3 py-2.5"><span className="text-[8px] font-bold uppercase tracking-[0.09em] text-[#5d7287]">Valuation</span><span className={`text-[9px] font-black ${valuation === 'LIVE' ? 'text-[#45dda9]' : valuation === 'STALE' ? 'text-[#e8c35f]' : 'text-[#90a2b4]'}`}>{valuation}</span></div>
      </div>

      <div className="mt-5 px-1"><h2 className="text-[11px] font-black text-[#e9f0f5]">Risk state</h2><p className="mt-1 text-[8px] text-[#60758a]">Current challenge limits and trading risk.</p></div>
      <div className="mt-2 space-y-2">
        {hasChallengeRules ? (
          <>
            {target > 0 && <ProgressCard icon={Gauge} label="Profit target" value={targetProfit} total={target} valueLabel={`${money(targetProfit, currency)} / ${money(target, currency)}`} tone="blue" />}
            {dailyLossLimit > 0 && <ProgressCard icon={ShieldCheck} label="Daily loss" value={dailyLoss} total={dailyLossLimit} valueLabel={`${money(dailyLoss, currency)} / ${money(dailyLossLimit, currency)}`} tone="green" invert />}
            {maxLossLimit > 0 && <ProgressCard icon={ShieldCheck} label="Maximum loss" value={maxLoss} total={maxLossLimit} valueLabel={`${money(maxLoss, currency)} / ${money(maxLossLimit, currency)}`} tone="green" invert />}
          </>
        ) : (
          <div className="rounded-[17px] border border-white/[0.08] bg-[#080808] p-3"><div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#69cfff]"><Gauge size={14}/></div><div><b className="block text-[10px] text-[#dbe4eb]">Challenge rules</b><span className="mt-0.5 block text-[8px] leading-relaxed text-[#60758a]">Challenge limits are not available for this account.</span></div></div></div>
        )}
        <div className="grid grid-cols-2 gap-2"><Stat label="Floating P&L" value={money(account.floatingPnl, currency)}/><Stat label="Realized today" value={money(account.realizedPnlToday, currency)}/></div>
      </div>

      <div className="mt-5 px-1"><h2 className="text-[11px] font-black text-[#e9f0f5]">Share profile</h2><p className="mt-1 text-[8px] text-[#60758a]">Used automatically when you share an open-position P&amp;L card.</p></div>
      <div className="mt-2 border-y border-white/[0.08] bg-black px-1 py-3">
        <div className="flex items-center gap-3">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-[#101010]">
            {profileDraft.sharePhotoDataUrl
              ? <img src={profileDraft.sharePhotoDataUrl} alt="" className="h-full w-full object-cover" />
              : <div className="grid h-full w-full place-items-center text-[#737373]"><UserRound size={25}/></div>}
          </div>
          <div className="min-w-0 flex-1">
            <label className="block text-[8px] font-bold uppercase tracking-[0.1em] text-[#737373]">Display name</label>
            <input
              value={profileDraft.displayName}
              onChange={event => setProfileDraft(current => ({ ...current, displayName: event.target.value.slice(0, 64) }))}
              maxLength={64}
              placeholder="Trader"
              className="mt-1.5 h-9 w-full rounded-md border border-white/[0.08] bg-[#101010] px-3 text-[10px] font-semibold text-[#f5f5f5] outline-none focus:border-white/[0.18]"
            />
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choosePhoto} />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={imageBusy} onClick={() => fileInputRef.current?.click()} className="flex h-9 items-center justify-center gap-2 rounded-md border border-white/[0.09] bg-black text-[9px] font-bold text-[#d4d4d4] disabled:opacity-40"><Camera size={13}/>{imageBusy ? 'Preparing…' : profileDraft.sharePhotoDataUrl ? 'Change photo' : 'Add photo'}</button>
          <button type="button" disabled={!profileDraft.sharePhotoDataUrl} onClick={() => setProfileDraft(current => ({ ...current, sharePhotoDataUrl: null, shareTemplate: 'PERFORMANCE' }))} className="flex h-9 items-center justify-center gap-2 rounded-md border border-white/[0.09] bg-black text-[9px] font-bold text-[#a3a3a3] disabled:opacity-35"><ImageOff size={13}/>Remove</button>
        </div>

        <div className="mt-4">
          <span className="block text-[8px] font-bold uppercase tracking-[0.1em] text-[#737373]">Share-card template</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setProfileDraft(current => ({ ...current, shareTemplate: 'PERFORMANCE' }))} className={`h-11 rounded-md border text-[9px] font-bold ${profileDraft.shareTemplate === 'PERFORMANCE' ? 'border-[#53c7ff] text-[#53c7ff]' : 'border-white/[0.08] text-[#a3a3a3]'}`}>Performance</button>
            <button type="button" disabled={!profileDraft.sharePhotoDataUrl} onClick={() => setProfileDraft(current => ({ ...current, shareTemplate: 'PHOTO' }))} className={`h-11 rounded-md border text-[9px] font-bold disabled:opacity-35 ${profileDraft.shareTemplate === 'PHOTO' ? 'border-[#53c7ff] text-[#53c7ff]' : 'border-white/[0.08] text-[#a3a3a3]'}`}>Photo</button>
          </div>
          <p className="mt-2 text-[8px] leading-relaxed text-[#737373]">{profileDraft.shareTemplate === 'PHOTO' && profileDraft.sharePhotoDataUrl ? 'Your photo becomes the card background and avatar.' : 'Black ACG performance card with your photo used as the avatar.'}</p>
        </div>

        {(profileNotice || profileError) && <div className="mt-3 border-t border-white/[0.07] pt-2 text-[9px] text-[#a3a3a3]">{profileNotice || profileError?.message}</div>}

        <button type="button" disabled={profileLoading || profileSaving || imageBusy} onClick={commitShareProfile} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/[0.12] bg-[#101010] text-[10px] font-black text-[#f5f5f5] disabled:opacity-40">
          {profileSaving ? <><Check size={13}/>Saving…</> : <><Save size={13}/>Save share profile</>}
        </button>
      </div>

      <div className="mt-5 px-1"><h2 className="text-[11px] font-black text-[#e9f0f5]">Account &amp; platform</h2></div>
      <div className="mt-2 overflow-hidden border-y border-white/[0.08] bg-[#080808]">
        <Action icon={UserRound} label="Account details" subtitle="Profile and trading account" onClick={() => onOpenSheet('profile')} />
        <Action icon={SlidersHorizontal} label="Trading preferences" subtitle="Profiles, sizing and chart defaults" onClick={() => onOpenSheet('more')} />
        <Action icon={Bell} label="Notifications" subtitle="Price alerts and risk events" onClick={() => onOpenSheet('notifications')} />
        <Action icon={Settings} label="Platform settings" subtitle="Appearance and terminal preferences" onClick={() => onOpenSheet('more')} />
        <Action icon={CircleHelp} label="Help & support" subtitle="Trading and account assistance" onClick={() => onOpenSheet('help')} last />
      </div>
    </section>
  );
}

function Stat({ label, value }) { return <div className="rounded-md border border-white/[0.08] bg-[#101010] px-3 py-2.5"><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5d7287]">{label}</span><b className="mt-1 block text-[11px] text-[#d6e0e8]">{value}</b></div>; }

function ProgressCard({ icon: Icon, label, value, total, valueLabel, tone = 'blue', invert = false }) {
  const pct = progress(value, total);
  const safePct = invert ? Math.max(0, 100 - pct) : pct;
  const bar = tone === 'green' ? 'bg-[#40d9a4]' : 'bg-[#101010]';
  return <div className="rounded-[17px] border border-white/[0.08] bg-[#080808] p-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#69cfff]"><Icon size={14}/></div><div><b className="block text-[10px] text-[#dbe4eb]">{label}</b><span className="mt-0.5 block text-[8px] text-[#60758a]">{valueLabel}</span></div></div><strong className="text-[10px] text-[#aebdca]">{safePct.toFixed(0)}%</strong></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#101010]"><div className={`h-full rounded-full ${bar}`} style={{ width: `${invert ? pct : safePct}%` }} /></div></div>;
}

function Action({ icon: Icon, label, subtitle, onClick, last = false }) { return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${last ? '' : 'border-b border-white/[0.08]'}`}><div className="grid size-9 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-[#101010] text-[#718da3]"><Icon size={15}/></div><div className="min-w-0 flex-1"><b className="block text-[10px] text-[#dce5ec]">{label}</b><p className="mt-0.5 truncate text-[8px] text-[#61768b]">{subtitle}</p></div><ChevronRight size={14} className="text-[#4e6478]"/></button>; }
