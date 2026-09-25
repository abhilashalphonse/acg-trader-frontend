import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, Plus, Search, Settings2, SlidersHorizontal, Star, Trash2, X } from 'lucide-react';
import { INDICATOR_LIBRARY } from '../../utils/indicators.js';
import { INDICATOR_DETAILS, searchIndicators, settingsForSave, validateIndicatorSettings } from '../../utils/chartToolSettings.js';
import { LineStyleEditor, TimeframeEditor, ToolField, ToolTabs } from './ChartToolControls.jsx';

const categories = ['All', 'Favorites', 'Trend', 'Momentum', 'Volatility', 'Volume'];
const sources = [['close', 'Close'], ['open', 'Open'], ['high', 'High'], ['low', 'Low'], ['hl2', 'HL2 · (high + low) / 2'], ['hlc3', 'HLC3 · typical price'], ['ohlc4', 'OHLC4 · average price']];
function summary({ id, settings: s = {} }) {
  if (id === 'macd') return `${s.fast} / ${s.slow} / ${s.signal}`;
  if (id === 'stochastic') return `${s.kPeriod} / ${s.dPeriod}`;
  if (id === 'bollinger') return `${s.period} / ${s.deviation}`;
  return s.period ? `${s.period} · ${s.source || 'bars'}` : id === 'vwap' ? s.sessionReset : 'Data feed volume';
}

export default function IndicatorManager({ applied = [], favorites = [], onAdd = () => {}, onRemove = () => {}, onToggleVisible = () => {}, onUpdate = () => {}, onToggleFavorite = () => {}, focusInstanceId = null, onClearFocus = () => {} }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [view, setView] = useState('Library');
  const [editingId, setEditingId] = useState(focusInstanceId);
  const [notice, setNotice] = useState('');
  const searchRef = useRef(null);
  useEffect(() => { if (focusInstanceId) setEditingId(focusInstanceId); }, [focusInstanceId]);
  const editing = applied.find(item => item.instanceId === editingId);
  const available = useMemo(() => searchIndicators(INDICATOR_LIBRARY, query, category, favorites), [query, category, favorites]);
  const closeEditor = () => { setEditingId(null); setView('On chart'); onClearFocus(); };
  return <div className="acg-chart-tools acg-indicators">
    {editing ? <IndicatorSettings key={editing.instanceId} indicator={editing} onCancel={closeEditor} onApply={settings => { onUpdate(editing.instanceId, settings); setNotice(`${editing.name} settings applied.`); closeEditor(); }} /> : <>
      <div className="acg-tool-search"><Search size={17} aria-hidden="true" /><input ref={searchRef} aria-label="Search indicators" placeholder="Search indicators…" value={query} onChange={event => { setQuery(event.target.value); setView('Library'); setCategory('All'); }} />{query && <button type="button" className="acg-tool-icon" aria-label="Clear search" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={15} /></button>}</div>
      <div className="acg-tool-section-heading"><ToolTabs label="Indicator view" options={['Library', 'On chart']} value={view} onChange={setView} /><span className="acg-tool-count">{applied.length} on chart</span></div>
      {view === 'Library' ? <>
        <div className="acg-tool-categories" role="group" aria-label="Indicator category">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item === 'Favorites' && <Star size={12} />}{item}</button>)}</div>
        {available.map(definition => {
          const count = applied.filter(item => item.id === definition.id).length;
          const favorite = favorites.includes(definition.id);
          const [name, description] = INDICATOR_DETAILS[definition.id];
          return <div key={definition.id} className="acg-indicator-row">
            <button type="button" className="acg-tool-icon acg-favorite" aria-label={`${favorite ? 'Unfavorite' : 'Favorite'} ${name}`} aria-pressed={favorite} onClick={() => onToggleFavorite(definition.id)}><Star size={16} fill={favorite ? 'currentColor' : 'none'} /></button>
            <div className="acg-indicator-description"><strong>{name}</strong><span>{description}</span><small>{definition.id.toUpperCase()} · {definition.category}{count > 0 ? ` · ${count} on chart` : ''}</small></div>
            <button type="button" className="acg-tool-add" aria-label={`Add ${name}`} onClick={() => { onAdd(definition.id); setNotice(`${definition.name} added to the chart.`); }}><Plus size={15} /><span>Add</span></button>
          </div>;
        })}
        {!available.length && <div className="acg-tool-empty"><Search size={24} /><strong>{category === 'Favorites' && !query ? 'Your favorites live here' : 'No matching indicators'}</strong><span>{category === 'Favorites' && !query ? 'Star an indicator to keep it close at hand.' : 'Try a name, abbreviation, or category.'}</span><button type="button" className="acg-tool-button" onClick={() => { setCategory('All'); setQuery(''); }}>Browse all indicators</button></div>}
      </> : <>
        <p className="acg-tool-help">Manage visibility and fine-tune each indicator independently.</p>
        {applied.map(indicator => <div key={indicator.instanceId} className="acg-indicator-row" data-hidden={indicator.visible === false}>
          <span className="acg-indicator-swatch" style={{ background: indicator.settings?.style?.color || '#8996a8' }} />
          <button type="button" className="acg-indicator-edit" onClick={() => setEditingId(indicator.instanceId)}><strong>{indicator.name}</strong><span>{summary(indicator)}{indicator.visible === false ? ' · Hidden' : ''}</span></button>
          <div className="acg-tool-actions"><button type="button" className="acg-tool-icon" aria-label={`${indicator.visible === false ? 'Show' : 'Hide'} ${indicator.name}`} onClick={() => onToggleVisible(indicator.instanceId)}>{indicator.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}</button><button type="button" className="acg-tool-icon" aria-label={`Edit ${indicator.name}`} onClick={() => setEditingId(indicator.instanceId)}><Settings2 size={16} /></button><button type="button" className="acg-tool-icon acg-tool-danger" aria-label={`Remove ${indicator.name}`} onClick={() => { onRemove(indicator.instanceId); setNotice(`${indicator.name} removed.`); }}><Trash2 size={16} /></button></div>
        </div>)}
        {!applied.length && <div className="acg-tool-empty"><SlidersHorizontal size={24} /><strong>A clear chart, ready for your setup</strong><span>Add an indicator from the library to get started.</span><button type="button" className="acg-tool-button" onClick={() => setView('Library')}>Explore indicators</button></div>}
      </>}
    </>}
    <div className="acg-tool-notice" role="status">{notice && <><Check size={14} />{notice}</>}</div>
  </div>;
}

