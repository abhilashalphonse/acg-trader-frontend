import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribePrice } from '../services/twelveData.js';

function decimalsFor(symbol, fallback) {
  if (symbol === 'USDJPY') return 3;
  if (symbol === 'XAUUSD') return 2;
  if (symbol === 'US30') return 0;
  const value = String(fallback ?? '');
  const point = value.indexOf('.');
  return point >= 0 ? value.length - point - 1 : 5;
}
function formatPrice(value, decimals, fallback) { return Number.isFinite(value) ? value.toFixed(decimals) : fallback; }

export function useMarketData(seedMarkets, activeSymbol) {
  const seedRef = useRef(seedMarkets);
  const [quotes, setQuotes] = useState({});
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [activeTick, setActiveTick] = useState(null);

  useEffect(() => { seedRef.current = seedMarkets; }, [seedMarkets]);

  useEffect(() => {
    if (!activeSymbol) return undefined;
    setStatus('connecting'); setError(null); setActiveTick(null);
    const unsubscribe = subscribePrice(activeSymbol, tick => {
      const seed = seedRef.current.find(item => item.symbol === activeSymbol);
      const decimals = decimalsFor(activeSymbol, seed?.bid);
      setActiveTick(tick);
      setQuotes(current => ({ ...current, [activeSymbol]: { price:tick.price,bid:tick.bid,ask:tick.ask,timestamp:tick.timestamp??tick.time,dayVolume:tick.dayVolume,decimals } }));
      setStatus('live'); setError(null);
    }, streamError => { setError(streamError); setStatus('error'); }, subscription => {
      if(subscription.status==='ok'&&subscription.event==='subscribe-status'){setStatus('live');setError(null);}
      else if(subscription.status==='error')setStatus('error');
    });
    return unsubscribe;
  }, [activeSymbol]);

  const markets = useMemo(() => seedMarkets.map(market => {
    const quote=quotes[market.symbol]; if(!quote)return {...market,live:false};
    return {...market,last:formatPrice(quote.price,quote.decimals,market.bid),bid:formatPrice(quote.bid,quote.decimals,market.bid),ask:formatPrice(quote.ask,quote.decimals,market.ask),timestamp:quote.timestamp,dayVolume:quote.dayVolume,live:true};
  }), [seedMarkets, quotes]);

  return { markets, activeTick, connected:status==='live', status, error, source:'twelve-data-websocket' };
}
