import { useCallback, useEffect, useMemo, useState } from 'react';

export const WATCHLIST_STORAGE_KEY = 'acg-trader-watchlists-v1';

export const DEFAULT_WATCHLIST_SYMBOLS = Object.freeze([
  'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'US500', 'US100',
  'BTCUSD', 'ETHUSD', 'AAPL', 'NVDA', 'TSLA',
]);

const EMPTY_WORKSPACE = Object.freeze({ activeListId: 'favorites', lists: [] });

function uniqueSymbols(values, available = null) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const symbol = String(value || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol) || (available && !available.has(symbol))) continue;
    seen.add(symbol);
    result.push(symbol);
  }
  return result;
}

export function buildDefaultWatchlists(instruments = []) {
  const available = new Set(instruments.map(item => String(item?.symbol || '').toUpperCase()).filter(Boolean));
  const filter = symbols => uniqueSymbols(symbols, available);
  return [
    { id: 'favorites', name: 'Favorites', symbols: filter(DEFAULT_WATCHLIST_SYMBOLS) },
    { id: 'fx-majors', name: 'FX Majors', symbols: filter(['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD']) },
    { id: 'metals', name: 'Metals', symbols: filter(['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD']) },
  ];
}

export function normalizeWatchlistWorkspace(workspace, instruments = []) {
  const available = new Set(instruments.map(item => String(item?.symbol || '').toUpperCase()).filter(Boolean));
  if (!available.size) return workspace?.lists?.length ? workspace : EMPTY_WORKSPACE;

  const sourceLists = Array.isArray(workspace?.lists) && workspace.lists.length
    ? workspace.lists
    : buildDefaultWatchlists(instruments);

  const ids = new Set();
  const lists = sourceLists.map((list, index) => {
    const rawId = String(list?.id || '').trim();
    let id = rawId || `watchlist-${index + 1}`;
    while (ids.has(id)) id = `${id}-${index + 1}`;
    ids.add(id);
    return {
      id,
      name: String(list?.name || 'Watchlist').trim() || 'Watchlist',
      symbols: uniqueSymbols(list?.symbols, available),
    };
  });

  if (!lists.length) lists.push(...buildDefaultWatchlists(instruments));
  const requestedActive = String(workspace?.activeListId || '');
  const activeListId = lists.some(list => list.id === requestedActive) ? requestedActive : lists[0].id;
  return { activeListId, lists };
}

function loadWorkspace() {
  if (typeof window === 'undefined') return EMPTY_WORKSPACE;
  try {
    const stored = JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) || 'null');
    return stored?.lists?.length ? stored : EMPTY_WORKSPACE;
  } catch {
    return EMPTY_WORKSPACE;
  }
}

export function useWatchlists(instruments = []) {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const catalogKey = useMemo(
    () => instruments.map(item => String(item?.symbol || '').toUpperCase()).filter(Boolean).join('|'),
    [instruments],
  );

  useEffect(() => {
    if (!catalogKey) return;
    setWorkspace(current => {
      const next = normalizeWatchlistWorkspace(current, instruments);
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, [catalogKey, instruments]);

  useEffect(() => {
    if (typeof window === 'undefined' || !workspace.lists?.length) return;
    try { window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(workspace)); } catch { /* non-critical preference */ }
  }, [workspace]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = event => {
      if (event.key !== WATCHLIST_STORAGE_KEY || !event.newValue) return;
      try {
        const incoming = JSON.parse(event.newValue);
        setWorkspace(normalizeWatchlistWorkspace(incoming, instruments));
      } catch { /* ignore malformed external storage changes */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [instruments]);

  const activeList = useMemo(
    () => workspace.lists?.find(list => list.id === workspace.activeListId) || workspace.lists?.[0] || { id: 'favorites', name: 'Favorites', symbols: [] },
    [workspace],
  );
  const activeSymbols = useMemo(() => [...activeList.symbols], [activeList.symbols]);
  const activeSet = useMemo(() => new Set(activeSymbols), [activeSymbols]);

  const setActiveListId = useCallback(id => {
    setWorkspace(current => current.lists.some(list => list.id === id) ? { ...current, activeListId: id } : current);
  }, []);

  const updateActiveSymbols = useCallback(updater => {
    setWorkspace(current => ({
      ...current,
      lists: current.lists.map(list => {
        if (list.id !== current.activeListId) return list;
        const next = typeof updater === 'function' ? updater(list.symbols) : updater;
        return { ...list, symbols: uniqueSymbols(next) };
      }),
    }));
  }, []);

  const toggleSymbol = useCallback(symbol => {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (!normalized) return;
    updateActiveSymbols(symbols => symbols.includes(normalized)
      ? symbols.filter(item => item !== normalized)
      : [...symbols, normalized]);
  }, [updateActiveSymbols]);

  const removeSymbol = useCallback(symbol => {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (!normalized) return;
    updateActiveSymbols(symbols => symbols.filter(item => item !== normalized));
  }, [updateActiveSymbols]);

  const moveSymbol = useCallback((sourceSymbol, targetSymbol) => {
    const source = String(sourceSymbol || '').trim().toUpperCase();
    const target = String(targetSymbol || '').trim().toUpperCase();
    if (!source || !target || source === target) return;
    updateActiveSymbols(symbols => {
      const from = symbols.indexOf(source);
      const to = symbols.indexOf(target);
      if (from < 0 || to < 0) return symbols;
      const next = [...symbols];
      next.splice(from, 1);
      next.splice(to, 0, source);
      return next;
    });
  }, [updateActiveSymbols]);

  const moveSymbolBy = useCallback((symbol, delta) => {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (!normalized || !Number.isInteger(delta) || delta === 0) return;
    updateActiveSymbols(symbols => {
      const from = symbols.indexOf(normalized);
      if (from < 0) return symbols;
      const to = Math.min(symbols.length - 1, Math.max(0, from + delta));
      if (to === from) return symbols;
      const next = [...symbols];
      next.splice(from, 1);
      next.splice(to, 0, normalized);
      return next;
    });
  }, [updateActiveSymbols]);

  const createList = useCallback(name => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const id = `${Date.now()}-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'watchlist'}`;
    setWorkspace(current => ({ ...current, activeListId: id, lists: [...current.lists, { id, name: trimmed, symbols: [] }] }));
    return id;
  }, []);

  const isWatched = useCallback(symbol => activeSet.has(String(symbol || '').trim().toUpperCase()), [activeSet]);

  return {
    workspace,
    activeList,
    activeSymbols,
    isWatched,
    toggleSymbol,
    removeSymbol,
    moveSymbol,
    moveSymbolBy,
    setActiveListId,
    createList,
  };
}
