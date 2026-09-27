import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Clock } from 'lucide-react';
import { formatInstrumentPrice, instrumentForSymbol } from '../../utils/instrumentFormatting.js';

const HISTORY_PERIOD_KEY = 'acg-mobile-history-period-v1';
const ACTIVE_ORDER_STATUSES = new Set(['PENDING', 'ACCEPTED', 'TRIGGERED']);

const PERIODS = [
  ['today', 'Today'],
  ['week', 'Last week'],
  ['month', 'Last month'],
  ['3months', 'Last 3 months'],
  ['6months', 'Last 6 months'],
  ['year', 'Last year'],
  ['custom', 'Custom'],
];

function symbolLabel(symbol = '') {
  const normalized = String(symbol || '').toUpperCase();
  if (normalized.includes('/')) return normalized;
  return /^[A-Z]{6}$/.test(normalized) ? `${normalized.slice(0, 3)}/${normalized.slice(3)}` : normalized;
}

function compactLots(value) {
  const number = Math.abs(Number(value));
  if (!Number.isFinite(number)) return '—';
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function accountNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const sign = number < 0 ? '-' : '';
  const [whole, decimals] = Math.abs(number).toFixed(2).split('.');
  return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${decimals}`;
}

function pnlNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const sign = number > 0 ? '+' : number < 0 ? '-' : '';
  return `${sign}${accountNumber(Math.abs(number))}`;
}

function sideClass(side) {
  return String(side || '').toUpperCase() === 'BUY' ? 'text-[#2f83ff]' : 'text-[#ef5c67]';
}

function pnlClass(value) {
  const number = Number(value);
  return number > 0 ? 'text-[#35cfa2]' : number < 0 ? 'text-[#ff6675]' : 'text-[#d3dae2]';
}

function eventDate(item) {
  return item?.closedAtIso
    || item?.executedAt
    || item?.filledAt
    || item?.cancelledAt
    || item?.expiredAt
    || item?.rejectedAt
    || item?.updatedAt
    || item?.createdAt
    || item?.receivedAt
    || item?.raw?.closedAt
    || item?.raw?.executedAt
    || null;
}

function dateValue(item) {
  const value = eventDate(item);
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function compactDateTime(item) {
  const date = dateValue(item);
  if (!date) {
    const fallback = String(item?.closedAt || item?.openedAt || '').trim();
    return fallback && fallback !== '—' ? fallback : '—';
  }
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();
  const datePart = date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
  const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} · ${timePart}`;
}

function orderTypeLabel(order) {
  const type = String(order?.orderType || order?.type || 'order').replaceAll('_', ' ').replaceAll('-', ' ').toLowerCase();
  if (type === 'limit') return 'limit';
  if (type === 'stop') return 'stop';
  if (type === 'stop limit') return 'stop limit';
  if (type === 'market') return '';
  return type;
}

function orderEntry(order) {
  const values = [order?.entry, order?.limitPrice, order?.stopPrice, order?.requestedPrice, order?.acceptedPrice];
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function normalizedStatus(order) {
  return String(order?.status || '').toUpperCase();
}

function periodStart(period, now = new Date()) {
  const start = new Date(now);
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const days = period === 'week' ? 7
    : period === 'month' ? 30
      : period === '3months' ? 90
        : period === '6months' ? 180
          : period === 'year' ? 365
            : null;
  return days == null ? null : new Date(now.getTime() - days * 86400000);
}

function matchesPeriod(item, period, customStart, customEnd) {
  const date = dateValue(item);
  if (!date) return false;
  if (period === 'custom') {
    const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
    const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
    if (start && !Number.isNaN(start.getTime()) && date < start) return false;
    if (end && !Number.isNaN(end.getTime()) && date > end) return false;
    return true;
  }
  const start = periodStart(period);
  return start ? date >= start : true;
}

function initialPeriod() {
  if (typeof window === 'undefined') return '6months';
  const stored = window.localStorage.getItem(HISTORY_PERIOD_KEY);
  return PERIODS.some(([id]) => id === stored) ? stored : '6months';
}

function statusLabel(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'Cancelled';
  if (normalized === 'REJECTED') return 'Rejected';
  if (normalized === 'EXPIRED') return 'Expired';
  if (normalized === 'FILLED' || normalized === 'EXECUTED') return 'Filled';
  return normalized ? normalized.charAt(0) + normalized.slice(1).toLowerCase() : 'Completed';
}

function statusClass(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'REJECTED') return 'text-[#e96a75]';
  if (normalized === 'EXPIRED') return 'text-[#9aa6b2]';
  return 'text-[#5a9cff]';
}

