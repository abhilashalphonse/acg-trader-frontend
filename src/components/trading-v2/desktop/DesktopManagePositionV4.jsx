import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, X } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import './DesktopManagePositionV4.css';
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
  const [advanced,setAdvanced]=useState(false);
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
  const returnPct = entry && Number.isFinite(price)
    ? ((side==='SELL'?entry-price:price-entry)/entry)*100 : null;
  const displayReturn = Number.isFinite(returnPct)
    ? (returnPct>=0?'+':'−')+number(Math.abs(returnPct),2)+'%' : '—';
  const positionId = String(position?.id||'');
  const openedAt = position?.openedAt || position?.createdAt || null;
  const openedDate = openedAt && Number.isFinite(Date.parse(openedAt))
    ? new Date(openedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})+' UTC' : null;
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
  return <section className="v4-ticket v4-live-scope v4-manage-position"
    aria-label="Manage open position" data-v4-manage-position={positionId}>
    <div className="v4-ticket-body">
      {/* Match the existing ticket header. Only the selected position context changes. */}
      <div className="v4-instrument">
        <span data-v4-manage-instrument-avatar className="shrink-0">
          <InstrumentAvatar instrument={instrument} size={32}/>
        </span>
        <div className="v4-symbol">
          <strong>{instrument?.displaySymbol || position?.symbol || '—'}</strong>
          <span>Open position · {side}</span>
        </div>
        <div className="v4-head-actions">
          <button type="button" aria-label="Back to new order" title="New Order"
            onClick={leave} disabled={working}><ArrowLeft size={18}/></button>
          <button type="button" aria-label="Close position editor"
            onClick={leave} disabled={working}><X size={19}/></button>
        </div>
      </div>

      <div className="v4-session" aria-label="Position status">
        <span><i className="v4-manage-live-indicator"/>Open position</span>
        <span data-v4-manage-direction className={side==='BUY'?'v4-manage-long':'v4-manage-short'}>
          {side} · {position?.symbol}
        </span>
      </div>

      {/* Reuse the ticket's three-column quote strip instead of a grey statistics card. */}
      <div className="v4-quote-strip v4-manage-price-strip" aria-label="Selected position prices">
        <span>Entry <strong data-v4-manage-entry>{formatInstrumentPrice(entry,instrument)}</strong></span>
        <span>Current <strong data-v4-manage-current>{formatInstrumentPrice(price,instrument)}</strong></span>
        <span>Return <strong data-v4-manage-return className={returnPct>=0?'v4-manage-long':'v4-manage-short'}>
          {displayReturn}</strong></span>
      </div>

      {/* Same horizontal mode control as the new-order ticket. Its alternate action
          returns to New Order; it must never initiate a BUY/SELL execution. */}
      <div className="v4-capsule v4-mainmodes v4-order-types v4-manage-modes" role="group"
        aria-label="Trade panel context">
        <span className="v4-capsule-button selected" data-v4-context-active="position">Open Position</span>
        <button type="button" className="v4-capsule-button"
          onClick={leave} disabled={working}>New Order</button>
      </div>

      <div className="v4-position v4-block">
        <div className="v4-section-heading">
          <span>POSITION</span>
          <span>{side} · OPEN</span>
        </div>
        <div className="v4-manage-position-values">
          <div className="v4-manage-position-size">
            <span className="v4-manage-stat-label">POSITION SIZE</span>
            <div className="v4-manage-size-value" data-v4-manage-size>
              {number(volume,4)} <small>lots</small>
            </div>
          </div>
          <div className="v4-manage-position-pnl">
            <span className="v4-manage-stat-label">FLOATING P&amp;L</span>
            <strong className={Number(pnl)>=0?'v4-manage-long':'v4-manage-short'}
              data-v4-manage-pnl>{signed(pnl,currency)}</strong>
          </div>
        </div>
      </div>

      <div className="v4-exits v4-block">
        <div className="v4-section-heading">
          <span>EXITS / PROTECTION</span>
          {match?<span data-v4-unsaved-protection>Unsaved draft</span>:<ChevronUp size={15}/>}
        </div>
        {/* Exact shared controls; no parallel TP/SL field implementation. */}
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
          <div><span>Position volume</span><strong>{volume?number(volume,4)+' lots':'—'}</strong></div>
        </div>
      </div>

      <div className="v4-block">
        <button type="button" className="v4-disclosure" aria-expanded={advanced}
          onClick={()=>setAdvanced(open=>!open)}>
          ADVANCED {advanced?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
        </button>
        {advanced&&<div className="v4-advanced-content" data-v4-manage-advanced>
          <div><span>Position ID</span><strong title={positionId}>{positionId||'—'}</strong></div>
          {openedDate&&<div><span>Opened</span><strong>{openedDate}</strong></div>}
          <div><span>Entry price</span><strong>{formatInstrumentPrice(entry,instrument)}</strong></div>
          <div><span>Current price</span><strong>{formatInstrumentPrice(price,instrument)}</strong></div>
        </div>}
      </div>
      {pendingRemoval&&<div className="v4-notice" role="status">Removing {pendingRemoval.toUpperCase()}…</div>}
      {error&&<div className="v4-notice" role="alert">{error}</div>}
      {readOnly&&<div className="v4-notice" role="status">Account is read-only. Position modifications are disabled.</div>}
    </div>

    {/* Keep the existing Trade Execution footer rhythm. Actions change only
        context: this can modify an existing position, never open a new trade. */}
    <div className="v4-execution-footer v4-manage-footer">
      <div className="v4-margin-summary v4-manage-footer-summary">
        <div><span>Floating P&amp;L</span><strong className={Number(pnl)>=0?'v4-manage-long':'v4-manage-short'}>
          {signed(pnl,currency)}</strong></div>
        <div><span>Position volume</span><strong>{volume?number(volume,4)+' lots':'—'}</strong></div>
      </div>
      <div className="v4-trade-actions v4-manage-trade-actions">
        {match ? <>
          <button type="button" className="v4-manage-discard"
            onClick={discard} disabled={working} aria-label="Discard position protection">
            Discard
          </button>
          <button type="button" className="v4-manage-confirm"
            onClick={confirm} disabled={working||readOnly} aria-label="Confirm position protection">
            {working?'Confirming…':'Confirm'}
          </button>
        </> : <button type="button" className="v4-manage-new-order"
          onClick={leave} disabled={working}>New Order</button>}
      </div>
    </div>
  </section>;
}
