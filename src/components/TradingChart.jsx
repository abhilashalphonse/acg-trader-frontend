import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
} from 'lightweight-charts';
import { fetchCandles, mergeLiveBarIntoCache, normalizeCandle, toBackendTimeframe } from '../services/marketData.js';
import { useTraderAuth } from '../hooks/useTraderAuth.js';
import { useTradingStore } from '../hooks/useTradingStore.js';
import { calculateIndicatorData } from '../utils/indicators.js';

const chartTokens = {
  background: '#080f17', text: '#718399', gridline: '#1b2b39', buy: '#2dd39b', sell: '#f05d68', blue: '#53c7ff', crosshair: '#71869b', crosshairLabel: '#172633',
};
const indicatorColors = {
  ema: ['#54c8ff'], sma: ['#f0c35c'], vwap: ['#b38cff'], bollinger: ['#65b6df', '#7f91a4', '#65b6df'], rsi: ['#b68cff'], atr: ['#f0ad5c'], macd: ['#55c8ff', '#ffb55f'], stochastic: ['#58d5ff', '#ff7fbd'],
};

function volumeForBar(bar) {
  return Number.isFinite(bar.volume) && bar.volume > 0 ? bar.volume : 0;
}
function toSeriesPoint(bar, mode) { return mode === 'line' ? { time: bar.time, value: bar.close } : bar; }
function priceFormatForSymbol(symbol) {
  if (symbol.includes('JPY')) return { type: 'price', precision: 3, minMove: 0.001 };
  if (symbol.startsWith('XAU')) return { type: 'price', precision: 2, minMove: 0.01 };
  if (symbol === 'US30') return { type: 'price', precision: 1, minMove: 0.1 };
  return { type: 'price', precision: 5, minMove: 0.00001 };
}
function decimalsForSymbol(symbol) {
  if (symbol.includes('JPY')) return 3;
  if (symbol.startsWith('XAU')) return 2;
  if (symbol === 'US30') return 1;
  return 5;
}
function indicatorLabel(indicator) {
  const settings = indicator.settings || {};
  if (indicator.id === 'ema') return `EMA ${settings.period || 20}`;
  if (indicator.id === 'sma') return `SMA ${settings.period || 20}`;
  if (indicator.id === 'rsi') return `RSI ${settings.period || 14}`;
  if (indicator.id === 'atr') return `ATR ${settings.period || 14}`;
  if (indicator.id === 'bollinger') return `BB ${settings.period || 20}, ${settings.deviation || 2}`;
  if (indicator.id === 'macd') return `MACD ${settings.fast || 12},${settings.slow || 26},${settings.signal || 9}`;
  if (indicator.id === 'stochastic') return `Stoch ${settings.kPeriod || 14},${settings.dPeriod || 3}`;
  if (indicator.id === 'vwap') return 'VWAP';
  if (indicator.id === 'volume') return 'Vol';
  return indicator.name || indicator.id;
}

