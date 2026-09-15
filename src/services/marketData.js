const API_URL = import.meta.env.VITE_MARKET_DATA_URL || '';
const WS_URL = import.meta.env.VITE_MARKET_WS_URL || '';

export const SYMBOLS = [
  { symbol: 'AUDCAD', description: 'Australian Dollar · Canadian Dollar', priceScale: 100000 },
  { symbol: 'EURUSD', description: 'Euro · US Dollar', priceScale: 100000 },
  { symbol: 'GBPUSD', description: 'British Pound · US Dollar', priceScale: 100000 },
  { symbol: 'USDJPY', description: 'US Dollar · Japanese Yen', priceScale: 1000 },
  { symbol: 'XAUUSD', description: 'Gold · US Dollar', priceScale: 100 },
  { symbol: 'US30', description: 'US Wall Street 30', priceScale: 1 },
];

export const TIMEFRAMES = {
  M1: '1', M5: '5', M15: '15', H1: '60', H4: '240', D1: '1D',
};

const listeners = new Map();
let socket;
let reconnectTimer;

function emit(symbol, quote) {
  listeners.get(symbol)?.forEach((fn) => fn(quote));
}

function connect() {
  if (!WS_URL || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  socket = new WebSocket(WS_URL);
  socket.addEventListener('open', () => {
    [...listeners.keys()].forEach((symbol) => socket.send(JSON.stringify({ type: 'subscribe', symbol })));
  });
  socket.addEventListener('message', ({ data }) => {
    try {
      const message = JSON.parse(data);
      if (message.symbol && Number.isFinite(Number(message.bid)) && Number.isFinite(Number(message.ask))) {
        emit(message.symbol, { ...message, bid: Number(message.bid), ask: Number(message.ask), time: message.time || Date.now() });
      }
    } catch { /* ignore malformed provider messages */ }
  });
  socket.addEventListener('close', () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 1500);
  });
}

export async function getBars(symbol, interval, from, to) {
  if (!API_URL) return [];
  const url = new URL('/market/bars', API_URL);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('from', String(from));
  url.searchParams.set('to', String(to));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Market history failed (${response.status})`);
  return response.json();
}

export async function getQuotes(symbols = SYMBOLS.map((item) => item.symbol)) {
  if (!API_URL) return [];
  const url = new URL('/market/quotes', API_URL);
  url.searchParams.set('symbols', symbols.join(','));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Quotes failed (${response.status})`);
  return response.json();
}

export function subscribeQuote(symbol, callback) {
  if (!listeners.has(symbol)) listeners.set(symbol, new Set());
  listeners.get(symbol).add(callback);
  connect();
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'subscribe', symbol }));
  return () => {
    listeners.get(symbol)?.delete(callback);
    if (!listeners.get(symbol)?.size) {
      listeners.delete(symbol);
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    }
  };
}

export const marketDataConfigured = Boolean(API_URL && WS_URL);
