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
import {
  fetchCandlePage,
  invalidateCandleCache,
  mergeLiveBarIntoCache,
  mergeLiveCandleIntoSeries,
  normalizeCandle,
  prependHistoricalCandles,
  reconcileLatestCandles,
  isRealtimeLogicalRange,
  toBackendTimeframe,
} from '../services/marketData.js';
import { useTraderAuth } from '../hooks/useTraderAuth.js';
import { useTradingStore } from '../hooks/useTradingStore.js';
import { calculateIndicatorData, indicatorVisibleOnTimeframe, requiredIndicatorHistory } from '../utils/indicators.js';
import { instrumentDigits, instrumentTickSize } from '../utils/instrumentFormatting.js';
import { ArrowRight, Eye, EyeOff, Settings2, X } from 'lucide-react';

const chartTokens = {
  background: '#09090b',
  text: '#8b8b8f',
  gridline: '#1a1a1d',
  buy: '#2dd39b',
  livePriceLine: 'rgba(45,211,155,0.68)',
  livePriceLabel: '#38d6a3',
  livePriceLabelText: '#06130f',
  sell: '#f05d68',
  buyWick: 'rgba(45,211,155,0.78)',
  sellWick: 'rgba(240,93,104,0.78)',
  blue: '#53c7ff',
  crosshair: '#6f7075',
  crosshairLabel: '#1b1b1d',
};
const DEFAULT_BARS_BACK = 44;
const DEFAULT_RIGHT_BARS = 7;
const HISTORY_PREFETCH_BARS = 120;
const DESKTOP_INITIAL_HISTORY = 750;
const MOBILE_INITIAL_HISTORY = 320;
const DESKTOP_HISTORY_PAGE = 750;
const MOBILE_HISTORY_PAGE = 320;
const DESKTOP_MAX_LOADED_BARS = 10_000;
const MOBILE_MAX_LOADED_BARS = 3_000;

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
  priceScaleAnchors = [],
  showIndicatorControls = false,
  onToggleIndicator = () => {},
  onOpenIndicatorSettings = () => {},
  onRemoveIndicator = () => {},
}) {
  const { authenticated } = useTraderAuth();
  const { market, connection, subscribeMarket } = useTradingStore();
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
  const scaleAnchorLinesRef = useRef([]);
  const indicatorSeriesRef = useRef([]);
  const indicatorBindingsRef = useRef([]);
  const indicatorPanesRef = useRef(0);
  const indicatorsRef = useRef(indicators);
  const indicatorFrameRef = useRef(null);
  const coordinateCallbackRef = useRef(onCoordinateApi);
  const autoFollowRef = useRef(true);
  const realtimeStateRef = useRef(true);
  const latestLiveCandleRef = useRef(null);
  const initialLoadCompleteRef = useRef(false);
  const historyPagingRef = useRef({ hasMore: false, nextBefore: null, loading: false });
  const loadOlderHistoryRef = useRef(null);
  const previousConnectionStatusRef = useRef(null);
  const historyRecoveryRevision = Number(market?.historyRecoveryRevision || 0);
  const previousHistoryRecoveryRevisionRef = useRef(historyRecoveryRevision);
  const [error, setError] = useState('');
  const [displayBar, setDisplayBar] = useState(null);
  const [paneLayout, setPaneLayout] = useState([]);
  const [isAtRealtime, setIsAtRealtime] = useState(true);

  const backendTimeframe = useMemo(() => {
    try { return toBackendTimeframe(timeframe); } catch { return null; }
  }, [timeframe]);
  const candleKey = symbol && backendTimeframe ? `${String(symbol).toUpperCase()}:${backendTimeframe}` : null;
  const rawLiveCandle = candleKey ? market.candlesByKey[candleKey] : null;
  const liveCandle = useMemo(() => rawLiveCandle ? normalizeCandle(rawLiveCandle) : null, [rawLiveCandle]);
  useEffect(() => { latestLiveCandleRef.current = liveCandle; }, [liveCandle]);
  const decimals = instrumentDigits(instrument);
  const minMove = instrumentTickSize(instrument);
  const indicatorInstrument = useMemo(() => ({
    session: instrument?.session || null,
    tradingSession: instrument?.tradingSession || null,
    regularSession: instrument?.regularSession || null,
    sessionTimezone: instrument?.sessionTimezone || null,
    exchangeTimezone: instrument?.exchangeTimezone || null,
    timeZone: instrument?.timeZone || null,
    timezone: instrument?.timezone || null,
    sessionStart: instrument?.sessionStart || null,
    marketOpen: instrument?.marketOpen || null,
  }), [
    instrument?.session,
    instrument?.tradingSession,
    instrument?.regularSession,
    instrument?.sessionTimezone,
    instrument?.exchangeTimezone,
    instrument?.timeZone,
    instrument?.timezone,
    instrument?.sessionStart,
    instrument?.marketOpen,
  ]);
  const visibleIndicators = useMemo(() => indicators.filter(item => indicatorVisibleOnTimeframe(item, timeframe)), [indicators, timeframe]);
  const showVolume = useMemo(() => indicators.some(item => item.id === 'volume' && indicatorVisibleOnTimeframe(item, timeframe)), [indicators, timeframe]);
  const historyProfile = useMemo(() => {
    const desktop = typeof window === 'undefined' || window.matchMedia?.('(min-width: 1024px)')?.matches;
    return desktop
      ? { initial: DESKTOP_INITIAL_HISTORY, page: DESKTOP_HISTORY_PAGE, max: DESKTOP_MAX_LOADED_BARS }
      : { initial: MOBILE_INITIAL_HISTORY, page: MOBILE_HISTORY_PAGE, max: MOBILE_MAX_LOADED_BARS };
  }, []);
  const historyLimit = useMemo(
    () => requiredIndicatorHistory(indicators, timeframe, { baseline: historyProfile.initial, max: 1000 }),
    [historyProfile.initial, indicators, timeframe],
  );

  const setRealtimeTracking = useCallback(next => {
    const resolved = Boolean(next);
    autoFollowRef.current = resolved;
    if (realtimeStateRef.current === resolved) return;
    realtimeStateRef.current = resolved;
    setIsAtRealtime(resolved);
  }, []);

  const returnToLive = useCallback(() => {
    const timeScale = chartRef.current?.timeScale?.();
    if (!timeScale || !barsRef.current.length) return;
    setRealtimeTracking(true);
    try {
      timeScale.applyOptions?.({ rightOffset: DEFAULT_RIGHT_BARS });
      timeScale.scrollToRealTime();
    } catch {
      const lastIndex = barsRef.current.length - 1;
      timeScale.setVisibleLogicalRange?.({
        from: Math.max(0, lastIndex - DEFAULT_BARS_BACK),
        to: lastIndex + DEFAULT_RIGHT_BARS,
      });
    }
    if (lastBarRef.current) setDisplayBar(lastBarRef.current);
  }, [setRealtimeTracking]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'End' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      const tag = String(target?.tagName || '').toLowerCase();
      if (target?.isContentEditable || ['input', 'textarea', 'select'].includes(tag)) return;
      event.preventDefault();
      returnToLive();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [returnToLive]);

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
      const result = calculateIndicatorData(indicator, bars, { instrument: indicatorInstrument });
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
  }, [clearIndicatorSeries, indicatorInstrument, timeframe]);

  const updateIndicatorData = useCallback(bars => {
    if (!bars?.length) return;
    indicatorBindingsRef.current.forEach(binding => {
      const indicator = indicatorsRef.current.find(item => item.instanceId === binding.instanceId) || binding.indicator;
      const result = calculateIndicatorData(indicator, bars, { instrument: indicatorInstrument });
      if (!result) return;
      binding.lines.forEach(lineBinding => { const line = result.lines?.find(item => item.key === lineBinding.key); if (line) lineBinding.series.setData(line.data); });
      if (binding.histogram && result.histogram) binding.histogram.setData(result.histogram.map(point => ({ ...point, color: point.value >= 0 ? 'rgba(45,211,155,0.45)' : 'rgba(255,95,105,0.45)' })));
    });
  }, [indicatorInstrument]);
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
    seriesRef.current = series; volumeRef.current = volume; marketLineRef.current = null; askLineRef.current = null; positionLinesRef.current = []; scaleAnchorLinesRef.current = []; setError('');
    const timeScale = chart.timeScale();
    const visibleRangeHandler = () => {
      const range = timeScale.getVisibleLogicalRange();
      const lastIndex = barsRef.current.length - 1;
      if (!range || lastIndex < 0) return;
      setRealtimeTracking(isRealtimeLogicalRange(range, lastIndex));
      if (range.from <= HISTORY_PREFETCH_BARS) {
        void loadOlderHistoryRef.current?.();
      }
    };
    timeScale.subscribeVisibleLogicalRangeChange(visibleRangeHandler);
    const coordinateApi = { toData(point) { if (!point) return null; const time = timeScale.coordinateToTime(Number(point.x)); const price = series.coordinateToPrice(Number(point.y)); return time == null || price == null || !Number.isFinite(Number(price)) ? null : { time, price: Number(price) }; }, toScreen(point) { if (!point || point.time == null || point.price == null) return null; const x = timeScale.timeToCoordinate(point.time); const y = series.priceToCoordinate(Number(point.price)); return x == null || y == null ? null : { x: Number(x), y: Number(y) }; }, priceToY(price) { const y = series.priceToCoordinate(Number(price)); return y == null || !Number.isFinite(Number(price)) ? null : Number(price); }, yToPrice(y) { const price = series.coordinateToPrice(Number(y)); return price == null || !Number.isFinite(Number(price)) ? null : Number(price); }, fitContent() { timeScale.fitContent(); }, focusTime(time) { const numeric = Number(time); const index = barsRef.current.findIndex(bar => Number(bar.time) === numeric); if (index < 0) return; const halfWindow = 22; timeScale.setVisibleLogicalRange({ from: Math.max(0, index - halfWindow), to: Math.min(barsRef.current.length - 1 + DEFAULT_RIGHT_BARS, index + halfWindow) }); }, resetView() { const lastIndex = barsRef.current.length - 1; if (lastIndex >= 0) timeScale.setVisibleLogicalRange({ from: Math.max(0, lastIndex - DEFAULT_BARS_BACK), to: lastIndex + DEFAULT_RIGHT_BARS }); }, subscribe(handler) { const rangeHandler = () => handler?.(); const sizeHandler = () => handler?.(); timeScale.subscribeVisibleLogicalRangeChange(rangeHandler); timeScale.subscribeSizeChange(sizeHandler); return () => { timeScale.unsubscribeVisibleLogicalRangeChange(rangeHandler); timeScale.unsubscribeSizeChange(sizeHandler); }; } };
    coordinateCallbackRef.current?.(coordinateApi);
    const controller = new AbortController();
    let disposed = false;
    historyPagingRef.current = { hasMore: false, nextBefore: null, loading: false };

    const setSeriesData = bars => {
      barsRef.current = bars;
      barsByTimeRef.current = new Map(bars.map(bar => [Number(bar.time), bar]));
      series.setData(bars.map(bar => toSeriesPoint(bar, chartMode)));
      volume.setData(bars.map(bar => {
        const value = volumeForBar(bar);
        return value == null ? null : {
          time: bar.time,
          value,
          color: bar.close >= bar.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)',
        };
      }).filter(Boolean));
      lastBarRef.current = bars[bars.length - 1] || null;
      if (lastBarRef.current) setDisplayBar(lastBarRef.current);
    };

    const loadOlderHistory = async () => {
      const paging = historyPagingRef.current;
      if (
        disposed
        || paging.loading
        || !paging.hasMore
        || !Number.isFinite(Number(paging.nextBefore))
      ) return;

      const remainingCapacity = Math.max(0, historyProfile.max - barsRef.current.length);
      if (!remainingCapacity) {
        paging.hasMore = false;
        return;
      }

      const requestLimit = Math.min(1000, historyProfile.page, remainingCapacity);
      const cursor = Number(paging.nextBefore);
      paging.loading = true;

      try {
        const page = await fetchCandlePage(
          symbol,
          timeframe,
          requestLimit,
          controller.signal,
          { before: cursor },
        );
        if (disposed || controller.signal.aborted) return;

        const visibleBefore = timeScale.getVisibleLogicalRange();
        const merged = prependHistoricalCandles(
          barsRef.current,
          page.bars,
          historyProfile.max,
        );

        if (merged.added > 0) {
          setSeriesData(merged.bars);
          renderIndicators(chart, merged.bars);
          // Prepending shifts logical indexes. Shift the viewport by the exact
          // number of inserted bars so the candle under the cursor does not
          // move while history loads, matching professional chart behavior.
          if (visibleBefore) {
            timeScale.setVisibleLogicalRange({
              from: visibleBefore.from + merged.added,
              to: visibleBefore.to + merged.added,
            });
          }
        }

        const nextBefore = Number(page.pagination?.nextBefore);
        const cursorProgressed = Number.isFinite(nextBefore) && nextBefore < cursor;
        paging.nextBefore = cursorProgressed
          ? nextBefore
          : (merged.bars[0]?.time ? Number(merged.bars[0].time) * 1000 : null);
        paging.hasMore = Boolean(
          page.pagination?.hasMore
          && cursorProgressed
          && barsRef.current.length < historyProfile.max
        );
      } catch (error) {
        if (error?.name !== 'AbortError' && !disposed) {
          console.warn('Older candle history load failed', error);
        }
      } finally {
        paging.loading = false;
      }
    };
    loadOlderHistoryRef.current = loadOlderHistory;

    const crosshairHandler = param => { if (!param?.time) { setDisplayBar(lastBarRef.current); return; } const bar = barsByTimeRef.current.get(Number(param.time)); if (bar) setDisplayBar(bar); };
    chart.subscribeCrosshairMove(crosshairHandler);
    void (async () => {
      try {
        const page = await fetchCandlePage(symbol, timeframe, historyLimit, controller.signal);
        if (disposed) return;
        const bars = mergeLiveCandleIntoSeries(page.bars, latestLiveCandleRef.current, historyProfile.max);
        if (!bars.length) throw new Error('No market candles returned');
        setSeriesData(bars);
        const providerFirstTime = page.bars[0]?.time ?? null;
        const displayedFirstTime = bars[0]?.time ?? null;
        const liveMergeTrimmedHistory = providerFirstTime != null
          && displayedFirstTime != null
          && displayedFirstTime > providerFirstTime;
        historyPagingRef.current = {
          hasMore: Boolean((page.pagination?.hasMore || liveMergeTrimmedHistory) && bars.length < historyProfile.max),
          nextBefore: displayedFirstTime == null ? null : Number(displayedFirstTime) * 1000,
          loading: false,
        };
        renderIndicators(chart, bars);
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, bars.length - DEFAULT_BARS_BACK - 1),
          to: bars.length - 1 + DEFAULT_RIGHT_BARS,
        });
        setRealtimeTracking(true);
        initialLoadCompleteRef.current = true;
      } catch (e) {
        if (e?.name === 'AbortError' || disposed) return;
        console.error('Trading chart data failed', e);
        setError(e?.message || 'Unable to load market data');
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
      initialLoadCompleteRef.current = false;
      historyPagingRef.current = { hasMore: false, nextBefore: null, loading: false };
      loadOlderHistoryRef.current = null;
      timeScale.unsubscribeVisibleLogicalRangeChange(visibleRangeHandler);
      coordinateCallbackRef.current?.(null);
      if (indicatorFrameRef.current) window.cancelAnimationFrame(indicatorFrameRef.current);
      indicatorFrameRef.current = null;
      chart.unsubscribeCrosshairMove(crosshairHandler);
      indicatorSeriesRef.current = [];
      indicatorBindingsRef.current = [];
      indicatorPanesRef.current = 0;
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      marketLineRef.current = null;
      askLineRef.current = null;
      positionLinesRef.current = [];
      scaleAnchorLinesRef.current = [];
      lastBarRef.current = null;
      barsRef.current = [];
      barsByTimeRef.current = new Map();
      chart.remove();
    };
  }, [symbol, timeframe, chartMode, renderIndicators, decimals, minMove, historyLimit, historyProfile.max, historyProfile.page, setRealtimeTracking]);

  useEffect(() => { indicatorsRef.current = indicators; if (chartRef.current && barsRef.current.length) renderIndicators(chartRef.current, barsRef.current); }, [indicators, renderIndicators]);

  useEffect(() => {
    const status = connection?.status || null;
    const previousStatus = previousConnectionStatusRef.current;
    previousConnectionStatusRef.current = status;
    if (status !== 'ready' || previousStatus === 'ready' || !initialLoadCompleteRef.current || !seriesRef.current) return undefined;

    const controller = new AbortController();
    void (async () => {
      try {
        const page = await fetchCandlePage(symbol, timeframe, historyLimit, controller.signal, { force: true });
        const latest = mergeLiveCandleIntoSeries(page.bars, latestLiveCandleRef.current, historyProfile.max);
        const bars = reconcileLatestCandles(barsRef.current, latest, historyProfile.max);
        if (!bars.length || controller.signal.aborted || !seriesRef.current) return;
        barsRef.current = bars;
        barsByTimeRef.current = new Map(bars.map(bar => [Number(bar.time), bar]));
        seriesRef.current.setData(bars.map(bar => toSeriesPoint(bar, chartMode)));
        volumeRef.current?.setData(bars.map(bar => {
          const value = volumeForBar(bar);
          return value == null ? null : { time: bar.time, value, color: bar.close >= bar.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)' };
        }).filter(Boolean));
        lastBarRef.current = bars[bars.length - 1];
        setDisplayBar(lastBarRef.current);
        renderIndicators(chartRef.current, bars);
        if (autoFollowRef.current) chartRef.current?.timeScale().scrollToRealTime();
      } catch (error) {
        if (error?.name !== 'AbortError') console.warn('Candle history reconciliation failed', error);
      }
    })();

    return () => controller.abort();
  }, [chartMode, connection?.status, historyLimit, historyProfile.max, renderIndicators, symbol, timeframe]);

  useEffect(() => {
    const previousRevision = previousHistoryRecoveryRevisionRef.current;
    previousHistoryRecoveryRevisionRef.current = historyRecoveryRevision;
    if (
      historyRecoveryRevision <= previousRevision
      || !initialLoadCompleteRef.current
      || !seriesRef.current
    ) return undefined;

    const controller = new AbortController();
    void (async () => {
      try {
        // Provider websocket recovery can happen while the browser websocket
        // stays connected. Invalidate every local page for this series, then
        // force authoritative REST history. Preserve already-loaded older bars
        // while replacing the recovered overlap.
        invalidateCandleCache(symbol, timeframe);
        const page = await fetchCandlePage(symbol, timeframe, historyLimit, controller.signal, { force: true });
        const latest = mergeLiveCandleIntoSeries(page.bars, latestLiveCandleRef.current, historyProfile.max);
        const bars = reconcileLatestCandles(barsRef.current, latest, historyProfile.max);
        if (!bars.length || controller.signal.aborted || !seriesRef.current) return;
        barsRef.current = bars;
        barsByTimeRef.current = new Map(bars.map(bar => [Number(bar.time), bar]));
        seriesRef.current.setData(bars.map(bar => toSeriesPoint(bar, chartMode)));
        volumeRef.current?.setData(bars.map(bar => {
          const value = volumeForBar(bar);
          return value == null ? null : {
            time: bar.time,
            value,
            color: bar.close >= bar.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)',
          };
        }).filter(Boolean));
        lastBarRef.current = bars[bars.length - 1];
        setDisplayBar(lastBarRef.current);
        renderIndicators(chartRef.current, bars);
        if (autoFollowRef.current) chartRef.current?.timeScale().scrollToRealTime();
      } catch (error) {
        if (error?.name !== 'AbortError') console.warn('Provider-gap candle reconciliation failed', error);
      }
    })();

    return () => controller.abort();
  }, [chartMode, historyLimit, historyProfile.max, historyRecoveryRevision, renderIndicators, symbol, timeframe]);

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
          color: showBidAskLines ? '#42a5ff' : chartTokens.livePriceLine,
          lineWidth: 1,
          lineStyle: showBidAskLines ? LineStyle.Dashed : LineStyle.Dotted,
          axisLabelVisible: true,
          axisLabelColor: showBidAskLines ? '#42a5ff' : chartTokens.livePriceLabel,
          axisLabelTextColor: showBidAskLines ? '#ffffff' : chartTokens.livePriceLabelText,
          title: showBidAskLines ? 'BID' : '',
        });
      } else {
        marketLineRef.current.applyOptions({
          price: liveBid,
          color: showBidAskLines ? '#42a5ff' : chartTokens.livePriceLine,
          lineStyle: showBidAskLines ? LineStyle.Dashed : LineStyle.Dotted,
          axisLabelColor: showBidAskLines ? '#42a5ff' : chartTokens.livePriceLabel,
          axisLabelTextColor: showBidAskLines ? '#ffffff' : chartTokens.livePriceLabelText,
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

    positionLinesRef.current = openPositions.map(position => {
      const isBuy = String(position?.side || '').toUpperCase() === 'BUY';
      const lineColor = isBuy ? '#21d79a' : '#ff5a66';
      const labelColor = isBuy ? '#0aa06f' : '#d94250';

      return series.createPriceLine({
        price: Number(position.entry ?? position.entryPrice),
        color: lineColor,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        axisLabelColor: labelColor,
        axisLabelTextColor: '#ffffff',
        title: '',
      });
    });

    return () => {
      positionLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch { /* disposed */ }
      });
      positionLinesRef.current = [];
    };
  }, [positions, symbol, timeframe, chartMode, showPositionPriceLines]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return undefined;

    scaleAnchorLinesRef.current.forEach(line => {
      try { series.removePriceLine(line); } catch { /* disposed */ }
    });
    scaleAnchorLinesRef.current = [];

    const uniquePrices = [...new Set(
      (Array.isArray(priceScaleAnchors) ? priceScaleAnchors : [])
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value > 0)
    )];

    scaleAnchorLinesRef.current = uniquePrices.map(price =>
      series.createPriceLine({
        price,
        color: 'rgba(0,0,0,0)',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      })
    );

    return () => {
      scaleAnchorLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch { /* disposed */ }
      });
      scaleAnchorLinesRef.current = [];
    };
  }, [priceScaleAnchors, symbol, timeframe, chartMode]);

  useEffect(() => {
    if (!liveCandle || !seriesRef.current) return;
    const shouldAutoFollow = autoFollowRef.current;
    const lastIndex = barsRef.current.length - 1;
    const previousLast = lastIndex >= 0 ? barsRef.current[lastIndex] : null;
    if (previousLast && liveCandle.time < previousLast.time) return;

    const mergedBars = mergeLiveCandleIntoSeries(barsRef.current, liveCandle, historyProfile.max);
    const next = mergedBars[mergedBars.length - 1];
    if (!next) return;

    barsRef.current = mergedBars;
    barsByTimeRef.current.set(Number(next.time), next);
    lastBarRef.current = next;
    seriesRef.current.update(toSeriesPoint(next, chartMode));
    const liveVolume = volumeForBar(next);
    if (liveVolume != null) {
      volumeRef.current?.update({ time: next.time, value: liveVolume, color: next.close >= next.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)' });
    }
    setDisplayBar(next); scheduleIndicatorUpdate(); if (shouldAutoFollow) chartRef.current?.timeScale().scrollToRealTime(); mergeLiveBarIntoCache(symbol, timeframe, next, historyLimit);
  }, [chartMode, historyProfile.max, liveCandle, scheduleIndicatorUpdate, symbol, timeframe]);

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
    {!isAtRealtime && !error && (
      <button
        type="button"
        onClick={returnToLive}
        className="absolute bottom-8 right-14 z-30 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.10] bg-[#151719]/95 px-2.5 text-[10px] font-semibold text-[#DCE4EA] shadow-[0_4px_18px_rgba(0,0,0,.45)] backdrop-blur-sm transition hover:border-[#2dd39b]/45 hover:bg-[#1a1d1f] hover:text-white active:scale-[0.98]"
        title="Go to realtime (End)"
        aria-label="Go to realtime"
      >
        <span>Live</span>
        <ArrowRight size={12} strokeWidth={2.2} />
      </button>
    )}
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
