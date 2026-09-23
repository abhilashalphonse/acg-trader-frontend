import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTraderAuth } from './useTraderAuth.js';
import { useTradingStore } from './useTradingStore.js';
import {
  normalizeExpiryToIso,
  normalizePriceToTick,
  normalizeProtectionPrice,
  normalizeTimeInForce,
  normalizeVolumeToStep,
  pendingPriceDirection,
} from '../utils/tradingCommandNormalization.js';
import { executeWithOrderReconciliation } from '../utils/executionReconciliation.js';
import {
  calculateLocalPositionValuation,
  canUseLocalPositionValuation,
  positionPnlCurrency,
} from '../utils/positionValuation.js';

const ACTIVE_ORDER_STATUSES = new Set(['PENDING', 'ACCEPTED', 'TRIGGERED']);

function commandId(prefix = 'cmd') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${random}`.slice(0, 128);
}
function numberOr(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableNumber(value) { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function displayTime(value, fallback = '—') { if (!value) return fallback; const date = new Date(value); if (Number.isNaN(date.getTime())) return fallback; return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
function decimalPlaces(step) { const text = String(step ?? ''); const point = text.indexOf('.'); return point < 0 ? 0 : text.length - point - 1; }
function pointsPerPip(instrument) { const tickSize = Number(instrument?.tickSize); const pip = Number(instrument?.pipSize); return Number.isFinite(tickSize) && tickSize > 0 && Number.isFinite(pip) && pip > 0 ? pip / tickSize : 1; }
function partialVolume(position, percentage, instrument) {
  const openVolume = numberOr(position?.openVolume);
  const percent = Math.max(1, Math.min(100, numberOr(percentage, 100)));
  if (percent >= 100) return null;

  const step = Math.max(Number(position?.volumeStep || instrument?.volumeStep) || 0.01, 0.00000001);
  const minVolume = Math.max(Number(instrument?.minVolume) || step, step);
  const raw = openVolume * percent / 100;
  const units = Math.floor((raw + step * 1e-8) / step);
  const normalized = units * step;
  const remaining = openVolume - normalized;

  if (normalized < minVolume - step * 1e-8 || normalized <= 0) {
    throw new Error(`A ${percent}% partial close is below the minimum tradable volume of ${minVolume}`);
  }
  if (remaining > step * 1e-8 && remaining < minVolume - step * 1e-8) {
    throw new Error(`A ${percent}% partial close would leave less than the minimum tradable volume of ${minVolume}`);
  }
  if (normalized >= openVolume - step * 1e-8) {
    throw new Error('Partial close resolves to the full position size; use Close instead');
  }

  return normalized.toFixed(decimalPlaces(step));
}

function normalizePosition(position, valuation, instrument, accountCurrency) {
  const trailingPoints = nullableNumber(position?.trailing?.distancePoints);
  const ratio = pointsPerPip(instrument);
  const pnlCurrency = positionPnlCurrency(position, valuation, instrument);
  const normalizedAccountCurrency = String(accountCurrency || '').toUpperCase();
  const live = canUseLocalPositionValuation(position, valuation, instrument, accountCurrency)
    ? calculateLocalPositionValuation(position, instrument)
    : null;
  const serverPnl = nullableNumber(valuation?.floatingPnl);
  return { id: String(position.id), accountId: String(position.accountId), positionId: position.positionId, symbol: position.symbol, side: String(position.side || '').toUpperCase(), volume: numberOr(position.openVolume), openVolume: position.openVolume, volumeStep: position.volumeStep, entry: numberOr(position.entryPrice), sl: nullableNumber(position.stopLoss), tp: nullableNumber(position.takeProfit), pnl: nullableNumber(live?.floatingPnl) ?? serverPnl, pnlCurrency: pnlCurrency || normalizedAccountCurrency || 'USD', closePrice: nullableNumber(live?.closePrice) ?? nullableNumber(valuation?.closePrice), valuationStatus: live ? 'LIVE' : (valuation?.valuationStatus || 'WAITING'), margin: numberOr(position.margin), commission: numberOr(position.commissionPaid), swap: numberOr(position.swapPaid), source: live ? 'live-account-currency' : 'server-position-valuation', trailingEnabled: Boolean(position?.trailing?.enabled), trailingPoints, trailingPips: trailingPoints == null ? 5 : Math.max(1, trailingPoints / ratio), openedAt: displayTime(position.openedAt, 'Open'), raw: position };
}
function normalizePendingOrder(order) {
  const type = String(order.type || '').toUpperCase();
  const orderType = type === 'STOP_LIMIT' ? 'stop-limit' : type.toLowerCase();
  const entry = nullableNumber(type === 'LIMIT' ? order.limitPrice : order.stopPrice) ?? nullableNumber(order.limitPrice);
  return { id: String(order.id), accountId: String(order.accountId), clientOrderId: order.clientOrderId, symbol: order.symbol, side: String(order.side || '').toLowerCase(), orderType, volume: numberOr(order.requestedVolume), lots: numberOr(order.requestedVolume), manualLots: numberOr(order.requestedVolume), entry, stopPrice: nullableNumber(order.stopPrice), limitPrice: nullableNumber(order.limitPrice), sl: nullableNumber(order.stopLoss), tp: nullableNumber(order.takeProfit), expiration: order.timeInForce || 'GTC', expiresAt: order.expiresAt || null, status: String(order.status || '').toLowerCase(), createdAt: displayTime(order.createdAt || order.receivedAt, 'Pending'), pending: true, sizingMode: 'lots', raw: order };
}
function normalizeHistoryFill(fill) { return { id: String(fill.id), accountId: String(fill.accountId), positionId: fill.positionId ? String(fill.positionId) : null, symbol: fill.symbol, side: String(fill.side || '').toUpperCase(), volume: numberOr(fill.volume), entry: numberOr(fill.price), closePrice: numberOr(fill.price), pnl: numberOr(fill.realizedPnl), commission: numberOr(fill.commission), swap: numberOr(fill.swap), slippage: numberOr(fill.slippage), closeType: fill.type || 'DEAL', closedAt: displayTime(fill.executedAt), executedAt: fill.executedAt, raw: fill };
}

function normalizeClosedPosition(position, deals = [], accountCurrency = 'USD') {
  const id = String(position?.id || position?._id || '');
  const relatedDeals = deals
    .filter(deal => String(deal?.positionId || '') === id)
    .sort((a, b) => new Date(a?.executedAt || 0) - new Date(b?.executedAt || 0));
  const closingDeals = relatedDeals.filter(deal => String(deal?.type || '').toUpperCase() !== 'OPEN');
  const finalDeal = closingDeals[closingDeals.length - 1] || null;
  const openingDeal = relatedDeals.find(deal => String(deal?.type || '').toUpperCase() === 'OPEN') || null;
  const commission = relatedDeals.reduce((sum, deal) => sum + numberOr(deal?.commission), 0);
  const swap = relatedDeals.reduce((sum, deal) => sum + numberOr(deal?.swap), 0);
  const slippage = relatedDeals.reduce((sum, deal) => sum + Math.abs(numberOr(deal?.slippage)), 0);

  return {
    id,
    accountId: String(position?.accountId || ''),
    positionId: position?.positionId ? String(position.positionId) : id,
    symbol: position?.symbol,
    side: String(position?.side || '').toUpperCase(),
    volume: numberOr(position?.initialVolume ?? position?.openVolume),
    entry: numberOr(position?.entryPrice ?? openingDeal?.price),
    closePrice: nullableNumber(finalDeal?.price),
    pnl: numberOr(position?.realizedPnl),
    pnlCurrency: String(accountCurrency || position?.quoteCurrency || 'USD').toUpperCase(),
    commission: numberOr(position?.commissionPaid, commission),
    swap: numberOr(position?.swapPaid, swap),
    slippage,
    sl: nullableNumber(position?.stopLoss),
    tp: nullableNumber(position?.takeProfit),
    closeType: position?.closeReason || finalDeal?.type || 'CLOSED',
    openedAt: displayTime(position?.openedAt, '—'),
    closedAt: displayTime(position?.closedAt ?? finalDeal?.executedAt, '—'),
    openedAtIso: position?.openedAt || openingDeal?.executedAt || null,
    closedAtIso: position?.closedAt || finalDeal?.executedAt || null,
    executionEvents: relatedDeals.map(normalizeHistoryFill),
    raw: position,
  };
}
function normalizeAccount(account, valuation) {
  const durable = account?.state || {};
  const policy = account?.riskPolicy || {};
  const hasValuation = Boolean(valuation);
  const valuationNumber = (key, fallback) => hasValuation
    ? nullableNumber(valuation?.[key])
    : nullableNumber(fallback);
  return {
    id: account?.id || null, accountCode: account?.accountCode || null, accountType: account?.accountType || null, currency: account?.currency || 'USD', status: account?.status || 'UNKNOWN', tradingEnabled: account?.tradingEnabled === true, leverage: account?.leverage || null,
    initialBalance: nullableNumber(durable.initialBalance), balance: valuationNumber('balance', durable.balance), equity: valuationNumber('equity', durable.equity), floatingPnl: valuationNumber('floatingPnl', durable.floatingPnl), margin: valuationNumber('usedMargin', durable.usedMargin), usedMargin: valuationNumber('usedMargin', durable.usedMargin), freeMargin: valuationNumber('freeMargin', durable.freeMargin), marginLevel: hasValuation ? nullableNumber(valuation?.marginLevel) : null, dailyStartEquity: nullableNumber(durable.dailyStartEquity), realizedPnlToday: nullableNumber(durable.realizedPnlToday), valuationStatus: valuation?.valuationStatus || 'WAITING', complete: valuation?.complete !== false, staleSymbols: valuation?.staleSymbols || [],
    dailyLossLimit: numberOr(policy?.dailyLoss?.limit), dailyLossReference: policy?.dailyLoss?.reference || 'DAILY_START_EQUITY', maxLossLimit: numberOr(policy?.maxLoss?.limit), maxLossReference: policy?.maxLoss?.reference || 'INITIAL_BALANCE', profitTarget: numberOr(policy?.profitTarget), riskPolicy: policy, challenge: account?.challenge || {}, fundedAccountId: account?.challenge?.fundedAccountId || account?.fundedAccountId || null, riskDayKey: account?.riskDayKey || null, riskTimezone: account?.riskTimezone || 'UTC',
  };
}

function normalizeGrantAccount(grant) {
  if (!grant?.id) return null;
  return {
    id: String(grant.id),
    accountCode: grant.accountCode || null,
    accountType: grant.accountType || null,
    currency: grant.currency || 'USD',
    status: grant.status || 'UNKNOWN',
    tradingEnabled: grant.tradingEnabled === true,
    leverage: grant.leverage || null,
    initialBalance: nullableNumber(grant.initialBalance),
    balance: nullableNumber(grant.balance),
    equity: nullableNumber(grant.equity),
    floatingPnl: null,
    margin: null,
    usedMargin: null,
    freeMargin: null,
    marginLevel: null,
    dailyStartEquity: null,
    realizedPnlToday: null,
    valuationStatus: 'WAITING',
    complete: false,
    staleSymbols: [],
    dailyLossLimit: 0,
    maxLossLimit: 0,
    profitTarget: 0,
    riskPolicy: {},
    challenge: {
      phase: grant.phase || null,
      status: grant.status || null,
      fundedAccountId: grant.fundedAccountId || null,
    },
    fundedAccountId: grant.fundedAccountId || null,
    riskDayKey: grant.riskDayKey || null,
    riskTimezone: 'UTC',
  };
}
function sourceForViewport() { return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches ? 'MOBILE' : 'WEB'; }
function errorMessage(error) {
  if (!error) return 'Trading command failed';
  if (error.code === 'INSUFFICIENT_MARGIN' && error.details && !Array.isArray(error.details)) {
    const required = Number(error.details.requiredMargin);
    const free = Number(error.details.freeMargin);
    const currency = String(error.details.accountCurrency || 'USD');
    const money = value => Number.isFinite(value)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
      : '—';
    return `Insufficient free margin — requires ${money(required)}, available ${money(free)}.`;
  }
  if (Array.isArray(error.details) && error.details.length) return `${error.message}: ${error.details.map(item => item.message).join(', ')}`;
  return error.message || 'Trading command failed';
}

export function useTradingTerminal(markets = []) {
  const auth = useTraderAuth();
  const { trading, connection, commands, requestSnapshot } = useTradingStore();
  const positionValuations = trading.positionValuationsById;
  const [history, setHistory] = useState({ accountId: null, orders: [], deals: [], positions: [], loaded: false, error: null });
  const [commandState, setCommandState] = useState({ pending: false, uncertain: false, error: null, lastResult: null });
  const [switchContext, setSwitchContext] = useState(null);
  const [switchRequestVersion, setSwitchRequestVersion] = useState(0);
  const busyRef = useRef(0);

  const grantedAccountIds = useMemo(
    () => [...new Set((auth.principal?.accountIds || []).map(String).filter(Boolean))],
    [auth.principal?.accountIds],
  );
  const accountGrants = useMemo(
    () => Array.isArray(auth.principal?.accountGrants) ? auth.principal.accountGrants : [],
    [auth.principal?.accountGrants],
  );
  const grantById = useMemo(
    () => new Map(accountGrants.map(item => [String(item?.id || ''), item]).filter(([id]) => id)),
    [accountGrants],
  );
  const grantHistoryRef = useRef(new Map());
  for (const grant of accountGrants) {
    if (grant?.id) grantHistoryRef.current.set(String(grant.id), grant);
  }

  const preferredAccountId = auth.principal?.selectedAccountId ? String(auth.principal.selectedAccountId) : null;
  const [activeAccountId, setActiveAccountId] = useState(null);
  const [lifecycleEvent, setLifecycleEvent] = useState(null);

  const beginAccountSwitch = useCallback((target, reason = 'manual') => {
    const baselineRevision = Number(trading.snapshotRevisionByAccountId?.[target] || 0);
    setHistory({ accountId: target, orders: [], deals: [], positions: [], loaded: false, error: null });
    setSwitchContext({ targetId: target, baselineRevision, startedAt: Date.now(), reason });
    setSwitchRequestVersion(version => version + 1);
    setActiveAccountId(target);
    return target;
  }, [trading.snapshotRevisionByAccountId]);

  const selectAccount = useCallback(nextAccountId => {
    const target = String(nextAccountId || '').trim();
    if (!target || !grantedAccountIds.includes(target)) {
      const error = new Error('Trading session does not grant access to this account');
      error.code = 'ACCOUNT_ACCESS_FORBIDDEN';
      throw error;
    }
    if (commandState.pending || commandState.uncertain) {
      const error = new Error(commandState.uncertain
        ? 'Wait for the current execution to reconcile before switching accounts'
        : 'Wait for the current trading command to finish before switching accounts');
      error.code = 'ACCOUNT_SWITCH_BLOCKED';
      throw error;
    }
    return beginAccountSwitch(target, 'manual');
  }, [beginAccountSwitch, commandState.pending, commandState.uncertain, grantedAccountIds]);

  useEffect(() => {
    if (activeAccountId && grantedAccountIds.includes(activeAccountId)) return;
    if (commandState.pending || commandState.uncertain) return;

    if (!activeAccountId) {
      const initialTarget = preferredAccountId && grantedAccountIds.includes(preferredAccountId)
        ? preferredAccountId
        : grantedAccountIds[0] || null;
      if (initialTarget) beginAccountSwitch(initialTarget, 'initial');
      return;
    }

    const previousGrant = grantHistoryRef.current.get(String(activeAccountId)) || null;
    const lifecycleId = String(previousGrant?.fundedAccountId || '').trim();
    const replacements = lifecycleId
      ? accountGrants
          .filter(item => String(item?.fundedAccountId || '').trim() === lifecycleId && String(item?.id || '') !== String(activeAccountId))
          .sort((a, b) => {
            const aMaster = String(a?.accountType || '').toUpperCase() === 'FUNDED' ? 1 : 0;
            const bMaster = String(b?.accountType || '').toUpperCase() === 'FUNDED' ? 1 : 0;
            if (aMaster !== bMaster) return bMaster - aMaster;
            return Number(b?.phase || 0) - Number(a?.phase || 0);
          })
      : [];
    const replacement = replacements[0] || null;

    if (replacement?.id) {
      const target = String(replacement.id);
      const previousPhase = Number(previousGrant?.phase || 0);
      const nextPhase = Number(replacement?.phase || 0);
      const master = String(replacement?.accountType || '').toUpperCase() === 'FUNDED';
      setLifecycleEvent({
        id: `${Date.now()}:${target}`,
        message: master
          ? 'Master Account ready — synchronizing trading state…'
          : nextPhase > previousPhase
            ? `Phase ${nextPhase} ready — synchronizing trading state…`
            : 'Trading account updated — synchronizing state…',
      });
      beginAccountSwitch(target, 'lifecycle-replacement');
      return;
    }

    if (!lifecycleId) {
      const fallback = preferredAccountId && grantedAccountIds.includes(preferredAccountId)
        ? preferredAccountId
        : grantedAccountIds[0] || null;
      if (fallback) beginAccountSwitch(fallback, 'grant-fallback');
    }
  }, [accountGrants, activeAccountId, beginAccountSwitch, commandState.pending, commandState.uncertain, grantedAccountIds, preferredAccountId]);

  const accountId = activeAccountId;
  const accountGrantMissing = Boolean(accountId && !grantedAccountIds.includes(accountId));
  const rawAccount = accountId ? trading.accountsById[accountId] || null : null;
  const valuation = accountId ? trading.valuationsByAccountId[accountId] || null : null;
  const account = useMemo(() => normalizeAccount(rawAccount, valuation), [rawAccount, valuation]);
  const accounts = useMemo(() => grantedAccountIds
    .map(id => {
      const raw = trading.accountsById[id];
      return raw
        ? normalizeAccount(raw, trading.valuationsByAccountId[id])
        : normalizeGrantAccount(grantById.get(id));
    })
    .filter(item => item?.id), [grantById, grantedAccountIds, trading.accountsById, trading.valuationsByAccountId]);
  const accountSwitching = Boolean(switchContext && switchContext.targetId === accountId);
  const accountSwitchError = accountGrantMissing
    ? 'This account is no longer available for trading. Waiting for its next lifecycle account, or select another account.'
    : accountSwitching && history.accountId === accountId
      ? history.error
      : null;
  const rawPositions = useMemo(() => Object.values(trading.positionsById).filter(item => (!accountId || String(item.accountId) === String(accountId)) && item.status !== 'CLOSED').sort((a, b) => new Date(b.openedAt || 0) - new Date(a.openedAt || 0)), [accountId, trading.positionsById]);
  const positions = useMemo(() => rawPositions.map(position => normalizePosition(position, positionValuations[position.id], markets.find(item => item.symbol === position.symbol), account.currency)), [account.currency, markets, positionValuations, rawPositions]);
  const pendingOrders = useMemo(() => Object.values(trading.ordersById).filter(order => (!accountId || String(order.accountId) === String(accountId)) && ACTIVE_ORDER_STATUSES.has(String(order.status || '').toUpperCase()) && String(order.type || '').toUpperCase() !== 'MARKET').sort((a, b) => new Date(b.createdAt || b.receivedAt || 0) - new Date(a.createdAt || a.receivedAt || 0)).map(normalizePendingOrder), [accountId, trading.ordersById]);
  const positionHistory = useMemo(() => {
    const closedFromStore = Object.values(trading.positionsById)
      .filter(position => (!accountId || String(position?.accountId) === String(accountId)) && String(position?.status || '').toUpperCase() === 'CLOSED');
    const source = history.loaded && history.accountId === accountId ? [...closedFromStore, ...history.positions] : closedFromStore;
    const seen = new Set();
    const deals = history.loaded && history.accountId === accountId ? [...trading.fills, ...history.deals] : trading.fills;
    const uniqueDeals = [];
    const seenDeals = new Set();
    deals.forEach(deal => {
      const id = String(deal?.id || '');
      if (!id || seenDeals.has(id)) return;
      seenDeals.add(id);
      uniqueDeals.push(deal);
    });

    return source
      .filter(position => String(position?.status || '').toUpperCase() === 'CLOSED')
      .filter(position => {
        const id = String(position?.id || position?._id || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map(position => normalizeClosedPosition(position, uniqueDeals, account.currency))
      .sort((a, b) => new Date(b.closedAtIso || 0) - new Date(a.closedAtIso || 0));
  }, [account.currency, accountId, history.accountId, history.deals, history.loaded, history.positions, trading.fills, trading.positionsById]);

  useEffect(() => { if (!accountId || connection.status !== 'ready') return; requestSnapshot([accountId]); }, [accountId, connection.status, requestSnapshot, switchRequestVersion]);
  useEffect(() => {
    setHistory({ accountId, orders: [], deals: [], positions: [], loaded: false, error: null });
    if (!accountId || connection.status !== 'ready') return undefined;
    const controller = new AbortController();
    Promise.all([commands.historyOrders(accountId, { limit: 200 }, controller.signal), commands.historyDeals(accountId, { limit: 200 }, controller.signal), commands.historyPositions(accountId, { limit: 200 }, controller.signal)])
      .then(([orders, deals, positionsResult]) => {
        if (!controller.signal.aborted) setHistory({ accountId, orders: orders.items || [], deals: deals.items || [], positions: positionsResult.items || [], loaded: true, error: null });
      })
      .catch(error => {
        if (!controller.signal.aborted) setHistory({ accountId, orders: [], deals: [], positions: [], loaded: false, error: error?.message || 'Unable to load account history' });
      });
    return () => controller.abort();
  }, [accountId, commands, connection.status, switchRequestVersion]);

  useEffect(() => {
    if (!switchContext || !accountId || switchContext.targetId !== accountId) return;
    const currentRevision = Number(trading.snapshotRevisionByAccountId?.[accountId] || 0);
    const freshSnapshot = currentRevision > Number(switchContext.baselineRevision || 0);
    const historyReady = history.accountId === accountId && history.loaded === true && !history.error;
    if (freshSnapshot && rawAccount && valuation && historyReady) setSwitchContext(null);
  }, [accountId, history.accountId, history.error, history.loaded, rawAccount, switchContext, trading.snapshotRevisionByAccountId, valuation]);

  const run = useCallback(async operation => {
    busyRef.current += 1;
    setCommandState(current => ({ ...current, pending: true, error: null }));
    try {
      const result = await operation();
      setCommandState(current => ({ ...current, pending: busyRef.current > 1, error: null, lastResult: result }));
      return result;
    } catch (error) {
      const uncertain = error?.code === 'EXECUTION_STATUS_UNKNOWN';
      setCommandState(current => ({ ...current, pending: busyRef.current > 1, uncertain: current.uncertain || uncertain, error, lastResult: null }));
      throw error;
    } finally {
      busyRef.current = Math.max(0, busyRef.current - 1);
      if (busyRef.current === 0) setCommandState(current => ({ ...current, pending: false }));
    }
  }, []);
  const requireAccount = useCallback(() => {
    if (!accountId) throw new Error('No trading account is available for this session');
    if (accountGrantMissing) {
      const error = new Error('This account is no longer granted to the current trading session');
      error.code = 'ACCOUNT_ACCESS_REVOKED';
      throw error;
    }
    if (accountSwitching) {
      const error = new Error(accountSwitchError || 'Trading account is still synchronizing');
      error.code = 'ACCOUNT_SWITCH_IN_PROGRESS';
      throw error;
    }
    return accountId;
  }, [accountGrantMissing, accountId, accountSwitchError, accountSwitching]);

  const executeExposureCommand = useCallback(({ accountId: targetAccountId, clientOrderId, submit }) => executeWithOrderReconciliation({
    submit,
    clientOrderId,
    findOrder: async id => {
      const response = await commands.historyOrders(targetAccountId, { limit: 100 });
      return (response?.items || []).find(item => String(item?.clientOrderId || '') === String(id)) || null;
    },
    onReconciled: () => requestSnapshot([targetAccountId]),
  }).catch(error => {
    if (error?.code === 'EXECUTION_STATUS_UNKNOWN') requestSnapshot([targetAccountId]);
    throw error;
  }), [commands, requestSnapshot]);

  const instrumentForSymbol = useCallback(symbol => markets.find(item => item.symbol === String(symbol || '').toUpperCase()) || null, [markets]);

  const openMarketOrder = useCallback(({ symbol, side, volume, stopLoss = null, takeProfit = null, requestedPrice = null }) => {
    const normalizedSymbol = String(symbol || '').toUpperCase();
    const normalizedSide = String(side || '').toUpperCase();
    const instrument = instrumentForSymbol(normalizedSymbol);
    const targetAccountId = requireAccount();
    const clientOrderId = commandId('open');
    const command = {
      accountId: targetAccountId,
      clientOrderId,
      symbol: normalizedSymbol,
      side: normalizedSide,
      volume: String(normalizeVolumeToStep(volume, instrument)),
      stopLoss: normalizeProtectionPrice(stopLoss, instrument, normalizedSide, 'sl'),
      takeProfit: normalizeProtectionPrice(takeProfit, instrument, normalizedSide, 'tp'),
      requestedPrice,
      source: sourceForViewport(),
    };
    return run(() => executeExposureCommand({
      accountId: targetAccountId,
      clientOrderId,
      submit: () => commands.openMarketOrder(command),
    }));
  }, [commands, executeExposureCommand, instrumentForSymbol, requireAccount, run]);

  const placePendingOrder = useCallback(({ symbol, side, type, volume, entry, limitPrice = null, stopLoss = null, takeProfit = null, timeInForce = 'GTC', expiresAt = null }) => {
    const normalizedSymbol = String(symbol || '').toUpperCase();
    const normalizedSide = String(side || '').toUpperCase();
    const normalizedType = String(type || '').replace('-', '_').toUpperCase();
    const instrument = instrumentForSymbol(normalizedSymbol);
    const normalizedEntry = normalizePriceToTick(entry, instrument, pendingPriceDirection(normalizedType, normalizedSide, 'entry'));
    const normalizedLimit = normalizedType === 'STOP_LIMIT'
      ? normalizePriceToTick(limitPrice, instrument, pendingPriceDirection(normalizedType, normalizedSide, 'limit'))
      : null;
    const tif = normalizeTimeInForce(timeInForce);
    const targetAccountId = requireAccount();
    const clientOrderId = commandId('pending');
    const command = {
      accountId: targetAccountId,
      clientOrderId,
      symbol: normalizedSymbol,
      side: normalizedSide,
      type: normalizedType,
      volume: String(normalizeVolumeToStep(volume, instrument)),
      limitPrice: normalizedType === 'LIMIT' ? normalizedEntry : normalizedType === 'STOP_LIMIT' ? normalizedLimit : null,
      stopPrice: normalizedType === 'STOP' || normalizedType === 'STOP_LIMIT' ? normalizedEntry : null,
      stopLoss: normalizeProtectionPrice(stopLoss, instrument, normalizedSide, 'sl'),
      takeProfit: normalizeProtectionPrice(takeProfit, instrument, normalizedSide, 'tp'),
      timeInForce: tif,
      expiresAt: tif === 'SPECIFIED' ? normalizeExpiryToIso(expiresAt) : null,
      source: sourceForViewport(),
    };
    return run(() => executeExposureCommand({
      accountId: targetAccountId,
      clientOrderId,
      submit: () => commands.placePendingOrder(command),
    }));
  }, [commands, executeExposureCommand, instrumentForSymbol, requireAccount, run]);

  const cancelPendingOrder = useCallback(orderId => run(() => commands.cancelPendingOrder(String(orderId), { accountId: requireAccount(), clientRequestId: commandId('cancel') })), [commands, requireAccount, run]);

  const closePosition = useCallback((positionId, percentage = 100) => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    if (!position) return Promise.reject(new Error('Open position was not found'));
    const instrument = instrumentForSymbol(position.symbol);
    const closeSide = String(position.side || '').toUpperCase() === 'BUY' ? 'SELL' : 'BUY';
    const requestedPrice = Number(closeSide === 'BUY' ? instrument?.ask : instrument?.bid);
    return run(() => commands.closePosition(String(positionId), {
      accountId: requireAccount(),
      clientOrderId: commandId('close'),
      volume: partialVolume(position, percentage, instrument),
      requestedPrice: Number.isFinite(requestedPrice) ? requestedPrice : null,
      source: sourceForViewport(),
    }));
  }, [commands, instrumentForSymbol, rawPositions, requireAccount, run]);

  const closeAllPositions = useCallback(() => run(() => commands.closeAllPositions(requireAccount(), { accountId: requireAccount(), clientRequestId: commandId('close-all'), source: sourceForViewport() })), [commands, requireAccount, run]);

  const updatePosition = useCallback((positionId, patch) => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    if (!position) return Promise.reject(new Error('Open position was not found'));
    const instrument = instrumentForSymbol(position.symbol);
    const side = String(position.side || '').toUpperCase();
    return run(() => commands.updatePositionProtection(String(positionId), {
      accountId: requireAccount(),
      clientRequestId: commandId('protect'),
      ...(Object.prototype.hasOwnProperty.call(patch, 'sl') ? { stopLoss: normalizeProtectionPrice(patch.sl, instrument, side, 'sl') } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, 'tp') ? { takeProfit: normalizeProtectionPrice(patch.tp, instrument, side, 'tp') } : {}),
      source: sourceForViewport(),
    }));
  }, [commands, instrumentForSymbol, rawPositions, requireAccount, run]);

  const movePositionToBreakEven = useCallback(positionId => run(() => commands.movePositionToBreakEven(String(positionId), { accountId: requireAccount(), clientRequestId: commandId('be'), source: sourceForViewport() })), [commands, requireAccount, run]);

  const setPositionTrailing = useCallback((positionId, enabled, pips = 5) => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    const instrument = instrumentForSymbol(position?.symbol);
    const distancePoints = Math.max(1, numberOr(pips, 5) * pointsPerPip(instrument));
    return run(() => commands.configureTrailingStop(String(positionId), {
      accountId: requireAccount(),
      clientRequestId: commandId('trail'),
      enabled: Boolean(enabled),
      distancePoints: enabled ? String(distancePoints) : null,
      source: sourceForViewport(),
    }));
  }, [commands, instrumentForSymbol, rawPositions, requireAccount, run]);

  const duplicatePosition = useCallback(positionId => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    if (!position) return Promise.reject(new Error('Open position was not found'));
    return openMarketOrder({
      symbol: position.symbol,
      side: position.side,
      volume: position.openVolume,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
    });
  }, [openMarketOrder, rawPositions]);

  const reversePosition = useCallback((positionId, { stopLoss = null, takeProfit = null, requestedPrice = null } = {}) => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    if (!position) return Promise.reject(new Error('Open position was not found'));
    return run(() => commands.reversePosition(String(positionId), {
      accountId: requireAccount(),
      clientRequestId: commandId('reverse'),
      stopLoss,
      takeProfit,
      requestedPrice,
      source: sourceForViewport(),
    }));
  }, [commands, rawPositions, requireAccount, run]);

  const refreshState = useCallback(() => accountId ? requestSnapshot([accountId]) : false, [accountId, requestSnapshot]);

  const replacePendingOrder = useCallback((orderId, replacement) => {
    const existing = pendingOrders.find(item => String(item.id) === String(orderId));
    if (!existing) return Promise.reject(new Error('Pending order was not found'));

    const normalizedType = String(existing.orderType || '').replace('-', '_').toUpperCase();
    const normalizedSide = String(existing.side || '').toUpperCase();
    const instrument = instrumentForSymbol(existing.symbol);
    const replacementEntry = replacement.entry ?? existing.entry;
    const entry = normalizePriceToTick(replacementEntry, instrument, pendingPriceDirection(normalizedType, normalizedSide, 'entry'));
    const limit = normalizedType === 'STOP_LIMIT'
      ? normalizePriceToTick(replacement.limitPrice ?? existing.limitPrice, instrument, pendingPriceDirection(normalizedType, normalizedSide, 'limit'))
      : undefined;
    const tif = normalizeTimeInForce(replacement.timeInForce ?? replacement.expiration ?? existing.expiration);

    return run(() => commands.amendPendingOrder(String(orderId), {
      accountId: requireAccount(),
      clientRequestId: commandId('amend'),
      volume: String(normalizeVolumeToStep(replacement.volume ?? replacement.lots ?? existing.volume, instrument)),
      limitPrice: normalizedType === 'LIMIT' ? entry : normalizedType === 'STOP_LIMIT' ? limit : undefined,
      stopPrice: normalizedType === 'STOP' || normalizedType === 'STOP_LIMIT' ? entry : undefined,
      stopLoss: normalizeProtectionPrice(replacement.stopLoss ?? replacement.sl, instrument, normalizedSide, 'sl'),
      takeProfit: normalizeProtectionPrice(replacement.takeProfit ?? replacement.tp, instrument, normalizedSide, 'tp'),
      timeInForce: tif,
      expiresAt: tif === 'SPECIFIED'
        ? normalizeExpiryToIso(replacement.expiresAt ?? replacement.expirationAt ?? existing.expiresAt)
        : null,
    }));
  }, [commands, instrumentForSymbol, pendingOrders, requireAccount, run]);

  return { accountId, activeAccountId, grantedAccountIds, accountGrants, accounts, selectAccount, accountSwitching, accountGrantMissing, accountSwitchError, lifecycleEvent, clearLifecycleEvent: () => setLifecycleEvent(null), account, rawAccount, valuation, positions, pendingOrders, positionHistory, historyOrders: history.accountId === accountId ? history.orders : [], historyDeals: history.accountId === accountId ? history.deals : [], historyPositions: history.accountId === accountId ? history.positions : [], historyLoaded: history.accountId === accountId && history.loaded, fills: trading.fills.filter(fill => String(fill?.accountId || '') === String(accountId || '')), orders: Object.values(trading.ordersById).filter(order => String(order?.accountId || '') === String(accountId || '')), connection, commandState, tradingReady: Boolean(accountId && !accountGrantMissing && rawAccount && account.tradingEnabled && connection.status === 'ready' && !commandState.uncertain && !accountSwitching), refreshState, openMarketOrder, placePendingOrder, replacePendingOrder, cancelPendingOrder, closePosition, closeAllPositions, updatePosition, movePositionToBreakEven, setPositionTrailing, duplicatePosition, reversePosition, errorMessage };
}
