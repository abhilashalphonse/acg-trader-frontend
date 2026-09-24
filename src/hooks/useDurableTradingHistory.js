import { useEffect, useMemo, useState } from 'react';
import { useTraderAuth } from './useTraderAuth.js';
import { useTradingStore } from './useTradingStore.js';

export function useDurableTradingHistory(preferredAccountId = null) {
  const auth = useTraderAuth();
  const { trading, connection, commands } = useTradingStore();
  const [state, setState] = useState({ orders: [], deals: [], positions: [], loaded: false, error: null });
  const accountId = useMemo(() => {
    const granted = auth.principal?.accountIds?.map(String) || [];
    const loaded = Object.keys(trading.accountsById);
    const preferred = preferredAccountId ? String(preferredAccountId) : null;
    const sessionSelected = auth.principal?.selectedAccountId ? String(auth.principal.selectedAccountId) : null;
    if (preferred && granted.includes(preferred)) return preferred;
    if (sessionSelected && granted.includes(sessionSelected)) return sessionSelected;
    return granted.find(id => loaded.includes(id)) || granted[0] || loaded[0] || null;
  }, [auth.principal?.accountIds, auth.principal?.selectedAccountId, preferredAccountId, trading.accountsById]);

  useEffect(() => {
    if (!accountId || connection.status !== 'ready') return undefined;
    const controller = new AbortController();
    setState({ orders: [], deals: [], positions: [], loaded: false, error: null });
    Promise.all([
      commands.historyOrders(accountId, { limit: 200 }, controller.signal),
      commands.historyDeals(accountId, { limit: 200 }, controller.signal),
      commands.historyPositions(accountId, { limit: 200, status: 'CLOSED' }, controller.signal),
    ]).then(([orders, deals, positions]) => {
      if (!controller.signal.aborted) setState({ orders: orders.items || [], deals: deals.items || [], positions: positions.items || [], loaded: true, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState(current => ({ ...current, loaded: false, error }));
    });
    return () => controller.abort();
  }, [accountId, commands, connection.status]);

  const mergedOrders = useMemo(() => {
    const source = state.loaded ? [...Object.values(trading.ordersById), ...state.orders] : Object.values(trading.ordersById);
    const seen = new Set();
    return source.filter(item => {
      const id = String(item?.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [state.loaded, state.orders, trading.ordersById]);

  const mergedDeals = useMemo(() => {
    const source = state.loaded ? [...trading.fills, ...state.deals] : trading.fills;
    const seen = new Set();
    return source.filter(item => {
      const id = String(item?.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [state.deals, state.loaded, trading.fills]);

  return { accountId, ...state, orders: mergedOrders, deals: mergedDeals };
}
