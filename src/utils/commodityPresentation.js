const COMMODITY_METAL_SYMBOLS = new Set(['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'COPPER', 'ALUMINUM']);
const COMMODITY_ENERGY_SYMBOLS = new Set(['WTIUSD', 'XBRUSD', 'NGASUSD', 'GASOLINE', 'HEATOIL']);

const DISPLAY_ALIASES = Object.freeze({
  WTIUSD: 'USOIL',
  XBRUSD: 'UKOIL',
  NGASUSD: 'NATGAS',
});

export function isCommodityInstrument(instrument) {
  const assetClass = String(instrument?.assetClass || '').toUpperCase();
  return ['METAL', 'ENERGY', 'OTHER'].includes(assetClass);
}

export function commoditySubgroup(instrument) {
  if (!isCommodityInstrument(instrument)) return null;
  const symbol = String(instrument?.symbol || '').toUpperCase();
  const assetClass = String(instrument?.assetClass || '').toUpperCase();

  if (assetClass === 'METAL' || COMMODITY_METAL_SYMBOLS.has(symbol)) return 'metals';
  if (assetClass === 'ENERGY' || COMMODITY_ENERGY_SYMBOLS.has(symbol)) return 'energy';
  return 'agriculture';
}

export function commodityDisplaySymbol(instrument) {
  const symbol = String(instrument?.symbol || '').toUpperCase();
  return DISPLAY_ALIASES[symbol] || instrument?.displaySymbol || null;
}

export function commoditySearchTerms(instrument) {
  const symbol = String(instrument?.symbol || '').toUpperCase();
  const alias = DISPLAY_ALIASES[symbol] || '';
  const extra = symbol === 'WTIUSD'
    ? 'WTI crude oil west texas intermediate us oil'
    : symbol === 'XBRUSD'
      ? 'Brent crude oil uk oil'
      : symbol === 'NGASUSD'
        ? 'natural gas nat gas'
        : '';
  return [symbol, alias, instrument?.name || '', extra].filter(Boolean).join(' ');
}
