import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Clock, X } from 'lucide-react';
import { formatInstrumentPrice, instrumentForSymbol } from '../../utils/instrumentFormatting.js';
import { positionCloseAvailability } from '../../utils/marketExecutionAvailability.js';

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

const HISTORY_KINDS = [
  ['all', 'All'],
  ['position', 'Closed'],
  ['order', 'Orders'],
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

function costNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? accountNumber(number) : '—';
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

function openedDate(item) {
  const value = item?.openedAtIso
    || item?.raw?.openedAt
    || item?.raw?.createdAt
    || item?.openTime
    || item?.createdAt
    || item?.openedAt
    || null;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function dateValue(item) {
  const value = eventDate(item);
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();
  const datePart = date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
  const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${datePart} · ${timePart}`;
}

function compactDateTime(item) {
  const date = dateValue(item);
  if (!date) {
    const fallback = String(item?.closedAt || item?.openedAt || '').trim();
    return fallback && fallback !== '—' ? fallback : '—';
  }
  return formatDate(date).replace(/:\d{2}$/, '');
}

function durationLabel(start, end) {
  if (!start || !end) return '—';
  const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
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

function protectionValue(value, formatter) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? formatter(number) : 'Not set';
}

function toProtectionInput(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : '';
}

function parseProtectionInput(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : NaN;
}

function idValue(item) {
  return item?.positionId || item?.orderId || item?.ticket || item?.id || item?.raw?.id || '—';
}

function humanizeValue(value, fallback = '—') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function canPartialClose(position, percentage, instrument) {
  const percent = Number(percentage);
  if (!Number.isFinite(percent) || percent >= 100) return true;
  const openVolume = Number(position?.volume ?? position?.openVolume ?? position?.lots);
  const step = Math.max(Number(position?.volumeStep || instrument?.volumeStep) || 0.01, 0.00000001);
  const minimum = Math.max(Number(instrument?.minVolume) || step, step);
  if (!Number.isFinite(openVolume) || openVolume <= 0) return false;
  const units = Math.floor(((openVolume * percent / 100) + step * 1e-8) / step);
  const closing = units * step;
  const remaining = openVolume - closing;
  return closing >= minimum - step * 1e-8
    && closing < openVolume - step * 1e-8
    && (remaining <= step * 1e-8 || remaining >= minimum - step * 1e-8);
}

function DetailRow({ label, value, valueClass = 'text-[#e3e8ed]', mono = true }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-white/[0.055] py-2 last:border-b-0">
      <span className="shrink-0 text-[11px] text-[#7f8a95]">{label}</span>
      <span className={`min-w-0 break-all text-right text-[12px] font-medium ${mono ? 'font-mono tabular-nums' : ''} ${valueClass}`}>{value}</span>
    </div>
  );
}

function ActionButton({ children, onClick, tone = 'default', disabled = false }) {
  const toneClass = tone === 'danger'
    ? 'border-[#652832] bg-[#19090c] text-[#ff6976]'
    : tone === 'primary'
      ? 'border-[#195be1] bg-[#0b1732] text-[#7aa5ff]'
      : tone === 'success'
        ? 'border-[#205846] bg-[#071710] text-[#4bd6a4]'
        : 'border-white/[0.09] bg-[#0b0c0e] text-[#d5dce3]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-10 w-full rounded-lg border px-3 text-[11px] font-semibold active:opacity-75 disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function DetailHeader({ title, subtitle, onBack }) {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-white/[0.07] px-2">
      <button type="button" onClick={onBack} className="grid size-10 place-items-center rounded-lg text-[#c6ced7] active:bg-white/[0.05]" aria-label="Back">
        <ChevronLeft size={21} strokeWidth={2}/>
      </button>
      <div className="min-w-0 text-center">
        <h3 className="truncate text-[15px] font-semibold text-[#f2f5f7]">{title}</h3>
        {subtitle && <div className="mt-0.5 truncate text-[9px] text-[#707c87]">{subtitle}</div>}
      </div>
      <div />
    </div>
  );
}

export default function MobileTradesSheet({
  auditMobile = false,
  onClose = () => {},
  account = {},
  positions = [],
  pendingOrders = [],
  positionHistory = [],
  historyOrders = [],
  historyLoaded = false,
  markets = [],
  onOpenChart = () => {},
  onViewClosedPositionChart = () => {},
  onEditPositionOnChart = () => {},
  onSelectPosition = () => {},
  onClosePosition = async () => false,
  onCancelPending = async () => {},
  onModifyPending = () => {},
  onUpdatePosition = async () => false,
  onBreakEven = async () => false,
  onNotice = () => {},
  initialTab = 'open',
  readOnly = false,
}) {
  const [tab, setTab] = useState(initialTab === 'history' || readOnly ? 'history' : 'trade');
  const [period, setPeriod] = useState(initialPeriod);
  const [historyKind, setHistoryKind] = useState('all');
  const [symbolFilter, setSymbolFilter] = useState('All symbols');
  const [filterOpen, setFilterOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailMode, setDetailMode] = useState(null);
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(HISTORY_PERIOD_KEY, period);
  }, [period]);

  useEffect(() => {
    setDetail(null);
    setDetailMode(null);
  }, [tab]);

  const floatingPnl = Number(account?.floatingPnl);
  const floating = Number.isFinite(floatingPnl) ? floatingPnl : 0;
  const currency = String(account?.currency || 'USD').toUpperCase();

  const marketFor = symbol => instrumentForSymbol(markets, symbol);
  const price = (value, symbol) => formatInstrumentPrice(value, marketFor(symbol));

  const inactiveOrderHistory = useMemo(() => {
    const source = Array.isArray(historyOrders) ? historyOrders : [];
    return source.filter(order => {
      const status = normalizedStatus(order);
      return Boolean(status) && !ACTIVE_ORDER_STATUSES.has(status);
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
      .filter(row => (historyKind === 'all' || row.kind === historyKind)
        && (symbolFilter === 'All symbols' || row.item?.symbol === symbolFilter)
        && matchesPeriod(row.item, period, customStart, customEnd))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [customEnd, customStart, historyKind, inactiveOrderHistory, period, positionHistory, symbolFilter]);

  const historyStats = useMemo(() => {
    return historyRows.reduce((summary, row) => {
      if (row.kind !== 'position') return summary;
      summary.profit += Number(row.item?.pnl) || 0;
      summary.swap += Number(row.item?.swap) || 0;
      summary.commission += Number(row.item?.commission) || 0;
      return summary;
    }, { profit: 0, swap: 0, commission: 0 });
  }, [historyRows]);

  const detailItem = useMemo(() => {
    if (!detail) return null;
    const sameId = item => String(idValue(item)) === String(detail.id);
    if (detail.kind === 'open-position') return positions.find(sameId) || null;
    if (detail.kind === 'pending-order') return pendingOrders.find(sameId) || null;
    if (detail.kind === 'history-position') return positionHistory.find(sameId) || null;
    if (detail.kind === 'history-order') return inactiveOrderHistory.find(sameId) || null;
    return null;
  }, [detail, inactiveOrderHistory, pendingOrders, positionHistory, positions]);

  useEffect(() => {
    if (detail && !detailItem) {
      setDetail(null);
      setDetailMode(null);
    }
  }, [detail, detailItem]);

  const showDetail = (kind, item) => {
    setDetail({ kind, id: idValue(item) });
    setDetailMode(null);
    setBusy(false);
  };

  const beginModify = position => {
    setSlInput(toProtectionInput(position?.sl));
    setTpInput(toProtectionInput(position?.tp));
    setDetailMode('modify');
  };

  const applyModify = async position => {
    const sl = parseProtectionInput(slInput);
    const tp = parseProtectionInput(tpInput);
    if (Number.isNaN(sl) || Number.isNaN(tp)) {
      onNotice('Enter a valid SL/TP price, or leave the field empty to remove it');
      return;
    }
    const side = String(position?.side || '').toUpperCase();
    const entry = Number(position?.entry ?? position?.entryPrice);
    if (side === 'BUY' && ((sl != null && sl >= entry) || (tp != null && tp <= entry))) {
      onNotice('For a BUY position, SL must be below entry and TP above entry');
      return;
    }
    if (side === 'SELL' && ((sl != null && sl <= entry) || (tp != null && tp >= entry))) {
      onNotice('For a SELL position, SL must be above entry and TP below entry');
      return;
    }
    setBusy(true);
    try {
      const saved = await onUpdatePosition(position.id, { sl, tp });
      if (saved !== false) setDetailMode(null);
    } finally {
      setBusy(false);
    }
  };

  const runClose = async (position, percentage) => {
    const availability = positionCloseAvailability(marketFor(position?.symbol));
    if (!availability.allowed) return false;
    setBusy(true);
    try {
      const closed = await onClosePosition(position.id, percentage);
      if (closed && Number(percentage) >= 100) {
        setDetail(null);
        setDetailMode(null);
      } else if (closed) {
        setDetailMode(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const runBreakEven = async position => {
    setBusy(true);
    try {
      await onBreakEven(position.id);
    } finally {
      setBusy(false);
    }
  };

  const runCancelPending = async order => {
    setBusy(true);
    try {
      const cancelled = await onCancelPending(order.id);
      if (cancelled !== false) setDetail(null);
    } finally {
      setBusy(false);
    }
  };

  const openChart = item => onOpenChart(item?.symbol);
  const editOnChart = position => {
    onSelectPosition(position?.id);
    onEditPositionOnChart(position);
  };

  const renderOpenPositionDetail = position => {
    const side = String(position?.side || '').toUpperCase();
    const market = marketFor(position?.symbol);
    const closeAvailability = positionCloseAvailability(market);
    const closeDisabled = !closeAvailability.allowed;
    const closePrice = Number(position?.closePrice);
    const fallbackCurrent = Number(market?.[side === 'BUY' ? 'bid' : 'ask']);
    const currentPrice = Number.isFinite(closePrice) ? closePrice : fallbackCurrent;
    const opened = openedDate(position);
    const pnlCurrency = String(position?.pnlCurrency || currency).toUpperCase();
    const partialCloseAvailable = [25, 50, 75].some(value => canPartialClose(position, value, market));

    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#050505] pt-[env(safe-area-inset-top)]">
        <DetailHeader title={symbolLabel(position.symbol)} subtitle={`${side} · ${compactLots(position.volume ?? position.lots)} lot`} onBack={() => { setDetail(null); setDetailMode(null); }} />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="py-4 text-center">
            <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#707b86]">Live P&amp;L · {pnlCurrency}</div>
            <div className={`mt-2 font-mono text-[30px] font-semibold leading-none tabular-nums ${pnlClass(position.pnl)}`}>{pnlNumber(position.pnl)}</div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#08090a] px-3">
            <DetailRow label="Entry" value={price(position.entry ?? position.entryPrice, position.symbol)} />
            <DetailRow label="Current" value={price(currentPrice, position.symbol)} />
            <DetailRow label="Stop loss" value={protectionValue(position.sl, value => price(value, position.symbol))} valueClass={Number(position.sl) > 0 ? 'text-[#ff727d]' : 'text-[#78838e]'} />
            <DetailRow label="Take profit" value={protectionValue(position.tp, value => price(value, position.symbol))} valueClass={Number(position.tp) > 0 ? 'text-[#45d6a2]' : 'text-[#78838e]'} />
            <DetailRow label={`Commission (${pnlCurrency})`} value={costNumber(position.commission)} />
            <DetailRow label={`Swap (${pnlCurrency})`} value={costNumber(position.swap)} />
            <DetailRow label={`Margin (${currency})`} value={costNumber(position.margin)} />
            <DetailRow label="Opened" value={formatDate(opened)} />
            <DetailRow label="Position ID" value={idValue(position)} valueClass="text-[#9fa9b3]" />
          </div>

          {detailMode === 'modify' && (
            <div className="mt-3 rounded-xl border border-[#195be1]/35 bg-[#07101f] p-3">
              <div className="text-[11px] font-semibold text-[#dce6f4]">Modify protection</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[9px] font-medium text-[#8b97a3]">
                  Stop loss
                  <div className="mt-1 flex h-11 items-center rounded-lg border border-white/[0.09] bg-black px-2">
                    <input value={slInput} onChange={event => setSlInput(event.target.value)} inputMode="decimal" placeholder="Not set" className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-[#f0f3f6] outline-none"/>
                    {slInput && <button type="button" onClick={() => setSlInput('')} className="grid size-7 place-items-center text-[#7e8994]" aria-label="Remove stop loss"><X size={14}/></button>}
                  </div>
                </label>
                <label className="text-[9px] font-medium text-[#8b97a3]">
                  Take profit
                  <div className="mt-1 flex h-11 items-center rounded-lg border border-white/[0.09] bg-black px-2">
                    <input value={tpInput} onChange={event => setTpInput(event.target.value)} inputMode="decimal" placeholder="Not set" className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-[#f0f3f6] outline-none"/>
                    {tpInput && <button type="button" onClick={() => setTpInput('')} className="grid size-7 place-items-center text-[#7e8994]" aria-label="Remove take profit"><X size={14}/></button>}
                  </div>
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ActionButton onClick={() => setDetailMode(null)} disabled={busy}>Cancel</ActionButton>
                <ActionButton onClick={() => void applyModify(position)} tone="primary" disabled={busy}>{busy ? 'Saving…' : 'Apply'}</ActionButton>
              </div>
            </div>
          )}

          {closeDisabled && (
            <div className="mt-3 rounded-lg border border-white/[0.07] bg-[#0b0c0e] px-3 py-2 text-[9px] font-medium text-[#7f8a95]">
              {closeAvailability.reason}
            </div>
          )}

          {detailMode === 'close' && (
            <div className="mt-3 rounded-xl border border-[#652832]/55 bg-[#16080b] p-3">
              <div className="text-[11px] font-semibold text-[#f0d9dc]">Close position</div>
              <div className="mt-1 text-[9px] text-[#8f777c]">{closeDisabled ? closeAvailability.reason : 'Choose how much of the current position to close.'}</div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map(value => {
                  const allowed = canPartialClose(position, value, marketFor(position.symbol));
                  return (
                  <button key={value} type="button" disabled={busy || !allowed || closeDisabled} title={closeDisabled ? closeAvailability.reason : undefined} onClick={() => void runClose(position, value)} className={`h-10 rounded-lg border text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-25 ${value === 100 ? 'border-[#7b2b37] bg-[#270c11] text-[#ff6976]' : 'border-white/[0.09] bg-[#0b0c0e] text-[#d5dce3]'}`}>
                    {value === 100 ? 'Full' : `${value}%`}
                  </button>
                  );
                })}
              </div>
              {!partialCloseAvailable && <div className="mt-2 text-center text-[8px] text-[#8f777c]">This lot size cannot be partially closed without going below the instrument minimum.</div>}
              <button type="button" disabled={busy} onClick={() => setDetailMode(null)} className="mt-2 h-9 w-full rounded-lg text-[10px] font-semibold text-[#8c97a2] disabled:opacity-40">Cancel</button>
            </div>
          )}

          {!readOnly && !detailMode && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ActionButton onClick={() => setDetailMode('close')} tone="danger" disabled={closeDisabled}>{closeDisabled ? 'Market closed' : 'Close / Partial'}</ActionButton>
                <ActionButton onClick={() => beginModify(position)} tone="primary">Modify SL/TP</ActionButton>
                <ActionButton onClick={() => void runBreakEven(position)} disabled={busy}>Break Even</ActionButton>
                <ActionButton onClick={() => editOnChart(position)} tone="success">Edit on Chart</ActionButton>
              </div>
              <button type="button" onClick={() => { onSelectPosition(position.id); openChart(position); }} className="mt-2 h-10 w-full rounded-lg text-[10px] font-semibold text-[#7f8b97] active:bg-white/[0.035]">Open chart without editing</button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderPendingDetail = order => {
    const side = String(order?.side || '').toUpperCase();
    const type = orderTypeLabel(order);
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#050505] pt-[env(safe-area-inset-top)]">
        <DetailHeader title={symbolLabel(order.symbol)} subtitle={`${side} ${type || 'order'} · ${compactLots(order.volume ?? order.lots)} lot`} onBack={() => setDetail(null)} />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <div className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#08090a] px-3">
            <DetailRow label="Status" value={statusLabel(order.status || 'PENDING')} valueClass={statusClass(order.status || 'PENDING')} mono={false} />
            <DetailRow label="Order type" value={type || 'market'} mono={false} />
            <DetailRow label="Entry / trigger" value={price(orderEntry(order), order.symbol)} />
            <DetailRow label="Stop loss" value={protectionValue(order.stopLoss ?? order.sl, value => price(value, order.symbol))} />
            <DetailRow label="Take profit" value={protectionValue(order.takeProfit ?? order.tp, value => price(value, order.symbol))} />
            <DetailRow label="Created" value={formatDate(openedDate(order))} />
            <DetailRow label="Order ID" value={idValue(order)} valueClass="text-[#9fa9b3]" />
          </div>
          {!readOnly && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <ActionButton onClick={() => onModifyPending(order.id)} tone="primary">Modify</ActionButton>
              <ActionButton onClick={() => void runCancelPending(order)} tone="danger" disabled={busy}>{busy ? 'Cancelling…' : 'Cancel'}</ActionButton>
              <ActionButton onClick={() => openChart(order)}>Chart</ActionButton>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderClosedPositionDetail = position => {
    const side = String(position?.side || '').toUpperCase();
    const opened = openedDate(position);
    const closed = dateValue(position);
    const pnlCurrency = String(position?.pnlCurrency || currency).toUpperCase();
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#050505] pt-[env(safe-area-inset-top)]">
        <DetailHeader title={symbolLabel(position.symbol)} subtitle={`Closed · ${side} · ${compactLots(position.volume ?? position.lots)} lot`} onBack={() => setDetail(null)} />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="py-4 text-center">
            <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#707b86]">Realized P&amp;L · {pnlCurrency}</div>
            <div className={`mt-2 font-mono text-[30px] font-semibold leading-none tabular-nums ${pnlClass(position.pnl)}`}>{pnlNumber(position.pnl)}</div>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#08090a] px-3">
            <DetailRow label="Entry" value={price(position.entry ?? position.entryPrice, position.symbol)} />
            <DetailRow label="Close" value={price(position.closePrice ?? position.exitPrice, position.symbol)} />
            <DetailRow label="Stop loss" value={protectionValue(position.sl, value => price(value, position.symbol))} />
            <DetailRow label="Take profit" value={protectionValue(position.tp, value => price(value, position.symbol))} />
            <DetailRow label={`Commission (${pnlCurrency})`} value={costNumber(position.commission)} />
            <DetailRow label={`Swap (${pnlCurrency})`} value={costNumber(position.swap)} />
            <DetailRow label="Close reason" value={humanizeValue(position.closeType, 'Closed')} mono={false} />
            <DetailRow label="Opened" value={formatDate(opened)} />
            <DetailRow label="Closed" value={formatDate(closed)} />
            <DetailRow label="Duration" value={durationLabel(opened, closed)} />
            <DetailRow label="Position ID" value={idValue(position)} valueClass="text-[#9fa9b3]" />
          </div>
          <div className="mt-3">
            <ActionButton onClick={() => onViewClosedPositionChart(position)} tone="primary">View Chart</ActionButton>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryOrderDetail = order => {
    const side = String(order?.side || '').toUpperCase();
    const status = normalizedStatus(order);
    const type = orderTypeLabel(order);
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#050505] pt-[env(safe-area-inset-top)]">
        <DetailHeader title={symbolLabel(order.symbol)} subtitle={`${statusLabel(status)} · ${side} ${type || 'order'}`} onBack={() => setDetail(null)} />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <div className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#08090a] px-3">
            <DetailRow label="Status" value={statusLabel(status)} valueClass={statusClass(status)} mono={false} />
            <DetailRow label="Order type" value={type || 'market'} mono={false} />
            <DetailRow label="Lots" value={compactLots(order.requestedVolume ?? order.volume ?? order.lots)} />
            <DetailRow label="Entry / trigger" value={price(orderEntry(order), order.symbol)} />
            <DetailRow label="Stop loss" value={protectionValue(order.stopLoss ?? order.sl, value => price(value, order.symbol))} />
            <DetailRow label="Take profit" value={protectionValue(order.takeProfit ?? order.tp, value => price(value, order.symbol))} />
            <DetailRow label="Created" value={formatDate(openedDate(order))} />
            <DetailRow label="Completed" value={formatDate(dateValue(order))} />
            <DetailRow label="Order ID" value={idValue(order)} valueClass="text-[#9fa9b3]" />
          </div>
          <div className="mt-3">
            <ActionButton onClick={() => openChart(order)} tone="primary">View Chart</ActionButton>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section data-mobile-v4-surface={auditMobile ? 'MobileTradesSheet' : undefined} className={`${auditMobile ? 'acg-mobile-v4-sheet ' : ''}fixed inset-0 z-[110] flex h-dvh w-full min-h-0 flex-col overflow-hidden bg-[#050505] text-[#f4f7fa]`}>
      <header className="shrink-0 border-b border-white/[0.07] bg-[#070707] pt-[env(safe-area-inset-top)]">
        <div className="grid min-h-[58px] grid-cols-[44px_minmax(0,1fr)_74px] items-center px-2">
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-[#c6ced7] active:bg-white/[0.05]" aria-label="Back to chart">
            <ChevronLeft size={21} strokeWidth={2}/>
          </button>

          <div className="flex h-full items-end justify-center gap-7">
            <button type="button" onClick={() => !readOnly && setTab('trade')} disabled={readOnly} className={`relative flex h-full items-center px-1 text-[15px] font-semibold tracking-[-0.02em] ${tab === 'trade' ? 'text-[#f4f7fa]' : 'text-[#7f8994]'} disabled:opacity-35`}>
              Trade
              {tab === 'trade' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#195be1]"/>}
            </button>
            <button type="button" onClick={() => setTab('history')} className={`relative flex h-full items-center px-1 text-[15px] font-semibold tracking-[-0.02em] ${tab === 'history' ? 'text-[#f4f7fa]' : 'text-[#7f8994]'}`}>
              History
              {tab === 'history' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#195be1]"/>}
            </button>
          </div>

          {tab === 'trade' ? (
            <div className="min-w-0 pr-1 text-right">
              <span className="block text-[8px] font-medium uppercase tracking-[0.08em] text-[#77838f]">P&amp;L</span>
              <strong className={`mt-1 block truncate font-mono text-[16px] font-semibold leading-none tabular-nums ${pnlClass(floating)}`}>{pnlNumber(floating)}</strong>
            </div>
          ) : (
            <button type="button" onClick={() => setFilterOpen(true)} className="ml-auto grid size-10 place-items-center rounded-lg text-[#d8e0e7] active:bg-white/[0.05]" aria-label="Filter history by symbol and period">
              <Clock size={19} strokeWidth={1.9}/>
            </button>
          )}
        </div>
      </header>

      {readOnly && <div className="shrink-0 border-b border-rose-400/[0.10] bg-rose-400/[0.04] px-3 py-2 text-[9px] font-medium text-[#b58f94]">Read-only account · completed trading records remain available.</div>}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(14px,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tab === 'trade' && (
          <>
            <div className="border-b border-white/[0.07] py-3">
              <AccountMetric label="Balance" value={accountNumber(account?.balance)} />
              <AccountMetric label="Equity" value={accountNumber(account?.equity)} />
              <AccountMetric label="Free Margin" value={accountNumber(account?.freeMargin)} />
            </div>

            <div className="flex items-center justify-between pb-1 pt-3">
              <span className="text-[12px] font-semibold text-[#aeb8c2]">Positions</span>
              <span className="text-[9px] font-medium tabular-nums text-[#64707b]">{positions.length} open</span>
            </div>
            <div>
              {!positions.length && <div className="border-b border-white/[0.06] py-5 text-[11px] text-[#66727e]">No open positions</div>}
              {positions.map(position => {
                const side = String(position?.side || '').toUpperCase();
                const current = Number(position?.closePrice);
                const fallbackCurrent = Number(marketFor(position?.symbol)?.[side === 'BUY' ? 'bid' : 'ask']);
                const currentPrice = Number.isFinite(current) ? current : fallbackCurrent;
                return (
                  <button key={position.id} type="button" onClick={() => showDetail('open-position', position)} className="block w-full border-b border-white/[0.06] py-2.5 text-left active:bg-white/[0.025]">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 truncate text-[14px] leading-5">
                        <strong className="font-semibold text-[#f0f3f6]">{symbolLabel(position.symbol)}</strong>
                        <span className={`ml-1.5 font-medium ${sideClass(side)}`}>{side.toLowerCase()}</span>
                        <span className="ml-1.5 text-[#c5ccd4]">{compactLots(position.volume)}</span>
                      </div>
                      <strong className={`shrink-0 font-mono text-[16px] font-semibold tabular-nums tracking-[-0.02em] ${pnlClass(position.pnl)}`}>{pnlNumber(position.pnl)}</strong>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-3">
                      <span className="font-mono text-[12px] tabular-nums text-[#7d8894]">{price(position.entry, position.symbol)} <span className="px-1 text-[#5e6974]">→</span> {price(currentPrice, position.symbol)}</span>
                      <span className="shrink-0 text-[8px] text-[#5f6b76]">{Number(position.sl) > 0 ? 'SL' : ''}{Number(position.sl) > 0 && Number(position.tp) > 0 ? ' · ' : ''}{Number(position.tp) > 0 ? 'TP' : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pb-1 pt-4">
              <span className="text-[12px] font-semibold text-[#aeb8c2]">Orders</span>
              <span className="text-[9px] font-medium tabular-nums text-[#64707b]">{pendingOrders.length} pending</span>
            </div>
            <div>
              {!pendingOrders.length && <div className="border-b border-white/[0.06] py-4 text-[11px] text-[#66727e]">No pending orders</div>}
              {pendingOrders.map(order => {
                const side = String(order?.side || '').toUpperCase();
                const type = orderTypeLabel(order);
                return (
                  <button key={order.id} type="button" onClick={() => showDetail('pending-order', order)} className="block w-full border-b border-white/[0.06] py-2.5 text-left active:bg-white/[0.025]">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 truncate text-[14px] leading-5">
                        <strong className="font-semibold text-[#f0f3f6]">{symbolLabel(order.symbol)}</strong>
                        <span className={`ml-1.5 font-medium ${sideClass(side)}`}>{side.toLowerCase()}</span>
                        {type && <span className={`ml-1 ${sideClass(side)}`}>{type}</span>}
                        <span className="ml-1.5 text-[#c5ccd4]">{compactLots(order.volume ?? order.lots)}</span>
                      </div>
                      <span className="shrink-0 text-[13px] font-medium text-[#929da8]">Pending</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] tabular-nums text-[#7d8894]">{price(orderEntry(order), order.symbol)}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === 'history' && (
          <>
            <div className="sticky top-0 z-10 -mx-3 border-b border-white/[0.06] bg-[#050505]/95 px-3 py-2 backdrop-blur">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#090a0b] p-1">
                {HISTORY_KINDS.map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setHistoryKind(id)} className={`h-8 rounded-md text-[10px] font-semibold ${historyKind === id ? 'bg-[#15171a] text-[#f1f4f7]' : 'text-[#707c87]'}`}>{label}</button>
                ))}
              </div>
            </div>

            <div className="pt-1">
              {!historyRows.length && <div className="py-8 text-center text-[11px] text-[#687580]">{!historyLoaded && !positionHistory.length ? 'Loading history…' : 'No history for this period'}</div>}
              {historyRows.map(row => {
                if (row.kind === 'position') {
                  const position = row.item;
                  const side = String(position?.side || '').toUpperCase();
                  return (
                    <button key={row.key} type="button" onClick={() => showDetail('history-position', position)} className="block w-full border-b border-white/[0.06] py-2.5 text-left active:bg-white/[0.025]">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] leading-5">
                            <strong className="font-semibold text-[#f0f3f6]">{symbolLabel(position.symbol)}</strong>
                            <span className={`ml-1.5 font-medium ${sideClass(side)}`}>{side.toLowerCase()}</span>
                            <span className="ml-1.5 text-[#c5ccd4]">{compactLots(position.volume)}</span>
                          </div>
                          <div className="mt-0.5 font-mono text-[12px] tabular-nums text-[#7d8894]">{price(position.entry, position.symbol)} <span className="px-1 text-[#5e6974]">→</span> {price(position.closePrice, position.symbol)}</div>
                        </div>
                        <div className="text-right">
                          <div className="whitespace-nowrap text-[11px] font-medium tabular-nums text-[#7c8793]">{compactDateTime(position)}</div>
                          <strong className={`mt-1 block font-mono text-[16px] font-semibold leading-none tabular-nums ${pnlClass(position.pnl)}`}>{pnlNumber(position.pnl)}</strong>
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
                  <button key={row.key} type="button" onClick={() => showDetail('history-order', order)} className="block w-full border-b border-white/[0.06] py-2.5 text-left active:bg-white/[0.025]">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] leading-5">
                          <strong className="font-semibold text-[#f0f3f6]">{symbolLabel(order.symbol)}</strong>
                          <span className={`ml-1.5 font-medium ${sideClass(side)}`}>{side.toLowerCase()}</span>
                          {type && <span className={`ml-1 ${sideClass(side)}`}>{type}</span>}
                          <span className="ml-1.5 text-[#c5ccd4]">{compactLots(order.requestedVolume ?? order.volume)}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-[12px] tabular-nums text-[#7d8894]">{price(orderEntry(order), order.symbol)}</div>
                      </div>
                      <div className="text-right">
                        <div className="whitespace-nowrap text-[11px] font-medium tabular-nums text-[#7c8793]">{compactDateTime(order)}</div>
                        <span className={`mt-1 block text-[13px] font-medium ${statusClass(status)}`}>{statusLabel(status)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {historyKind !== 'order' && (
              <div className="mt-3 border-t border-white/[0.08] py-3">
                <SummaryMetric label="Profit" value={pnlNumber(historyStats.profit)} valueClass={pnlClass(historyStats.profit)} />
                <SummaryMetric label="Swap" value={pnlNumber(historyStats.swap)} />
                <SummaryMetric label="Commission" value={pnlNumber(historyStats.commission)} />
              </div>
            )}
          </>
        )}
      </div>

      {filterOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-[#050505] pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 shrink-0 items-center border-b border-white/[0.07] px-2">
            <button type="button" onClick={() => setFilterOpen(false)} className="grid size-10 place-items-center rounded-lg text-[#c6ced7] active:bg-white/[0.05]" aria-label="Back to history"><ChevronLeft size={21} strokeWidth={2}/></button>
            <h3 className="ml-2 text-[16px] font-semibold text-[#f3f6f8]">History</h3>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <label className="flex h-12 items-center justify-between border-b border-white/[0.07] text-[14px]">
              <span className="text-[#e4e9ee]">Symbol:</span>
              <select value={symbolFilter} onChange={event => setSymbolFilter(event.target.value)} className="max-w-[58%] bg-transparent text-right text-[14px] text-[#9aa5b0] outline-none">
                <option className="bg-[#0a0a0a]" value="All symbols">All symbols</option>
                {symbols.map(symbol => <option className="bg-[#0a0a0a]" key={symbol} value={symbol}>{symbolLabel(symbol)}</option>)}
              </select>
            </label>

            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-[#080808]">
              {PERIODS.map(([id, label]) => (
                <button key={id} type="button" onClick={() => { setPeriod(id); if (id !== 'custom') setFilterOpen(false); }} className="flex h-12 w-full items-center justify-between border-b border-white/[0.07] px-3 text-left text-[14px] text-[#e1e6eb] last:border-b-0 active:bg-white/[0.035]">
                  <span>{label}</span>
                  {period === id && <Check size={17} className="text-[#2f83ff]" strokeWidth={2.3}/>}
                </button>
              ))}
            </div>

            {period === 'custom' && (
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#080808] p-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-medium text-[#7d8995]">From<input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/[0.08] bg-black px-2 text-[12px] text-[#dce3e9] outline-none"/></label>
                  <label className="text-[10px] font-medium text-[#7d8995]">To<input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/[0.08] bg-black px-2 text-[12px] text-[#dce3e9] outline-none"/></label>
                </div>
                <button type="button" onClick={() => setFilterOpen(false)} className="mt-3 h-10 w-full rounded-lg bg-[#195be1] text-[12px] font-semibold text-white">Apply</button>
              </div>
            )}
          </div>
        </div>
      )}

      {detailItem && detail?.kind === 'open-position' && renderOpenPositionDetail(detailItem)}
      {detailItem && detail?.kind === 'pending-order' && renderPendingDetail(detailItem)}
      {detailItem && detail?.kind === 'history-position' && renderClosedPositionDetail(detailItem)}
      {detailItem && detail?.kind === 'history-order' && renderHistoryOrderDetail(detailItem)}
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
