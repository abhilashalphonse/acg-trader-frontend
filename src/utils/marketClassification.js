export function marketProvider(instrument) {
  const mappings = instrument?.providerMappings;
  if (mappings?.accelpix) return 'accelpix';
  if (mappings?.twelveData || mappings?.['twelve-data']) return 'twelve-data';
  return String(instrument?.provider || '').trim().toLowerCase() || null;
}

export function isIndiaInstrument(instrument) {
  const provider = marketProvider(instrument);
  if (provider === 'accelpix') return true;
  return String(instrument?.timezone || '').toLowerCase() === 'asia/kolkata';
}

export function marketGroup(instrument) {
  if (isIndiaInstrument(instrument)) return 'India';

  const assetClass = String(instrument?.assetClass || '').toUpperCase();
  if (assetClass === 'FOREX') return 'Forex';
  if (assetClass === 'METAL') return 'Metals';
  if (assetClass === 'INDEX') return 'Indices';
  if (assetClass === 'EQUITY') return 'Stocks';
  if (assetClass === 'CRYPTO') return 'Crypto';
  if (assetClass === 'ENERGY' || assetClass === 'OTHER') return 'Commodities';
  return 'Other';
}

export function marketCategoryId(instrument) {
  if (isIndiaInstrument(instrument)) return 'india';

  const raw = String(instrument?.assetClass || instrument?.category || '').toUpperCase();
  if (['FOREX', 'FX'].includes(raw)) return 'forex';
  if (['METAL', 'METALS'].includes(raw)) return 'metals';
  if (['INDEX', 'INDICES'].includes(raw)) return 'indices';
  if (raw === 'CRYPTO') return 'crypto';
  if (['EQUITY', 'STOCK', 'STOCKS'].includes(raw)) return 'stocks';
  return 'other';
}

export function marketVenue(instrument) {
  if (isIndiaInstrument(instrument)) return 'NSE';
  return null;
}

export function isChartOnlyInstrument(instrument) {
  return instrument?.executionEnabled === false;
}
