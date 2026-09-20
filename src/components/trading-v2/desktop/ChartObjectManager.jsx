import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Layers3,
  LocateFixed,
  Lock,
  LockOpen,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { indicatorVisibleOnTimeframe } from '../../../utils/indicators.js';
import {
  getDrawingSnapshot,
  patchDrawing,
  removeDrawing,
  subscribeDrawings,
} from '../../../utils/drawingStore.js';

function indicatorLabel(indicator) {
  const s = indicator?.settings || {};
  if (indicator?.id === 'ema') return `EMA ${s.period || 20}`;
  if (indicator?.id === 'sma') return `SMA ${s.period || 20}`;
  if (indicator?.id === 'rsi') return `RSI ${s.period || 14}`;
  if (indicator?.id === 'atr') return `ATR ${s.period || 14}`;
  if (indicator?.id === 'bollinger') return `Bollinger ${s.period || 20}, ${s.deviation || 2}`;
  if (indicator?.id === 'macd') return `MACD ${s.fast || 12}/${s.slow || 26}/${s.signal || 9}`;
  if (indicator?.id === 'stochastic') return `Stochastic ${s.kPeriod || 14}/${s.dPeriod || 3}`;
  if (indicator?.id === 'vwap') return 'VWAP';
  if (indicator?.id === 'volume') return 'Volume';
  return indicator?.name || indicator?.id || 'Indicator';
}

function drawingLabel(drawing) {
  if (!drawing) return 'Drawing';
  if (drawing.type === 'text') return drawing.text?.trim() || 'Text';
  const labels = {
    trendline: 'Trend line',
    hline: 'Horizontal line',
    vline: 'Vertical line',
    rectangle: 'Rectangle',
    fibonacci: 'Fibonacci retracement',
    'long-position': 'Long position',
    'short-position': 'Short position',
  };
  return labels[drawing.type] || drawing.type || 'Drawing';
}

function drawingUiCommand(symbol, chartInstanceId, id, action) {
  window.dispatchEvent(new CustomEvent('acg-trader-drawing-command', {
    detail: { symbol: String(symbol || '').toUpperCase(), chartInstanceId, id, action },
  }));
}

