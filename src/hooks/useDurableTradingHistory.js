import { useEffect, useMemo, useState } from 'react';
import { useTraderAuth } from './useTraderAuth.js';
import { useTradingStore } from './useTradingStore.js';

export function useDurableTradingHistory() {
  const auth = useTraderAuth();
  const { trading, connection, commands } = useTradingStore();
  const [state, setState] = useState({ orders: [], deals: [], positions: [], loaded: false, error: null });
  const accountId = useMemo(() => {
    const granted = auth.principal?.accountIds?.map(String) || [];
    const loaded = Object.keys(trading.accountsById);
    return granted.find(id => loaded.includes(id)) || granted[0] || loaded[0] || null;
  }, [auth.principal?.accountIds, trading.accountsById]);

  useEffect(() => {
    if (!accountId || connection.status !== 'ready') return undefined;
    const controller = new AbortController();
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

  return { accountId, ...state };
}
