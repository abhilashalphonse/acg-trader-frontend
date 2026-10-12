import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, ScanLine, Magnet, Lock, Unlock, Pin } from 'lucide-react';
import TradingChart from '../TradingChart.jsx';
import DrawingLayer from './DrawingLayer.jsx';
import { formatInstrumentPrice, formatSpreadDisplay, instrumentPipSize } from '../../utils/instrumentFormatting.js';
import { positionCloseAvailability } from '../../utils/marketExecutionAvailability.js';
import { estimateLossAtStopWithCosts, estimatePositionPnlAtPrice, estimateStopRisk, positionDistancePips } from '../../utils/tradingRisk.js';
import { resolveExecutionPreview } from '../../utils/executionPricing.js';
import { effectiveTradePlan } from '../../utils/tradePlanExecution.js';
import { chartEntryReference, chartLineStyle, chartPriceChangePercent, chartEstimateCurrencySupported } from '../../utils/chartOrderPresentation.js';
import { DRAWING_TOOL_GROUPS, DRAWING_TOOL_LABELS } from '../../utils/drawingTools.js';
import { DRAWING_TOOL_ICONS } from './DrawingToolIcons.jsx';
import { chartTimezoneLabel, formatChartClock } from '../../utils/desktopChartSettings.js';

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

// Single desktop label treatment shared by draft, accepted pending and live position levels.
// Visual status changes the line style; we intentionally do not add "planned" wording.
function ChartLevelBadge({ label, price, amount = null, percent = null, color = '#aab8c5', onPointerDown, onClick, onRemove, removeLabel = 'Remove level', tooltip = null }) {
  const isInteractive = Boolean(onPointerDown || onClick);
  return (
    <div
      className={`pointer-events-auto absolute right-[70px] top-1/2 z-20 flex h-7 max-w-[calc(100%-84px)] -translate-y-1/2 items-center gap-2 overflow-hidden rounded-[5px] border bg-[#111419]/96 px-2 font-mono text-[10px] font-semibold tabular-nums shadow-[0_3px_12px_rgba(0,0,0,.36)] backdrop-blur-sm ${onPointerDown ? 'cursor-ns-resize touch-none' : ''}`}
      style={{ borderColor: `${color}aa` }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      title={tooltip || undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(event); } } : undefined}
    >
      <span aria-hidden="true" className="shrink-0 text-[11px] tracking-[-2px] text-[#788592]">⠿</span>
      <span className="shrink-0 font-sans font-semibold" style={{ color }}>{label}</span>
      {price != null && <span className="shrink-0 text-[#e5ebf0]">{price}</span>}
      {amount != null && <span className="shrink-0 rounded-[3px] px-1.5 py-0.5" style={{ color, backgroundColor: `${color}1b` }}>{amount}</span>}
      {percent != null && <span className="shrink-0 font-sans font-medium text-[#919ba6]">{Number(percent).toFixed(2)}%</span>}
      {onRemove && <button type="button" className="ml-0.5 grid size-5 shrink-0 place-items-center rounded text-[#9aa5af] hover:bg-white/10 hover:text-white" aria-label={removeLabel} onPointerDown={event => event.stopPropagation()} onClick={event => { event.preventDefault(); event.stopPropagation(); onRemove(); }}>×</button>}
    </div>
  );
}

function OpenPositionEntryOverlay({ symbol, positions = [], coordinateApi, instrument, selectedPositionId = null, onSelectPosition = () => {}, onClosePosition = () => {} }) {
  const [, forceLayout] = useState(0);
  const closeAvailability = positionCloseAvailability(instrument);
  const closeDisabled = !closeAvailability.allowed;

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
                  disabled={closeDisabled}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (closeDisabled) return;
                    void onClosePosition(position.id, 100);
                  }}
                  className="grid w-7 place-items-center text-[13px] leading-none transition hover:bg-white/[0.05] active:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ color: closeColor }}
                  aria-label={`Close ${side} ${position.symbol || symbol} position`}
                  title={closeDisabled ? closeAvailability.reason : 'Close position'}
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

