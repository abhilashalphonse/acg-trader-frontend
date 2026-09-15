import React, { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
} from 'lightweight-charts';
import {
  fetchCandles,
  subscribePrice,
  timeframeSeconds,
} from '../services/twelveData.js';

const COLORS = {
  background: '#080d12',
  text: '#8190a3',
  grid: '#16212a',
  buy: '#28d69a',
  sell: '#ff5b5f',
  crosshair: '#617184',
};

function tickToBar(previous, tick, timeframe) {
  const step = timeframeSeconds(timeframe);
  const bucket = Math.floor(tick.time / step) * step;

  if (!previous || previous.time !== bucket) {
    return {
      time: bucket,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
    };
  }

  return {
    ...previous,
    high: Math.max(previous.high, tick.price),
    low: Math.min(previous.low, tick.price),
    close: tick.price,
  };
}

export default function TradingChart({ symbol = 'AUDCAD', timeframe = 'M1' }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const lastBarRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.background },
        textColor: COLORS.text,
        attributionLogo: true,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: COLORS.crosshair, labelBackgroundColor: '#17232d' },
        horzLine: { color: COLORS.crosshair, labelBackgroundColor: '#17232d' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.buy,
      downColor: COLORS.sell,
      wickUpColor: COLORS.buy,
      wickDownColor: COLORS.sell,
      borderVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setError('');

    const controller = new AbortController();
    let unsubscribe = () => {};
    let disposed = false;

    (async () => {
      try {
        const bars = await fetchCandles(symbol, timeframe, 500, controller.signal);
        if (disposed) return;
        if (!bars.length) throw new Error('No Twelve Data candles returned');

        series.setData(bars);
        lastBarRef.current = bars[bars.length - 1];
        chart.timeScale().fitContent();

        unsubscribe = subscribePrice(
          symbol,
          tick => {
            if (disposed) return;
            const nextBar = tickToBar(lastBarRef.current, tick, timeframe);
            lastBarRef.current = nextBar;
            series.update(nextBar);
          },
          streamError => {
            console.warn(streamError);
          },
        );
      } catch (e) {
        if (e?.name === 'AbortError' || disposed) return;
        console.error('Trading chart data failed', e);
        setError(e?.message || 'Unable to load market data');
      }
    })();

    return () => {
      disposed = true;
      controller.abort();
      unsubscribe();
      lastBarRef.current = null;
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [symbol, timeframe]);

  return (
    <div className="chart-canvas lightweight-chart-host" ref={hostRef}>
      {error && <div className="chart-setup">{error}</div>}
    </div>
  );
}