export default function TradingChart({ symbol = 'EURUSD', timeframe = 'M1', tick = null, chartMode = 'candles', bidPrice = null, positions = [], indicators = [], onCoordinateApi = () => {} }) {
  const { authenticated } = useTraderAuth();
  const { market, subscribeMarket } = useTradingStore();
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const lastBarRef = useRef(null);
  const barsRef = useRef([]);
  const barsByTimeRef = useRef(new Map());
  const seriesRef = useRef(null);
  const volumeRef = useRef(null);
  const marketLineRef = useRef(null);
  const positionLinesRef = useRef([]);
  const indicatorSeriesRef = useRef([]);
  const indicatorBindingsRef = useRef([]);
  const indicatorPanesRef = useRef(0);
  const indicatorsRef = useRef(indicators);
  const indicatorFrameRef = useRef(null);
  const coordinateCallbackRef = useRef(onCoordinateApi);
  const [error, setError] = useState('');
  const [displayBar, setDisplayBar] = useState(null);

  const backendTimeframe = useMemo(() => {
    try { return toBackendTimeframe(timeframe); } catch { return null; }
  }, [timeframe]);
  const candleKey = symbol && backendTimeframe ? `${String(symbol).toUpperCase()}:${backendTimeframe}` : null;
  const rawLiveCandle = candleKey ? market.candlesByKey[candleKey] : null;
  const liveCandle = useMemo(() => rawLiveCandle ? normalizeCandle(rawLiveCandle) : null, [rawLiveCandle]);
  const decimals = useMemo(() => decimalsForSymbol(symbol), [symbol]);
  const visibleIndicators = useMemo(() => indicators.filter(item => item.visible !== false), [indicators]);
  const showVolume = useMemo(() => indicators.some(item => item.id === 'volume' && item.visible !== false), [indicators]);

  useEffect(() => { coordinateCallbackRef.current = onCoordinateApi; }, [onCoordinateApi]);
  useEffect(() => { indicatorsRef.current = indicators; }, [indicators]);
  useEffect(() => {
    if (!authenticated || !symbol || !backendTimeframe) return undefined;
    return subscribeMarket({ quotes: [String(symbol).toUpperCase()], candles: [{ symbol: String(symbol).toUpperCase(), timeframe: backendTimeframe }] });
  }, [authenticated, backendTimeframe, subscribeMarket, symbol]);

  const clearIndicatorSeries = useCallback(chart => {
    if (!chart) return;
    indicatorSeriesRef.current.forEach(series => { try { chart.removeSeries(series); } catch { /* disposed */ } });
    indicatorSeriesRef.current = [];
    indicatorBindingsRef.current = [];
    for (let index = indicatorPanesRef.current; index >= 1; index -= 1) { try { if (chart.panes().length > index) chart.removePane(index); } catch { /* disposed */ } }
    indicatorPanesRef.current = 0;
  }, []);

  const renderIndicators = useCallback((chart, bars) => {
    if (!chart || !bars?.length) return;
    clearIndicatorSeries(chart);
    let paneIndex = 1;
    indicatorsRef.current.filter(item => item.visible !== false && item.id !== 'volume').forEach((indicator, indicatorIndex) => {
      const result = calculateIndicatorData(indicator, bars);
      if (!result) return;
      const colors = indicatorColors[indicator.id] || ['#53c7ff', '#f0ad5c', '#b38cff'];
      const targetPane = result.kind === 'overlay' ? 0 : paneIndex++;
      const binding = { instanceId: indicator.instanceId, indicator, lines: [], histogram: null };
      result.lines?.forEach((line, lineIndex) => {
        const series = chart.addSeries(LineSeries, { color: colors[lineIndex % colors.length], lineWidth: line.key === 'bb-mid' ? 1 : 2, lineStyle: line.key === 'bb-mid' ? LineStyle.Dotted : LineStyle.Solid, priceLineVisible: false, lastValueVisible: result.kind !== 'overlay', crosshairMarkerVisible: true, title: line.label }, targetPane);
        series.setData(line.data);
        indicatorSeriesRef.current.push(series);
        binding.lines.push({ key: line.key, series });
        if (lineIndex === 0 && Array.isArray(result.guides)) result.guides.forEach(guide => series.createPriceLine({ price: guide, color: 'rgba(113,131,153,0.38)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' }));
      });
      if (result.kind === 'macd' && result.histogram?.length) {
        const histogram = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false, base: 0 }, targetPane);
        histogram.setData(result.histogram.map(point => ({ ...point, color: point.value >= 0 ? 'rgba(45,211,155,0.45)' : 'rgba(255,95,105,0.45)' })));
        indicatorSeriesRef.current.push(histogram);
        binding.histogram = histogram;
      }
      indicatorBindingsRef.current.push(binding);
      if (targetPane > 0) chart.panes()[targetPane]?.setHeight?.(Math.max(86, 110 - indicatorIndex * 4));
    });
    indicatorPanesRef.current = Math.max(0, paneIndex - 1);
  }, [clearIndicatorSeries]);

  const updateIndicatorData = useCallback(bars => {
    if (!bars?.length) return;
    indicatorBindingsRef.current.forEach(binding => {
      const indicator = indicatorsRef.current.find(item => item.instanceId === binding.instanceId) || binding.indicator;
      const result = calculateIndicatorData(indicator, bars);
      if (!result) return;
      binding.lines.forEach(lineBinding => { const line = result.lines?.find(item => item.key === lineBinding.key); if (line) lineBinding.series.setData(line.data); });
      if (binding.histogram && result.histogram) binding.histogram.setData(result.histogram.map(point => ({ ...point, color: point.value >= 0 ? 'rgba(45,211,155,0.45)' : 'rgba(255,95,105,0.45)' })));
    });
  }, []);
  const scheduleIndicatorUpdate = useCallback(() => {
    if (indicatorFrameRef.current) return;
    indicatorFrameRef.current = window.requestAnimationFrame(() => { indicatorFrameRef.current = null; updateIndicatorData(barsRef.current); });
  }, [updateIndicatorData]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: chartTokens.background }, textColor: chartTokens.text, attributionLogo: true, fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', fontSize: 10, panes: { separatorColor: '#1b2b39', separatorHoverColor: 'rgba(83,199,255,0.18)', enableResize: true } },
      grid: { vertLines: { visible: true, color: chartTokens.gridline, style: LineStyle.Dotted }, horzLines: { visible: true, color: chartTokens.gridline, style: LineStyle.Dotted } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { visible: true, color: chartTokens.crosshair, width: 1, style: LineStyle.Dashed, labelVisible: true, labelBackgroundColor: chartTokens.crosshairLabel }, horzLine: { visible: true, color: chartTokens.crosshair, width: 1, style: LineStyle.Dashed, labelVisible: true, labelBackgroundColor: chartTokens.crosshairLabel } },
      rightPriceScale: { visible: true, borderVisible: true, borderColor: '#213242', ticksVisible: true, scaleMargins: { top: 0.09, bottom: 0.24 } },
      timeScale: { visible: true, borderVisible: true, borderColor: '#213242', ticksVisible: true, timeVisible: true, secondsVisible: ['S1', 'S5', 'S15', 'S30'].includes(timeframe), rightOffset: 10, barSpacing: 7, minBarSpacing: 3, fixLeftEdge: false, lockVisibleTimeRangeOnResize: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }, handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    chartRef.current = chart;
    const priceFormat = priceFormatForSymbol(symbol);
    const series = chartMode === 'line' ? chart.addSeries(LineSeries, { color: chartTokens.blue, lineWidth: 2, priceFormat, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: true }) : chart.addSeries(CandlestickSeries, { upColor: chartTokens.buy, downColor: chartTokens.sell, wickUpColor: chartTokens.buy, wickDownColor: chartTokens.sell, borderVisible: false, priceFormat, priceLineVisible: false, lastValueVisible: false });
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    seriesRef.current = series; volumeRef.current = volume; marketLineRef.current = null; positionLinesRef.current = []; setError('');
    const timeScale = chart.timeScale();
    const coordinateApi = { toData(point) { if (!point) return null; const time = timeScale.coordinateToTime(Number(point.x)); const price = series.coordinateToPrice(Number(point.y)); return time == null || price == null || !Number.isFinite(Number(price)) ? null : { time, price: Number(price) }; }, toScreen(point) { if (!point || point.time == null || point.price == null) return null; const x = timeScale.timeToCoordinate(point.time); const y = series.priceToCoordinate(Number(point.price)); return x == null || y == null ? null : { x: Number(x), y: Number(y) }; }, priceToY(price) { const y = series.priceToCoordinate(Number(price)); return y == null ? null : Number(y); }, yToPrice(y) { const price = series.coordinateToPrice(Number(y)); return price == null || !Number.isFinite(Number(price)) ? null : Number(price); }, subscribe(handler) { const rangeHandler = () => handler?.(); const sizeHandler = () => handler?.(); timeScale.subscribeVisibleLogicalRangeChange(rangeHandler); timeScale.subscribeSizeChange(sizeHandler); return () => { timeScale.unsubscribeVisibleLogicalRangeChange(rangeHandler); timeScale.unsubscribeSizeChange(sizeHandler); }; } };
    coordinateCallbackRef.current?.(coordinateApi);
    const controller = new AbortController();
    let disposed = false;
    const crosshairHandler = param => { if (!param?.time) { setDisplayBar(lastBarRef.current); return; } const bar = barsByTimeRef.current.get(Number(param.time)); if (bar) setDisplayBar(bar); };
    chart.subscribeCrosshairMove(crosshairHandler);
    void (async () => {
      try {
        const bars = await fetchCandles(symbol, timeframe, 160, controller.signal);
        if (disposed) return;
        if (!bars.length) throw new Error('No market candles returned');
        barsRef.current = bars; barsByTimeRef.current = new Map(bars.map(bar => [Number(bar.time), bar])); series.setData(bars.map(bar => toSeriesPoint(bar, chartMode))); volume.setData(bars.map(bar => ({ time: bar.time, value: volumeForBar(bar), color: bar.close >= bar.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)' }))); lastBarRef.current = bars[bars.length - 1]; setDisplayBar(bars[bars.length - 1]); renderIndicators(chart, bars); chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 48), to: bars.length + 9 });
      } catch (e) { if (e?.name === 'AbortError' || disposed) return; console.error('Trading chart data failed', e); setError(e?.message || 'Unable to load market data'); }
    })();
    return () => { disposed = true; controller.abort(); coordinateCallbackRef.current?.(null); if (indicatorFrameRef.current) window.cancelAnimationFrame(indicatorFrameRef.current); indicatorFrameRef.current = null; chart.unsubscribeCrosshairMove(crosshairHandler); indicatorSeriesRef.current = []; indicatorBindingsRef.current = []; indicatorPanesRef.current = 0; chartRef.current = null; seriesRef.current = null; volumeRef.current = null; marketLineRef.current = null; positionLinesRef.current = []; lastBarRef.current = null; barsRef.current = []; barsByTimeRef.current = new Map(); chart.remove(); };
  }, [symbol, timeframe, chartMode, renderIndicators]);

  useEffect(() => { indicatorsRef.current = indicators; if (chartRef.current && barsRef.current.length) renderIndicators(chartRef.current, barsRef.current); }, [indicators, renderIndicators]);
  useEffect(() => { volumeRef.current?.applyOptions({ visible: showVolume }); }, [showVolume, symbol, timeframe, chartMode]);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const livePrice = Number(tick?.bid ?? tick?.price ?? bidPrice);
    if (Number.isFinite(livePrice)) {
      if (!marketLineRef.current) {
        marketLineRef.current = series.createPriceLine({
          price: livePrice,
          color: chartTokens.buy,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: '',
        });
      } else {
        marketLineRef.current.applyOptions({ price: livePrice });
      }
    }
  }, [tick?.bid, tick?.price, bidPrice, symbol, timeframe, chartMode]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    positionLinesRef.current.forEach(line => {
      try { series.removePriceLine(line); } catch { /* disposed */ }
    });
    positionLinesRef.current = [];

    const openPositions = (Array.isArray(positions) ? positions : []).filter(position =>
      String(position?.symbol || '').toUpperCase() === String(symbol || '').toUpperCase()
      && Number.isFinite(Number(position?.entry ?? position?.entryPrice))
    );

    positionLinesRef.current = openPositions.map(position =>
      series.createPriceLine({
        price: Number(position.entry ?? position.entryPrice),
        color: chartTokens.blue,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: '',
      })
    );

    return () => {
      positionLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch { /* disposed */ }
      });
      positionLinesRef.current = [];
    };
  }, [positions, symbol, timeframe, chartMode]);

  useEffect(() => {
    if (!liveCandle || !seriesRef.current) return;
    const next = liveCandle;
    const lastIndex = barsRef.current.length - 1;
    if (lastIndex >= 0 && barsRef.current[lastIndex]?.time === next.time) barsRef.current[lastIndex] = next;
    else if (!barsRef.current.length || next.time > barsRef.current[lastIndex].time) { barsRef.current.push(next); if (barsRef.current.length > 240) barsRef.current.shift(); }
    else return;
    barsByTimeRef.current.set(Number(next.time), next);
    lastBarRef.current = next;
    seriesRef.current.update(toSeriesPoint(next, chartMode));
    volumeRef.current?.update({ time: next.time, value: volumeForBar(next), color: next.close >= next.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)' });
    setDisplayBar(next); scheduleIndicatorUpdate(); chartRef.current?.timeScale().scrollToRealTime(); mergeLiveBarIntoCache(symbol, timeframe, next, 160);
  }, [chartMode, liveCandle, scheduleIndicatorUpdate, symbol, timeframe]);

  const ohlc = displayBar;
  const format = value => Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : '—';

  return <div className="relative size-full min-h-0 min-w-0 overflow-hidden bg-[#080f17]">
    <div ref={hostRef} className="absolute inset-0" />
    <div className="pointer-events-none absolute left-2 top-2 z-20 max-w-[68%] px-1 text-[8px] leading-[1.45] text-[#8295a9] [text-shadow:0_1px_2px_#080f17,0_0_5px_#080f17]">
      <div className="font-bold tracking-[0.03em] text-[#dce8f2]">{symbol},{timeframe}</div>
      <div className="mt-0.5 flex flex-wrap gap-x-1.5 whitespace-nowrap font-medium"><span>O <b className="text-[#aab9c8]">{format(ohlc?.open)}</b></span><span>H <b className="text-[#aab9c8]">{format(ohlc?.high)}</b></span><span>L <b className="text-[#aab9c8]">{format(ohlc?.low)}</b></span><span>C <b className="text-[#aab9c8]">{format(ohlc?.close)}</b></span></div>
      {visibleIndicators.length > 0 && <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[7px] font-semibold text-[#8298ac]">{visibleIndicators.map(indicator => <span key={indicator.instanceId}>{indicatorLabel(indicator)}</span>)}</div>}
    </div>
    {error && <div className="absolute inset-0 z-40 grid place-items-center bg-[#080f17]/95 px-5 text-center text-[10px] font-medium text-[#718399]">{error}</div>}
  </div>;
}
