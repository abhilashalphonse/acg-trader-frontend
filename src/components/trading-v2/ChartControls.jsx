import React from 'react';
import { CandlestickChart, ChartNoAxesCombined, Maximize2, Minimize2 } from 'lucide-react';

const timeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];

export function mapTimeframe(tf) {
  const map = {
    '1m': 'M1',
    '5m': 'M5',
    '15m': 'M15',
    '30m': 'M30',
    '1H': 'H1',
    '4H': 'H4',
    '1D': 'D1',
    '1W': 'W1',
  };
  return map[tf] || 'M1';
}

export default function ChartControls({
  timeframe,
  onTimeframe,
  chartMode,
  onChartMode,
  fullscreen,
  onFullscreen,
  onIndicators = () => {},
  focusMode = false,
  disabled = false,
}) {
  const rootClass = focusMode
    ? 'flex items-center gap-1.5 px-2 pb-2'
    : 'flex items-center gap-2 px-2.5 pb-2';

  const timeframeClass = focusMode
    ? 'flex h-9 min-w-0 flex-1 items-center overflow-x-auto rounded-xl border border-white/[0.08] bg-[#080808] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : 'flex h-10 min-w-0 flex-1 items-center overflow-x-auto rounded-xl border border-white/[0.08] bg-[#080808] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  const actionsClass = focusMode
    ? 'flex h-9 shrink-0 items-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#080808]'
    : 'flex h-10 shrink-0 items-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#080808]';

  const fullScreenClass = focusMode
    ? 'grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-[#080808] text-[#8da0b4]'
    : 'grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-[#080808] text-[#8da0b4]';

  return (
    <div className={`${rootClass} ${disabled ? 'opacity-55' : ''}`}>
      <div className={timeframeClass}>
        {timeframes.map(tf => (
          <button
            key={tf}
            type="button"
            disabled={disabled}
            onClick={() => onTimeframe(tf)}
            className={`${focusMode ? 'h-7 min-w-[25px] px-1 text-[9px]' : 'h-8 min-w-[27px] px-1 text-[10px]'} shrink-0 rounded-lg font-bold transition ${
              timeframe === tf ? 'bg-[#101010] text-[#f4f8fc] shadow-[inset_0_1px_rgba(255,255,255,0.04)]' : 'text-[#788aa0] hover:text-[#dce7f3]'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className={actionsClass}>
        <button type="button" disabled={disabled} aria-label="Candlestick chart" onClick={() => onChartMode('candles')} className={`grid h-full ${focusMode ? 'w-8' : 'w-9'} place-items-center border-r border-white/[0.08] ${chartMode === 'candles' ? 'bg-[#101010] text-[#5bc8ff]' : 'text-[#75879b]'}`}>
          <CandlestickChart size={focusMode ? 16 : 18} />
        </button>
        <button type="button" disabled={disabled} aria-label="Line chart" onClick={() => onChartMode('line')} className={`grid h-full ${focusMode ? 'w-8' : 'w-9'} place-items-center border-r border-white/[0.08] ${chartMode === 'line' ? 'bg-[#101010] text-[#5bc8ff]' : 'text-[#75879b]'}`}>
          <ChartNoAxesCombined size={focusMode ? 16 : 18} />
        </button>
        <button type="button" disabled={disabled} onClick={onIndicators} aria-label="Indicators" className={`grid h-full ${focusMode ? 'w-8 text-[15px]' : 'w-9 text-[17px]'} place-items-center font-medium italic text-[#8799ad] active:bg-[#101010] active:text-[#5bc8ff]`}>
          ƒx
        </button>
      </div>

      <button type="button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={onFullscreen} className={fullScreenClass}>
        {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      </button>
    </div>
  );
}
