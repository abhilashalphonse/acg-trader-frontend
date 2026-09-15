import React, { useEffect, useRef, useState } from 'react';
import { createGoChartingDatafeed } from '../services/goChartingDatafeed.js';

const licenseKey = import.meta.env.VITE_GOCHARTING_LICENSE_KEY || '';

export default function TradingChart({ symbol = 'AUDCAD', timeframe = 'M1', compact = false }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    async function mount() {
      if (!ref.current) return;
      if (!licenseKey) { setError('GoCharting license key required'); return; }
      try {
        const { createChart } = await import('@gocharting/chart-sdk');
        if (disposed || !ref.current) return;
        chartRef.current = createChart(ref.current, {
          symbol,
          interval: timeframe === 'M1' ? '1' : timeframe === 'M5' ? '5' : timeframe === 'M15' ? '15' : timeframe === 'H1' ? '60' : timeframe === 'H4' ? '240' : '1D',
          datafeed: createGoChartingDatafeed(),
          licenseKey,
          theme: 'dark',
          autosize: true,
          toolbar: !compact,
        });
        setError('');
      } catch (e) { setError(e?.message || 'Unable to load GoCharting'); }
    }
    mount();
    return () => {
      disposed = true;
      const chart = chartRef.current;
      if (chart?.remove) chart.remove();
      else if (chart?.destroy) chart.destroy();
      chartRef.current = null;
    };
  }, [symbol, timeframe, compact]);

  return <div className="gocharting-host" ref={ref}>{error && <div className="chart-setup">{error}</div>}</div>;
}
