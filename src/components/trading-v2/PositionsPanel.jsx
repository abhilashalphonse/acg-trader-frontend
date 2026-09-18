import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  MoreHorizontal,
  Minus,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import { formatInstrumentPrice, instrumentForSymbol, instrumentPipSize } from '../../utils/instrumentFormatting.js';

const tabs = [
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'history', label: 'History' },
  { id: 'journal', label: 'Journal' },
];

function formatSymbol(symbol = '') {
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}

function formatPnl(value, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(number));
    return `${number >= 0 ? '+' : '-'}${formatted}`;
  } catch {
    return `${number >= 0 ? '+' : '-'}${Math.abs(number).toFixed(2)} ${currency || ''}`.trim();
  }
}

export default function PositionsPanel({
  positions = [],
  markets = [],
  positionHistory = [],
  pendingOrders = [],
  journal = [],
  onClosePosition = () => {},
  onCloseAll = () => {},
  onBreakEven = () => {},
  onReverse = () => {},
  onUpdatePosition = () => {},
  onSetTrailing = () => {},
  onDuplicate = () => {},
  onCancelPending = () => {},
  onModifyPending = () => {},
}) {
  const [tab, setTab] = useState('positions');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [protectionDrafts, setProtectionDrafts] = useState({});
  const [customClose, setCustomClose] = useState({});

  const counts = useMemo(() => ({
    positions: positions.length,
    orders: pendingOrders.length,
    history: positionHistory.length,
    journal: journal.length,
  }), [positions, pendingOrders, positionHistory, journal]);

  const startProtectionEdit = position => {
    setEditingId(position.id);
    setProtectionDrafts(current => ({
      ...current,
      [position.id]: {
        sl: position.sl,
        tp: position.tp,
      },
    }));
  };

  const nudge = (position, field, direction) => {
    const draft = protectionDrafts[position.id] || { sl: position.sl, tp: position.tp };
    const raw = draft[field];
    const current = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
    const entry = Number(position.entry);
    const executable = Number(position.closePrice);
    const reference = Number.isFinite(executable) && executable > 0 ? executable : entry;
    const instrument = instrumentForSymbol(markets, position.symbol);
    const step = instrumentPipSize(instrument);

    let next;
    if (!Number.isFinite(current) || current <= 0) {
      const isBuy = String(position.side).toUpperCase() === 'BUY';
      const offset = field === 'sl'
        ? (isBuy ? -step : step)
        : (isBuy ? step : -step);
      next = reference + offset;
    } else {
      next = current + direction * step;
    }

    setProtectionDrafts(currentDrafts => ({
      ...currentDrafts,
      [position.id]: {
        ...(currentDrafts[position.id] || { sl: position.sl, tp: position.tp }),
        [field]: next,
      },
    }));
  };

  const applyProtectionDraft = position => {
    const draft = protectionDrafts[position.id];
    if (draft) onUpdatePosition(position.id, { sl: draft.sl, tp: draft.tp });
    setEditingId(null);
  };

  const applyCustomClose = position => {
    const raw = Number(customClose[position.id]);
    if (!Number.isFinite(raw) || raw <= 0) return;
    const value = Math.max(1, Math.min(100, raw));
    onClosePosition(position.id, value);
    setCustomClose(current => ({ ...current, [position.id]: '' }));
  };

  return (
    <section className="mt-3 overflow-visible rounded-[20px] border border-[#182938] bg-gradient-to-b from-[#0a141e] to-[#071019] shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
      <div className="flex h-[50px] items-center justify-between gap-2 border-b border-[#132331] px-3">
        <div className="flex h-full min-w-0 items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(item => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`relative flex h-full shrink-0 items-center gap-1 px-1.5 text-[10px] font-bold ${tab === item.id ? 'text-[#f3f7fb]' : 'text-[#7b8da1]'}`}>
              <span>{item.label}</span>
              <span className="rounded-full bg-[#0d3048] px-1.5 py-0.5 text-[7px] font-extrabold text-[#55c3ff]">{counts[item.id]}</span>
              {tab === item.id && <span className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full bg-[#3dbdff] shadow-[0_0_8px_rgba(61,189,255,0.35)]" />}
            </button>
          ))}
        </div>
        {tab === 'positions' && <button type="button" onClick={onCloseAll} disabled={!positions.length} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#26384a] bg-[#0b151f] px-2 text-[8px] font-bold text-[#d6dee7] disabled:cursor-not-allowed disabled:opacity-35"><Trash2 size={12} className="text-[#8fa2b7]" />Close All</button>}
      </div>

      {tab === 'positions' && (
        <div className="space-y-2 p-2">
          {!positions.length && <div className="grid h-[118px] place-items-center text-center text-[10px] font-medium text-[#607387]"><div><b className="block text-[#9fb0c2]">No open positions</b><span className="mt-1 block">Market executions will appear here</span></div></div>}

          {positions.map(position => {
            const expanded = expandedId === position.id;
            const editing = editingId === position.id;
            const positive = Number(position.pnl) >= 0;
            const sideBuy = position.side === 'BUY';

            return (
              <article key={position.id} className="overflow-hidden rounded-[16px] border border-[#162a38] bg-[#08131c] shadow-[inset_0_1px_rgba(255,255,255,0.018)]">
                <div className="px-3 pb-2.5 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <strong className="truncate text-[13px] font-black tracking-[-0.025em] text-[#f0f5f9]">{formatSymbol(position.symbol)}</strong>
                        <span className={`rounded-md px-1.5 py-1 text-[7px] font-black leading-none ${sideBuy ? 'bg-[#0c3b2e] text-[#38dba4]' : 'bg-[#3b1820] text-[#ff707a]'}`}>{position.side}</span>
                        {position.trailingEnabled && <span className="rounded-md border border-[#25445a] bg-[#0c2230] px-1.5 py-1 text-[7px] font-bold text-[#5bc8ff]">TRAIL {position.trailingPips}p</span>}
                      </div>
                      <p className="mt-1.5 text-[9px] text-[#6f8296]"><b className="text-[#cbd6df]">{Number(position.volume).toFixed(2)} lots</b><span className="mx-1.5 text-[#34495b]">•</span>Entry {formatInstrumentPrice(position.entry, instrumentForSymbol(markets, position.symbol))}</p>
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <div className="text-right"><span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#5f7388]">P&amp;L</span><b className={`mt-1 block text-[14px] font-black ${positive ? 'text-[#3dd9a4]' : 'text-[#ff6975]'}`}>{formatPnl(position.pnl, position.pnlCurrency)}</b></div>
                      <button type="button" onClick={() => setExpandedId(expanded ? null : position.id)} aria-label="More position controls" className={`grid size-8 place-items-center rounded-lg border transition ${expanded ? 'border-[#29516a] bg-[#0d2b3e] text-[#5bc8ff]' : 'border-[#1b2d3c] bg-[#0b1720] text-[#788da2]'}`}><MoreHorizontal size={16}/></button>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    <div className="flex items-center justify-between rounded-xl border border-[#152936] bg-[#0a161f] px-2.5 py-2"><span className="text-[8px] font-semibold text-[#63778b]">SL</span><b className="text-[9px] font-semibold text-[#c5d0da]">{formatInstrumentPrice(position.sl, instrumentForSymbol(markets, position.symbol))}</b></div>
                    <div className="flex items-center justify-between rounded-xl border border-[#152936] bg-[#0a161f] px-2.5 py-2"><span className="text-[8px] font-semibold text-[#63778b]">TP</span><b className="text-[9px] font-semibold text-[#c5d0da]">{formatInstrumentPrice(position.tp, instrumentForSymbol(markets, position.symbol))}</b></div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-px border-t border-[#152735] bg-[#152735]">
                  <QuickAction label="CLOSE" tone="danger" onClick={() => onClosePosition(position.id, 100)} />
                  <QuickAction label="50%" onClick={() => onClosePosition(position.id, 50)} />
                  <QuickAction label="BE" tone="success" onClick={() => onBreakEven(position.id)} />
                  <QuickAction label="REVERSE" tone="accent" onClick={() => onReverse(position.id)} />
                </div>

                {expanded && (
                  <div className="space-y-2 border-t border-[#172a38] bg-[#07111a] p-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => editing ? setEditingId(null) : startProtectionEdit(position)} className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-[10px] font-bold ${editing ? 'border-[#235773] bg-[#0d2b3e] text-[#64cfff]' : 'border-[#1b3040] bg-[#0b1822] text-[#b8c6d2]'}`}><SlidersHorizontal size={14}/>Modify SL / TP</button>
                      <button type="button" onClick={() => onDuplicate(position.id)} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1b3040] bg-[#0b1822] text-[10px] font-bold text-[#b8c6d2]"><Copy size={14}/>Duplicate</button>
                    </div>

                    {editing && <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-xl border border-[#183144] bg-[#091923] p-2"><Adjust label="SL" value={formatInstrumentPrice((protectionDrafts[position.id] || {}).sl, instrumentForSymbol(markets, position.symbol))} onMinus={() => nudge(position, 'sl', -1)} onPlus={() => nudge(position, 'sl', 1)} /><Adjust label="TP" value={formatInstrumentPrice((protectionDrafts[position.id] || {}).tp, instrumentForSymbol(markets, position.symbol))} onMinus={() => nudge(position, 'tp', -1)} onPlus={() => nudge(position, 'tp', 1)} /><button type="button" onClick={() => applyProtectionDraft(position)} className="grid size-9 place-items-center rounded-lg border border-[#176347] bg-[#0d2f25] text-[#44dda9]" aria-label="Apply modification"><Check size={14}/></button></div>}

                    <div className="rounded-xl border border-[#183144] bg-[#091923] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><ShieldCheck size={15} className={position.trailingEnabled ? 'text-[#57ccff]' : 'text-[#688095]'}/><div><b className="block text-[10px] text-[#d5dfe7]">Trailing Stop</b><span className="mt-0.5 block text-[8px] text-[#667b8f]">Frontend state ready for server-side trailing</span></div></div>
                        <button type="button" onClick={() => onSetTrailing(position.id, !position.trailingEnabled, position.trailingPips)} className={`relative h-6 w-11 rounded-full transition ${position.trailingEnabled ? 'bg-[#14557a]' : 'bg-[#172735]'}`} aria-label="Toggle trailing stop"><span className={`absolute top-1 size-4 rounded-full bg-white transition ${position.trailingEnabled ? 'left-6' : 'left-1'}`} /></button>
                      </div>
                      <div className="mt-2 flex items-center gap-2"><span className="text-[8px] font-semibold text-[#6d8195]">Distance</span><button type="button" onClick={() => onSetTrailing(position.id, true, Math.max(1, Number(position.trailingPips) - 1))} className="grid size-7 place-items-center rounded-lg border border-[#1a3040] bg-[#0d1b26] text-[#8fa3b6]"><Minus size={12}/></button><b className="min-w-[54px] rounded-lg border border-[#1a3040] bg-[#0a151f] px-2 py-1.5 text-center text-[9px] text-[#d4dee6]">{position.trailingPips || 5} pips</b><button type="button" onClick={() => onSetTrailing(position.id, true, Number(position.trailingPips || 5) + 1)} className="grid size-7 place-items-center rounded-lg border border-[#1a3040] bg-[#0d1b26] text-[#8fa3b6]"><Plus size={12}/></button></div>
                    </div>

                    <div className="rounded-xl border border-[#33262d] bg-[#151015] p-2.5">
                      <div className="flex items-center gap-2 text-[#c7b6bd]"><TrendingDown size={14}/><b className="text-[10px]">Partial close</b></div>
                      <div className="mt-2 grid grid-cols-4 gap-1.5">{[25, 50, 75, 100].map(percent => <button key={percent} type="button" onClick={() => onClosePosition(position.id, percent)} className="h-8 rounded-lg border border-[#362730] bg-[#1b1217] text-[9px] font-bold text-[#d0bfc5] active:bg-[#351922]">{percent === 100 ? 'ALL' : `${percent}%`}</button>)}</div>
                      <div className="mt-2 flex items-center gap-2"><input inputMode="numeric" value={customClose[position.id] ?? ''} onChange={event => setCustomClose(current => ({ ...current, [position.id]: event.target.value.replace(/[^0-9]/g, '').slice(0, 3) }))} placeholder="Custom %" className="h-9 min-w-0 flex-1 rounded-lg border border-[#382933] bg-[#120d11] px-3 text-[9px] font-semibold text-[#e0d3d8] outline-none placeholder:text-[#66545b]"/><button type="button" onClick={() => applyCustomClose(position)} className="h-9 rounded-lg border border-[#65313c] bg-[#2c151c] px-3 text-[9px] font-bold text-[#ff7a86]">Close</button></div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-1.5 p-2">
          {!pendingOrders.length && <div className="grid h-[138px] place-items-center text-center text-[10px] font-medium text-[#607387]"><div><b className="block text-[#9fb0c2]">No pending orders</b><span className="mt-1 block">Choose Limit, Stop, or Stop Limit above</span></div></div>}
          {pendingOrders.map(order => (
            <div key={order.id} className="rounded-xl border border-[#142533] bg-[#08121b] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="flex items-center gap-1.5"><strong className="truncate text-[11px] text-[#f0f5f9]">{formatSymbol(order.symbol || 'Current symbol')}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${order.side === 'buy' ? 'bg-[#0c3b2e] text-[#38dba4]' : 'bg-[#3b1820] text-[#ff707a]'}`}>{String(order.side).toUpperCase()} {String(order.orderType).toUpperCase()}</span></div><p className="mt-1 text-[8px] text-[#718398]">{Number(order.lots || 0).toFixed(2)} lots · Entry {formatInstrumentPrice(order.entry, instrumentForSymbol(markets, order.symbol))} · {order.expiration}</p></div>
                <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => onModifyPending(order.id)} className="grid size-8 place-items-center rounded-lg border border-[#203747] bg-[#0b1822] text-[#8fa5b8]" aria-label="Modify pending order"><SlidersHorizontal size={13}/></button><button type="button" onClick={() => onCancelPending(order.id)} className="grid size-8 place-items-center rounded-lg border border-[#5b2931] bg-[#251217] text-[#ff7480]" aria-label="Cancel pending order"><X size={13}/></button></div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[8px]"><div className="rounded-lg bg-[#0a151f] px-2 py-1.5 text-[#718398]">SL <b className="ml-1 text-[#c9d5de]">{formatInstrumentPrice(order.sl, instrumentForSymbol(markets, order.symbol))}</b></div><div className="rounded-lg bg-[#0a151f] px-2 py-1.5 text-[#718398]">TP <b className="ml-1 text-[#c9d5de]">{formatInstrumentPrice(order.tp, instrumentForSymbol(markets, order.symbol))}</b></div><div className="rounded-lg bg-[#0a151f] px-2 py-1.5 text-[#718398]">Status <b className="ml-1 text-[#5bc8ff]">Pending</b></div></div>
              {order.orderType === 'stop-limit' && <div className="mt-1.5 rounded-lg border border-[#30264a] bg-[#151126] px-2 py-1.5 text-[8px] text-[#8f7ab2]">Limit price <b className="ml-1 text-[#c4a8ff]">{formatInstrumentPrice(order.limitPrice, instrumentForSymbol(markets, order.symbol))}</b></div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-1.5 p-2">
          {!positionHistory.length ? <div className="grid h-[122px] place-items-center text-[10px] font-medium text-[#607387]">Closed positions will appear here</div> : positionHistory.map((item, index) => <div key={`${item.id}-${index}`} className="flex items-center justify-between rounded-xl border border-[#142533] bg-[#08121b] px-3 py-2.5"><div><div className="flex items-center gap-1.5"><strong className="text-[11px] text-[#f0f5f9]">{formatSymbol(item.symbol)}</strong><span className="rounded-md bg-[#101f2a] px-1.5 py-1 text-[7px] font-bold text-[#7f95a8]">{item.closeType || 'Closed'}</span></div><p className="mt-1 text-[8px] text-[#63758a]">{item.side} · {Number(item.volume).toFixed(2)} lots · {item.closedAt}</p></div><b className={`text-[11px] ${Number(item.pnl) >= 0 ? 'text-[#31d79d]' : 'text-[#ff6975]'}`}>{formatPnl(item.pnl)}</b></div>)}
        </div>
      )}

      {tab === 'journal' && (
        <div className="max-h-[340px] overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!journal.length ? <div className="grid h-[122px] place-items-center text-center text-[10px] text-[#607387]"><div><b className="block text-[#9fb0c2]">Journal is ready</b><span className="mt-1 block">Orders, fills and management actions will be recorded here.</span></div></div> : journal.map(item => <div key={item.id} className="grid grid-cols-[58px_1fr] gap-2 border-b border-[#122431] px-2 py-2.5 last:border-b-0"><span className="font-mono text-[8px] text-[#52687c]">{item.time}</span><div><div className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${item.type === 'fill' ? 'bg-[#3ad7a1]' : item.type === 'order' ? 'bg-[#b68cff]' : item.type === 'modify' ? 'bg-[#f0c35c]' : 'bg-[#55c8ff]'}`} /><b className="text-[9px] font-semibold text-[#cbd7e0]">{item.message}</b></div>{item.latencyMs != null && <span className="mt-1 block text-[7px] text-[#61768a]">Execution {item.latencyMs}ms</span>}</div></div>)}
        </div>
      )}
    </section>
  );
}

function QuickAction({ label, onClick, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-[#0a151f] text-[#aebdca] active:bg-[#111f2a]',
    danger: 'bg-[#171014] text-[#ff7782] active:bg-[#32161d]',
    success: 'bg-[#0b1714] text-[#49d9a7] active:bg-[#0e2c23]',
    accent: 'bg-[#0b151f] text-[#60c9ff] active:bg-[#102a3b]',
  };
  return <button type="button" onClick={onClick} className={`h-10 text-[8px] font-black tracking-[0.045em] ${tones[tone]}`}>{label}</button>;
}

function Adjust({ label, value, onMinus, onPlus }) {
  return <div className="flex items-center gap-1 rounded-lg border border-[#1a2c3a] bg-[#0a151f] px-1.5 py-1"><span className="mr-1 text-[8px] font-bold text-[#718398]">{label}</span><button type="button" onClick={onMinus} className="grid size-6 place-items-center rounded-md bg-[#101d27] text-[#8799ac]"><Minus size={11}/></button><b className="min-w-0 flex-1 text-center text-[8px] text-[#d8e2ea]">{value}</b><button type="button" onClick={onPlus} className="grid size-6 place-items-center rounded-md bg-[#101d27] text-[#8799ac]"><Plus size={11}/></button></div>;
}
