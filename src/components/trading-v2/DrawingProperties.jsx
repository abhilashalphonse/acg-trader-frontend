import React, { useState } from 'react';
import { X } from 'lucide-react';
import { drawingToolLabel, isRiskDrawingTool } from '../../utils/drawingTools.js';
import { LineStyleEditor, TimeframeEditor, ToolField, ToolTabs } from './ChartToolControls.jsx';

export default function DrawingProperties({ drawing, onApply, onClose, riskPercent = 0.5, lockAll = false }) {
  const [draft, setDraft] = useState(() => structuredClone(drawing));
  const [tab, setTab] = useState('Style');
  const [error, setError] = useState('');
  const risk = isRiskDrawingTool(drawing.type);
  const patch = update => setDraft(current => ({ ...current, ...update }));
  const submit = event => {
    event.preventDefault();
    if (Array.isArray(draft.timeframeVisibility) && !draft.timeframeVisibility.length) { setError('Select at least one timeframe.'); return; }
    if (risk && (draft.riskPercent === '' || !Number.isFinite(Number(draft.riskPercent ?? riskPercent)) || Number(draft.riskPercent ?? riskPercent) < 0.1 || Number(draft.riskPercent ?? riskPercent) > 5)) { setError('Risk must be between 0.1% and 5%.'); return; }
    if (draft.type === 'text' && !draft.text.trim()) { setError('Enter text for the annotation.'); return; }
    // Coordinates are not included: applying appearance must not overwrite a live drag.
    onApply({ style: draft.style, text: draft.text, timeframeVisibility: draft.timeframeVisibility, locked: lockAll ? drawing.locked : draft.locked, ...(risk ? { riskPercent: Number(draft.riskPercent ?? riskPercent) } : {}) });
    onClose();
  };
  return <form className="acg-chart-tools" aria-label="Drawing properties" onSubmit={submit} noValidate onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div className="acg-tool-editor-heading"><div style={{ flex: 1 }}><strong>{drawingToolLabel(drawing.type)}</strong><span>Drawing properties</span></div><button className="acg-tool-icon" type="button" aria-label="Close drawing properties" onClick={onClose}><X size={18} /></button></div>
    <ToolTabs label="Drawing settings section" options={['Style', 'Visibility']} value={tab} onChange={setTab} />
    <div className="acg-tool-editor-body">
      {tab === 'Style' && <>
        {risk ? <><ToolField type="number" label="Planned risk (%)" min="0.1" max="5" step="0.1" value={draft.riskPercent ?? riskPercent} onChange={riskPercent => patch({ riskPercent })} /><p className="acg-tool-help">Sizing updates after Apply. Review the order ticket before placing a trade.</p></> : <LineStyleEditor label="Appearance" drawing value={draft.style} onChange={style => patch({ style })} />}
        {drawing.type === 'text' && <div className="acg-tool-grid"><ToolField label="Annotation" value={draft.text} onChange={text => patch({ text })} maxLength={240} /><ToolField label="Text size" value={draft.style.fontSize || 12} options={[9,10,12,14,16,20,24].map(n => [n, `${n} px`])} onChange={fontSize => patch({ style: { ...draft.style, fontSize: Number(fontSize) } })} /></div>}
        {drawing.type === 'rectangle' && <ToolField label={`Fill opacity · ${Math.round((draft.style.fillOpacity ?? 0.07) * 100)}%`} type="range" min="0" max="0.35" step="0.01" value={draft.style.fillOpacity ?? 0.07} onChange={fillOpacity => patch({ style: { ...draft.style, fillOpacity: Number(fillOpacity) } })} />}
        <label className="acg-tool-check"><input type="checkbox" disabled={lockAll} checked={lockAll || draft.locked} onChange={event => patch({ locked: event.target.checked })} />{lockAll ? 'All drawings are locked' : 'Lock position on chart'}</label>
      </>}
      {tab === 'Visibility' && <TimeframeEditor value={draft.timeframeVisibility} onChange={timeframeVisibility => patch({ timeframeVisibility })} />}
    </div>
    {error && <p className="acg-tool-error" role="alert">{error}</p>}
    <div className="acg-tool-footer"><button type="button" className="acg-tool-button acg-tool-reset" onClick={onClose}>Cancel</button><button type="submit" className="acg-tool-button acg-tool-primary">Apply</button></div>
  </form>;
}
