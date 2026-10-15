import React from 'react';
import { Copy, EyeOff, Grip, Lock, LockOpen, MoreHorizontal, Settings2, Trash2, X } from 'lucide-react';
import './V4DrawingEditor.css';

const Action = ({ label, children, onClick, disabled = false, danger = false, pressed = false }) => (
  <button type="button" className={'acg-v4-editor-action' + (danger ? ' acg-v4-editor-danger' : '')}
    aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

const V4DrawingEditor = React.forwardRef(function V4DrawingEditor({
  drawing, label, metrics, lockAll, onColor, onWidth, onDash, onCreateOrder,
  onHide, onLock, onDuplicate, onSettings, onDelete, onClose,
  onDragStart, onDragMove, onDragEnd, onDragCancel, style,
}, ref) {
  const isRisk = drawing.type === 'long-position' || drawing.type === 'short-position';
  const width = Number(drawing.style?.width || 1.4);
  const rr = Number(metrics?.riskReward);
  return (
    <div ref={ref} data-v4-floating-drawing-editor className="acg-v4-floating-drawing-editor pointer-events-auto absolute z-30" style={style}>
      <button type="button" className="acg-v4-editor-grip" title="Move drawing toolbar"
        aria-label="Move drawing toolbar" onPointerDown={onDragStart} onPointerMove={onDragMove}
        onPointerUp={onDragEnd} onPointerCancel={onDragCancel}>
        <Grip size={18} strokeWidth={1.8} />
      </button>
      <span className="acg-v4-editor-name" title={label}>{label}</span>
      {isRisk ? (
        <>
          <span className="acg-v4-editor-rr">RR {Number.isFinite(rr) ? rr.toFixed(2) : '—'}</span>
          <button type="button" className="acg-v4-editor-create" disabled={!metrics?.canCreateOrder}
            title={metrics?.canCreateOrder ? 'Load this risk setup into the order planner' : (metrics?.message || 'Risk setup cannot create an order')}
            onClick={onCreateOrder}>Create order</button>
        </>
      ) : (
        <>
          <label className="acg-v4-editor-color" title="Drawing color">
            <span style={{ backgroundColor: drawing.style?.color || '#195be1' }} />
            <input type="color" value={drawing.style?.color || '#195be1'} aria-label="Drawing color"
              onChange={event => onColor(event.target.value)}/>
          </label>
          {drawing.type !== 'text' && (
            <>
              <button type="button" className="acg-v4-editor-width" onClick={onWidth} title="Cycle line width"
                aria-label="Cycle line width">{width.toFixed(width % 1 ? 1 : 0)}</button>
              <Action label={'Line style: ' + (drawing.style?.dash || 'solid')} onClick={onDash}><MoreHorizontal size={17}/></Action>
            </>
          )}
        </>
      )}
      <span className="acg-v4-editor-separator" aria-hidden="true"/>
      <Action label="Hide drawing" onClick={onHide}><EyeOff size={17}/></Action>
      <Action label={lockAll ? 'All drawings are locked' : drawing.locked ? 'Unlock drawing' : 'Lock drawing'}
        onClick={onLock} disabled={lockAll} pressed={drawing.locked || lockAll}>
        {drawing.locked || lockAll ? <Lock size={17}/> : <LockOpen size={17}/>}
      </Action>
      <Action label="Duplicate drawing" onClick={onDuplicate}><Copy size={17}/></Action>
      <Action label="Drawing properties" onClick={onSettings}><Settings2 size={17}/></Action>
      <Action label="Delete drawing" danger onClick={onDelete}><Trash2 size={17}/></Action>
      <Action label="Deselect" onClick={onClose}><X size={17}/></Action>
    </div>
  );
});

export default V4DrawingEditor;
