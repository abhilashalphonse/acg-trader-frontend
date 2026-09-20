import React from 'react';
import { Columns2, Grid2X2, Link2, Link2Off, Square } from 'lucide-react';
import ChartArea from '../ChartArea.jsx';
import InstrumentAvatar from '../InstrumentAvatar.jsx';

const TIMEFRAMES = ['1m','5m','15m','30m','1H','4H','1D','1W'];
const TF_MAP = { '1m':'M1','5m':'M5','15m':'M15','30m':'M30','1H':'H1','4H':'H4','1D':'D1','1W':'W1' };

function marketFor(markets, symbol) {
  return (Array.isArray(markets) ? markets : []).find(item => item.symbol === symbol) || null;
}

function cellGrid(layout) {
  if (layout === 4) return 'grid-cols-2 grid-rows-2';
  if (layout === 2) return 'grid-cols-2 grid-rows-1';
  return 'grid-cols-1 grid-rows-1';
}

export default function DesktopMultiChart({
  config,
  onChange = () => {},
  markets = [],
  activeSymbol,
  onSelectSymbol = () => {},
  indicators = [],
  positions = [],
  selectedTool = 'cursor',
  onSelectedToolChange = () => {},
  chartMode = 'candles',
  tradePlan = null,
  onTradePlanChange = () => {},
  onUpdatePosition = () => {},
}) {
  const layout = [1,2,4].includes(Number(config?.layout)) ? Number(config.layout) : 1;
  const cells = Array.isArray(config?.cells) ? config.cells : [];
  const linked = config?.linked === true;
  const activeCell = Math.min(Math.max(0, Number(config?.activeCell) || 0), layout - 1);

  const patch = next => onChange({ ...config, ...next });
  const updateCell = (index, changes, extra = {}) => {
    const next = Array.from({ length: Math.max(4, cells.length) }, (_, i) => cells[i] || {});
    next[index] = { ...next[index], ...changes };
    if (linked && changes.symbol) {
      for (let i = 0; i < layout; i += 1) next[i] = { ...next[i], symbol: changes.symbol };
    }
    patch({ cells: next, ...extra });
  };

  const setLayout = nextLayout => patch({ layout: nextLayout, activeCell: Math.min(activeCell, nextLayout - 1) });

  return (
    <div className="flex h-full min-h-0 flex-col bg-black">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-white/[0.07] bg-[#070707] px-2">
        <span className="mr-1 text-[6.5px] font-black uppercase tracking-[0.08em] text-[#53677a]">Charts</span>
        <button type="button" onClick={() => setLayout(1)} className={`grid size-6 place-items-center rounded ${layout===1?'bg-white/[0.06] text-[#63caff]':'text-[#60758a] hover:text-white'}`} title="Single chart"><Square size={11}/></button>
        <button type="button" onClick={() => setLayout(2)} className={`grid size-6 place-items-center rounded ${layout===2?'bg-white/[0.06] text-[#63caff]':'text-[#60758a] hover:text-white'}`} title="Two charts"><Columns2 size={12}/></button>
        <button type="button" onClick={() => setLayout(4)} className={`grid size-6 place-items-center rounded ${layout===4?'bg-white/[0.06] text-[#63caff]':'text-[#60758a] hover:text-white'}`} title="Four charts"><Grid2X2 size={12}/></button>
        <div className="mx-1 h-4 w-px bg-white/[0.07]"/>
        <button type="button" onClick={() => patch({ linked: !linked })} className={`flex h-6 items-center gap-1 rounded px-1.5 text-[6.5px] font-bold ${linked?'bg-[#0d1a22] text-[#63caff]':'text-[#60758a] hover:text-white'}`} title="Link symbols across charts">{linked?<Link2 size={10}/>:<Link2Off size={10}/>}Link symbols</button>
        <span className="ml-auto text-[6.5px] text-[#53677a]">Active chart drives symbol selection</span>
      </div>

      <div className={`grid min-h-0 flex-1 gap-px bg-white/[0.08] ${cellGrid(layout)}`}>
        {Array.from({ length: layout }, (_, index) => {
          const cell = cells[index] || {};
          const requestedSymbol = cell.symbol || (index === 0 ? activeSymbol : markets[index]?.symbol) || activeSymbol;
          const instrument = marketFor(markets, requestedSymbol) || marketFor(markets, activeSymbol) || markets[0] || null;
          const symbol = instrument?.symbol || activeSymbol || '';
          const timeframe = TIMEFRAMES.includes(cell.timeframe) ? cell.timeframe : '1m';
          const isActive = index === activeCell;
          const cellPositions = positions.filter(position => position.symbol === symbol);
          return (
            <section
              key={index}
              className={`relative grid min-h-0 min-w-0 grid-rows-[30px_minmax(0,1fr)] bg-black ${isActive ? 'ring-1 ring-inset ring-[#315b72]' : ''}`}
              onMouseDown={() => {
                patch({ activeCell: index });
                if (symbol && symbol !== activeSymbol) onSelectSymbol(symbol);
              }}
            >
              <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#080808] px-1.5">
                <InstrumentAvatar instrument={instrument} size={18}/>
                <select
                  value={symbol || ''}
                  onChange={event => {
                    const next = event.target.value;
                    updateCell(index, { symbol: next }, { activeCell: index });
                    onSelectSymbol(next);
                  }}
                  className="max-w-[120px] bg-transparent text-[8px] font-black text-[#dce7ef] outline-none"
                  aria-label={`Chart ${index + 1} symbol`}
                >
                  {markets.map(item => <option key={item.symbol} value={item.symbol} className="bg-[#0a0a0a]">{item.displaySymbol || item.symbol}</option>)}
                </select>
                <select
                  value={timeframe}
                  onChange={event => updateCell(index, { timeframe: event.target.value })}
                  className="ml-auto bg-transparent font-mono text-[7px] font-bold text-[#71869a] outline-none"
                  aria-label={`Chart ${index + 1} timeframe`}
                >
                  {TIMEFRAMES.map(tf => <option key={tf} value={tf} className="bg-[#0a0a0a]">{tf}</option>)}
                </select>
                <span className={`size-1.5 rounded-full ${instrument?.live ? 'bg-[#38d6a2]' : instrument?.isStale ? 'bg-[#e7bd58]' : 'bg-[#4a5967]'}`}/>
              </div>

              <div className="min-h-0 min-w-0">
                <ChartArea
                  desktopEnhanced
                  symbol={symbol}
                  instrument={instrument}
                  chartTimeframe={TF_MAP[timeframe] || 'M1'}
                  tick={null}
                  price={instrument?.bid}
                  ask={instrument?.ask}
                  chartMode={chartMode}
                  selectedTool={isActive ? selectedTool : 'cursor'}
                  onSelectTool={isActive ? onSelectedToolChange : () => {}}
                  embedded
                  hideToolbar={layout > 1}
                  tradePlan={isActive ? tradePlan : null}
                  onTradePlanChange={isActive ? onTradePlanChange : () => {}}
                  onUpdatePosition={onUpdatePosition}
                  indicators={indicators}
                  positions={cellPositions}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
