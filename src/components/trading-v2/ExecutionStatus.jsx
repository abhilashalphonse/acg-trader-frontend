import React from 'react';
import { Check, CircleAlert, Loader2, Radio, X } from 'lucide-react';

const labels = {
  submitting: 'Submitting',
  accepted: 'Accepted',
  filled: 'Filled',
  pending: 'Order placed',
  rejected: 'Rejected',
  unknown: 'Confirming execution',
};

export default function ExecutionStatus({ event, onDismiss = () => {} }) {
  if (!event) return null;
  const status = event.status || 'submitting';
  const positive = ['accepted', 'filled', 'pending'].includes(status);
  const danger = status === 'rejected';
  const warning = status === 'unknown';
  const Icon = status === 'submitting' ? Loader2 : (danger || warning) ? CircleAlert : status === 'accepted' ? Radio : Check;
  const price = Number(event.fillPrice ?? event.requestedPrice);
  const priceLabel = Number.isFinite(price) ? price.toFixed(Math.abs(price) > 100 ? 2 : 5) : '—';

  return (
    <div className={`fixed left-1/2 top-[72px] z-[140] w-[calc(100%-24px)] max-w-[430px] -translate-x-1/2 overflow-hidden rounded-xl border shadow-[0_16px_50px_rgba(0,0,0,.48)] backdrop-blur-xl ${danger ? 'border-[#64313a] bg-[#28141a]/96' : warning ? 'border-[#665321] bg-[#2a220f]/96' : 'border-[#24445a] bg-[#0a1a26]/96'}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${danger ? 'bg-[#3a1720] text-[#ff7a85]' : warning ? 'bg-[#3a3015] text-[#f0d06b]' : positive ? 'bg-[#0d3026] text-[#4de0ab]' : 'bg-[#10283a] text-[#64caff]'}`}>
          <Icon size={14} className={status === 'submitting' ? 'animate-spin' : ''}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><b className={`text-[10px] ${danger ? 'text-[#ff8a93]' : warning ? 'text-[#f0d696]' : 'text-[#edf4f8]'}`}>{labels[status] || status}</b><span className={`rounded-md px-1.5 py-0.5 text-[7px] font-black ${String(event.side).toUpperCase() === 'BUY' ? 'bg-[#0b3529] text-[#42d9a5]' : 'bg-[#391820] text-[#ff737e]'}`}>{String(event.side || '').toUpperCase()}</span><span className="truncate text-[8px] font-semibold text-[#7790a4]">{event.symbol}</span></div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-[#72879a]"><span>{Number(event.lots || 0).toFixed(2)} lots</span><span>{status === 'filled' ? 'Fill' : 'Requested'} <b className="text-[#c9d5de]">{priceLabel}</b></span>{Number.isFinite(event.slippage) && <span>Slippage <b className={event.slippage > 0 ? 'text-[#ff9098]' : 'text-[#5adeae]'}>{event.slippage.toFixed(1)}p</b></span>}{Number.isFinite(event.latencyMs) && <span><b className="text-[#c9d5de]">{event.latencyMs}ms</b></span>}</div>
          {event.message && <p className={`mt-1 text-[8px] ${danger ? 'text-[#d99aa1]' : warning ? 'text-[#d4bf82]' : 'text-[#86a0b4]'}`}>{event.message}</p>}
        </div>
        <button type="button" onClick={onDismiss} className="grid size-7 shrink-0 place-items-center rounded-md text-[#70869a] hover:bg-white/[0.04] hover:text-white" aria-label="Dismiss execution status"><X size={13}/></button>
      </div>
      <div className="h-0.5 bg-[#122a39]"><div className={`h-full transition-all duration-300 ${danger ? 'bg-[#ff6672]' : 'bg-[#51c8ff]'}`} style={{ width: status === 'submitting' ? '28%' : status === 'accepted' ? '62%' : '100%' }} /></div>
    </div>
  );
}
