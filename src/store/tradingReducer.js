export const initialTradingState = Object.freeze({
  connection: {
    status: 'disconnected',
    error: null,
    details: null,
    lastMessageAt: null,
  },
  market: {
    quotesBySymbol: {},
    ticksBySymbol: {},
    candlesByKey: {},
    status: null,
    gatewayStatus: null,
    historyRecoveryRevision: 0,
  },
  trading: {
    accountsById: {},
    valuationsByAccountId: {},
    snapshotRevisionByAccountId: {},
    positionValuationsById: {},
    positionsById: {},
    ordersById: {},
    fills: [],
  },
});

function entityId(entity) {
  return entity?.id == null ? null : String(entity.id);
}

function accountIdFromValuation(value) {
  return value?.accountId == null ? null : String(value.accountId);
}

function candleKey(candle) {
  const symbol = String(candle?.symbol || '').toUpperCase();
  const timeframe = String(candle?.timeframe || '').toLowerCase();
  return symbol && timeframe ? `${symbol}:${timeframe}` : null;
}

function upsert(map, entity) {
  const id = entityId(entity);
  return id ? { ...map, [id]: entity } : map;
}

function upsertFill(fills, fill) {
  if (!fill) return fills;
  const id = entityId(fill);
  const withoutDuplicate = id ? fills.filter(item => entityId(item) !== id) : fills;
  return [fill, ...withoutDuplicate].slice(0, 500);
}

function replaceAccountScoped(map, accountId, entities) {
  const next = {};
  for (const [id, entity] of Object.entries(map)) {
    if (String(entity?.accountId) !== String(accountId)) next[id] = entity;
  }
  for (const entity of entities || []) {
    const id = entityId(entity);
    if (id) next[id] = entity;
  }
  return next;
}

function mergeSnapshot(state, snapshots) {
  let accountsById = state.trading.accountsById;
  let valuationsByAccountId = state.trading.valuationsByAccountId;
  let snapshotRevisionByAccountId = state.trading.snapshotRevisionByAccountId;
  let positionValuationsById = state.trading.positionValuationsById;
  let positionsById = state.trading.positionsById;
  let ordersById = state.trading.ordersById;
  let fills = state.trading.fills;

  for (const snapshot of snapshots || []) {
    const accountId = entityId(snapshot?.account);
    if (!accountId) continue;
    accountsById = { ...accountsById, [accountId]: snapshot.account };
    snapshotRevisionByAccountId = {
      ...snapshotRevisionByAccountId,
      [accountId]: Number(snapshotRevisionByAccountId[accountId] || 0) + 1,
    };
    if (snapshot.valuation) valuationsByAccountId = { ...valuationsByAccountId, [accountId]: snapshot.valuation };
    positionValuationsById = replaceAccountScoped(positionValuationsById, accountId, snapshot.positionValuations || []);
    positionsById = replaceAccountScoped(positionsById, accountId, snapshot.positions || []);
    ordersById = replaceAccountScoped(ordersById, accountId, snapshot.orders || []);
    const otherFills = fills.filter(fill => String(fill?.accountId) !== accountId);
    fills = [...(snapshot.fills || []), ...otherFills].slice(0, 500);
  }

  return {
    ...state,
    trading: { accountsById, valuationsByAccountId, snapshotRevisionByAccountId, positionValuationsById, positionsById, ordersById, fills },
  };
}

function mergeCommandResult(state, result) {
  if (!result || typeof result !== 'object') return state;
  const order = result.order || null;
  const fill = result.deal || result.fill || null;
  const position = result.position || null;
  const account = result.account || null;
  const valuation = result.valuation || null;

  let positionsById = state.trading.positionsById;
  let positionValuationsById = state.trading.positionValuationsById;
  const positionId = entityId(position);
  if (positionId) {
    positionsById = { ...positionsById };
    if (position.status === 'CLOSED') {
      delete positionsById[positionId];
      positionValuationsById = { ...positionValuationsById };
      delete positionValuationsById[positionId];
    } else positionsById[positionId] = position;
  }

  let valuationsByAccountId = state.trading.valuationsByAccountId;
  const valuationAccountId = accountIdFromValuation(valuation);
  if (valuationAccountId) valuationsByAccountId = { ...valuationsByAccountId, [valuationAccountId]: valuation };

  return {
    ...state,
    trading: {
      ...state.trading,
      accountsById: account ? upsert(state.trading.accountsById, account) : state.trading.accountsById,
      valuationsByAccountId,
      positionValuationsById,
      positionsById,
      ordersById: order ? upsert(state.trading.ordersById, order) : state.trading.ordersById,
      fills: fill ? upsertFill(state.trading.fills, fill) : state.trading.fills,
    },
  };
}

