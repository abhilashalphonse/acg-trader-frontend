import React, { useId } from 'react';
import { Check } from 'lucide-react';
import { CHART_TIMEFRAMES } from '../../utils/chartToolSettings.js';
import { canonicalTimeframeVisibility } from '../../utils/drawingTools.js';
import '../../styles/chart-tools.css';

export function ToolTabs({ options, value, onChange, label }) {
  return <div className="acg-tool-tabs" role="group" aria-label={label}>{options.map(option => <button type="button" key={option} aria-pressed={value === option} onClick={() => onChange(option)}>{option}</button>)}</div>;
}

export function ToolField({ label, value, onChange, options, ...props }) {
  const id = useId();
  return <label className="acg-tool-field" htmlFor={id}><span>{label}</span>{options
    ? <select id={id} value={value} onChange={event => onChange(event.target.value)} {...props}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
    : <input id={id} value={value} onChange={event => onChange(event.target.value)} {...props} />}</label>;
}

export function LineStyleEditor({ label = 'Line', value = {}, onChange, drawing = false }) {
  const palette = ['#54c8ff', '#f0c35c', '#b38cff', '#35d79d', '#ff6673', '#d8e4ee'];
  const styleKey = drawing ? 'dash' : 'lineStyle';
  return <fieldset className="acg-tool-style"><legend>{label}</legend>
    <div className="acg-tool-colors">{palette.map(color => <button type="button" key={color} style={{ '--swatch': color }} aria-label={`${label} color ${color}`} aria-pressed={value.color === color} onClick={() => onChange({ ...value, color })}>{value.color === color && <Check size={14} />}</button>)}<input type="color" aria-label={`Custom ${label.toLowerCase()} color`} value={value.color || palette[0]} onChange={event => onChange({ ...value, color: event.target.value })} /></div>
    <div className="acg-tool-grid"><ToolField label="Thickness" value={value.width || 2} options={(drawing ? [1, 1.4, 1.5, 2, 3, 4] : [1, 2, 3, 4]).map(n => [n, `${n} px`])} onChange={width => onChange({ ...value, width: Number(width) })} /><ToolField label="Line style" value={value[styleKey] || 'solid'} options={['solid', 'dashed', 'dotted'].map(s => [s, s[0].toUpperCase() + s.slice(1)])} onChange={style => onChange({ ...value, [styleKey]: style })} /></div>
  </fieldset>;
}

export function TimeframeEditor({ value = 'all', onChange }) {
  const visibility = Array.isArray(value) && !value.length ? [] : canonicalTimeframeVisibility(value);
  const all = visibility === 'all';
  const selected = all ? [] : Array.isArray(visibility) ? visibility : [visibility];
  return <div className="acg-tool-visibility"><label className="acg-tool-check"><input type="checkbox" checked={all} onChange={event => onChange(event.target.checked ? 'all' : CHART_TIMEFRAMES.map(([id]) => id))} />All timeframes</label><p>Choose where this tool appears. Its settings stay the same.</p><div className="acg-tool-timeframes">{CHART_TIMEFRAMES.map(([id, label]) => <button type="button" key={id} aria-pressed={all || selected.includes(id)} onClick={() => onChange(all ? [id] : selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id])}>{label}</button>)}</div></div>;
}
