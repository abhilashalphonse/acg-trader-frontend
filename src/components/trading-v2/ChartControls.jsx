import React from 'react';
import { CandlestickChart, ChartNoAxesCombined, Maximize2, Minimize2, MoreVertical, Pencil } from 'lucide-react';

const timeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];
const mobileTimeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '1D'];

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
  drawingsOpen = false,
  onToggleDrawings = () => {},
  compactMobile = false,
  focusMode = false,
  disabled = false,
}) {
  if (compactMobile) {
    return (
      <div className={`acg-mobile-reference-chart-controls flex h-[46px] w-full items-center overflow-hidden rounded-[12px] border border-white/[0.09] px-1 ${disabled ? 'opacity-55' : ''}`}>
        <div className="acg-mobile-timeframes flex min-w-0 flex-1 self-stretch items-center">
          {mobileTimeframes.map(tf => (
            <button
              key={tf}
              type="button"
              disabled={disabled}
              onClick={() => onTimeframe(tf)}
              className={`relative grid h-full min-w-0 flex-1 place-items-center text-[11px] font-bold transition ${timeframe === tf ? 'text-[#f2f2f2]' : 'text-[#a8b1c0] active:text-[#e9edf3]'}`}
            >
              {tf}
              {timeframe === tf && <span className="absolute bottom-0 left-[18%] right-[18%] h-[2px] rounded-full bg-[#195be1]" aria-hidden="true"/>}
            </button>
          ))}
        </div>

        <div className="acg-mobile-toolbar-separator mx-1 h-7 w-px shrink-0 bg-white/[0.11]" aria-hidden="true"/>

        <div className="acg-mobile-chart-tools flex h-full shrink-0 items-center">
          <button
            type="button"
            disabled={disabled}
            aria-label="Candlestick chart"
            onClick={() => onChartMode('candles')}
            className={`relative grid h-full w-[34px] place-items-center ${chartMode === 'candles' ? 'text-[#f2f2f2]' : 'text-[#d6dce5]'}`}
          >
            <CandlestickChart size={19} strokeWidth={1.9}/>
            {chartMode === 'candles' && <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-[#195be1]" aria-hidden="true"/>}
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label="Line chart"
            onClick={() => onChartMode('line')}
            className={`relative grid h-full w-[34px] place-items-center ${chartMode === 'line' ? 'text-[#f2f2f2]' : 'text-[#d6dce5]'}`}
          >
            <ChartNoAxesCombined size={19} strokeWidth={1.9}/>
            {chartMode === 'line' && <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-[#195be1]" aria-hidden="true"/>}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onIndicators}
            aria-label="Indicators"
            className="grid h-full w-[34px] place-items-center text-[22px] font-light italic leading-none text-[#e1e6ed] active:text-[#32d9ed]"
          >
            ƒ
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleDrawings}
            aria-label={drawingsOpen ? 'Hide drawing tools' : 'Show drawing tools'}
            aria-pressed={drawingsOpen}
            className={`relative grid h-full w-[34px] place-items-center ${drawingsOpen ? 'text-[#f2f2f2]' : 'text-[#d6dce5]'}`}
          >
            <Pencil size={19} strokeWidth={1.8}/>
            {drawingsOpen && <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-[#195be1]" aria-hidden="true"/>}
          </button>
          <div className="acg-mobile-toolbar-separator mx-1 h-7 w-px shrink-0 bg-white/[0.11]" aria-hidden="true"/>
          <button
            type="button"
            disabled={disabled}
            onClick={onFullscreen}
            aria-label={fullscreen ? 'Exit chart focus' : 'Open chart focus'}
            className="grid h-full w-[31px] place-items-center text-[#d6dce5] active:text-[#32d9ed]"
          >
            <MoreVertical size={20} strokeWidth={2.1}/>
          </button>
        </div>
      </div>
    );
  }

  const rootClass = focusMode
    ? 'flex items-center gap-1.5 px-2 pb-2'
    : 'flex items-center gap-2 px-2.5 pb-2';

  const timeframeClass = focusMode
    ? 'flex h-9 min-w-0 flex-1 items-center overflow-x-auto rounded-md bg-[#111114] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : 'flex h-10 min-w-0 flex-1 items-center overflow-x-auto rounded-md border border-white/[0.08] bg-[#080808] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  const actionsClass = focusMode
    ? 'flex h-9 shrink-0 items-center overflow-hidden rounded-md bg-[#111114]'
    : 'flex h-10 shrink-0 items-center overflow-hidden rounded-md border border-white/[0.08] bg-[#080808]';

  const fullScreenClass = focusMode
    ? 'grid size-9 shrink-0 place-items-center rounded-md bg-[#111114] text-[#8da0b4]'
    : 'grid size-10 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-[#080808] text-[#8da0b4]';

  return (
    <div className={`${rootClass} ${disabled ? 'opacity-55' : ''}`}>
      <div className={timeframeClass}>
        {timeframes.map(tf => (
          <button
            key={tf}
            type="button"
            disabled={disabled}
            onClick={() => onTimeframe(tf)}
            className={`${focusMode ? 'h-7 min-w-[25px] px-1 text-[9px]' : 'h-8 min-w-[27px] px-1 text-[10px]'} shrink-0 rounded font-bold transition ${
              timeframe === tf ? 'bg-[#101010] text-[#f4f8fc] ' : 'text-[#788aa0] hover:text-[#dce7f3]'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className={actionsClass}>
        <button type="button" disabled={disabled} aria-label="Candlestick chart" onClick={() => onChartMode('candles')} className={`grid h-full ${focusMode ? 'w-8' : 'w-9'} place-items-center ${focusMode ? '' : 'border-r border-white/[0.08]'} ${chartMode === 'candles' ? 'bg-[#101010] text-[#5bc8ff]' : 'text-[#75879b]'}`}>
          <CandlestickChart size={focusMode ? 16 : 18} />
        </button>
        <button type="button" disabled={disabled} aria-label="Line chart" onClick={() => onChartMode('line')} className={`grid h-full ${focusMode ? 'w-8' : 'w-9'} place-items-center ${focusMode ? '' : 'border-r border-white/[0.08]'} ${chartMode === 'line' ? 'bg-[#101010] text-[#5bc8ff]' : 'text-[#75879b]'}`}>
          <ChartNoAxesCombined size={focusMode ? 16 : 18} />
        </button>
        <button type="button" disabled={disabled} onClick={onIndicators} aria-label="Indicators" className={`grid h-full ${focusMode ? 'w-8 text-[15px]' : 'w-9 text-[17px]'} place-items-center font-medium italic text-[#8799ad] active:bg-[#101010] active:text-[#5bc8ff]`}>
          ƒx
        </button>
        {focusMode && (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleDrawings}
            aria-label={drawingsOpen ? 'Hide drawing tools' : 'Show drawing tools'}
            aria-pressed={drawingsOpen}
            className={`grid h-full w-9 place-items-center ${drawingsOpen ? 'bg-[#101010] text-[#5bc8ff]' : 'text-[#75879b]'}`}
          >
            <Pencil size={16}/>
          </button>
        )}
      </div>

      <button type="button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={onFullscreen} className={fullScreenClass}>
        {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      </button>
    </div>
  );
}
