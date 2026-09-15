import React, { useEffect, useRef, useState } from 'react';
import { createChart } from '@gocharting/chart-sdk';
import {
  createGoChartingOptions,
  getGoChartingDatafeed,
} from '../services/goCharting.js';

export default function TradingChart({ symbol = 'AUDCAD', timeframe = 'M1', compact = false }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ref.current) return undefined;

    const datafeed = getGoChartingDatafeed();

    // GoCharting's public demo WebSocket is not a general Forex/CFD feed.
    // Until ACG has a documented UDF endpoint, keep the terminal shell alive
    // instead of repeatedly mounting the SDK with an invalid/missing feed.
    if (!datafeed) {
      setError('Chart datafeed not configured');
      return undefined;
    }

    try {
      chartRef.current = createChart(
        ref.current,
        createGoChartingOptions({ symbol, timeframe, compact, datafeed }),
      );
      setError('');
    } catch (e) {
      console.error('GoCharting mount failed', e);
      setError(e?.message || 'Unable to load GoCharting');
    }

    return () => {
      const chart = chartRef.current;
      if (chart?.destroy) chart.destroy();
      else if (chart?.remove) chart.remove();
      chartRef.current = null;
    };
  }, [symbol, timeframe, compact]);

  return (
    <div className="gocharting-host" ref={ref}>
      {error && <div className="chart-setup">{error}</div>}
    </div>
  );
}
