import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { ApiError } from '../api/client.js';
import { tradingApi } from '../api/trading.js';
import { AuthContext } from '../auth/AuthProvider.jsx';
import { TraderSocket } from '../realtime/traderSocket.js';
import { initialTradingState, tradingReducer } from './tradingReducer.js';

export const TradingContext = createContext(null);

export function TradingProvider({ children }) {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('TradingProvider must be rendered inside AuthProvider');

  const [state, dispatch] = useReducer(tradingReducer, initialTradingState);
  const socketRef = useRef(null);
  const invalidateSessionRef = useRef(auth.invalidateSession);

  useEffect(() => { invalidateSessionRef.current = auth.invalidateSession; }, [auth.invalidateSession]);
  useEffect(() => {
    const socket = new TraderSocket({ onEnvelope: envelope => dispatch({ type: 'socket/envelope', payload: envelope }), onStatus: payload => dispatch({ type: 'connection/status', payload }), onSessionInvalid: error => invalidateSessionRef.current(error) });
    socketRef.current = socket;
    return () => { socket.destroy(); socketRef.current = null; };
  }, []);
  useEffect(() => {
    if (auth.accessToken) { socketRef.current?.connect(auth.accessToken); return; }
    socketRef.current?.disconnect(); dispatch({ type: 'connection/reset' });
  }, [auth.accessToken]);

  const subscribeMarket = useCallback(subscription => socketRef.current?.subscribe(subscription) || (() => {}), []);
  const requestSnapshot = useCallback(accountIds => socketRef.current?.requestSnapshot(accountIds) || false, []);
  const requestConnectionStatus = useCallback(() => socketRef.current?.requestStatus() || false, []);
  const ingestQuotes = useCallback(quotes => dispatch({ type: 'market/quotes', payload: quotes }), []);
  const requireToken = useCallback(() => { if (!auth.accessToken) throw new ApiError('Trading authentication is required', { status: 401, code: 'TRADER_AUTH_REQUIRED' }); return auth.accessToken; }, [auth.accessToken]);
  const executeCommand = useCallback(async executor => {
    const result = await executor();
    if (result && typeof result === 'object') dispatch({ type: 'trading/command-result', payload: result });
    return result;
  }, []);

  const commands = useMemo(() => ({
    accountValuation: (accountId, signal) => tradingApi.accountValuation(requireToken(), accountId, signal),
    positionValuation: (positionId, signal) => tradingApi.positionValuation(requireToken(), positionId, signal),
    pendingOrders: (accountId, signal) => tradingApi.pendingOrders(requireToken(), accountId, signal),
    historyOrders: (accountId, query, signal) => tradingApi.historyOrders(requireToken(), accountId, query, signal),
    historyDeals: (accountId, query, signal) => tradingApi.historyDeals(requireToken(), accountId, query, signal),
    historyPositions: (accountId, query, signal) => tradingApi.historyPositions(requireToken(), accountId, query, signal),
    openMarketOrder: (command, signal) => executeCommand(() => tradingApi.openMarketOrder(requireToken(), command, signal)),
    placePendingOrder: (command, signal) => executeCommand(() => tradingApi.placePendingOrder(requireToken(), command, signal)),
    amendPendingOrder: (orderId, command, signal) => executeCommand(() => tradingApi.amendPendingOrder(requireToken(), orderId, command, signal)),
    cancelPendingOrder: (orderId, command, signal) => executeCommand(() => tradingApi.cancelPendingOrder(requireToken(), orderId, command, signal)),
    updatePositionProtection: (positionId, command, signal) => executeCommand(() => tradingApi.updatePositionProtection(requireToken(), positionId, command, signal)),
    movePositionToBreakEven: (positionId, command, signal) => executeCommand(() => tradingApi.movePositionToBreakEven(requireToken(), positionId, command, signal)),
    configureTrailingStop: (positionId, command, signal) => executeCommand(() => tradingApi.configureTrailingStop(requireToken(), positionId, command, signal)),
    closePosition: (positionId, command, signal) => executeCommand(() => tradingApi.closePosition(requireToken(), positionId, command, signal)),
    reversePosition: (positionId, command, signal) => executeCommand(() => tradingApi.reversePosition(requireToken(), positionId, command, signal)),
    closeAllPositions: (accountId, command, signal) => executeCommand(() => tradingApi.closeAllPositions(requireToken(), accountId, command, signal)),
  }), [executeCommand, requireToken]);

  const value = useMemo(() => ({ state, connection: state.connection, market: state.market, trading: state.trading, subscribeMarket, requestSnapshot, requestConnectionStatus, ingestQuotes, commands }), [commands, ingestQuotes, requestConnectionStatus, requestSnapshot, state, subscribeMarket]);
  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}
