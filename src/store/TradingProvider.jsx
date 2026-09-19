import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { ApiError } from '../api/client.js';
import { tradingApi } from '../api/trading.js';
import { AuthContext } from '../auth/AuthProvider.jsx';
import { TraderSocket } from '../realtime/traderSocket.js';
import { initialTradingState, tradingReducer } from './tradingReducer.js';

export const TradingContext = createContext(null);

function isAuthExpiry(error) {
  return error?.status === 401
    || ['TRADER_SESSION_INVALID', 'AUTH_TOKEN_REQUIRED', 'TRADER_AUTH_REQUIRED'].includes(error?.code);
}

export function TradingProvider({ children }) {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('TradingProvider must be rendered inside AuthProvider');

  const [state, dispatch] = useReducer(tradingReducer, initialTradingState);
  const socketRef = useRef(null);
  const refreshSessionRef = useRef(auth.refreshSession);

  useEffect(() => { refreshSessionRef.current = auth.refreshSession; }, [auth.refreshSession]);

  useEffect(() => {
    const socket = new TraderSocket({
      onEnvelope: envelope => dispatch({ type: 'socket/envelope', payload: envelope }),
      onStatus: payload => dispatch({ type: 'connection/status', payload }),
      onSessionInvalid: () => {
        void refreshSessionRef.current?.().catch(() => {});
      },
    });
    socketRef.current = socket;
    return () => {
      socket.destroy();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (auth.accessToken) {
      socketRef.current?.connect(auth.accessToken);
      return;
    }
    socketRef.current?.disconnect();
    dispatch({ type: 'connection/reset' });
  }, [auth.accessToken]);

  const subscribeMarket = useCallback(subscription => socketRef.current?.subscribe(subscription) || (() => {}), []);
  const requestSnapshot = useCallback(accountIds => socketRef.current?.requestSnapshot(accountIds) || false, []);
  const requestConnectionStatus = useCallback(() => socketRef.current?.requestStatus() || false, []);
  const ingestQuotes = useCallback(quotes => dispatch({ type: 'market/quotes', payload: quotes }), []);

  const withTraderToken = useCallback(async executor => {
    let token = auth.accessToken;
    if (!token) {
      const renewed = await auth.refreshSession();
      token = renewed?.accessToken || null;
    }
    if (!token) {
      throw new ApiError('Trading authentication is required', { status: 401, code: 'TRADER_AUTH_REQUIRED' });
    }

    try {
      return await executor(token);
    } catch (error) {
      if (!isAuthExpiry(error)) throw error;
      const renewed = await auth.refreshSession();
      const retryToken = renewed?.accessToken || null;
      if (!retryToken) throw error;
      return executor(retryToken);
    }
  }, [auth.accessToken, auth.refreshSession]);

  const executeCommand = useCallback(async executor => {
    const result = await withTraderToken(executor);
    if (result && typeof result === 'object') dispatch({ type: 'trading/command-result', payload: result });
    return result;
  }, [withTraderToken]);

  const commands = useMemo(() => ({
    accountValuation: (accountId, signal) => withTraderToken(token => tradingApi.accountValuation(token, accountId, signal)),
    positionValuation: (positionId, signal) => withTraderToken(token => tradingApi.positionValuation(token, positionId, signal)),
    pendingOrders: (accountId, signal) => withTraderToken(token => tradingApi.pendingOrders(token, accountId, signal)),
    historyOrders: (accountId, query, signal) => withTraderToken(token => tradingApi.historyOrders(token, accountId, query, signal)),
    historyDeals: (accountId, query, signal) => withTraderToken(token => tradingApi.historyDeals(token, accountId, query, signal)),
    historyPositions: (accountId, query, signal) => withTraderToken(token => tradingApi.historyPositions(token, accountId, query, signal)),
    openMarketOrder: (command, signal) => executeCommand(token => tradingApi.openMarketOrder(token, command, signal)),
    placePendingOrder: (command, signal) => executeCommand(token => tradingApi.placePendingOrder(token, command, signal)),
    amendPendingOrder: (orderId, command, signal) => executeCommand(token => tradingApi.amendPendingOrder(token, orderId, command, signal)),
    cancelPendingOrder: (orderId, command, signal) => executeCommand(token => tradingApi.cancelPendingOrder(token, orderId, command, signal)),
    updatePositionProtection: (positionId, command, signal) => executeCommand(token => tradingApi.updatePositionProtection(token, positionId, command, signal)),
    movePositionToBreakEven: (positionId, command, signal) => executeCommand(token => tradingApi.movePositionToBreakEven(token, positionId, command, signal)),
    configureTrailingStop: (positionId, command, signal) => executeCommand(token => tradingApi.configureTrailingStop(token, positionId, command, signal)),
    closePosition: (positionId, command, signal) => executeCommand(token => tradingApi.closePosition(token, positionId, command, signal)),
    reversePosition: (positionId, command, signal) => executeCommand(token => tradingApi.reversePosition(token, positionId, command, signal)),
    closeAllPositions: (accountId, command, signal) => executeCommand(token => tradingApi.closeAllPositions(token, accountId, command, signal)),
  }), [executeCommand, withTraderToken]);

  const value = useMemo(() => ({
    state,
    connection: state.connection,
    market: state.market,
    trading: state.trading,
    subscribeMarket,
    requestSnapshot,
    requestConnectionStatus,
    ingestQuotes,
    commands,
  }), [commands, ingestQuotes, requestConnectionStatus, requestSnapshot, state, subscribeMarket]);

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}
