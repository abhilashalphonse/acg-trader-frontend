import React, { useMemo } from 'react';
import { Activity, ShieldAlert, Target, TrendingDown } from 'lucide-react';
import { calculateAccountRiskSummary } from '../../utils/accountRisk.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function money(value, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(number);
  } catch {
    return `${number.toFixed(0)} ${currency}`;
  }
}

function Meter({ label, value, limit, headline, tone = 'neutral', currency = 'USD' }) {
  const percent = limit > 0 ? clamp((value / limit) * 100, 0, 100) : 0;
  const barClass = tone === 'danger' ? 'bg-[#ff6370]' : tone === 'success' ? 'bg-[#39d7a1]' : 'bg-[#0C1013]';
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-[8px] font-semibold uppercase tracking-[0.07em] text-[#6F8191]">
        <span>{label}</span>
        <span className="text-[#A1AFBC]">{headline}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#0C1013]">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 text-[8px] font-medium text-[#6F8191]">
        <span className="truncate">{money(value, currency)} / {money(limit, currency)}</span>
        <span className="shrink-0">{percent.toFixed(0)}% used</span>
      </div>
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
        <div className="flex h-10 items-center gap-4 border-y border-white/[0.06] bg-[#07090B] px-3 text-[9px]">
          <span className="flex items-center gap-1 font-bold text-[#6F8191]"><Activity size={11}/>Valuation <b className={valuation === 'LIVE' ? 'text-[#42D7A1]' : valuation === 'STALE' ? 'text-[#E7BD58]' : 'text-[#A1AFBC]'}>{valuation}</b></span>
          <span className="text-[#6F8191]">Free <b className="text-[#E6EDF3]">{money(account?.freeMargin, currency)}</b></span>
          <span className="text-[#6F8191]">Used <b className="text-[#E6EDF3]">{money(account?.usedMargin, currency)}</b></span>
        </div>
      );
    }

    return (
      <section className="mt-2.5 border-y border-white/[0.06] bg-black px-1 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-1.5"><Activity size={13} className="text-[#59C7FF]"/><b className="text-[12px] font-semibold text-[#E6EDF3]">Account Health</b></div><p className="mt-1 text-[9px] text-[#6F8191]">Live account valuation</p></div>
          <div className="text-right"><span className="block text-[8px] uppercase tracking-[0.08em] text-[#6F8191]">Valuation</span><b className={`mt-0.5 block text-[11px] ${valuation === 'LIVE' ? 'text-[#42D7A1]' : valuation === 'STALE' ? 'text-[#E7BD58]' : 'text-[#A1AFBC]'}`}>{valuation}</b></div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2"><HealthStat label="Equity" value={money(account?.equity, currency)}/><HealthStat label="Free margin" value={money(account?.freeMargin, currency)}/><HealthStat label="Floating P&L" value={money(account?.floatingPnl, currency)}/></div>
        {plannedRisk > 0 && <div className="mt-2.5 border-t border-white/[0.06] px-0 py-2 text-[8px] font-semibold text-[#A1AFBC]">Estimated ticket risk <b className="text-[#e6edf3]">{money(plannedRisk, currency)}</b>. Challenge limits are not available for this account.</div>}
      </section>
    );
  }

  if (compact) {
    return (
      <div className="flex h-9 items-center gap-3 border-y border-white/[0.06] bg-[#07090B] px-3 text-[8px]">
        <span className="flex items-center gap-1 font-bold text-[#6F8191]"><ShieldAlert size={11}/>Daily <b className={riskWarning ? 'text-[#FF6F7A]' : 'text-[#E6EDF3]'}>{money(risk.remainingDaily, currency)}</b></span>
        <span className="text-[#6F8191]">Max <b className="text-[#E6EDF3]">{money(risk.remainingMax, currency)}</b></span>
        <span className="text-[#6F8191]">Target <b className="text-[#42D7A1]">{money(risk.profit, currency)} / {money(risk.profitTarget, currency)}</b></span>
        {plannedRisk > 0 && <span className={`ml-auto font-bold ${riskWarning ? 'text-[#FF6F7A]' : 'text-[#59C7FF]'}`}>After SL {money(risk.postTradeDaily, currency)}</span>}
      </div>
    );
  }

  return (
    <section className="mt-2.5 border-y border-white/[0.06] bg-black px-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="flex items-center gap-1.5"><ShieldAlert size={13} className="text-[#59C7FF]"/><b className="text-[10px] text-[#E6EDF3]">Challenge Risk</b></div><p className="mt-1 text-[8px] text-[#6F8191]">{risk.riskAvailabilityLive ? 'Current loss room and target progress' : 'Risk availability is paused until account valuation is live'}</p></div>
        <div className="text-right"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#6F8191]">Available today</span><b className={`mt-0.5 block text-[14px] ${riskWarning ? 'text-[#FF6F7A]' : 'text-[#e7eef4]'}`}>{money(risk.remainingDaily, currency)}</b></div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-3">
        <Meter
          label="Daily loss"
          value={risk.dailyLossUsed}
          limit={risk.dailyLossLimit}
          headline={`${risk.dailyLossPercent.toFixed(2)}%`}
          tone={risk.dailyLimitUsedPercent > 70 ? 'danger' : 'neutral'}
          currency={currency}
        />
        <Meter
          label="Max loss"
          value={risk.maxLossUsed}
          limit={risk.maxLossLimit}
          headline={`${risk.maxLossPercent.toFixed(2)}%`}
          tone={risk.maxLimitUsedPercent > 70 ? 'danger' : 'neutral'}
          currency={currency}
        />
        <Meter
          label="Profit target"
          value={risk.profit}
          limit={risk.profitTarget}
          headline={`${risk.profitProgressPercent.toFixed(0)}%`}
          tone="success"
          currency={currency}
        />
      </div>

      {plannedRisk > 0 && (
        <div className={`mt-2.5 flex items-center justify-between border-t px-0 py-2 ${riskWarning ? 'border-[#5d2b34] bg-[#0C1013]' : 'border-white/[0.06] bg-[#0C1013]'}`}>
          <span className={`flex items-center gap-1.5 text-[8px] font-semibold ${riskWarning ? 'text-[#FF6F7A]' : 'text-[#A1AFBC]'}`}><TrendingDown size={12}/>Risk at SL <b className="text-[#e6edf3]">{money(plannedRisk, currency)}</b></span>
          <span className="flex items-center gap-1 text-[8px] text-[#6F8191]"><Target size={11}/>Remaining <b className={riskWarning ? 'text-[#FF6F7A]' : 'text-[#42D7A1]'}>{money(risk.postTradeDaily, currency)}</b></span>
        </div>
      )}
    </section>
  );
}

function HealthStat({ label, value }) {
  return <div className="border-t border-white/[0.06] px-0 py-2"><span className="block text-[7px] font-bold uppercase tracking-[0.08em] text-[#6F8191]">{label}</span><b className="mt-1 block truncate text-[9px] text-[#E6EDF3]">{value}</b></div>;
}
