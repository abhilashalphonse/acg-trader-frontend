import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Plus, X } from 'lucide-react';
import { formatInstrumentPrice, instrumentForSymbol } from '../../utils/instrumentFormatting.js';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import { estimatePositionPnlAtPrice, positionDistancePips } from '../../utils/tradingRisk.js';

function money(value, currency = 'USD', signed = false) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(number));
    return `${number < 0 ? '-' : signed && number > 0 ? '+' : ''}${formatted}`;
  } catch {
    return `${number < 0 ? '-' : signed && number > 0 ? '+' : ''}${Math.abs(number).toFixed(2)} ${currency}`;
  }
}

function symbolLabel(symbol = '') {
  if (symbol.includes('/')) return symbol;
  return /^[A-Z]{6}$/.test(symbol) ? `${symbol.slice(0, 3)}/${symbol.slice(3)}` : symbol;
}

function sideTone(side) {
  return String(side).toUpperCase() === 'BUY'
    ? 'bg-[#0d3328] text-[#43d9a6]'
    : 'bg-[#351820] text-[#ff717d]';
}

function accountLabel(account) {
  const type = String(account?.accountType || account?.mode || '').toUpperCase();
  if (type === 'DEMO') return 'Trial account';
  if (type === 'FUNDED') return 'Master account';
  return 'Evaluation account';
}

function projectedProtection(position, value, instrument, currency) {
  const target = Number(value);
  if (!Number.isFinite(target) || target <= 0 || !instrument) return null;

  const pnl = estimatePositionPnlAtPrice(position, target, instrument);
  const pips = positionDistancePips(position, target, instrument);
  return {
    pnl,
    pips,
    currency: position?.pnlCurrency || instrument?.pnlCurrency || currency || 'USD',
  };
}

