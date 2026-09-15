// ACG Trader V1 GoCharting datafeed adapter.
// Shape follows GoChartingOSS/gocharting-sdk-demo's createChartDatafeed pattern.
// Until a production Forex/CFD feed is connected, bars are deterministic demo data.

const SUPPORTED_RESOLUTIONS = ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'];
const SYMBOL_SEARCH_URL = 'https://gocharting.com/sdk/instruments/exactSearch';

const BASE_PRICES = {
  AUDCAD: 0.9025,
  EURUSD: 1.1815,
  GBPUSD: 1.359,
  USDJPY: 159.4,
  XAUUSD: 3675,
  US30: 46100,
};

function symbolParts(symbolName) {
  const parts = String(symbolName || 'AUDCAD').split(':');
  return {
    exchange: parts.length === 3 ? parts[0] : 'FOREX',
    segment: parts.length === 3 ? parts[1] : 'CFD',
    symbol: parts.length === 3 ? parts[2] : parts.at(-1),
  };
}

function resolutionSeconds(resolution) {
  const value = typeof resolution === 'string' ? resolution : resolution?.label || '1';
  if (value === '1D') return 86400;
  if (value === '1W') return 604800;
  if (value === '1M') return 2592000;
  const minutes = Number.parseInt(value, 10) || 1;
  return minutes * 60;
}

function buildDemoBars(symbol, resolution, periodParams = {}) {
  const step = resolutionSeconds(resolution);
  const now = Math.floor(Date.now() / 1000);
  const to = typeof periodParams.to === 'number' ? periodParams.to : now;
  const rows = Math.min(periodParams.rows || periodParams.countBack || 240, 500);
  const from = typeof periodParams.from === 'number' ? periodParams.from : to - rows * step;
  const base = BASE_PRICES[symbol] || 100;
  const precision = base < 10 ? 5 : base < 1000 ? 3 : 2;
  const amplitude = base * 0.0012;
  const start = Math.floor(from / step) * step;
  const bars = [];
  let previous = base;

  for (let time = start; time <= to && bars.length < 500; time += step) {
    const phase = time / step;
    const drift = Math.sin(phase * 0.17) * amplitude + Math.sin(phase * 0.047) * amplitude * 0.6;
    const close = base + drift;
    const open = previous;
    const high = Math.max(open, close) + amplitude * 0.22;
    const low = Math.min(open, close) - amplitude * 0.22;
    bars.push({
      time,
      open: Number(open.toFixed(precision)),
      high: Number(high.toFixed(precision)),
      low: Number(low.toFixed(precision)),
      close: Number(close.toFixed(precision)),
      volume: 0,
    });
    previous = close;
  }

  return bars;
}

function toUdf(bars) {
  if (!bars.length) return { s: 'no_data', nextTime: null };
  return {
    s: 'ok',
    t: bars.map(bar => bar.time),
    o: bars.map(bar => bar.open),
    h: bars.map(bar => bar.high),
    l: bars.map(bar => bar.low),
    c: bars.map(bar => bar.close),
    v: bars.map(bar => bar.volume),
  };
}

function localSymbolInfo(symbolName) {
  const { exchange, segment, symbol } = symbolParts(symbolName);
  const base = BASE_PRICES[symbol] || 100;
  const decimals = base < 10 ? 5 : base < 1000 ? 3 : 2;
  return {
    symbol,
    full_name: `${exchange}:${segment}:${symbol}`,
    description: symbol,
    exchange,
    segment,
    type: exchange === 'FOREX' ? 'forex' : 'cfd',
    session: '24x5',
    session_label: '24x5',
    timezone: 'Etc/UTC',
    ticker: symbol,
    has_intraday: true,
    has_daily: true,
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    volume_precision: 0,
    data_status: 'streaming',
    tick_size: 1 / (10 ** decimals),
    max_tick_precision: decimals,
    quote_currency: symbol.endsWith('JPY') ? 'JPY' : 'USD',
  };
}

async function resolveFromGoCharting(symbolName) {
  const response = await fetch(`${SYMBOL_SEARCH_URL}?q=${encodeURIComponent(symbolName)}`);
  if (!response.ok) throw new Error(`GoCharting symbol lookup failed: ${response.status}`);
  const body = await response.json();
  const result = body?.payload?.results?.[0];
  if (!result) throw new Error(`No GoCharting symbol found for ${symbolName}`);
  return {
    ...localSymbolInfo(`${result.exchange}:${result.segment}:${result.symbol}`),
    description: result.name || result.symbol,
    type: String(result.asset_type || 'forex').toLowerCase(),
    timezone: result.exchange_info?.zone || 'Etc/UTC',
    supported_resolutions: result.exchange_info?.valid_intervals || SUPPORTED_RESOLUTIONS,
    tick_size: result.tick_size,
    max_tick_precision: result.max_tick_precision,
    quote_currency: result.quote_currency || 'USD',
    data_status: result.data_status || 'streaming',
  };
}

export function createGoChartingDatafeed() {
  const subscriptions = new Map();
  const symbolCache = new Map();

  return {
    onReady(callback) {
      queueMicrotask(() => callback({
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
      }));
    },

    async resolveSymbol(symbolName, onResolve, onError) {
      try {
        if (symbolCache.has(symbolName)) return onResolve(symbolCache.get(symbolName));
        let info;
        try {
          info = await resolveFromGoCharting(symbolName);
        } catch {
          info = localSymbolInfo(symbolName);
        }
        symbolCache.set(symbolName, info);
        onResolve(info);
      } catch (error) {
        onError(error?.message || 'Unable to resolve symbol');
      }
    },

    async searchSymbols(userInput, _exchange, _symbolType, onResult) {
      const query = String(userInput || '').toUpperCase();
      const results = Object.keys(BASE_PRICES)
        .filter(symbol => symbol.includes(query))
        .map(symbol => ({
          symbol,
          full_name: `FOREX:CFD:${symbol}`,
          description: symbol,
          exchange: 'FOREX',
          ticker: symbol,
          type: symbol === 'XAUUSD' || symbol === 'US30' ? 'cfd' : 'forex',
        }));
      onResult(results);
    },

    async getBars(symbolInfo, resolution, periodParams) {
      const symbol = symbolInfo?.symbol || symbolParts(symbolInfo?.full_name).symbol;
      return toUdf(buildDemoBars(symbol, resolution, periodParams));
    },

    subscribeBars(symbolInfo, resolution, onRealtime, subscriberUID) {
      const symbol = symbolInfo?.symbol || symbolParts(symbolInfo?.full_name).symbol;
      const step = resolutionSeconds(resolution);
      const timer = window.setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const bars = buildDemoBars(symbol, resolution, {
          from: now - step,
          to: now,
          rows: 2,
        });
        const latest = bars.at(-1);
        if (latest) onRealtime(latest);
      }, 1000);
      subscriptions.set(subscriberUID, timer);
    },

    unsubscribeBars(subscriberUID) {
      const timer = subscriptions.get(subscriberUID);
      if (timer) window.clearInterval(timer);
      subscriptions.delete(subscriberUID);
    },

    getServerTime(callback) {
      callback(Math.floor(Date.now() / 1000));
    },

    destroy() {
      subscriptions.forEach(timer => window.clearInterval(timer));
      subscriptions.clear();
      symbolCache.clear();
    },
  };
}
