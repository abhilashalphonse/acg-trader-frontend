import React, { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { formatInstrumentPrice } from '../../../utils/instrumentFormatting.js';
import { estimatePositionPnlAtPrice } from '../../../utils/tradingRisk.js';
import { validateOpenPositionProtection } from '../../../utils/openPositionPresentation.js';
import { ProtectionCard } from './DesktopOrderTicketV4.jsx';

// Mounted INSTEAD OF the new-order editor in the same V4 trade sidebar.
// No Buy/Sell buttons or synthetic positions. All writes flow through the
// existing position draft and server-authoritative update callbacks.
const valid = value => value !== null && value !== undefined && value !== '' &&
  Number.isFinite(Number(value)) && Number(value)>0 ? Number(value) : null;
const number = (value, digits=2) => Number.isFinite(Number(value)) && value != null
  ? Number(value).toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
const signed = (value,currency) => Number.isFinite(Number(value)) && value != null
  ? (Number(value)>=0?'+':'−')+number(Math.abs(Number(value)))+' '+currency : '—';

export default function DesktopManagePositionV4({
  position, instrument, account = {}, protectionDraft, protectionSaving=false,
  onBeginProtection=()=>false, onProtectionDraftChange=()=>{},
  onApplyProtection=async()=>false, onCancelProtection=()=>{},
  onUpdateProtection=async()=>false, onDismiss=()=>{},
  onNotice=()=>{}, readOnly=false,
}) {
  const [slUnit,setSlUnit]=useState('price');
  const [tpUnit,setTpUnit]=useState('price');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [pendingRemoval,setPendingRemoval]=useState(null);
  const match=Boolean(protectionDraft &&
    String(protectionDraft.positionId)===String(position?.id) &&
    String(protectionDraft.symbol).toUpperCase()===String(position?.symbol).toUpperCase());
  const sl=match?valid(protectionDraft.sl):valid(position?.sl);
  const tp=match?valid(protectionDraft.tp):valid(position?.tp);
  const entry=valid(position?.entry??position?.entryPrice);
  const volume=valid(position?.volume??position?.lots);
  const side=String(position?.side||'').toUpperCase();
  const currency=account?.currency||'USD';
  const price=Number(position?.closePrice??position?.currentPrice??
    (side==='BUY'?instrument?.bid:instrument?.ask));
  const pnl=position?.pnl;
  const plan={side:side.toLowerCase(),entry,sl,tp,symbol:position?.symbol,pending:false,
    sizingMode:'lots',manualLots:volume};
  const slPnl=sl==null?null:estimatePositionPnlAtPrice({...position,entry},sl,instrument);
  const tpPnl=tp==null?null:estimatePositionPnlAtPrice({...position,entry},tp,instrument);
  const rr=Number.isFinite(slPnl)&&slPnl<0&&Number.isFinite(tpPnl)&&tpPnl>0
    ? Math.abs(tpPnl/slPnl):null;
  const working=busy||protectionSaving;
  useEffect(()=>{setBusy(false);setError('');setPendingRemoval(null);},[position?.id]);
  const start=field=>{
    if(readOnly||working)return false;
    setError('');
    const result=onBeginProtection(field);
    if(result===false) {setError('Finish the current order plan before editing this position.');return false;}
    return true;
  };
  const setPrice=(field,next)=>{
    if(readOnly||working)return;
    // Begin first and then patch: the parent's functional draft updates are
    // batched in order and the chart consumes the same draft source.
    if(!match&&start(field)===false)return;
    onProtectionDraftChange({[field]:next,activeField:field,stage:'draft'});
  };
  const toggle=async field=>{
    if(readOnly||working)return;
    const currently=field==='sl'?sl:tp;
    if(currently==null){start(field);return;}
    // Disabling an accepted exit uses the approved one-click removal semantics.
    // Never optimistically clear the input; wait for the authoritative position.
    setBusy(true);setPendingRemoval(field);setError('');
    try {
      const ok=await onUpdateProtection(position.id,{[field]:null});
      if(ok===false||ok==null){setError('Protection removal was not accepted.');}
      else onCancelProtection();
    } catch(e){setError(e?.message||'Could not remove protection.');}
    finally {setBusy(false);setPendingRemoval(null);}
  };
  const confirm=async()=>{
    if(!match||working||readOnly)return;
    const patch={sl,tp};
    const validation=validateOpenPositionProtection(position,instrument,patch);
    if(!validation.ok){setError(validation.message);onNotice(validation.message);return;}
    setBusy(true);setError('');
    try{
      const ok=await onApplyProtection(patch,{validateAgainstCurrent:true});
      if(ok===false){setError('Position modification was not accepted.');}
    }catch(e){setError(e?.message||'Unable to modify position.');}
    finally{setBusy(false);}
  };
  const discard=()=>{if(working)return;onCancelProtection();setError('');};
  const leave=()=>{if(working)return;discard();onDismiss();};
  return <section className="v4-ticket v4-live-scope v4-manage-position" aria-label="Manage open position"
    data-v4-manage-position={String(position?.id)}>
    <div className="v4-ticket-body">
      <div className="v4-instrument">
        <button className="v4-manage-back" type="button" onClick={leave} aria-label="Back to new order">
          <ArrowLeft size={17}/>
        </button>
        <div className="v4-symbol"><strong>Manage Position</strong>
          <span>{position?.symbol} · {side} · {number(volume,4)} lots</span>
        </div>
        <div className="v4-head-actions">
          <button type="button" aria-label="Close position editor" onClick={leave}><X size={19}/></button>
        </div>
      </div>
      <div className="v4-manage-summary" aria-label="Selected position details">
        <div><span>Direction</span><strong className={side==='BUY'?'v4-positive':'v4-negative'}>{side}</strong></div>
        <div><span>Position size</span><strong>{number(volume,4)} lots</strong></div>
        <div><span>Floating P&amp;L</span><strong className={Number(pnl)>=0?'v4-positive':'v4-negative'}>{signed(pnl,currency)}</strong></div>
        <div><span>Entry</span><strong>{formatInstrumentPrice(entry,instrument)}</strong></div>
        <div><span>Current</span><strong>{formatInstrumentPrice(price,instrument)}</strong></div>
        <div><span>Return</span><strong>{entry&&Number.isFinite(price)?
          signed((side==='SELL'?entry-price:price-entry)/entry*100,'%'):'—'}</strong></div>
      </div>
      <div className="v4-exits v4-block">
        <div className="v4-section-heading"><span>EXITS / PROTECTION</span><span>{match?'Unsaved draft':'Confirmed levels'}</span></div>
        <ProtectionCard field="sl" active={sl!=null} disabled={readOnly||working}
          onToggle={()=>toggle('sl')} unit={slUnit} onUnit={setSlUnit} plan={plan}
          market={instrument} account={account} lots={volume} sizingMode="lots"
          onPrice={value=>setPrice('sl',value)} onNotice={onNotice}/>
        <ProtectionCard field="tp" active={tp!=null} disabled={readOnly||working}
          onToggle={()=>toggle('tp')} unit={tpUnit} onUnit={setTpUnit} plan={plan}
          market={instrument} account={account} lots={volume} sizingMode="lots"
          onPrice={value=>setPrice('tp',value)} onNotice={onNotice}/>
        <div className="v4-ratio-slab">
          <div><span>Risk / Reward</span><strong>{rr!=null?'1:'+number(rr):'—'}</strong></div>
          <div><span>Position</span><strong>{number(volume,4)} lots</strong></div>
        </div>
      </div>
      {pendingRemoval&&<div className="v4-notice" role="status">Removing {pendingRemoval.toUpperCase()}…</div>}
      {error&&<div className="v4-notice" role="alert">{error}</div>}
      {readOnly&&<div className="v4-notice" role="status">Account is read-only. Position modifications are disabled.</div>}
    </div>
    <div className="v4-execution-footer v4-manage-footer">
      {match&&<>
        <button type="button" className="v4-manage-confirm" onClick={confirm} disabled={working||readOnly}
          aria-label="Confirm position protection">{working?'Confirming…':'Confirm'}</button>
        <button type="button" className="v4-manage-discard" onClick={discard} disabled={working}
          aria-label="Discard position protection">Discard</button>
      </>}
      <button type="button" className="v4-manage-new-order" onClick={leave} disabled={working}>
        New Order
      </button>
    </div>
  </section>;
}
