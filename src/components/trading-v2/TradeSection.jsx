import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Plus, X } from 'lucide-react';
import { formatInstrumentPrice, instrumentForSymbol } from '../../utils/instrumentFormatting.js';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import { estimatePositionPnlAtPrice, positionDistancePips } from '../../utils/tradingRisk.js';
import { accountTypeLabel } from '../../utils/accountPresentation.js';
import { buildOpenPositionSummary } from '../../utils/openPositionPresentation.js';

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
  onBreakEven = async () => false,
  onNewOrder = () => {},
  view = 'all',
  embedded = false,
  mobilePositionLayout = false,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [protectionDraft, setProtectionDraft] = useState({ sl: '', tp: '' });
  const [protectionSaving, setProtectionSaving] = useState(false);
  const [protectionError, setProtectionError] = useState('');
  const [partialCloseId, setPartialCloseId] = useState(null);
  const [partialClosePercent, setPartialClosePercent] = useState(50);
  const [positionActionBusy, setPositionActionBusy] = useState(null);
  const [closeConfirmId, setCloseConfirmId] = useState(null);
  const currency = account.currency || 'USD';
  const showOpen = view !== 'pending';
  const showPending = view !== 'open';
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
    setPartialCloseId(null);
    setPartialClosePercent(50);
    setPositionActionBusy(null);
    setCloseConfirmId(null);
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

  const partialClosePreview = (position, percent, instrument) => {
    const volume = Number(position?.volume);
    const numericPercent = Number(percent);
    const step = Math.max(Number(position?.volumeStep || instrument?.volumeStep) || 0.01, 0.00000001);
    const minimum = Math.max(Number(instrument?.minVolume) || step, step);
    if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(numericPercent) || numericPercent <= 0 || numericPercent >= 100) {
      return { valid: false, closeLots: null, remainingLots: null };
    }
    const units = Math.floor(((volume * numericPercent / 100) + step * 1e-8) / step);
    const closeLots = Number((units * step).toFixed(8));
    const remainingLots = Number((volume - closeLots).toFixed(8));
    const valid = closeLots >= minimum - step * 1e-8
      && closeLots < volume - step * 1e-8
      && (remainingLots <= step * 1e-8 || remainingLots >= minimum - step * 1e-8);
    return { valid, closeLots, remainingLots };
  };

  const runBreakEven = async position => {
    if (positionActionBusy) return;
    setPositionActionBusy(`be:${position.id}`);
    try {
      const moved = await onBreakEven(position.id);
      if (moved === true) {
        setProtectionDraft(currentDraft => ({ ...currentDraft, sl: price(position.entry, position.symbol) }));
      }
    } finally {
      setPositionActionBusy(null);
    }
  };

  const runPartialClose = async (position, percent) => {
    if (positionActionBusy) return;
    setPositionActionBusy(`partial:${position.id}`);
    try {
      const closed = await onClosePosition(position.id, Number(percent));
      if (closed === true) {
        setPartialCloseId(null);
        setPartialClosePercent(50);
      }
    } finally {
      setPositionActionBusy(null);
    }
  };

  const runFullClose = async position => {
    if (positionActionBusy) return;
    if (closeConfirmId !== position.id) {
      setCloseConfirmId(position.id);
      return;
    }
    setPositionActionBusy(`close:${position.id}`);
    try {
      const closed = await onClosePosition(position.id, 100);
      if (closed === true) {
        setCloseConfirmId(null);
        setExpandedId(null);
      }
    } finally {
      setPositionActionBusy(null);
    }
  };

  return (
    <section className={embedded ? 'px-0 pb-3 pt-0' : 'acg-mobile-terminal-page min-h-[calc(100dvh-92px)] px-2 pb-4 pt-2'}>
{!embedded && (      <header className="flex items-start justify-between gap-3 pb-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#5f7488]">{accountTypeLabel(account)}</p>
          <h1 className="mt-1 text-[26px] font-black tracking-[-0.045em] text-[#f5f8fb]">Trade</h1>
          <p className="mt-1 text-[10px] text-[#718397]">Positions, orders and margin at a glance.</p>
        </div>
        <button type="button" onClick={onNewOrder} className="acg-terminal-accent mt-1 flex h-9 items-center gap-1.5 border border-white/[0.08] bg-[#15151a] px-3 text-[9px] font-extrabold"><Plus size={14}/>New order</button>
      </header>)}

      {!embedded && (      <div className="border-y border-white/[0.08] bg-black py-3">
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
      )}

      {showOpen && (
        <>
      <div className={`${embedded ? 'mt-1' : 'mt-5'} flex items-center justify-between px-1`}>
        <div><h2 className={`${embedded ? 'text-[10px]' : 'text-[12px]'} font-black text-[#eaf1f6]`}>Open positions <span className="ml-1 text-[#5e7890]">{positions.length}</span></h2>{!embedded && <p className="mt-0.5 text-[8px] text-[#60758a]">Tap a position to set SL / TP or manage it.</p>}</div>
        {positions.length > 1 && <button type="button" onClick={onCloseAll} className="rounded-lg border border-[#4b2830] bg-[#080808] px-2.5 py-1.5 text-[8px] font-bold text-[#ff7b85]">Close all</button>}
      </div>

      <div className={`${embedded ? 'mt-1 space-y-0' : 'mt-2 space-y-2'}`}>
        {!positions.length && <EmptyState title="No open positions" subtitle="Orders executed from Chart will appear here." />}
        {positions.map(position => {
          const expanded = expandedId === position.id;
          const live = marketFor(position.symbol);
          const summary = buildOpenPositionSummary(position, account, live);
          const current = summary.currentPrice;
          const numericPnl = Number(position.pnl);
          const positive = Number.isFinite(numericPnl) && numericPnl > 0;
          const negative = Number.isFinite(numericPnl) && numericPnl < 0;
          const pnlTone = positive ? 'text-[#42d8a5]' : negative ? 'text-[#ff6d79]' : 'text-[#a7b2bc]';
          const pnlPercentText = formatPercent(summary.pnlPercent);
          const riskPrimary = summary.riskStatus === 'UNPROTECTED'
            ? 'UNPROTECTED'
            : summary.riskStatus === 'PROTECTED'
              ? 'Protected'
              : money(summary.riskAmount, position.pnlCurrency || currency);
          const riskSecondary = summary.riskStatus === 'UNPROTECTED'
            ? 'Set SL'
            : summary.riskStatus === 'PROTECTED'
              ? '$0 downside'
              : `${formatPercent(summary.riskPercent)} risk`;
          const riskTone = summary.riskStatus === 'UNPROTECTED'
            ? 'text-[#ff8a72]'
            : summary.riskStatus === 'PROTECTED'
              ? 'text-[#43d9a6]'
              : 'text-[#f1f5f8]';
          return (
            <article key={position.id} className="overflow-hidden border-b border-white/[0.08] bg-black last:border-b-0">
              <button type="button" onClick={() => openPositionDetails(position)} className={`w-full text-left ${mobilePositionLayout ? 'px-2.5 pb-2 pt-2.5' : embedded ? 'px-2.5 py-2' : 'px-3.5 py-3'}`}>
                {mobilePositionLayout ? (
                  <>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <InstrumentAvatar instrument={live} size={22}/>
                        <strong className="truncate text-[12px] font-black text-[#f1f5f8]">{symbolLabel(position.symbol)}</strong>
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[7px] font-black ${sideTone(position.side)}`}>{String(position.side).toUpperCase()}</span>
                        <span className="shrink-0 font-mono text-[8px] font-bold tabular-nums text-[#9aabb9]">{Number(position.volume).toFixed(2)} lots</span>
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <div className="text-right">
                          <b className={`block text-[14px] font-black tabular-nums ${pnlTone}`}>{money(position.pnl, position.pnlCurrency || currency, true)}</b>
                          <span className={`mt-0.5 block font-mono text-[7.5px] font-bold tabular-nums ${pnlTone}`}>{pnlPercentText}</span>
                        </div>
                        {expanded ? <ChevronUp size={14} className="mt-0.5 text-[#6e8498]"/> : <ChevronDown size={14} className="mt-0.5 text-[#6e8498]"/>}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-md border border-white/[0.06] bg-[#0b0b0d]">
                      <MobilePositionMetric label="Entry" value={price(position.entry, position.symbol)} sub="price" />
                      <MobilePositionMetric label="Current" value={price(current, position.symbol)} sub={position.valuationStatus === 'LIVE' ? 'executable' : 'valued'} />
                      <MobilePositionMetric label="Margin" value={money(summary.margin, currency)} sub="position" />
                    </div>

                    <div className="mt-1 grid grid-cols-3 overflow-hidden rounded-md border border-white/[0.06] bg-[#0b0b0d]">
                      <MobilePositionMetric label="Risk" value={riskPrimary} sub={riskSecondary} valueClassName={riskTone} />
                      <MobilePositionMetric
                        label="SL"
                        value={summary.sl ? price(summary.sl.price, position.symbol) : '—'}
                        sub={summary.sl?.pips != null ? `${summary.sl.pips.toFixed(1)}p` : 'No protection'}
                        valueClassName={summary.sl ? 'text-[#f1f5f8]' : 'text-[#ff8a72]'}
                      />
                      <MobilePositionMetric
                        label="TP"
                        value={summary.tp ? price(summary.tp.price, position.symbol) : '—'}
                        sub={summary.tp?.pips != null ? `${summary.tp.pips.toFixed(1)}p` : 'No target'}
                        valueClassName={summary.tp ? 'text-[#f1f5f8]' : 'text-[#71859a]'}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`flex items-center ${embedded ? 'gap-1.5' : 'gap-2'}`}><InstrumentAvatar instrument={live} size={embedded ? 21 : 24}/><strong className={`${embedded ? 'text-[11.5px]' : 'text-[13px]'} font-black text-[#f1f5f8]`}>{symbolLabel(position.symbol)}</strong><span className={`rounded-md font-black ${embedded ? 'px-1.5 py-0.5 text-[6.5px]' : 'px-1.5 py-1 text-[7px]'} ${sideTone(position.side)}`}>{String(position.side).toUpperCase()} · {Number(position.volume).toFixed(2)}</span></div>
                        <div className={`${embedded ? 'mt-1' : 'mt-2'} flex items-center gap-2 font-mono text-[8px] text-[#72869a]`}><span>{price(position.entry, position.symbol)}</span><span className="text-[#354c60]">→</span><span className="text-[#afbdc9]">{price(current, position.symbol)}</span></div>
                      </div>
                      <div className="flex items-start gap-1.5"><div className="text-right"><b className={`block ${embedded ? 'text-[13px]' : 'text-[15px]'} font-black ${pnlTone}`}>{money(position.pnl, position.pnlCurrency || currency, true)}</b>{!embedded && <span className="mt-1 block text-[8px] text-[#5d7286]">P&amp;L</span>}</div>{expanded ? <ChevronUp size={14} className="mt-0.5 text-[#6e8498]"/> : <ChevronDown size={14} className="mt-0.5 text-[#6e8498]"/>}</div>
                    </div>
                    {!expanded && (embedded
                      ? <div className="mt-1.5 flex items-center gap-3 font-mono text-[7px] text-[#60758a]"><span>SL <b className="text-[#9cacb9]">{price(position.sl, position.symbol)}</b></span><span>TP <b className="text-[#9cacb9]">{price(position.tp, position.symbol)}</b></span></div>
                      : <div className="mt-3 grid grid-cols-2 gap-2"><MiniMetric label="SL" value={price(position.sl, position.symbol)} /><MiniMetric label="TP" value={price(position.tp, position.symbol)} /></div>
                    )}
                  </>
                )}
              </button>

              {expanded && <div className={`border-t border-white/[0.08] bg-[#080808] ${mobilePositionLayout ? 'px-2.5 pb-3 pt-2.5' : 'px-3.5 pb-3.5 pt-3'}`}>
                <div className={`${mobilePositionLayout ? 'mb-2' : 'mb-3'} flex items-center justify-between`}>
                  <div>
                    <b className="text-[10px] font-black text-[#dce6ee]">Protection</b>
                    {!mobilePositionLayout && <p className="mt-0.5 text-[8px] text-[#60758a]">Set or remove stop loss and take profit.</p>}
                  </div>
                  <span className="font-mono text-[8px] text-[#71859a]">Now {price(current, position.symbol)}</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <ProtectionField
                    compact={mobilePositionLayout}
                    label="SL"
                    value={protectionDraft.sl}
                    projection={projectedProtection(position, protectionDraft.sl, live, currency)}
                    onChange={value => { setProtectionDraft(currentDraft => ({ ...currentDraft, sl: value })); setProtectionError(''); }}
                    onClear={() => { setProtectionDraft(currentDraft => ({ ...currentDraft, sl: '' })); setProtectionError(''); }}
                  />
                  <ProtectionField
                    compact={mobilePositionLayout}
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
                  className={`mt-2 flex ${mobilePositionLayout ? 'h-9' : 'h-10'} w-full items-center justify-center rounded-md border border-white/[0.10] bg-[#15151a] text-[9px] font-black text-[#67ccff] disabled:cursor-wait disabled:opacity-55`}
                >
                  {protectionSaving ? 'Saving protection…' : 'Save protection'}
                </button>

                <div className="mt-4 border-t border-white/[0.08] pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <b className="text-[10px] font-black text-[#dce6ee]">Manage position</b>
                      <p className="mt-0.5 text-[8px] text-[#60758a]">Reduce risk or close the trade.</p>
                    </div>
                  </div>

                  {(() => {
                    const entry = Number(position.entry);
                    const tickSize = Math.max(Number(live?.tickSize) || Number(live?.pipSize) || 0, 0);
                    const isBuy = String(position.side).toUpperCase() === 'BUY';
                    const alreadyBreakEven = Number.isFinite(Number(position.sl))
                      && Number.isFinite(entry)
                      && Math.abs(Number(position.sl) - entry) <= Math.max(tickSize / 2, 1e-10);
                    const breakEvenAvailable = Number.isFinite(current)
                      && Number.isFinite(entry)
                      && (isBuy ? current > entry + tickSize / 2 : current < entry - tickSize / 2);
                    const breakEvenDisabled = !breakEvenAvailable || alreadyBreakEven || Boolean(positionActionBusy);
                    const partialOpen = partialCloseId === position.id;
                    const preview = partialClosePreview(position, partialClosePercent, live);

                    return (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void runBreakEven(position)}
                            disabled={breakEvenDisabled}
                            className="h-10 rounded-md border border-white/[0.08] bg-black text-[9px] font-bold text-[#c4d0da] disabled:cursor-not-allowed disabled:text-[#465968]"
                          >
                            {alreadyBreakEven ? 'At break even' : positionActionBusy === `be:${position.id}` ? 'Moving…' : 'Break even'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPartialCloseId(partialOpen ? null : position.id); setCloseConfirmId(null); }}
                            disabled={Boolean(positionActionBusy)}
                            className="h-10 rounded-md border border-white/[0.08] bg-black text-[9px] font-bold text-[#c4d0da] disabled:opacity-50"
                          >
                            Partial close
                          </button>
                        </div>

                        {partialOpen && (
                          <div className="mt-2 border-y border-white/[0.08] bg-black px-2.5 py-3">
                            <div className="flex gap-1.5">
                              {[25, 50, 75].map(percent => (
                                <button
                                  key={percent}
                                  type="button"
                                  onClick={() => setPartialClosePercent(percent)}
                                  className={`h-8 flex-1 rounded-md border text-[8px] font-black ${Number(partialClosePercent) === percent ? 'border-white/[0.14] bg-[#15151a] text-[#67ccff]' : 'border-white/[0.08] bg-[#080808] text-[#73879a]'}`}
                                >
                                  {percent}%
                                </button>
                              ))}
                              <div className="flex h-8 w-[88px] items-center rounded-md border border-white/[0.08] bg-[#080808] px-2">
                                <input
                                  aria-label="Custom partial close percentage"
                                  type="number"
                                  inputMode="decimal"
                                  min="1"
                                  max="99"
                                  step="1"
                                  value={partialClosePercent}
                                  onChange={event => setPartialClosePercent(event.target.value)}
                                  className="min-w-0 flex-1 bg-transparent text-center font-mono text-[9px] font-bold text-[#e8eff4] outline-none"
                                />
                                <span className="text-[8px] text-[#60758a]">%</span>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[8px]">
                              <span className="text-[#60758a]">Close <b className="font-mono text-[#c9d4dc]">{preview.closeLots == null ? '—' : preview.closeLots.toFixed(2)} lots</b></span>
                              <span className="text-[#60758a]">Keep <b className="font-mono text-[#c9d4dc]">{preview.remainingLots == null ? '—' : preview.remainingLots.toFixed(2)} lots</b></span>
                            </div>
                            {!preview.valid && <p className="mt-2 text-[8px] leading-4 text-[#e8c35f]">Choose a percentage that leaves both the closed and remaining size tradable.</p>}
                            <button
                              type="button"
                              onClick={() => void runPartialClose(position, partialClosePercent)}
                              disabled={!preview.valid || Boolean(positionActionBusy)}
                              className="mt-2 h-9 w-full rounded-md border border-white/[0.10] bg-[#15151a] text-[8px] font-black text-[#67ccff] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {positionActionBusy === `partial:${position.id}` ? 'Closing…' : `Close ${Number(partialClosePercent) || 0}%`}
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => void runFullClose(position)}
                          disabled={Boolean(positionActionBusy)}
                          className={`mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border text-[9px] font-black disabled:opacity-50 ${closeConfirmId === position.id ? 'border-[#7b3440] bg-[#351820] text-[#ff8790]' : 'border-[#562c35] bg-[#251319] text-[#ff7a85]'}`}
                        >
                          <X size={13}/>
                          {positionActionBusy === `close:${position.id}` ? 'Closing…' : closeConfirmId === position.id ? 'Confirm full close' : 'Close position'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenChart(position.symbol)}
                          className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-black text-[8px] font-bold text-[#63cbff]"
                        >
                          <ExternalLink size={12}/>View on chart
                        </button>
                      </>
                    );
                  })()}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3"><Metric label="Opened" value={position.openedAt || '—'} /><Metric label="Ticket" value={`#${String(position.id).slice(-8)}`} /><Metric label="Swap" value={money(position.swap || 0, position.pnlCurrency || currency)} /><Metric label="Commission" value={money(position.commission || 0, position.pnlCurrency || currency)} /></div>
              </div>}
            </article>
          );
        })}
      </div>

        </>
      )}

      {showPending && (
        <>
      <div className={`${embedded ? 'mt-1' : 'mt-5'} flex items-center justify-between px-1`}><div><h2 className={`${embedded ? 'text-[10px]' : 'text-[12px]'} font-black text-[#eaf1f6]`}>Pending orders <span className="ml-1 text-[#5e7890]">{pendingOrders.length}</span></h2>{!embedded && <p className="mt-0.5 text-[8px] text-[#60758a]">Limit and stop orders waiting for execution.</p>}</div></div>
      <div className={`${embedded ? 'mt-1 space-y-0' : 'mt-2 space-y-2'}`}>
        {!pendingOrders.length && <EmptyState title="No pending orders" subtitle="Limit and stop orders will appear here." compact />}
        {pendingOrders.map(order => {
          const side = String(order.side).toUpperCase();
          return (
            <article key={order.id} className={`border-b border-white/[0.07] bg-black px-1 last:border-b-0 ${embedded ? 'py-2' : 'py-3'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`flex items-center ${embedded ? 'gap-1.5' : 'gap-2'}`}>
                    <InstrumentAvatar instrument={marketFor(order.symbol)} size={embedded ? 21 : 24}/>
                    <strong className={`${embedded ? 'text-[11px]' : 'text-[12px]'} font-black text-[#eff4f8]`}>{symbolLabel(order.symbol)}</strong>
                    <span className={`rounded-md font-black ${embedded ? 'px-1.5 py-0.5 text-[6.5px]' : 'px-1.5 py-1 text-[7px]'} ${sideTone(side)}`}>{side} {String(order.orderType || 'order').toUpperCase()}</span>
                  </div>
                  <div className={`${embedded ? 'mt-1 text-[7px]' : 'mt-2 text-[9px]'} flex flex-wrap items-center gap-x-3 gap-y-1 text-[#71859a]`}>
                    <span>{Number(order.lots || order.manualLots || 0).toFixed(2)} lots · Entry <b className="font-mono text-[#c1ccd6]">{price(order.entry, order.symbol)}</b></span>
                    <span>SL <b className="font-mono text-[#9eb0bf]">{price(order.sl, order.symbol)}</b> · TP <b className="font-mono text-[#9eb0bf]">{price(order.tp, order.symbol)}</b></span>
                  </div>
                </div>
              </div>
              <div className={`${embedded ? 'mt-2 gap-1' : 'mt-3 gap-2'} grid grid-cols-3`}>
                <button type="button" onClick={() => onOpenChart(order.symbol)} className={`${embedded ? 'h-8' : 'h-9'} rounded-md border border-white/[0.06] bg-[#101010] text-[8px] font-bold text-[#5fc9ff]`}>Chart</button>
                <button type="button" onClick={() => onModifyPending(order.id)} className={`${embedded ? 'h-8' : 'h-9'} rounded-md border border-white/[0.06] bg-[#080808] text-[8px] font-bold text-[#b5c3ce]`}>Modify</button>
                <button type="button" onClick={() => onCancelPending(order.id)} className={`${embedded ? 'h-8' : 'h-9'} rounded-md border border-[#512b34] bg-[#101010] text-[8px] font-bold text-[#ff7984]`}>Cancel</button>
              </div>
            </article>
          );
        })}
      </div>
        </>
      )}
    </section>
  );
}


function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  const digits = Math.abs(numeric) < 0.1 ? 3 : 2;
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(digits)}%`;
}

function MobilePositionMetric({ label, value, sub, valueClassName = 'text-[#f1f5f8]' }) {
  return (
    <div className="min-w-0 border-r border-white/[0.05] px-2 py-1.5 last:border-r-0">
      <span className="block text-[6.5px] font-bold uppercase tracking-[0.09em] text-[#60758a]">{label}</span>
      <b className={`mt-0.5 block truncate font-mono text-[9.5px] font-black tabular-nums ${valueClassName}`}>{value}</b>
      <span className="mt-0.5 block truncate text-[6.5px] font-semibold text-[#596d80]">{sub}</span>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="min-w-0"><span className="block text-[7px] font-bold uppercase tracking-[0.1em] text-[#5d7287]">{label}</span><b className="mt-1 block truncate text-[10px] font-semibold capitalize text-[#cbd6df]">{value}</b></div>;
}

function MiniMetric({ label, value }) {
  return <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#080808] px-2.5 py-2"><span className="text-[7px] font-bold text-[#5e7488]">{label}</span><b className="font-mono text-[9px] text-[#b9c6d1]">{value}</b></div>;
}

function ProtectionField({ label, value, projection, onChange, onClear, compact = false }) {
  const pnl = Number(projection?.pnl);
  const hasPnl = Number.isFinite(pnl);
  const pips = Number(projection?.pips);
  const hasPips = Number.isFinite(pips);
  const pnlText = hasPnl ? money(pnl, projection?.currency || 'USD', true) : '—';
  const distanceText = hasPips ? `${pips.toFixed(1)} pips` : '—';
  const pnlTone = !hasPnl ? 'text-[#60758a]' : pnl < 0 ? 'text-[#ff6f7a]' : pnl > 0 ? 'text-[#43d9a6]' : 'text-[#9aabba]';

  return (
    <div className={`block rounded-md border border-white/[0.08] bg-black ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}>
      <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-[0.1em] text-[#61768a]">
        <label>{label}</label>
        <button type="button" onClick={onClear} className={`${compact ? 'min-h-6 px-1' : ''} text-[7px] font-bold normal-case tracking-normal text-[#70869a]`}>Clear</button>
      </div>
      <input
        aria-label={label}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="No protection"
        className={`${compact ? 'mt-0.5 text-[10.5px]' : 'mt-1.5 text-[11px]'} w-full bg-transparent font-mono font-bold tabular-nums text-[#eef4f8] outline-none placeholder:text-[#405364]`}
      />
      <div className={`${compact ? 'mt-1 pt-1' : 'mt-2 pt-2'} flex items-center justify-between border-t border-white/[0.06]`}>
        <span className={`font-mono ${compact ? 'text-[7.5px]' : 'text-[9px]'} font-black tabular-nums ${pnlTone}`}>{pnlText}</span>
        <span className={`${compact ? 'text-[7px]' : 'text-[7px]'} font-semibold tabular-nums text-[#60758a]`}>{distanceText}</span>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle, compact = false }) {
  return <div className={`grid place-items-center border-y border-dashed border-white/[0.08] bg-black text-center ${compact ? 'h-[92px]' : 'h-[118px]'}`}><div><b className="text-[10px] text-[#9eafbe]">{title}</b><p className="mt-1 text-[8px] text-[#5d7185]">{subtitle}</p></div></div>;
}
