import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  projectV4AcceptedLevels, projectV4DraftGroup, placeV4Badges,
  v4MissingProtections, v4ProtectionAction,
} from './chartOrderModel.js';

// An intentionally separate V4-only renderer: no imports from ChartArea or
// legacy plan/pending/position overlays. Future phases connect real chart
// coordinates and command handlers after authenticated staging acceptance.
const COLORS = Object.freeze({ sl:'#ee5465', tp:'#16c590', buy:'#17b899', sell:'#ee596a', neutral:'#aab6c2' });
const priceLabel = (value, formatPrice) => formatPrice ? formatPrice(value) : String(value);

export default function V4ChartOrderLayer({
  accountId, symbol, positions = [], pendingOrders = [], coordinateApi,
  height = 480, formatPrice, formatVolume, formatPnl,
  hidePositionEntries = false, readOnly = false,
  edit = null, saving = false, onBeginEdit, onChangeEdit, onSaveEdit, onCancelEdit,
  onConfirmRemoval, onAddProtection, onSelectPosition, onClosePosition, onCancelPending,
}) {
  const [removeLevel, setRemoveLevel] = useState(null);
  const drag = useRef(null);
  useEffect(() => {
    const onMove = event => {
      if (!drag.current || !coordinateApi?.yToPrice || !onChangeEdit) return;
      const dy = event.clientY - drag.current.startY;
      if (Math.abs(dy) < 4 && !drag.current.started) return;
      drag.current.started = true;
      const nextPrice = coordinateApi.yToPrice(drag.current.startChartY + dy);
      if (Number.isFinite(nextPrice) && nextPrice > 0) {
        onChangeEdit({ ...drag.current.draft, proposedPrice: nextPrice });
      }
    };
    const end = () => { drag.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [coordinateApi, onChangeEdit]);
  const [hoveredId, setHoveredId] = useState(null);
  const [, requestCoordinates] = useState(0);
  useEffect(() => coordinateApi?.subscribe?.(() => requestCoordinates(value => value + 1)), [coordinateApi]);
  const accepted = useMemo(() => projectV4AcceptedLevels({accountId,symbol,positions,pendingOrders}),
    [accountId,symbol,positions,pendingOrders]);
  const { preview: ghost, connector } = projectV4DraftGroup(accepted, edit);
  const acceptedWithCoordinates = coordinateApi?.priceToY
    ? accepted.map(level => ({...level,y:coordinateApi.priceToY(level.price)})).filter(level=>Number.isFinite(level.y))
    : [];
  const displayedLevels = acceptedWithCoordinates.filter(level => !(hidePositionEntries && level.objectType === 'position' && level.kind === 'entry'));
  const { placements, overflow } = placeV4Badges(displayedLevels, { minY: 14, maxY:height-14, badgeHeight:28, gap:5 });
  const placed = new Map(placements.map(level=>[level.id,level]));
  const colorFor = level => level.kind==='sl' ? COLORS.sl : level.kind==='tp' ? COLORS.tp
    : level.objectType==='position' && level.kind==='entry' ? COLORS.neutral
    : level.side==='BUY' ? COLORS.buy : COLORS.sell;
  const selected = removeLevel && accepted.find(level=>level.id===removeLevel);
  const canRemove = Boolean(onConfirmRemoval);
  const [cancelPendingId, setCancelPendingId] = useState(null);
  const beginDrag = (event, level) => {
    if (readOnly || !onBeginEdit || !onChangeEdit || saving || !coordinateApi?.yToPrice) return;
    if (!(level.objectType === 'pending' && level.kind === 'entry') && !['sl','tp'].includes(level.kind)) return;
    if (event.target.closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    const draft = { accountId:level.accountId, objectType:level.objectType,
      objectId:level.objectId, kind:level.kind, levelId:level.id, proposedPrice:level.price };
    drag.current = { draft, startY:event.clientY, startChartY:level.y, started:false };
    onBeginEdit(draft);
  };

  return <div className="pointer-events-none absolute inset-0 z-[36] overflow-hidden" data-v4-isolated-layer
    style={{ height }}>
    {displayedLevels.map(level=>{
      const color=colorFor(level);
      const location=placed.get(level.id);
      const groupId=level.accountId+':'+level.objectType+':'+level.objectId;
      const highlighted=hoveredId===groupId;
      const missing=level.objectType==='position' && level.kind==='entry' ? v4MissingProtections(accepted,level.id) : [];
      return <React.Fragment key={level.id}>
        <div data-v4-accepted-line={level.id} className="pointer-events-none absolute left-0 right-0 border-t"
          style={{top:level.y,borderColor:color,opacity:highlighted?1:0.7}}/>
        {location && <div data-v4-badge={level.id}
          onPointerDown={event=>beginDrag(event,level)} onMouseEnter={()=>setHoveredId(groupId)} onMouseLeave={()=>setHoveredId(null)}
          onFocus={()=>setHoveredId(groupId)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setHoveredId(null);}}
          className="pointer-events-auto absolute right-[148px] flex h-7 max-w-[calc(100%-162px)] items-center gap-1 overflow-hidden rounded-[5px] border bg-[#111419]/95 px-1.5 font-mono text-[10px] text-white shadow-lg"
          style={{top:location.badgeTop,borderColor:color,boxShadow:highlighted?'0 0 10px rgba(215,223,231,.18)':undefined}}>
          <span className="shrink-0 font-semibold" style={{color}}>{level.kind==='sl'?'Stop loss':level.kind==='tp'?'Take profit':level.side+' '+(level.objectType==='pending'?' '+(level.orderType||'').toUpperCase():'')}</span>
          {level.kind==='entry' && level.objectType==='position' && <span className="shrink-0 text-gray-300">{formatVolume?.(level.volume) ?? level.volume}</span>}
          {level.kind!=='entry' && <span className="shrink-0">{priceLabel(level.price,formatPrice)}</span>}
          {level.kind==='entry' && level.objectType==='position' && formatPnl && <span className="truncate" style={{color}}>{formatPnl(level.pnl)}</span>}
          {level.kind==='entry' && level.objectType==='position' && onSelectPosition && <button type="button" aria-label="Select position" onClick={()=>onSelectPosition(level.objectId)} className="shrink-0 px-1 text-gray-300">Select</button>}
          {level.kind==='entry' && level.objectType==='position' && onClosePosition && <button type="button" aria-label="Close position" onClick={()=>onClosePosition(level.objectId, 100)} className="shrink-0 px-1 text-gray-300">×</button>}
          {level.kind==='entry' && level.objectType==='pending' && onCancelPending && <button type="button" aria-label="Cancel pending order" onClick={()=>setCancelPendingId(level.id)} className="shrink-0 px-1 text-gray-300">×</button>}
          {missing.map(kind=><button key={kind} type="button" onClick={()=>onAddProtection?.(level.objectId,kind)}
            className="shrink-0 rounded-[3px] border border-gray-600 px-1" aria-label={`Add ${kind.toUpperCase()}`}>+{kind.toUpperCase()}</button>)}
          {(['sl','tp'].includes(level.kind) || (level.objectType==='pending' && level.kind==='entry'))&&onBeginEdit&&<button type="button" className="shrink-0 px-1"
            aria-label={`Edit ${level.kind.toUpperCase()}`} onClick={()=>onBeginEdit(v4ProtectionAction(accepted,level.id,'edit'))}>Edit</button>}
          {(['sl','tp'].includes(level.kind))&&canRemove&&<button type="button" aria-label={`Confirm removal of ${level.kind.toUpperCase()}`}
            className="shrink-0 px-1" onClick={()=>setRemoveLevel(level.id)}>×</button>}
        </div>}
        {location?.displaced && <div className="pointer-events-none absolute right-[140px] w-px bg-[#98a7b6]/70"
          style={{top:Math.min(level.y,location.badgeTop+14),height:Math.abs(level.y-(location.badgeTop+14))}}
          aria-hidden="true"/>}
      </React.Fragment>;
    })}
    {hoveredId && coordinateApi?.priceToY && (() => {
      const group=acceptedWithCoordinates.filter(level =>
        level.accountId+':'+level.objectType+':'+level.objectId===hoveredId);
      const entry=group.find(level=>level.kind==='entry');
      if (!entry) return null;
      return group.filter(level=>['tp','sl'].includes(level.kind)).map(level=>
        <div key={level.id} data-v4-confirmed-connector={level.id}
          className="pointer-events-none absolute right-[135px] border-l border-[#98a7b6]/35"
          style={{top:Math.min(entry.y,level.y),height:Math.abs(entry.y-level.y)}}/>);
    })()}
    {!readOnly && connector && coordinateApi?.priceToY && Number.isFinite(coordinateApi.priceToY(connector.fromPrice)) && Number.isFinite(coordinateApi.priceToY(connector.toPrice)) && <div
      data-v4-draft-connector={connector.objectId}
      className="pointer-events-none absolute right-[135px] border-l border-dotted border-[#a8b5bd]/60"
      style={{top:Math.min(coordinateApi.priceToY(connector.fromPrice),coordinateApi.priceToY(connector.toPrice)),
        height:Math.abs(coordinateApi.priceToY(connector.fromPrice)-coordinateApi.priceToY(connector.toPrice))}} />}
    {!readOnly && ghost && connector && coordinateApi?.priceToY && (() => {
      const y1=coordinateApi.priceToY(connector.fromPrice), y2=coordinateApi.priceToY(connector.toPrice);
      if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
      return <div data-v4-draft-shade={ghost.kind} className="pointer-events-none absolute left-[42%] right-[148px]" style={{
        top:Math.min(y1,y2),height:Math.abs(y1-y2),
        background:ghost.kind==='tp'?'rgba(22,134,95,0.12)':'rgba(175,55,70,0.12)'
      }}/>;
    })()}
    {!readOnly && ghost && coordinateApi?.priceToY && Number.isFinite(coordinateApi.priceToY(ghost.price)) && <div data-v4-preview={ghost.id}>
      <div className="absolute left-0 right-0 border-t border-dotted" style={{top:coordinateApi.priceToY(ghost.price),borderColor:colorFor(ghost)}}/>
      <div data-v4-draft-badge className="pointer-events-auto absolute right-[148px] flex h-7 max-w-[calc(100%-162px)] -translate-y-1/2 items-center gap-1 rounded-[5px] border bg-[#111419]/95 px-1.5 font-mono text-[10px] text-white shadow-lg"
        style={{top:coordinateApi.priceToY(ghost.price),borderColor:colorFor(ghost)}}>
        <span style={{color:colorFor(ghost)}}>{ghost.kind==='sl'?'Stop loss':ghost.kind==='tp'?'Take profit':'Pending entry'}</span>
        <span>{priceLabel(ghost.price,formatPrice)}</span>
        <div data-v4-chart-actions className="ml-1 flex shrink-0 items-center gap-1 whitespace-nowrap border-l border-white/15 pl-1" aria-label="Draft level actions">
          <button type="button" disabled={saving} aria-label="Discard chart edit" onClick={()=>onCancelEdit?.()} className="rounded border border-[#515b66] bg-[#14171c] px-2 py-1 text-[#e4e8ed]">Discard</button>
          <button type="button" disabled={saving || !onSaveEdit} aria-label="Confirm chart edit" onClick={()=>onSaveEdit?.(edit)} className="rounded px-2 py-1 font-semibold text-white disabled:opacity-50" style={{background:ghost.kind==='tp'?'#148968':ghost.kind==='sl'?'#bd4353':'#2469b5'}}>{saving?'Confirming…':'Confirm'}</button>
        </div>
      </div>
    </div>}
    {overflow.length>0&&<span className="pointer-events-auto absolute bottom-2 right-[148px] rounded bg-[#202329] px-2 py-1 text-[10px] text-gray-300"
      data-v4-overflow-count={overflow.length}>{overflow.length} more levels outside badge area</span>}
    {!readOnly && cancelPendingId && <div role="dialog" aria-modal="true" aria-label="Confirm cancel pending order"
      className="pointer-events-auto absolute bottom-3 right-[148px] z-[60] flex max-w-[300px] flex-col gap-2 rounded-md border border-gray-600 bg-[#111419] p-3 text-[11px] text-white">
      <span>Cancel this pending order?</span>
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={()=>setCancelPendingId(null)}>Discard</button>
        <button type="button" disabled={saving} onClick={()=>{ const item=accepted.find(level=>level.id===cancelPendingId); if(item) onCancelPending?.(item.objectId); setCancelPendingId(null); }}>Confirm cancellation</button>
      </div>
    </div>}
    {!readOnly && selected && <div role="dialog" aria-modal="true" aria-label={`Confirm remove ${selected.kind.toUpperCase()}`}
      className="pointer-events-auto absolute bottom-3 right-[148px] z-[60] flex max-w-[300px] flex-col gap-2 rounded-md border border-gray-600 bg-[#111419] p-3 text-[11px] text-white">
      <span>Remove {selected.kind.toUpperCase()} at {priceLabel(selected.price,formatPrice)}?</span>
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={()=>setRemoveLevel(null)}>Cancel</button>
        <button type="button" disabled={saving} onClick={()=>{onConfirmRemoval?.(v4ProtectionAction(accepted,selected.id,'remove'));setRemoveLevel(null);}}>Confirm removal</button>
      </div>
    </div>}
  </div>;
}
