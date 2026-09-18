import { useEffect, useMemo, useRef, useState } from 'react';
import { marketApi } from '../api/market.js';
import { useTraderAuth } from './useTraderAuth.js';
import { useTradingStore } from './useTradingStore.js';

function formatPrice(value, digits) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : '—';
}

function direction(next, previous) {
  const a = Number(next);
  const b = Number(previous);
  return !Number.isFinite(a) || !Number.isFinite(b) || a === b ? 'flat' : a > b ? 'up' : 'down';
}

function normalizeActiveTick(value) {
  if (!value) return null;
  const rawSeconds = Number(value.time ?? value.timestamp);
  const rawMilliseconds = Number(value.timeMs ?? value.receivedAtMs ?? value.providerTimestampMs);
  const time = Number.isFinite(rawSeconds)
    ? Math.floor(rawSeconds)
    : Number.isFinite(rawMilliseconds)
      ? Math.floor(rawMilliseconds / 1000)
      : null;
  return {
    ...value,
    price: Number(value.price ?? value.last ?? value.mid),
    bid: value.bid == null ? null : Number(value.bid),
    ask: value.ask == null ? null : Number(value.ask),
    time,
    timestamp: time,
  };
}

function gatewayStateFor(status, symbol) {
  const rows = Array.isArray(status?.symbols) ? status.symbols : [];
  return rows.find(item => String(item?.symbol || '').toUpperCase() === symbol) || null;
}

export function useMarketData(instruments, activeSymbol) {
  const { authenticated } = useTraderAuth();
  const { market, connection, subscribeMarket, ingestQuotes } = useTradingStore();
  const [error, setError] = useState(null);
  const [directions, setDirections] = useState({});
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const previousQuotesRef = useRef({});

  const symbols = useMemo(() => [...new Set((instruments || []).map(item => item.symbol).filter(Boolean))], [instruments]);

  useEffect(() => {
    let disposed = false;
    let controller = new AbortController();
    let timer = null;
    const refresh = async () => {
      try {
        const response = await marketApi.status(controller.signal);
        if (!disposed && !controller.signal.aborted) {
          setGatewayStatus(response);
          setError(null);
        }
      } catch (nextError) {
        if (!disposed && !controller.signal.aborted) setError(nextError);
      } finally {
        if (!disposed) timer = window.setTimeout(() => {
          controller = new AbortController();
          void refresh();
        }, connection.status === 'ready' ? 15000 : 3000);
      }
    };
    void refresh();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [connection.status]);

  useEffect(() => {
    if (!symbols.length || !authenticated) return undefined;
    return subscribeMarket({ quotes: symbols, ticks: activeSymbol ? [activeSymbol] : [] });
  }, [activeSymbol, authenticated, subscribeMarket, symbols]);

  useEffect(() => {
    if (!symbols.length) return undefined;
    let disposed = false;
    let controller = new AbortController();
    let timer = null;
    const shouldPoll = !authenticated || connection.status !== 'ready';
    const refresh = async () => {
      try {
        const response = await marketApi.quotes(symbols, controller.signal);
        if (!disposed && !controller.signal.aborted) {
          ingestQuotes(response?.quotes || []);
          setError(null);
        }
      } catch (nextError) {
        if (!disposed && !controller.signal.aborted) setError(nextError);
      } finally {
        if (!disposed && shouldPoll) timer = window.setTimeout(() => {
          controller = new AbortController();
          void refresh();
        }, 2000);
      }
    };
    void refresh();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [authenticated, connection.status, ingestQuotes, symbols]);

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

  const markets = useMemo(() => (instruments || []).map(instrument => {
    const symbol = instrument.symbol;
    const quote = market.quotesBySymbol[symbol];
    const digits = Number.isFinite(Number(instrument.digits)) ? Number(instrument.digits) : 5;
    const itemDirections = directions[symbol] || { direction: 'flat', bidDirection: 'flat', askDirection: 'flat' };
    const gateway = gatewayStateFor(gatewayStatus, symbol);
    const isStale = quote ? Boolean(quote.isStale) : Boolean(gateway?.isStale ?? true);
    return {
      ...instrument,
      bid: formatPrice(quote?.bid, digits),
      ask: formatPrice(quote?.ask, digits),
      last: formatPrice(quote?.last ?? quote?.price ?? quote?.mid, digits),
      spread: Number.isFinite(Number(quote?.spread)) ? Number(quote.spread) : null,
      timestamp: quote?.providerTimestampMs ?? quote?.receivedAtMs ?? quote?.timeMs ?? null,
      dayVolume: quote?.dayVolume ?? null,
      isStale,
      live: Boolean(quote) && !isStale && gateway?.state !== 'DISCONNECTED',
      marketState: gateway?.state || (quote ? (isStale ? 'STALE' : 'LIVE') : 'WAITING'),
      sessionOpen: instrument.sessionOpen === true,
      change: null,
      ...itemDirections,
    };
  }), [directions, gatewayStatus, instruments, market.quotesBySymbol]);

  const activeQuote = activeSymbol ? market.quotesBySymbol[activeSymbol] : null;
  const activeRaw = activeSymbol ? (market.ticksBySymbol[activeSymbol] || activeQuote || null) : null;
  const activeTick = normalizeActiveTick(activeRaw);
  const activeMarket = markets.find(item => item.symbol === activeSymbol) || null;
  const status = gatewayStatus?.state || market.status?.state || (authenticated ? connection.status : (error ? 'ERROR' : 'PUBLIC'));

  return {
    markets,
    activeTick,
    activeMarket,
    connected: connection.status === 'ready',
    status,
    gatewayStatus,
    error: connection.error || error,
    source: 'acg-trader-backend',
  };
}
