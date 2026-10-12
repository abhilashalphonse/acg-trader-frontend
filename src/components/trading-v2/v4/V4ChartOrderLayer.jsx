import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatInstrumentPrice } from '../../../utils/instrumentFormatting.js';
import { chartEntryReference, chartEstimateCurrencySupported, chartPriceChangePercent } from '../../../utils/chartOrderPresentation.js';
import { estimatePositionPnlAtPrice, estimateLossAtStopWithCosts, estimateStopRisk } from '../../../utils/tradingRisk.js';
import { effectiveTradePlan } from '../../../utils/tradePlanExecution.js';
import { v4AcceptedLevels, v4DraftLevels, v4LayoutBadges, v4ShowAcceptedBadge, v4ValidEditPrice } from './v4ChartOrderModel.js';

const money = (n,c='USD') => Number.isFinite(n)
  ? (n < 0 ? '−' : '+') + Math.abs(n).toFixed(2) + ' ' + c : null;
const lotsText = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US',{maximumFractionDigits:5}) : '—';
const instrumentCurrency = (instrument,level,fallback) =>
  level.position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || fallback;
const referencePrice = level => Number(level.position?.entry ?? level.position?.entryPrice
  ?? level.order?.limitPrice ?? level.order?.entry ?? level.plan?.entry);

function displayedPnl(level, instrument, account, currency) {
  if (level.field === 'entry' && level.owner === 'position')
    return money(Number(level.position?.pnl),instrumentCurrency(instrument,level,currency));
  if (!['sl','tp'].includes(level.field)) return null;
  const valueCurrency=instrumentCurrency(instrument,level,currency);
  if (!chartEstimateCurrencySupported(instrument,valueCurrency)) return null;
  if (level.owner === 'position')
    return money(estimatePositionPnlAtPrice(level.position,level.price,instrument),valueCurrency);
  const plan=level.order||level.plan;
  const lots=Number(plan?.volume ?? plan?.lots ?? plan?.manualLots);
  const entry=referencePrice(level);
  if (!(lots>0 && entry>0)) return null;
  const estimate=level.field === 'sl'
    ? estimateLossAtStopWithCosts({...plan,entry,sl:level.price},lots,instrument,account)
    : estimateStopRisk({...plan,entry,sl:level.price},lots,instrument,valueCurrency);
  return money(Number.isFinite(estimate) ? (level.field==='sl'?-Math.abs(estimate):Math.abs(estimate)) : NaN,valueCurrency);
}

function Badge({level,offset=0,instrument,account,currency,hovered,selected,
  onEnter,onExit,onDrag,onRemove,onChoose,onAdd}) {
  const side=String(level.side || '').toUpperCase();
  const isEntry=level.field==='entry';
  const owner=level.owner;
  const isDraft=owner==='draft'||owner==='protection-draft';
  const label=level.field==='sl'?'Stop loss':level.field==='tp'?'Take profit':
    level.field==='limitPrice'?'Limit':side+(owner==='pending'?' '+String(level.orderType||'').replace('-',' ').toUpperCase():'');
  const qty=Number(level.position?.volume ?? level.position?.lots ?? level.order?.volume
    ?? level.order?.lots ?? level.plan?.manualLots);
  const pnl=displayedPnl(level,instrument,account,currency);
  const percent=isEntry?null:chartPriceChangePercent(referencePrice(level),level.price);
  const color=level.color;
  const missing=isEntry
    ? ['tp','sl'].filter(field=>level.owner==='position'
      ? !(Number(level.position?.[field])>0)
      : level.owner==='pending'
        ? !(Number(level.order?.[field]??level.order?.[field==='sl'?'stopLoss':'takeProfit'])>0)
        : !(Number(level.plan?.[field])>0))
    : [];
  return <div
    data-v4-badge={level.key}
    data-v4-badge-owner={level.owner}
    data-v4-badge-state={isDraft?'draft':'accepted'}
    className={'pointer-events-auto absolute z-30 flex h-[27px] -translate-y-1/2 items-center gap-1 overflow-hidden rounded-[4px] border bg-[#111419]/95 pl-2 pr-7 font-mono text-[10px] font-semibold tabular-nums text-[#d6e0e8] shadow-[0_3px_12px_rgba(0,0,0,.32)] backdrop-blur-sm '+(hovered||selected?'ring-1 ring-white/30':'')}
    style={{top:offset,borderColor:color+'a5',left:'max(8px, calc(100% - 406px))',maxWidth:'min(258px, calc(100% - 162px))'}}
    role="group" tabIndex={0} aria-label={label+' '+formatInstrumentPrice(level.price,instrument)}
    onMouseEnter={()=>onEnter(level)} onMouseLeave={onExit}
    onFocus={()=>onEnter(level)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))onExit();}}
    onPointerDown={event=>{if(!event.target.closest('button'))onDrag(event,level);}}
    onClick={event=>{event.stopPropagation();onChoose(level);}}>
    <span aria-hidden="true" className="shrink-0 text-[#8996a0]">⠿</span>
    {missing.map(field=><button key={field} type="button"
      className="shrink-0 rounded-[3px] border border-white/20 px-1 py-0.5 text-[9px] text-[#b0bac2]"
      aria-label={'Add '+field.toUpperCase()+' to '+label}
      onPointerDown={e=>e.stopPropagation()}
      onClick={e=>{e.stopPropagation();onAdd(level,field);}}>+{field.toUpperCase()}</button>)}
    <span className="shrink-0 font-sans" style={{color:isEntry&&owner==='position'?'#d8dfe5':color}}>{label}</span>
    {isEntry&&qty>0&&<span className="shrink-0">{lotsText(qty)}</span>}
    <span className="shrink-0">{formatInstrumentPrice(level.price,instrument)}</span>
    {pnl&&<span className="min-w-0 truncate rounded-[3px] px-1 py-0.5" style={{color,backgroundColor:color+'19'}}>{pnl}</span>}
    {Number.isFinite(percent)&&<span className="min-w-0 truncate font-sans text-[#9eabb5]">{percent.toFixed(2)}%</span>}
    <button type="button" aria-label={isDraft?'Cancel draft':isEntry?'Close or cancel order':'Remove '+label}
      className="absolute right-1 top-1/2 z-20 grid size-5 -translate-y-1/2 place-items-center rounded text-[#aeb8c2] hover:bg-white/10"
      onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onRemove(level);}}>×</button>
  </div>;
}

