import React, { useEffect, useRef, useState } from 'react';
import { CandlestickSeries, ColorType, CrosshairMode, createChart } from 'lightweight-charts';
import { fetchCandles, subscribePrice, timeframeSeconds } from '../services/twelveData.js';

export const chartTokens = {
  background: '#080d12',
  text: '#8190a3',
  gridline: '#16212a',
  buy: '#28d69a',
  sell: '#ff5b5f',
  crosshair: '#617184',
  crosshairLabel: '#17232d',
};

function tickToBar(previous, tick, timeframe) {
  const step = timeframeSeconds(timeframe);
  const bucket = Math.floor(tick.time / step) * step;
  if (!previous || previous.time !== bucket) {
    return { time: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
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
  const lastBarRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: chartTokens.background },
        textColor: chartTokens.text,
        attributionLogo: true,
        fontSize: 11,
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
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
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
      upColor: chartTokens.buy,
      downColor: chartTokens.sell,
      wickUpColor: chartTokens.buy,
      wickDownColor: chartTokens.sell,
      borderVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
    });

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
          streamError => console.warn(streamError),
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
      chart.remove();
    };
  }, [symbol, timeframe]);

  return (
    <div ref={hostRef} className="relative size-full min-h-0 min-w-0 overflow-hidden bg-acg-bg">
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-acg-bg/90 px-5 text-center text-xs text-acg-muted">
          {error}
        </div>
      )}
    </div>
  );
}
