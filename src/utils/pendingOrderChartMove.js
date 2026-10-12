// Pure chart-edit projection. The backend remains authoritative for every amendment.
export function buildChartPendingAmendment(order, nextPrice, field = 'entry') {
  const removal = nextPrice === null && (field === 'sl' || field === 'tp');
  const value = removal ? null : Number(nextPrice);
  if (!order || (!removal && (!Number.isFinite(value) || value <= 0))) return null;
  const existingEntry = Number(order.entry);
  const existingLimit = Number(order.limitPrice);
  const stopLimit = String(order.orderType || '').toLowerCase() === 'stop-limit';
  const replacement = {
    entry: order.entry,
    volume: order.volume ?? order.lots,
    stopLoss: order.sl,
    takeProfit: order.tp,
    timeInForce: order.expiration || 'GTC',
    expiresAt: order.expiresAt || null,
  };
  if (field === 'sl') replacement.stopLoss = removal ? null : value;
  else if (field === 'tp') replacement.takeProfit = removal ? null : value;
  else if (field === 'limitPrice') {
    if (!stopLimit) return null;
    replacement.limitPrice = value;
  } else if (field === 'entry') {
    replacement.entry = value;
    // Moving the stop trigger moves the limit leg by the same delta;
    // dragging the separate limit line above moves only that leg.
    if (stopLimit && Number.isFinite(existingEntry) && Number.isFinite(existingLimit)) {
      replacement.limitPrice = existingLimit + (value - existingEntry);
    }
  } else return null;
  return replacement;
}