function Review({level,price,instrument,saving,error,onSave,onCancel}) {
  return <div className="pointer-events-auto absolute right-[148px] top-[18px] z-[90] flex items-center gap-1 rounded-[5px] border border-white/20 bg-[#171c22] p-1 shadow-xl"
    role="group" aria-label={'Review '+level.field+' edit'}>
    <span className="px-1 text-[10px] text-[#d1dbe2]">{formatInstrumentPrice(price,instrument)}</span>
    <button type="button" disabled={saving} className="rounded bg-[#f0f2f4] px-2 py-1 text-[10px] font-bold text-black disabled:opacity-50" onClick={onSave}>{saving?'Saving…':'Save'}</button>
    <button type="button" disabled={saving} className="rounded border border-white/25 px-2 py-1 text-[10px] text-white" onClick={onCancel}>Cancel</button>
    {error&&<span role="alert" className="absolute right-0 top-full w-[210px] rounded bg-[#57202b] p-2 text-[10px] text-white">{error}</span>}
  </div>;
}

function RemovalConfirm({level,busy,error,onConfirm,onCancel}) {
  const label=level.field==='sl'?'Stop loss':'Take profit';
  return <div className="pointer-events-auto absolute inset-0 z-[100] flex items-center justify-center bg-black/55 p-3">
    <div role="dialog" aria-modal="true" aria-label="Confirm protection removal" className="w-full max-w-[310px] rounded-lg border border-[#38434c] bg-[#171c22] p-4 shadow-2xl">
      <h3 className="text-[13px] font-semibold text-white">Remove {label}?</h3>
      <p className="mt-2 text-[11px] leading-5 text-[#b5c0c9]">The confirmed protection stays active until the trading server accepts its removal.</p>
      {error&&<p role="alert" className="mt-2 text-[11px] text-[#f1818c]">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onCancel} className="rounded border border-white/25 px-3 py-1.5 text-[11px] text-white">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm} className="rounded bg-[#b82f42] px-3 py-1.5 text-[11px] font-semibold text-white">{busy?'Removing…':'Confirm removal'}</button>
      </div>
    </div>
  </div>;
}

