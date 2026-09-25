import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, ScanLine, Magnet, Lock, Unlock, Pin } from 'lucide-react';
import TradingChart from '../TradingChart.jsx';
import DrawingLayer from './DrawingLayer.jsx';
import { formatInstrumentPrice, formatSpreadDisplay, instrumentPipSize } from '../../utils/instrumentFormatting.js';
import { calculateRiskOrderSizing, estimatePositionPnlAtPrice, estimateStopRisk, positionDistancePips } from '../../utils/tradingRisk.js';
import { DRAWING_TOOL_GROUPS, DRAWING_TOOL_LABELS } from '../../utils/drawingTools.js';
import { DRAWING_TOOL_ICONS } from './DrawingToolIcons.jsx';

const MOBILE_HIDDEN_DRAWING_TOOLS = new Set([
  'ray',
  'extended-line',
  'hline',
  'horizontal-ray',
  'vline',
]);

const toolGroups = DRAWING_TOOL_GROUPS.map(group =>
  group.map(id => [id, DRAWING_TOOL_ICONS[id], DRAWING_TOOL_LABELS[id]])
);

const oscillatorIds = new Set(['rsi', 'macd', 'atr', 'stochastic']);

function localUtcLabel(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

function localClockLabel(date = new Date()) {
  return [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ].map(value => String(value).padStart(2, '0')).join(':');
}

function validPlanPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatProjectedPnl(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(numeric));
    return `${numeric >= 0 ? '+' : '-'}${amount}`;
  } catch {
    return `${numeric >= 0 ? '+' : '-'}${Math.abs(numeric).toFixed(2)} ${currency || ''}`.trim();
  }
}

function formatPositionPnl(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `— ${currency || ''}`.trim();
  return `${numeric >= 0 ? '+' : '-'}${Math.abs(numeric).toFixed(2)} ${String(currency || 'USD').toUpperCase()}`;
}

