import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  projectV4AcceptedLevels, projectV4DraftGroup, placeV4Badges,
  v4MissingProtections, v4ProtectionAction,
} from './chartOrderModel.js';
import { estimatePositionPnlAtPrice } from '../../../utils/tradingRisk.js';
import { chartEstimateCurrencySupported } from '../../../utils/chartOrderPresentation.js';

// An intentionally separate V4-only renderer: no imports from ChartArea or
// legacy plan/pending/position overlays. Future phases connect real chart
// coordinates and command handlers after authenticated staging acceptance.
const COLORS = Object.freeze({ sl:'#ee5465', tp:'#16c590', buy:'#17b899', sell:'#ee596a', neutral:'#aab6c2' });
const priceLabel = (value, formatPrice) => formatPrice ? formatPrice(value) : String(value);
// Keep the instrument's exact decimal precision while grouping large prices
// the same way as the approved TP/SL reference chip.
const protectionPriceLabel = (value, formatPrice) => {
  const label = String(priceLabel(value, formatPrice));
  const match = /^(-?)([0-9]+)([.][0-9]+)?$/.exec(label);
  return match
    ? match[1] + Number(match[2]).toLocaleString('en-US') + (match[3] || '')
    : label;
};

export default function V4ChartOrderLayer({
  accountId, symbol, positions = [], pendingOrders = [], coordinateApi,
  height = 480, formatPrice, formatVolume, formatPnl, instrument = null, accountCurrency = 'USD',
  hidePositionEntries = false, readOnly = false, hoveredPositionId = null,
  edit = null, saving = false, removingLevelId = null, onBeginEdit, onChangeEdit, onSaveEdit, onCancelEdit,
  onConfirmRemoval, onAddProtection, onSelectPosition, onClosePosition, onCancelPending,
}) {
  const drag = useRef(null);
  useEffect(() => { drag.current = null; }, [accountId, symbol, readOnly]);
  useEffect(() => {
    const onMove = event => {
      if (!drag.current || !coordinateApi?.yToPrice || !onChangeEdit) return;
      const dy = event.clientY - drag.current.startY;
      if (Math.abs(dy) < 4 && !drag.current.started) return;
      drag.current.started = true;
      const rawPrice = coordinateApi.yToPrice(drag.current.startChartY + dy);
      const tick = Number(instrument?.tickSize);
      const nextPrice = Number.isFinite(tick) && tick > 0
        ? Math.round(rawPrice / tick) * tick
        : rawPrice;
      if (Number.isFinite(nextPrice) && nextPrice > 0) {
        onChangeEdit({ ...drag.current.draft, proposedPrice: Number(nextPrice.toPrecision(12)) });
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
  }, [coordinateApi, onChangeEdit, instrument?.tickSize]);
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
  const projectedPositionProtection = level => {
    const position = positions.find(item => String(item.id) === String(level.objectId));
    const lots = Number(position?.volume ?? position?.lots);
    const volume = Number.isFinite(lots) ? String(Number(lots.toFixed(4))) : '—';
    const currency = String(accountCurrency || 'USD').toUpperCase();
    const estimate = chartEstimateCurrencySupported(instrument, currency)
      ? estimatePositionPnlAtPrice(position, level.price, instrument)
      : null;
    const amount = estimate == null || !Number.isFinite(estimate)
      ? '— ' + currency : (estimate >= 0 ? '+' : '-') + Math.abs(estimate).toFixed(2) + ' ' + currency;
    return { volume, amount };
  };
  const canRemove = Boolean(onConfirmRemoval);
  const [cancelPendingId, setCancelPendingId] = useState(null);
  const protectionTheme = kind => kind === 'tp'
    ? {background:'#09090b', positive:'rgba(22,197,144,0.17)'}
    : {background:'#09090b', positive:'rgba(238,84,101,0.17)'};
  const hoveredGroupId = hoveredId || (hoveredPositionId != null && accountId != null
    ? accountId + ':position:' + String(hoveredPositionId) : null);
  const beginDrag = (event, level, isPreview = false) => {
    if (readOnly || !onChangeEdit || saving || !coordinateApi?.yToPrice) return;
    if (!isPreview && !onBeginEdit) return;
    if (!(level.objectType === 'pending' && level.kind === 'entry') && !['sl','tp'].includes(level.kind)) return;
    if (event.button !== 0 || event.target.closest('button')) return;
    const levelY = coordinateApi.priceToY(level.price);
    if (!Number.isFinite(levelY)) return;
    event.preventDefault();
    event.stopPropagation();
    const draft = isPreview ? {
      accountId: level.accountId, objectType: level.objectType, objectId: level.objectId,
      kind: level.kind, levelId: level.sourceLevelId || undefined, ...edit,
      proposedPrice: level.price,
    } : {
      accountId: level.accountId, objectType: level.objectType,
      objectId: level.objectId, kind: level.kind, levelId: level.id, proposedPrice: level.price,
    };
    drag.current = { draft, startY:event.clientY, startChartY:levelY, started:false };
    if (!isPreview) onBeginEdit(draft);
  };

  return <div className="pointer-events-none absolute inset-0 z-[36] overflow-hidden" data-v4-isolated-layer
    style={{ height }}>
    {displayedLevels.map(level=>{
      const color=colorFor(level);
      const location=placed.get(level.id);
      const groupId=level.accountId+':'+level.objectType+':'+level.objectId;
      const highlighted=hoveredGroupId===groupId;
      const missing=level.objectType==='position' && level.kind==='entry' ? v4MissingProtections(accepted,level.id) : [];
      const marketProtection = level.objectType==='position' && ['sl','tp'].includes(level.kind);
      const editingAcceptedProtection = marketProtection && ghost?.sourceLevelId === level.id;
      const projection = marketProtection ? projectedPositionProtection(level) : null;
      const entryLevel = marketProtection ? accepted.find(value => value.objectType==='position' &&
        value.objectId===level.objectId && value.kind==='entry') : null;
      const percent = entryLevel && Number(entryLevel.price)>0
        ? Math.abs((level.price / entryLevel.price - 1) * 100).toFixed(2)+'%' : '—';
      return <React.Fragment key={level.id}>
        <div data-v4-accepted-line={level.id} className="pointer-events-none absolute left-0 right-0 border-t"
          style={{top:level.y,borderColor:color,opacity:highlighted?0.9:0.66}}/>
        {location && !editingAcceptedProtection && <div data-v4-badge={level.id}
          onPointerDown={event=>beginDrag(event,level)} onMouseEnter={()=>setHoveredId(groupId)} onMouseLeave={()=>setHoveredId(null)}
          onFocus={()=>setHoveredId(groupId)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setHoveredId(null);}}
          className={`pointer-events-auto absolute right-[148px] flex h-7 max-w-[calc(100%-162px)] items-center ${marketProtection ? 'gap-0 tabular-nums backdrop-blur-sm' : 'gap-1 bg-[#111419]/95 px-1.5'} overflow-hidden rounded-[5px] border font-mono text-[10px] text-white shadow-[0_3px_12px_rgba(0,0,0,.36)] transition-[box-shadow]`}
          style={{top:location.badgeTop,borderColor:marketProtection?color+'aa':color,
            backgroundColor:marketProtection?protectionTheme(level.kind).background:undefined,
            boxShadow:highlighted?'0 0 10px rgba(215,223,231,.12)':undefined}}>
          {marketProtection ? <>
            <span data-v4-drag-handle={level.id} aria-label={`Drag ${level.kind.toUpperCase()} level`}
              className="shrink-0 cursor-ns-resize touch-none px-1.5 text-[11px] tracking-[-2px] text-[#7c8994]" title={`Drag ${level.kind.toUpperCase()}`}>⠿</span>
            <span className="shrink-0 whitespace-nowrap font-sans text-[10px] font-semibold" style={{color}}>{level.kind==='tp'?'Take profit':'Stop loss'}</span>
            <span className="shrink-0 px-1.5 font-mono font-semibold tabular-nums text-[#e5ebf0]">{protectionPriceLabel(level.price,formatPrice)}</span>
            <span className="shrink-0 rounded-[3px] px-1.5 py-0.5 font-mono font-semibold tabular-nums" style={{color,backgroundColor:protectionTheme(level.kind).positive}}>{projection.amount}</span>
            <span className="shrink-0 pr-1.5 font-sans text-[9px] font-medium tabular-nums text-[#929ba4]">{percent}</span>
          </> : <span className="shrink-0 font-semibold" style={{color}}>{level.kind==='sl'?'Stop loss':level.kind==='tp'?'Take profit':level.side+' '+(level.objectType==='pending'?' '+(level.orderType||'').toUpperCase():'')}</span>}
          {level.kind==='entry' && level.objectType==='position' && <span className="shrink-0 text-gray-300">{formatVolume?.(level.volume) ?? level.volume}</span>}
          {level.kind!=='entry' && !marketProtection && <span className="shrink-0">{priceLabel(level.price,formatPrice)}</span>}
          {level.kind==='entry' && level.objectType==='position' && formatPnl && <span className="truncate" style={{color}}>{formatPnl(level.pnl)}</span>}
          {level.kind==='entry' && level.objectType==='position' && onSelectPosition && <button type="button" aria-label="Select position" onClick={()=>onSelectPosition(level.objectId)} className="shrink-0 px-1 text-gray-300">Select</button>}
          {level.kind==='entry' && level.objectType==='position' && onClosePosition && <button type="button" aria-label="Close position" onClick={()=>onClosePosition(level.objectId, 100)} className="shrink-0 px-1 text-gray-300">×</button>}
          {level.kind==='entry' && level.objectType==='pending' && onCancelPending && <button type="button" aria-label="Cancel pending order" onClick={()=>setCancelPendingId(level.id)} className="shrink-0 px-1 text-gray-300">×</button>}
          {missing.map(kind=><button key={kind} type="button" onClick={()=>onAddProtection?.(level.objectId,kind)}
            className="shrink-0 rounded-[3px] border border-gray-600 px-1" aria-label={`Add ${kind.toUpperCase()}`}>+{kind.toUpperCase()}</button>)}
          {(['sl','tp'].includes(level.kind) || (level.objectType==='pending' && level.kind==='entry'))&&onBeginEdit&&!marketProtection&&<button type="button" className="shrink-0 px-1"
            aria-label={`Edit ${level.kind.toUpperCase()}`} onClick={()=>onBeginEdit(v4ProtectionAction(accepted,level.id,'edit'))}>Edit</button>}
          {(['sl','tp'].includes(level.kind))&&canRemove&&<button type="button"
            aria-label={`Remove ${level.kind.toUpperCase()}`}
            title={removingLevelId===level.id ? 'Removing…' : `Remove ${level.kind.toUpperCase()}`}
            disabled={saving || Boolean(removingLevelId)}
            data-v4-remove-protection={level.id}
            className={marketProtection ? 'grid h-7 w-6 shrink-0 place-items-center border-l border-white/10 text-[#99a6b0] hover:bg-white/[0.06] hover:text-white disabled:cursor-wait disabled:opacity-50' : 'shrink-0 px-1 disabled:opacity-50'}
            onPointerDown={event=>event.stopPropagation()}
            onClick={event=>{
              event.stopPropagation();
              const action = v4ProtectionAction(accepted,level.id,'remove');
              if(action) onConfirmRemoval?.(action);
            }}>{removingLevelId===level.id ? '…' : '×'}</button>}
        </div>}
        {marketProtection && <div data-v4-accepted-protection-price={level.id}
          className="pointer-events-none absolute right-[56px] flex -translate-y-1/2 items-center gap-1.5 lg:right-2"
          style={{top:level.y}}>
          <span className="size-[6px] rounded-full border" style={{borderColor:color,backgroundColor:'#09090b'}}/>
          <span className="rounded-[4px] border bg-[#09090b]/95 px-1.5 py-0.5 font-mono text-[9px] font-semibold"
            style={{borderColor:color,color}}>{priceLabel(level.price,formatPrice)}</span>
        </div>}
        {location?.displaced && <div className="pointer-events-none absolute right-[140px] w-px bg-[#98a7b6]/70"
          style={{top:Math.min(level.y,location.badgeTop+14),height:Math.abs(level.y-(location.badgeTop+14))}}
          aria-hidden="true"/>}
      </React.Fragment>;
    })}
    {hoveredGroupId && coordinateApi?.priceToY && (() => {
      const group=acceptedWithCoordinates.filter(level =>
        level.accountId+':'+level.objectType+':'+level.objectId===hoveredGroupId);
      const entry=group.find(level=>level.kind==='entry');
      const protections=group.filter(level=>['tp','sl'].includes(level.kind));
      if (!entry || !protections.length) return null;
      const ys=[entry.y,...protections.map(level=>level.y)];
      return <div data-v4-hover-group={entry.objectId}
        className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div data-v4-confirmed-connector={entry.objectId}
          className="absolute right-[138px] w-px bg-[#b5c3ce]/75 shadow-[0_0_7px_rgba(195,214,229,.12)]"
          style={{top:Math.min(...ys),height:Math.max(...ys)-Math.min(...ys)}}/>
        {[entry,...protections].map(level=><div key={level.id}
          data-v4-hover-connector-point={level.kind}
          className="absolute right-[136px] size-[5px] -translate-y-1/2 rounded-full bg-[#b5c3ce]"
          style={{top:level.y}}/>)}
      </div>;
    })()}
    {!readOnly && connector && coordinateApi?.priceToY && Number.isFinite(coordinateApi.priceToY(connector.fromPrice)) && Number.isFinite(coordinateApi.priceToY(connector.toPrice)) && <div
      data-v4-draft-connector={connector.objectId}
      className="pointer-events-none absolute right-[135px] border-l border-dotted border-[#a8b5bd]/60"
      style={{top:Math.min(coordinateApi.priceToY(connector.fromPrice),coordinateApi.priceToY(connector.toPrice)),
        height:Math.abs(coordinateApi.priceToY(connector.fromPrice)-coordinateApi.priceToY(connector.toPrice))}} />}
    {!readOnly && ghost && coordinateApi?.priceToY && Number.isFinite(coordinateApi.priceToY(ghost.price)) && <div data-v4-preview={ghost.id}>
      <div className="absolute left-0 right-0 border-t border-dotted" style={{top:coordinateApi.priceToY(ghost.price),borderColor:colorFor(ghost)}}/>
      <div data-v4-draft-badge
        onPointerDown={event=>beginDrag(event,ghost,true)}
        className={`pointer-events-auto absolute right-[148px] flex h-7 max-w-[calc(100%-162px)] -translate-y-1/2 items-center rounded-[5px] border font-mono text-[10px] tabular-nums text-white shadow-[0_3px_12px_rgba(0,0,0,.36)] ${ghost.objectType==='position' ? 'gap-0 cursor-ns-resize touch-none border-dotted backdrop-blur-sm' : 'gap-1 cursor-ns-resize touch-none bg-[#111419]/95 px-1.5'}`}
        style={{top:coordinateApi.priceToY(ghost.price),borderColor:colorFor(ghost),
          backgroundColor:ghost.objectType==='position'?protectionTheme(ghost.kind).background:undefined}}>
        {ghost.objectType==='position' && ['tp','sl'].includes(ghost.kind) ? (() => {
          const projection = projectedPositionProtection(ghost);
          const entry = accepted.find(value => value.objectType==='position' &&
            value.objectId===ghost.objectId && value.kind==='entry');
          const percent = entry && Number(entry.price)>0
            ? Math.abs((ghost.price / entry.price - 1) * 100).toFixed(2)+'%' : '—';
          return <>
            <span data-v4-drag-handle="draft" aria-label={`Drag draft ${ghost.kind.toUpperCase()}`}
              className="shrink-0 cursor-ns-resize touch-none px-1.5 text-[11px] tracking-[-2px] text-[#7c8994]">⠿</span>
            <span className="shrink-0 whitespace-nowrap font-sans text-[10px] font-semibold" style={{color:colorFor(ghost)}}>{ghost.kind==='tp'?'Take profit':'Stop loss'}</span>
            <span className="shrink-0 px-1.5 font-mono font-semibold tabular-nums text-[#e5ebf0]">{protectionPriceLabel(ghost.price,formatPrice)}</span>
            <span className="shrink-0 rounded-[3px] px-1.5 py-0.5 font-mono font-semibold tabular-nums" style={{color:colorFor(ghost),backgroundColor:protectionTheme(ghost.kind).positive}}>{projection.amount}</span>
            <span className="shrink-0 pr-1.5 font-sans text-[9px] font-medium tabular-nums text-[#929ba4]">{percent}</span>
            <button type="button" aria-label="Discard protection draft" disabled={saving} onClick={()=>onCancelEdit?.()}
              className="grid h-7 w-6 shrink-0 place-items-center border-l border-white/10 text-[#9aa4ae] hover:bg-white/[0.06] disabled:opacity-50">×</button>
          </>;
        })() : <>
          <span style={{color:colorFor(ghost)}}>{ghost.kind==='sl'?'Stop loss':ghost.kind==='tp'?'Take profit':'Pending entry'}</span>
          <span>{priceLabel(ghost.price,formatPrice)}</span>
          <div data-v4-chart-actions data-v4-actions-location="draft" className="ml-1 flex shrink-0 items-center gap-1 whitespace-nowrap border-l border-white/15 pl-1" aria-label="Draft level actions">
            <button type="button" disabled={saving} aria-label="Discard chart edit" onClick={()=>onCancelEdit?.()} className="rounded border border-[#515b66] bg-[#14171c] px-2 py-1 text-[#e4e8ed]">Discard</button>
            <button type="button" disabled={saving || !onSaveEdit} aria-label="Confirm chart edit" onClick={()=>onSaveEdit?.(edit)} className="rounded px-2 py-1 font-semibold text-white disabled:opacity-50" style={{background:ghost.kind==='tp'?'#148968':ghost.kind==='sl'?'#bd4353':'#2469b5'}}>{saving?'Confirming…':'Confirm'}</button>
          </div>
        </>}
      </div>
      {ghost.objectType==='position' && <span data-v4-protection-draft-price
        className="pointer-events-none absolute right-[56px] -translate-y-1/2 rounded-[4px] border border-dotted bg-[#09090b]/96 px-1.5 py-0.5 font-mono text-[9px] font-semibold lg:right-2"
        style={{top:coordinateApi.priceToY(ghost.price),borderColor:colorFor(ghost),color:colorFor(ghost)}}>
        {priceLabel(ghost.price,formatPrice)}
      </span>}
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
  </div>;
}
