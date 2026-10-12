import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, X } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import { ProtectionCard } from './DesktopOrderTicketV4.jsx';
import { formatInstrumentPrice } from '../../../utils/instrumentFormatting.js';
import { estimateRequiredMargin } from '../../../utils/tradingRisk.js';
import { defaultPlannerStopDistance } from '../../../utils/tradingRisk.js';
import { normalizeProtectionPrice } from '../../../utils/tradingCommandNormalization.js';
import './DesktopManagePositionV4.css';

// Placed pending order management only. New Limit/Stop-Limit planning remains
// entirely owned by the unchanged new-order execution ticket.
const positive=v=>v!=null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const typeName=t=>String(t||'limit').toLowerCase().replaceAll('_','-');
const pretty=n=>Number.isFinite(Number(n))&&n!=null?Number(n).toLocaleString('en-US',{maximumFractionDigits:4}):'—';
const sourcePrice=(o,k)=>k==='sl'?o.sl??o.stopLoss:k==='tp'?o.tp??o.takeProfit:o[k];
export default function DesktopManagePendingV4({
  order, instrument, account={}, draft=null, onDraftChange=()=>{},
  onDiscard=()=>{}, onMovePending=async()=>false, onCancelPending=async()=>false,
  onDismiss=()=>{}, onNotice=()=>{}, readOnly=false,
}) {
  const [busy,setBusy]=useState(false);
  const [waiting,setWaiting]=useState(null);
  const [error,setError]=useState('');
  const [cancelConfirmation,setCancelConfirmation]=useState(false);
  const [advanced,setAdvanced]=useState(false);
  const [slUnit,setSlUnit]=useState('price');
  const [tpUnit,setTpUnit]=useState('price');
  const type=typeName(order?.orderType||order?.type);
  const stopLimit=type==='stop-limit';
  const side=String(order?.side||'').toUpperCase();
  const entry=positive(order?.entry??order?.stopPrice);
  const limit=positive(order?.limitPrice);
  const execution=stopLimit ? limit : entry;
  const volume=positive(order?.volume??order?.lots);
  const matched=draft?.objectType==='pending' && String(draft.objectId)===String(order?.id) &&
    String(draft.accountId)===String(account?.id);
  const active=matched?draft:null;
  const level=(kind)=>active?.kind===kind?active.proposedPrice:sourcePrice(order,kind);
  const sl=positive(level('sl')),tp=positive(level('tp'));
  const margin=positive(estimateRequiredMargin(execution,volume,instrument,account));
  const working=busy||Boolean(waiting);
  const status=String(order?.status||'PENDING').toUpperCase();
  const plan={side:side.toLowerCase(),entry:execution,sl,tp,symbol:order?.symbol,pending:true,
    sizingMode:'lots',manualLots:volume};
  useEffect(()=>{setBusy(false);setWaiting(null);setError('');setCancelConfirmation(false);},[order?.id,account?.id]);

  useEffect(()=>{
    if(!waiting)return;
    const accepted=positive(sourcePrice(order,waiting.kind));
    const tick=positive(instrument?.tickSize)||1e-8;
    const expectedLimit=waiting.expectedLimitPrice;
    const limitConfirmed=expectedLimit==null||Math.abs(Number(order?.limitPrice)-expectedLimit)<=tick*.51;
    if(accepted!=null&&Math.abs(accepted-waiting.price)<=tick*.51&&limitConfirmed){
      setWaiting(null);setBusy(false);setError('');onDiscard();
    }
  },[order,waiting,instrument?.tickSize,onDiscard]);
  useEffect(()=>{
    if(!waiting)return undefined;
    const id=window.setTimeout(()=>{
      setWaiting(null);setBusy(false);
      setError('The accepted order has not confirmed the amendment. The original price is unchanged; refresh before retrying.');
    },12000);
    return()=>window.clearTimeout(id);
  },[waiting]);

  const propose=(kind,raw)=>{
    if(working||readOnly||status!=='PENDING')return;
    const next=positive(raw);
    if(next==null)return;
    const price=Number(next.toPrecision(12));
    const source=positive(sourcePrice(order,kind));
    if(source!=null&&Math.abs(price-source)<(positive(instrument?.tickSize)||1e-8)*.5){
      onDiscard();return;
    }
    onDraftChange({accountId:String(account.id),objectType:'pending',
      objectId:String(order.id),kind,proposedPrice:price,
      levelId:source==null?undefined:String(account.id)+':pending:'+order.id+':'+kind});
    setError('');
  };
  const switchProtection=(kind)=>{
    if(working||readOnly)return;
    if(positive(sourcePrice(order,kind))!=null){
      setBusy(true);setError('');
      Promise.resolve(onMovePending(order.id,null,kind)).then(ok=>{
        if(ok===false||ok==null)setError('Removal was not accepted. The original protection remains.');
      }).catch(e=>setError(e?.message||'Could not remove protection.'))
        .finally(()=>setBusy(false));
      return;
    }
    const distance=defaultPlannerStopDistance(instrument,execution);
    if(!distance||!execution)return;
    const direction=(side==='BUY'?1:-1)*(kind==='tp'?1:-1);
    const price=normalizeProtectionPrice(execution+direction*distance*(kind==='tp'?2:1),instrument,side,kind);
    propose(kind,price);
  };
  const confirm=async()=>{
    if(!active||working||readOnly)return;
    const kind=active.kind;
    const price=positive(active.proposedPrice);
    if(!price){setError('Enter a valid level price.');return;}
    const before=positive(sourcePrice(order,kind));
    setBusy(true);setError('');
    try{
      const ok=await onMovePending(order.id,price,kind);
      if(ok===false||ok==null){setBusy(false);setError('Order modification was not accepted.');return;}
      const expectedLimitPrice=stopLimit&&kind==='entry'&&before!=null&&limit!=null
        ? Number((limit+price-before).toPrecision(12)):null;
      setWaiting({kind,price,expectedLimitPrice});
    }catch(e){setBusy(false);setError(e?.message||'Could not modify the pending order.');}
  };
  const cancelOrder=async()=>{
    if(!cancelConfirmation||working||readOnly)return;
    setBusy(true);setError('');
    try{
      const ok=await onCancelPending(order.id);
      if(ok===false){setError('Order cancellation was not accepted.');return;}
      setCancelConfirmation(false);
      onDismiss();
    }catch(e){setError(e?.message||'Could not cancel the order.');}
    finally{setBusy(false);}
  };
  const exit=()=>{if(working)return;onDiscard();onDismiss();};
  return <section className="v4-ticket v4-live-scope v4-manage-position v4-manage-pending"
    data-v4-manage-pending={String(order.id)} aria-label="Manage pending order">
    <div className="v4-ticket-body">
      <div className="v4-instrument">
        <span className="shrink-0"><InstrumentAvatar instrument={instrument} size={32}/></span>
        <div className="v4-symbol"><strong>{instrument?.displaySymbol||order.symbol}</strong>
          <span>{side} · {type.toUpperCase().replace('-',' ')} · Pending</span></div>
        <div className="v4-head-actions">
          <button type="button" aria-label="Back to new order" onClick={exit} disabled={working}><ArrowLeft size={18}/></button>
          <button type="button" aria-label="Close pending editor" onClick={exit} disabled={working}><X size={19}/></button>
        </div>
      </div>
      <div className="v4-session"><span><i className="v4-manage-live-indicator"/>Order pending</span>
        <span>{side} · {status}</span></div>
      <div className="v4-quote-strip" aria-label="Pending order prices">
        <span>Entry / Trigger <strong>{formatInstrumentPrice(entry,instrument)}</strong></span>
        <span>{stopLimit?'Limit price':'Type'} <strong>{stopLimit?formatInstrumentPrice(limit,instrument):'LIMIT'}</strong></span>
        <span>Status <strong>{status}</strong></span>
      </div>
      <div className="v4-capsule v4-mainmodes v4-order-types v4-manage-modes" role="group">
        <span className="v4-capsule-button selected">Pending Order</span>
        <button type="button" className="v4-capsule-button" onClick={exit} disabled={working}>New Order</button>
      </div>
      <div className="v4-position v4-block">
        <div className="v4-section-heading"><span>PENDING ORDER</span><span>{type.toUpperCase().replace('-',' ')}</span></div>
        <div className="v4-manage-position-values">
          <div className="v4-manage-position-size"><span className="v4-manage-stat-label">ORDER SIZE</span>
            <div className="v4-manage-size-value">{pretty(volume)} <small>lots</small></div></div>
          <div className="v4-manage-position-pnl"><span className="v4-manage-stat-label">ENTRY / TRIGGER</span>
            <strong>{formatInstrumentPrice(entry,instrument)}</strong></div>
        </div>
      </div>
      <div className="v4-block">
        <div className="v4-section-heading"><span>ORDER PRICES</span><span>{active?'Unsaved draft':'Confirmed'}</span></div>
        {[{kind:'entry',name:stopLimit?'Stop trigger':'Limit entry'},
          ...(stopLimit?[{kind:'limitPrice',name:'Limit boundary'}]:[])].map(field=>
          <label key={field.kind} className="v4-manage-order-price">
            <span>{field.name}</span>
            <input type="number" step="any" aria-label={field.name+' price'} disabled={readOnly||working}
              value={active?.kind===field.kind?active.proposedPrice:sourcePrice(order,field.kind)??''}
              onChange={e=>propose(field.kind,e.target.value)}/>
          </label>)}
      </div>
      <div className="v4-exits v4-block">
        <div className="v4-section-heading"><span>EXITS / PROTECTION</span><ChevronUp size={15}/></div>
        <ProtectionCard field="sl" active={sl!=null} disabled={readOnly||working}
          onToggle={()=>switchProtection('sl')} unit={slUnit} onUnit={setSlUnit} plan={plan}
          market={instrument} account={account} lots={volume} sizingMode="lots"
          onPrice={price=>propose('sl',price)} onNotice={onNotice}/>
        <ProtectionCard field="tp" active={tp!=null} disabled={readOnly||working}
          onToggle={()=>switchProtection('tp')} unit={tpUnit} onUnit={setTpUnit} plan={plan}
          market={instrument} account={account} lots={volume} sizingMode="lots"
          onPrice={price=>propose('tp',price)} onNotice={onNotice}/>
        <div className="v4-ratio-slab">
          <div><span>Order status</span><strong>{status}</strong></div>
          <div><span>Estimated margin on fill</span><strong>{margin==null?'—':margin.toFixed(2)+' '+(account.currency||'USD')}</strong></div>
        </div>
      </div>
      <div className="v4-block">
        <button type="button" className="v4-disclosure" aria-expanded={advanced}
          onClick={()=>setAdvanced(v=>!v)}>ORDER ACTIONS {advanced?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>
        {advanced&&<div className="v4-advanced-content"><div><span>Order type</span><strong>{type.toUpperCase().replace('-',' ')}</strong></div>
          <div><span>Status</span><strong>{status}</strong></div></div>}
      </div>
      {error&&<div role="alert" className="v4-notice">{error}</div>}
      {waiting&&<div role="status" className="v4-notice">Waiting for confirmed order price…</div>}
    </div>
    <div className="v4-execution-footer v4-manage-footer">
      <div className="v4-margin-summary"><div><span>Order size</span><strong>{pretty(volume)} lots</strong></div>
        <div><span>Estimated margin on fill</span><strong>{margin==null?'—':margin.toFixed(2)+' '+(account.currency||'USD')}</strong></div></div>
      <div className="v4-trade-actions v4-manage-trade-actions">
        {active?<><button type="button" className="v4-manage-discard" disabled={working}
          onClick={()=>{onDiscard();setError('');}}>Discard</button>
          <button type="button" className="v4-manage-confirm" disabled={working||readOnly}
            onClick={confirm}>{working?'Confirming…':'Confirm'}</button></>:
          <button type="button" className="v4-manage-close" disabled={working||readOnly||status!=='PENDING'}
            onClick={()=>setCancelConfirmation(true)}>Cancel Order</button>}
      </div>
      {cancelConfirmation&&<div role="dialog" aria-label="Confirm order cancellation" className="v4-manage-close-dialog">
        <span>Cancel this pending order?</span>
        <div><button type="button" disabled={working} onClick={()=>setCancelConfirmation(false)}>Keep Order</button>
          <button type="button" disabled={working} onClick={cancelOrder}>Cancel Order</button></div>
      </div>}
    </div>
  </section>;
}
