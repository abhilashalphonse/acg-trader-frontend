import React from 'react';
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
  onActiveIndicatorsChange = () => {},
  onToggleIndicator = () => {},
  onOpenIndicatorSettings = () => {},
  onRemoveIndicator = () => {},
  positions = [],
  pendingOrders = [],
  onModifyPending = () => {},
  onCancelPending = () => {},
  selectedTool = 'cursor',
  onSelectedToolChange = () => {},
  chartMode = 'candles',
  onActiveTimeframeChange = () => {},
  tradePlan = null,
  tradePlanLots = 0.1,
  accountCurrency = 'USD',
  account = null,
  riskPercent = 0.5,
  onCreateRiskOrder = () => {},
  onTradePlanChange = () => {},
  onUpdatePosition = () => {},
  selectedPositionId = null,
  onSelectPosition = () => {},
  onClosePosition = () => {},
}) {
  const layout = [1,2,4].includes(Number(config?.layout)) ? Number(config.layout) : 1;
  const cells = Array.isArray(config?.cells) ? config.cells : [];
  const linked = config?.linked === true;
  const singleChart = layout === 1;
  const activeCell = Math.min(Math.max(0, Number(config?.activeCell) || 0), layout - 1);

  const patch = next => onChange({ ...config, ...next });
  const activateCell = (index, timeframe, symbol, cellIndicators) => {
    patch({ activeCell: index });
    onActiveTimeframeChange(timeframe);
    onActiveIndicatorsChange(Array.isArray(cellIndicators) ? cellIndicators : []);
    if (symbol && symbol !== activeSymbol) onSelectSymbol(symbol);
  };

  const updateCell = (index, changes, extra = {}) => {
    const next = Array.from({ length: Math.max(4, cells.length) }, (_, i) => cells[i] || {});
    next[index] = { ...next[index], ...changes };
    if (linked && changes.symbol) {
      for (let i = 0; i < layout; i += 1) next[i] = { ...next[i], symbol: changes.symbol };
    }
    patch({ cells: next, ...extra });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-black">
      <div className={`grid h-full min-h-0 flex-1 gap-px overflow-hidden bg-white/[0.08] ${cellGrid(layout)}`}>
        {Array.from({ length: layout }, (_, index) => {
          const cell = cells[index] || {};
          const requestedSymbol = cell.symbol || (index === 0 ? activeSymbol : markets[index]?.symbol) || activeSymbol;
          const instrument = marketFor(markets, requestedSymbol) || marketFor(markets, activeSymbol) || markets[0] || null;
          const symbol = instrument?.symbol || activeSymbol || '';
          const timeframe = TIMEFRAMES.includes(cell.timeframe) ? cell.timeframe : '1m';
          const isActive = index === activeCell;
          const cellIndicators = Array.isArray(cell.indicators) ? cell.indicators : indicators;
          const cellPositions = positions.filter(position => position.symbol === symbol);
          const cellPendingOrders = pendingOrders.filter(order => order.symbol === symbol);
          return (
            <section
              key={index}
              className={`relative grid h-full min-h-0 min-w-0 overflow-hidden ${singleChart ? 'grid-rows-[minmax(0,1fr)]' : 'grid-rows-[34px_minmax(0,1fr)]'} bg-black ${isActive && !singleChart ? 'ring-1 ring-inset ring-[#195be1]' : ''}`}
              onMouseDown={() => activateCell(index, timeframe, symbol, cellIndicators)}
            >
              {!singleChart && (
                <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#07090B] px-1.5">
                  <InstrumentAvatar instrument={instrument} size={18}/>
                  <select
                    value={symbol || ''}
                    onChange={event => {
                      const next = event.target.value;
                      updateCell(index, { symbol: next }, { activeCell: index });
                      onActiveIndicatorsChange(cellIndicators);
                      onSelectSymbol(next);
                    }}
                    className="max-w-[120px] bg-transparent text-[10px] font-semibold text-[#E6EDF3] outline-none"
                    aria-label={`Chart ${index + 1} symbol`}
                  >
                    {markets.map(item => <option key={item.symbol} value={item.symbol} className="bg-[#0C1013]">{item.displaySymbol || item.symbol}</option>)}
                  </select>
                  <select
                    value={timeframe}
                    onChange={event => {
                      const next = event.target.value;
                      updateCell(index, { timeframe: next }, { activeCell: index });
                      onActiveIndicatorsChange(cellIndicators);
                      onActiveTimeframeChange(next);
                    }}
                    className="ml-auto bg-transparent font-mono text-[9px] font-semibold text-[#6F8191] outline-none"
                    aria-label={`Chart ${index + 1} timeframe`}
                  >
                    {TIMEFRAMES.map(tf => <option key={tf} value={tf} className="bg-[#0C1013]">{tf}</option>)}
                  </select>
                  <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[7px] font-bold text-[#6F8191]" title="Indicators on this chart">ƒx {cellIndicators.length}</span>
                  <span className={`size-1.5 rounded-full ${instrument?.live ? 'bg-[#42D7A1]' : instrument?.isStale ? 'bg-[#E7BD58]' : 'bg-[#4a5967]'}`}/>
                </div>
              )}

              <div className="h-full min-h-0 min-w-0 overflow-hidden">
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
                  hideToolbar={!isActive}
                  tradePlan={isActive ? tradePlan : null}
                  tradePlanLots={tradePlanLots}
                  accountCurrency={accountCurrency}
                  account={account}
                  riskPercent={riskPercent}
                  onCreateRiskOrder={isActive ? onCreateRiskOrder : () => {}}
                  chartInstanceId={`desktop-chart-${index}`}
                  drawingInteractionEnabled={isActive}
                  onTradePlanChange={isActive ? onTradePlanChange : () => {}}
                  onUpdatePosition={onUpdatePosition}
                  selectedPositionId={selectedPositionId}
                  onSelectPosition={onSelectPosition}
                  onClosePosition={onClosePosition}
                  indicators={cellIndicators}
                  onToggleIndicator={isActive ? onToggleIndicator : () => {}}
                  onOpenIndicatorSettings={isActive ? onOpenIndicatorSettings : () => {}}
                  onRemoveIndicator={isActive ? onRemoveIndicator : () => {}}
                  positions={cellPositions}
                  pendingOrders={cellPendingOrders}
                  onModifyPending={onModifyPending}
                  onCancelPending={onCancelPending}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
