import React, { useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  TrendingUp,
  SlidersHorizontal,
  Square,
  Type,
  Shapes,
  Smile,
  Ruler,
  Magnet,
} from 'lucide-react';
import TradingChart from '../TradingChart.jsx';

const tools = [
  ['cursor', Crosshair],
  ['trendline', TrendingUp],
  ['lines', SlidersHorizontal],
  ['rectangle', Square],
  ['text', Type],
  ['geometry', Shapes],
  ['icon', Smile],
  ['measure', Ruler],
  ['magnet', Magnet],
];

const timeframeSeconds = { S1:1, S5:5, S15:15, S30:30, M1:60, M5:300, M15:900, H1:3600, H4:14400, D1:86400 };

function formatCountdown(value) {
  if (value >= 3600) {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  }
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

export default function ChartArea({ symbol, chartTimeframe, tick, currentPrice, selectedTool, onSelectTool }) {
  const step = useMemo(() => timeframeSeconds[chartTimeframe] || 60, [chartTimeframe]);
  const [remaining, setRemaining] = useState(step);

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const remainder = step - (now % step);
      setRemaining(remainder === 0 ? step : remainder);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [step]);

  return (
    <div className="v2-chart-area">
      <aside className="v2-drawing-toolbar" aria-label="Drawing tools">
        {tools.map(([id, Icon]) => (
          <button key={id} className={selectedTool===id?'active':''} onClick={()=>onSelectTool(id)} aria-label={id}>
            <Icon size={16}/>
          </button>
        ))}
      </aside>
      <div className="v2-chart-stage">
        <TradingChart symbol={symbol} timeframe={chartTimeframe} tick={tick}/>
        <div className="v2-chart-price-overlay">
          <span>{currentPrice}</span>
          <small>{formatCountdown(remaining)}</small>
        </div>
      </div>
    </div>
  );
}