// Standalone desktop V4 layer. No legacy chart-order visual component imports.
export default function V4ChartOrderLayer({
  symbol,coordinateApi,instrument,positions=[],pendingOrders=[],tradePlan=null,
  positionProtectionDraft=null,selectedPositionId=null,account=null,accountCurrency='USD',
  onTradePlanChange,onCancelTradePlan,onModifyPending,onMovePending,onCancelPending,
  onUpdatePosition,onRemovePositionProtection,onRequestPositionProtection,
  onPositionProtectionDraftChange,onCancelPositionProtection,onApplyPositionProtection,
  onSelectPosition,onClosePosition,positionProtectionSaving=false,
}) {
  const root=useRef(null);
  const dragging=useRef(null);
  const suppressClick=useRef(false);
  const [height,setHeight]=useState(0);
  const [edit,setEdit]=useState(null);
  const [removal,setRemoval]=useState(null);
  const [hover,setHover]=useState(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const [,revision]=useState(0);
  const accountId=account?.id??account?.accountId;
  useEffect(()=>{
    if(!coordinateApi?.subscribe)return;
    return coordinateApi.subscribe(()=>revision(v=>v+1));
  },[coordinateApi]);
  useEffect(()=>{
    const el=root.current;
    if(!el)return;
    const update=()=>setHeight(el.clientHeight);
    update();
    const obs=new ResizeObserver(update);
    obs.observe(el);
    return ()=>obs.disconnect();
  },[]);
  useEffect(()=>{
    dragging.current=null;setEdit(null);setRemoval(null);setHover(null);setError(null);setSaving(false);
  },[symbol,accountId]);

  const accepted=useMemo(()=>v4AcceptedLevels({positions,pendingOrders,symbol}),[positions,pendingOrders,symbol]);
  const effectiveEntry=tradePlan&&!tradePlan.pending?effectiveTradePlan(tradePlan,instrument)?.entry:null;
  const drafts=useMemo(()=>v4DraftLevels({tradePlan,positionProtectionDraft,symbol,effectiveEntry}),
    [tradePlan,positionProtectionDraft,symbol,effectiveEntry]);
  const levels=[...accepted,...drafts],byKey=new Map(levels.map(level=>[level.key,level]));
  const active=edit?byKey.get(edit.key):null;
  const allVisible=levels.filter(level=>coordinateApi?.priceToY&&Number.isFinite(coordinateApi.priceToY(level.price)));
  const visible=allVisible.filter(level=>v4ShowAcceptedBadge(level,{edit,tradePlan,positionProtectionDraft}));
  const forLayout=visible.map(level=>({...level,y:coordinateApi.priceToY(level.price)}));
  if(edit&&active&&v4ValidEditPrice(edit.price)!=null)forLayout.push({...active,key:'preview:'+active.key,y:coordinateApi.priceToY(edit.price)});
  const layout=v4LayoutBadges(forLayout,height);
  const offsets=new Map(layout.map(item=>[item.key,item.deltaY]));

  useEffect(()=>{
    const priceFrom=event=>{
      const box=root.current?.getBoundingClientRect();
      return box&&coordinateApi?.yToPrice?v4ValidEditPrice(coordinateApi.yToPrice(event.clientY-box.top)):null;
    };
    const move=event=>{
      const drag=dragging.current;
      if(!drag||(event.pointerId!=null&&drag.pointerId!==event.pointerId))return;
      if(!drag.moved&&Math.abs(event.clientY-drag.startY)<5)return;
      const price=priceFrom(event);
      if(price==null)return;
      drag.moved=true;
      event.preventDefault();
      setEdit({key:drag.key,price,status:'dragging'});
    };
    const finish=(event,cancel)=>{
      const drag=dragging.current;
      if(!drag||(event.pointerId!=null&&drag.pointerId!==event.pointerId))return;
      dragging.current=null;
      if(!drag.moved)return;
      suppressClick.current=true;
      const price=cancel?null:priceFrom(event);
      setEdit(price==null?null:{key:drag.key,price,status:'review'});
      setError(null);
    };
    const up=event=>finish(event,false),cancel=event=>finish(event,true);
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',cancel);
    return ()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);};
  },[coordinateApi]);

  useEffect(()=>{
    const handle=event=>{
      if(event.key==='Escape'&&!saving){setEdit(null);setRemoval(null);setError(null);}
    };
    window.addEventListener('keydown',handle);
    return ()=>window.removeEventListener('keydown',handle);
  },[saving]);

  const startDrag=(event,level)=>{
    if(saving||removal||edit?.status==='review'||event.button>0)return;
    // An accepted position entry is immutable; it can be selected or closed, not dragged.
    if(level.owner==='position'&&level.field==='entry')return;
    event.preventDefault();event.stopPropagation();
    dragging.current={key:level.key,startY:event.clientY,pointerId:event.pointerId,moved:false};
  };
  const choose=level=>{
    if(suppressClick.current){suppressClick.current=false;return;}
    if(level.owner==='position')onSelectPosition?.(level.ownerId);
    if(level.owner==='pending'&&level.field==='entry')onModifyPending?.(level.ownerId);
  };
  const add=(level,field)=>{
    if(level.owner==='position')onRequestPositionProtection?.(level.ownerId,field);
    else if(level.owner==='pending')onModifyPending?.(level.ownerId,field);
    else if(level.owner==='draft')onTradePlanChange?.({activeField:field});
  };
  const remove=level=>{
    if(['sl','tp'].includes(level.field)&&level.accepted){
      setRemoval({key:level.key});setError(null);return;
    }
    if(level.owner==='protection-draft')onCancelPositionProtection?.();
    else if(level.owner==='draft'){
      if(level.field==='entry')onCancelTradePlan?.();
      else onTradePlanChange?.({[level.field]:null,stage:'ready'});
    } else if(level.owner==='pending'&&level.field==='entry')onCancelPending?.(level.ownerId);
    else if(level.owner==='position'&&level.field==='entry')onClosePosition?.(level.ownerId,100);
  };
  const save=async()=>{
    const level=active,price=v4ValidEditPrice(edit?.price);
    if(!level||price==null||saving)return;
    setSaving(true);setError(null);
    try{
      let result=true;
      if(level.owner==='position') {
        if(!['sl','tp'].includes(level.field))throw Error('A position entry cannot be moved.');
        if(typeof onUpdatePosition!=='function')throw Error('Protection update is not connected.');
        result=await onUpdatePosition(level.ownerId,{[level.field]:price});
      } else if(level.owner==='pending'){
        if(typeof onMovePending!=='function')throw Error('Pending-order amendment is not connected.');
        result=await onMovePending(level.ownerId,price,level.field);
      } else if(level.owner==='protection-draft')onPositionProtectionDraftChange?.({[level.field]:price,stage:'ready'});
      else if(level.owner==='draft')onTradePlanChange?.({[level.field]:price,stage:'ready'});
      if(result===false)throw Error('The command was not accepted. The original solid price remains active.');
      // Solid lines are fed only by server snapshots, never the edit price.
      setEdit(null);
    }catch(err){setError(err?.message||'Update failed.');}
    finally{setSaving(false);}
  };
  const confirmRemove=async()=>{
    const level=removal?byKey.get(removal.key):null;
    if(!level||saving)return;
    setSaving(true);setError(null);
    try{
      let result=false;
      if(level.owner==='position'&&typeof onRemovePositionProtection==='function')
        result=await onRemovePositionProtection(level.ownerId,level.field);
      if(level.owner==='pending'&&typeof onMovePending==='function')
        result=await onMovePending(level.ownerId,null,level.field);
      if(result===false)throw Error('Removal was rejected. The confirmed protection stays active.');
      setRemoval(null);
    }catch(err){setError(err?.message||'Removal failed.');}
    finally{setSaving(false);}
  };
  const hoverPosition=hover?.owner==='position'?hover.ownerId:null;
  const related=hoverPosition?accepted.filter(level=>level.owner==='position'&&level.ownerId===hoverPosition):[];
  const ys=related.map(level=>coordinateApi?.priceToY?.(level.price)).filter(Number.isFinite);
  // Subtle accepted risk/reward shading from a single selected/hovered group.
  // Multiple positions never paint several competing full-chart risk zones.
  const matchedPositions=positions.filter(p=>String(p?.symbol||'').toUpperCase()===String(symbol||'').toUpperCase());
  const selected=matchedPositions.find(p=>String(p.id)===String(hoverPosition || selectedPositionId))
    || (matchedPositions.length===1?matchedPositions[0]:null);
  const zoneSource=selected
    ? { entry:selected.entry??selected.entryPrice,sl:selected.sl,tp:selected.tp }
    : tradePlan && !tradePlan.open && String(tradePlan.symbol||'').toUpperCase()===String(symbol||'').toUpperCase()
      ? {entry:chartEntryReference(tradePlan),sl:tradePlan.sl,tp:tradePlan.tp}
      : null;
  const zoneReference=v4ValidEditPrice(zoneSource?.entry);
  const zoneReferenceY=zoneReference!=null?coordinateApi?.priceToY?.(zoneReference):null;
  const shadeZones=zoneReferenceY!=null&&Number.isFinite(zoneReferenceY)
    ? ['sl','tp'].map(field=>{
      const price=v4ValidEditPrice(zoneSource?.[field]);
      const y=price!=null?coordinateApi?.priceToY?.(price):null;
      if(!Number.isFinite(y))return null;
      return {field,top:Math.min(y,zoneReferenceY),height:Math.abs(y-zoneReferenceY)};
    }).filter(Boolean)
    : [];
  if(!coordinateApi?.priceToY)return null;
  return <div ref={root} data-v4-independent-order-layer
    className="pointer-events-none absolute inset-0 z-[40] overflow-hidden">
    {shadeZones.map(zone=><div key={zone.field} data-v4-risk-zone={zone.field}
      aria-hidden="true" className="pointer-events-none absolute left-[44%] right-[140px] z-0"
      style={{top:zone.top,height:zone.height,
        background:zone.field==='sl'?'rgba(183,50,65,0.13)':'rgba(23,137,103,0.12)'}}/>)}
    {allVisible.map(level=>{
      const y=coordinateApi.priceToY(level.price),color=level.color;
      const show=v4ShowAcceptedBadge(level,{edit,tradePlan,positionProtectionDraft});
      const group=hoverPosition&&level.owner==='position'&&level.ownerId===hoverPosition;
      const offset=offsets.get(level.key)||0;
      return <div key={level.key} data-v4-price-line={level.key} data-v4-line-state={level.accepted?'solid':'dotted'}
        className="pointer-events-none absolute left-0 right-0" style={{top:y,zIndex:level.accepted?20:30}}>
        <div className={'relative border-t '+(level.accepted?'border-solid':'border-dotted')}
          style={{borderColor:color,boxShadow:group?'0 0 8px '+color+'90':undefined}}>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[3px] border bg-[#22272d] px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-white"
            style={{borderColor:color+'90'}}>{formatInstrumentPrice(level.price,instrument)}</span>
          {show&&<Badge level={level} offset={offset} instrument={instrument} account={account} currency={accountCurrency}
            hovered={Boolean(group)} selected={level.owner==='position'&&String(selectedPositionId)===level.ownerId}
            onEnter={setHover} onExit={()=>setHover(null)} onDrag={startDrag} onChoose={choose}
            onAdd={add} onRemove={remove}/>}
          {show&&Math.abs(offset)>2&&<div aria-hidden="true" className="pointer-events-none absolute right-[141px] w-px bg-[#b7c5d1]/75" style={{top:Math.min(0,offset),height:Math.abs(offset)}}/>}
        </div>
      </div>;
    })}
    {active&&edit&&v4ValidEditPrice(edit.price)!=null&&(()=>{
      const y=coordinateApi.priceToY(edit.price);
      return Number.isFinite(y)?<div data-v4-edit-preview={active.key}
        className="pointer-events-none absolute left-0 right-0 z-[60]" style={{top:y}}>
        <div className="relative border-t-2 border-dotted" style={{borderColor:active.color}}>
          <Badge level={{...active,price:edit.price,accepted:false,key:'preview:'+active.key}}
            offset={offsets.get('preview:'+active.key)||0} instrument={instrument} account={account}
            currency={accountCurrency} onEnter={()=>{}} onExit={()=>{}} onDrag={()=>{}}
            onRemove={()=>setEdit(null)} onChoose={()=>{}} onAdd={()=>{}}/>
          {edit.status==='review'&&<Review level={active} price={edit.price} instrument={instrument}
            saving={saving} error={error} onSave={save} onCancel={()=>{setEdit(null);setError(null);}}/>}
        </div>
      </div>:null;
    })()}
    {positionProtectionDraft?.source==='open-position'&&!edit&&drafts.some(x=>x.owner==='protection-draft')&&(()=>{
      const level=drafts.find(x=>x.owner==='protection-draft');
      const y=coordinateApi.priceToY(level.price);
      return Number.isFinite(y)?<div className="pointer-events-none absolute left-0 right-0 z-[65]" style={{top:y}}>
        <Review level={level} price={level.price} instrument={instrument}
          saving={positionProtectionSaving} onSave={()=>onApplyPositionProtection?.()}
          onCancel={()=>onCancelPositionProtection?.()}/>
      </div>:null;
    })()}
    {ys.length>1&&<div data-v4-hover-group={hoverPosition} className="pointer-events-none absolute inset-0 z-[45]" aria-hidden="true">
      <div className="absolute right-[138px] w-px bg-[#b7c5d1]/75" style={{top:Math.min(...ys),height:Math.max(...ys)-Math.min(...ys)}}/>
      {ys.map((y,i)=><div key={i} className="absolute right-[138px] h-px w-3 bg-[#b7c5d1]/75" style={{top:y}}/>)}
    </div>}
    {removal&&byKey.get(removal.key)&&<RemovalConfirm level={byKey.get(removal.key)}
      busy={saving} error={error} onConfirm={confirmRemove}
      onCancel={()=>{setRemoval(null);setError(null);}}/>}
  </div>;
}
