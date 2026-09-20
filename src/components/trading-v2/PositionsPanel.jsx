import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  MoreHorizontal,
  Minus,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Share2,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import { formatInstrumentPrice, instrumentForSymbol, instrumentPipSize } from '../../utils/instrumentFormatting.js';
import { estimatePositionPnlAtPrice, positionDistancePips } from '../../utils/tradingRisk.js';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import SharePositionSheet from './SharePositionSheet.jsx';

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
  desktopDense = false,
}) {
  const [tab, setTab] = useState('positions');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [protectionDrafts, setProtectionDrafts] = useState({});
  const [customClose, setCustomClose] = useState({});
  const [sharePosition, setSharePosition] = useState(null);

  const counts = useMemo(() => ({
    positions: positions.length,
    orders: pendingOrders.length,
    history: positionHistory.length,
    journal: journal.length,
  }), [positions, pendingOrders, positionHistory, journal]);

  const buildProtectionDraft = position => {
    const instrument = instrumentForSymbol(markets, position.symbol);
    const sl = position.sl === null || position.sl === undefined || position.sl === '' ? null : Number(position.sl);
    const tp = position.tp === null || position.tp === undefined || position.tp === '' ? null : Number(position.tp);
    return {
      sl: Number.isFinite(sl) ? sl : null,
      tp: Number.isFinite(tp) ? tp : null,
      slInput: Number.isFinite(sl) ? formatInstrumentPrice(sl, instrument, '') : '',
      tpInput: Number.isFinite(tp) ? formatInstrumentPrice(tp, instrument, '') : '',
    };
  };

  const startProtectionEdit = (position, field = null) => {
    setExpandedId(position.id);
    setEditingId(position.id);
    setEditingField(field);
    setProtectionDrafts(current => ({
      ...current,
      [position.id]: buildProtectionDraft(position),
    }));
  };

  const updateProtectionInput = (position, field, rawValue) => {
    const cleaned = String(rawValue ?? '').replace(',', '.').replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    const normalizedInput = firstDot < 0
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    const parsed = normalizedInput === '' || normalizedInput === '.' ? null : Number(normalizedInput);
    setProtectionDrafts(current => {
      const base = current[position.id] || buildProtectionDraft(position);
      return {
        ...current,
        [position.id]: {
          ...base,
          [field + 'Input']: normalizedInput,
          [field]: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
        },
      };
    });
  };

  const nudge = (position, field, direction) => {
    const draft = protectionDrafts[position.id] || buildProtectionDraft(position);
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

    setProtectionDrafts(currentDrafts => {
      const base = currentDrafts[position.id] || buildProtectionDraft(position);
      return {
        ...currentDrafts,
        [position.id]: {
          ...base,
          [field]: next,
          [field + 'Input']: formatInstrumentPrice(next, instrument, String(next)),
        },
      };
    });
  };

  const cancelProtectionEdit = () => {
    setEditingId(null);
    setEditingField(null);
  };

  const applyProtectionDraft = async position => {
    const draft = protectionDrafts[position.id];
    if (!draft) return;
    const ok = await onUpdatePosition(position.id, { sl: draft.sl, tp: draft.tp });
    if (ok !== false) {
      setEditingId(null);
      setEditingField(null);
    }
  };

  const applyCustomClose = position => {
    const raw = Number(customClose[position.id]);
    if (!Number.isFinite(raw) || raw <= 0) return;
    const value = Math.max(1, Math.min(100, raw));
    onClosePosition(position.id, value);
    setCustomClose(current => ({ ...current, [position.id]: '' }));
  };

  return (
    <section className="mt-3 overflow-visible border-y border-white/[0.08] bg-black">
      <div className="flex h-[50px] items-center justify-between gap-2 border-b border-white/[0.07] px-3">
        <div className="flex h-full min-w-0 items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(item => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`relative flex h-full shrink-0 items-center gap-1 px-1.5 text-[10px] font-bold ${tab === item.id ? 'text-[#f5f5f5]' : 'text-[#737373]'}`}>
              <span>{item.label}</span>
              <span className="rounded-full bg-[#080808] px-1.5 py-0.5 text-[7px] font-extrabold text-[#a3a3a3]">{counts[item.id]}</span>
              {tab === item.id && <span className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full bg-[#101010]" />}
            </button>
          ))}
        </div>
        {tab === 'positions' && <button type="button" onClick={onCloseAll} disabled={!positions.length} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.09] bg-black px-2 text-[8px] font-bold text-[#d4d4d4] disabled:cursor-not-allowed disabled:opacity-35"><Trash2 size={12} className="text-[#737373]" />Close All</button>}
      </div>

      {tab === 'positions' && desktopDense && (
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[1.4fr_.7fr_.75fr_1fr_1fr_1fr_1fr_1fr_136px] items-center border-b border-white/[0.07] px-3 py-2 text-[7px] font-bold uppercase tracking-[0.08em] text-[#5c6f82]">
            <span>Instrument</span><span>Side</span><span className="text-right">Size</span><span className="text-right">Entry</span><span className="text-right">Current</span><span className="text-right">SL</span><span className="text-right">TP</span><span className="text-right">P&amp;L</span><span />
          </div>
          {!positions.length && <div className="grid h-[110px] place-items-center text-center text-[10px] text-[#737373]"><div><b className="block text-[#b3b3b3]">No open positions</b><span className="mt-1 block">Market executions will appear here</span></div></div>}
          {positions.map(position => {
            const instrument = instrumentForSymbol(markets, position.symbol);
            const positive = Number(position.pnl) >= 0;
            const sideBuy = position.side === 'BUY';
            return (
              <div key={position.id} className="grid grid-cols-[1.4fr_.7fr_.75fr_1fr_1fr_1fr_1fr_1fr_136px] items-center border-b border-white/[0.06] px-3 py-2 text-[9px] hover:bg-white/[0.015]">
                <div className="flex min-w-0 items-center gap-2">
                  <InstrumentAvatar instrument={instrument} size={20}/>
                  <strong className="truncate text-[10px] text-[#f2f5f7]">{formatSymbol(position.symbol)}</strong>
                </div>
                <span className={`w-fit rounded px-1.5 py-0.5 text-[7px] font-black ${sideBuy ? 'bg-[#0c3b2e] text-[#38dba4]' : 'bg-[#3b1820] text-[#ff707a]'}`}>{position.side}</span>
                <span className="text-right font-mono text-[#c4cbd2]">{Number(position.volume).toFixed(2)}</span>
                <span className="text-right font-mono text-[#b9c3cc]">{formatInstrumentPrice(position.entry, instrument)}</span>
                <span className="text-right font-mono text-[#d3dbe2]">{formatInstrumentPrice(position.closePrice, instrument)}</span>
                <button type="button" onClick={() => startProtectionEdit(position, 'sl')} className="text-right font-mono text-[#8e9aa5] hover:text-white">{position.sl == null ? '+ SL' : formatInstrumentPrice(position.sl, instrument)}</button>
                <button type="button" onClick={() => startProtectionEdit(position, 'tp')} className="text-right font-mono text-[#8e9aa5] hover:text-white">{position.tp == null ? '+ TP' : formatInstrumentPrice(position.tp, instrument)}</button>
                <strong className={`text-right font-mono text-[10px] ${positive ? 'text-[#3dd9a4]' : 'text-[#ff6975]'}`}>{formatPnl(position.pnl, position.pnlCurrency)}</strong>
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => onBreakEven(position.id)} className="h-7 rounded border border-white/[0.07] px-2 text-[7px] font-bold text-[#48d8a4] hover:bg-white/[0.025]">BE</button>
                  <button type="button" onClick={() => onClosePosition(position.id, 50)} className="h-7 rounded border border-white/[0.07] px-2 text-[7px] font-bold text-[#aeb8c1] hover:bg-white/[0.025]">50%</button>
                  <button type="button" onClick={() => onClosePosition(position.id, 100)} className="h-7 rounded border border-[#51242c] px-2 text-[7px] font-bold text-[#ff727d] hover:bg-[#241015]">Close</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'positions' && !desktopDense && (
        <div className="space-y-2 p-2">
          {!positions.length && <div className="grid h-[118px] place-items-center text-center text-[10px] font-medium text-[#737373]"><div><b className="block text-[#b3b3b3]">No open positions</b><span className="mt-1 block">Market executions will appear here</span></div></div>}

          {positions.map(position => {
            const expanded = expandedId === position.id;
            const editing = editingId === position.id;
            const positive = Number(position.pnl) >= 0;
            const sideBuy = position.side === 'BUY';

            return (
              <article key={position.id} className="overflow-hidden border-b border-white/[0.08] bg-black last:border-b-0">
                <div className="px-3 pb-2.5 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <InstrumentAvatar instrument={instrumentForSymbol(markets, position.symbol)} size={24}/>
                        <strong className="truncate text-[13px] font-black tracking-[-0.025em] text-[#f5f5f5]">{formatSymbol(position.symbol)}</strong>
                        <span className={`rounded-md px-1.5 py-1 text-[7px] font-black leading-none ${sideBuy ? 'bg-[#0c3b2e] text-[#38dba4]' : 'bg-[#3b1820] text-[#ff707a]'}`}>{position.side}</span>
                        {position.trailingEnabled && <span className="rounded-md border border-white/[0.10] bg-black px-1.5 py-1 text-[7px] font-bold text-[#53c7ff]">TRAIL {position.trailingPips}p</span>}
                      </div>
                      <p className="mt-1.5 text-[9px] text-[#737373]"><b className="text-[#b3b3b3]">{Number(position.volume).toFixed(2)} lots</b><span className="mx-1.5 text-[#525252]">•</span>Entry {formatInstrumentPrice(position.entry, instrumentForSymbol(markets, position.symbol))}</p>
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <div className="text-right"><span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#737373]">P&amp;L</span><b className={`mt-1 block text-[14px] font-black ${positive ? 'text-[#3dd9a4]' : 'text-[#ff6975]'}`}>{formatPnl(position.pnl, position.pnlCurrency)}</b></div>
                      <button type="button" onClick={() => setExpandedId(expanded ? null : position.id)} aria-label="More position controls" className={`grid size-8 place-items-center rounded-lg border transition ${expanded ? 'border-white/[0.13] bg-[#080808] text-[#53c7ff]' : 'border-white/[0.08] bg-black text-[#737373]'}`}><MoreHorizontal size={16}/></button>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => startProtectionEdit(position, 'sl')} className="flex items-center justify-between rounded-md border border-white/[0.07] bg-[#080808] px-2.5 py-2 text-left transition hover:border-white/[0.14]"><span className="text-[8px] font-semibold text-[#737373]">SL</span><b className="text-[9px] font-semibold text-[#b3b3b3]">{position.sl == null ? '+ Add SL' : formatInstrumentPrice(position.sl, instrumentForSymbol(markets, position.symbol))}</b></button>
                    <button type="button" onClick={() => startProtectionEdit(position, 'tp')} className="flex items-center justify-between rounded-md border border-white/[0.07] bg-[#080808] px-2.5 py-2 text-left transition hover:border-white/[0.14]"><span className="text-[8px] font-semibold text-[#737373]">TP</span><b className="text-[9px] font-semibold text-[#b3b3b3]">{position.tp == null ? '+ Add TP' : formatInstrumentPrice(position.tp, instrumentForSymbol(markets, position.symbol))}</b></button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-px border-t border-white/[0.07] bg-white/[0.07]">
                  <QuickAction label="CLOSE" tone="danger" onClick={() => onClosePosition(position.id, 100)} />
                  <QuickAction label="50%" onClick={() => onClosePosition(position.id, 50)} />
                  <QuickAction label="BE" tone="success" onClick={() => onBreakEven(position.id)} />
                  <QuickAction label="REVERSE" tone="accent" onClick={() => onReverse(position.id)} />
                </div>

                {expanded && (
                  <div className="space-y-2 border-t border-white/[0.07] bg-black p-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => editing ? cancelProtectionEdit() : startProtectionEdit(position)} className={`flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-md border text-[9px] font-bold ${editing ? 'border-white/[0.13] bg-[#080808] text-[#53c7ff]' : 'border-white/[0.08] bg-black text-[#b3b3b3]'}`}><SlidersHorizontal size={13}/><span className="truncate">{editing ? 'Editing' : 'SL / TP'}</span></button>
                      <button type="button" onClick={() => onDuplicate(position.id)} className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-black text-[9px] font-bold text-[#b3b3b3]"><Copy size={13}/><span className="truncate">Duplicate</span></button>
                      <button type="button" onClick={() => setSharePosition(position)} className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-black text-[9px] font-bold text-[#d4d4d4]"><Share2 size={13}/><span className="truncate">Share P&amp;L</span></button>
                    </div>

                    {editing && (() => {
                      const draft = protectionDrafts[position.id] || buildProtectionDraft(position);
                      const instrument = instrumentForSymbol(markets, position.symbol);
                      return <div className="space-y-2 border border-white/[0.08] bg-black p-2">
                        <ProtectionEditor
                          label="SL"
                          position={position}
                          instrument={instrument}
                          value={draft.sl}
                          inputValue={draft.slInput}
                          autoFocus={editingField === 'sl'}
                          onInput={value => updateProtectionInput(position, 'sl', value)}
                          onMinus={() => nudge(position, 'sl', -1)}
                          onPlus={() => nudge(position, 'sl', 1)}
                        />
                        <ProtectionEditor
                          label="TP"
                          position={position}
                          instrument={instrument}
                          value={draft.tp}
                          inputValue={draft.tpInput}
                          autoFocus={editingField === 'tp'}
                          onInput={value => updateProtectionInput(position, 'tp', value)}
                          onMinus={() => nudge(position, 'tp', -1)}
                          onPlus={() => nudge(position, 'tp', 1)}
                        />
                        <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] pt-2">
                          <button type="button" onClick={cancelProtectionEdit} className="h-8 rounded-md border border-white/[0.08] px-3 text-[9px] font-bold text-[#a3a3a3]">Cancel</button>
                          <button type="button" onClick={() => applyProtectionDraft(position)} className="flex h-8 items-center gap-1.5 rounded-md border border-[#23664f] bg-[rgb(4,20,14)] px-3 text-[9px] font-black text-[#44dda9]"><Check size={12}/>Apply</button>
                        </div>
                      </div>;
                    })()}

                    <div className="border-t border-white/[0.08] bg-black p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><ShieldCheck size={15} className={position.trailingEnabled ? 'text-[#53c7ff]' : 'text-[#737373]'}/><div><b className="block text-[10px] text-[#d4d4d4]">Trailing Stop</b><span className="mt-0.5 block text-[8px] text-[#737373]">Automatically moves the stop as price advances</span></div></div>
                        <button type="button" onClick={() => onSetTrailing(position.id, !position.trailingEnabled, position.trailingPips)} className={`relative h-6 w-11 rounded-full transition ${position.trailingEnabled ? 'bg-[#101010]' : 'bg-[#101010]'}`} aria-label="Toggle trailing stop"><span className={`absolute top-1 size-4 rounded-full bg-white transition ${position.trailingEnabled ? 'left-6' : 'left-1'}`} /></button>
                      </div>
                      <div className="mt-2 flex items-center gap-2"><span className="text-[8px] font-semibold text-[#737373]">Distance</span><button type="button" onClick={() => onSetTrailing(position.id, true, Math.max(1, Number(position.trailingPips) - 1))} className="grid size-7 place-items-center rounded-lg border border-white/[0.08] bg-[#080808] text-[#a3a3a3]"><Minus size={12}/></button><b className="min-w-[54px] rounded-lg border border-white/[0.08] bg-black px-2 py-1.5 text-center text-[9px] text-[#d4d4d4]">{position.trailingPips || 5} pips</b><button type="button" onClick={() => onSetTrailing(position.id, true, Number(position.trailingPips || 5) + 1)} className="grid size-7 place-items-center rounded-lg border border-white/[0.08] bg-[#080808] text-[#a3a3a3]"><Plus size={12}/></button></div>
                    </div>

                    <div className="border-t border-white/[0.08] bg-black p-2.5">
                      <div className="flex items-center gap-2 text-[#b3b3b3]"><TrendingDown size={14}/><b className="text-[10px]">Partial close</b></div>
                      <div className="mt-2 grid grid-cols-4 gap-1.5">{[25, 50, 75, 100].map(percent => <button key={percent} type="button" onClick={() => onClosePosition(position.id, percent)} className="h-8 rounded-lg border border-white/[0.08] bg-black text-[9px] font-bold text-[#b3b3b3] active:bg-[#080808]">{percent === 100 ? 'ALL' : `${percent}%`}</button>)}</div>
                      <div className="mt-2 flex items-center gap-2"><input inputMode="numeric" value={customClose[position.id] ?? ''} onChange={event => setCustomClose(current => ({ ...current, [position.id]: event.target.value.replace(/[^0-9]/g, '').slice(0, 3) }))} placeholder="Custom %" className="h-9 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black px-3 text-[9px] font-semibold text-[#e5e5e5] outline-none placeholder:text-[#525252]"/><button type="button" onClick={() => applyCustomClose(position)} className="h-9 rounded-lg border border-[#642832] bg-black px-3 text-[9px] font-bold text-[#ff7a86]">Close</button></div>
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
          {!pendingOrders.length && <div className="grid h-[138px] place-items-center text-center text-[10px] font-medium text-[#737373]"><div><b className="block text-[#b3b3b3]">No pending orders</b><span className="mt-1 block">Choose Limit, Stop, or Stop Limit above</span></div></div>}
          {pendingOrders.map(order => (
            <div key={order.id} className="border-b border-white/[0.08] bg-black px-3 py-2.5 last:border-b-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="flex items-center gap-1.5"><InstrumentAvatar instrument={instrumentForSymbol(markets, order.symbol)} size={22}/><strong className="truncate text-[11px] text-[#f5f5f5]">{formatSymbol(order.symbol || 'Current symbol')}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${order.side === 'buy' ? 'bg-[#0c3b2e] text-[#38dba4]' : 'bg-[#3b1820] text-[#ff707a]'}`}>{String(order.side).toUpperCase()} {String(order.orderType).toUpperCase()}</span></div><p className="mt-1 text-[8px] text-[#737373]">{Number(order.lots || 0).toFixed(2)} lots · Entry {formatInstrumentPrice(order.entry, instrumentForSymbol(markets, order.symbol))} · {order.expiration}</p></div>
                <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => onModifyPending(order.id)} className="grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-black text-[#a3a3a3]" aria-label="Modify pending order"><SlidersHorizontal size={13}/></button><button type="button" onClick={() => onCancelPending(order.id)} className="grid size-8 place-items-center rounded-lg border border-[#642832] bg-black text-[#ff7480]" aria-label="Cancel pending order"><X size={13}/></button></div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[8px]"><div className="rounded-lg bg-black px-2 py-1.5 text-[#737373]">SL <b className="ml-1 text-[#b3b3b3]">{formatInstrumentPrice(order.sl, instrumentForSymbol(markets, order.symbol))}</b></div><div className="rounded-lg bg-black px-2 py-1.5 text-[#737373]">TP <b className="ml-1 text-[#b3b3b3]">{formatInstrumentPrice(order.tp, instrumentForSymbol(markets, order.symbol))}</b></div><div className="rounded-lg bg-black px-2 py-1.5 text-[#737373]">Status <b className="ml-1 text-[#5bc8ff]">Pending</b></div></div>
              {order.orderType === 'stop-limit' && <div className="mt-1.5 rounded-lg border border-white/[0.08] bg-black px-2 py-1.5 text-[8px] text-[#737373]">Limit price <b className="ml-1 text-[#53c7ff]">{formatInstrumentPrice(order.limitPrice, instrumentForSymbol(markets, order.symbol))}</b></div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-1.5 p-2">
          {!positionHistory.length ? <div className="grid h-[122px] place-items-center text-[10px] font-medium text-[#737373]">Closed positions will appear here</div> : positionHistory.map((item, index) => <div key={`${item.id}-${index}`} className="flex items-center justify-between border-b border-white/[0.08] bg-black px-3 py-2.5 last:border-b-0"><div><div className="flex items-center gap-1.5"><InstrumentAvatar instrument={instrumentForSymbol(markets, item.symbol)} size={22}/><strong className="text-[11px] text-[#f5f5f5]">{formatSymbol(item.symbol)}</strong><span className="rounded-md bg-[#080808] px-1.5 py-1 text-[7px] font-bold text-[#a3a3a3]">{item.closeType || 'Closed'}</span></div><p className="mt-1 text-[8px] text-[#737373]">{item.side} · {Number(item.volume).toFixed(2)} lots · {item.closedAt}</p></div><b className={`text-[11px] ${Number(item.pnl) >= 0 ? 'text-[#31d79d]' : 'text-[#ff6975]'}`}>{formatPnl(item.pnl)}</b></div>)}
        </div>
      )}

      {tab === 'journal' && (
        <div className="max-h-[340px] overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!journal.length ? <div className="grid h-[122px] place-items-center text-center text-[10px] text-[#737373]"><div><b className="block text-[#b3b3b3]">Journal is ready</b><span className="mt-1 block">Orders, fills and management actions will be recorded here.</span></div></div> : journal.map(item => <div key={item.id} className="grid grid-cols-[58px_1fr] gap-2 border-b border-white/[0.07] px-2 py-2.5 last:border-b-0"><span className="font-mono text-[8px] text-[#737373]">{item.time}</span><div><div className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${item.type === 'fill' ? 'bg-[#3ad7a1]' : item.type === 'order' ? 'bg-[#101010]' : item.type === 'modify' ? 'bg-[#f0c35c]' : 'bg-[#101010]'}`} /><b className="text-[9px] font-semibold text-[#b3b3b3]">{item.message}</b></div>{item.latencyMs != null && <span className="mt-1 block text-[7px] text-[#737373]">Execution {item.latencyMs}ms</span>}</div></div>)}
        </div>
      )}
      {sharePosition && (
        <SharePositionSheet
          position={sharePosition}
          instrument={instrumentForSymbol(markets, sharePosition.symbol)}
          onClose={() => setSharePosition(null)}
        />
      )}
    </section>
  );
}

function QuickAction({ label, onClick, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-black text-[#b3b3b3] active:bg-[#080808]',
    danger: 'bg-black text-[#ff7782] active:bg-[#080808]',
    success: 'bg-black text-[#49d9a7] active:bg-[#080808]',
    accent: 'bg-black text-[#a3a3a3] active:bg-[#080808]',
  };
  return <button type="button" onClick={onClick} className={`h-10 text-[8px] font-black tracking-[0.045em] ${tones[tone]}`}>{label}</button>;
}

function ProtectionEditor({ label, position, instrument, value, inputValue, autoFocus = false, onInput, onMinus, onPlus }) {
  const pnl = estimatePositionPnlAtPrice(position, value, instrument);
  const pips = positionDistancePips(position, value, instrument);
  const currency = position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
  const pnlTone = pnl == null ? 'text-[#737373]' : pnl >= 0 ? 'text-[#49d9a7]' : 'text-[#ff7782]';

  return <div className="grid grid-cols-[30px_1fr_30px] items-center gap-1.5">
    <button type="button" onClick={onMinus} className="grid size-[30px] place-items-center rounded-md border border-white/[0.08] bg-[#080808] text-[#a3a3a3]" aria-label={`Decrease ${label}`}><Minus size={11}/></button>
    <label className="min-w-0 rounded-md border border-white/[0.08] bg-[#080808] px-2 py-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[7px] font-black text-[#737373]">{label}</span>
        <span className={`text-[7px] font-bold ${pnlTone}`}>{pnl == null ? 'Preview unavailable' : `${formatPnl(pnl, currency)} · ${pips?.toFixed(1) ?? '—'} pips`}</span>
      </span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        value={inputValue ?? ''}
        placeholder={`Enter ${label} price`}
        onFocus={event => event.currentTarget.select()}
        onChange={event => onInput(event.target.value)}
        className="mt-1 w-full bg-transparent font-mono text-[11px] font-bold tabular-nums text-[#f5f5f5] outline-none placeholder:text-[#525252]"
      />
    </label>
    <button type="button" onClick={onPlus} className="grid size-[30px] place-items-center rounded-md border border-white/[0.08] bg-[#080808] text-[#a3a3a3]" aria-label={`Increase ${label}`}><Plus size={11}/></button>
  </div>;
}
