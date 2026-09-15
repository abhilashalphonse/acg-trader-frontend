import React from 'react';
import { CandlestickChart, ChartNoAxesCombined, Maximize2 } from 'lucide-react';

const timeframes = ['1s','5s','15s','30s','1m','5m','15m','1h','4h','D'];

export function mapTimeframe(tf) {
  const map = { '1s':'S1','5s':'S5','15s':'S15','30s':'S30','1m':'M1','5m':'M5','15m':'M15','1h':'H1','4h':'H4','D':'D1' };
  return map[tf] || 'M1';
}

export default function ChartControls({ timeframe, onTimeframe }) {
  return (
    <div className="v2-chart-controls">
      <div className="v2-timeframes" role="tablist" aria-label="Timeframe">
        {timeframes.map(tf => (
          <button key={tf} className={timeframe===tf?'active':''} onClick={()=>onTimeframe(tf)}>{tf}</button>
        ))}
      </div>
      <div className="v2-chart-actions">
        <button className="active" aria-label="Candlestick chart"><CandlestickChart size={16}/></button>
        <button aria-label="Chart style"><ChartNoAxesCombined size={16}/></button>
        <button className="v2-fx" aria-label="Indicators">ƒx</button>
        <button aria-label="Fullscreen"><Maximize2 size={16}/></button>
      </div>
    </div>
  );
}
