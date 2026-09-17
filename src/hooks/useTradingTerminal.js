import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTraderAuth } from './useTraderAuth.js';
import { useTradingStore } from './useTradingStore.js';

const ACTIVE_ORDER_STATUSES = new Set(['PENDING', 'ACCEPTED', 'TRIGGERED']);

function commandId(prefix = 'cmd') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${random}`.slice(0, 128);
}

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayTime(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function decimalPlaces(step) {
  const text = String(step ?? '');
  const point = text.indexOf('.');
  return point < 0 ? 0 : text.length - point - 1;
}

function pointsPerPip(instrument) {
  const tickSize = Number(instrument?.tickSize);
  const pip = Number(instrument?.pipSize);
  return Number.isFinite(tickSize) && tickSize > 0 && Number.isFinite(pip) && pip > 0 ? pip / tickSize : 1;
}

function partialVolume(position, percentage) {
  const openVolume = numberOr(position?.openVolume);
  const percent = Math.max(1, Math.min(100, numberOr(percentage, 100)));
  if (percent >= 100) return null;
  const step = Math.max(Number(position?.volumeStep) || 0.01, 0.00000001);
  const raw = openVolume * percent / 100;
  const units = Math.floor((raw + step * 1e-8) / step);
  const normalized = Math.max(step, units * step);
  if (normalized >= openVolume - step / 2) return null;
  return normalized.toFixed(decimalPlaces(step));
}

function normalizePosition(position, valuation, instrument) {
  const trailingPoints = nullableNumber(position?.trailing?.distancePoints);
  const ratio = pointsPerPip(instrument);
  return {
    id: String(position.id),
    accountId: String(position.accountId),
    positionId: position.positionId,
    symbol: position.symbol,
    side: String(position.side || '').toUpperCase(),
    volume: numberOr(position.openVolume),
    openVolume: position.openVolume,
    volumeStep: position.volumeStep,
    entry: numberOr(position.entryPrice),
    sl: nullableNumber(position.stopLoss),
    tp: nullableNumber(position.takeProfit),
    pnl: nullableNumber(valuation?.floatingPnl) ?? 0,
    closePrice: nullableNumber(valuation?.closePrice),
    valuationStatus: valuation?.valuationStatus || 'WAITING',
    margin: numberOr(position.margin),
    source: 'server',
    trailingEnabled: Boolean(position?.trailing?.enabled),
    trailingPoints,
    trailingPips: trailingPoints == null ? 5 : Math.max(1, trailingPoints / ratio),
    openedAt: displayTime(position.openedAt, 'Open'),
    raw: position,
  };
}

function normalizePendingOrder(order) {
  const type = String(order.type || '').toUpperCase();
  const orderType = type === 'STOP_LIMIT' ? 'stop-limit' : type.toLowerCase();
  const entry = nullableNumber(type === 'LIMIT' ? order.limitPrice : order.stopPrice) ?? nullableNumber(order.limitPrice);
  return {
    id: String(order.id),
    accountId: String(order.accountId),
    clientOrderId: order.clientOrderId,
    symbol: order.symbol,
    side: String(order.side || '').toLowerCase(),
    orderType,
    volume: numberOr(order.requestedVolume),
    lots: numberOr(order.requestedVolume),
    manualLots: numberOr(order.requestedVolume),
    entry,
    stopPrice: nullableNumber(order.stopPrice),
    limitPrice: nullableNumber(order.limitPrice),
    sl: nullableNumber(order.stopLoss),
    tp: nullableNumber(order.takeProfit),
    expiration: order.timeInForce || 'GTC',
    expiresAt: order.expiresAt || null,
    status: String(order.status || '').toLowerCase(),
    createdAt: displayTime(order.createdAt || order.receivedAt, 'Pending'),
    pending: true,
    sizingMode: 'lots',
    raw: order,
  };
}

function normalizeHistoryFill(fill) {
  return {
    id: String(fill.id),
    accountId: String(fill.accountId),
    positionId: fill.positionId ? String(fill.positionId) : null,
    symbol: fill.symbol,
    side: String(fill.side || '').toUpperCase(),
    volume: numberOr(fill.volume),
    entry: numberOr(fill.price),
    closePrice: numberOr(fill.price),
    pnl: numberOr(fill.realizedPnl),
    commission: numberOr(fill.commission),
    slippage: numberOr(fill.slippage),
    closeType: fill.type || 'DEAL',
    closedAt: displayTime(fill.executedAt),
    executedAt: fill.executedAt,
    raw: fill,
  };
}

function normalizeAccount(account, valuation) {
  const durable = account?.state || {};
  return {
    id: account?.id || null,
    accountCode: account?.accountCode || null,
    currency: account?.currency || 'USD',
    status: account?.status || 'UNKNOWN',
    tradingEnabled: account?.tradingEnabled === true,
    leverage: account?.leverage || null,
    initialBalance: numberOr(durable.initialBalance),
    balance: numberOr(valuation?.balance ?? durable.balance),
    equity: numberOr(valuation?.equity ?? durable.equity),
    floatingPnl: numberOr(valuation?.floatingPnl ?? durable.floatingPnl),
    margin: numberOr(valuation?.usedMargin ?? durable.usedMargin),
    usedMargin: numberOr(valuation?.usedMargin ?? durable.usedMargin),
    freeMargin: numberOr(valuation?.freeMargin ?? durable.freeMargin),
    marginLevel: nullableNumber(valuation?.marginLevel),
    dailyStartEquity: numberOr(durable.dailyStartEquity),
    realizedPnlToday: numberOr(durable.realizedPnlToday),
    valuationStatus: valuation?.valuationStatus || 'WAITING',
    complete: valuation?.complete !== false,
    staleSymbols: valuation?.staleSymbols || [],
  };
}

function sourceForViewport() {
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches ? 'MOBILE' : 'WEB';
}

function errorMessage(error) {
  if (!error) return 'Trading command failed';
  if (Array.isArray(error.details) && error.details.length) return `${error.message}: ${error.details.map(item => item.message).join(', ')}`;
  return error.message || 'Trading command failed';
}

export function useTradingTerminal(markets = []) {
  const auth = useTraderAuth();
  const { trading, connection, commands, requestSnapshot } = useTradingStore();
  const [positionValuations, setPositionValuations] = useState({});
  const [commandState, setCommandState] = useState({ pending: false, error: null, lastResult: null });
  const busyRef = useRef(0);

  const accountId = useMemo(() => {
    const granted = auth.principal?.accountIds?.map(String) || [];
    const loaded = Object.keys(trading.accountsById);
    return granted.find(id => loaded.includes(id)) || granted[0] || loaded[0] || null;
  }, [auth.principal?.accountIds, trading.accountsById]);

  const rawAccount = accountId ? trading.accountsById[accountId] || null : null;
  const valuation = accountId ? trading.valuationsByAccountId[accountId] || null : null;
  const account = useMemo(() => normalizeAccount(rawAccount, valuation), [rawAccount, valuation]);

  const rawPositions = useMemo(() => Object.values(trading.positionsById)
    .filter(item => (!accountId || String(item.accountId) === String(accountId)) && item.status !== 'CLOSED')
    .sort((a, b) => new Date(b.openedAt || 0) - new Date(a.openedAt || 0)), [accountId, trading.positionsById]);

  const positions = useMemo(() => rawPositions.map(position => {
    const instrument = markets.find(item => item.symbol === position.symbol);
    return normalizePosition(position, positionValuations[position.id], instrument);
  }), [markets, positionValuations, rawPositions]);

  const pendingOrders = useMemo(() => Object.values(trading.ordersById)
    .filter(order => (!accountId || String(order.accountId) === String(accountId)) && ACTIVE_ORDER_STATUSES.has(String(order.status || '').toUpperCase()) && String(order.type || '').toUpperCase() !== 'MARKET')
    .sort((a, b) => new Date(b.createdAt || b.receivedAt || 0) - new Date(a.createdAt || a.receivedAt || 0))
    .map(normalizePendingOrder), [accountId, trading.ordersById]);

  const positionHistory = useMemo(() => trading.fills
    .filter(fill => (!accountId || String(fill.accountId) === String(accountId)) && String(fill.type || '').toUpperCase() !== 'OPEN')
    .map(normalizeHistoryFill), [accountId, trading.fills]);

  useEffect(() => {
    if (!accountId || connection.status !== 'ready') return;
    requestSnapshot([accountId]);
  }, [accountId, connection.status, requestSnapshot]);

  useEffect(() => {
    if (!rawPositions.length || connection.status !== 'ready') {
      if (!rawPositions.length) setPositionValuations({});
      return undefined;
    }
    let disposed = false;
    const controller = new AbortController();

    const refresh = async () => {
      const results = await Promise.allSettled(rawPositions.map(position => commands.positionValuation(position.id, controller.signal)));
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
    const timer = window.setInterval(() => void refresh(), 1000);
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
      setCommandState({ pending: busyRef.current > 1, error: null, lastResult: result });
      return result;
    } catch (error) {
      setCommandState({ pending: busyRef.current > 1, error, lastResult: null });
      throw error;
    } finally {
      busyRef.current = Math.max(0, busyRef.current - 1);
      if (busyRef.current === 0) setCommandState(current => ({ ...current, pending: false }));
    }
  }, []);

  const requireAccount = useCallback(() => {
    if (!accountId) throw new Error('No trading account is available for this session');
    return accountId;
  }, [accountId]);

  const openMarketOrder = useCallback(({ symbol, side, volume, stopLoss = null, takeProfit = null, requestedPrice = null }) => run(() => commands.openMarketOrder({
    accountId: requireAccount(),
    clientOrderId: commandId('open'),
    symbol: String(symbol || '').toUpperCase(),
    side: String(side || '').toUpperCase(),
    volume: String(volume),
    stopLoss,
    takeProfit,
    requestedPrice,
    source: sourceForViewport(),
  })), [commands, requireAccount, run]);

  const placePendingOrder = useCallback(({ symbol, side, type, volume, entry, limitPrice = null, stopLoss = null, takeProfit = null, timeInForce = 'GTC', expiresAt = null }) => {
    const normalizedType = String(type || '').replace('-', '_').toUpperCase();
    return run(() => commands.placePendingOrder({
      accountId: requireAccount(),
      clientOrderId: commandId('pending'),
      symbol: String(symbol || '').toUpperCase(),
      side: String(side || '').toUpperCase(),
      type: normalizedType,
      volume: String(volume),
      limitPrice: normalizedType === 'LIMIT' ? entry : normalizedType === 'STOP_LIMIT' ? limitPrice : null,
      stopPrice: normalizedType === 'STOP' || normalizedType === 'STOP_LIMIT' ? entry : null,
      stopLoss,
      takeProfit,
      timeInForce,
      expiresAt: timeInForce === 'SPECIFIED' ? expiresAt : null,
      source: sourceForViewport(),
    }));
  }, [commands, requireAccount, run]);

  const cancelPendingOrder = useCallback(orderId => run(() => commands.cancelPendingOrder(String(orderId), {
    accountId: requireAccount(),
    clientRequestId: commandId('cancel'),
  })), [commands, requireAccount, run]);

  const closePosition = useCallback((positionId, percentage = 100) => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    if (!position) return Promise.reject(new Error('Open position was not found'));
    return run(() => commands.closePosition(String(positionId), {
      accountId: requireAccount(),
      clientOrderId: commandId('close'),
      volume: partialVolume(position, percentage),
      requestedPrice: null,
      source: sourceForViewport(),
    }));
  }, [commands, rawPositions, requireAccount, run]);

  const closeAllPositions = useCallback(async () => {
    const ids = rawPositions.map(item => item.id);
    if (!ids.length) return [];
    const results = await Promise.allSettled(ids.map(id => closePosition(id, 100)));
    const failed = results.filter(item => item.status === 'rejected');
    if (failed.length) {
      const error = new Error(`${failed.length} of ${results.length} positions could not be closed`);
      error.results = results;
      throw error;
    }
    return results.map(item => item.value);
  }, [closePosition, rawPositions]);

  const updatePosition = useCallback((positionId, patch) => run(() => commands.updatePositionProtection(String(positionId), {
    accountId: requireAccount(),
    clientRequestId: commandId('protect'),
    ...(Object.prototype.hasOwnProperty.call(patch, 'sl') ? { stopLoss: patch.sl } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'tp') ? { takeProfit: patch.tp } : {}),
    source: sourceForViewport(),
  })), [commands, requireAccount, run]);

  const movePositionToBreakEven = useCallback(positionId => run(() => commands.movePositionToBreakEven(String(positionId), {
    accountId: requireAccount(),
    clientRequestId: commandId('be'),
    source: sourceForViewport(),
  })), [commands, requireAccount, run]);

  const setPositionTrailing = useCallback((positionId, enabled, pips = 5) => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    const instrument = markets.find(item => item.symbol === position?.symbol);
    const distancePoints = Math.max(1, numberOr(pips, 5) * pointsPerPip(instrument));
    return run(() => commands.configureTrailingStop(String(positionId), {
      accountId: requireAccount(),
      clientRequestId: commandId('trail'),
      enabled: Boolean(enabled),
      distancePoints: enabled ? String(distancePoints) : null,
      source: sourceForViewport(),
    }));
  }, [commands, markets, rawPositions, requireAccount, run]);

  const duplicatePosition = useCallback(positionId => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    if (!position) return Promise.reject(new Error('Open position was not found'));
    return openMarketOrder({ symbol: position.symbol, side: position.side, volume: position.openVolume });
  }, [openMarketOrder, rawPositions]);

  const reversePosition = useCallback(async positionId => {
    const position = rawPositions.find(item => String(item.id) === String(positionId));
    if (!position) throw new Error('Open position was not found');
    const side = position.side === 'BUY' ? 'SELL' : 'BUY';
    const volume = position.openVolume;
    await closePosition(positionId, 100);
    return openMarketOrder({ symbol: position.symbol, side, volume });
  }, [closePosition, openMarketOrder, rawPositions]);

  const replacePendingOrder = useCallback(async (orderId, replacement) => {
    await cancelPendingOrder(orderId);
    return placePendingOrder(replacement);
  }, [cancelPendingOrder, placePendingOrder]);

  return {
    accountId,
    account,
    rawAccount,
    valuation,
    positions,
    pendingOrders,
    positionHistory,
    fills: trading.fills,
    orders: Object.values(trading.ordersById),
    connection,
    commandState,
    tradingReady: Boolean(accountId && rawAccount && account.tradingEnabled && connection.status === 'ready'),
    openMarketOrder,
    placePendingOrder,
    replacePendingOrder,
    cancelPendingOrder,
    closePosition,
    closeAllPositions,
    updatePosition,
    movePositionToBreakEven,
    setPositionTrailing,
    duplicatePosition,
    reversePosition,
    errorMessage,
  };
}
