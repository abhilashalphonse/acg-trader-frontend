// Presentation only: these numbers describe an unsubmitted planning drawing,
// not an open trade or a guaranteed P&L. Execution sizing remains server-gated.
const finite = value => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value, digits = 2) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(value);

export function riskPositionReadout(drawing, riskMetrics = null) {
  const entry = finite(drawing?.a?.price);
  const stop = finite(drawing?.b?.price);
  const target = finite(drawing?.riskTarget?.price);
  const isLong = drawing?.type === 'long-position';
  if (![entry, stop, target].every(value => value !== null)) return null;

  const targetDistance = Math.abs(target - entry);
  const stopDistance = Math.abs(stop - entry);
  const targetPercent = entry !== 0 ? targetDistance / Math.abs(entry) * 100 : null;
  const stopPercent = entry !== 0 ? stopDistance / Math.abs(entry) * 100 : null;
  const rr = stopDistance > 0 ? targetDistance / stopDistance : null;
  const riskPct = finite(riskMetrics?.sizing?.actualRiskPercent);
  const quantity = finite(riskMetrics?.sizing?.requestedLots);
  const riskMoney = finite(riskMetrics?.sizing?.actualRisk);
  const sideValid = isLong ? target > entry && stop < entry : target < entry && stop > entry;
  const displayPercent = value => value === null ? '—' : `${formatNumber(value)}%`;

  const targetText = `Target  +${formatNumber(targetDistance)} (${displayPercent(targetPercent)})`;
  const stopText = `Stop  −${formatNumber(stopDistance)} (${displayPercent(stopPercent)})`;
  const rrText = rr === null ? 'R:R —' : `R:R ${formatNumber(rr)}`;
  const riskText = riskPct !== null ? `Risk ${displayPercent(riskPct)}` : 'Risk —';
  const qtyText = quantity !== null && quantity > 0 ? `Qty ${formatNumber(quantity)} lots` : null;
  // A planning drawing has no open P&L. Do not present a target outcome as cash profit.
  const centerText = [rrText, riskText, qtyText].filter(Boolean).join('  ·  ');
  return {
    entry, stop, target, targetDistance, stopDistance, targetPercent, stopPercent,
    rr, riskPct, quantity, riskMoney, sideValid,
    targetText, stopText, rrText, riskText, qtyText, centerText,
    ready: sideValid && riskMetrics?.canCreateOrder === true,
  };
}

export function clampRiskTag(centerX, y, label, maxWidth, maxHeight, fontSize = 10) {
  const maxW = Math.max(56, maxWidth - 12);
  const estimated = Math.max(62, Math.ceil(label.length * fontSize * .56 + 16));
  const width = Math.min(maxW, estimated);
  const height = 21;
  return {
    x: Math.max(6, Math.min(Math.max(6, maxWidth - width - 6), centerX - width / 2)),
    y: Math.max(4, Math.min(Math.max(4, maxHeight - height - 4), y)),
    width, height,
    truncate: estimated > maxW,
  };
}
