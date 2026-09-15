import React, { useEffect, useRef, useState } from 'react';
import { CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, createChart } from 'lightweight-charts';
import { fetchCandles, mergeLiveBarIntoCache, timeframeSeconds } from '../services/twelveData.js';

export const chartTokens = {
  background: '#070d13',
  text: '#64758a',
  gridline: '#14202b',
  buy: '#2dd39b',
  sell: '#ff5b64',
  crosshair: '#607184',
  crosshairLabel: '#17232d',
};

function tickToBar(previous, tick, timeframe) {
  const step = timeframeSeconds(timeframe);
  const bucket = Math.floor(tick.time / step) * step;
  if (!previous || bucket > previous.time) return { time: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
  if (bucket < previous.time) return previous;
  return { ...previous, high: Math.max(previous.high, tick.price), low: Math.min(previous.low, tick.price), close: tick.price };
}

function volumeForBar(bar) {
  if (Number.isFinite(bar.volume) && bar.volume > 0) return bar.volume;
  const range = Math.max(0.000001, Math.abs(bar.high - bar.low));
  return Math.max(1, Math.round(range * 10000000));
}

export default function TradingChart({ symbol = 'AUDCAD', timeframe = 'M1', tick = null }) {
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
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: ['S1', 'S5', 'S15', 'S30'].includes(timeframe),
        rightOffset: 7,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: chartTokens.buy,
      downColor: chartTokens.sell,
      wickUpColor: chartTokens.buy,
      wickDownColor: chartTokens.sell,
      borderVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
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
        const bars = await fetchCandles(symbol, timeframe, 500, controller.signal);
        if (disposed) return;
        if (!bars.length) throw new Error('No Twelve Data candles returned');

        series.setData(bars);
        volume.setData(bars.map(bar => ({
          time: bar.time,
          value: volumeForBar(bar),
          color: bar.close >= bar.open ? 'rgba(45,211,155,.42)' : 'rgba(255,91,100,.40)',
        })));
        lastBarRef.current = bars[bars.length - 1];
        chart.timeScale().fitContent();
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
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!tick || !seriesRef.current || !lastBarRef.current || !Number.isFinite(tick.price) || !Number.isFinite(tick.time)) return;
    const previous = lastBarRef.current;
    const next = tickToBar(previous, tick, timeframe);
    if (next === previous) return;

    lastBarRef.current = next;
    seriesRef.current.update(next);
    volumeRef.current?.update({
      time: next.time,
      value: Number.isFinite(tick.dayVolume) && tick.dayVolume > 0 ? tick.dayVolume : volumeForBar(next),
      color: next.close >= next.open ? 'rgba(45,211,155,.42)' : 'rgba(255,91,100,.40)',
    });
    mergeLiveBarIntoCache(symbol, timeframe, next, 500);
  }, [tick, symbol, timeframe]);

  return (
    <div ref={hostRef} className="v2-lightweight-chart">
      {error && <div className="v2-chart-error">{error}</div>}
    </div>
  );
}
