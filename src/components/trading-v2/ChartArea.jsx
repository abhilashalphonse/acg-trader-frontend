import React from 'react';
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

export default function ChartArea({ symbol, chartTimeframe, tick, selectedTool, onSelectTool }) {
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
          <span>0.99368</span>
          <small>00:24</small>
        </div>
      </div>
    </div>
  );
}
