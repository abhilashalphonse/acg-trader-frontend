import React, { useMemo } from 'react';
import { ShieldAlert, Target, TrendingDown } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const money = value => `$${Math.max(0, Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

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

export function calculateRiskSummary(account, plannedRisk = 0) {
  const initialBalance = Number(account?.initialBalance) || 0;
  const equity = Number(account?.equity) || initialBalance;
  const dailyStartEquity = Number(account?.dailyStartEquity) || equity;
  const dailyLossLimit = Number(account?.dailyLossLimit) || 0;
  const maxLossLimit = Number(account?.maxLossLimit) || 0;
  const profitTarget = Number(account?.profitTarget) || 0;
  const dailyLossUsed = Math.max(0, dailyStartEquity - equity);
  const maxLossUsed = Math.max(0, initialBalance - equity);
  const profit = Math.max(0, equity - initialBalance);
  const remainingDaily = Math.max(0, dailyLossLimit - dailyLossUsed);
  const remainingMax = Math.max(0, maxLossLimit - maxLossUsed);
  const postTradeDaily = Math.max(0, remainingDaily - Math.max(0, Number(plannedRisk) || 0));
  return { initialBalance, equity, dailyLossLimit, maxLossLimit, profitTarget, dailyLossUsed, maxLossUsed, profit, remainingDaily, remainingMax, postTradeDaily };
}

export default function PropRiskStrip({ account, plannedRisk = 0, compact = false }) {
  const risk = useMemo(() => calculateRiskSummary(account, plannedRisk), [account, plannedRisk]);
  const riskWarning = plannedRisk > 0 && plannedRisk >= risk.remainingDaily * 0.75;

  if (compact) {
    return (
      <div className="flex h-9 items-center gap-3 border-y border-[#172938] bg-[#071019] px-3 text-[8px]">
        <span className="flex items-center gap-1 font-bold text-[#71869a]"><ShieldAlert size={11}/>Daily <b className={riskWarning ? 'text-[#ff727d]' : 'text-[#dce6ed]'}>{money(risk.remainingDaily)}</b></span>
        <span className="text-[#71869a]">Max <b className="text-[#dce6ed]">{money(risk.remainingMax)}</b></span>
        <span className="text-[#71869a]">Target <b className="text-[#52dba8]">{money(risk.profit)} / {money(risk.profitTarget)}</b></span>
        {plannedRisk > 0 && <span className={`ml-auto font-bold ${riskWarning ? 'text-[#ff727d]' : 'text-[#61caff]'}`}>After SL {money(risk.postTradeDaily)}</span>}
      </div>
    );
  }

  return (
    <section className="mt-2.5 rounded-[18px] border border-[#183044] bg-[#08131d] px-3 py-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.018)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="flex items-center gap-1.5"><ShieldAlert size={13} className="text-[#5fcaff]"/><b className="text-[10px] text-[#dce7ef]">Challenge Risk</b></div><p className="mt-1 text-[8px] text-[#61768b]">Pre-trade loss room and target progress</p></div>
        <div className="text-right"><span className="block text-[7px] uppercase tracking-[0.08em] text-[#5d7286]">Available today</span><b className={`mt-0.5 block text-[13px] ${riskWarning ? 'text-[#ff707b]' : 'text-[#e7eef4]'}`}>{money(risk.remainingDaily)}</b></div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-3">
        <Meter label="Daily loss" value={risk.dailyLossUsed} limit={risk.dailyLossLimit} tone={risk.dailyLossUsed / Math.max(1, risk.dailyLossLimit) > 0.7 ? 'danger' : 'neutral'} />
        <Meter label="Max loss" value={risk.maxLossUsed} limit={risk.maxLossLimit} tone={risk.maxLossUsed / Math.max(1, risk.maxLossLimit) > 0.7 ? 'danger' : 'neutral'} />
        <Meter label="Profit target" value={risk.profit} limit={risk.profitTarget} tone="success" />
      </div>

      {plannedRisk > 0 && (
        <div className={`mt-2.5 flex items-center justify-between rounded-xl border px-2.5 py-2 ${riskWarning ? 'border-[#5d2b34] bg-[#211218]' : 'border-[#1b3445] bg-[#0a1822]'}`}>
          <span className={`flex items-center gap-1.5 text-[8px] font-semibold ${riskWarning ? 'text-[#ff818b]' : 'text-[#7f95a8]'}`}><TrendingDown size={12}/>Risk at SL <b className="text-[#e6edf3]">{money(plannedRisk)}</b></span>
          <span className="flex items-center gap-1 text-[8px] text-[#71869a]"><Target size={11}/>Remaining <b className={riskWarning ? 'text-[#ff818b]' : 'text-[#57d9aa]'}>{money(risk.postTradeDaily)}</b></span>
        </div>
      )}
    </section>
  );
}
