import React from 'react';
import { Eye, EyeOff, Magnet, Lock, Unlock, Pin } from 'lucide-react';
import { DRAWING_TOOL_LABELS, V4_DRAWING_TOOL_SECTIONS } from '../../../utils/drawingTools.js';
import { DRAWING_TOOL_ICONS } from '../DrawingToolIcons.jsx';
import './V4DrawingToolbar.css';

// This is the existing chart tool catalog reorganized visually, not a new tool engine.
// Keep tool identifiers/callbacks stable so drawings, snapping and risk geometry do
// not change while the V4 presentation is under owner audit.
export default function V4DrawingToolbar({
  selectedTool = 'cursor',
  onSelectTool = () => {},
  tradePlanActive = false,
  drawingCount = 0,
  showDrawings = true,
  onToggleVisibility = () => {},
  drawingSnap = 'off',
  onCycleSnap = () => {},
  lockAllDrawings = false,
  onToggleLock = () => {},
  keepDrawingTool = false,
  onTogglePin = () => {},
}) {
  const controls = [
    { id:'visibility', Icon:showDrawings ? Eye : EyeOff,
      label:showDrawings ? 'Hide all drawings' : 'Show all drawings',
      pressed:showDrawings, click:onToggleVisibility, disabled:false },
    { id:'snap', Icon:Magnet,
      label:drawingSnap === 'off' ? 'Magnet off — click for weak OHLC snapping' :
        drawingSnap === 'weak' ? 'Weak OHLC magnet — click for strong' : 'Strong OHLC magnet — click to turn off',
      pressed:drawingSnap !== 'off', click:onCycleSnap, disabled:tradePlanActive },
    { id:'lock', Icon:lockAllDrawings ? Lock : Unlock,
      label:lockAllDrawings ? 'Unlock drawing movement' : 'Lock all drawing movement',
      pressed:lockAllDrawings, click:onToggleLock, disabled:tradePlanActive },
    { id:'pin', Icon:Pin, label:'Keep selected drawing tool active',
      pressed:keepDrawingTool, click:onTogglePin, disabled:tradePlanActive || selectedTool==='cursor' },
  ];
  return <>
    <div className="acg-v4-drawing-scroll" data-v4-drawing-scroll aria-label="Drawing and analysis tools">
      {V4_DRAWING_TOOL_SECTIONS.map((section,index)=>(
        <div key={section.id} data-v4-drawing-section={section.id}
          className="acg-v4-drawing-section" role="group" aria-label={section.label}>
          {index>0 && <div className="acg-v4-drawing-divider" aria-hidden="true"/>}
          {section.tools.map(id=>{
            const Icon=DRAWING_TOOL_ICONS[id];
            const label=DRAWING_TOOL_LABELS[id];
            return <button key={id} type="button" data-v4-drawing-tool={id}
              className="acg-v4-drawing-button"
              aria-label={label} title={label} aria-pressed={selectedTool===id}
              disabled={tradePlanActive}
              onClick={()=>onSelectTool(id)}>
              <Icon size={18} strokeWidth={1.7}/>
            </button>;
          })}
        </div>
      ))}
    </div>
    <div className="acg-v4-drawing-footer" data-v4-drawing-controls role="group" aria-label="Drawing controls">
      <div className="acg-v4-drawing-divider" aria-hidden="true"/>
      {controls.map(({id,Icon,label,pressed,click,disabled})=>
        <button key={id} type="button" data-v4-drawing-control={id}
          className="acg-v4-drawing-button acg-v4-drawing-control"
          title={label} aria-label={label} aria-pressed={pressed}
          disabled={disabled} onClick={click}>
          <Icon size={18} strokeWidth={1.7}/>
          {id==='visibility' && drawingCount>0 &&
            <span className="acg-v4-drawing-count" aria-hidden="true">{drawingCount}</span>}
          {id==='snap' && drawingSnap!=='off' &&
            <span className="acg-v4-drawing-small-status" aria-hidden="true">{drawingSnap==='strong'?'S':'W'}</span>}
          {id==='pin' && pressed && <span className="acg-v4-drawing-pin-dot" aria-hidden="true"/>}
        </button>
      )}
    </div>
  </>;
}
