import { useEffect, useMemo, useRef, useState } from 'react';
import { marketApi } from '../api/market.js';
import { useTraderAuth } from './useTraderAuth.js';
import { useTradingStore } from './useTradingStore.js';

function decimalsFor(symbol, fallback) {
  if (symbol === 'USDJPY') return 3;
  if (symbol === 'XAUUSD') return 2;
  if (symbol === 'US30') return 0;
  const value = String(fallback ?? '');
  const point = value.indexOf('.');
  return point >= 0 ? value.length - point - 1 : 5;
}

function formatPrice(value, decimals, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(decimals) : fallback;
}

function direction(next, previous) {
  const a = Number(next);
  const b = Number(previous);
  return !Number.isFinite(a) || !Number.isFinite(b) || a === b ? 'flat' : a > b ? 'up' : 'down';
}

export function useMarketData(seedMarkets, activeSymbol) {
  const { authenticated } = useTraderAuth();
  const { market, connection, subscribeMarket, ingestQuotes } = useTradingStore();
  const [error, setError] = useState(null);
  const [directions, setDirections] = useState({});
  const [configuredSymbols, setConfiguredSymbols] = useState(null);
  const previousQuotesRef = useRef({});
  const symbols = useMemo(() => [...new Set(seedMarkets.map(item => item.symbol).filter(Boolean))], [seedMarkets]);
  const backendSymbols = useMemo(() => {
    if (!configuredSymbols) return symbols;
    const allowed = new Set(configuredSymbols);
    return symbols.filter(symbol => allowed.has(symbol));
  }, [configuredSymbols, symbols]);
  const activeBackendSymbol = backendSymbols.includes(activeSymbol) ? activeSymbol : null;

  useEffect(() => {
    const controller = new AbortController();
    void marketApi.status(controller.signal).then(response => {
      if (controller.signal.aborted) return;
      const available = Array.isArray(response?.symbols)
        ? response.symbols.map(item => String(item?.symbol || '').toUpperCase()).filter(Boolean)
        : [];
      if (available.length) setConfiguredSymbols(available);
    }).catch(nextError => {
      if (!controller.signal.aborted) setError(nextError);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!backendSymbols.length || !authenticated) return undefined;
    return subscribeMarket({ quotes: backendSymbols, ticks: activeBackendSymbol ? [activeBackendSymbol] : [] });
  }, [activeBackendSymbol, authenticated, backendSymbols, subscribeMarket]);

  useEffect(() => {
    if (!backendSymbols.length) return undefined;
    const controller = new AbortController();
    let timer = null;

    const refresh = async () => {
      try {
        const response = await marketApi.quotes(backendSymbols, controller.signal);
        if (controller.signal.aborted) return;
        ingestQuotes(response?.quotes || []);
        setError(null);
      } catch (nextError) {
        if (!controller.signal.aborted) setError(nextError);
      }
    };

    void refresh();
    if (!authenticated || connection.status !== 'ready') {
      timer = window.setInterval(() => void refresh(), 2000);
    }

    return () => {
      controller.abort();
      if (timer) window.clearInterval(timer);
    };
  }, [authenticated, backendSymbols, connection.status, ingestQuotes]);

  useEffect(() => {
    const updates = {};
    let changed = false;
    for (const symbol of symbols) {
      const quote = market.quotesBySymbol[symbol];
      if (!quote || previousQuotesRef.current[symbol] === quote) continue;
      const previous = previousQuotesRef.current[symbol];
      updates[symbol] = {
        direction: direction(quote.last ?? quote.price ?? quote.mid, previous?.last ?? previous?.price ?? previous?.mid),
        bidDirection: direction(quote.bid, previous?.bid),
        askDirection: direction(quote.ask, previous?.ask),
      };
      previousQuotesRef.current[symbol] = quote;
      changed = true;
    }
    if (changed) setDirections(current => ({ ...current, ...updates }));
  }, [market.quotesBySymbol, symbols]);

  const markets = useMemo(() => seedMarkets.map(item => {
    const quote = market.quotesBySymbol[item.symbol];
    if (!quote) return { ...item, live: false, direction: 'flat', bidDirection: 'flat', askDirection: 'flat', spread: null };
    const decimals = decimalsFor(item.symbol, item.bid);
    const itemDirections = directions[item.symbol] || { direction: 'flat', bidDirection: 'flat', askDirection: 'flat' };
    return {
      ...item,
      last: formatPrice(quote.last ?? quote.price ?? quote.mid, decimals, item.bid),
      bid: formatPrice(quote.bid, decimals, item.bid),
      ask: formatPrice(quote.ask, decimals, item.ask),
      timestamp: quote.providerTimestampMs ?? quote.receivedAtMs ?? quote.timeMs ?? null,
      dayVolume: quote.dayVolume ?? null,
      spread: Number.isFinite(Number(quote.spread)) ? Number(quote.spread) : null,
      isStale: Boolean(quote.isStale),
      live: !quote.isStale,
      ...itemDirections,
    };
  }), [directions, market.quotesBySymbol, seedMarkets]);

  const activeQuote = activeSymbol ? market.quotesBySymbol[activeSymbol] : null;
  const activeTick = activeBackendSymbol ? (market.ticksBySymbol[activeBackendSymbol] || activeQuote || null) : null;
  const status = authenticated ? connection.status : (error ? 'error' : 'public');

  return {
    markets,
    activeTick,
    connected: connection.status === 'ready',
    status,
    error: connection.error || error,
    source: 'acg-trader-backend',
  };
}