export default function ChartObjectManager({
  symbol,
  timeframe,
  indicators = [],
  onToggleIndicator = () => {},
  onRemoveIndicator = () => {},
  onOpenIndicatorSettings = () => {},
  onClose = () => {},
  chartInstanceId = 'chart',
}) {
  const drawingState = useSyncExternalStore(
    listener => subscribeDrawings(symbol, listener),
    () => getDrawingSnapshot(symbol),
    () => getDrawingSnapshot(symbol),
  );
  const drawings = drawingState.present;
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const [sections, setSections] = useState({ indicators: true, drawings: true });

  useEffect(() => {
    const normalizedSymbol = String(symbol || '').toUpperCase();
    const onSelection = event => {
      const detail = event?.detail || {};
      if (String(detail.symbol || '').toUpperCase() !== normalizedSymbol) return;
      if (detail.chartInstanceId !== chartInstanceId) return;
      setSelectedDrawingId(detail.selectedId || null);
    };
    window.addEventListener('acg-trader-drawing-selection-change', onSelection);
    return () => window.removeEventListener('acg-trader-drawing-selection-change', onSelection);
  }, [chartInstanceId, symbol]);

  const counts = useMemo(() => ({
    indicators: indicators.length,
    drawings: drawings.length,
    hiddenDrawings: drawings.filter(item => item.hidden).length,
    lockedDrawings: drawings.filter(item => item.locked).length,
  }), [drawings, indicators.length]);

  const toggleSection = key => setSections(current => ({ ...current, [key]: !current[key] }));

  return (
    <div className="w-[330px] overflow-hidden rounded-lg border border-white/[0.10] bg-[#0B0D0F]/98 shadow-[0_24px_70px_rgba(0,0,0,.68)] backdrop-blur-xl">
      <header className="flex h-11 items-center justify-between border-b border-white/[0.07] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Layers3 size={14} className="shrink-0 text-[#59C7FF]"/>
          <div className="min-w-0">
            <strong className="block truncate text-[10px] text-[#EDF3F7]">Chart manager</strong>
            <span className="block truncate text-[7px] text-[#64798D]">{symbol || '—'} · {timeframe || '—'} · {counts.indicators + counts.drawings} objects</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded text-[#75899C] hover:bg-white/[0.04] hover:text-white" aria-label="Close chart manager"><X size={13}/></button>
      </header>

      <div className="max-h-[min(670px,calc(100dvh-160px))] overflow-y-auto p-2 [scrollbar-width:thin]">
        <section>
          <button type="button" onClick={() => toggleSection('indicators')} className="flex h-8 w-full items-center gap-2 rounded px-2 text-left hover:bg-white/[0.03]">
            {sections.indicators ? <ChevronDown size={11} className="text-[#60788C]"/> : <ChevronRight size={11} className="text-[#60788C]"/>}
            <span className="text-[8px] font-black uppercase tracking-[0.09em] text-[#768B9E]">Indicators</span>
            <span className="ml-auto rounded bg-white/[0.04] px-1.5 py-0.5 text-[7px] font-bold text-[#61778A]">{counts.indicators}</span>
          </button>

          {sections.indicators && (
            <div className="space-y-1">
              {indicators.map(indicator => {
                const visibleHere = indicatorVisibleOnTimeframe(indicator, timeframe);
                const globallyVisible = indicator.visible !== false;
                return (
                  <div key={indicator.instanceId} className="group flex min-h-10 items-center gap-1 rounded-md border border-transparent px-1.5 hover:border-white/[0.06] hover:bg-white/[0.025]">
                    <button type="button" onClick={() => onOpenIndicatorSettings(indicator.instanceId)} className="min-w-0 flex-1 px-1 text-left">
                      <span className="block truncate text-[9px] font-semibold text-[#DDE7EE]">{indicatorLabel(indicator)}</span>
                      <span className="mt-0.5 block truncate text-[7px] text-[#5F7488]">{visibleHere ? 'Visible on this timeframe' : globallyVisible ? 'Hidden by timeframe rule' : 'Hidden'}</span>
                    </button>
                    <button type="button" onClick={() => onToggleIndicator(indicator.instanceId)} className={`grid size-7 place-items-center rounded ${visibleHere ? 'text-[#8298AA]' : 'text-[#4F6273]'} hover:bg-white/[0.04] hover:text-white`} title={globallyVisible ? 'Hide indicator' : 'Show indicator'}>{globallyVisible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>
                    <button type="button" onClick={() => onOpenIndicatorSettings(indicator.instanceId)} className="grid size-7 place-items-center rounded text-[#71869A] hover:bg-white/[0.04] hover:text-[#59C7FF]" title="Indicator settings"><Settings2 size={12}/></button>
                    <button type="button" onClick={() => onRemoveIndicator(indicator.instanceId)} className="grid size-7 place-items-center rounded text-[#805F68] opacity-0 transition group-hover:opacity-100 hover:bg-[#35151d] hover:text-[#FF7380]" title="Remove indicator"><Trash2 size={12}/></button>
                  </div>
                );
              })}
              {!indicators.length && <div className="px-3 py-5 text-center text-[8px] text-[#536A7E]">No indicators on the active chart.</div>}
            </div>
          )}
        </section>

        <div className="my-2 border-t border-white/[0.06]"/>

        <section>
          <button type="button" onClick={() => toggleSection('drawings')} className="flex h-8 w-full items-center gap-2 rounded px-2 text-left hover:bg-white/[0.03]">
            {sections.drawings ? <ChevronDown size={11} className="text-[#60788C]"/> : <ChevronRight size={11} className="text-[#60788C]"/>}
            <span className="text-[8px] font-black uppercase tracking-[0.09em] text-[#768B9E]">Drawings</span>
            <span className="ml-auto rounded bg-white/[0.04] px-1.5 py-0.5 text-[7px] font-bold text-[#61778A]">{counts.drawings}</span>
          </button>

          {sections.drawings && (
            <div className="space-y-1">
              {drawings.map(drawing => {
                const selected = drawing.id === selectedDrawingId;
                return (
                  <div key={drawing.id} className={`group flex min-h-10 items-center gap-1 rounded-md border px-1.5 ${selected ? 'border-[#315B72] bg-[#0D1A22]' : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.025]'}`}>
                    <button type="button" onClick={() => { setSelectedDrawingId(drawing.id); drawingUiCommand(symbol, chartInstanceId, drawing.id, 'select'); }} className="min-w-0 flex-1 px-1 text-left">
                      <span className="block truncate text-[9px] font-semibold text-[#DDE7EE]">{drawingLabel(drawing)}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[7px] text-[#5F7488]">
                        <span>{drawing.type}</span>
                        {drawing.hidden && <span>· hidden</span>}
                        {drawing.locked && <span>· locked</span>}
                      </span>
                    </button>
                    <button type="button" onClick={() => { setSelectedDrawingId(drawing.id); drawingUiCommand(symbol, chartInstanceId, drawing.id, 'focus'); }} className="grid size-7 place-items-center rounded text-[#71869A] hover:bg-white/[0.04] hover:text-[#59C7FF]" title="Locate drawing on chart"><LocateFixed size={12}/></button>
                    <button type="button" onClick={() => patchDrawing(symbol, drawing.id, { hidden: !drawing.hidden })} className={`grid size-7 place-items-center rounded ${drawing.hidden ? 'text-[#4F6273]' : 'text-[#8298AA]'} hover:bg-white/[0.04] hover:text-white`} title={drawing.hidden ? 'Show drawing' : 'Hide drawing'}>{drawing.hidden ? <EyeOff size={12}/> : <Eye size={12}/>}</button>
                    <button type="button" onClick={() => patchDrawing(symbol, drawing.id, { locked: !drawing.locked })} className={`grid size-7 place-items-center rounded ${drawing.locked ? 'text-[#59C7FF]' : 'text-[#71869A]'} hover:bg-white/[0.04] hover:text-white`} title={drawing.locked ? 'Unlock drawing' : 'Lock drawing'}>{drawing.locked ? <Lock size={12}/> : <LockOpen size={12}/>}</button>
                    <button type="button" onClick={() => { setSelectedDrawingId(drawing.id); drawingUiCommand(symbol, chartInstanceId, drawing.id, 'settings'); }} className="grid size-7 place-items-center rounded text-[#71869A] opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.04] hover:text-[#59C7FF]" title="Drawing settings"><Settings2 size={12}/></button>
                    <button type="button" onClick={() => { removeDrawing(symbol, drawing.id); if (selectedDrawingId === drawing.id) setSelectedDrawingId(null); }} className="grid size-7 place-items-center rounded text-[#805F68] opacity-0 transition group-hover:opacity-100 hover:bg-[#35151d] hover:text-[#FF7380]" title="Delete drawing"><Trash2 size={12}/></button>
                  </div>
                );
              })}
              {!drawings.length && <div className="px-3 py-5 text-center text-[8px] text-[#536A7E]">No drawings on {symbol || 'this symbol'}.</div>}
            </div>
          )}
        </section>
      </div>

      {(counts.hiddenDrawings > 0 || counts.lockedDrawings > 0) && (
        <footer className="flex h-8 items-center gap-3 border-t border-white/[0.06] px-3 text-[7px] text-[#5C7184]">
          {counts.hiddenDrawings > 0 && <span>{counts.hiddenDrawings} hidden</span>}
          {counts.lockedDrawings > 0 && <span>{counts.lockedDrawings} locked</span>}
        </footer>
      )}
    </div>
  );
}
