import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { formatInstrumentPrice, instrumentPipSize } from '../../../utils/instrumentFormatting.js';
import { estimatePositionPnlAtPrice, estimateRequiredMargin, positionDistancePips } from '../../../utils/tradingRisk.js';

function money(value, currency = 'USD', signed = false) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(numeric));
    return signed ? `${numeric >= 0 ? '+' : '-'}${formatted}` : formatted;
  } catch {
    const raw = `${Math.abs(numeric).toFixed(2)} ${currency || ''}`.trim();
    return signed ? `${numeric >= 0 ? '+' : '-'}${raw}` : raw;
  }
}

function validPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function Metric({ label, value, tone = 'default' }) {
  const toneClass = tone === 'success'
    ? 'text-[#42D7A1]'
    : tone === 'danger'
      ? 'text-[#FF6F7A]'
      : tone === 'accent'
        ? 'text-[#59C7FF]'
        : 'text-[#E6EDF3]';
  return (
    <div className="min-w-0">
      <span className="block text-[7px] font-semibold uppercase tracking-[0.07em] text-[#6F8191]">{label}</span>
      <strong className={`mt-0.5 block truncate font-mono text-[9px] font-bold tabular-nums ${toneClass}`}>{value}</strong>
    </div>
  );
}

export default function DesktopPositionManager({
  position,
  instrument,
  account = {},
  editRequest = null,
  onClose = () => {},
  onBreakEven = () => {},
  onUpdate = () => {},
  onSetTrailing = () => {},
  onDismiss = () => {},
}) {
  const [editing, setEditing] = useState(null);
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [trailOpen, setTrailOpen] = useState(false);
  const [reduceOpen, setReduceOpen] = useState(false);

  const currency = position?.pnlCurrency || account?.currency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
  const entry = Number(position?.entry ?? position?.entryPrice);
  const current = Number(position?.closePrice ?? position?.currentPrice ?? (String(position?.side).toUpperCase() === 'BUY' ? instrument?.bid : instrument?.ask));
  const volume = Number(position?.volume ?? position?.lots);
  const pnl = Number(position?.pnl);
  const isBuy = String(position?.side || '').toUpperCase() === 'BUY';
  const sl = validPrice(position?.sl);
  const tp = validPrice(position?.tp);
  const pip = instrumentPipSize(instrument);

  useEffect(() => {
    setSlInput(sl == null ? '' : formatInstrumentPrice(sl, instrument, ''));
    setTpInput(tp == null ? '' : formatInstrumentPrice(tp, instrument, ''));
    setEditing(null);
    setTrailOpen(false);
    setReduceOpen(false);
  }, [position?.id, position?.sl, position?.tp, instrument]);

  useEffect(() => {
    if (String(editRequest?.positionId || '') !== String(position?.id || '')) return;
    if (editRequest?.field === 'sl' || editRequest?.field === 'tp') setEditing(editRequest.field);
  }, [editRequest?.field, editRequest?.nonce, editRequest?.positionId, position?.id]);

  const currentReturn = Number.isFinite(entry) && entry > 0 && Number.isFinite(current)
    ? ((String(position?.side).toUpperCase() === 'SELL' ? entry - current : current - entry) / entry) * 100
    : null;

  const margin = useMemo(
    () => estimateRequiredMargin(Number.isFinite(entry) ? entry : current, volume, instrument, account),
    [account, current, entry, instrument, volume],
  );

  const slPnl = sl == null ? null : estimatePositionPnlAtPrice(position, sl, instrument);
  const tpPnl = tp == null ? null : estimatePositionPnlAtPrice(position, tp, instrument);
  const slDistance = sl == null ? null : positionDistancePips(position, sl, instrument);
  const tpDistance = tp == null ? null : positionDistancePips(position, tp, instrument);
  const freeMargin = Number(account?.freeMargin);
  const marginLevel = Number.isFinite(Number(account?.marginLevel))
    ? Number(account.marginLevel)
    : Number(account?.margin) > 0 && Number.isFinite(Number(account?.equity))
      ? (Number(account.equity) / Number(account.margin)) * 100
      : null;
  const canBreakEven = Number.isFinite(entry) && Number.isFinite(current)
    && (isBuy ? current > entry : current < entry);
  const rr = Number.isFinite(slPnl) && slPnl < 0 && Number.isFinite(tpPnl) && tpPnl > 0
    ? Math.abs(tpPnl / slPnl)
    : null;

  const commitProtection = async field => {
    const raw = field === 'sl' ? slInput : tpInput;
    const cleaned = String(raw || '').replace(',', '.').replace(/[^0-9.]/g, '');
    const value = cleaned === '' ? null : Number(cleaned);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) return;
    setBusy(true);
    try {
      await onUpdate(position.id, { [field]: value });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const nudge = (field, direction) => {
    const step = Number(instrument?.tickSize) > 0 ? Number(instrument.tickSize) : Number(pip) || 0.01;
    const currentValue = Number(field === 'sl' ? slInput : tpInput);
    const fallback = Number(field === 'sl' ? sl : tp) || entry;
    const next = Math.max(step, (Number.isFinite(currentValue) ? currentValue : fallback) + direction * step);
    const formatted = formatInstrumentPrice(next, instrument, String(next));
    if (field === 'sl') setSlInput(formatted);
    else setTpInput(formatted);
  };

  const runClose = async percent => {
    setBusy(true);
    try {
      await onClose(position.id, percent);
    } finally {
      setBusy(false);
    }
  };

  if (!position) return null;
  const positive = Number.isFinite(pnl) && pnl >= 0;

  const protectionRow = (field, label, value, input, setInput, projectedPnl, distance) => {
    const isEditing = editing === field;
    const enabled = value != null;
    const tone = field === 'sl' ? 'text-[#FF6F7A]' : 'text-[#42D7A1]';
    const borderTone = enabled ? (field === 'sl' ? 'border-[#5e2932]' : 'border-[#245b48]') : 'border-white/[0.06]';
    return (
      <div className={`rounded-md border ${borderTone} bg-black/45 px-2 py-1.5`}>
        <div className="flex min-h-7 items-center justify-between gap-2">
          <button type="button" onClick={() => setEditing(isEditing ? null : field)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className={`size-1.5 rounded-full ${enabled ? (field === 'sl' ? 'bg-[#FF6F7A]' : 'bg-[#42D7A1]') : 'bg-[#34414d]'}`} />
            <span className="text-[8px] font-bold text-[#DCE6EE]">{label}</span>
            {enabled && <strong className={`truncate font-mono text-[8px] ${tone}`}>{formatInstrumentPrice(value, instrument)}</strong>}
          </button>
          {enabled ? (
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[7px] ${Number.isFinite(projectedPnl) ? tone : 'text-[#6F8191]'}`}>
                {Number.isFinite(projectedPnl) ? money(projectedPnl, currency, true) : '—'}
                {Number.isFinite(distance) ? ` · ${distance.toFixed(1)}p` : ''}
              </span>
              <button type="button" onClick={() => setEditing(isEditing ? null : field)} className="text-[7px] font-bold text-[#8295A7] hover:text-white">{isEditing ? 'Done' : 'Edit'}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(field)} className="text-[7px] font-black text-[#8295A7] hover:text-white">+ Add</button>
          )}
        </div>
        {isEditing && (
          <div className="mt-1.5 grid grid-cols-[26px_minmax(0,1fr)_26px_auto] items-center gap-1 border-t border-white/[0.05] pt-1.5">
            <button type="button" onClick={() => nudge(field, -1)} className="grid size-7 place-items-center rounded border border-white/[0.06] text-[#6F8191]"><Minus size={10}/></button>
            <input
              value={input}
              onFocus={event => event.currentTarget.select()}
              onChange={event => setInput(event.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder={enabled ? 'Price' : `Add ${label.toLowerCase()} price`}
              className="h-7 min-w-0 rounded border border-white/[0.06] bg-[#07090B] px-2 font-mono text-[9px] font-bold text-[#E6EDF3] outline-none focus:border-[#315b72]"
            />
            <button type="button" onClick={() => nudge(field, 1)} className="grid size-7 place-items-center rounded border border-white/[0.06] text-[#6F8191]"><Plus size={10}/></button>
            <button type="button" disabled={busy} onClick={() => commitProtection(field)} className="flex h-7 items-center gap-1 rounded border border-[#23664f] px-2 text-[7px] font-black text-[#42D7A1] disabled:opacity-40"><Check size={9}/>Apply</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="border-t border-white/[0.08] bg-[#07090B]">
      <div className="flex h-9 items-center justify-between border-b border-white/[0.06] px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <strong className="text-[8px] font-black uppercase tracking-[0.08em] text-[#A1AFBC]">Open position</strong>
          <span className={`rounded px-1.5 py-0.5 text-[7px] font-black ${isBuy ? 'bg-[#0c3b2e] text-[#42D7A1]' : 'bg-[#3b1820] text-[#FF6F7A]'}`}>{isBuy ? 'LONG' : 'SHORT'}</span>
          <span className="truncate text-[8px] font-semibold text-[#E6EDF3]">{instrument?.displaySymbol || position.symbol}</span>
        </div>
        <button type="button" onClick={onDismiss} className="grid size-6 place-items-center rounded text-[#6F8191] hover:bg-white/[0.04] hover:text-white" aria-label="Close position manager"><X size={10}/></button>
      </div>

      <div className="space-y-2 px-2.5 py-2.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="block text-[7px] uppercase tracking-[0.07em] text-[#6F8191]">Position size</span>
            <strong className="font-mono text-[12px] font-black text-[#E6EDF3]">{Number.isFinite(volume) ? volume.toFixed(2) : '—'} lots</strong>
          </div>
          <div className="text-right">
            <span className="block text-[7px] uppercase tracking-[0.07em] text-[#6F8191]">Floating P&amp;L</span>
            <strong className={`mt-0.5 block font-mono text-[14px] font-black ${positive ? 'text-[#42D7A1]' : 'text-[#FF6F7A]'}`}>{money(pnl, currency, true)}</strong>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md border border-white/[0.06] bg-black/35 px-2 py-2">
          <Metric label="Entry" value={formatInstrumentPrice(entry, instrument)} />
          <Metric label="Current" value={formatInstrumentPrice(current, instrument)} />
          <Metric label="Return" value={Number.isFinite(currentReturn) ? `${currentReturn >= 0 ? '+' : ''}${currentReturn.toFixed(2)}%` : '—'} tone={Number.isFinite(currentReturn) && currentReturn >= 0 ? 'success' : Number.isFinite(currentReturn) ? 'danger' : 'default'} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <strong className="text-[7px] font-black uppercase tracking-[0.08em] text-[#6F8191]">Protection</strong>
            {(sl != null || tp != null) && <span className="text-[7px] text-[#53677A]">Manage live protection</span>}
          </div>
          <div className="space-y-1">
          {protectionRow('sl', 'Stop Loss', sl, slInput, setSlInput, slPnl, slDistance)}
          {protectionRow('tp', 'Take Profit', tp, tpInput, setTpInput, tpPnl, tpDistance)}
          </div>
          {Number.isFinite(rr) && (
            <div className="mt-1.5 flex items-center justify-between rounded border border-white/[0.05] bg-black/30 px-2 py-1.5">
              <span className="text-[7px] font-semibold text-[#6F8191]">Protected R:R</span>
              <strong className="font-mono text-[8px] text-[#59C7FF]">1:{rr.toFixed(2)}</strong>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            disabled={busy || !canBreakEven}
            title={!canBreakEven ? 'Break-even becomes available once price moves beyond entry in your favor.' : 'Move stop loss to entry price'}
            onClick={() => onBreakEven(position.id)}
            className="h-8 rounded border border-[#245b48] text-[7px] font-black text-[#42D7A1] disabled:cursor-not-allowed disabled:border-white/[0.05] disabled:text-[#455562] disabled:opacity-60"
          >
            BREAK EVEN
          </button>
          <div className="relative">
            <button type="button" disabled={busy} onClick={() => { setTrailOpen(value => !value); setReduceOpen(false); }} className={`flex h-8 w-full items-center justify-center gap-1 rounded border text-[7px] font-black disabled:opacity-40 ${position.trailingEnabled ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] text-[#8295A7]'}`}>{position.trailingEnabled ? `TRAIL ${position.trailingPips || 5}p` : 'TRAIL'}<ChevronDown size={9}/></button>
            {trailOpen && (
              <div className="absolute left-0 right-0 top-9 z-40 rounded-md border border-white/[0.10] bg-[#090B0D] p-1 shadow-xl">
                {[5,10,20].map(pips => <button key={pips} type="button" onClick={() => { onSetTrailing(position.id, true, pips); setTrailOpen(false); }} className="block h-7 w-full rounded px-2 text-left text-[7px] font-semibold text-[#A1AFBC] hover:bg-white/[0.04] hover:text-white">{pips} pips</button>)}
                {position.trailingEnabled && <button type="button" onClick={() => { onSetTrailing(position.id, false, Number(position.trailingPips || 5)); setTrailOpen(false); }} className="block h-7 w-full rounded px-2 text-left text-[7px] font-semibold text-[#FF6F7A] hover:bg-white/[0.04]">Disable</button>}
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" disabled={busy} onClick={() => { setReduceOpen(value => !value); setTrailOpen(false); }} className="flex h-8 w-full items-center justify-center gap-1 rounded border border-white/[0.06] text-[7px] font-black text-[#A1AFBC] disabled:opacity-40">REDUCE<ChevronDown size={9}/></button>
            {reduceOpen && (
              <div className="absolute left-0 right-0 top-9 z-40 rounded-md border border-white/[0.10] bg-[#090B0D] p-1 shadow-xl">
                {[25,50,75].map(percent => <button key={percent} type="button" onClick={() => { setReduceOpen(false); runClose(percent); }} className="block h-7 w-full rounded px-2 text-left text-[7px] font-semibold text-[#A1AFBC] hover:bg-white/[0.04] hover:text-white">Close {percent}%</button>)}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-white/[0.06] bg-black/35 px-2 py-2">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Margin" value={money(margin, account?.currency || currency)} />
            <Metric label="Free margin" value={money(freeMargin, account?.currency || currency)} />
            <Metric label="Margin level" value={Number.isFinite(marginLevel) ? `${marginLevel.toFixed(1)}%` : '—'} />
          </div>
          {(sl != null || tp != null) && (
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[0.05] pt-2">
              <Metric label="SL P&L" value={Number.isFinite(slPnl) ? money(slPnl, currency, true) : '—'} tone={Number.isFinite(slPnl) && slPnl < 0 ? 'danger' : 'default'} />
              <Metric label="TP P&L" value={Number.isFinite(tpPnl) ? money(tpPnl, currency, true) : '—'} tone={Number.isFinite(tpPnl) && tpPnl >= 0 ? 'success' : 'default'} />
            </div>
          )}
        </div>

        <button type="button" disabled={busy} onClick={() => runClose(100)} className="h-9 w-full rounded-md border border-[#642c35] bg-[#16090d] text-[8px] font-black uppercase tracking-[0.06em] text-[#FF6F7A] disabled:opacity-40">Close position</button>
      </div>
    </section>
  );
}
