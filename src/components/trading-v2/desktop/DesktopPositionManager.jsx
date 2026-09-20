import React, { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, ShieldCheck, X } from 'lucide-react';
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

  const currency = position?.pnlCurrency || account?.currency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
  const entry = Number(position?.entry ?? position?.entryPrice);
  const current = Number(position?.closePrice ?? position?.currentPrice ?? (String(position?.side).toUpperCase() === 'BUY' ? instrument?.bid : instrument?.ask));
  const volume = Number(position?.volume ?? position?.lots);
  const pnl = Number(position?.pnl);
  const sl = validPrice(position?.sl);
  const tp = validPrice(position?.tp);
  const pip = instrumentPipSize(instrument);

  useEffect(() => {
    setSlInput(sl == null ? '' : formatInstrumentPrice(sl, instrument, ''));
    setTpInput(tp == null ? '' : formatInstrumentPrice(tp, instrument, ''));
    setEditing(null);
  }, [position?.id, position?.sl, position?.tp, instrument]);

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
  const isBuy = String(position.side || '').toUpperCase() === 'BUY';
  const positive = Number.isFinite(pnl) && pnl >= 0;

  const protectionRow = (field, label, value, input, setInput, projectedPnl, distance) => {
    const isEditing = editing === field;
    return (
      <div className="rounded-md border border-white/[0.06] bg-black/45 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setEditing(isEditing ? null : field)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className={`size-1.5 rounded-full ${field === 'sl' ? 'bg-[#FF6F7A]' : 'bg-[#42D7A1]'}`} />
            <span className="text-[8px] font-bold text-[#DCE6EE]">{label}</span>
            <strong className={`truncate font-mono text-[8px] ${field === 'sl' ? 'text-[#FF6F7A]' : 'text-[#42D7A1]'}`}>{value == null ? 'Not set' : formatInstrumentPrice(value, instrument)}</strong>
          </button>
          <span className="font-mono text-[7px] text-[#6F8191]">
            {Number.isFinite(projectedPnl) ? money(projectedPnl, currency, true) : '—'}
            {Number.isFinite(distance) ? ` · ${distance.toFixed(1)}p` : ''}
          </span>
        </div>
        {isEditing && (
          <div className="mt-1.5 grid grid-cols-[26px_minmax(0,1fr)_26px_auto] items-center gap-1 border-t border-white/[0.05] pt-1.5">
            <button type="button" onClick={() => nudge(field, -1)} className="grid size-7 place-items-center rounded border border-white/[0.06] text-[#6F8191]"><Minus size={10}/></button>
            <input
              value={input}
              onFocus={event => event.currentTarget.select()}
              onChange={event => setInput(event.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="Price"
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
          <strong className={`font-mono text-[14px] font-black ${positive ? 'text-[#42D7A1]' : 'text-[#FF6F7A]'}`}>{money(pnl, currency, true)}</strong>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md border border-white/[0.06] bg-black/35 px-2 py-2">
          <Metric label="Entry" value={formatInstrumentPrice(entry, instrument)} />
          <Metric label="Current" value={formatInstrumentPrice(current, instrument)} />
          <Metric label="Return" value={Number.isFinite(currentReturn) ? `${currentReturn >= 0 ? '+' : ''}${currentReturn.toFixed(2)}%` : '—'} tone={Number.isFinite(currentReturn) && currentReturn >= 0 ? 'success' : Number.isFinite(currentReturn) ? 'danger' : 'default'} />
        </div>

        <div className="space-y-1">
          {protectionRow('sl', 'Stop Loss', sl, slInput, setSlInput, slPnl, slDistance)}
          {protectionRow('tp', 'Take Profit', tp, tpInput, setTpInput, tpPnl, tpDistance)}
        </div>

        <div className="grid grid-cols-3 gap-1">
          <button type="button" disabled={busy} onClick={() => onBreakEven(position.id)} className="h-8 rounded border border-[#245b48] text-[7px] font-black text-[#42D7A1] disabled:opacity-40">BREAK EVEN</button>
          <button type="button" disabled={busy} onClick={() => onSetTrailing(position.id, !position.trailingEnabled, Number(position.trailingPips || 5))} className={`h-8 rounded border text-[7px] font-black disabled:opacity-40 ${position.trailingEnabled ? 'border-[#315b72] bg-[#0d1a22] text-[#59C7FF]' : 'border-white/[0.06] text-[#8295A7]'}`}>{position.trailingEnabled ? `TRAIL ${position.trailingPips || 5}p` : 'TRAIL'}</button>
          <button type="button" disabled={busy} onClick={() => runClose(50)} className="h-8 rounded border border-white/[0.06] text-[7px] font-black text-[#A1AFBC] disabled:opacity-40">CLOSE 50%</button>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md border border-white/[0.06] bg-black/35 px-2 py-2">
          <Metric label="Margin" value={money(margin, account?.currency || currency)} />
          <Metric label="SL P&L" value={Number.isFinite(slPnl) ? money(slPnl, currency, true) : '—'} tone={Number.isFinite(slPnl) && slPnl < 0 ? 'danger' : 'default'} />
          <Metric label="TP P&L" value={Number.isFinite(tpPnl) ? money(tpPnl, currency, true) : '—'} tone={Number.isFinite(tpPnl) && tpPnl >= 0 ? 'success' : 'default'} />
        </div>

        <button type="button" disabled={busy} onClick={() => runClose(100)} className="h-9 w-full rounded-md border border-[#642c35] bg-[#16090d] text-[8px] font-black uppercase tracking-[0.06em] text-[#FF6F7A] disabled:opacity-40">Close position</button>
      </div>
    </section>
  );
}
