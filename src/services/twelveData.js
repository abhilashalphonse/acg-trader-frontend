const API_BASE = 'https://api.twelvedata.com';
const WS_BASE = 'wss://ws.twelvedata.com/v1/quotes/price';

const SYMBOLS = {
  AUDCAD: 'AUD/CAD',
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  USDJPY: 'USD/JPY',
  XAUUSD: 'XAU/USD',
  US30: 'DJI',
};

const INTERVALS = {
  M1: '1min',
  M5: '5min',
  M15: '15min',
  H1: '1h',
  H4: '4h',
  D1: '1day',
};

const INTERVAL_SECONDS = {
  M1: 60,
  M5: 300,
  M15: 900,
  H1: 3600,
  H4: 14400,
  D1: 86400,
};

export const toTwelveSymbol = symbol => SYMBOLS[symbol] ?? symbol;
export const toTwelveInterval = timeframe => INTERVALS[timeframe] ?? '1min';
export const timeframeSeconds = timeframe => INTERVAL_SECONDS[timeframe] ?? 60;

function apiKey() {
  const key = import.meta.env.VITE_TWELVE_DATA_API_KEY;
  if (!key) throw new Error('Missing VITE_TWELVE_DATA_API_KEY');
  return key;
}

function parseUtcDatetime(value) {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const ms = Date.parse(`${iso}Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export async function fetchCandles(symbol, timeframe, outputsize = 500, signal) {
  const params = new URLSearchParams({
    symbol: toTwelveSymbol(symbol),
    interval: toTwelveInterval(timeframe),
    outputsize: String(outputsize),
    timezone: 'UTC',
    order: 'asc',
    apikey: apiKey(),
  });

  const response = await fetch(`${API_BASE}/time_series?${params}`, { signal });
  const body = await response.json();

  if (!response.ok || body?.status === 'error') {
    throw new Error(body?.message || `Twelve Data request failed (${response.status})`);
  }

  const bars = (body?.values || [])
    .map(item => ({
      time: parseUtcDatetime(item.datetime),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
    }))
    .filter(bar => bar.time && [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite));

  return bars;
}

export function subscribePrice(symbol, onTick, onError) {
  let closed = false;
  let heartbeat;
  const socket = new WebSocket(`${WS_BASE}?apikey=${encodeURIComponent(apiKey())}`);
  const twelveSymbol = toTwelveSymbol(symbol);

  socket.addEventListener('open', () => {
    if (closed) return;
    socket.send(JSON.stringify({
      action: 'subscribe',
      params: { symbols: twelveSymbol },
    }));

    heartbeat = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'heartbeat' }));
      }
    }, 10000);
  });

  socket.addEventListener('message', event => {
    try {
      const data = JSON.parse(event.data);
      if (data?.event !== 'price') return;

      const price = Number(data.price);
      const time = Number(data.timestamp);
      if (!Number.isFinite(price) || !Number.isFinite(time)) return;

      onTick({ price, time: Math.floor(time), symbol: data.symbol || twelveSymbol });
    } catch (error) {
      onError?.(error);
    }
  });

  socket.addEventListener('error', () => {
    onError?.(new Error('Twelve Data WebSocket unavailable'));
  });

  return () => {
    closed = true;
    if (heartbeat) window.clearInterval(heartbeat);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'unsubscribe', params: { symbols: twelveSymbol } }));
    }
    socket.close();
  };
}
