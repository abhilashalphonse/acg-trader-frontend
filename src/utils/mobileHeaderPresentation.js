// Mobile-only presentation helpers. Keep monetary precision intact in account sheets.
export function formatMobileFloatingPnl(value, currency = 'USD', compact = true) {
  if (value === undefined || value === null || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const unit = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: unit,
      minimumFractionDigits: compact && Math.abs(amount) >= 1000 ? 0 : 2,
      maximumFractionDigits: compact && Math.abs(amount) >= 1000 ? 1 : 2,
      notation: compact && Math.abs(amount) >= 1000 ? 'compact' : 'standard',
      signDisplay: amount > 0 ? 'always' : 'auto',
    }).format(amount);
  } catch {
    return `${amount > 0 ? '+' : ''}${amount.toFixed(2)} ${unit}`;
  }
}

export function mobilePnlTone(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0 || value == null) return 'neutral';
  return amount > 0 ? 'profit' : 'loss';
}

export function openPositionsBadge(count) {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  if (value === 0) return null;
  return value > 99 ? '99+' : String(value);
}