function IndicatorSettings({ indicator, onCancel, onApply }) {
  const [settings, setSettings] = useState(() => structuredClone(indicator.settings));
  const [tab, setTab] = useState('Inputs');
  const [attempted, setAttempted] = useState(false);
  const error = validateIndicatorSettings(indicator.id, settings);
  const patch = value => setSettings(current => ({ ...current, ...value }));
  const numeric = (key, label, min, max, step = 1) => <ToolField key={key} type="number" label={label} value={settings[key] ?? ''} min={min} max={max} step={step} onChange={value => patch({ [key]: value })} />;
  const id = indicator.id;
  return <form className="acg-tool-editor" noValidate onSubmit={event => { event.preventDefault(); setAttempted(true); if (!error) onApply(settingsForSave(settings)); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); } }}>
    <div className="acg-tool-editor-heading"><button type="button" className="acg-tool-icon" aria-label="Cancel indicator settings" onClick={onCancel}><ArrowLeft size={18} /></button><div><strong>{INDICATOR_DETAILS[id][0]}</strong><span>Indicator settings</span></div></div>
    <ToolTabs label="Settings section" options={['Inputs', 'Style', 'Visibility']} value={tab} onChange={setTab} />
    <div className="acg-tool-editor-body">
      {tab === 'Inputs' && <><p className="acg-tool-help">{INDICATOR_DETAILS[id][1]}</p><div className="acg-tool-grid">
        {['ema', 'sma'].includes(id) && numeric('period', 'Length', 1, 500)}
        {['rsi', 'atr', 'bollinger'].includes(id) && numeric('period', 'Length', 2, 200)}
        {id === 'bollinger' && numeric('deviation', 'Standard deviations', 0.1, 10, 0.1)}
        {id === 'macd' && <>{numeric('fast', 'Fast length', 1, 100)}{numeric('slow', 'Slow length', 2, 200)}{numeric('signal', 'Signal smoothing', 1, 100)}</>}
        {id === 'stochastic' && <>{numeric('kPeriod', '%K length', 2, 100)}{numeric('dPeriod', '%D smoothing', 1, 50)}</>}
        {['ema', 'sma', 'vwap', 'bollinger', 'rsi', 'macd'].includes(id) && <ToolField label="Source" value={settings.source} onChange={source => patch({ source })} options={sources} />}
        {id === 'vwap' && <ToolField label="Anchor / reset" value={settings.sessionReset} onChange={sessionReset => patch({ sessionReset })} options={[[ 'session', 'Instrument session'], ['utc-day', 'UTC day'], ['utc-week', 'UTC week'], ['none', 'Continuous']]} />}
        {['rsi', 'stochastic'].includes(id) && <>{numeric('lowerGuide', 'Lower guide', 0, 100)}{numeric('upperGuide', 'Upper guide', 0, 100)}</>}
      </div>{id === 'volume' && <p className="acg-tool-help">Volume uses the available data feed. No calculation inputs are required.</p>}</>}
      {tab === 'Style' && <>
        {id === 'volume' ? <p className="acg-tool-help">Volume bars follow the chart’s up and down candle colors.</p> : <LineStyleEditor label={id === 'bollinger' ? 'Outer bands' : id === 'macd' ? 'MACD' : id === 'stochastic' ? '%K' : 'Line'} value={settings.style} onChange={style => patch({ style })} />}
        {id === 'bollinger' && <LineStyleEditor label="Basis" value={settings.midStyle} onChange={midStyle => patch({ midStyle })} />}
        {['macd', 'stochastic'].includes(id) && <LineStyleEditor label={id === 'macd' ? 'Signal' : '%D'} value={settings.signalStyle} onChange={signalStyle => patch({ signalStyle })} />}
      </>}
      {tab === 'Visibility' && <TimeframeEditor value={settings.timeframeVisibility} onChange={timeframeVisibility => patch({ timeframeVisibility })} />}
    </div>
    {attempted && error && <p className="acg-tool-error" role="alert">{error}</p>}
    <div className="acg-tool-footer"><button type="button" className="acg-tool-button acg-tool-reset" onClick={() => { setSettings(structuredClone(INDICATOR_LIBRARY.find(item => item.id === id).defaults)); setAttempted(false); }}>Reset defaults</button><button type="button" className="acg-tool-button" onClick={onCancel}>Cancel</button><button type="submit" className="acg-tool-button acg-tool-primary">Apply</button></div>
  </form>;
}
