function numberValue(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function volumeBandFor(bands, volume) {
  const rows = Array.isArray(bands) ? bands : [];
  const requested = Math.max(0, numberValue(volume, 0));
  for (const row of rows) {
    const upTo = row?.upTo == null ? null : numberValue(row.upTo, null);
    if (upTo == null || requested <= upTo) return row;
  }
  return rows.length ? rows[rows.length - 1] : null;
}

export function estimateExecutionPrice(market, side, volume) {
  const normalizedSide = String(side || '').toUpperCase();
  const tickSize = numberValue(market?.tickSize, null);
  const basePrice = numberValue(normalizedSide === 'BUY' ? market?.ask : market?.bid, null);
  const quotedSpreadPoints = numberValue(market?.spreadPoints, null);

  if (!tickSize || tickSize <= 0 || !basePrice || basePrice <= 0 || !['BUY', 'SELL'].includes(normalizedSide)) {
    return {
      price: basePrice,
      liquidityAdjustmentPoints: 0,
      quotedSpreadPoints,
      effectiveExecutionSpreadPoints: quotedSpreadPoints,
      volumeBand: null,
    };
  }

  const spreadProfile = market?.spreadProfile || (market?.spread && typeof market.spread === 'object' ? market.spread : null);
  const band = volumeBandFor(spreadProfile?.volumeBands, volume);
  const extraPoints = Math.max(0, numberValue(band?.extraPoints, 0));
  const price = normalizedSide === 'BUY'
    ? basePrice + extraPoints * tickSize
    : basePrice - extraPoints * tickSize;

  return {
    price: Number(Number(price).toPrecision(14)),
    liquidityAdjustmentPoints: extraPoints,
    quotedSpreadPoints,
    effectiveExecutionSpreadPoints: quotedSpreadPoints == null ? null : quotedSpreadPoints + extraPoints,
    volumeBand: band?.upTo == null ? (band ? 'ABOVE_MAX_BAND' : null) : `UP_TO_${numberValue(band.upTo, 0)}`,
  };
}
