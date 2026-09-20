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
import { calculateIndicatorData, indicatorVisibleOnTimeframe } from '../utils/indicators.js';
import { instrumentDigits, instrumentTickSize } from '../utils/instrumentFormatting.js';
import { Eye, EyeOff, Settings2, X } from 'lucide-react';

const chartTokens = {
  background: '#000000',
  text: '#8b8b8f',
  gridline: '#151515',
  buy: '#2dd39b',
  sell: '#f05d68',
  buyWick: 'rgba(45,211,155,0.78)',
  sellWick: 'rgba(240,93,104,0.78)',
  blue: '#53c7ff',
  crosshair: '#6f7075',
  crosshairLabel: '#1b1b1d',
};
const DEFAULT_BARS_BACK = 44;
const DEFAULT_RIGHT_BARS = 7;

const fallbackIndicatorColors = {
  ema: ['#54c8ff'], sma: ['#f0c35c'], vwap: ['#b38cff'], bollinger: ['#65b6df', '#7f91a4', '#65b6df'], rsi: ['#b68cff'], atr: ['#f0ad5c'], macd: ['#55c8ff', '#ffb55f'], stochastic: ['#58d5ff', '#ff7fbd'],
};

function chartLineStyle(value) {
  if (value === 'dashed') return LineStyle.Dashed;
  if (value === 'dotted') return LineStyle.Dotted;
  return LineStyle.Solid;
}

function volumeForBar(bar) {
  return Number.isFinite(bar?.volume) && bar.volume >= 0 ? bar.volume : null;
}
function toSeriesPoint(bar, mode) { return mode === 'line' ? { time: bar.time, value: bar.close } : bar; }
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

