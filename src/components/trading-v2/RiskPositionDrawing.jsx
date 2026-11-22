import React from 'react';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
import { drawingOpacity, drawingStrokeWidth, DEFAULT_DRAWING_COLOR } from '../../utils/drawingAppearance.js';
import { clampRiskTag, riskPositionReadout } from '../../utils/riskPositionReadout.js';

const GREEN = '#089981';
const RED = '#E54B61';
const ENTRY_LIGHT = '#7E8996';
const ENTRY_DARK = '#A9B4C0';

function PositionLabel({ text, centerX, y, chartSize, tone = 'neutral', fontSize = 10, theme = 'light', testId }) {
  if (!text) return null;
  const { x, y: top, width, height, truncate } = clampRiskTag(centerX, y, text, chartSize.width, chartSize.height, fontSize);
  const maxChars = Math.max(8, Math.floor((width - 16) / (fontSize * .56)));
  const caption = truncate ? text.slice(0, Math.max(5, maxChars - 1)) + '…' : text;
  const fill = tone === 'target' ? GREEN : tone === 'stop' ? RED :
    theme === 'light' ? '#EFF2F6' : '#242A31';
  const foreground = tone === 'neutral' ? theme === 'light' ? '#394452' : '#E9EFF6' : '#FFFFFF';
  return (
    <g className="pointer-events-none" data-testid={testId} transform={`translate(${x},${top})`}>
      <rect width={width} height={height} rx="4.5" fill={fill}
        stroke={tone === 'neutral' ? theme === 'light' ? '#D6DFE8' : '#515C69' : 'none'} strokeWidth=".75"/>
      <text x={width / 2} y={height / 2 + 3.5} textAnchor="middle" fill={foreground}
        fontSize={fontSize} fontWeight="600" fontFamily="Inter, ui-sans-serif, system-ui"
        style={{ fontVariantNumeric: 'tabular-nums' }}>{caption}</text>
    </g>
  );
}

function RiskAnchor({ point, kind, onPointerDown }) {
  if (!point) return null;
  return (
    <g data-testid={`position-handle-${kind}`}>
      <circle cx={point.x} cy={point.y} r="14" fill="transparent"
        className="pointer-events-auto cursor-grab" onPointerDown={onPointerDown}/>
      {kind === 'entry'
        ? <circle cx={point.x} cy={point.y} r="5.5" fill="#FFFFFF" stroke="#2563EB"
          strokeWidth="1.8" className="pointer-events-none" vectorEffect="non-scaling-stroke"/>
        : <rect x={point.x - 5.25} y={point.y - 5.25} width="10.5" height="10.5" rx="2"
          fill="#FFFFFF" stroke="#2563EB" strokeWidth="1.8"
          vectorEffect="non-scaling-stroke" className="pointer-events-none"/>}
    </g>
  );
}

