import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Grid2X2,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
} from 'lightweight-charts';
import { fetchCandles, mergeLiveBarIntoCache, timeframeSeconds } from '../services/twelveData.js';

const chartTokens = {
  background: '#080f17',
  text: '#718399',
  gridline: '#1b2b39',
  buy: '#2dd39b',
  sell: '#ff5f69',
  blue: '#53c7ff',
  crosshair: '#71869b',
  crosshairLabel: '#172633',
};

function tickToBar(previous, tick, timeframe) {
  const step = timeframeSeconds(timeframe);
  const bucket = Math.floor(tick.time / step) * step;
  if (!previous || bucket > previous.time) {
    return { time: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
  }
  if (bucket < previous.time) return previous;
  return {
    ...previous,
    high: Math.max(previous.high, tick.price),
    low: Math.min(previous.low, tick.price),
    close: tick.price,
  };
}

function volumeForBar(bar) {
  if (Number.isFinite(bar.volume) && bar.volume > 0) return bar.volume;
  const range = Math.max(0.000001, Math.abs(bar.high - bar.low));
  return Math.max(1, Math.round(range * 10000000));
}

function toSeriesPoint(bar, mode) {
  return mode === 'line' ? { time: bar.time, value: bar.close } : bar;
}

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

function timeframeLabel(timeframe) {
  return timeframe.replace('S', 'S').replace('M', 'M').replace('H', 'H').replace('D1', 'D1');
}

export default function TradingChart({
  symbol = 'AUDCAD',
  timeframe = 'M1',
  tick = null,
  chartMode = 'candles',
  bidPrice = null,
  askPrice = null,
}) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const lastBarRef = useRef(null);
  const barsRef = useRef([]);
  const barsByTimeRef = useRef(new Map());
  const seriesRef = useRef(null);
  const volumeRef = useRef(null);
  const bidLineRef = useRef(null);
  const askLineRef = useRef(null);

  const [error, setError] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [chartShift, setChartShift] = useState(true);
  const [barSpacing, setBarSpacing] = useState(7);
  const [displayBar, setDisplayBar] = useState(null);

  const decimals = useMemo(() => decimalsForSymbol(symbol), [symbol]);

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: chartTokens.background },
        textColor: chartTokens.text,
        attributionLogo: true,
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: true, color: chartTokens.gridline, style: LineStyle.Dotted },
        horzLines: { visible: true, color: chartTokens.gridline, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          visible: true,
          color: chartTokens.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelVisible: true,
          labelBackgroundColor: chartTokens.crosshairLabel,
        },
        horzLine: {
          visible: true,
          color: chartTokens.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelVisible: true,
          labelBackgroundColor: chartTokens.crosshairLabel,
        },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: true,
        borderColor: '#213242',
        ticksVisible: true,
        scaleMargins: { top: 0.09, bottom: 0.24 },
      },
      timeScale: {
        visible: true,
        borderVisible: true,
        borderColor: '#213242',
        ticksVisible: true,
        timeVisible: true,
        secondsVisible: ['S1', 'S5', 'S15', 'S30'].includes(timeframe),
        rightOffset: 10,
        barSpacing: 7,
        minBarSpacing: 3,
        fixLeftEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    const priceFormat = priceFormatForSymbol(symbol);
    const series = chartMode === 'line'
      ? chart.addSeries(LineSeries, {
          color: chartTokens.blue,
          lineWidth: 2,
          priceFormat,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: true,
        })
      : chart.addSeries(CandlestickSeries, {
          upColor: chartTokens.buy,
          downColor: chartTokens.sell,
          wickUpColor: chartTokens.buy,
          wickDownColor: chartTokens.sell,
          borderVisible: false,
          priceFormat,
          priceLineVisible: false,
          lastValueVisible: false,
        });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    seriesRef.current = series;
    volumeRef.current = volume;
    bidLineRef.current = null;
    askLineRef.current = null;
    setError('');

    const controller = new AbortController();
    let disposed = false;

    const crosshairHandler = param => {
      if (!param?.time) {
        setDisplayBar(lastBarRef.current);
        return;
      }
      const bar = barsByTimeRef.current.get(Number(param.time));
      if (bar) setDisplayBar(bar);
    };
    chart.subscribeCrosshairMove(crosshairHandler);

    (async () => {
      try {
        const bars = await fetchCandles(symbol, timeframe, 160, controller.signal);
        if (disposed) return;
        if (!bars.length) throw new Error('No market candles returned');

        barsRef.current = bars;
        barsByTimeRef.current = new Map(bars.map(bar => [Number(bar.time), bar]));
        series.setData(bars.map(bar => toSeriesPoint(bar, chartMode)));
        volume.setData(bars.map(bar => ({
          time: bar.time,
          value: volumeForBar(bar),
          color: bar.close >= bar.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)',
        })));

        lastBarRef.current = bars[bars.length - 1];
        setDisplayBar(bars[bars.length - 1]);

        const visibleBars = 48;
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, bars.length - visibleBars),
          to: bars.length + 9,
        });
      } catch (e) {
        if (e?.name === 'AbortError' || disposed) return;
        console.error('Trading chart data failed', e);
        setError(e?.message || 'Unable to load market data');
      }
    })();

    return () => {
      disposed = true;
      controller.abort();
      chart.unsubscribeCrosshairMove(crosshairHandler);
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      bidLineRef.current = null;
      askLineRef.current = null;
      lastBarRef.current = null;
      barsRef.current = [];
      barsByTimeRef.current = new Map();
      chart.remove();
    };
  }, [symbol, timeframe, chartMode]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      grid: {
        vertLines: { visible: showGrid, color: chartTokens.gridline, style: LineStyle.Dotted },
        horzLines: { visible: showGrid, color: chartTokens.gridline, style: LineStyle.Dotted },
      },
    });
  }, [showGrid]);

  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume, symbol, timeframe, chartMode]);

  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      rightOffset: chartShift ? 10 : 2,
      barSpacing,
    });
  }, [chartShift, barSpacing, symbol, timeframe, chartMode]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const liveBid = Number(tick?.bid ?? bidPrice);
    const liveAsk = Number(tick?.ask ?? askPrice);

    if (Number.isFinite(liveBid)) {
      if (!bidLineRef.current) {
        bidLineRef.current = series.createPriceLine({
          price: liveBid,
          color: 'rgba(45,211,155,0.82)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '',
        });
      } else {
        bidLineRef.current.applyOptions({ price: liveBid });
      }
    }

    if (Number.isFinite(liveAsk)) {
      if (!askLineRef.current) {
        askLineRef.current = series.createPriceLine({
          price: liveAsk,
          color: 'rgba(255,95,105,0.62)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'ASK',
        });
      } else {
        askLineRef.current.applyOptions({ price: liveAsk });
      }
    }
  }, [tick?.bid, tick?.ask, bidPrice, askPrice, symbol, timeframe, chartMode]);

  useEffect(() => {
    if (!tick || !seriesRef.current || !lastBarRef.current || !Number.isFinite(tick.price) || !Number.isFinite(tick.time)) return;

    const previous = lastBarRef.current;
    const next = tickToBar(previous, tick, timeframe);
    if (next === previous) return;

    lastBarRef.current = next;
    barsByTimeRef.current.set(Number(next.time), next);

    const lastIndex = barsRef.current.length - 1;
    if (lastIndex >= 0 && barsRef.current[lastIndex]?.time === next.time) {
      barsRef.current[lastIndex] = next;
    } else if (!barsRef.current.length || next.time > barsRef.current[lastIndex].time) {
      barsRef.current.push(next);
    }

    seriesRef.current.update(toSeriesPoint(next, chartMode));
    volumeRef.current?.update({
      time: next.time,
      value: Number.isFinite(tick.dayVolume) && tick.dayVolume > 0 ? tick.dayVolume : volumeForBar(next),
      color: next.close >= next.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)',
    });
    setDisplayBar(next);

    if (autoScroll) chartRef.current?.timeScale().scrollToRealTime();
    mergeLiveBarIntoCache(symbol, timeframe, next, 160);
  }, [tick, symbol, timeframe, chartMode, autoScroll]);

  const resetView = () => {
    const chart = chartRef.current;
    const bars = barsRef.current;
    if (!chart || !bars.length) return;
    setBarSpacing(7);
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, bars.length - 48),
      to: bars.length + (chartShift ? 9 : 2),
    });
  };

  const ohlc = displayBar;
  const format = value => Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : '—';

  const toolButton = active => `grid size-[25px] place-items-center rounded-md border transition ${
    active
      ? 'border-[#2d5874] bg-[#123149] text-[#56c8ff]'
      : 'border-transparent text-[#71879c] hover:border-[#243847] hover:bg-[#0e1c28] hover:text-[#d4e1ec]'
  }`;

  return (
    <div className="relative size-full min-h-0 min-w-0 overflow-hidden bg-[#080f17]">
      <div ref={hostRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-2 top-2 z-20 max-w-[48%] rounded-md bg-[#07111a]/72 px-2 py-1.5 text-[8px] leading-[1.45] text-[#8295a9] backdrop-blur-[2px]">
        <div className="font-bold tracking-[0.03em] text-[#dce8f2]">
          {symbol},{timeframeLabel(timeframe)}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-1.5 whitespace-nowrap font-medium">
          <span>O <b className="text-[#aab9c8]">{format(ohlc?.open)}</b></span>
          <span>H <b className="text-[#aab9c8]">{format(ohlc?.high)}</b></span>
          <span>L <b className="text-[#aab9c8]">{format(ohlc?.low)}</b></span>
          <span>C <b className="text-[#aab9c8]">{format(ohlc?.close)}</b></span>
        </div>
      </div>

      <div className="absolute right-[54px] top-2 z-30 flex items-center gap-0.5 rounded-lg border border-[#203241] bg-[#08131d]/88 p-1 shadow-[0_5px_20px_rgba(0,0,0,0.22)] backdrop-blur-md">
        <button type="button" title="Grid" aria-label="Toggle chart grid" onClick={() => setShowGrid(v => !v)} className={toolButton(showGrid)}>
          <Grid2X2 size={14} />
        </button>
        <button type="button" title="Volumes" aria-label="Toggle volumes" onClick={() => setShowVolume(v => !v)} className={toolButton(showVolume)}>
          <BarChart3 size={14} />
        </button>
        <button type="button" title="Auto scroll" aria-label="Toggle auto scroll" onClick={() => setAutoScroll(v => !v)} className={toolButton(autoScroll)}>
          {autoScroll ? <Play size={13} /> : <Pause size={13} />}
        </button>
        <button type="button" title="Chart shift" aria-label="Toggle chart shift" onClick={() => setChartShift(v => !v)} className={toolButton(chartShift)}>
          <span className="text-[9px] font-black leading-none">⇥</span>
        </button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setBarSpacing(v => Math.max(3, +(v - 1.25).toFixed(2)))} className={toolButton(false)}>
          <ZoomOut size={14} />
        </button>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setBarSpacing(v => Math.min(18, +(v + 1.25).toFixed(2)))} className={toolButton(false)}>
          <ZoomIn size={14} />
        </button>
        <button type="button" title="Reset chart view" aria-label="Reset chart view" onClick={resetView} className={toolButton(false)}>
          <RotateCcw size={13} />
        </button>
      </div>

      {error && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#080f17]/95 px-5 text-center text-[10px] font-medium text-[#718399]">
          {error}
        </div>
      )}
    </div>
  );
}