export default function TradingChart({
  symbol = 'EURUSD',
  instrument = null,
  timeframe = 'M1',
  tick = null,
  chartMode = 'candles',
  bidPrice = null,
  askPrice = null,
  positions = [],
  indicators = [],
  onCoordinateApi = () => {},
  showBidAskLines = false,
  showPositionPriceLines = true,
  showIndicatorControls = false,
  onToggleIndicator = () => {},
  onOpenIndicatorSettings = () => {},
  onRemoveIndicator = () => {},
}) {
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
  const askLineRef = useRef(null);
  const positionLinesRef = useRef([]);
  const indicatorSeriesRef = useRef([]);
  const indicatorBindingsRef = useRef([]);
  const indicatorPanesRef = useRef(0);
  const indicatorsRef = useRef(indicators);
  const indicatorFrameRef = useRef(null);
  const coordinateCallbackRef = useRef(onCoordinateApi);
  const autoFollowRef = useRef(true);
  const [error, setError] = useState('');
  const [displayBar, setDisplayBar] = useState(null);
  const [paneLayout, setPaneLayout] = useState([]);

  const backendTimeframe = useMemo(() => {
    try { return toBackendTimeframe(timeframe); } catch { return null; }
  }, [timeframe]);
  const candleKey = symbol && backendTimeframe ? `${String(symbol).toUpperCase()}:${backendTimeframe}` : null;
  const rawLiveCandle = candleKey ? market.candlesByKey[candleKey] : null;
  const liveCandle = useMemo(() => rawLiveCandle ? normalizeCandle(rawLiveCandle) : null, [rawLiveCandle]);
  const decimals = instrumentDigits(instrument);
  const minMove = instrumentTickSize(instrument);
  const visibleIndicators = useMemo(() => indicators.filter(item => indicatorVisibleOnTimeframe(item, timeframe)), [indicators, timeframe]);
  const showVolume = useMemo(() => indicators.some(item => item.id === 'volume' && indicatorVisibleOnTimeframe(item, timeframe)), [indicators, timeframe]);

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
    indicatorsRef.current.filter(item => item.id !== 'volume' && indicatorVisibleOnTimeframe(item, timeframe)).forEach((indicator, indicatorIndex) => {
      const result = calculateIndicatorData(indicator, bars);
      if (!result) return;
      const colors = fallbackIndicatorColors[indicator.id] || ['#53c7ff', '#f0ad5c', '#b38cff'];
      const targetPane = result.kind === 'overlay' ? 0 : paneIndex++;
      const binding = { instanceId: indicator.instanceId, indicator, lines: [], histogram: null };
      result.lines?.forEach((line, lineIndex) => {
        const visual = line.style || {};
        const series = chart.addSeries(LineSeries, {
          color: visual.color || colors[lineIndex % colors.length],
          lineWidth: Math.max(1, Math.min(4, Number(visual.width) || (line.key === 'bb-mid' ? 1 : 2))),
          lineStyle: chartLineStyle(visual.lineStyle || (line.key === 'bb-mid' ? 'dotted' : 'solid')),
          priceLineVisible: false,
          lastValueVisible: result.kind !== 'overlay',
          crosshairMarkerVisible: true,
          title: line.label,
        }, targetPane);
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
    window.requestAnimationFrame(() => {
      try {
        let top = 0;
        const layout = chart.panes().map((pane, index) => {
          const height = Number(pane.getHeight?.()) || 0;
          const item = { index, top, height };
          top += height;
          return item;
        });
        setPaneLayout(layout);
      } catch {
        setPaneLayout([]);
      }
    });
  }, [clearIndicatorSeries, timeframe]);

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
      layout: { background: { type: ColorType.Solid, color: chartTokens.background }, textColor: chartTokens.text, attributionLogo: true, fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', fontSize: 11, panes: { separatorColor: '#1b1b1b', separatorHoverColor: 'rgba(83,199,255,0.18)', enableResize: true } },
      grid: { vertLines: { visible: true, color: chartTokens.gridline, style: LineStyle.Dotted }, horzLines: { visible: true, color: chartTokens.gridline, style: LineStyle.Dotted } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { visible: true, color: chartTokens.crosshair, width: 1, style: LineStyle.Dashed, labelVisible: true, labelBackgroundColor: chartTokens.crosshairLabel }, horzLine: { visible: true, color: chartTokens.crosshair, width: 1, style: LineStyle.Dashed, labelVisible: true, labelBackgroundColor: chartTokens.crosshairLabel } },
      rightPriceScale: { visible: true, borderVisible: true, borderColor: '#242424', ticksVisible: true, scaleMargins: { top: 0.045, bottom: 0.07 } },
      timeScale: { visible: true, borderVisible: true, borderColor: '#242424', ticksVisible: true, timeVisible: true, secondsVisible: ['S1', 'S5', 'S15', 'S30'].includes(timeframe), rightOffset: DEFAULT_RIGHT_BARS, barSpacing: 9, minBarSpacing: 3, fixLeftEdge: false, lockVisibleTimeRangeOnResize: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }, handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    chartRef.current = chart;
    const priceFormat = { type: 'price', precision: decimals, minMove };
    const series = chartMode === 'line' ? chart.addSeries(LineSeries, { color: chartTokens.blue, lineWidth: 2, priceFormat, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: true }) : chart.addSeries(CandlestickSeries, { upColor: chartTokens.buy, downColor: chartTokens.sell, wickUpColor: chartTokens.buyWick, wickDownColor: chartTokens.sellWick, borderVisible: false, priceFormat, priceLineVisible: false, lastValueVisible: false });
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } });
    seriesRef.current = series; volumeRef.current = volume; marketLineRef.current = null; askLineRef.current = null; positionLinesRef.current = []; setError('');
    const timeScale = chart.timeScale();
    const visibleRangeHandler = () => {
      const range = timeScale.getVisibleLogicalRange();
      const lastIndex = barsRef.current.length - 1;
      if (!range || lastIndex < 0) return;
      autoFollowRef.current = range.to >= lastIndex - 0.5;
    };
    timeScale.subscribeVisibleLogicalRangeChange(visibleRangeHandler);
    const coordinateApi = { toData(point) { if (!point) return null; const time = timeScale.coordinateToTime(Number(point.x)); const price = series.coordinateToPrice(Number(point.y)); return time == null || price == null || !Number.isFinite(Number(price)) ? null : { time, price: Number(price) }; }, toScreen(point) { if (!point || point.time == null || point.price == null) return null; const x = timeScale.timeToCoordinate(point.time); const y = series.priceToCoordinate(Number(point.price)); return x == null || y == null ? null : { x: Number(x), y: Number(y) }; }, priceToY(price) { const y = series.priceToCoordinate(Number(price)); return y == null ? null : Number(y); }, yToPrice(y) { const price = series.coordinateToPrice(Number(y)); return price == null || !Number.isFinite(Number(price)) ? null : Number(price); }, fitContent() { timeScale.fitContent(); autoFollowRef.current = true; }, resetView() { const lastIndex = barsRef.current.length - 1; if (lastIndex >= 0) timeScale.setVisibleLogicalRange({ from: Math.max(0, lastIndex - DEFAULT_BARS_BACK), to: lastIndex + DEFAULT_RIGHT_BARS }); autoFollowRef.current = true; }, subscribe(handler) { const rangeHandler = () => handler?.(); const sizeHandler = () => handler?.(); timeScale.subscribeVisibleLogicalRangeChange(rangeHandler); timeScale.subscribeSizeChange(sizeHandler); return () => { timeScale.unsubscribeVisibleLogicalRangeChange(rangeHandler); timeScale.unsubscribeSizeChange(sizeHandler); }; } };
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
        barsRef.current = bars; barsByTimeRef.current = new Map(bars.map(bar => [Number(bar.time), bar])); series.setData(bars.map(bar => toSeriesPoint(bar, chartMode))); volume.setData(bars.map(bar => {
          const value = volumeForBar(bar);
          return value == null ? null : { time: bar.time, value, color: bar.close >= bar.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)' };
        }).filter(Boolean)); lastBarRef.current = bars[bars.length - 1]; setDisplayBar(bars[bars.length - 1]); renderIndicators(chart, bars); chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - DEFAULT_BARS_BACK - 1), to: bars.length - 1 + DEFAULT_RIGHT_BARS });
      } catch (e) { if (e?.name === 'AbortError' || disposed) return; console.error('Trading chart data failed', e); setError(e?.message || 'Unable to load market data'); }
    })();
    return () => { disposed = true; controller.abort(); timeScale.unsubscribeVisibleLogicalRangeChange(visibleRangeHandler); coordinateCallbackRef.current?.(null); if (indicatorFrameRef.current) window.cancelAnimationFrame(indicatorFrameRef.current); indicatorFrameRef.current = null; chart.unsubscribeCrosshairMove(crosshairHandler); indicatorSeriesRef.current = []; indicatorBindingsRef.current = []; indicatorPanesRef.current = 0; chartRef.current = null; seriesRef.current = null; volumeRef.current = null; marketLineRef.current = null; askLineRef.current = null; positionLinesRef.current = []; lastBarRef.current = null; barsRef.current = []; barsByTimeRef.current = new Map(); chart.remove(); };
  }, [symbol, timeframe, chartMode, renderIndicators, decimals, minMove]);

  useEffect(() => { indicatorsRef.current = indicators; if (chartRef.current && barsRef.current.length) renderIndicators(chartRef.current, barsRef.current); }, [indicators, renderIndicators]);
  useEffect(() => {
    if (!showIndicatorControls) return undefined;
    const syncPaneLayout = () => {
      try {
        const chart = chartRef.current;
        if (!chart) return;
        let top = 0;
        const layout = chart.panes().map((pane, index) => {
          const height = Number(pane.getHeight?.()) || 0;
          const item = { index, top, height };
          top += height;
          return item;
        });
        setPaneLayout(layout);
      } catch {
        // Pane controls are optional UI.
      }
    };
    window.addEventListener('pointerup', syncPaneLayout);
    window.addEventListener('resize', syncPaneLayout);
    return () => {
      window.removeEventListener('pointerup', syncPaneLayout);
      window.removeEventListener('resize', syncPaneLayout);
    };
  }, [showIndicatorControls]);
  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: showVolume });
    chartRef.current?.priceScale('right').applyOptions({ scaleMargins: { top: 0.045, bottom: showVolume ? 0.205 : 0.07 } });
  }, [showVolume, symbol, timeframe, chartMode]);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const liveBid = Number(tick?.bid ?? tick?.price ?? bidPrice);
    const liveAsk = Number(tick?.ask ?? askPrice);

    if (Number.isFinite(liveBid)) {
      if (!marketLineRef.current) {
        marketLineRef.current = series.createPriceLine({
          price: liveBid,
          color: showBidAskLines ? '#42a5ff' : chartTokens.buy,
          lineWidth: 1,
          lineStyle: showBidAskLines ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true,
          title: showBidAskLines ? 'BID' : '',
        });
      } else {
        marketLineRef.current.applyOptions({
          price: liveBid,
          color: showBidAskLines ? '#42a5ff' : chartTokens.buy,
          lineStyle: showBidAskLines ? LineStyle.Dashed : LineStyle.Solid,
          title: showBidAskLines ? 'BID' : '',
        });
      }
    }

    if (showBidAskLines && Number.isFinite(liveAsk)) {
      if (!askLineRef.current) {
        askLineRef.current = series.createPriceLine({
          price: liveAsk,
          color: '#ff6673',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'ASK',
        });
      } else {
        askLineRef.current.applyOptions({ price: liveAsk });
      }
    } else if (askLineRef.current) {
      try { series.removePriceLine(askLineRef.current); } catch { /* disposed */ }
      askLineRef.current = null;
    }
  }, [tick?.bid, tick?.ask, tick?.price, bidPrice, askPrice, showBidAskLines, symbol, timeframe, chartMode]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    positionLinesRef.current.forEach(line => {
      try { series.removePriceLine(line); } catch { /* disposed */ }
    });
    positionLinesRef.current = [];

    if (!showPositionPriceLines) return undefined;

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
  }, [positions, symbol, timeframe, chartMode, showPositionPriceLines]);

  useEffect(() => {
    if (!liveCandle || !seriesRef.current) return;
    const shouldAutoFollow = autoFollowRef.current;
    const next = liveCandle;
    const lastIndex = barsRef.current.length - 1;
    if (lastIndex >= 0 && barsRef.current[lastIndex]?.time === next.time) barsRef.current[lastIndex] = next;
    else if (!barsRef.current.length || next.time > barsRef.current[lastIndex].time) { barsRef.current.push(next); if (barsRef.current.length > 240) barsRef.current.shift(); }
    else return;
    barsByTimeRef.current.set(Number(next.time), next);
    lastBarRef.current = next;
    seriesRef.current.update(toSeriesPoint(next, chartMode));
    const liveVolume = volumeForBar(next);
    if (liveVolume != null) {
      volumeRef.current?.update({ time: next.time, value: liveVolume, color: next.close >= next.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)' });
    }
    setDisplayBar(next); scheduleIndicatorUpdate(); if (shouldAutoFollow) chartRef.current?.timeScale().scrollToRealTime(); mergeLiveBarIntoCache(symbol, timeframe, next, 160);
  }, [chartMode, liveCandle, scheduleIndicatorUpdate, symbol, timeframe]);

  const ohlc = displayBar;
  const format = value => Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : '—';
  const candleChange = ohlc && Number.isFinite(Number(ohlc.open)) && Number.isFinite(Number(ohlc.close))
    ? Number(ohlc.close) - Number(ohlc.open)
    : null;
  const candleChangePercent = candleChange != null && Number(ohlc?.open) !== 0
    ? (candleChange / Number(ohlc.open)) * 100
    : null;
  const candleChangeTone = candleChange == null || candleChange === 0
    ? 'text-[#8E99A5]'
    : candleChange > 0
      ? 'text-[#2dd39b]'
      : 'text-[#f05d68]';
  const signed = (value, formatter) => {
    if (!Number.isFinite(Number(value))) return '—';
    const numeric = Number(value);
    return `${numeric > 0 ? '+' : ''}${formatter(numeric)}`;
  };

  const overlayIndicators = visibleIndicators.filter(indicator => ['ema', 'sma', 'vwap', 'bollinger', 'volume'].includes(indicator.id));
  const paneIndicators = visibleIndicators.filter(indicator => !['ema', 'sma', 'vwap', 'bollinger', 'volume'].includes(indicator.id));

  const IndicatorActions = ({ indicator, compact = false }) => (
    <span className="pointer-events-auto ml-1 inline-flex items-center gap-0.5 rounded bg-black/70 opacity-0 transition group-hover:opacity-100">
      <button type="button" onClick={event => { event.stopPropagation(); onToggleIndicator(indicator.instanceId); }} className={`grid ${compact ? 'size-5' : 'size-6'} place-items-center rounded text-[#71879a] hover:bg-white/[0.06] hover:text-[#dfe9f0]`} title={indicator.visible === false ? 'Show indicator' : 'Hide indicator'}>{indicator.visible === false ? <EyeOff size={10}/> : <Eye size={10}/>}</button>
      <button type="button" onClick={event => { event.stopPropagation(); onOpenIndicatorSettings(indicator.instanceId); }} className={`grid ${compact ? 'size-5' : 'size-6'} place-items-center rounded text-[#71879a] hover:bg-white/[0.06] hover:text-[#59c8ff]`} title="Indicator settings"><Settings2 size={10}/></button>
      <button type="button" onClick={event => { event.stopPropagation(); onRemoveIndicator(indicator.instanceId); }} className={`grid ${compact ? 'size-5' : 'size-6'} place-items-center rounded text-[#815f68] hover:bg-[#35151d] hover:text-[#ff7380]`} title="Remove indicator"><X size={10}/></button>
    </span>
  );

  return <div className="relative size-full min-h-0 min-w-0 overflow-hidden bg-black">
    <div ref={hostRef} className="absolute inset-0" />
    <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 max-w-[72%] px-1 text-[11px] leading-[1.45] text-[#8E99A5] [text-shadow:0_1px_2px_#000,0_0_6px_#000]">
      <div className="text-[12px] font-semibold tracking-[-0.01em] text-[#F0F3F6]">{symbol} <span className="text-[#7F8A95]">· {timeframe}</span></div>
      <div className="mt-1 flex flex-wrap gap-x-2 whitespace-nowrap font-medium"><span>O <b className="text-[#aab9c8]">{format(ohlc?.open)}</b></span><span>H <b className="text-[#aab9c8]">{format(ohlc?.high)}</b></span><span>L <b className="text-[#aab9c8]">{format(ohlc?.low)}</b></span><span>C <b className="text-[#aab9c8]">{format(ohlc?.close)}</b></span>{candleChange != null && <span className={`font-semibold ${candleChangeTone}`}>{signed(candleChange, value => value.toFixed(decimals))}{candleChangePercent != null ? ` (${signed(candleChangePercent, value => value.toFixed(2))}%)` : ''}</span>}</div>
      {overlayIndicators.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1 text-[9px] font-medium text-[#7F8A95]">
          {overlayIndicators.map(indicator => (
            <span key={indicator.instanceId} className="group pointer-events-auto inline-flex h-6 items-center rounded px-1 hover:bg-black/72">
              <span>{indicatorLabel(indicator)}</span>
              {showIndicatorControls && <IndicatorActions indicator={indicator} compact />}
            </span>
          ))}
        </div>
      )}
    </div>
    {showIndicatorControls && paneIndicators.map((indicator, index) => {
      const pane = paneLayout[index + 1];
      if (!pane || pane.height <= 0) return null;
      return (
        <div key={indicator.instanceId} className="group pointer-events-auto absolute left-2.5 z-30 flex h-6 items-center rounded-md bg-black/72 px-1.5 text-[9px] font-semibold text-[#8fa1b1] shadow-[0_2px_10px_rgba(0,0,0,.28)] backdrop-blur-sm" style={{ top: Math.max(4, pane.top + 5) }}>
          <span>{indicatorLabel(indicator)}</span>
          <IndicatorActions indicator={indicator} compact />
        </div>
      );
    })}
        {error && <div className="absolute inset-0 z-40 grid place-items-center bg-black/95 px-5 text-center text-[10px] font-medium text-[#718399]">{error}</div>}
  </div>;
}
