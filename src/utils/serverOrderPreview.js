export function normalizedCurrency(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export function requiresServerOrderPreview(instrument, account) {
  if (!instrument || !account) return false;

  const assetClass = String(instrument.assetClass || '').trim().toUpperCase();
  if (assetClass === 'EQUITY') return true;

  const accountCurrency = normalizedCurrency(account.currency);
  if (!accountCurrency) return false;

  const financialCurrencies = [
    instrument.marginCurrency,
    instrument.pnlCurrency,
    instrument.quoteCurrency,
  ]
    .map(normalizedCurrency)
    .filter(Boolean);

  return financialCurrencies.some(currency => currency !== accountCurrency);
}

export function primaryConversionLeg(preview) {
  const marginLeg = preview?.conversion?.margin?.path?.[0];
  if (marginLeg) return marginLeg;
  return preview?.conversion?.openingPnl?.path?.[0] || null;
}

export function previewIsExecutable(preview) {
  if (!preview || preview.previewVersion !== 'ACG_ORDER_PREVIEW_V1') return false;
  if (preview.executionPolicy?.allowed === false) return false;

  const requiredMarginRaw = preview.costs?.requiredMargin;
  const projectedFreeMarginRaw = preview.projectedAccount?.freeMargin;
  if (requiredMarginRaw === null || requiredMarginRaw === undefined || requiredMarginRaw === '') return false;
  if (projectedFreeMarginRaw === null || projectedFreeMarginRaw === undefined || projectedFreeMarginRaw === '') return false;

  const requiredMargin = Number(requiredMarginRaw);
  const projectedFreeMargin = Number(projectedFreeMarginRaw);
  return Number.isFinite(requiredMargin)
    && requiredMargin >= 0
    && Number.isFinite(projectedFreeMargin)
    && projectedFreeMargin >= 0;
}
