import React, { useMemo } from 'react';
import { Activity, ShieldAlert, Target, TrendingDown } from 'lucide-react';
import { calculateAccountRiskSummary } from '../../utils/accountRisk.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function money(value, currency = 'USD') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(number);
  } catch {
    return `${number.toFixed(0)} ${currency}`;
  }
}

function Meter({ label, value, limit, tone = 'neutral' }) {
  const percent = limit > 0 ? clamp((value / limit) * 100, 0, 100) : 0;
  const barClass = tone === 'danger' ? 'bg-[#ff6370]' : tone === 'success' ? 'bg-[#39d7a1]' : 'bg-[#57c7ff]';
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-[7px] font-bold uppercase tracking-[0.07em] text-[#60758a]"><span>{label}</span><span>{percent.toFixed(0)}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#122431]"><div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

export const calculateRiskSummary = calculateAccountRiskSummary;

export default function PropRiskStrip({ account, plannedRisk = 0, compact = false }) {
  const risk = useMemo(() => calculateAccountRiskSummary(account, plannedRisk), [account, plannedRisk]);
  const hasChallengeRules = risk.dailyLossLimit > 0 || risk.maxLossLimit > 0 || risk.profitTarget > 0;
  const riskWarning = risk.dailyLossLimit > 0 && plannedRisk > 0 && (!risk.riskAvailabilityLive || plannedRisk >= risk.remainingDaily * 0.75);
  const currency = account?.currency || 'USD';
  const valuation = String(account?.valuationStatus || 'WAITING').toUpperCase();

  if (!hasChallengeRules) {
    if (compact) {
      return (
        <div className="flex h-9 items-center gap-3 border-y border-[#172938] bg-[#071019] px-3 text-[8px]">
          <span className="flex items-center gap-1 font-bold text-[#71869a]"><Activity size={11}/>Valuation <b className={valuation === 'LIVE' ? 'text-[#52dba8]' : valuation === 'STALE' ? 'text-[#e8c35f]' : 'text-[#a8b6c2]'}>{valuation}</b></span>
          <span className="text-[#71869a]">Free <b className="text-[#dce6ed]">{money(account?.freeMargin, currency)}</b></span>
          <span className="text-[#71869a]">Used <b className="text-[#dce6ed]">{money(account?.usedMargin, currency)}</b></span>
        </div>
      );
    }

    return (
      <section className="mt-2.5 rounded-[18px] border border-[#183044] bg-[#08131d] px-3 py-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.018)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-1.5"><Activity size={13} className="text-[#5fcaff]"/><b className="text-[10px] text-[#dce7ef]">Account Health</b></div><p className="mt-1 text-[8px] text-[#61768b]">Live trading valuation from ACG Trader</p></div>
          <div className="text-right"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#5d7286]">Valuation</span><b className={`mt-0.5 block text-[11px] ${valuation === 'LIVE' ? 'text-[#52dba8]' : valuation === 'STALE' ? 'text-[#e8c35f]' : 'text-[#a8b6c2]'}`}>{valuation}</b></div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2"><HealthStat label="Equity" value={money(account?.equity, currency)}/><HealthStat label="Free margin" value={money(account?.freeMargin, currency)}/><HealthStat label="Floating P&L" value={money(account?.floatingPnl, currency)}/></div>
        {plannedRisk > 0 && <div className="mt-2.5 rounded-xl border border-[#1b3445] bg-[#0a1822] px-2.5 py-2 text-[8px] font-semibold text-[#7f95a8]">Estimated ticket risk <b className="text-[#e6edf3]">{money(plannedRisk, currency)}</b>. Challenge limits are not present in the trading-account snapshot, so no synthetic limit comparison is shown.</div>}
      </section>
    );
  }

  if (compact) {
    return (
      <div className="flex h-9 items-center gap-3 border-y border-[#172938] bg-[#071019] px-3 text-[8px]">
        <span className="flex items-center gap-1 font-bold text-[#71869a]"><ShieldAlert size={11}/>Daily <b className={riskWarning ? 'text-[#ff727d]' : 'text-[#dce6ed]'}>{money(risk.remainingDaily, currency)}</b></span>
        <span className="text-[#71869a]">Max <b className="text-[#dce6ed]">{money(risk.remainingMax, currency)}</b></span>
        <span className="text-[#71869a]">Target <b className="text-[#52dba8]">{money(risk.profit, currency)} / {money(risk.profitTarget, currency)}</b></span>
        {plannedRisk > 0 && <span className={`ml-auto font-bold ${riskWarning ? 'text-[#ff727d]' : 'text-[#61caff]'}`}>After SL {money(risk.postTradeDaily, currency)}</span>}
      </div>
    );
  }

  return (
    <section className="mt-2.5 rounded-[18px] border border-[#183044] bg-[#08131d] px-3 py-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.018)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="flex items-center gap-1.5"><ShieldAlert size={13} className="text-[#5fcaff]"/><b className="text-[10px] text-[#dce7ef]">Challenge Risk</b></div><p className="mt-1 text-[8px] text-[#61768b]">{risk.riskAvailabilityLive ? 'Backend-aligned loss room and target progress' : 'New risk availability is paused until valuation and policy are authoritative'}</p></div>
        <div className="text-right"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#5d7286]">Available today</span><b className={`mt-0.5 block text-[13px] ${riskWarning ? 'text-[#ff707b]' : 'text-[#e7eef4]'}`}>{money(risk.remainingDaily, currency)}</b></div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-3">
        <Meter label="Daily loss" value={risk.dailyLossUsed} limit={risk.dailyLossLimit} tone={risk.dailyLossUsed / Math.max(1, risk.dailyLossLimit) > 0.7 ? 'danger' : 'neutral'} />
        <Meter label="Max loss" value={risk.maxLossUsed} limit={risk.maxLossLimit} tone={risk.maxLossUsed / Math.max(1, risk.maxLossLimit) > 0.7 ? 'danger' : 'neutral'} />
        <Meter label="Profit target" value={risk.profit} limit={risk.profitTarget} tone="success" />
      </div>

      {plannedRisk > 0 && (
        <div className={`mt-2.5 flex items-center justify-between rounded-xl border px-2.5 py-2 ${riskWarning ? 'border-[#5d2b34] bg-[#211218]' : 'border-[#1b3445] bg-[#0a1822]'}`}>
          <span className={`flex items-center gap-1.5 text-[8px] font-semibold ${riskWarning ? 'text-[#ff818b]' : 'text-[#7f95a8]'}`}><TrendingDown size={12}/>Risk at SL <b className="text-[#e6edf3]">{money(plannedRisk, currency)}</b></span>
          <span className="flex items-center gap-1 text-[8px] text-[#71869a]"><Target size={11}/>Remaining <b className={riskWarning ? 'text-[#ff818b]' : 'text-[#57d9aa]'}>{money(risk.postTradeDaily, currency)}</b></span>
        </div>
      )}
    </section>
  );
}

function HealthStat({ label, value }) {
  return <div className="rounded-xl border border-[#172d3e] bg-[#091722] px-2.5 py-2"><span className="block text-[7px] font-bold uppercase tracking-[0.08em] text-[#5d7287]">{label}</span><b className="mt-1 block truncate text-[9px] text-[#d6e0e8]">{value}</b></div>;
}
