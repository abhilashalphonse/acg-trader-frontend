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
function direction(next, previous) { return !Number.isFinite(previous)||next===previous ? 'flat' : next>previous ? 'up' : 'down'; }

export function useMarketData(seedMarkets, activeSymbol) {
  const seedRef=useRef(seedMarkets),previousTickRef=useRef(null);
  const [quotes,setQuotes]=useState({}),[status,setStatus]=useState('idle'),[error,setError]=useState(null),[activeTick,setActiveTick]=useState(null);
  useEffect(()=>{seedRef.current=seedMarkets;},[seedMarkets]);
  useEffect(()=>{
    if(!activeSymbol)return undefined;
    previousTickRef.current=null;setStatus('connecting');setError(null);setActiveTick(null);
    const unsubscribe=subscribePrice(activeSymbol,tick=>{
      const seed=seedRef.current.find(item=>item.symbol===activeSymbol),decimals=decimalsFor(activeSymbol,seed?.bid),previous=previousTickRef.current;
      const enriched={...tick,direction:direction(tick.price,previous?.price),bidDirection:direction(tick.bid,previous?.bid),askDirection:direction(tick.ask,previous?.ask),spread:Number.isFinite(tick.bid)&&Number.isFinite(tick.ask)?tick.ask-tick.bid:null};
      previousTickRef.current=enriched;setActiveTick(enriched);
      setQuotes(current=>({...current,[activeSymbol]:{price:tick.price,bid:tick.bid,ask:tick.ask,timestamp:tick.timestamp??tick.time,dayVolume:tick.dayVolume,decimals,direction:enriched.direction,bidDirection:enriched.bidDirection,askDirection:enriched.askDirection,spread:enriched.spread}}));
      setStatus('live');setError(null);
    },streamError=>{setError(streamError);setStatus('error');},subscription=>{if(subscription.status==='ok'&&subscription.event==='subscribe-status'){setStatus('live');setError(null);}else if(subscription.status==='error')setStatus('error');});
    return unsubscribe;
  },[activeSymbol]);
  const markets=useMemo(()=>seedMarkets.map(market=>{const quote=quotes[market.symbol];if(!quote)return {...market,live:false,direction:'flat',bidDirection:'flat',askDirection:'flat',spread:null};return {...market,last:formatPrice(quote.price,quote.decimals,market.bid),bid:formatPrice(quote.bid,quote.decimals,market.bid),ask:formatPrice(quote.ask,quote.decimals,market.ask),timestamp:quote.timestamp,dayVolume:quote.dayVolume,direction:quote.direction,bidDirection:quote.bidDirection,askDirection:quote.askDirection,spread:quote.spread,live:true};}),[seedMarkets,quotes]);
  return {markets,activeTick,connected:status==='live',status,error,source:'twelve-data-websocket'};
}
