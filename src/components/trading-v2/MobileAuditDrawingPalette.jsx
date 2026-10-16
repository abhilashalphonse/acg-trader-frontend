import React, { useState } from 'react';
import { Ellipsis, Eye, EyeOff, Lock, Magnet, Pin, Unlock, RotateCcw, Plus } from 'lucide-react';
import { V4_DRAWING_TOOL_SECTIONS, DRAWING_TOOL_LABELS } from '../../utils/drawingTools.js';
import { DRAWING_TOOL_ICONS } from './DrawingToolIcons.jsx';

/**
 * Screenshot-matched mobile audit palette. Its three permanent buttons remain
 * inside the same floating panel; expanding reveals the existing V4 catalog
 * underneath, never a detached popover or a layout-consuming chart rail.
 * Tool selection remains controlled by the parent chart and survives collapse.
 */
export default function MobileAuditDrawingPalette({
  selectedTool = 'cursor',
  onSelectTool = () => {},
  tradePlanActive = false,
  drawingCount = 0,
  hiddenDrawingCount = 0,
  showDrawings = true,
  onToggleVisibility = () => {},
  onRestoreHiddenDrawings = () => {},
  drawingSnap = 'off',
  onCycleSnap = () => {},
  lockAllDrawings = false,
  onToggleLock = () => {},
  keepDrawingTool = false,
  onTogglePin = () => {},
}) {
  const [expanded, setExpanded] = useState(false);
  const choice = (id) => {
    if (tradePlanActive) return;
    onSelectTool(id);
  };
  const toolButton = (id, quick = false) => {
    const Icon = DRAWING_TOOL_ICONS[id];
    if (!Icon) return null;
    const active = selectedTool === id;
    return (
      <button
        key={id}
        type="button"
        aria-label={DRAWING_TOOL_LABELS[id]}
        aria-pressed={active}
        disabled={tradePlanActive}
        onClick={() => choice(id)}
        title={DRAWING_TOOL_LABELS[id]}
        className={`grid h-[37px] w-[37px] shrink-0 place-items-center rounded-[6px] border transition-colors
          ${active ? 'border-[#e4e8ec] bg-[#eeeef0] text-[#09090b]' : 'border-transparent text-[#dce1e6] active:bg-white/[0.08]'}
          ${quick ? '' : 'hover:bg-white/[0.07]'} disabled:opacity-35`}
      >
        {id === 'cursor' && quick ? <Plus size={22} strokeWidth={1.5}/> : <Icon size={19} strokeWidth={1.5}/>}
      </button>
    );
  };
  const controlButton = (name, label, Icon, onClick, active = false, disabled = false) => (
    <button
      key={name} type="button" aria-label={label} title={label}
      aria-pressed={active} disabled={disabled} onClick={onClick}
      className={`grid h-[37px] w-[37px] shrink-0 place-items-center rounded-[6px] border border-transparent
        ${active ? 'bg-white/[0.12] text-white' : 'text-[#bdc4cc]'}
        hover:bg-white/[0.07] disabled:opacity-35`}
    ><Icon size={18} strokeWidth={1.7}/></button>
  );
  return (
    <aside
      data-acg-mobile-audit-palette
      aria-label="Chart drawing tools"
      className="pointer-events-auto absolute left-[12px] top-[12px] z-[48] flex w-[43px] max-h-[min(72dvh,560px)] flex-col items-center gap-[2px] overflow-y-auto overscroll-contain rounded-[6px] border border-white/[0.10] bg-[#15171b] p-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {toolButton('cursor', true)}
      {toolButton('trendline', true)}
      <button
        type="button"
        data-acg-mobile-audit-palette-toggle
        aria-label={expanded ? 'Collapse drawing tools' : 'Expand drawing tools'}
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className={`grid h-[37px] w-[37px] shrink-0 place-items-center rounded-[6px] text-[#e0e4e8] transition-colors ${expanded ? 'bg-white/[0.09]' : 'active:bg-white/[0.08]'}`}
        title={expanded ? 'Collapse all drawing tools' : 'Expand all drawing tools'}
      ><Ellipsis size={22} strokeWidth={2.2}/></button>

      {expanded && (
        <div data-acg-mobile-audit-palette-expanded className="flex w-full shrink-0 flex-col items-center gap-[2px] border-t border-white/[0.10] pt-[4px]">
          {V4_DRAWING_TOOL_SECTIONS.map(section => {
            const ids = section.tools.filter(id => id !== 'cursor' && id !== 'trendline');
            if (!ids.length) return null;
            return (
              <React.Fragment key={section.id}>
                <span className="sr-only">{section.label}</span>
                {section.id !== 'lines' && <div className="my-[3px] h-px w-[26px] shrink-0 bg-white/[0.12]" aria-hidden="true"/>}
                {ids.map(id => toolButton(id))}
              </React.Fragment>
            );
          })}
          <div className="my-[3px] h-px w-[26px] shrink-0 bg-white/[0.12]" aria-hidden="true"/>
          {controlButton('eye', showDrawings ? 'Hide drawings' : 'Show drawings', showDrawings ? Eye : EyeOff, onToggleVisibility, !showDrawings)}
          {hiddenDrawingCount > 0 && controlButton('restore', 'Restore individually hidden drawings', RotateCcw, onRestoreHiddenDrawings)}
          {controlButton('magnet', `Drawing magnet: ${drawingSnap}`, Magnet, onCycleSnap, drawingSnap !== 'off', tradePlanActive)}
          {controlButton('lock', lockAllDrawings ? 'Unlock drawings' : 'Lock drawings', lockAllDrawings ? Lock : Unlock, onToggleLock, lockAllDrawings, tradePlanActive)}
          {controlButton('pin', 'Keep drawing tool selected', Pin, onTogglePin, keepDrawingTool, tradePlanActive || selectedTool === 'cursor')}
          {drawingCount > 0 && <span className="pb-1 text-[9px] tabular-nums text-[#a0a9b3]" aria-label={`${drawingCount} drawings`}>{drawingCount}</span>}
        </div>
      )}
    </aside>
  );
}
