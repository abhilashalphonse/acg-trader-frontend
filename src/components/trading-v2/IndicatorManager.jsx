import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Search, Settings2, Star, Trash2 } from 'lucide-react';
import { INDICATOR_LIBRARY } from '../../utils/indicators.js';

const categories = ['All', 'Favorites', 'Trend', 'Momentum', 'Volatility', 'Volume'];

function summary(indicator) {
  const s = indicator.settings || {};
  if (indicator.id === 'ema' || indicator.id === 'sma') return `${s.period || 20}`;
  if (indicator.id === 'rsi' || indicator.id === 'atr') return `${s.period || 14}`;
  if (indicator.id === 'bollinger') return `${s.period || 20}, ${s.deviation || 2}`;
  if (indicator.id === 'macd') return `${s.fast || 12}, ${s.slow || 26}, ${s.signal || 9}`;
  if (indicator.id === 'stochastic') return `${s.kPeriod || 14}, ${s.dPeriod || 3}`;
  return '';
}

export default function IndicatorManager({
  applied = [],
  favorites = [],
  onAdd = () => {},
  onRemove = () => {},
  onToggleVisible = () => {},
  onUpdate = () => {},
  onToggleFavorite = () => {},
  focusInstanceId = null,
  desktop = false,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Favorites');
  const [editingId, setEditingId] = useState(null);

  React.useEffect(() => {
    if (focusInstanceId && applied.some(item => item.instanceId === focusInstanceId)) {
      setEditingId(focusInstanceId);
    }
  }, [applied, focusInstanceId]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INDICATOR_LIBRARY.filter(item => {
      if (category === 'Favorites' && !favorites.includes(item.id)) return false;
      if (!['All', 'Favorites'].includes(category) && item.category !== category) return false;
      return !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    });
  }, [query, category, favorites]);

  return (
    <div className={desktop ? 'min-w-0' : ''}>
      <div className="flex h-11 items-center gap-2 rounded-md border border-white/[0.08] bg-[#080808] px-3">
        <Search size={15} className="text-[#6f8295]" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search indicators" className="min-w-0 flex-1 bg-transparent text-[11px] text-[#eef4f8] outline-none placeholder:text-[#53677b]" />
      </div>

      {applied.length > 0 && (
        <section className="mt-3">
          <div className="mb-2 flex items-center justify-between px-1"><strong className="text-[9px] uppercase tracking-[0.12em] text-[#71869a]">Applied</strong><span className="text-[8px] text-[#52687b]">{applied.length}</span></div>
          <div className="space-y-1.5">
            {applied.map(indicator => {
              const editing = editingId === indicator.instanceId;
              return (
                <div key={indicator.instanceId} className="overflow-hidden rounded-md border border-white/[0.08] bg-[#080808]">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button type="button" onClick={() => onToggleVisible(indicator.instanceId)} className={`grid size-6 shrink-0 place-items-center rounded-md border text-[10px] ${indicator.visible !== false ? 'border-white/[0.13] bg-[#101010] text-[#65cfff]' : 'border-white/[0.08] bg-[#101010] text-[#526779]'}`} aria-label="Toggle indicator visibility">{indicator.visible !== false ? <Check size={12}/> : '—'}</button>
                    <button type="button" onClick={() => setEditingId(editing ? null : indicator.instanceId)} className="min-w-0 flex-1 text-left"><b className="block truncate text-[11px] text-[#eaf1f6]">{indicator.name}</b><span className="mt-0.5 block text-[8px] text-[#6c8094]">{summary(indicator) || 'No parameters'}</span></button>
                    <button type="button" onClick={() => setEditingId(editing ? null : indicator.instanceId)} className="grid size-7 place-items-center rounded-lg text-[#71869a] hover:bg-white/[0.04]" aria-label="Indicator settings"><Settings2 size={14}/></button>
                    <button type="button" onClick={() => onRemove(indicator.instanceId)} className="grid size-7 place-items-center rounded-lg text-[#8a6670] hover:bg-[#2b151b] hover:text-[#ff7280]" aria-label="Remove indicator"><Trash2 size={13}/></button>
                    {editing ? <ChevronUp size={13} className="text-[#526a7d]"/> : <ChevronDown size={13} className="text-[#526a7d]"/>}
                  </div>
                  {editing && <SettingsPanel indicator={indicator} onUpdate={patch => onUpdate(indicator.instanceId, patch)} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className={`${desktop ? 'mt-3' : 'mt-4'} flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {categories.map(item => <button key={item} type="button" onClick={() => setCategory(item)} className={`h-8 shrink-0 rounded-lg px-3 text-[9px] font-bold ${category === item ? 'border border-white/[0.13] bg-[#101010] text-[#61caff]' : 'border border-white/[0.08] bg-[#080808] text-[#71869a]'}`}>{item}</button>)}
      </div>

      <section className="mt-2 space-y-1.5">
        {available.map(definition => {
          const appliedCount = applied.filter(item => item.id === definition.id).length;
          const favorite = favorites.includes(definition.id);
          return (
            <div key={definition.id} className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#080808] px-3 py-2.5">
              <button type="button" onClick={() => onToggleFavorite(definition.id)} className={`grid size-7 shrink-0 place-items-center rounded-lg ${favorite ? 'text-[#ffc95b]' : 'text-[#536a7e]'}`} aria-label={favorite ? 'Remove favorite' : 'Add favorite'}><Star size={14} fill={favorite ? 'currentColor' : 'none'}/></button>
              <div className="min-w-0 flex-1"><b className="block truncate text-[11px] text-[#eaf1f6]">{definition.name}</b><span className="mt-0.5 block text-[8px] text-[#667b8e]">{definition.category}{appliedCount ? ` · ${appliedCount} applied` : ''}</span></div>
              <button type="button" onClick={() => onAdd(definition.id)} className="h-8 rounded-md border border-[#245070] bg-[#101010] px-3 text-[9px] font-black text-[#62caff]">ADD</button>
            </div>
          );
        })}
        {!available.length && <div className="grid h-24 place-items-center text-[9px] text-[#5d7286]">No indicators match this filter</div>}
      </section>
    </div>
  );
}

function NumberField({ label, value, min = 1, max = 500, step = 1, onChange }) {
  return <label className="block"><span className="mb-1 block text-[7px] font-bold uppercase tracking-[0.08em] text-[#64798d]">{label}</span><input type="number" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} className="h-9 w-full rounded-md border border-white/[0.08] bg-[#080808] px-2.5 text-[10px] font-semibold text-[#dbe5ed] outline-none focus:border-[#53c7ff]" /></label>;
}

function SettingsPanel({ indicator, onUpdate }) {
  const s = indicator.settings || {};
  let fields = null;
  if (['ema', 'sma'].includes(indicator.id)) fields = <NumberField label="Period" value={s.period || 20} min={1} max={500} onChange={period => onUpdate({ period })}/>;
  if (['rsi', 'atr'].includes(indicator.id)) fields = <NumberField label="Period" value={s.period || 14} min={2} max={200} onChange={period => onUpdate({ period })}/>;
  if (indicator.id === 'bollinger') fields = <div className="grid grid-cols-2 gap-2"><NumberField label="Period" value={s.period || 20} min={2} max={200} onChange={period => onUpdate({ period })}/><NumberField label="Deviation" value={s.deviation || 2} min={0.1} max={10} step={0.1} onChange={deviation => onUpdate({ deviation })}/></div>;
  if (indicator.id === 'macd') fields = <div className="grid grid-cols-3 gap-2"><NumberField label="Fast" value={s.fast || 12} min={1} max={100} onChange={fast => onUpdate({ fast })}/><NumberField label="Slow" value={s.slow || 26} min={2} max={200} onChange={slow => onUpdate({ slow })}/><NumberField label="Signal" value={s.signal || 9} min={1} max={100} onChange={signal => onUpdate({ signal })}/></div>;
  if (indicator.id === 'stochastic') fields = <div className="grid grid-cols-2 gap-2"><NumberField label="%K" value={s.kPeriod || 14} min={2} max={100} onChange={kPeriod => onUpdate({ kPeriod })}/><NumberField label="%D" value={s.dPeriod || 3} min={1} max={50} onChange={dPeriod => onUpdate({ dPeriod })}/></div>;
  if (!fields) return <div className="border-t border-white/[0.08] px-3 py-2.5 text-[8px] text-[#667b8e]">This indicator has no adjustable parameters.</div>;
  return <div className="border-t border-white/[0.08] bg-[#080808]/70 px-3 py-2.5">{fields}</div>;
}