export default function TradeSection({
  account = {},
  positions = [],
  pendingOrders = [],
  markets = [],
  onOpenChart = () => {},
  onClosePosition = () => {},
  onCloseAll = () => {},
  onCancelPending = () => {},
  onModifyPending = () => {},
  onUpdatePosition = async () => false,
  onNewOrder = () => {},
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [protectionDraft, setProtectionDraft] = useState({ sl: '', tp: '' });
  const [protectionSaving, setProtectionSaving] = useState(false);
  const [protectionError, setProtectionError] = useState('');
  const currency = account.currency || 'USD';
  const floating = Number(account.floatingPnl);
  const balance = Number(account.balance);
  const equity = Number(account.equity);
  const margin = Number(account.usedMargin ?? account.margin);
  const freeMargin = Number(account.freeMargin);
  const marginLevel = account.marginLevel == null ? null : Number(account.marginLevel);

  const marketFor = symbol => instrumentForSymbol(markets, symbol);
  const price = (value, symbol) => formatInstrumentPrice(value, marketFor(symbol));

  const openPositionDetails = position => {
    const nextExpanded = expandedId === position.id ? null : position.id;
    setExpandedId(nextExpanded);
    setProtectionError('');
    if (nextExpanded != null) {
      setProtectionDraft({
        sl: position.sl == null ? '' : price(position.sl, position.symbol),
        tp: position.tp == null ? '' : price(position.tp, position.symbol),
      });
    }
  };

  const protectionValue = value => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const numeric = Number(text);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : NaN;
  };

  const saveProtection = async position => {
    if (protectionSaving) return;
    const sl = protectionValue(protectionDraft.sl);
    const tp = protectionValue(protectionDraft.tp);
    if (Number.isNaN(sl) || Number.isNaN(tp)) {
      setProtectionError('Enter a valid positive price or leave the field empty to remove it.');
      return;
    }

    setProtectionSaving(true);
    setProtectionError('');
    try {
      const saved = await onUpdatePosition(position.id, { sl, tp });
      if (saved === false) return;
      setProtectionDraft({
        sl: sl == null ? '' : price(sl, position.symbol),
        tp: tp == null ? '' : price(tp, position.symbol),
      });
    } finally {
      setProtectionSaving(false);
    }
  };

  return (
    <section className="acg-mobile-terminal-page min-h-[calc(100dvh-92px)] px-2 pb-4 pt-2">
      <header className="flex items-start justify-between gap-3 pb-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5f7488]">{accountLabel(account)}</p>
          <h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">Trade</h1>
          <p className="mt-1 text-[10px] text-[#718397]">Positions, orders and margin at a glance.</p>
        </div>
        <button type="button" onClick={onNewOrder} className="acg-terminal-accent mt-1 flex h-9 items-center gap-1.5 border border-white/[0.08] bg-[#15151a] px-3 text-[9px] font-extrabold"><Plus size={14}/>New order</button>
      </header>

      <div className="border-y border-white/[0.08] bg-black py-3">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#63798d]">Floating P&amp;L</p><strong className={`mt-1 block text-[28px] font-black tracking-[-0.045em] ${Number(floating) >= 0 ? 'text-[#43d9a6]' : 'text-[#ff6f7a]'}`}>{money(floating, currency, true)}</strong></div>
          <div className="text-right"><span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#5e7488]">Equity</span><b className="mt-1 block text-[14px] text-[#eef4f8]">{money(equity, currency)}</b></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-white/[0.08] pt-3">
          <Metric label="Balance" value={money(balance, currency)} />
          <Metric label="Margin" value={money(margin, currency)} />
          <Metric label="Free margin" value={money(freeMargin, currency)} />
          <Metric label="Margin level" value={marginLevel == null ? '—' : `${marginLevel.toFixed(2)}%`} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between px-1">
        <div><h2 className="text-[12px] font-black text-[#eaf1f6]">Open positions <span className="ml-1 text-[#5e7890]">{positions.length}</span></h2><p className="mt-0.5 text-[8px] text-[#60758a]">Tap a position to set SL / TP or manage it.</p></div>
        {positions.length > 1 && <button type="button" onClick={onCloseAll} className="rounded-lg border border-[#4b2830] bg-[#080808] px-2.5 py-1.5 text-[8px] font-bold text-[#ff7b85]">Close all</button>}
      </div>

      <div className="mt-2 space-y-2">
        {!positions.length && <EmptyState title="No open positions" subtitle="Orders executed from Chart will appear here." />}
        {positions.map(position => {
          const expanded = expandedId === position.id;
          const live = marketFor(position.symbol);
          const current = Number(position.side === 'BUY' ? live?.bid : live?.ask);
          const positive = Number(position.pnl) >= 0;
          return (
            <article key={position.id} className="overflow-hidden border-b border-white/[0.08] bg-black last:border-b-0">
              <button type="button" onClick={() => openPositionDetails(position)} className="w-full px-3.5 py-3 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><InstrumentAvatar instrument={live} size={24}/><strong className="text-[13px] font-black text-[#f1f5f8]">{symbolLabel(position.symbol)}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${sideTone(position.side)}`}>{String(position.side).toUpperCase()} · {Number(position.volume).toFixed(2)}</span></div>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[9px] text-[#72869a]"><span>{price(position.entry, position.symbol)}</span><span className="text-[#354c60]">→</span><span className="text-[#afbdc9]">{price(current, position.symbol)}</span></div>
                  </div>
                  <div className="flex items-start gap-2"><div className="text-right"><b className={`block text-[15px] font-black ${positive ? 'text-[#42d8a5]' : 'text-[#ff6d79]'}`}>{money(position.pnl, position.pnlCurrency || currency, true)}</b><span className="mt-1 block text-[8px] text-[#5d7286]">P&amp;L</span></div>{expanded ? <ChevronUp size={15} className="mt-1 text-[#6e8498]"/> : <ChevronDown size={15} className="mt-1 text-[#6e8498]"/>}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2"><MiniMetric label="SL" value={price(position.sl, position.symbol)} /><MiniMetric label="TP" value={price(position.tp, position.symbol)} /></div>
              </button>

              {expanded && <div className="border-t border-white/[0.08] bg-[#080808] px-3.5 pb-3.5 pt-3">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <b className="text-[10px] font-black text-[#dce6ee]">Protection</b>
                    <p className="mt-0.5 text-[8px] text-[#60758a]">Set or remove stop loss and take profit.</p>
                  </div>
                  <span className="font-mono text-[8px] text-[#71859a]">Now {price(current, position.symbol)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ProtectionField
                    label="SL"
                    value={protectionDraft.sl}
                    projection={projectedProtection(position, protectionDraft.sl, live, currency)}
                    onChange={value => { setProtectionDraft(currentDraft => ({ ...currentDraft, sl: value })); setProtectionError(''); }}
                    onClear={() => { setProtectionDraft(currentDraft => ({ ...currentDraft, sl: '' })); setProtectionError(''); }}
                  />
                  <ProtectionField
                    label="TP"
                    value={protectionDraft.tp}
                    projection={projectedProtection(position, protectionDraft.tp, live, currency)}
                    onChange={value => { setProtectionDraft(currentDraft => ({ ...currentDraft, tp: value })); setProtectionError(''); }}
                    onClear={() => { setProtectionDraft(currentDraft => ({ ...currentDraft, tp: '' })); setProtectionError(''); }}
                  />
                </div>

                {protectionError && <p className="mt-2 text-[8px] font-semibold leading-4 text-[#ff7b85]">{protectionError}</p>}

                <button
                  type="button"
                  onClick={() => void saveProtection(position)}
                  disabled={protectionSaving}
                  className="mt-2 flex h-10 w-full items-center justify-center rounded-md border border-white/[0.10] bg-[#15151a] text-[9px] font-black text-[#67ccff] disabled:cursor-wait disabled:opacity-55"
                >
                  {protectionSaving ? 'Saving protection…' : 'Save protection'}
                </button>

                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3"><Metric label="Opened" value={position.openedAt || '—'} /><Metric label="Ticket" value={`#${String(position.id).slice(-8)}`} /><Metric label="Swap" value={money(position.swap || 0, position.pnlCurrency || currency)} /><Metric label="Source" value={String(position.source || 'market').replace('-', ' ')} /></div>
                <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onOpenChart(position.symbol)} className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-[#101010] text-[9px] font-bold text-[#63cbff]"><ExternalLink size={13}/>View on chart</button><button type="button" onClick={() => onClosePosition(position.id, 100)} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#562c35] bg-[#251319] text-[9px] font-bold text-[#ff7a85]"><X size={13}/>Close position</button></div>
              </div>}
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between px-1"><div><h2 className="text-[12px] font-black text-[#eaf1f6]">Pending orders <span className="ml-1 text-[#5e7890]">{pendingOrders.length}</span></h2><p className="mt-0.5 text-[8px] text-[#60758a]">Limit and stop orders waiting for execution.</p></div></div>
      <div className="mt-2 space-y-2">
        {!pendingOrders.length && <EmptyState title="No pending orders" subtitle="Limit and stop orders will appear here." compact />}
        {pendingOrders.map(order => {
          const side = String(order.side).toUpperCase();
          return <article key={order.id} className="border-b border-white/[0.08] bg-black px-1 py-3 last:border-b-0"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><InstrumentAvatar instrument={marketFor(order.symbol)} size={24}/><strong className="text-[12px] font-black text-[#eff4f8]">{symbolLabel(order.symbol)}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${sideTone(side)}`}>{side} {String(order.orderType || 'order').toUpperCase()}</span></div><p className="mt-2 text-[9px] text-[#71859a]">{Number(order.lots || order.manualLots || 0).toFixed(2)} lots · Entry <b className="font-mono text-[#c1ccd6]">{price(order.entry, order.symbol)}</b></p><div className="mt-2 flex gap-3 text-[8px] text-[#60758a]"><span>SL <b className="text-[#9eb0bf]">{price(order.sl, order.symbol)}</b></span><span>TP <b className="text-[#9eb0bf]">{price(order.tp, order.symbol)}</b></span></div></div></div><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => onOpenChart(order.symbol)} className="h-9 rounded-md border border-white/[0.08] bg-[#101010] text-[8px] font-bold text-[#5fc9ff]">Chart</button><button type="button" onClick={() => onModifyPending(order.id)} className="h-9 rounded-xl border border-white/[0.08] bg-[#080808] text-[8px] font-bold text-[#b5c3ce]">Modify</button><button type="button" onClick={() => onCancelPending(order.id)} className="h-9 rounded-xl border border-[#512b34] bg-[#101010] text-[8px] font-bold text-[#ff7984]">Cancel</button></div></article>;
        })}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="min-w-0"><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5d7287]">{label}</span><b className="mt-1 block truncate text-[10px] font-semibold capitalize text-[#cbd6df]">{value}</b></div>;
}

function MiniMetric({ label, value }) {
  return <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#080808] px-2.5 py-2"><span className="text-[7px] font-bold text-[#5e7488]">{label}</span><b className="font-mono text-[9px] text-[#b9c6d1]">{value}</b></div>;
}

function ProtectionField({ label, value, projection, onChange, onClear }) {
  const pnl = Number(projection?.pnl);
  const hasPnl = Number.isFinite(pnl);
  const pips = Number(projection?.pips);
  const hasPips = Number.isFinite(pips);
  const pnlText = hasPnl ? money(pnl, projection?.currency || 'USD', true) : '—';
  const distanceText = hasPips ? `${pips.toFixed(1)} pips` : '—';
  const pnlTone = !hasPnl ? 'text-[#60758a]' : pnl < 0 ? 'text-[#ff6f7a]' : pnl > 0 ? 'text-[#43d9a6]' : 'text-[#9aabba]';

  return (
    <div className="block rounded-md border border-white/[0.08] bg-black px-2.5 py-2">
      <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-[0.1em] text-[#61768a]">
        <label>{label}</label>
        <button type="button" onClick={onClear} className="text-[7px] font-bold normal-case tracking-normal text-[#70869a]">Clear</button>
      </div>
      <input
        aria-label={label}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="No protection"
        className="mt-1.5 w-full bg-transparent font-mono text-[11px] font-bold tabular-nums text-[#eef4f8] outline-none placeholder:text-[#405364]"
      />
      <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
        <span className={`font-mono text-[9px] font-black tabular-nums ${pnlTone}`}>{pnlText}</span>
        <span className="text-[7px] font-semibold tabular-nums text-[#60758a]">{distanceText}</span>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle, compact = false }) {
  return <div className={`grid place-items-center border-y border-dashed border-white/[0.08] bg-black text-center ${compact ? 'h-[92px]' : 'h-[118px]'}`}><div><b className="text-[10px] text-[#9eafbe]">{title}</b><p className="mt-1 text-[8px] text-[#5d7185]">{subtitle}</p></div></div>;
}