export default function MobileTradesSheet({
  onClose = () => {},
  account = {},
  positions = [],
  pendingOrders = [],
  positionHistory = [],
  historyOrders = [],
  historyLoaded = false,
  markets = [],
  onOpenChart = () => {},
  onSelectPosition = () => {},
  onModifyPending = () => {},
  initialTab = 'open',
  readOnly = false,
}) {
  const [tab, setTab] = useState(initialTab === 'history' || readOnly ? 'history' : 'trade');
  const [period, setPeriod] = useState(initialPeriod);
  const [symbolFilter, setSymbolFilter] = useState('All symbols');
  const [filterOpen, setFilterOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(HISTORY_PERIOD_KEY, period);
  }, [period]);

  const floatingPnl = Number(account?.floatingPnl);
  const floating = Number.isFinite(floatingPnl) ? floatingPnl : 0;

  const marketFor = symbol => instrumentForSymbol(markets, symbol);
  const price = (value, symbol) => formatInstrumentPrice(value, marketFor(symbol));

  const inactiveOrderHistory = useMemo(() => {
    const source = Array.isArray(historyOrders) ? historyOrders : [];
    return source.filter(order => {
      const status = normalizedStatus(order);
      if (!status || ACTIVE_ORDER_STATUSES.has(status)) return false;
      return ['CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(status);
    });
  }, [historyOrders]);

  const symbols = useMemo(() => {
    return [...new Set([
      ...positionHistory.map(item => item?.symbol),
      ...inactiveOrderHistory.map(item => item?.symbol),
    ].filter(Boolean))].sort();
  }, [inactiveOrderHistory, positionHistory]);

  const historyRows = useMemo(() => {
    const closed = positionHistory.map(position => ({
      key: `position:${position.id}`,
      kind: 'position',
      item: position,
      timestamp: dateValue(position)?.getTime() || 0,
    }));
    const orderEvents = inactiveOrderHistory.map(order => ({
      key: `order:${order.id}`,
      kind: 'order',
      item: order,
      timestamp: dateValue(order)?.getTime() || 0,
    }));
    return [...closed, ...orderEvents]
      .filter(row => (symbolFilter === 'All symbols' || row.item?.symbol === symbolFilter)
        && matchesPeriod(row.item, period, customStart, customEnd))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [customEnd, customStart, inactiveOrderHistory, period, positionHistory, symbolFilter]);

  const historyStats = useMemo(() => {
    return historyRows.reduce((summary, row) => {
      if (row.kind !== 'position') return summary;
      summary.profit += Number(row.item?.pnl) || 0;
      summary.swap += Number(row.item?.swap) || 0;
      summary.commission += Number(row.item?.commission) || 0;
      return summary;
    }, { profit: 0, swap: 0, commission: 0 });
  }, [historyRows]);

  const openPosition = position => {
    onSelectPosition(position?.id);
    onOpenChart(position?.symbol);
  };

  const openPending = order => {
    if (order?.id) onModifyPending(order.id);
    else onOpenChart(order?.symbol);
  };

  return (
    <section className="fixed inset-0 z-[110] flex h-dvh w-full min-h-0 flex-col overflow-hidden bg-[#050505] text-[#f4f7fa]">
      <header className="shrink-0 border-b border-white/[0.07] bg-[#070707] pt-[env(safe-area-inset-top)]">
        <div className="grid min-h-[58px] grid-cols-[44px_minmax(0,1fr)_74px] items-center px-2">
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-lg text-[#c6ced7] active:bg-white/[0.05]"
            aria-label="Back to chart"
          >
            <ChevronLeft size={21} strokeWidth={2}/>
          </button>

          <div className="flex h-full items-end justify-center gap-7">
            <button
              type="button"
              onClick={() => !readOnly && setTab('trade')}
              disabled={readOnly}
              className={`relative flex h-full items-center px-1 text-[15px] font-semibold tracking-[-0.02em] ${tab === 'trade' ? 'text-[#f4f7fa]' : 'text-[#7f8994]'} disabled:opacity-35`}
            >
              Trade
              {tab === 'trade' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#195be1]"/>}
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`relative flex h-full items-center px-1 text-[15px] font-semibold tracking-[-0.02em] ${tab === 'history' ? 'text-[#f4f7fa]' : 'text-[#7f8994]'}`}
            >
              History
              {tab === 'history' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#195be1]"/>}
            </button>
          </div>

          {tab === 'trade' ? (
            <div className="min-w-0 pr-1 text-right">
              <span className="block text-[8px] font-medium uppercase tracking-[0.08em] text-[#77838f]">P&amp;L</span>
              <strong className={`mt-1 block truncate font-mono text-[16px] font-semibold leading-none tabular-nums ${pnlClass(floating)}`}>
                {pnlNumber(floating)}
              </strong>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="ml-auto grid size-10 place-items-center rounded-lg text-[#d8e0e7] active:bg-white/[0.05]"
              aria-label="Filter history by symbol and period"
            >
              <Clock size={19} strokeWidth={1.9}/>
            </button>
          )}
        </div>
      </header>

      {readOnly && (
        <div className="shrink-0 border-b border-rose-400/[0.10] bg-rose-400/[0.04] px-3 py-2 text-[9px] font-medium text-[#b58f94]">
          Read-only account · completed trading records remain available.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(14px,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tab === 'trade' && (
          <>
            <div className="border-b border-white/[0.07] py-3">
              <AccountMetric label="Balance" value={accountNumber(account?.balance)} />
              <AccountMetric label="Equity" value={accountNumber(account?.equity)} />
              <AccountMetric label="Free Margin" value={accountNumber(account?.freeMargin)} />
            </div>

            <div className="pb-1 pt-3 text-[12px] font-semibold text-[#aeb8c2]">Positions</div>

            <div>
              {!positions.length && (
                <div className="border-b border-white/[0.06] py-5 text-[11px] text-[#66727e]">No open positions</div>
              )}

              {positions.map(position => {
                const side = String(position?.side || '').toUpperCase();
                const current = Number(position?.closePrice);
                const fallbackCurrent = Number(marketFor(position?.symbol)?.[side === 'BUY' ? 'bid' : 'ask']);
                const currentPrice = Number.isFinite(current) ? current : fallbackCurrent;
                return (
                  <button
                    key={position.id}
                    type="button"
                    onClick={() => openPosition(position)}
                    className="block w-full border-b border-white/[0.06] py-2.5 text-left active:bg-white/[0.025]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 truncate text-[14px] leading-5">
                        <strong className="font-semibold text-[#f0f3f6]">{symbolLabel(position.symbol)}</strong>
                        <span className={`ml-1.5 font-medium ${sideClass(side)}`}>{side.toLowerCase()}</span>
                        <span className="ml-1.5 text-[#c5ccd4]">{compactLots(position.volume)}</span>
                      </div>
                      <strong className={`shrink-0 font-mono text-[16px] font-semibold tabular-nums tracking-[-0.02em] ${pnlClass(position.pnl)}`}>
                        {pnlNumber(position.pnl)}
                      </strong>
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] tabular-nums text-[#7d8894]">
                      {price(position.entry, position.symbol)} <span className="px-1 text-[#5e6974]">→</span> {price(currentPrice, position.symbol)}
                    </div>
                  </button>
                );
              })}

              {pendingOrders.length > 0 && <div className="mt-2 border-t border-white/[0.09]"/>}

              {pendingOrders.map(order => {
                const side = String(order?.side || '').toUpperCase();
                const type = orderTypeLabel(order);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => openPending(order)}
                    className="block w-full border-b border-white/[0.06] py-2.5 text-left active:bg-white/[0.025]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 truncate text-[14px] leading-5">
                        <strong className="font-semibold text-[#f0f3f6]">{symbolLabel(order.symbol)}</strong>
                        <span className={`ml-1.5 font-medium ${sideClass(side)}`}>{side.toLowerCase()}</span>
                        {type && <span className={`ml-1 ${sideClass(side)}`}>{type}</span>}
                        <span className="ml-1.5 text-[#c5ccd4]">{compactLots(order.volume ?? order.lots)}</span>
                      </div>
                      <span className="shrink-0 text-[13px] font-medium text-[#929da8]">Pending</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] tabular-nums text-[#7d8894]">
                      {price(orderEntry(order), order.symbol)}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === 'history' && (
          <>
            <div className="pt-1">
              {!historyRows.length && (
                <div className="py-8 text-center text-[11px] text-[#687580]">
                  {!historyLoaded && !positionHistory.length ? 'Loading history…' : 'No history for this period'}
                </div>
              )}

              {historyRows.map(row => {
                if (row.kind === 'position') {
                  const position = row.item;
                  const side = String(position?.side || '').toUpperCase();
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => onOpenChart(position.symbol)}
                      className="block w-full border-b border-white/[0.06] py-2.5 text-left active:bg-white/[0.025]"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] leading-5">
                            <strong className="font-semibold text-[#f0f3f6]">{symbolLabel(position.symbol)}</strong>
                            <span className={`ml-1.5 font-medium ${sideClass(side)}`}>{side.toLowerCase()}</span>
                            <span className="ml-1.5 text-[#c5ccd4]">{compactLots(position.volume)}</span>
                          </div>
                          <div className="mt-0.5 font-mono text-[12px] tabular-nums text-[#7d8894]">
                            {price(position.entry, position.symbol)} <span className="px-1 text-[#5e6974]">→</span> {price(position.closePrice, position.symbol)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="whitespace-nowrap text-[11px] font-medium tabular-nums text-[#7c8793]">{compactDateTime(position)}</div>
                          <strong className={`mt-1 block font-mono text-[16px] font-semibold leading-none tabular-nums ${pnlClass(position.pnl)}`}>
                            {pnlNumber(position.pnl)}
                          </strong>
                        </div>
                      </div>
                    </button>
                  );
                }

                const order = row.item;
                const side = String(order?.side || '').toUpperCase();
                const status = normalizedStatus(order);
                const type = orderTypeLabel(order);
                return (
                  <div key={row.key} className="border-b border-white/[0.06] py-2.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] leading-5">
                          <strong className="font-semibold text-[#f0f3f6]">{symbolLabel(order.symbol)}</strong>
                          <span className={`ml-1.5 font-medium ${sideClass(side)}`}>{side.toLowerCase()}</span>
                          {type && <span className={`ml-1 ${sideClass(side)}`}>{type}</span>}
                          <span className="ml-1.5 text-[#c5ccd4]">{compactLots(order.requestedVolume ?? order.volume)}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-[12px] tabular-nums text-[#7d8894]">
                          {price(orderEntry(order), order.symbol)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="whitespace-nowrap text-[11px] font-medium tabular-nums text-[#7c8793]">{compactDateTime(order)}</div>
                        <span className={`mt-1 block text-[13px] font-medium ${statusClass(status)}`}>{statusLabel(status)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 border-t border-white/[0.08] py-3">
              <SummaryMetric label="Profit" value={pnlNumber(historyStats.profit)} valueClass={pnlClass(historyStats.profit)} />
              <SummaryMetric label="Swap" value={pnlNumber(historyStats.swap)} />
              <SummaryMetric label="Commission" value={pnlNumber(historyStats.commission)} />
            </div>
          </>
        )}
      </div>

      {filterOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-[#050505] pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 shrink-0 items-center border-b border-white/[0.07] px-2">
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="grid size-10 place-items-center rounded-lg text-[#c6ced7] active:bg-white/[0.05]"
              aria-label="Back to history"
            >
              <ChevronLeft size={21} strokeWidth={2}/>
            </button>
            <h3 className="ml-2 text-[16px] font-semibold text-[#f3f6f8]">History</h3>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <label className="flex h-12 items-center justify-between border-b border-white/[0.07] text-[14px]">
              <span className="text-[#e4e9ee]">Symbol:</span>
              <select
                value={symbolFilter}
                onChange={event => setSymbolFilter(event.target.value)}
                className="max-w-[58%] bg-transparent text-right text-[14px] text-[#9aa5b0] outline-none"
              >
                <option className="bg-[#0a0a0a]" value="All symbols">All symbols</option>
                {symbols.map(symbol => <option className="bg-[#0a0a0a]" key={symbol} value={symbol}>{symbolLabel(symbol)}</option>)}
              </select>
            </label>

            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-[#080808]">
              {PERIODS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPeriod(id);
                    if (id !== 'custom') setFilterOpen(false);
                  }}
                  className="flex h-12 w-full items-center justify-between border-b border-white/[0.07] px-3 text-left text-[14px] text-[#e1e6eb] last:border-b-0 active:bg-white/[0.035]"
                >
                  <span>{label}</span>
                  {period === id && <Check size={17} className="text-[#2f83ff]" strokeWidth={2.3}/>}
                </button>
              ))}
            </div>

            {period === 'custom' && (
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#080808] p-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-medium text-[#7d8995]">
                    From
                    <input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/[0.08] bg-black px-2 text-[12px] text-[#dce3e9] outline-none"/>
                  </label>
                  <label className="text-[10px] font-medium text-[#7d8995]">
                    To
                    <input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/[0.08] bg-black px-2 text-[12px] text-[#dce3e9] outline-none"/>
                  </label>
                </div>
                <button type="button" onClick={() => setFilterOpen(false)} className="mt-3 h-10 w-full rounded-lg bg-[#195be1] text-[12px] font-semibold text-white">Apply</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AccountMetric({ label, value }) {
  return (
    <div className="flex h-7 items-center justify-between text-[13px]">
      <span className="text-[#b5bec7]">{label}</span>
      <span className="font-mono font-medium tabular-nums text-[#eef2f5]">{value}</span>
    </div>
  );
}

function SummaryMetric({ label, value, valueClass = 'text-[#d7dde3]' }) {
  return (
    <div className="flex h-7 items-center justify-between text-[13px]">
      <span className="text-[#b2bbc4]">{label}</span>
      <span className={`font-mono font-medium tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
