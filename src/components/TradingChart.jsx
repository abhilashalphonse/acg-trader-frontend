import React, { useEffect, useRef, useState } from 'react';
import { createGoChartingOptions } from '../services/goCharting.js';

export default function TradingChart({ symbol = 'AUDCAD', timeframe = 'M1', compact = false }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    async function mount() {
      if (!ref.current) return;
      try {
        const { createChart } = await import('@gocharting/chart-sdk');
        if (disposed || !ref.current) return;
        chartRef.current = createChart(ref.current, createGoChartingOptions({ symbol, timeframe, compact }));
        setError('');
      } catch (e) {
        console.error('GoCharting mount failed', e);
        setError(e?.message || 'Unable to load GoCharting');
      }
    }
    mount();
    return () => {
      disposed = true;
      const chart = chartRef.current;
      if (chart?.remove) chart.remove(); else if (chart?.destroy) chart.destroy();
      chartRef.current = null;
    };
  }, [symbol, timeframe, compact]);
  return <div className="gocharting-host" ref={ref}>{error && <div className="chart-setup">{error}</div>}</div>;
}