function formatPositionLots(value) {
  const numeric = Math.abs(Number(value));
  if (!Number.isFinite(numeric)) return '—';
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function OpenPositionEntryOverlay({ symbol, positions = [], coordinateApi, instrument, selectedPositionId = null, onSelectPosition = () => {}, onClosePosition = () => {} }) {
  const [, forceLayout] = useState(0);

  const activePositions = useMemo(
    () => (Array.isArray(positions) ? positions : []).filter(position =>
      String(position?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase()
      && Number.isFinite(Number(position?.entry ?? position?.entryPrice))
    ),
    [positions, symbol],
  );

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  if (!coordinateApi?.priceToY || !activePositions.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[34] overflow-hidden">
      {activePositions.map(position => {
        const entry = Number(position.entry ?? position.entryPrice);
        const y = coordinateApi.priceToY(entry);
        if (!Number.isFinite(y)) return null;
        const side = String(position.side || '').toUpperCase();
        const isBuy = side === 'BUY';
        const pnl = Number(position.pnl);
        const currency = position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
        const lots = Number(position.volume ?? position.lots);
        const signedLots = `${isBuy ? '' : '-'}${formatPositionLots(lots)}`;
        const lineColor = isBuy ? '#12b996' : '#ef5664';
        const quantityBackground = isBuy ? '#087a62' : '#8f2734';
        const closeColor = isBuy ? '#35d7b0' : '#ff7883';
        const pnlColor = Number.isFinite(pnl)
          ? pnl < 0
            ? '#ff5968'
            : pnl > 0
              ? '#55dfa9'
              : '#eef4f2'
          : '#eef4f2';

        return (
          <div key={position.id || `${side}-${entry}-${lots}`} className="absolute left-0 right-0" style={{ top: y }}>
            <div className="relative border-t" style={{ borderColor: lineColor }}>
              <div
                role="button"
                tabIndex={0}
                onClick={event => { event.stopPropagation(); onSelectPosition(position.id); }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectPosition(position.id);
                  }
                }}
                className={`pointer-events-auto absolute left-3 top-1/2 flex h-6 -translate-y-1/2 items-stretch overflow-hidden rounded-[4px] border bg-[#07110f]/98 font-mono text-[10px] font-bold tabular-nums text-[#f3faf7] shadow-[0_2px_8px_rgba(0,0,0,.32)] ${String(selectedPositionId) === String(position.id) ? 'ring-1 ring-white/20' : ''}`}
                style={{ borderColor: lineColor }}
                aria-label={`Select ${side} ${position.symbol || symbol} position`}
              >
                <span
                  className="flex min-w-[30px] items-center justify-center border-r px-2 text-white"
                  style={{ backgroundColor: quantityBackground, borderColor: `${lineColor}80` }}
                >
                  {signedLots}
                </span>
                <span
                  className="flex min-w-[72px] items-center justify-center border-r px-2"
                  style={{ color: pnlColor, borderColor: `${lineColor}55` }}
                >
                  {formatPositionPnl(pnl, currency)}
                </span>
                <button
                  type="button"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onClosePosition(position.id, 100);
                  }}
                  className="grid w-7 place-items-center text-[13px] leading-none transition hover:bg-white/[0.05] active:bg-white/[0.08]"
                  style={{ color: closeColor }}
                  aria-label={`Close ${side} ${position.symbol || symbol} position`}
                  title="Close position"
                >
                  ×
                </button>
              </div>
              <span
                className="absolute right-[56px] top-1/2 lg:right-2 -translate-y-1/2 rounded-[4px] border px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-white shadow-[0_3px_10px_rgba(0,0,0,.28)]"
                style={{ borderColor: lineColor, backgroundColor: isBuy ? '#0aa06f' : '#d94250' }}
              >
                {formatInstrumentPrice(entry, instrument)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PendingOrderOverlay({
  symbol,
  orders = [],
  coordinateApi,
  instrument,
  hiddenOrderId = null,
  onModify = () => {},
  onCancel = () => {},
}) {
  const [, forceLayout] = useState(0);

  const activeOrders = useMemo(
    () => (Array.isArray(orders) ? orders : []).filter(order =>
      String(order?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase()
      && String(order?.id || '') !== String(hiddenOrderId || '')
      && Number.isFinite(Number(order?.entry))
    ),
    [hiddenOrderId, orders, symbol],
  );

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  if (!coordinateApi?.priceToY || !activeOrders.length) return null;

  const renderProtectionLine = (order, kind, color, label) => {
    const price = Number(order?.[kind]);
    if (!Number.isFinite(price)) return null;
    const y = coordinateApi.priceToY(price);
    if (!Number.isFinite(y)) return null;
    return (
      <div key={`${order.id}:${kind}`} className="pointer-events-none absolute left-0 right-0 z-[18]" style={{ top: y }}>
        <div className="relative border-t border-dotted" style={{ borderColor: `${color}99` }}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded-[4px] border bg-[#09090b]/94 px-1.5 py-0.5 text-[8px] font-black" style={{ borderColor: `${color}70`, color }}>
            {label}
          </span>
          <span className="absolute right-[56px] top-1/2 lg:right-2 -translate-y-1/2 rounded-[4px] border px-1.5 py-0.5 font-mono text-[8px] font-bold tabular-nums" style={{ borderColor: `${color}88`, backgroundColor: kind === 'sl' ? '#5b1721' : '#0b4b37', color: '#ffffff' }}>
            {formatInstrumentPrice(price, instrument)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[28] overflow-hidden">
      {activeOrders.flatMap(order => {
        const entry = Number(order.entry);
        const y = coordinateApi.priceToY(entry);
        if (!Number.isFinite(y)) return [];
        const side = String(order.side || '').toUpperCase();
        const type = String(order.orderType || '').replace('-', ' ').toUpperCase();
        const lots = Number(order.volume ?? order.lots);
        const secondary = order.orderType === 'stop-limit' && Number.isFinite(Number(order.limitPrice))
          ? Number(order.limitPrice)
          : null;
        const secondaryY = secondary == null ? null : coordinateApi.priceToY(secondary);

        return [
          <div key={`${order.id}:entry`} className="pointer-events-none absolute left-0 right-0 z-[21]" style={{ top: y }}>
            <div className="relative border-t border-dotted border-[#2f7df4]/90">
              <div
                role="button"
                tabIndex={0}
                onClick={event => { event.stopPropagation(); onModify(order.id); }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onModify(order.id);
                  }
                }}
                className="pointer-events-auto absolute left-3 top-1/2 flex h-7 -translate-y-1/2 items-stretch overflow-hidden rounded-[5px] border border-[#2459a8] bg-[#0b2f66]/95 font-mono text-[10px] font-bold tabular-nums text-[#f4f8ff] shadow-[0_5px_16px_rgba(0,0,0,.38)] backdrop-blur-sm"
                aria-label={`Modify ${side} ${type} order`}
                title={`${type} pending order`}
              >
                <span className="flex min-w-[34px] items-center justify-center border-r border-white/20 px-2">
                  {Number.isFinite(lots) ? formatPositionLots(lots) : '—'}
                </span>
                <span className={`flex min-w-[42px] items-center justify-center border-r border-white/20 px-2 ${side === 'BUY' ? 'text-[#35e0a4]' : 'text-[#ff6b77]'}`}>
                  {side}
                </span>
                <button
                  type="button"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onCancel(order.id);
                  }}
                  className="grid w-9 place-items-center text-[15px] leading-none text-white/85 transition hover:bg-black/20 hover:text-white active:bg-black/30"
                  aria-label={`Cancel ${side} ${type} order`}
                  title="Cancel pending order"
                >
                  ×
                </button>
              </div>
              <span className="absolute right-[56px] top-1/2 lg:right-2 -translate-y-1/2 rounded-[4px] border border-[#2d68bd] bg-[#1f5fc4] px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-white shadow-[0_3px_10px_rgba(0,0,0,.28)]">
                {formatInstrumentPrice(entry, instrument)}
              </span>
            </div>
          </div>,
          secondaryY != null && Number.isFinite(secondaryY) ? (
            <div key={`${order.id}:limit`} className="pointer-events-none absolute left-0 right-0 z-[19]" style={{ top: secondaryY }}>
              <div className="relative border-t border-dashed border-[#b58cff]/70">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded border border-[#6f5b93]/70 bg-black/90 px-1.5 py-0.5 text-[8px] font-bold text-[#c8aaff]">
                  LIMIT {formatInstrumentPrice(secondary, instrument)}
                </span>
              </div>
            </div>
          ) : null,
          renderProtectionLine(order, 'sl', '#ff5968', 'SL'),
          renderProtectionLine(order, 'tp', '#35d79d', 'TP'),
        ].filter(Boolean);
      })}
    </div>
  );
}

function TradePlanOverlay({ plan, onChange, coordinateApi, instrument, lots = 0.1, accountCurrency = 'USD', account = null, riskPercent = 0.5, showEntry = true }) {
  const layerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [preview, setPreview] = useState({});
  const [, forceLayout] = useState(0);

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  const metrics = useMemo(() => {
    const entry = validPlanPrice(plan?.entry);
    const sl = validPlanPrice(plan?.sl);
    const tp = validPlanPrice(plan?.tp);
    const pip = Number(instrumentPipSize(instrument));
    if (!Number.isFinite(entry) || !Number.isFinite(pip) || pip <= 0) return { slPips: null, tpPips: null };
    return {
      slPips: Number.isFinite(sl) ? Math.abs(entry - sl) / pip : null,
      tpPips: Number.isFinite(tp) ? Math.abs(tp - entry) / pip : null,
    };
  }, [instrument, plan]);

  useEffect(() => {
    if (!dragging || !coordinateApi?.yToPrice) return undefined;
    const field = dragging === 'limit' ? 'limitPrice' : dragging;

    const clearPreview = () => {
      setPreview(current => {
        if (!Object.prototype.hasOwnProperty.call(current, field)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    };

    const priceFromEvent = event => {
      const rect = layerRef.current?.getBoundingClientRect();
      const clientY = Number(event?.clientY);
      if (!rect || !Number.isFinite(clientY)) return null;
      const converted = coordinateApi.yToPrice(clientY - rect.top);
      return Number.isFinite(converted) ? converted : null;
    };

    const move = event => {
      const converted = priceFromEvent(event);
      if (converted == null) return;
      event.preventDefault?.();
      setPreview(current => ({ ...current, [field]: converted }));
    };

    const finish = (event, commit) => {
      const converted = commit ? priceFromEvent(event) : null;
      setDragging(null);
      clearPreview();
      if (converted != null) onChange({ [field]: converted, stage: 'ready' });
      else onChange({ stage: 'ready' });
    };

    const up = event => finish(event, true);
    const cancel = event => {
      event?.preventDefault?.();
      finish(event, false);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [coordinateApi, dragging, onChange]);

  if (!plan || plan.open || !coordinateApi?.priceToY) return null;
  const isBuy = plan.side === 'buy';
  const sourcePrice = field => {
    if (Object.prototype.hasOwnProperty.call(preview, field)) return validPlanPrice(preview[field]);
    return validPlanPrice(plan?.[field]);
  };
  const yFor = field => {
    const price = sourcePrice(field);
    if (!Number.isFinite(price)) return null;
    const y = coordinateApi.priceToY(price);
    return Number.isFinite(y) ? y : null;
  };

  const entryY = yFor('entry');
  const slY = yFor('sl');
  const tpY = yFor('tp');
  const liveEntry = sourcePrice('entry');
  const liveSl = sourcePrice('sl');
  const liveTp = sourcePrice('tp');
  const livePlan = { ...plan, entry: liveEntry, sl: liveSl, tp: liveTp };
  const liveRiskSizing = plan?.sizingMode === 'risk'
    ? calculateRiskOrderSizing(livePlan, riskPercent, account || {}, instrument)
    : null;
  const rawDisplayLots = plan?.sizingMode === 'risk'
    ? (liveRiskSizing?.requestedLots ?? lots)
    : (plan?.manualLots ?? lots);
  const displayLots = rawDisplayLots == null ? Number.NaN : Number(rawDisplayLots);
  const liveRisk = Number.isFinite(displayLots) && Number.isFinite(liveEntry) && Number.isFinite(liveSl)
    ? estimateStopRisk(livePlan, displayLots, instrument, accountCurrency)
    : null;
  const liveReward = Number.isFinite(displayLots) && Number.isFinite(liveEntry) && Number.isFinite(liveTp)
    ? estimateStopRisk({ ...livePlan, sl: liveTp }, displayLots, instrument, accountCurrency)
    : null;
  const lotLabel = Number.isFinite(displayLots) ? `${displayLots.toFixed(Math.max(2, Number(instrument?.volumeStep) < 0.01 ? 3 : 2))} lot` : '— lot';
  const rewardTop = entryY != null && tpY != null ? Math.min(entryY, tpY) : null;
  const rewardHeight = entryY != null && tpY != null ? Math.abs(entryY - tpY) : 0;
  const riskTop = entryY != null && slY != null ? Math.min(entryY, slY) : null;
  const riskHeight = entryY != null && slY != null ? Math.abs(entryY - slY) : 0;

  const line = (kind, field, color, label, value, draggable) => {
    const top = yFor(field);
    if (top == null) return null;
    return (
      <div className="absolute left-0 right-0 z-30" style={{ top }}>
        <div className="relative h-px" style={{ backgroundColor: `${color}bf` }}>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-1 text-[8px] font-black tracking-[0.03em]" style={{ borderColor: `${color}99`, backgroundColor: 'rgba(8,8,8,0.92)', color }}>{label}</span>
          <span className="absolute right-[56px] top-1/2 lg:right-2 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 font-mono text-[8px] font-extrabold tabular-nums" style={{ backgroundColor: color, color: kind === 'sl' ? '#2b0810' : '#032219' }}>{value}</span>
          {draggable && (
            <button
              type="button"
              aria-label={`Drag ${label}`}
              onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setDragging(kind); onChange({ stage: `dragging-${kind}` }); }}
              className="pointer-events-auto absolute left-[44%] top-1/2 grid size-10 -translate-y-1/2 cursor-ns-resize touch-none place-items-center rounded-full bg-transparent lg:left-auto lg:right-[48px]"
            >
              <span className="size-7 rounded-full border-2 bg-[#080808] shadow-[0_0_0_5px_rgba(255,255,255,0.04)]" style={{ borderColor: color }} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const entryLabel = plan.pending ? `${isBuy ? 'BUY' : 'SELL'} ${String(plan.orderType || '').toUpperCase()}` : (isBuy ? 'BUY' : 'SELL');

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[40] overflow-hidden">
      {rewardTop != null && <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: rewardTop, height: rewardHeight, background: 'linear-gradient(90deg, rgba(22,134,95,0.10), rgba(34,167,125,0.20))' }} />}
      {riskTop != null && <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: riskTop, height: riskHeight, background: 'linear-gradient(90deg, rgba(138,43,57,0.10), rgba(255,68,91,0.17))' }} />}
      {line('tp', 'tp', '#35d79d', 'TP', `TP ${formatInstrumentPrice(liveTp, instrument)}`, true)}
      {showEntry && line('entry', 'entry', '#42a5ff', entryLabel, formatInstrumentPrice(sourcePrice('entry'), instrument), Boolean(plan.pending))}
      {showEntry && plan.pending && plan.orderType === 'stop-limit' && line('limit', 'limitPrice', '#b58cff', 'LIMIT', formatInstrumentPrice(sourcePrice('limitPrice'), instrument), true)}
      {line('sl', 'sl', '#ff5968', 'SL', `SL ${formatInstrumentPrice(liveSl, instrument)}`, true)}
      {dragging && (
        <div className="pointer-events-none absolute right-[64px] top-3 z-40 rounded-lg border border-white/10 bg-[#080808]/95 px-2.5 py-1.5 text-right shadow-xl lg:right-[86px]">
          <div className="text-[8px] uppercase tracking-[0.12em] text-[#708397]">{dragging === 'sl' ? 'Stop loss' : dragging === 'tp' ? 'Take profit' : dragging === 'limit' ? 'Limit price' : 'Entry price'}</div>
          <strong className={`mt-0.5 block text-[11px] ${dragging === 'sl' ? 'text-[#ff6b78]' : dragging === 'tp' ? 'text-[#53e0ad]' : 'text-[#69bdff]'}`}>{formatInstrumentPrice(sourcePrice(dragging === 'limit' ? 'limitPrice' : dragging), instrument)}</strong>
          {(dragging === 'sl' || dragging === 'tp') && (
            <span className="mt-0.5 block font-mono text-[8px] tabular-nums text-[#8d9aa5]">
              {lotLabel} · {dragging === 'sl'
                ? (Number.isFinite(liveRisk) ? formatProjectedPnl(-Math.abs(liveRisk), accountCurrency) : '—')
                : (Number.isFinite(liveReward) ? formatProjectedPnl(Math.abs(liveReward), accountCurrency) : '—')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function OpenPositionProtectionOverlay({ symbol, positions = [], coordinateApi, instrument, onUpdatePosition = () => {}, selectedPositionId = null, onSelectPosition = () => {} }) {
  const layerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [preview, setPreview] = useState({});
  const [, forceLayout] = useState(0);

  const activePositions = useMemo(
    () => (Array.isArray(positions) ? positions : []).filter(position =>
      String(position?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase()
    ),
    [positions, symbol],
  );

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  useEffect(() => {
    if (!dragging || !coordinateApi?.yToPrice) return undefined;

    const clearPreview = current => {
      if (!current) return;
      const key = current.positionId + ':' + current.kind;
      setPreview(values => {
        if (!Object.prototype.hasOwnProperty.call(values, key)) return values;
        const next = { ...values };
        delete next[key];
        return next;
      });
    };

    const priceFromEvent = event => {
      const rect = layerRef.current?.getBoundingClientRect();
      const clientY = Number(event?.clientY);
      if (!rect || !Number.isFinite(clientY)) return null;
      const converted = coordinateApi.yToPrice(clientY - rect.top);
      return Number.isFinite(converted) ? converted : null;
    };

    const move = event => {
      const converted = priceFromEvent(event);
      if (converted == null) return;
      event.preventDefault?.();
      const key = dragging.positionId + ':' + dragging.kind;
      setPreview(current => ({ ...current, [key]: converted }));
    };

    const finish = async (event, commit) => {
      const current = dragging;
      const converted = commit ? priceFromEvent(event) : null;
      setDragging(null);
      try {
        if (commit && Number.isFinite(converted)) {
          await onUpdatePosition(current.positionId, { [current.kind]: converted });
        }
      } finally {
        clearPreview(current);
      }
    };

    const up = event => { void finish(event, true); };
    const cancel = event => {
      event?.preventDefault?.();
      void finish(event, false);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [coordinateApi, dragging, onUpdatePosition]);

  if (!coordinateApi?.priceToY || !activePositions.length) return null;

  const renderLine = (position, kind, color, label) => {
    const key = `${position.id}:${kind}`;
    const source = Object.prototype.hasOwnProperty.call(preview, key) ? preview[key] : position[kind];
    const price = Number(source);
    if (!Number.isFinite(price)) return null;
    const y = coordinateApi.priceToY(price);
    if (!Number.isFinite(y)) return null;
    const displayPrice = value => formatInstrumentPrice(value, instrument);
    const projectedPnl = estimatePositionPnlAtPrice(position, price, instrument);
    const pips = positionDistancePips(position, price, instrument);
    const currency = position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
    const selected = String(selectedPositionId) === String(position.id);
    const active = selected || (dragging?.positionId === position.id && dragging?.kind === kind);
    const previewText = active
      ? (projectedPnl == null
          ? `${displayPrice(price)} · ${pips?.toFixed(1) ?? '—'}p`
          : `${displayPrice(price)} · ${formatProjectedPnl(projectedPnl, currency)} · ${pips?.toFixed(1) ?? '—'}p`)
      : displayPrice(price);

    return (
      <div key={key} className="pointer-events-none absolute left-0 right-0 z-30" style={{ top: y }}>
        <div className="relative h-px" style={{ backgroundColor: color }}>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-[4px] border px-1.5 py-0.5 text-[8px] font-black" style={{ borderColor: `${color}88`, backgroundColor: 'rgba(8,8,8,0.92)', color }}>{label}</span>
          <span className="absolute right-[56px] top-1/2 lg:right-2 -translate-y-1/2 rounded-[4px] border px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-white" style={{ borderColor: `${color}88`, backgroundColor: kind === 'sl' ? '#5b1721' : '#0b4b37' }}>{previewText}</span>
          <button
            type="button"
            aria-label={`Drag ${label}`}
            onPointerDown={event => { event.preventDefault(); event.stopPropagation(); onSelectPosition(position.id); setDragging({ positionId: position.id, kind }); }}
            className={`pointer-events-auto absolute left-[64px] right-[56px] top-1/2 h-5 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent lg:inset-x-0 ${String(selectedPositionId) === String(position.id) ? 'ring-1 ring-inset ring-white/10' : ''}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[24] overflow-hidden">
      {activePositions.flatMap(position => [
        renderLine(position, 'tp', '#35d79d', 'TP'),
        renderLine(position, 'sl', '#ff5968', 'SL'),
      ])}
    </div>
  );
}

export default function ChartArea({
  symbol,
  instrument = null,
  chartTimeframe,
  tick,
  price,
  ask,
  chartMode,
  selectedTool,
  onSelectTool,
  focusMode = false,
  embedded = false,
  hideToolbar = false,
  tradePlan,
  tradePlanLots = 0.1,
  accountCurrency = 'USD',
  onTradePlanChange = () => {},
  onUpdatePosition = () => {},
  selectedPositionId = null,
  onSelectPosition = () => {},
  onClosePosition = () => {},
  positionProtectionDraft = null,
  onPositionProtectionDraftChange = () => {},
  indicators = [],
  positions = [],
  pendingOrders = [],
  onModifyPending = () => {},
  onCancelPending = () => {},
  desktopEnhanced = false,
  compactContext = false,
  onToggleIndicator = () => {},
  onOpenIndicatorSettings = () => {},
  onRemoveIndicator = () => {},
  account = null,
  riskPercent = 0.5,
  onCreateRiskOrder = () => {},
  chartInstanceId = 'chart',
  drawingInteractionEnabled = true,
  drawingToolbarOpen = true,
  drawingToolbarOverlay = false,
  fillAvailableHeight = false,
}) {
  const [clockNow, setClockNow] = useState(() => new Date());
  const [coordinateApi, setCoordinateApi] = useState(null);
  const [showDrawings, setShowDrawings] = useState(true);
  const [drawingSnap, setDrawingSnap] = useState('off');
  const [lockAllDrawings, setLockAllDrawings] = useState(false);
  const [keepDrawingTool, setKeepDrawingTool] = useState(false);
  const [drawingCount, setDrawingCount] = useState(0);
  const [narrowMobile, setNarrowMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 430px)').matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 430px)');
    const onChange = event => setNarrowMobile(event.matches);
    setNarrowMobile(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const cycleDrawingSnap = () => setDrawingSnap(current => current === 'off' ? 'weak' : current === 'weak' ? 'strong' : 'off');

  const mobileReference = drawingToolbarOverlay && narrowMobile;
  const visibleToolGroups = useMemo(
    () => (mobileReference
      ? toolGroups
          .map(group => group.filter(([id]) => !MOBILE_HIDDEN_DRAWING_TOOLS.has(id)))
          .filter(group => group.length)
      : toolGroups),
    [mobileReference],
  );

  useEffect(() => {
    if (!mobileReference || !MOBILE_HIDDEN_DRAWING_TOOLS.has(selectedTool)) return;
    onSelectTool('cursor');
  }, [mobileReference, onSelectTool, selectedTool]);

  const oscillatorCount = indicators.filter(item => item.visible !== false && oscillatorIds.has(item.id)).length;
  const priceScaleAnchors = useMemo(() => {
    const passive = [];
    const priority = [];
    const push = (target, value) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) target.push(numeric);
    };

    (Array.isArray(positions) ? positions : []).forEach(position => {
      if (String(position?.symbol || '').toUpperCase() !== String(symbol || '').toUpperCase()) return;
      push(passive, position?.entry ?? position?.entryPrice);
      push(passive, position?.sl);
      push(passive, position?.tp);
    });

    (Array.isArray(pendingOrders) ? pendingOrders : []).forEach(order => {
      if (String(order?.symbol || '').toUpperCase() !== String(symbol || '').toUpperCase()) return;
      push(passive, order?.entry);
      push(passive, order?.sl);
      push(passive, order?.tp);
      push(passive, order?.limitPrice);
    });

    if (String(tradePlan?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase()) {
      push(priority, tradePlan?.entry);
      push(priority, tradePlan?.sl);
      push(priority, tradePlan?.tp);
      push(priority, tradePlan?.limitPrice);
    }

    const priorityUnique = [...new Set(priority)];
    const passiveUnique = [...new Set(passive)].filter(value => !priorityUnique.includes(value));
    if (desktopEnhanced) return [...priorityUnique, ...passiveUnique];

    const bid = Number(price);
    const offer = Number(ask);
    const reference = Number.isFinite(bid) && Number.isFinite(offer)
      ? (bid + offer) / 2
      : Number.isFinite(bid)
        ? bid
        : Number.isFinite(offer)
          ? offer
          : null;
    const sortedNearby = Number.isFinite(reference)
      ? passiveUnique.slice().sort((left, right) => Math.abs(left - reference) - Math.abs(right - reference))
      : passiveUnique.slice();

    if (mobileReference && Number.isFinite(reference)) {
      const pip = Number(instrumentPipSize(instrument));
      const sensibleRange = Math.max(
        Math.abs(reference) * 0.015,
        Number.isFinite(pip) && pip > 0 ? pip * 400 : 0,
      );
      const nearby = sortedNearby
        .filter(value => Math.abs(value - reference) <= sensibleRange)
        .slice(0, 4);
      return [...priorityUnique, ...nearby];
    }

    return [...priorityUnique, ...sortedNearby.slice(0, 8)];
  }, [ask, desktopEnhanced, instrument, mobileReference, pendingOrders, positions, price, symbol, tradePlan]);

  useEffect(() => {
    const updateClock = () => setClockNow(new Date());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const heightClass = oscillatorCount ? (oscillatorCount > 1 ? 'h-[500px] md:h-[580px]' : 'h-[430px] md:h-[520px]') : 'h-[360px] md:h-[460px]';
  const toolbarVisible = compactContext ? true : !hideToolbar && drawingToolbarOpen;
  const compactTool = visibleToolGroups.flat().find(([id]) => id === selectedTool) || visibleToolGroups.flat()[0] || null;
  const mobileHeightClass = fillAvailableHeight ? 'h-full min-h-0 flex-1' : heightClass;
  const areaClass = drawingToolbarOverlay
    ? `acg-mobile-reference-chart-area acg-mobile-chart-surface relative grid ${mobileHeightClass} grid-cols-[minmax(0,1fr)] bg-[#081019]`
    : embedded
      ? `grid h-full min-h-0 grid-rows-[minmax(0,1fr)] ${!toolbarVisible ? 'grid-cols-[minmax(0,1fr)]' : desktopEnhanced ? 'grid-cols-[50px_minmax(0,1fr)]' : 'grid-cols-[36px_minmax(0,1fr)]'} ${desktopEnhanced ? 'gap-2 bg-black' : 'gap-1.5'}`
      : focusMode
        ? narrowMobile
          ? 'relative grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] px-1.5 pb-1.5'
          : 'grid h-full min-h-0 grid-cols-[36px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-1.5 px-1.5 pb-1.5'
        : `grid ${heightClass} grid-cols-[34px_minmax(0,1fr)] gap-2 px-2 pb-2`;

  const toolbarClass = drawingToolbarOverlay
    ? 'acg-mobile-reference-drawing-rail absolute bottom-1 left-1 top-1 z-40 flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto rounded-[8px] border border-white/[0.08] bg-[#071019]/98 py-1 shadow-[6px_0_18px_rgba(0,0,0,.28)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : focusMode || embedded
      ? desktopEnhanced
        ? compactContext
          ? 'flex min-h-0 flex-col items-center overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#0A0C0F] py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.018)]'
          : 'flex min-h-0 flex-col items-center gap-1 overflow-y-auto rounded-[14px] border border-white/[0.07] bg-[#0A0C0F] py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.018)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        : focusMode && narrowMobile
          ? 'absolute bottom-1 left-1 top-1 z-40 flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto rounded-[8px] border border-white/[0.08] bg-[#08090b]/98 py-1 shadow-[6px_0_18px_rgba(0,0,0,.28)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto bg-transparent py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      : 'flex min-h-0 flex-col items-center gap-0.5 bg-transparent py-1';

  return (
    <div className={areaClass}>
      {toolbarVisible && (
        <aside className={toolbarClass} aria-label="Drawing tools">
          {compactContext ? (
            compactTool && (() => {
              const [id, Icon, label] = compactTool;
              return (
                <button
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => onSelectTool(id)}
                  className={`acg-mobile-drawing-tool grid size-[40px] shrink-0 place-items-center rounded-md bg-[#10202a] text-[#195be1] ring-1 ring-inset ring-[#195be1]/80 transition`}
                >
                  <Icon size={19} strokeWidth={1.8}/>
                </button>
              );
            })()
          ) : (
            <>
                        {visibleToolGroups.map((group, groupIndex) => (
                          <React.Fragment key={groupIndex}>
                            {groupIndex > 0 && <div className={`${desktopEnhanced ? 'my-1.5 w-6' : 'my-1 w-5'} h-px shrink-0 bg-white/[0.07]`} />}
                            {group.map(([id, Icon, label]) => (
                              <button
                                key={id}
                                type="button"
                                title={label}
                                onClick={() => {
                                  if (tradePlan) return;
                                  setShowDrawings(true);
                                  onSelectTool(id);
                                }}
                                aria-label={label}
                                title={label}
                                disabled={Boolean(tradePlan)}
                                className={`acg-mobile-drawing-tool relative grid ${desktopEnhanced ? 'size-[40px]' : focusMode ? 'size-[34px]' : 'size-[32px]'} shrink-0 place-items-center rounded-md transition ${selectedTool === id ? 'acg-mobile-drawing-tool-selected bg-[#10202a] text-[#195be1] ring-1 ring-inset ring-[#195be1]' : 'text-[#77838f] hover:bg-white/[0.055] hover:text-[#eef3f7]'} disabled:cursor-not-allowed disabled:opacity-30`}
                              >
                                <Icon size={desktopEnhanced ? 19 : focusMode ? 17 : 16} strokeWidth={desktopEnhanced ? 1.8 : 1.75} />
                              </button>
                            ))}
                          </React.Fragment>
                        ))}
                        <div className={`${desktopEnhanced ? 'my-1.5 w-6' : 'my-1 w-5'} h-px shrink-0 bg-white/[0.07]`} />
                        <button type="button" onClick={() => setShowDrawings(value => !value)} className={`relative grid ${desktopEnhanced ? 'size-[40px]' : focusMode ? 'size-[34px]' : 'size-[32px]'} shrink-0 place-items-center rounded-md transition ${showDrawings ? 'text-[#77838f] hover:bg-white/[0.055] hover:text-[#eef3f7]' : 'bg-[#10202a] text-[#195be1]'}`} title={showDrawings ? 'Hide all drawings' : 'Show all drawings'}>{showDrawings ? <Eye size={desktopEnhanced ? 18 : 14}/> : <EyeOff size={desktopEnhanced ? 18 : 14}/>}<span className="absolute bottom-0.5 right-0.5 min-w-3 rounded bg-black/75 px-0.5 text-center text-[6px] font-black leading-3 text-[#72879a]">{drawingCount}</span></button>
                        <button type="button" onClick={cycleDrawingSnap} disabled={Boolean(tradePlan)} className={`relative grid ${desktopEnhanced ? 'size-[40px]' : focusMode ? 'size-[34px]' : 'size-[32px]'} shrink-0 place-items-center rounded-md transition ${drawingSnap !== 'off' ? 'bg-[#10202a] text-[#195be1]' : 'text-[#77838f] hover:bg-white/[0.055] hover:text-[#eef3f7]'} disabled:opacity-30`} title={drawingSnap === 'off' ? 'Magnet off — click for weak OHLC snapping' : drawingSnap === 'weak' ? 'Weak OHLC magnet — click for strong' : 'Strong OHLC magnet — click to turn off'}><Magnet size={desktopEnhanced ? 18 : 15}/>{drawingSnap !== 'off' && <span className="absolute bottom-0.5 right-1 text-[6px] font-black leading-none text-[#195be1]">{drawingSnap === 'strong' ? 'S' : 'W'}</span>}</button>
                        <button type="button" onClick={() => setLockAllDrawings(value => !value)} disabled={Boolean(tradePlan)} className={`grid ${desktopEnhanced ? 'size-[40px]' : focusMode ? 'size-[34px]' : 'size-[32px]'} shrink-0 place-items-center rounded-md transition ${lockAllDrawings ? 'bg-[#10202a] text-[#195be1]' : 'text-[#77838f] hover:bg-white/[0.055] hover:text-[#eef3f7]'} disabled:opacity-30`} title={lockAllDrawings ? 'Unlock drawing movement' : 'Lock all drawing movement'}>{lockAllDrawings ? <Lock size={desktopEnhanced ? 18 : 14}/> : <Unlock size={desktopEnhanced ? 18 : 14}/>}</button>
                        <button type="button" onClick={() => setKeepDrawingTool(value => !value)} disabled={Boolean(tradePlan) || selectedTool === 'cursor'} className={`relative grid ${desktopEnhanced ? 'size-[40px]' : focusMode ? 'size-[34px]' : 'size-[32px]'} shrink-0 place-items-center rounded-md transition ${keepDrawingTool ? 'bg-[#10202a] text-[#195be1]' : 'text-[#77838f] hover:bg-white/[0.055] hover:text-[#eef3f7]'} disabled:opacity-25`} title="Keep selected drawing tool active"><Pin size={desktopEnhanced ? 18 : 14}/>{keepDrawingTool && <span className="absolute bottom-1 right-1 size-1 rounded-full bg-[#195be1]"/>}</button>
              
            </>
          )}
        </aside>
      )}

      <div className={`relative h-full min-h-0 min-w-0 overflow-hidden ${desktopEnhanced ? 'rounded-[14px] border border-white/[0.06] bg-[#080A0C] shadow-[inset_0_1px_0_rgba(255,255,255,0.012)]' : 'bg-[#09090b]'}`}>
        <div className={`relative h-full min-h-0 min-w-0 overflow-hidden ${desktopEnhanced ? 'rounded-[13px] bg-[#07090B]' : 'bg-[#09090b]'} ${drawingToolbarOverlay ? (toolbarVisible ? '' : 'pl-3') : ''}`}>
        <TradingChart
          symbol={symbol}
          instrument={instrument}
          timeframe={chartTimeframe}
          tick={tick}
          chartMode={chartMode}
          bidPrice={price}
          askPrice={ask}
          positions={positions}
          indicators={indicators}
          onCoordinateApi={setCoordinateApi}
          showBidAskLines={desktopEnhanced && !compactContext}
          showMobileQuoteMarkers={mobileReference}
          mobileReference={mobileReference}
          showPositionPriceLines={false}
          priceScaleAnchors={priceScaleAnchors}
          showIndicatorControls={desktopEnhanced && !compactContext}
          showAttributionLogo={false}
          desktopEnhanced={desktopEnhanced}
          compactContext={compactContext}
          onToggleIndicator={onToggleIndicator}
          onOpenIndicatorSettings={onOpenIndicatorSettings}
          onRemoveIndicator={onRemoveIndicator}
        />
        {!compactContext && showDrawings && <DrawingLayer
          symbol={symbol}
          timeframe={chartTimeframe}
          tool={selectedTool}
          onToolChange={onSelectTool}
          disabled={Boolean(tradePlan)}
          coordinateApi={coordinateApi}
          keepToolActive={keepDrawingTool}
          snapMode={drawingSnap}
          snapStep={instrumentPipSize(instrument)}
          lockAll={lockAllDrawings}
          onDrawingCountChange={setDrawingCount}
          instrument={instrument}
          account={account}
          riskPercent={riskPercent}
          accountCurrency={accountCurrency}
          onCreateRiskOrder={onCreateRiskOrder}
          chartInstanceId={chartInstanceId}
          interactionEnabled={drawingInteractionEnabled}
          showHistoryControls={!mobileReference && (!drawingToolbarOverlay || toolbarVisible)}
        />}
        <TradePlanOverlay plan={tradePlan} onChange={onTradePlanChange} coordinateApi={coordinateApi} instrument={instrument} lots={tradePlanLots} accountCurrency={accountCurrency} account={account} riskPercent={riskPercent} />
        {positionProtectionDraft && (
          <TradePlanOverlay
            plan={positionProtectionDraft}
            onChange={onPositionProtectionDraftChange}
            coordinateApi={coordinateApi}
            instrument={instrument}
            lots={Number(positionProtectionDraft.manualLots) || tradePlanLots}
            accountCurrency={accountCurrency}
            account={account}
            riskPercent={riskPercent}
            showEntry={false}
          />
        )}
        {!tradePlan?.open && <PendingOrderOverlay symbol={symbol} orders={pendingOrders} coordinateApi={coordinateApi} instrument={instrument} hiddenOrderId={tradePlan?.editingOrderId || null} onModify={onModifyPending} onCancel={onCancelPending} />}
        <OpenPositionEntryOverlay symbol={symbol} positions={positions.filter(position => !(tradePlan?.open && String(tradePlan?.positionId) === String(position?.id)))} coordinateApi={coordinateApi} instrument={instrument} selectedPositionId={selectedPositionId} onSelectPosition={onSelectPosition} onClosePosition={onClosePosition} />
        <OpenPositionProtectionOverlay
          symbol={symbol}
          positions={positions.filter(position =>
            !(tradePlan?.open && String(tradePlan?.positionId) === String(position?.id))
            && !(positionProtectionDraft && String(positionProtectionDraft.positionId) === String(position?.id))
          )}
          coordinateApi={coordinateApi}
          instrument={instrument}
          onUpdatePosition={onUpdatePosition}
          selectedPositionId={selectedPositionId}
          onSelectPosition={onSelectPosition}
        />

        {desktopEnhanced && !compactContext && (
          <div className="absolute right-[74px] top-2 z-30 flex items-center gap-1">
            <div className="pointer-events-none mr-1 flex h-7 items-center rounded-md border border-white/[0.06] bg-black/86 px-2.5 text-[9px] font-medium tabular-nums text-[#7E8994] backdrop-blur-sm">
              <span>Spread&nbsp;<b className="font-mono font-semibold text-[#B9C2CA]">{formatSpreadDisplay(price, ask, instrument)}</b></span>
            </div>
            <button type="button" onClick={() => coordinateApi?.resetView?.()} className="grid size-7 place-items-center rounded border border-white/[0.06] bg-[#07090B]/92 text-[#6F8191] hover:text-[#E6EDF3]" title="Reset chart view"><RotateCcw size={11}/></button>
            <button type="button" onClick={() => coordinateApi?.fitContent?.()} className="grid size-7 place-items-center rounded border border-white/[0.06] bg-[#07090B]/92 text-[#6F8191] hover:text-[#E6EDF3]" title="Fit chart"><ScanLine size={11}/></button>
            <button type="button" onClick={() => setShowDrawings(value => !value)} className={`grid size-7 place-items-center rounded border bg-[#07090B]/92 ${showDrawings ? 'border-white/[0.06] text-[#6F8191] hover:text-[#E6EDF3]' : 'border-[#195be1] text-[#195be1]'}`} title={showDrawings ? 'Hide drawings' : 'Show drawings'}>{showDrawings ? <Eye size={11}/> : <EyeOff size={11}/>}</button>
          </div>
        )}

        {!compactContext && !drawingToolbarOverlay && !tradePlan && (!embedded || desktopEnhanced) && (
          <div className="pointer-events-auto absolute bottom-2 right-[64px] z-30 flex items-center gap-2 font-mono text-[8px] font-medium tabular-nums text-[#737D87]">
            <span>{localUtcLabel(clockNow)}</span>
            <span className="text-[#9AA4AE]" title="Current local chart time">{localClockLabel(clockNow)}</span>
            <button
              type="button"
              onClick={() => coordinateApi?.resetView?.()}
              className="font-mono text-[8px] font-medium text-[#7F8993] transition hover:text-[#D9E0E6]"
              title="Return to live chart and restore the default view"
            >
              Auto
            </button>
          </div>
        )}
        </div>

        {drawingToolbarOverlay && !tradePlan && (
          <div className="pointer-events-auto absolute bottom-0 right-0 z-30 flex h-5 items-center overflow-hidden rounded-tl-[4px] border-l border-t border-white/[0.08] bg-black/88 text-[7px] font-medium text-[#7E8994] shadow-[-4px_-2px_10px_rgba(0,0,0,.22)] backdrop-blur-sm">
            <span className="border-r border-white/[0.07] px-1.5">{localUtcLabel(clockNow)}</span>
            <span className="border-r border-white/[0.07] px-1.5 font-mono font-semibold tabular-nums text-[#B9C2CA]" title="Current local chart time">{localClockLabel(clockNow)}</span>
            <button type="button" onClick={() => coordinateApi?.resetView?.()} className="h-full px-1.5 font-semibold text-[#929DA7] transition active:bg-white/[0.05] active:text-[#F1F4F6]" title="Return to live chart and restore the default view">Auto</button>
          </div>
        )}
      </div>
    </div>
  );
}
