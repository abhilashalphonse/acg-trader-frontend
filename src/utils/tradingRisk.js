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


export function effectiveLeverage(account, instrument) {
  const accountLeverage = finitePositive(account?.leverage);
  const instrumentLeverage = finitePositive(instrument?.defaultLeverage);
  if (!accountLeverage || !instrumentLeverage) return null;
  return Math.min(accountLeverage, instrumentLeverage);
}

export function estimateRequiredMargin(price, lots, instrument, account) {
  const numericPrice = finitePositive(price);
  const numericLots = finitePositive(lots);
  const contractSize = finitePositive(instrument?.contractSize);
  const accountCurrency = accountCurrencyOf(account?.currency);
  const marginCurrency = String(instrument?.marginCurrency || instrument?.quoteCurrency || '').trim().toUpperCase();
  if (!numericPrice || !numericLots || !contractSize || !accountCurrency || !marginCurrency || accountCurrency !== marginCurrency) return null;

  const notional = numericPrice * contractSize * numericLots;
  const marginRate = finitePositive(instrument?.marginRate);
  const leverage = effectiveLeverage(account, instrument);
  const margin = marginRate ? notional * marginRate : leverage ? notional / leverage : null;
  if (!Number.isFinite(margin)) return null;

  const commissionPerLot = Math.max(0, Number(instrument?.commissionPerLot) || 0);
  return margin + commissionPerLot * numericLots;
}

export function calculateRiskOrderSizing(plan, riskPercent, account, instrument) {
  const requestedRaw = calculateRiskSizedLots(
    plan,
    riskPercent,
    account?.equity,
    instrument,
    account?.currency,
  );
  if (!Number.isFinite(requestedRaw) || requestedRaw <= 0) return null;

  const step = finitePositive(instrument?.volumeStep) || 0.01;
  const minVolume = finitePositive(instrument?.minVolume) || step;
  const maxVolume = finitePositive(instrument?.maxVolume) || Number.POSITIVE_INFINITY;
  const floorToStep = value => Math.floor((value + step * 1e-8) / step) * step;

  const belowMinimum = requestedRaw < minVolume - step * 1e-8;
  const aboveMaximum = requestedRaw > maxVolume + step * 1e-8;
  const requestedLots = belowMinimum
    ? minVolume
    : Math.max(minVolume, Math.min(maxVolume, floorToStep(requestedRaw)));

  const requiredMargin = estimateRequiredMargin(plan?.entry, requestedLots, instrument, account);
  const freeMargin = Number(account?.freeMargin);
  const marginKnown = Number.isFinite(requiredMargin) && Number.isFinite(freeMargin);
  const marginLimited = marginKnown && requiredMargin > freeMargin + 1e-8;

  const perLotMargin = estimateRequiredMargin(plan?.entry, 1, instrument, account);
  let maxMarginLots = null;
  if (Number.isFinite(perLotMargin) && perLotMargin > 0 && Number.isFinite(freeMargin)) {
    maxMarginLots = Math.max(0, Math.min(maxVolume, floorToStep(Math.max(0, freeMargin) / perLotMargin)));
  }

  const actualRisk = estimateStopRisk(plan, requestedLots, instrument, account?.currency);
  const equity = Number(account?.equity);
  const actualRiskPercent = Number.isFinite(actualRisk) && Number.isFinite(equity) && equity > 0
    ? actualRisk / equity * 100
    : null;

  let blockReason = null;
  if (belowMinimum) blockReason = 'MIN_VOLUME';
  else if (aboveMaximum) blockReason = 'MAX_VOLUME';
  else if (marginLimited) blockReason = 'INSUFFICIENT_MARGIN';

  return {
    requestedRaw,
    requestedLots,
    requiredMargin,
    freeMargin: Number.isFinite(freeMargin) ? freeMargin : null,
    maxMarginLots,
    effectiveLeverage: effectiveLeverage(account, instrument),
    actualRisk,
    actualRiskPercent,
    belowMinimum,
    aboveMaximum,
    marginLimited,
    blockReason,
    canExecute: !blockReason,
  };
}

export function defaultPlannerStopDistance(instrument, entryPrice) {
  const entry = finitePositive(entryPrice);
  if (!entry) return null;
  const pip = finitePositive(instrument?.pipSize) || finitePositive(instrument?.tickSize) || entry * 0.0001;
  const assetClass = String(instrument?.assetClass || '').toUpperCase();
  const percentage = ({
    CRYPTO: 0.005,
    METAL: 0.0025,
    INDEX: 0.0035,
    EQUITY: 0.01,
    ENERGY: 0.005,
    OTHER: 0.005,
  })[assetClass];

  if (assetClass === 'FOREX') return Math.max(10 * pip, entry * 0.0005);
  return Math.max(10 * pip, entry * (percentage || 0.005));
}


function finitePositive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function positionDistancePips(position, targetPrice, instrument) {
  const entry = Number(position?.entry ?? position?.entryPrice);
  const target = Number(targetPrice);
  const pipSize = finitePositive(instrument?.pipSize) || finitePositive(instrument?.tickSize);
  if (!Number.isFinite(entry) || !Number.isFinite(target) || !pipSize) return null;
  return Math.abs(target - entry) / pipSize;
}

export function estimatePositionPnlAtPrice(position, targetPrice, instrument) {
  const entry = Number(position?.entry ?? position?.entryPrice);
  const target = Number(targetPrice);
  const volume = Number(position?.volume ?? position?.lots);
  if (![entry, target, volume].every(Number.isFinite) || volume <= 0) return null;

  const side = String(position?.side || '').toUpperCase();
  if (side !== 'BUY' && side !== 'SELL') return null;

  const signedMove = side === 'BUY' ? target - entry : entry - target;
  const tickSize = finitePositive(instrument?.tickSize);
  const tickValue = finitePositive(instrument?.tickValue);
  if (tickSize && tickValue) return (signedMove / tickSize) * tickValue * volume;

  const contractSize = finitePositive(instrument?.contractSize);
  if (contractSize) return signedMove * contractSize * volume;

  return null;
}
