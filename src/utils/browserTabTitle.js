import { formatInstrumentPrice } from './instrumentFormatting.js';

const BRAND = 'ACG Trader';

function firstValidPrice(...values) {
  for (const candidate of values) {
    if (candidate == null || candidate === '') continue;
    const price = Number(candidate);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return null;
}

function providedPercent(...values) {
  for (const candidate of values) {
    if (candidate == null || candidate === '') continue;
    const percent = Number(candidate);
    if (Number.isFinite(percent)) return percent;
  }
  return null;
}

/**
 * Browser tab identity uses the selected chart and its feed-backed price and
 * daily/24h change. A missing change is never inferred from local price ticks.
 */
export function formatBrowserTabTitle({ activeSymbol, market, tick } = {}) {
  const symbol = String(market?.symbol || activeSymbol || '')
    .trim().replaceAll('/', '').toUpperCase();
  if (!symbol) return BRAND;

  const price = firstValidPrice(tick?.price, tick?.last, tick?.mid,
    market?.last, market?.price, market?.bid);
  const priceLabel = price === null ? '' : formatInstrumentPrice(price, market, '');
  const change = providedPercent(tick?.changePercent, market?.changePercent);
  const changeLabel = change === null ? ''
    : change > 0 ? '▲ +' + change.toFixed(2) + '%'
      : change < 0 ? '▼ ' + change.toFixed(2) + '%'
        : '0.00%';

  return [symbol, priceLabel, changeLabel].filter(Boolean).join(' ') + ' | ' + BRAND;
}
