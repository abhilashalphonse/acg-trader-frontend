import { convertFreshFx } from './verifiedFxConversion.js';

const positive = value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
const text = value => positive(value) ? String(Number(Number(value).toPrecision(12))) : '';

// Switch representations of the same resolved trade. Never invent a budget.
// Risk-to-risk conversions retain the requested budget, including lot rounding.
export function mobileSizingModeValue({ nextMode, mode, amount, sizing, account }) {
  if (nextMode === mode) return String(amount ?? '');
  const equity = Number(account?.equity);
  if (['riskPercent', 'riskUSD'].includes(mode) && positive(amount) && equity > 0) {
    if (nextMode === 'riskPercent') return text(Number(amount) / equity * 100);
    if (nextMode === 'riskUSD') return text(Number(amount) * equity / 100);
  }
  if (nextMode === 'lots') return text(sizing?.lots);
  if (nextMode === 'margin') return text(sizing?.margin);
  if (nextMode === 'riskPercent') return text(sizing?.actualRiskPercent);
  if (nextMode === 'riskUSD') return text(sizing?.lossAtStop);
  return '';
}

export function mobileSizingHelper({ mode, sizing, account, instrument, formatMoney, formatLots }) {
  if (!sizing?.canExecute) return sizing?.message || 'Calculation unavailable';
  const lots = `${formatLots(sizing.lots, instrument)} lots`;
  const money = value => formatMoney(value, account?.currency);
  if (mode === 'margin') {
    const percent = Number(account?.balance) > 0 ? ` (${(sizing.margin / Number(account.balance) * 100).toFixed(2)}% balance)` : '';
    return `${money(sizing.margin)} margin → ${lots}${percent}`;
  }
  if (mode === 'riskPercent') return `${sizing.actualRiskPercent.toFixed(2)}% risk → ${money(sizing.lossAtStop)} (${lots})`;
  if (mode === 'riskUSD') return `${money(sizing.lossAtStop)} risk → ${lots} (${sizing.actualRiskPercent.toFixed(2)}% equity)`;
  const exposure = convertFreshFx(sizing.notionalQuote, instrument?.quoteCurrency, account?.currency, account?.conversionMarkets);
  const percent = exposure != null && Number(account?.balance) > 0 ? ` (${(exposure / Number(account.balance) * 100).toFixed(2)}% balance)` : '';
  const label = exposure != null ? money(exposure) : formatMoney(sizing.notionalQuote, instrument?.quoteCurrency);
  return `${lots} → ≈${label}${percent}`;
}
