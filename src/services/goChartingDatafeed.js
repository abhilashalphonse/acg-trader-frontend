import { getBars, subscribeQuote, SYMBOLS, TIMEFRAMES } from './marketData.js';

const supportedResolutions = Object.values(TIMEFRAMES);

export function createGoChartingDatafeed() {
  const realtime = new Map();
  return {
    onReady(callback) {
      queueMicrotask(() => callback({ supported_resolutions: supportedResolutions }));
    },
    searchSymbols(userInput, _exchange, _symbolType, onResultReadyCallback) {
      const q = userInput.toUpperCase();
      onResultReadyCallback(SYMBOLS.filter((item) => item.symbol.includes(q)).map((item) => ({
        symbol: item.symbol, full_name: item.symbol, description: item.description, exchange: 'ACG', ticker: item.symbol, type: 'forex',
      })));
    },
    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
      const item = SYMBOLS.find((entry) => entry.symbol === symbolName);
      if (!item) return onResolveErrorCallback?.('Unknown symbol');
      queueMicrotask(() => onSymbolResolvedCallback({
        name: item.symbol, ticker: item.symbol, description: item.description, type: 'forex', session: '24x5', timezone: 'Etc/UTC', exchange: 'ACG', minmov: 1,
        pricescale: item.priceScale, has_intraday: true, has_daily: true, supported_resolutions: supportedResolutions,
      }));
    },
    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
      try {
        const bars = await getBars(symbolInfo.ticker || symbolInfo.name, resolution, periodParams.from, periodParams.to);
        onHistoryCallback(bars, { noData: bars.length === 0 });
      } catch (error) { onErrorCallback?.(error.message); }
    },
    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID) {
      const symbol = symbolInfo.ticker || symbolInfo.name;
      let bar;
      const intervalMinutes = resolution === '1D' ? 1440 : Number(resolution) || 1;
      const stop = subscribeQuote(symbol, (quote) => {
        const price = (quote.bid + quote.ask) / 2;
        const bucket = Math.floor(quote.time / (intervalMinutes * 60000)) * intervalMinutes * 60000;
        if (!bar || bar.time !== bucket) bar = { time: bucket, open: price, high: price, low: price, close: price, volume: 0 };
        else bar = { ...bar, high: Math.max(bar.high, price), low: Math.min(bar.low, price), close: price };
        onRealtimeCallback(bar);
      });
      realtime.set(subscriberUID, stop);
    },
    unsubscribeBars(subscriberUID) {
      realtime.get(subscriberUID)?.();
      realtime.delete(subscriberUID);
    },
  };
}