function ClosedPositionChartOverlay({ symbol, position = null, coordinateApi, instrument, onClear = () => {} }) {
  const [, forceLayout] = useState(0);

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

  if (!position || !coordinateApi?.priceToY) return null;
  if (String(position?.symbol || '').toUpperCase() !== String(symbol || '').toUpperCase()) return null;

  const entry = Number(position?.entry ?? position?.entryPrice);
  const exit = Number(position?.closePrice ?? position?.exitPrice);
  const pnl = Number(position?.pnl);
  const currency = position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
  const exitTone = Number.isFinite(pnl) && pnl < 0 ? '#ff5968' : '#35d79d';
  const levels = [
    { key: 'entry', label: 'ENTRY', price: entry, color: '#5d8dff' },
    { key: 'exit', label: 'EXIT', price: exit, color: exitTone },
  ].filter(level => Number.isFinite(level.price) && level.price > 0);

  if (!levels.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[33] overflow-hidden">
      <div className="pointer-events-auto absolute right-[58px] top-[58px] z-20 flex h-7 items-center overflow-hidden rounded-md border border-white/[0.10] bg-[#08090b]/95 font-mono text-[8px] font-semibold text-[#d6dde5] shadow-[0_4px_16px_rgba(0,0,0,.32)]">
        <span className="px-2">Closed · {formatPositionPnl(pnl, currency)}</span>
        <button type="button" onClick={onClear} className="grid h-full w-7 place-items-center border-l border-white/[0.08] text-[12px] text-[#8e99a4] active:bg-white/[0.05]" aria-label="Hide closed position from chart">×</button>
      </div>
      {levels.map(level => {
        const y = coordinateApi.priceToY(level.price);
        if (!Number.isFinite(y)) return null;
        return (
          <div key={level.key} className="absolute left-0 right-0" style={{ top: y }}>
            <div className="relative border-t border-dashed" style={{ borderColor: `${level.color}a8` }}>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded-[4px] border bg-[#09090b]/94 px-1.5 py-0.5 font-mono text-[8px] font-bold" style={{ borderColor: `${level.color}88`, color: level.color }}>{level.label}</span>
              <span className="absolute right-[56px] top-1/2 -translate-y-1/2 rounded-[4px] border bg-[#09090b]/94 px-1.5 py-0.5 font-mono text-[8px] font-semibold tabular-nums lg:right-2" style={{ borderColor: `${level.color}88`, color: level.color }}>
                {formatInstrumentPrice(level.price, instrument)}
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
  onMove = () => {},
  desktopStyle = false,
  account = null,
  accountCurrency = 'USD',
}) {
  const layerRef = useRef(null);
  const placedDragRef = useRef({ orderId: null, field: null, startY: null, moved: false });
  const suppressPlacedClickRef = useRef(null);
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const [draggingField, setDraggingField] = useState(null);
  const [previewPrices, setPreviewPrices] = useState({});
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

  useEffect(() => {
    if (!desktopStyle || !draggingOrderId || !draggingField || !coordinateApi?.yToPrice) return undefined;
    const previewKey = `${draggingOrderId}:${draggingField}`;

    const priceFromEvent = event => {
      const rect = layerRef.current?.getBoundingClientRect();
      const clientY = Number(event?.clientY);
      if (!rect || !Number.isFinite(clientY)) return null;
      const converted = coordinateApi.yToPrice(clientY - rect.top);
      return Number.isFinite(converted) && converted > 0 ? converted : null;
    };

    const move = event => {
      const converted = priceFromEvent(event);
      if (converted == null) return;
      const dragMeta = placedDragRef.current;
      if (
        dragMeta?.orderId === draggingOrderId
        && dragMeta?.field === draggingField
        && Number.isFinite(Number(dragMeta?.startY))
        && Math.abs(Number(event?.clientY) - Number(dragMeta.startY)) > 2
      ) {
        placedDragRef.current = { ...dragMeta, moved: true };
      }
      event.preventDefault?.();
      setPreviewPrices(current => ({ ...current, [previewKey]: converted }));
    };

    const finish = (event, commit) => {
      const orderId = draggingOrderId;
      const field = draggingField;
      const converted = commit ? priceFromEvent(event) : null;
      const dragMeta = placedDragRef.current;
      const moved = dragMeta?.orderId === orderId && dragMeta?.field === field && dragMeta?.moved === true;
      if (moved) suppressPlacedClickRef.current = { orderId, field, expiresAt: Date.now() + 350 };
      placedDragRef.current = { orderId: null, field: null, startY: null, moved: false };
      setDraggingOrderId(null);
      setDraggingField(null);

      const clearPreview = () => {
        setPreviewPrices(current => {
          if (!Object.prototype.hasOwnProperty.call(current, previewKey)) return current;
          const next = { ...current };
          delete next[previewKey];
          return next;
        });
      };

      if (converted == null || !moved) {
        clearPreview();
        return;
      }

      setPreviewPrices(current => ({ ...current, [previewKey]: converted }));
      Promise.resolve(onMove(orderId, converted, field)).finally(clearPreview);
    };

    const up = event => finish(event, true);
    const cancel = event => finish(event, false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [coordinateApi, desktopStyle, draggingField, draggingOrderId, onMove]);

  if (!coordinateApi?.priceToY || !activeOrders.length) return null;

  const consumeSuppressedPlacedClick = (orderId, field = null) => {
    const suppressed = suppressPlacedClickRef.current;
    if (!suppressed || suppressed.expiresAt < Date.now() || String(suppressed.orderId) !== String(orderId)) return false;
    if (field && suppressed.field !== field) return false;
    suppressPlacedClickRef.current = null;
    return true;
  };

  const renderProtectionLine = (order, kind, color, label) => {
    const previewKey = `${order.id}:${kind}`;
    const source = !desktopStyle && Object.prototype.hasOwnProperty.call(previewPrices, previewKey)
      ? previewPrices[previewKey]
      : order?.[kind];
    const price = Number(source);
    if (!Number.isFinite(price)) return null;
    const y = coordinateApi.priceToY(price);
    if (!Number.isFinite(y)) return null;
    return (
      <div key={`${order.id}:${kind}`} className="pointer-events-none absolute left-0 right-0 z-[18]" style={{ top: y }}>
        <div className={desktopStyle ? 'relative border-t' : 'relative border-t border-dotted'} style={{ borderColor: `${color}99` }}>
          {desktopStyle ? (
            <ChartLevelBadge
              label={kind === 'sl' ? 'Stop loss' : 'Take profit'}
              price={formatInstrumentPrice(price, instrument)}
              color={color}
              amount={(() => {
                if (!chartEstimateCurrencySupported(instrument, accountCurrency)) return null;
                const base = chartEntryReference({ pending: true, orderType: order.orderType, entry: order.entry, limitPrice: order.limitPrice });
                const lots = Number(order.volume ?? order.lots);
                if (base == null || !Number.isFinite(lots) || lots <= 0) return null;
                const estimated = kind === 'sl'
                  ? estimateLossAtStopWithCosts({ ...order, entry: base, sl: price }, lots, instrument, account)
                  : estimateStopRisk({ ...order, entry: base, sl: price }, lots, instrument, accountCurrency);
                return Number.isFinite(estimated) ? formatPositionPnl(kind === 'sl' ? -estimated : estimated, accountCurrency) : null;
              })()}
              percent={chartPriceChangePercent(chartEntryReference({ pending: true, orderType: order.orderType, entry: order.entry, limitPrice: order.limitPrice }), price)}
              tooltip="Pending-order P&L is an estimate. Stop-limit fills can be better than the limit bound."
              onPointerDown={event => {
                event.preventDefault();
                event.stopPropagation();
                placedDragRef.current = { orderId: order.id, field: kind, startY: Number(event.clientY), moved: false };
                setDraggingOrderId(order.id);
                setDraggingField(kind);
              }}
              onClick={event => { event.stopPropagation(); if (!consumeSuppressedPlacedClick(order.id, kind)) onModify(order.id, kind); }}
            />
          ) : <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded-[4px] border bg-[#09090b]/94 px-1.5 py-0.5 text-[8px] font-black" style={{ borderColor: `${color}70`, color }}>{label}</span>}
          <span className="absolute right-[56px] top-1/2 lg:right-2 -translate-y-1/2 rounded-[4px] border px-1.5 py-0.5 font-mono text-[8px] font-bold tabular-nums" style={{ borderColor: `${color}88`, backgroundColor: kind === 'sl' ? '#5b1721' : '#0b4b37', color: '#ffffff' }}>
            {formatInstrumentPrice(price, instrument)}
          </span>
          {desktopStyle && (
            <button
              type="button"
              aria-label={`Drag pending ${label}`}
              onPointerDown={event => {
                event.preventDefault();
                event.stopPropagation();
                placedDragRef.current = { orderId: order.id, field: kind, startY: Number(event.clientY), moved: false };
                setDraggingOrderId(order.id);
                setDraggingField(kind);
              }}
              className="pointer-events-auto absolute left-[58px] right-[58px] top-1/2 h-7 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[28] overflow-hidden">
      {desktopStyle && activeOrders.length === 1 && activeOrders.map(order => {
        const anchor = chartEntryReference({ pending: true, orderType: order.orderType, entry: order.entry, limitPrice: order.limitPrice });
        const at = coordinateApi.priceToY(anchor);
        if (!Number.isFinite(at)) return null;
        return ['sl', 'tp'].map(field => {
          const y = coordinateApi.priceToY(Number(order[field]));
          if (!Number.isFinite(y) || !Number.isFinite(Number(order[field])) || Number(order[field]) <= 0) return null;
          return <div key={`pending-zone:${field}`} className="pointer-events-none absolute left-[44%] right-0"
            style={{ top: Math.min(y, at), height: Math.abs(y - at), background: field === 'sl' ? 'rgba(187,48,65,0.10)' : 'rgba(28,143,106,0.10)' }} />;
        });
      })}
      {activeOrders.flatMap(order => {
        const rawEntry = Number(order.entry);
        const entryPreviewKey = `${order.id}:entry`;
        const entry = Object.prototype.hasOwnProperty.call(previewPrices, entryPreviewKey)
          ? Number(previewPrices[entryPreviewKey])
          : rawEntry;
        const y = coordinateApi.priceToY(entry);
        if (!Number.isFinite(y)) return [];
        const side = String(order.side || '').toUpperCase();
        const type = String(order.orderType || '').replace('-', ' ').toUpperCase();
        const lots = Number(order.volume ?? order.lots);
        const secondary = order.orderType === 'stop-limit' && Number.isFinite(Number(order.limitPrice))
          ? Number(order.limitPrice)
          : null;
        const secondaryY = secondary == null ? null : coordinateApi.priceToY(secondary);
        const triggerTone = ['stop', 'stop-limit'].includes(order.orderType) ? '#d7a455' : '#acbac7';
        const beginPlacedDrag = (event, field = 'entry') => {
          if (!desktopStyle) return;
          event.preventDefault();
          event.stopPropagation();
          placedDragRef.current = {
            orderId: order.id,
            field,
            startY: Number(event?.clientY),
            moved: false,
          };
          setDraggingOrderId(order.id);
          setDraggingField(field);
        };

        return [
          <div key={`${order.id}:entry`} className="pointer-events-none absolute left-0 right-0 z-[21]" style={{ top: y }}>
            <div className={desktopStyle ? 'relative border-t' : 'relative border-t border-dotted border-[#2f7df4]/90'} style={desktopStyle ? { borderColor: triggerTone } : undefined}>
              {desktopStyle ? (
                <ChartLevelBadge
                  label={`${side} ${type}`}
                  price={formatInstrumentPrice(entry, instrument)}
                  amount={Number.isFinite(lots) ? `${formatPositionLots(lots)} lots` : null}
                  color={triggerTone}
                  tooltip={order.orderType === 'stop-limit' ? 'Stop trigger. The separate limit line is the acceptable execution boundary.' : 'Accepted pending order. Drag to amend; click to modify.'}
                  onPointerDown={event => beginPlacedDrag(event, 'entry')}
                  onClick={event => { event.stopPropagation(); if (!consumeSuppressedPlacedClick(order.id, 'entry')) onModify(order.id); }}
                  onRemove={() => onCancel(order.id)}
                  removeLabel={`Cancel ${side} ${type} pending order`}
                />
              ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={event => {
                  event.stopPropagation();
                  if (consumeSuppressedPlacedClick(order.id)) return;
                  onModify(order.id);
                }}
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
                {desktopStyle && (
                  <>
                    <button
                      type="button"
                      onPointerDown={event => {
                        if (!Number.isFinite(Number(order?.tp))) {
                          event.stopPropagation();
                          return;
                        }
                        beginPlacedDrag(event, 'tp');
                      }}
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (consumeSuppressedPlacedClick(order.id, 'tp')) return;
                        onModify(order.id, 'tp');
                      }}
                      className={`min-w-[34px] border-r border-dotted border-[#3b78d8]/55 px-2 text-[9px] transition ${Number.isFinite(Number(order?.tp)) ? 'text-[#2aa37f]' : 'text-[#23876b] hover:text-[#35d79d]'}`}
                      aria-label="Add or edit take profit"
                      title="Add / edit TP"
                    >
                      TP
                    </button>
                    <button
                      type="button"
                      onPointerDown={event => {
                        if (!Number.isFinite(Number(order?.sl))) {
                          event.stopPropagation();
                          return;
                        }
                        beginPlacedDrag(event, 'sl');
                      }}
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (consumeSuppressedPlacedClick(order.id, 'sl')) return;
                        onModify(order.id, 'sl');
                      }}
                      className={`min-w-[34px] border-r border-dotted border-[#3b78d8]/55 px-2 text-[9px] transition ${Number.isFinite(Number(order?.sl)) ? 'text-[#d45a64]' : 'text-[#b64f59] hover:text-[#e36a74]'}`}
                      aria-label="Add or edit stop loss"
                      title="Add / edit SL"
                    >
                      SL
                    </button>
                  </>
                )}
                <span
                  onPointerDown={event => beginPlacedDrag(event, 'entry')}
                  className={`flex min-w-[42px] items-center justify-center border-r border-white/20 px-2 ${desktopStyle ? 'cursor-ns-resize' : ''}`}
                  title={desktopStyle ? 'Drag pending entry price' : undefined}
                >
                  {Number.isFinite(lots)
                    ? (desktopStyle ? lots.toFixed(Math.max(2, Number(instrument?.volumeStep) < 0.01 ? 3 : 2)) : formatPositionLots(lots))
                    : '—'}
                </span>
                <span
                  onPointerDown={event => beginPlacedDrag(event, 'entry')}
                  className={`flex min-w-[76px] items-center justify-center border-r border-white/20 px-2 ${side === 'BUY' ? 'text-[#35e0a4]' : 'text-[#ff6b77]'} ${desktopStyle ? 'cursor-ns-resize' : ''}`}
                  title={desktopStyle ? 'Drag pending entry price' : undefined}
                >
                  {side} {type}
                </span>
                <button
                  type="button"
                  onPointerDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
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
              )}
              <span className="absolute right-[56px] top-1/2 lg:right-2 -translate-y-1/2 rounded-[4px] border px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-white shadow-[0_3px_10px_rgba(0,0,0,.28)]" style={desktopStyle ? { borderColor: triggerTone, backgroundColor: '#22272d', color: triggerTone } : { borderColor: '#2d68bd', backgroundColor: '#1f5fc4' }}>
                {formatInstrumentPrice(entry, instrument)}
              </span>
              {desktopStyle && (
                <button
                  type="button"
                  aria-label={`Drag ${side} ${type} pending price`}
                  onPointerDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDraggingOrderId(order.id);
                    setDraggingField('entry');
                  }}
                  className="pointer-events-auto absolute left-[225px] right-[58px] top-1/2 z-0 h-8 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent"
                />
              )}
            </div>
          </div>,
          secondaryY != null && Number.isFinite(secondaryY) ? (
            <div key={`${order.id}:limit`} className="pointer-events-none absolute left-0 right-0 z-[19]" style={{ top: secondaryY }}>
              <div className={desktopStyle ? 'relative border-t border-[#b58cff]/80' : 'relative border-t border-dashed border-[#b58cff]/70'}>
                {desktopStyle ? (
                  <ChartLevelBadge
                    label="Limit"
                    price={formatInstrumentPrice(secondary, instrument)}
                    color="#b58cff"
                    tooltip="Sell: minimum acceptable fill. Buy: maximum acceptable fill. Actual execution can be more favorable."
                    onPointerDown={event => beginPlacedDrag(event, 'limitPrice')}
                    onClick={event => { event.stopPropagation(); if (!consumeSuppressedPlacedClick(order.id, 'limitPrice')) onModify(order.id); }}
                  />
                ) : (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded border border-[#6f5b93]/70 bg-black/90 px-1.5 py-0.5 text-[8px] font-bold text-[#c8aaff]">
                    LIMIT {formatInstrumentPrice(secondary, instrument)}
                  </span>
                )}
                {desktopStyle && <span className="absolute right-[56px] top-1/2 -translate-y-1/2 rounded-[4px] border border-[#b58cff]/80 bg-[#21182e] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#d8bdff] lg:right-2">{formatInstrumentPrice(secondary, instrument)}</span>}
                {desktopStyle && <button type="button" aria-label="Drag pending stop-limit limit price"
                  onPointerDown={event => beginPlacedDrag(event, 'limitPrice')}
                  className="pointer-events-auto absolute left-[235px] right-[58px] top-1/2 h-8 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent" />}
              </div>
            </div>
          ) : null,
          renderProtectionLine(order, 'sl', '#ff5968', 'SL'),
          renderProtectionLine(order, 'tp', '#35d79d', 'TP'),
        ].filter(Boolean);
      })}
      {desktopStyle && Object.entries(previewPrices).map(([key, requested]) => {
        const fieldSeparator = key.lastIndexOf(':');
        if (fieldSeparator < 0) return null;
        const orderId = key.slice(0, fieldSeparator);
        const field = key.slice(fieldSeparator + 1);
        const order = activeOrders.find(item => String(item.id) === orderId);
        const level = Number(requested);
        const y = coordinateApi.priceToY(level);
        if (!order || !Number.isFinite(level) || level <= 0 || !Number.isFinite(y)) return null;
        const color = field === 'sl' ? '#ff5968' : field === 'tp' ? '#35d79d' : field === 'limitPrice' ? '#b58cff' : '#d7a455';
        const label = field === 'sl' ? 'Stop loss' : field === 'tp' ? 'Take profit' : field === 'limitPrice' ? 'Limit' : String(order.orderType || '').toLowerCase().includes('stop') ? 'Stop' : 'Entry';
        return (
          <div key={`pending-preview:${key}`} className="pointer-events-none absolute left-0 right-0 z-[29]" style={{ top: y }}>
            <div className={chartLineStyle({ preview: true }) === 'dotted' ? 'relative border-t-2 border-dotted' : 'relative border-t'} style={{ borderColor: color }}>
              <ChartLevelBadge label={label} price={formatInstrumentPrice(level, instrument)} color={color} tooltip="Drag preview: changes are not active until the server accepts them." />
              <span className="absolute right-[56px] top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold lg:right-2" style={{ borderColor: color, backgroundColor: '#111419', color }}>
                {formatInstrumentPrice(level, instrument)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TradePlanOverlay({ plan, onChange, onCancel = () => {}, coordinateApi, instrument, lots = 0.1, accountCurrency = 'USD', account = null, riskPercent = 0.5, orderExecutionPreview = null, showEntry = true, mobileStyle = false }) {
  const layerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [preview, setPreview] = useState({});
  const [, forceLayout] = useState(0);

  useEffect(() => {
    if (!coordinateApi?.subscribe) return undefined;
    return coordinateApi.subscribe(() => forceLayout(value => value + 1));
  }, [coordinateApi]);

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
  const positionProtectionMode = mobileStyle && !showEntry && plan?.source === 'open-position';
  const activeProtectionField = positionProtectionMode && ['sl', 'tp'].includes(plan?.activeField)
    ? plan.activeField
    : null;
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
  const liveLimit = sourcePrice('limitPrice');
  const livePlan = { ...plan, entry: liveEntry, limitPrice: liveLimit, sl: liveSl, tp: liveTp };
  // With no uncommitted chart drag, display the exact same resolved size
  // as the ticket; both derive from the current executable market quote.
  const dragPreviewActive = ['entry', 'sl', 'tp', 'limitPrice']
    .some(field => Object.prototype.hasOwnProperty.call(preview, field));
  const resolvedLive = !dragPreviewActive && orderExecutionPreview
    ? orderExecutionPreview
    : resolveExecutionPreview({
      plan: effectiveTradePlan(livePlan, instrument),
      riskPercent,
      manualLots: plan?.manualLots ?? lots,
      account: account || {},
      instrument,
    });
  const rawDisplayLots = plan?.sizingMode === 'risk'
    ? (resolvedLive.sizing?.lots ?? Number.NaN)
    : (plan?.manualLots ?? lots);
  const displayLots = rawDisplayLots == null ? Number.NaN : Number(rawDisplayLots);
  const riskPricePlan = resolvedLive.riskPlan || resolvedLive.plan || livePlan;
  const liveRisk = Number.isFinite(displayLots) && Number.isFinite(liveEntry) && Number.isFinite(liveSl)
    ? estimateLossAtStopWithCosts(riskPricePlan, displayLots, instrument, account)
    : null;
  const liveReward = Number.isFinite(displayLots) && Number.isFinite(liveEntry) && Number.isFinite(liveTp)
    ? estimateStopRisk({ ...riskPricePlan, sl: liveTp }, displayLots, instrument, accountCurrency)
    : null;
  const lotLabel = Number.isFinite(displayLots) ? `${displayLots.toFixed(Math.max(2, Number(instrument?.volumeStep) < 0.01 ? 3 : 2))} lot` : '— lot';
  const lotCompact = Number.isFinite(displayLots) ? formatPositionLots(displayLots) : '—';
  // A stop-limit may activate at its stop trigger but fills no worse than its
  // limit bound. The shaded preview must agree with risk/margin references.
  const riskReference = chartEntryReference({ pending: plan.pending, orderType: plan.orderType, entry: liveEntry, limitPrice: liveLimit });
  const riskReferenceY = riskReference != null ? coordinateApi.priceToY(riskReference) : entryY;
  const rewardTop = riskReferenceY != null && tpY != null ? Math.min(riskReferenceY, tpY) : null;
  const rewardHeight = riskReferenceY != null && tpY != null ? Math.abs(riskReferenceY - tpY) : 0;
  const riskTop = riskReferenceY != null && slY != null ? Math.min(riskReferenceY, slY) : null;
  const riskHeight = riskReferenceY != null && slY != null ? Math.abs(riskReferenceY - slY) : 0;

  const line = (kind, field, color, label, value, draggable) => {
    const top = yFor(field);
    if (top == null) return null;

    if (positionProtectionMode) {
      if (activeProtectionField && kind !== activeProtectionField) return null;
      const projected = kind === 'sl'
        ? (Number.isFinite(liveRisk) ? -Math.abs(liveRisk) : null)
        : (Number.isFinite(liveReward) ? Math.abs(liveReward) : null);
      const projectedText = Number.isFinite(projected)
        ? formatPositionPnl(projected, accountCurrency)
        : `— ${String(accountCurrency || 'USD').toUpperCase()}`;
      const mutedColor = kind === 'sl' ? '#d45a64' : '#2aa37f';

      return (
        <div className="absolute left-0 right-0 z-30" style={{ top }}>
          <div className="relative border-t border-dotted" style={{ borderColor: `${mutedColor}b5` }}>
            <div
              className="pointer-events-auto absolute left-3 top-1/2 flex h-7 -translate-y-1/2 items-stretch overflow-hidden rounded-[5px] border border-dotted bg-[#09090b]/96 font-mono text-[10px] font-medium tabular-nums shadow-[0_4px_14px_rgba(0,0,0,.28)]"
              style={{ borderColor: `${mutedColor}b5`, color: '#d8dee5' }}
            >
              <span className="flex min-w-[38px] items-center justify-center px-2">{lotCompact}</span>
              <span className="flex min-w-[34px] items-center justify-center border-l border-dotted px-2" style={{ borderColor: `${mutedColor}80`, color: mutedColor }}>{label}</span>
              <span className="flex min-w-[78px] items-center justify-center border-l border-dotted px-2" style={{ borderColor: `${mutedColor}80`, color: mutedColor }}>{projectedText}</span>
              <button
                type="button"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange({ [field]: null, stage: 'ready' });
                }}
                className="grid w-8 place-items-center border-l border-dotted text-[13px] font-normal text-[#9aa4ae] active:bg-white/[0.04]"
                style={{ borderColor: `${mutedColor}80` }}
                aria-label={`Clear ${label}`}
              >
                ×
              </button>
            </div>

            <span
              className="absolute right-[56px] top-1/2 z-10 -translate-y-1/2 rounded-[4px] border border-dotted bg-[#09090b]/96 px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums lg:right-2"
              style={{ borderColor: `${mutedColor}b5`, color: mutedColor }}
            >
              {formatInstrumentPrice(sourcePrice(field), instrument)}
            </span>

            {draggable && (
              <button
                type="button"
                aria-label={`Drag ${label}`}
                onPointerDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragging(kind);
                  onChange({ activeField: kind, stage: `dragging-${kind}` });
                }}
                className="pointer-events-auto absolute left-[12px] right-[56px] top-1/2 z-0 h-8 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent lg:right-2"
              />
            )}
          </div>
        </div>
      );
    }

    if (!mobileStyle && showEntry && (kind === 'sl' || kind === 'tp')) {
      const projected = kind === 'sl'
        ? (Number.isFinite(liveRisk) ? -Math.abs(liveRisk) : null)
        : (Number.isFinite(liveReward) ? Math.abs(liveReward) : null);
      const projectedText = Number.isFinite(projected)
        ? formatPositionPnl(projected, accountCurrency)
        : `— ${String(accountCurrency || 'USD').toUpperCase()}`;
      const mutedColor = kind === 'sl' ? '#d45a64' : '#2aa37f';

      return (
        <div className="absolute left-0 right-0 z-30" style={{ top }}>
          <div className="relative border-t border-dotted" style={{ borderColor: `${mutedColor}b5` }}>
            <ChartLevelBadge
              label={kind === 'sl' ? 'Stop loss' : 'Take profit'}
              price={formatInstrumentPrice(sourcePrice(field), instrument)}
              amount={chartEstimateCurrencySupported(instrument, accountCurrency) ? projectedText : null}
              percent={chartPriceChangePercent(riskReference, sourcePrice(field))}
              color={mutedColor}
              tooltip="Estimated P&L before execution; the actual fill can differ."
              onPointerDown={event => {
                event.preventDefault();
                event.stopPropagation();
                setDragging(kind);
                onChange({ activeField: kind, stage: `dragging-${kind}` });
              }}
              onRemove={() => onChange({ [field]: null, activeField: null, stage: 'ready' })}
              removeLabel={`Clear ${label}`}
            />

            <span
              className="absolute right-[56px] top-1/2 z-10 -translate-y-1/2 rounded-[4px] border border-dotted bg-[#09090b]/96 px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums lg:right-2"
              style={{ borderColor: `${mutedColor}b5`, color: mutedColor }}
            >
              {formatInstrumentPrice(sourcePrice(field), instrument)}
            </span>

            {draggable && (
              <button
                type="button"
                aria-label={`Drag ${label}`}
                onPointerDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragging(kind);
                  onChange({ activeField: kind, stage: `dragging-${kind}` });
                }}
                className="pointer-events-auto absolute left-[235px] right-[56px] top-1/2 z-0 h-8 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent lg:right-2"
              />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="absolute left-0 right-0 z-30" style={{ top }}>
        <div className="relative h-px" style={{ backgroundColor: `${color}bf` }}>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-1 text-[8px] font-black tracking-[0.03em]" style={{ borderColor: `${color}99`, backgroundColor: 'rgba(8,8,8,0.92)', color }}>{label}</span>
          <span className="absolute right-[56px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 font-mono text-[8px] font-extrabold tabular-nums lg:right-2" style={{ backgroundColor: color, color: kind === 'sl' ? '#2b0810' : '#032219' }}>{value}</span>
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

  const entryLabel = plan.pending
    ? `${isBuy ? 'BUY' : 'SELL'} ${String(plan.orderType || '').replace('-', ' ').toUpperCase()}`
    : (isBuy ? 'BUY' : 'SELL');
  // Reuse the established inline TP/SL/entry controls for V4 market drafts.
  // A market entry is read-only; pending orders keep their drag handles.
  const desktopPendingStyle = Boolean(
    showEntry && !mobileStyle && (
      (plan.pending && Object.prototype.hasOwnProperty.call(plan, 'desktopPendingDraft'))
      || plan.source === 'v4-slider'
    )
  );

  const requestDesktopProtection = kind => {
    if (sourcePrice(kind) != null) {
      onChange({ activeField: kind, stage: 'ready' });
      return;
    }

    const base = Number(liveEntry);
    if (!Number.isFinite(base) || base <= 0) return;
    const pip = Number(instrumentPipSize(instrument)) > 0
      ? Number(instrumentPipSize(instrument))
      : Number(instrument?.tickSize) > 0
        ? Number(instrument.tickSize)
        : base * 0.0001;
    const distance = Math.max(
      pip * 10,
      base * (String(instrument?.assetClass || '').toUpperCase() === 'FOREX' ? 0.0005 : 0.0025),
    );
    const next = kind === 'sl'
      ? (isBuy ? base - distance : base + distance)
      : (isBuy ? base + distance * 2 : base - distance * 2);
    onChange({ [kind]: next, activeField: kind, stage: 'ready' });
  };

  const beginProjectedDrag = (event, kind = 'entry') => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(kind);
    onChange({ activeField: ['sl', 'tp'].includes(kind) ? kind : plan?.activeField, stage: `dragging-${kind}` });
  };

  const desktopPendingEntry = desktopPendingStyle && entryY != null ? (
    <div className="absolute left-0 right-0 z-30" style={{ top: entryY }}>
      <div className="relative border-t border-dotted border-[#3b78d8]/90">
        <div className="pointer-events-auto absolute left-3 top-1/2 z-10 flex h-7 -translate-y-1/2 items-stretch overflow-hidden rounded-[5px] border border-dotted border-[#3b78d8]/80 bg-[#09090b]/96 font-mono text-[9px] font-medium tabular-nums shadow-[0_4px_14px_rgba(0,0,0,.28)]">
          {/* TP and SL are independent entry shortcuts only when absent.
              Activating either creates its own line, so its shortcut
              disappears here until that line is removed. */}
          {liveTp == null && (
            <button
              type="button"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                requestDesktopProtection('tp');
              }}
              className="min-w-[34px] border-r border-dotted border-[#3b78d8]/55 px-2 text-[#23876b] transition hover:text-[#35d79d]"
              aria-label="Add TP"
              title="Add TP"
            >
              TP
            </button>
          )}
          {liveSl == null && (
            <button
              type="button"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                requestDesktopProtection('sl');
              }}
              className="min-w-[34px] border-r border-dotted border-[#3b78d8]/55 px-2 text-[#b64f59] transition hover:text-[#e36a74]"
              aria-label="Add SL"
              title="Add SL"
            >
              SL
            </button>
          )}
          <span
            onPointerDown={event => { if (plan.pending) beginProjectedDrag(event, 'entry'); }}
            className={`flex min-w-[46px] items-center justify-center border-r border-dotted border-[#3b78d8]/55 px-2 text-[#d9e1e8] ${plan.pending ? 'cursor-ns-resize' : ''}`}
            title={plan.pending ? 'Drag pending entry price' : 'Draft volume, not submitted'}
          >
            {Number.isFinite(displayLots) ? displayLots.toFixed(Math.max(2, Number(instrument?.volumeStep) < 0.01 ? 3 : 2)) : '—'}
          </span>
          <span
            onPointerDown={event => { if (plan.pending) beginProjectedDrag(event, 'entry'); }}
            className={`flex min-w-[84px] items-center justify-center border-r border-dotted border-[#3b78d8]/55 px-2 ${plan.pending ? 'cursor-ns-resize' : ''} ${isBuy ? 'text-[#35d79d]' : 'text-[#d45a64]'}`}
            title={plan.pending ? 'Drag pending entry price' : 'Unsubmitted draft'}
          >
            {entryLabel}
          </span>
          <button
            type="button"
            onPointerDown={event => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }}
            className="grid w-8 place-items-center text-[13px] text-[#8995a0] transition hover:bg-white/[0.04] hover:text-white"
            aria-label={plan?.editingOrderId ? 'Cancel pending order' : 'Cancel draft'}
            title={plan?.editingOrderId ? 'Cancel pending order' : 'Cancel draft'}
          >
            ×
          </button>
        </div>
        <span className="absolute right-[56px] top-1/2 z-10 -translate-y-1/2 rounded-[4px] border border-dotted border-[#3b78d8]/80 bg-[#113f86]/95 px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums text-white lg:right-2">
          {formatInstrumentPrice(sourcePrice('entry'), instrument)}
        </span>
        <button
          type="button"
          aria-label={plan.pending ? 'Drag pending entry' : 'Draft entry price'}
          disabled={!plan.pending}
          onPointerDown={event => { if (plan.pending) beginProjectedDrag(event, 'entry'); }}
          className={`pointer-events-auto absolute left-[235px] right-[56px] top-1/2 z-0 h-8 -translate-y-1/2 touch-none bg-transparent lg:right-2 ${plan.pending ? 'cursor-ns-resize' : 'cursor-default'}`}
        />
      </div>
    </div>
  ) : null;

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[40] overflow-hidden">
      {!positionProtectionMode && rewardTop != null && <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: rewardTop, height: rewardHeight, background: 'linear-gradient(90deg, rgba(22,134,95,0.10), rgba(34,167,125,0.20))' }} />}
      {!positionProtectionMode && riskTop != null && <div className="pointer-events-none absolute left-[42%] right-0" style={{ top: riskTop, height: riskHeight, background: 'linear-gradient(90deg, rgba(138,43,57,0.10), rgba(255,68,91,0.17))' }} />}
      {line('tp', 'tp', '#35d79d', 'TP', `TP ${formatInstrumentPrice(liveTp, instrument)}`, true)}
      {desktopPendingEntry}
      {showEntry && !desktopPendingStyle && line('entry', 'entry', '#42a5ff', entryLabel, formatInstrumentPrice(sourcePrice('entry'), instrument), Boolean(plan.pending))}
      {showEntry && plan.pending && plan.orderType === 'stop-limit' && line('limit', 'limitPrice', '#b58cff', 'LIMIT', formatInstrumentPrice(sourcePrice('limitPrice'), instrument), true)}
      {line('sl', 'sl', '#ff5968', 'SL', `SL ${formatInstrumentPrice(liveSl, instrument)}`, true)}
      {dragging && !positionProtectionMode && (() => {
        const dragField = dragging === 'limit' ? 'limitPrice' : dragging;
        const dragPrice = sourcePrice(dragField);
        const dragLabel = dragging === 'sl'
          ? 'Stop loss'
          : dragging === 'tp'
            ? 'Take profit'
            : dragging === 'limit'
              ? 'Limit price'
              : 'Entry price';
        const dragTone = dragging === 'sl'
          ? 'text-[#ff6b78]'
          : dragging === 'tp'
            ? 'text-[#53e0ad]'
            : 'text-[#69bdff]';

        return (
          <div className="pointer-events-none absolute right-[64px] top-3 z-40 rounded-lg border border-white/10 bg-[#080808]/95 px-2.5 py-1.5 text-right shadow-xl lg:right-[86px]">
            <div className="text-[8px] uppercase tracking-[0.12em] text-[#708397]">{dragLabel}</div>
            <strong className={`mt-0.5 block text-[11px] ${dragTone}`}>{formatInstrumentPrice(dragPrice, instrument)}</strong>
            {(dragging === 'sl' || dragging === 'tp') && (
              <span className="mt-0.5 block font-mono text-[8px] tabular-nums text-[#8d9aa5]">
                {lotLabel} · {dragging === 'sl'
                  ? (Number.isFinite(liveRisk) ? formatProjectedPnl(-Math.abs(liveRisk), accountCurrency) : '—')
                  : (Number.isFinite(liveReward) ? formatProjectedPnl(Math.abs(liveReward), accountCurrency) : '—')}
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function OpenPositionProtectionOverlay({ symbol, positions = [], coordinateApi, instrument, onUpdatePosition = () => {}, onRemoveProtection = () => {}, onRequestProtectionChange = null, selectedPositionId = null, onSelectPosition = () => {}, mobileStyle = false }) {
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
          if (typeof onRequestProtectionChange === 'function') {
            await onRequestProtectionChange(current.positionId, current.kind, converted);
          } else {
            await onUpdatePosition(current.positionId, { [current.kind]: converted });
          }
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
  }, [coordinateApi, dragging, onRequestProtectionChange, onUpdatePosition]);

  if (!coordinateApi?.priceToY || !activePositions.length) return null;

  const renderLine = (position, kind, color, label) => {
    const key = `${position.id}:${kind}`;
    const source = Object.prototype.hasOwnProperty.call(preview, key) ? preview[key] : position[kind];
    const price = Number(source);
    if (!Number.isFinite(price)) return null;
    const y = coordinateApi.priceToY(price);
    if (!Number.isFinite(y)) return null;

    const projectedPnl = estimatePositionPnlAtPrice(position, price, instrument);
    const currency = position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD';
    const selected = String(selectedPositionId) === String(position.id);
    const active = selected || (dragging?.positionId === position.id && dragging?.kind === kind);

    if (!mobileStyle) {
      const displayPrice = value => formatInstrumentPrice(value, instrument);
      const pips = positionDistancePips(position, price, instrument);
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
    }

    const lots = formatPositionLots(position?.volume ?? position?.lots);
    const pnlText = projectedPnl == null ? `— ${String(currency).toUpperCase()}` : formatPositionPnl(projectedPnl, currency);
    const mutedColor = kind === 'sl' ? '#d45a64' : '#2aa37f';

    return (
      <div key={key} className="pointer-events-none absolute left-0 right-0 z-30" style={{ top: y }}>
        <div className="relative border-t border-dotted" style={{ borderColor: `${mutedColor}${active ? 'c8' : '92'}` }}>
          <div
            className="absolute left-3 top-1/2 z-10 flex h-7 -translate-y-1/2 items-stretch overflow-hidden rounded-[5px] border border-dotted bg-[#09090b]/94 font-mono text-[9px] font-medium tabular-nums"
            style={{ borderColor: `${mutedColor}${active ? 'c8' : '82'}`, color: '#cbd3da' }}
          >
            <span className="flex min-w-[34px] items-center justify-center px-2">{lots}</span>
            <span className="flex min-w-[30px] items-center justify-center border-l border-dotted px-1.5" style={{ borderColor: `${mutedColor}70`, color: mutedColor }}>{label}</span>
            {active && <span className="flex min-w-[74px] items-center justify-center border-l border-dotted px-2" style={{ borderColor: `${mutedColor}70`, color: mutedColor }}>{pnlText}</span>}
            {selected && (
              <button
                type="button"
                onPointerDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemoveProtection(position.id, kind);
                }}
                className="pointer-events-auto grid w-8 place-items-center border-l border-dotted text-[13px] font-normal text-[#9aa4ae] active:bg-white/[0.05]"
                style={{ borderColor: `${mutedColor}70` }}
                aria-label={`Remove ${label}`}
                title={`Remove ${label}`}
              >
                ×
              </button>
            )}
          </div>
          <span
            className="absolute right-[56px] top-1/2 -translate-y-1/2 rounded-[4px] border border-dotted bg-[#09090b]/94 px-1.5 py-0.5 font-mono text-[8px] font-medium tabular-nums lg:right-2"
            style={{ borderColor: `${mutedColor}${active ? 'c8' : '82'}`, color: mutedColor }}
          >
            {formatInstrumentPrice(price, instrument)}
          </span>
          <button
            type="button"
            aria-label={`Drag ${label}`}
            onPointerDown={event => {
              event.preventDefault();
              event.stopPropagation();
              onSelectPosition(position.id);
              setDragging({ positionId: position.id, kind });
            }}
            className="pointer-events-auto absolute left-[12px] right-[56px] top-1/2 z-0 h-7 -translate-y-1/2 cursor-ns-resize touch-none bg-transparent lg:right-2"
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
  orderExecutionPreview = null,
  accountCurrency = 'USD',
  onTradePlanChange = () => {},
  onUpdatePosition = () => {},
  onRemovePositionProtection = () => {},
  onRequestPositionProtection = null,
  selectedPositionId = null,
  onSelectPosition = () => {},
  onClosePosition = () => {},
  historicalPosition = null,
  onClearHistoricalPosition = () => {},
  positionProtectionDraft = null,
  onPositionProtectionDraftChange = () => {},
  indicators = [],
  positions = [],
  pendingOrders = [],
  onModifyPending = () => {},
  onCancelPending = () => {},
  onMovePending = () => {},
  onCancelTradePlan = () => {},
  desktopEnhanced = false,
  compactContext = false,
  chartSettings = null,
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
  mobileOverlayStyle = false,
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
    ? `acg-mobile-reference-chart-area acg-mobile-chart-surface ${toolbarVisible ? 'acg-mobile-reference-chart-area--with-drawing-rail' : 'acg-mobile-reference-chart-area--chart-only'} grid ${mobileHeightClass} ${toolbarVisible ? 'grid-cols-[36px_minmax(0,1fr)] gap-1.5' : 'grid-cols-[minmax(0,1fr)]'} bg-[#081019]`
    : embedded
      ? `grid h-full min-h-0 grid-rows-[minmax(0,1fr)] ${!toolbarVisible ? 'grid-cols-[minmax(0,1fr)]' : desktopEnhanced ? 'grid-cols-[40px_minmax(0,1fr)]' : 'grid-cols-[36px_minmax(0,1fr)]'} ${desktopEnhanced ? 'gap-2 bg-black' : 'gap-1.5'}`
      : focusMode
        ? `grid h-full min-h-0 ${toolbarVisible ? 'grid-cols-[36px_minmax(0,1fr)] gap-1.5' : 'grid-cols-[minmax(0,1fr)]'} grid-rows-[minmax(0,1fr)] px-1.5 pb-1.5`
        : `grid ${heightClass} grid-cols-[34px_minmax(0,1fr)] gap-2 px-2 pb-2`;

  const toolbarClass = drawingToolbarOverlay
    ? 'acg-mobile-reference-drawing-rail mx-0.5 my-1 flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto rounded-[8px] border border-white/[0.08] bg-[#071019] py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : focusMode || embedded
      ? desktopEnhanced
        ? compactContext
          ? 'flex min-h-0 flex-col items-center overflow-hidden rounded-[10px] border border-white/[0.07] bg-[#0A0C0F] py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.018)]'
          : 'flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto rounded-[10px] border border-white/[0.07] bg-[#0A0C0F] py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.018)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
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

      <div className={`relative h-full min-h-0 min-w-0 overflow-hidden ${desktopEnhanced ? 'rounded-[10px] border border-white/[0.06] bg-[#080A0C] shadow-[inset_0_1px_0_rgba(255,255,255,0.012)]' : 'bg-[#09090b]'}`}>
        <div className={`relative h-full min-h-0 min-w-0 overflow-hidden ${desktopEnhanced ? 'rounded-[9px] bg-[#07090B]' : 'bg-[#09090b]'} ${drawingToolbarOverlay ? (toolbarVisible ? '' : 'pl-3') : ''} ${mobileReference ? 'pr-1' : ''}`}>
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
          candleAppearance={desktopEnhanced ? chartSettings?.candle : null}
          viewportSettings={desktopEnhanced ? chartSettings?.viewport : null}
          chartTimezone={desktopEnhanced ? (chartSettings?.timezone || 'UTC') : null}
          layoutRevision={`${toolbarVisible ? 'rail-open' : 'rail-closed'}:${focusMode ? 'focus' : 'normal'}`}
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
          preserveChartCrosshair={desktopEnhanced && !compactContext}
        />}
        <TradePlanOverlay
          plan={tradePlan}
          onChange={onTradePlanChange}
          onCancel={() => {
            if (tradePlan?.editingOrderId) onCancelPending(tradePlan.editingOrderId);
            else onCancelTradePlan();
          }}
          coordinateApi={coordinateApi}
          instrument={instrument}
          lots={tradePlanLots}
          accountCurrency={accountCurrency}
          account={account}
          riskPercent={riskPercent}
          orderExecutionPreview={orderExecutionPreview}
        />
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
            mobileStyle={mobileOverlayStyle}
          />
        )}
        <ClosedPositionChartOverlay symbol={symbol} position={historicalPosition} coordinateApi={coordinateApi} instrument={instrument} onClear={onClearHistoricalPosition} />
        {!tradePlan?.open && <PendingOrderOverlay symbol={symbol} orders={pendingOrders} coordinateApi={coordinateApi} instrument={instrument} hiddenOrderId={tradePlan?.editingOrderId || null} onModify={onModifyPending} onCancel={onCancelPending} onMove={onMovePending} desktopStyle={desktopEnhanced && !mobileOverlayStyle} account={account} accountCurrency={accountCurrency} />}
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
          onRemoveProtection={onRemovePositionProtection}
          onRequestProtectionChange={onRequestPositionProtection}
          selectedPositionId={selectedPositionId}
          onSelectPosition={onSelectPosition}
          mobileStyle={mobileOverlayStyle}
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
            <span>{chartTimezoneLabel(chartSettings?.timezone || 'UTC', instrument)}</span>
            <span className="text-[#9AA4AE]" title="Current chart time">{formatChartClock(clockNow, chartSettings?.timezone || 'UTC', instrument)}</span>
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
            <span className="border-r border-white/[0.07] px-1.5">{chartTimezoneLabel(chartSettings?.timezone || 'UTC', instrument)}</span>
            <span className="border-r border-white/[0.07] px-1.5 font-mono font-semibold tabular-nums text-[#B9C2CA]" title="Current chart time">{formatChartClock(clockNow, chartSettings?.timezone || 'UTC', instrument)}</span>
            <button type="button" onClick={() => coordinateApi?.resetView?.()} className="h-full px-1.5 font-semibold text-[#929DA7] transition active:bg-white/[0.05] active:text-[#F1F4F6]" title="Return to live chart and restore the default view">Auto</button>
          </div>
        )}
      </div>
    </div>
  );
}
