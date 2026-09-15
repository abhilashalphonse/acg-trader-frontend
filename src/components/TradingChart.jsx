import React, { useEffect, useRef, useState } from 'react';
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
  gridline: '#142330',
  buy: '#2dd39b',
  sell: '#ff5f69',
  blue: '#53c7ff',
  crosshair: '#607287',
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

export default function TradingChart({ symbol = 'AUDCAD', timeframe = 'M1', tick = null, chartMode = 'candles' }) {
  const hostRef = useRef(null);
  const lastBarRef = useRef(null);
  const seriesRef = useRef(null);
  const volumeRef = useRef(null);
  const [error, setError] = useState('');

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
        vertLines: { color: chartTokens.gridline },
        horzLines: { color: chartTokens.gridline },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: chartTokens.crosshair, labelBackgroundColor: chartTokens.crosshairLabel },
        horzLine: { color: chartTokens.crosshair, labelBackgroundColor: chartTokens.crosshairLabel },
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: '#1b2b39',
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderVisible: true,
        borderColor: '#1b2b39',
        timeVisible: true,
        secondsVisible: ['S1', 'S5', 'S15', 'S30'].includes(timeframe),
        rightOffset: 4,
        barSpacing: 7,
        minBarSpacing: 3,
        fixLeftEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chartMode === 'line'
      ? chart.addSeries(LineSeries, {
          color: chartTokens.blue,
          lineWidth: 2,
          priceLineVisible: true,
          priceLineColor: chartTokens.buy,
          priceLineStyle: LineStyle.Dotted,
          lastValueVisible: false,
          crosshairMarkerVisible: true,
        })
      : chart.addSeries(CandlestickSeries, {
          upColor: chartTokens.buy,
          downColor: chartTokens.sell,
          wickUpColor: chartTokens.buy,
          wickDownColor: chartTokens.sell,
          borderVisible: false,
          priceLineVisible: true,
          priceLineColor: chartTokens.buy,
          priceLineStyle: LineStyle.Dotted,
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
    setError('');

    const controller = new AbortController();
    let disposed = false;

    (async () => {
      try {
        const bars = await fetchCandles(symbol, timeframe, 160, controller.signal);
        if (disposed) return;
        if (!bars.length) throw new Error('No market candles returned');

        series.setData(bars.map(bar => toSeriesPoint(bar, chartMode)));
        volume.setData(bars.map(bar => ({
          time: bar.time,
          value: volumeForBar(bar),
          color: bar.close >= bar.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)',
        })));
        lastBarRef.current = bars[bars.length - 1];

        const visibleBars = 48;
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, bars.length - visibleBars),
          to: bars.length + 4,
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
      seriesRef.current = null;
      volumeRef.current = null;
      lastBarRef.current = null;
      chart.remove();
    };
  }, [symbol, timeframe, chartMode]);

  useEffect(() => {
    if (!tick || !seriesRef.current || !lastBarRef.current || !Number.isFinite(tick.price) || !Number.isFinite(tick.time)) return;

    const previous = lastBarRef.current;
    const next = tickToBar(previous, tick, timeframe);
    if (next === previous) return;

    lastBarRef.current = next;
    seriesRef.current.update(toSeriesPoint(next, chartMode));
    volumeRef.current?.update({
      time: next.time,
      value: Number.isFinite(tick.dayVolume) && tick.dayVolume > 0 ? tick.dayVolume : volumeForBar(next),
      color: next.close >= next.open ? 'rgba(45,211,155,0.34)' : 'rgba(255,95,105,0.32)',
    });
    mergeLiveBarIntoCache(symbol, timeframe, next, 160);
  }, [tick, symbol, timeframe, chartMode]);

  return (
    <div ref={hostRef} className="relative size-full min-h-0 min-w-0 overflow-hidden bg-[#080f17]">
      {error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#080f17]/95 px-5 text-center text-[10px] font-medium text-[#718399]">
          {error}
        </div>
      )}
    </div>
  );
}