export default function RiskPositionDrawing({
  drawing, a, b, target, selected, effectiveLocked, common,
  interactive, onStartHandle, size, riskMetrics, instrument,
  chartTheme = 'dark',
}) {
  const theme = chartTheme === 'light' ? 'light' : 'dark';
  const isLong = drawing.type === 'long-position';
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  // Render the real anchor span. Artificial minimum widths displaced the
  // visible box from its draggable anchors on narrow drawings.
  const width = Math.max(1, right - left);
  const entryY = a.y, stopY = b.y, targetY = target.y;
  const rewardTop = Math.min(entryY, targetY);
  const rewardHeight = Math.max(1, Math.abs(entryY - targetY));
  const riskTop = Math.min(entryY, stopY);
  const riskHeight = Math.max(1, Math.abs(entryY - stopY));
  const entryColor = drawing.style?.color || DEFAULT_DRAWING_COLOR;
  const opacity = drawingOpacity(drawing.style);
  const showDetails = Boolean(selected && interactive);
  const readout = riskPositionReadout(drawing, riskMetrics);
  const entryPrice = formatInstrumentPrice(drawing.a?.price, instrument);
  const targetPrice = formatInstrumentPrice(drawing.riskTarget?.price, instrument);
  const stopPrice = formatInstrumentPrice(drawing.b?.price, instrument);
  const longTarget = isLong ? targetY - 30 : targetY + 9;
  const longStop = isLong ? stopY + 9 : stopY - 30;
  const centerX = left + width / 2;
  const small = size.width < 520 || width < 175;
  const targetText = readout
    ? (small ? `Target ${targetPrice} · +${readout.targetPercent?.toFixed(2) ?? '—'}%`
      : `${readout.targetText} · ${targetPrice}`)
    : `Target ${targetPrice}`;
  const stopText = readout
    ? (small ? `Stop ${stopPrice} · −${readout.stopPercent?.toFixed(2) ?? '—'}%`
      : `${readout.stopText} · ${stopPrice}`)
    : `Stop ${stopPrice}`;
  const priceX = Math.min(size.width - 24, right + 43);
  const outlineStrength = showDetails ? .72 : .35;
  const borderTarget = `rgba(8,153,129,${outlineStrength})`;
  const borderStop = `rgba(229,75,97,${outlineStrength})`;
  const entryStroke = entryColor === DEFAULT_DRAWING_COLOR
    ? theme === 'light' ? ENTRY_LIGHT : ENTRY_DARK : entryColor;
  const entryDetails = readout?.centerText || 'Risk sizing not available';
  const selectedSummary = readout && !readout.ready ? `${entryDetails} · Check setup` : entryDetails;
  // Keep the one-line summary near entry, not a large panel obscuring the stop zone.
  const summaryY = isLong ? entryY + 8 : entryY - 29;

  return (
    <g data-testid="risk-position-drawing" data-position-side={isLong ? 'long' : 'short'}
      data-selected={showDetails ? 'true' : 'false'}>
      <rect data-testid="risk-reward-zone" x={left} y={rewardTop} width={width} height={rewardHeight}
        fill={theme === 'light' ? 'rgba(8,153,129,0.14)' : 'rgba(8,153,129,0.16)'}
        stroke={borderTarget} strokeWidth={showDetails ? 1 : .75}
        vectorEffect="non-scaling-stroke" {...common}/>
      <rect data-testid="risk-stop-zone" x={left} y={riskTop} width={width} height={riskHeight}
        fill={theme === 'light' ? 'rgba(229,75,97,0.13)' : 'rgba(229,75,97,0.16)'}
        stroke={borderStop} strokeWidth={showDetails ? 1 : .75}
        vectorEffect="non-scaling-stroke" {...common}/>
      <line x1={left} y1={entryY} x2={right} y2={entryY}
        stroke={entryStroke} strokeOpacity={opacity} strokeWidth={drawingStrokeWidth(drawing.style)}
        vectorEffect="non-scaling-stroke" {...common}/>
      {/* These labels describe hypothetical levels, never real open P&L. */}
      {showDetails ? (
        <>
          <PositionLabel text={targetText} centerX={centerX} y={longTarget}
            chartSize={size} tone="target" theme={theme} testId="position-target-label"/>
          <PositionLabel text={stopText} centerX={centerX} y={longStop}
            chartSize={size} tone="stop" theme={theme} testId="position-stop-label"/>
          <PositionLabel text={selectedSummary} centerX={centerX} y={summaryY}
            chartSize={size} tone="neutral" theme={theme} fontSize={9.5} testId="position-risk-summary"/>
          <PositionLabel text={`Entry ${entryPrice}`} centerX={priceX} y={entryY - 11}
            chartSize={size} tone="neutral" theme={theme} fontSize={9} testId="position-entry-label"/>
        </>
      ) : (
        <>
          <PositionLabel text={targetPrice} centerX={priceX} y={targetY - 10}
            chartSize={size} tone="target" theme={theme} fontSize={9.5} testId="position-target-price"/>
          <PositionLabel text={stopPrice} centerX={priceX} y={stopY - 10}
            chartSize={size} tone="stop" theme={theme} fontSize={9.5} testId="position-stop-price"/>
          <PositionLabel text={entryPrice} centerX={priceX} y={entryY - 10}
            chartSize={size} tone="neutral" theme={theme} fontSize={9.5} testId="position-entry-price"/>
        </>
      )}
      {interactive && selected && !effectiveLocked && (
        <>
          <RiskAnchor point={a} kind="entry" onPointerDown={event => onStartHandle(event, drawing.id, 'a')}/>
          <RiskAnchor point={b} kind="stop" onPointerDown={event => onStartHandle(event, drawing.id, 'b')}/>
          <RiskAnchor point={target} kind="target" onPointerDown={event => onStartHandle(event, drawing.id, 'riskTarget')}/>
        </>
      )}
    </g>
  );
}
