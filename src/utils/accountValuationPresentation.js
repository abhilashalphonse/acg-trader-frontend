// Trade-account presentation gate. Financial metrics are displayed only when
// a matching authoritative valuation is complete and live. Durable balance is
// ledger-backed and remains visible independently of quote freshness.
const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function accountValuationPresentation(account, valuation) {
  const durable = account?.state || {};
  const accountRevision = finite(account?.financialRevision);
  const valuationRevision = finite(valuation?.financialRevision);
  const coherent = accountRevision !== null && accountRevision >= 0
    && valuationRevision !== null && valuationRevision >= 0
    && accountRevision === valuationRevision;
  const status = coherent ? String(valuation?.valuationStatus || 'WAITING').toUpperCase() : 'WAITING';
  const complete = coherent && valuation?.complete === true;
  const verified = complete && status === 'LIVE';
  const metric = key => verified ? finite(valuation?.[key]) : null;
  return {
    balance: coherent ? (finite(valuation?.balance) ?? finite(durable.balance)) : finite(durable.balance),
    equity: metric('equity'),
    floatingPnl: metric('floatingPnl'),
    usedMargin: metric('usedMargin'),
    freeMargin: metric('freeMargin'),
    marginLevel: metric('marginLevel'),
    valuationStatus: status,
    complete,
    valuationCoherent: coherent,
    valuationVerified: verified,
    staleSymbols: coherent && Array.isArray(valuation?.staleSymbols) ? valuation.staleSymbols : [],
  };
}
