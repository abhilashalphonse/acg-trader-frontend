const API_BASE = 'https://api.twelvedata.com';
const WS_BASE = 'wss://ws.twelvedata.com/v1/quotes/price';

const SYMBOLS = { AUDCAD:'AUD/CAD', EURUSD:'EUR/USD', GBPUSD:'GBP/USD', USDJPY:'USD/JPY', XAUUSD:'XAU/USD', US30:'DJI' };
const INTERVALS = { M1:'1min', M5:'5min', M15:'15min', H1:'1h', H4:'4h', D1:'1day' };
const INTERVAL_SECONDS = { M1:60, M5:300, M15:900, H1:3600, H4:14400, D1:86400 };
const CACHE_TTL = 5 * 60 * 1000;
const candleCache = new Map();

export const toTwelveSymbol = symbol => SYMBOLS[symbol] ?? symbol;
export const toTwelveInterval = timeframe => INTERVALS[timeframe] ?? '1min';
export const timeframeSeconds = timeframe => INTERVAL_SECONDS[timeframe] ?? 60;

function apiKey(){ const key=import.meta.env.VITE_TWELVE_DATA_API_KEY; if(!key) throw new Error('Missing VITE_TWELVE_DATA_API_KEY'); return key; }
function parseUtcDatetime(value){ if(!value)return null; const iso=value.includes('T')?value:value.replace(' ','T'); const ms=Date.parse(`${iso}Z`); return Number.isFinite(ms)?Math.floor(ms/1000):null; }
function cacheKey(symbol,timeframe,outputsize){ return `${symbol}:${timeframe}:${outputsize}`; }

export async function fetchCandles(symbol,timeframe,outputsize=500,signal){
  const key=cacheKey(symbol,timeframe,outputsize); const cached=candleCache.get(key);
  if(cached && Date.now()-cached.savedAt<CACHE_TTL) return cached.bars.map(bar=>({...bar}));
  const params=new URLSearchParams({symbol:toTwelveSymbol(symbol),interval:toTwelveInterval(timeframe),outputsize:String(outputsize),timezone:'UTC',order:'asc',apikey:apiKey()});
  const response=await fetch(`${API_BASE}/time_series?${params}`,{signal}); const body=await response.json();
  if(!response.ok||body?.status==='error') throw new Error(body?.message||`Twelve Data request failed (${response.status})`);
  const bars=(body?.values||[]).map(item=>({time:parseUtcDatetime(item.datetime),open:Number(item.open),high:Number(item.high),low:Number(item.low),close:Number(item.close)})).filter(bar=>bar.time&&[bar.open,bar.high,bar.low,bar.close].every(Number.isFinite));
  candleCache.set(key,{savedAt:Date.now(),bars}); return bars.map(bar=>({...bar}));
}

export function mergeLiveBarIntoCache(symbol,timeframe,bar,outputsize=500){
  const key=cacheKey(symbol,timeframe,outputsize); const cached=candleCache.get(key); if(!cached)return;
  const bars=cached.bars.slice(); const last=bars[bars.length-1];
  if(last?.time===bar.time) bars[bars.length-1]={...bar}; else if(!last||bar.time>last.time) bars.push({...bar});
  while(bars.length>outputsize) bars.shift(); candleCache.set(key,{savedAt:Date.now(),bars});
}

class TwelveDataSocketManager{
  constructor(){ this.socket=null; this.listeners=new Map(); this.reconnectTimer=null; this.heartbeat=null; this.retry=0; this.intentionalClose=false; }
  subscribe(symbol,onTick,onError){
    const tdSymbol=toTwelveSymbol(symbol); let set=this.listeners.get(tdSymbol); if(!set){set=new Set();this.listeners.set(tdSymbol,set);} const listener={onTick,onError}; set.add(listener);
    this.ensureConnected(); if(this.socket?.readyState===WebSocket.OPEN) this.sendSubscription('subscribe',tdSymbol);
    return ()=>{ const current=this.listeners.get(tdSymbol); if(!current)return; current.delete(listener); if(!current.size){this.listeners.delete(tdSymbol);if(this.socket?.readyState===WebSocket.OPEN)this.sendSubscription('unsubscribe',tdSymbol);} if(!this.listeners.size)this.disconnect(); };
  }
  ensureConnected(){ if(!this.listeners.size||this.socket?.readyState===WebSocket.OPEN||this.socket?.readyState===WebSocket.CONNECTING)return; this.intentionalClose=false; this.socket=new WebSocket(`${WS_BASE}?apikey=${encodeURIComponent(apiKey())}`);
    this.socket.addEventListener('open',()=>{this.retry=0; for(const symbol of this.listeners.keys())this.sendSubscription('subscribe',symbol); this.startHeartbeat();});
    this.socket.addEventListener('message',event=>{try{const data=JSON.parse(event.data);if(data?.event!=='price')return;const price=Number(data.price),time=Number(data.timestamp);if(!Number.isFinite(price)||!Number.isFinite(time))return;const symbol=data.symbol;const targets=this.listeners.get(symbol);if(!targets)return;const tick={price,time:Math.floor(time),symbol};for(const listener of targets)listener.onTick(tick);}catch(error){this.emitError(error);}});
    this.socket.addEventListener('error',()=>this.emitError(new Error('Twelve Data WebSocket unavailable')));
    this.socket.addEventListener('close',()=>{this.stopHeartbeat();this.socket=null;if(!this.intentionalClose&&this.listeners.size)this.scheduleReconnect();});
  }
  sendSubscription(action,symbol){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({action,params:{symbols:symbol}}));}
  startHeartbeat(){this.stopHeartbeat();this.heartbeat=window.setInterval(()=>{if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({action:'heartbeat'}));},10000);}
  stopHeartbeat(){if(this.heartbeat){window.clearInterval(this.heartbeat);this.heartbeat=null;}}
  scheduleReconnect(){if(this.reconnectTimer)return;const delay=Math.min(1000*2**this.retry,30000);this.retry+=1;this.reconnectTimer=window.setTimeout(()=>{this.reconnectTimer=null;this.ensureConnected();},delay);}
  emitError(error){for(const set of this.listeners.values())for(const listener of set)listener.onError?.(error);}
  disconnect(){this.intentionalClose=true;if(this.reconnectTimer){window.clearTimeout(this.reconnectTimer);this.reconnectTimer=null;}this.stopHeartbeat();const socket=this.socket;this.socket=null;if(socket&&socket.readyState<2)socket.close();}
}

const socketManager=new TwelveDataSocketManager();
export function subscribePrice(symbol,onTick,onError){ return socketManager.subscribe(symbol,onTick,onError); }
