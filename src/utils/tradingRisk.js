function accountCurrencyOf(accountCurrency) {
  return String(accountCurrency || '').trim().toUpperCase();
}

function pnlCurrencyOf(instrument) {
  return String(instrument?.pnlCurrency || instrument?.quoteCurrency || '').trim().toUpperCase();
}

export function riskSizingSupported(instrument, accountCurrency) {
  const account = accountCurrencyOf(accountCurrency);
  const pnl = pnlCurrencyOf(instrument);
  const contractSize = Number(instrument?.contractSize);
  return Boolean(account && pnl && account === pnl && Number.isFinite(contractSize) && contractSize > 0);
}

export function lossPerLotAtStop(plan, instrument, accountCurrency) {
  if (!plan || !riskSizingSupported(instrument, accountCurrency)) return null;
  const entry = Number(plan.entry);
  const stopLoss = Number(plan.sl);
  const contractSize = Number(instrument.contractSize);
  if (![entry, stopLoss, contractSize].every(Number.isFinite) || entry === stopLoss) return null;
  return Math.abs(entry - stopLoss) * contractSize;
}

export function calculateRiskSizedLots(plan, riskPercent, equity, instrument, accountCurrency) {
  const lossPerLot = lossPerLotAtStop(plan, instrument, accountCurrency);
  const numericEquity = Number(equity);
  const numericRisk = Number(riskPercent);
  if (!Number.isFinite(lossPerLot) || lossPerLot <= 0 || !Number.isFinite(numericEquity) || numericEquity <= 0 || !Number.isFinite(numericRisk) || numericRisk <= 0) return null;
  return (numericEquity * numericRisk / 100) / lossPerLot;
}

export function estimateStopRisk(plan, lots, instrument, accountCurrency) {
  const lossPerLot = lossPerLotAtStop(plan, instrument, accountCurrency);
  const numericLots = Number(lots);
  if (!Number.isFinite(lossPerLot) || !Number.isFinite(numericLots) || numericLots <= 0) return null;
  return lossPerLot * numericLots;
}
