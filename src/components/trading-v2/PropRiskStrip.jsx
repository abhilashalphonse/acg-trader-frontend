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
  const barClass = tone === 'danger' ? 'bg-[#ff6370]' : tone === 'success' ? 'bg-[#39d7a1]' : 'bg-[#101010]';
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-[7px] font-bold uppercase tracking-[0.07em] text-[#60758a]">
        <span>{label}</span>
        <span className="text-[#aab9c5]">{headline}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#101010]">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 text-[6px] font-semibold text-[#53697d]">
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
        <div className="flex h-9 items-center gap-3 border-y border-white/[0.08] bg-[#080808] px-3 text-[8px]">
          <span className="flex items-center gap-1 font-bold text-[#71869a]"><Activity size={11}/>Valuation <b className={valuation === 'LIVE' ? 'text-[#52dba8]' : valuation === 'STALE' ? 'text-[#e8c35f]' : 'text-[#a8b6c2]'}>{valuation}</b></span>
          <span className="text-[#71869a]">Free <b className="text-[#dce6ed]">{money(account?.freeMargin, currency)}</b></span>
          <span className="text-[#71869a]">Used <b className="text-[#dce6ed]">{money(account?.usedMargin, currency)}</b></span>
        </div>
      );
    }

    return (
      <section className="mt-2.5 border-y border-white/[0.08] bg-black px-1 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-1.5"><Activity size={13} className="text-[#5fcaff]"/><b className="text-[10px] text-[#dce7ef]">Account Health</b></div><p className="mt-1 text-[8px] text-[#61768b]">Live account valuation</p></div>
          <div className="text-right"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#5d7286]">Valuation</span><b className={`mt-0.5 block text-[11px] ${valuation === 'LIVE' ? 'text-[#52dba8]' : valuation === 'STALE' ? 'text-[#e8c35f]' : 'text-[#a8b6c2]'}`}>{valuation}</b></div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2"><HealthStat label="Equity" value={money(account?.equity, currency)}/><HealthStat label="Free margin" value={money(account?.freeMargin, currency)}/><HealthStat label="Floating P&L" value={money(account?.floatingPnl, currency)}/></div>
        {plannedRisk > 0 && <div className="mt-2.5 border-t border-white/[0.08] px-0 py-2 text-[8px] font-semibold text-[#7f95a8]">Estimated ticket risk <b className="text-[#e6edf3]">{money(plannedRisk, currency)}</b>. Challenge limits are not available for this account.</div>}
      </section>
    );
  }

  if (compact) {
    return (
      <div className="flex h-9 items-center gap-3 border-y border-white/[0.08] bg-[#080808] px-3 text-[8px]">
        <span className="flex items-center gap-1 font-bold text-[#71869a]"><ShieldAlert size={11}/>Daily <b className={riskWarning ? 'text-[#ff727d]' : 'text-[#dce6ed]'}>{money(risk.remainingDaily, currency)}</b></span>
        <span className="text-[#71869a]">Max <b className="text-[#dce6ed]">{money(risk.remainingMax, currency)}</b></span>
        <span className="text-[#71869a]">Target <b className="text-[#52dba8]">{money(risk.profit, currency)} / {money(risk.profitTarget, currency)}</b></span>
        {plannedRisk > 0 && <span className={`ml-auto font-bold ${riskWarning ? 'text-[#ff727d]' : 'text-[#61caff]'}`}>After SL {money(risk.postTradeDaily, currency)}</span>}
      </div>
    );
  }

  return (
    <section className="mt-2.5 border-y border-white/[0.08] bg-black px-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="flex items-center gap-1.5"><ShieldAlert size={13} className="text-[#5fcaff]"/><b className="text-[10px] text-[#dce7ef]">Challenge Risk</b></div><p className="mt-1 text-[8px] text-[#61768b]">{risk.riskAvailabilityLive ? 'Current loss room and target progress' : 'Risk availability is paused until account valuation is live'}</p></div>
        <div className="text-right"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#5d7286]">Available today</span><b className={`mt-0.5 block text-[13px] ${riskWarning ? 'text-[#ff707b]' : 'text-[#e7eef4]'}`}>{money(risk.remainingDaily, currency)}</b></div>
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
        <div className={`mt-2.5 flex items-center justify-between border-t px-0 py-2 ${riskWarning ? 'border-[#5d2b34] bg-[#101010]' : 'border-white/[0.08] bg-[#101010]'}`}>
          <span className={`flex items-center gap-1.5 text-[8px] font-semibold ${riskWarning ? 'text-[#ff818b]' : 'text-[#7f95a8]'}`}><TrendingDown size={12}/>Risk at SL <b className="text-[#e6edf3]">{money(plannedRisk, currency)}</b></span>
          <span className="flex items-center gap-1 text-[8px] text-[#71869a]"><Target size={11}/>Remaining <b className={riskWarning ? 'text-[#ff818b]' : 'text-[#57d9aa]'}>{money(risk.postTradeDaily, currency)}</b></span>
        </div>
      )}
    </section>
  );
}

function HealthStat({ label, value }) {
  return <div className="border-t border-white/[0.08] px-0 py-2"><span className="block text-[7px] font-bold uppercase tracking-[0.08em] text-[#5d7287]">{label}</span><b className="mt-1 block truncate text-[9px] text-[#d6e0e8]">{value}</b></div>;
}