function handleEnvelope(state, envelope) {
  const type = envelope?.type;
  const data = envelope?.data;
  const receivedAt = envelope?.timestamp || new Date().toISOString();
  let next = {
    ...state,
    connection: { ...state.connection, lastMessageAt: receivedAt },
  };

  if (type === 'connection.ready') {
    return {
      ...next,
      connection: { ...next.connection, status: 'ready', error: null, details: data },
    };
  }
  if (type === 'connection.status') {
    return { ...next, connection: { ...next.connection, details: data } };
  }
  if (type === 'market.status') {
    const gatewayStatus = data?.scope === 'gateway' ? data : next.market.gatewayStatus;
    const recovered = data?.scope === 'gateway'
      && data?.state === 'LIVE'
      && data?.recovered === true;
    return {
      ...next,
      market: {
        ...next.market,
        status: data,
        gatewayStatus,
        historyRecoveryRevision: next.market.historyRecoveryRevision + (recovered ? 1 : 0),
      },
    };
  }
  if (type === 'market.quote') {
    const symbol = String(data?.symbol || '').toUpperCase();
    if (!symbol) return next;
    return { ...next, market: { ...next.market, quotesBySymbol: { ...next.market.quotesBySymbol, [symbol]: data } } };
  }
  if (type === 'market.tick') {
    const symbol = String(data?.symbol || '').toUpperCase();
    if (!symbol) return next;
    // A tick carries the canonical live bid/ask/last fields. Mirror it into
    // quote state so active symbols do not need a duplicate market.quote
    // stream in addition to the full-frequency tick stream.
    return {
      ...next,
      market: {
        ...next.market,
        quotesBySymbol: { ...next.market.quotesBySymbol, [symbol]: data },
        ticksBySymbol: { ...next.market.ticksBySymbol, [symbol]: data },
      },
    };
  }
  if (type === 'market.candle.update' || type === 'market.candle.closed') {
    const key = candleKey(data);
    if (!key) return next;
    return { ...next, market: { ...next.market, candlesByKey: { ...next.market.candlesByKey, [key]: data } } };
  }
  if (type === 'trading.state.snapshot') {
    return mergeSnapshot(next, data?.accounts || []);
  }
  if (type === 'trading.order') {
    const order = data?.order;
    return { ...next, trading: { ...next.trading, ordersById: upsert(next.trading.ordersById, order) } };
  }
  if (type === 'trading.fill') {
    const fill = data?.fill;
    return fill ? { ...next, trading: { ...next.trading, fills: upsertFill(next.trading.fills, fill) } } : next;
  }
  if (type === 'trading.position') {
    const position = data?.position;
    const id = entityId(position);
    if (!id) return next;
    if (data?.event === 'closed' || position?.status === 'CLOSED') {
      const positionsById = { ...next.trading.positionsById };
      const positionValuationsById = { ...next.trading.positionValuationsById };
      delete positionsById[id];
      delete positionValuationsById[id];
      return { ...next, trading: { ...next.trading, positionsById, positionValuationsById } };
    }
    return { ...next, trading: { ...next.trading, positionsById: { ...next.trading.positionsById, [id]: position } } };
  }
  if (type === 'trading.position.valuation') {
    const id = entityId(data);
    if (!id) return next;
    return { ...next, trading: { ...next.trading, positionValuationsById: { ...next.trading.positionValuationsById, [id]: data } } };
  }
  if (type === 'trading.account') {
    const account = data?.account;
    return { ...next, trading: { ...next.trading, accountsById: upsert(next.trading.accountsById, account) } };
  }
  if (type === 'trading.account.valuation') {
    const accountId = accountIdFromValuation(data);
    if (!accountId) return next;
    return { ...next, trading: { ...next.trading, valuationsByAccountId: { ...next.trading.valuationsByAccountId, [accountId]: data } } };
  }
  if (type === 'trading.account.balance') {
    const accountId = data?.accountId == null ? null : String(data.accountId);
    const account = accountId ? next.trading.accountsById[accountId] : null;
    if (!account) return next;
    return {
      ...next,
      trading: {
        ...next.trading,
        accountsById: {
          ...next.trading.accountsById,
          [accountId]: { ...account, state: { ...account.state, balance: data.balance ?? account.state?.balance } },
        },
      },
    };
  }
  if (type === 'trading.account.control') {
    const account = data?.account;
    return { ...next, trading: { ...next.trading, accountsById: upsert(next.trading.accountsById, account) } };
  }
  return next;
}

export function tradingReducer(state, action) {
  switch (action.type) {
    case 'connection/status':
      return {
        ...state,
        connection: {
          ...state.connection,
          status: action.payload.status,
          error: action.payload.error || null,
          details: action.payload.details ?? state.connection.details,
        },
      };
    case 'connection/reset':
      return { ...initialTradingState };
    case 'market/quotes': {
      const quotesBySymbol = { ...state.market.quotesBySymbol };
      for (const quote of action.payload || []) {
        const symbol = String(quote?.symbol || '').toUpperCase();
        if (symbol) quotesBySymbol[symbol] = quote;
      }
      return { ...state, market: { ...state.market, quotesBySymbol } };
    }
    case 'trading/command-result':
      return mergeCommandResult(state, action.payload);
    case 'socket/envelope':
      return handleEnvelope(state, action.payload);
    default:
      return state;
  }
}
