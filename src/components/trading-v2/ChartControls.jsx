import React from 'react';
import { CandlestickChart, ChartNoAxesCombined, Maximize2, Minimize2 } from 'lucide-react';

const timeframes = ['1s', '5s', '15s', '30s', '1m', '5m', '15m', '1h', '4h', 'D'];

export function mapTimeframe(tf) {
  const map = {
    '1s': 'S1',
    '5s': 'S5',
    '15s': 'S15',
    '30s': 'S30',
    '1m': 'M1',
    '5m': 'M5',
    '15m': 'M15',
    '1h': 'H1',
    '4h': 'H4',
    D: 'D1',
  };
  return map[tf] || 'M1';
}

export default function ChartControls({ timeframe, onTimeframe, chartMode, onChartMode, fullscreen, onFullscreen }) {
  return (
    <div className="flex items-center gap-2 px-2.5 pb-2">
      <div className="flex h-10 min-w-0 flex-1 items-center overflow-x-auto rounded-xl border border-[#1b2c3d] bg-[#09131d] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {timeframes.map(tf => (
          <button
            key={tf}
            type="button"
            onClick={() => onTimeframe(tf)}
            className={`h-8 min-w-[27px] shrink-0 rounded-lg px-1 text-[10px] font-bold transition ${
              timeframe === tf ? 'bg-[#172737] text-[#f4f8fc] shadow-[inset_0_1px_rgba(255,255,255,0.04)]' : 'text-[#788aa0] hover:text-[#dce7f3]'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="flex h-10 shrink-0 items-center overflow-hidden rounded-xl border border-[#1b2c3d] bg-[#09131d]">
        <button
          type="button"
          aria-label="Candlestick chart"
          onClick={() => onChartMode('candles')}
          className={`grid h-full w-9 place-items-center border-r border-[#162637] ${chartMode === 'candles' ? 'bg-[#10324a] text-[#5bc8ff]' : 'text-[#75879b]'}`}
        >
          <CandlestickChart size={18} />
        </button>
        <button
          type="button"
          aria-label="Line chart"
          onClick={() => onChartMode('line')}
          className={`grid h-full w-9 place-items-center border-r border-[#162637] ${chartMode === 'line' ? 'bg-[#10324a] text-[#5bc8ff]' : 'text-[#75879b]'}`}
        >
          <ChartNoAxesCombined size={18} />
        </button>
        <button type="button" aria-label="Indicators" className="grid h-full w-9 place-items-center text-[17px] font-medium italic text-[#8799ad]">
          ƒx
        </button>
      </div>

      <button
        type="button"
        aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        onClick={onFullscreen}
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#1b2c3d] bg-[#09131d] text-[#8da0b4]"
      >
        {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      </button>
    </div>
  );
}
