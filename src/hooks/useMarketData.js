import { useEffect, useMemo, useState } from 'react';
import { getQuotes, marketDataConfigured, subscribeQuote, SYMBOLS } from '../services/marketData.js';

const fallback = Object.fromEntries(SYMBOLS.map((item) => [item.symbol, { symbol: item.symbol, bid: null, ask: null, change: null }]));

export default function useMarketData(activeSymbol) {
  const [quotes, setQuotes] = useState(fallback);
  const [status, setStatus] = useState(marketDataConfigured ? 'connecting' : 'unconfigured');

  useEffect(() => {
    if (!marketDataConfigured) return;
    let alive = true;
    getQuotes().then((items) => {
      if (!alive) return;
      setQuotes((current) => ({ ...current, ...Object.fromEntries(items.map((q) => [q.symbol, q])) }));
      setStatus('live');
    }).catch(() => setStatus('reconnecting'));
    const stops = SYMBOLS.map(({ symbol }) => subscribeQuote(symbol, (quote) => {
      setQuotes((current) => ({ ...current, [symbol]: { ...current[symbol], ...quote, symbol } }));
      setStatus('live');
    }));
    return () => { alive = false; stops.forEach((stop) => stop()); };
  }, []);

  return useMemo(() => ({ quotes, quote: quotes[activeSymbol], status }), [quotes, activeSymbol, status]);
}
