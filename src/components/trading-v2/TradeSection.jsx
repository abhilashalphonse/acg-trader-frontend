import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, MoreHorizontal, Plus, X } from 'lucide-react';
import { formatInstrumentPrice, instrumentForSymbol } from '../../utils/instrumentFormatting.js';

function money(value, currency = 'USD', signed = false) {
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
  onNewOrder = () => {},
}) {
  const [expandedId, setExpandedId] = useState(null);
  const currency = account.currency || 'USD';
  const floating = Number(account.floatingPnl);
  const balance = Number(account.balance);
  const equity = Number(account.equity);
  const margin = Number(account.usedMargin ?? account.margin);
  const freeMargin = Number(account.freeMargin);
  const marginLevel = account.marginLevel == null ? null : Number(account.marginLevel);

  const marketFor = symbol => instrumentForSymbol(markets, symbol);
  const price = (value, symbol) => formatInstrumentPrice(value, marketFor(symbol));

  return (
    <section className="min-h-[calc(100dvh-98px)] px-3 pb-6 pt-3">
      <header className="flex items-start justify-between gap-3 pb-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5f7488]">Live account</p>
          <h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">Trade</h1>
          <p className="mt-1 text-[10px] text-[#718397]">Positions, orders and margin at a glance.</p>
        </div>
        <button type="button" onClick={onNewOrder} className="mt-1 flex h-10 items-center gap-1.5 rounded-xl border border-[#22445c] bg-[#0c2333] px-3 text-[9px] font-extrabold text-[#62cbff]"><Plus size={14}/>New order</button>
      </header>

      <div className="rounded-[22px] border border-[#193044] bg-[linear-gradient(145deg,#0d1e2b,#08131d_65%)] p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)]">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#63798d]">Floating P&amp;L</p><strong className={`mt-1 block text-[28px] font-black tracking-[-0.045em] ${floating >= 0 ? 'text-[#43d9a6]' : 'text-[#ff6f7a]'}`}>{floating >= 0 ? '+' : '-'}${Math.abs(floating).toFixed(2)}</strong></div>
          <div className="text-right"><span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#5e7488]">Equity</span><b className="mt-1 block text-[14px] text-[#eef4f8]">{money(equity, currency)}</b></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-[#173044] pt-3">
          <Metric label="Balance" value={money(balance, currency)} />
          <Metric label="Margin" value={money(margin, currency)} />
          <Metric label="Free margin" value={money(freeMargin, currency)} />
          <Metric label="Margin level" value={marginLevel == null ? '—' : `${marginLevel.toFixed(2)}%`} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between px-1">
        <div><h2 className="text-[12px] font-black text-[#eaf1f6]">Open positions <span className="ml-1 text-[#5e7890]">{positions.length}</span></h2><p className="mt-0.5 text-[8px] text-[#60758a]">Tap a position for full details.</p></div>
        {positions.length > 1 && <button type="button" onClick={onCloseAll} className="rounded-lg border border-[#4b2830] bg-[#201218] px-2.5 py-1.5 text-[8px] font-bold text-[#ff7b85]">Close all</button>}
      </div>

      <div className="mt-2 space-y-2">
        {!positions.length && <EmptyState title="No open positions" subtitle="Orders executed from Chart will appear here." />}
        {positions.map(position => {
          const expanded = expandedId === position.id;
          const live = marketFor(position.symbol);
          const current = Number(position.side === 'BUY' ? live?.bid : live?.ask);
          const positive = Number(position.pnl) >= 0;
          return (
            <article key={position.id} className="overflow-hidden rounded-[18px] border border-[#172b3a] bg-[#08131c]">
              <button type="button" onClick={() => setExpandedId(expanded ? null : position.id)} className="w-full px-3.5 py-3 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><strong className="text-[13px] font-black text-[#f1f5f8]">{symbolLabel(position.symbol)}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${sideTone(position.side)}`}>{String(position.side).toUpperCase()} · {Number(position.volume).toFixed(2)}</span></div>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[9px] text-[#72869a]"><span>{price(position.entry, position.symbol)}</span><span className="text-[#354c60]">→</span><span className="text-[#afbdc9]">{price(current, position.symbol)}</span></div>
                  </div>
                  <div className="flex items-start gap-2"><div className="text-right"><b className={`block text-[15px] font-black ${positive ? 'text-[#42d8a5]' : 'text-[#ff6d79]'}`}>{money(position.pnl, position.pnlCurrency || currency, true)}</b><span className="mt-1 block text-[8px] text-[#5d7286]">P&amp;L</span></div>{expanded ? <ChevronUp size={15} className="mt-1 text-[#6e8498]"/> : <ChevronDown size={15} className="mt-1 text-[#6e8498]"/>}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2"><MiniMetric label="SL" value={price(position.sl, position.symbol)} /><MiniMetric label="TP" value={price(position.tp, position.symbol)} /></div>
              </button>

              {expanded && <div className="border-t border-[#152938] bg-[#07111a] px-3.5 pb-3.5 pt-3">
                <div className="grid grid-cols-2 gap-x-5 gap-y-3"><Metric label="Opened" value={position.openedAt || '—'} /><Metric label="Ticket" value={`#${String(position.id).slice(-8)}`} /><Metric label="Swap" value={money(position.swap || 0, position.pnlCurrency || currency)} /><Metric label="Source" value={String(position.source || 'market').replace('-', ' ')} /></div>
                <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onOpenChart(position.symbol)} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#21445b] bg-[#0c2230] text-[9px] font-bold text-[#63cbff]"><ExternalLink size={13}/>View on chart</button><button type="button" onClick={() => onClosePosition(position.id, 100)} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#562c35] bg-[#251319] text-[9px] font-bold text-[#ff7a85]"><X size={13}/>Close position</button></div>
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
          return <article key={order.id} className="rounded-[17px] border border-[#172b3a] bg-[#08131c] px-3.5 py-3"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong className="text-[12px] font-black text-[#eff4f8]">{symbolLabel(order.symbol)}</strong><span className={`rounded-md px-1.5 py-1 text-[7px] font-black ${sideTone(side)}`}>{side} {String(order.orderType || 'order').toUpperCase()}</span></div><p className="mt-2 text-[9px] text-[#71859a]">{Number(order.lots || order.manualLots || 0).toFixed(2)} lots · Entry <b className="font-mono text-[#c1ccd6]">{price(order.entry, order.symbol)}</b></p><div className="mt-2 flex gap-3 text-[8px] text-[#60758a]"><span>SL <b className="text-[#9eb0bf]">{price(order.sl, order.symbol)}</b></span><span>TP <b className="text-[#9eb0bf]">{price(order.tp, order.symbol)}</b></span></div></div><button type="button" className="grid size-8 place-items-center rounded-lg border border-[#1a3040] bg-[#0b1822] text-[#74899d]"><MoreHorizontal size={15}/></button></div><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => onOpenChart(order.symbol)} className="h-9 rounded-xl border border-[#1b3c51] bg-[#0b1f2c] text-[8px] font-bold text-[#5fc9ff]">Chart</button><button type="button" onClick={() => onModifyPending(order.id)} className="h-9 rounded-xl border border-[#263745] bg-[#0b1720] text-[8px] font-bold text-[#b5c3ce]">Modify</button><button type="button" onClick={() => onCancelPending(order.id)} className="h-9 rounded-xl border border-[#512b34] bg-[#211218] text-[8px] font-bold text-[#ff7984]">Cancel</button></div></article>;
        })}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="min-w-0"><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5d7287]">{label}</span><b className="mt-1 block truncate text-[10px] font-semibold capitalize text-[#cbd6df]">{value}</b></div>;
}

function MiniMetric({ label, value }) {
  return <div className="flex items-center justify-between rounded-xl border border-[#152938] bg-[#0a161f] px-2.5 py-2"><span className="text-[7px] font-bold text-[#5e7488]">{label}</span><b className="font-mono text-[9px] text-[#b9c6d1]">{value}</b></div>;
}

function EmptyState({ title, subtitle, compact = false }) {
  return <div className={`grid place-items-center rounded-[18px] border border-dashed border-[#1a3040] bg-[#07121a] text-center ${compact ? 'h-[92px]' : 'h-[118px]'}`}><div><b className="text-[10px] text-[#9eafbe]">{title}</b><p className="mt-1 text-[8px] text-[#5d7185]">{subtitle}</p></div></div>;
}
