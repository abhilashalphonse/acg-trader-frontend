import { isIndiaInstrument } from './marketClassification.js';

// Market-data licensing gate: customer discovery is disabled by default.
// Re-enable only after the backend and the relevant market-data licences are ready.
export const indiaMarketEnabled = import.meta.env?.VITE_INDIA_MARKET_ENABLED === 'true';

export function isIndiaMarketVisible(instrument, enabled = indiaMarketEnabled) {
  return enabled || !isIndiaInstrument(instrument);
}
