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
  return { id: String(position.id), accountId: String(position.accountId), positionId: position.positionId, symbol: position.symbol, side: String(position.side || '').toUpperCase(), volume: numberOr(position.openVolume), openVolume: position.openVolume, volumeStep: position.volumeStep, entry: numberOr(position.entryPrice), sl: nullableNumber(position.stopLoss), tp: nullableNumber(position.takeProfit), pnl: nullableNumber(live?.floatingPnl) ?? serverPnl, pnlCurrency: pnlCurrency || normalizedAccountCurrency || 'USD', closePrice: nullableNumber(live?.closePrice) ?? nullableNumber(valuation?.closePrice), valuationStatus: live ? 'LIVE' : (valuation?.valuationStatus || 'WAITING'), margin: numberOr(position.margin), source: live ? 'live-account-currency' : 'server-position-valuation', trailingEnabled: Boolean(position?.trailing?.enabled), trailingPoints, trailingPips: trailingPoints == null ? 5 : Math.max(1, trailingPoints / ratio), openedAt: displayTime(position.openedAt, 'Open'), raw: position };
}
function normalizePendingOrder(order) {
  const type = String(order.type || '').toUpperCase();
  const orderType = type === 'STOP_LIMIT' ? 'stop-limit' : type.toLowerCase();
  const entry = nullableNumber(type === 'LIMIT' ? order.limitPrice : order.stopPrice) ?? nullableNumber(order.limitPrice);
  return { id: String(order.id), accountId: String(order.accountId), clientOrderId: order.clientOrderId, symbol: order.symbol, side: String(order.side || '').toLowerCase(), orderType, volume: numberOr(order.requestedVolume), lots: numberOr(order.requestedVolume), manualLots: numberOr(order.requestedVolume), entry, stopPrice: nullableNumber(order.stopPrice), limitPrice: nullableNumber(order.limitPrice), sl: nullableNumber(order.stopLoss), tp: nullableNumber(order.takeProfit), expiration: order.timeInForce || 'GTC', expiresAt: order.expiresAt || null, status: String(order.status || '').toLowerCase(), createdAt: displayTime(order.createdAt || order.receivedAt, 'Pending'), pending: true, sizingMode: 'lots', raw: order };
}
function normalizeHistoryFill(fill) { return { id: String(fill.id), accountId: String(fill.accountId), positionId: fill.positionId ? String(fill.positionId) : null, symbol: fill.symbol, side: String(fill.side || '').toUpperCase(), volume: numberOr(fill.volume), entry: numberOr(fill.price), closePrice: numberOr(fill.price), pnl: numberOr(fill.realizedPnl), commission: numberOr(fill.commission), swap: numberOr(fill.swap), slippage: numberOr(fill.slippage), closeType: fill.type || 'DEAL', closedAt: displayTime(fill.executedAt), executedAt: fill.executedAt, raw: fill };
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
    dailyLossLimit: numberOr(policy?.dailyLoss?.limit), dailyLossReference: policy?.dailyLoss?.reference || 'DAILY_START_EQUITY', maxLossLimit: numberOr(policy?.maxLoss?.limit), maxLossReference: policy?.maxLoss?.reference || 'INITIAL_BALANCE', profitTarget: numberOr(policy?.profitTarget), riskPolicy: policy, challenge: account?.challenge || {}, riskDayKey: account?.riskDayKey || null, riskTimezone: account?.riskTimezone || 'UTC',
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
  const [positionValuations, setPositionValuations] = useState({});
  const [history, setHistory] = useState({ orders: [], deals: [], positions: [], loaded: false });
  const [commandState, setCommandState] = useState({ pending: false, uncertain: false, error: null, lastResult: null });
  const busyRef = useRef(0);

  const accountId = useMemo(() => { const granted = auth.principal?.accountIds?.map(String) || []; const loaded = Object.keys(trading.accountsById); return granted.find(id => loaded.includes(id)) || granted[0] || loaded[0] || null; }, [auth.principal?.accountIds, trading.accountsById]);
  const rawAccount = accountId ? trading.accountsById[accountId] || null : null;
  const valuation = accountId ? trading.valuationsByAccountId[accountId] || null : null;
  const account = useMemo(() => normalizeAccount(rawAccount, valuation), [rawAccount, valuation]);
  const rawPositions = useMemo(() => Object.values(trading.positionsById).filter(item => (!accountId || String(item.accountId) === String(accountId)) && item.status !== 'CLOSED').sort((a, b) => new Date(b.openedAt || 0) - new Date(a.openedAt || 0)), [accountId, trading.positionsById]);
  const positions = useMemo(() => rawPositions.map(position => normalizePosition(position, positionValuations[position.id], markets.find(item => item.symbol === position.symbol), account.currency)), [account.currency, markets, positionValuations, rawPositions]);
  const pendingOrders = useMemo(() => Object.values(trading.ordersById).filter(order => (!accountId || String(order.accountId) === String(accountId)) && ACTIVE_ORDER_STATUSES.has(String(order.status || '').toUpperCase()) && String(order.type || '').toUpperCase() !== 'MARKET').sort((a, b) => new Date(b.createdAt || b.receivedAt || 0) - new Date(a.createdAt || a.receivedAt || 0)).map(normalizePendingOrder), [accountId, trading.ordersById]);
  const positionHistory = useMemo(() => {
    const source = history.loaded ? [...trading.fills, ...history.deals] : trading.fills;
    const seen = new Set();
    return source
      .filter(fill => String(fill.type || '').toUpperCase() !== 'OPEN')
      .filter(fill => {
        const id = String(fill?.id || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map(normalizeHistoryFill);
  }, [history.deals, history.loaded, trading.fills]);

  useEffect(() => { if (!accountId || connection.status !== 'ready') return; requestSnapshot([accountId]); }, [accountId, connection.status, requestSnapshot]);
  useEffect(() => {
    if (!accountId || connection.status !== 'ready') return undefined;
    const controller = new AbortController();
    Promise.all([commands.historyOrders(accountId, { limit: 200 }, controller.signal), commands.historyDeals(accountId, { limit: 200 }, controller.signal), commands.historyPositions(accountId, { limit: 200 }, controller.signal)])
      .then(([orders, deals, positionsResult]) => { if (!controller.signal.aborted) setHistory({ orders: orders.items || [], deals: deals.items || [], positions: positionsResult.items || [], loaded: true }); })
      .catch(() => { if (!controller.signal.aborted) setHistory(current => ({ ...current, loaded: false })); });
    return () => controller.abort();
  }, [accountId, commands, connection.status]);

  useEffect(() => {
    if (!rawPositions.length || connection.status !== 'ready') {
      if (!rawPositions.length) setPositionValuations({});
      return undefined;
    }

    let disposed = false;
    let controller = new AbortController();

    const refresh = async () => {
      const results = await Promise.allSettled(
        rawPositions.map(position => commands.positionValuation(position.id, controller.signal)),
      );
      if (disposed || controller.signal.aborted) return;

      setPositionValuations(current => {
        const next = { ...current };
        rawPositions.forEach((position, index) => {
          if (results[index]?.status === 'fulfilled') next[position.id] = results[index].value;
          else if (results[index]?.reason?.status === 404) delete next[position.id];
        });
        return next;
      });
    };

    void refresh();

    // Position valuation is a fallback REST refresh. Account valuation itself is
    // already realtime over WebSocket, so avoid 1-second HTTP polling that can
    // exceed the global API rate limit with even one open position.
    const timer = window.setInterval(() => {
      controller.abort();
      controller = new AbortController();
      void refresh();
    }, 15000);

    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [commands, connection.status, rawPositions]);

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
  const requireAccount = useCallback(() => { if (!accountId) throw new Error('No trading account is available for this session'); return accountId; }, [accountId]);

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
    return run(() => commands.closePosition(String(positionId), {
      accountId: requireAccount(),
      clientOrderId: commandId('close'),
      volume: partialVolume(position, percentage, instrument),
      requestedPrice: null,
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

  const reversePosition = useCallback(positionId => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    if (!position) return Promise.reject(new Error('Open position was not found'));
    return run(() => commands.reversePosition(String(positionId), { accountId: requireAccount(), clientRequestId: commandId('reverse'), source: sourceForViewport() }));
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

  return { accountId, account, rawAccount, valuation, positions, pendingOrders, positionHistory, historyOrders: history.orders, historyDeals: history.deals, historyPositions: history.positions, historyLoaded: history.loaded, fills: trading.fills, orders: Object.values(trading.ordersById), connection, commandState, tradingReady: Boolean(accountId && rawAccount && account.tradingEnabled && connection.status === 'ready' && !commandState.uncertain), refreshState, openMarketOrder, placePendingOrder, replacePendingOrder, cancelPendingOrder, closePosition, closeAllPositions, updatePosition, movePositionToBreakEven, setPositionTrailing, duplicatePosition, reversePosition, errorMessage };
}
