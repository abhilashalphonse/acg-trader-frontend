import React from 'react';
import {createPortal} from 'react-dom';
import { Copy, Check, ChevronRight, ChevronDown, Wallet } from 'lucide-react';
import {
  finiteOrNull, money, fixedNumber, pnlTone,
  positionExposure, positionMargin, positionOpened,
  positionRiskAtStop, positionIdentity, positionRecordedCosts,
  portfolioExposureSummary, positionVerifiedUsdNotional,
} from '../../utils/v4PositionsPresentation.js';
import { formatInstrumentPrice, instrumentForSymbol } from '../../utils/instrumentFormatting.js';
import { estimatePositionPnlAtPrice } from '../../utils/tradingRisk.js';
import { positionLifecycleEvents } from '../../utils/v4PositionLifecycle.js';

// The trading-account snapshot remains authoritative. Compact labels never
// change values and every metric remains available through the Overview control.
function compactMoney(value,currency,signed){
  const amount=finiteOrNull(value);
  if(amount==null||Math.abs(amount)<1000)return money(value,currency,signed);
  try {
    const display=new Intl.NumberFormat('en-US',{
      style:'currency',currency,notation:'compact',maximumFractionDigits:1,
    }).format(amount);
    return signed&&amount>0?'+'+display:display;
  }catch{return money(value,currency,signed);}
}
const OVERVIEW_FIELDS=[
  ['equity','Equity','Eq',false],
  ['used','Used margin','Used',false],
  ['free','Free margin','Free',false],
  ['pnl','Unrealized P&L','P&L',true],
];
export function PositionsAccountSummary({account,positions=null,markets=[]}){
  const [open,setOpen]=React.useState(false);
  const buttonRef=React.useRef(null);
  const popupRef=React.useRef(null);
  const [placement,setPlacement]=React.useState({left:8,top:8});
  const currency=account?.currency||'USD';
  const amounts={
    equity:account?.equity,
    used:account?.usedMargin??account?.margin,
    free:account?.freeMargin,
    pnl:account?.floatingPnl,
  };
  const snapshot=OVERVIEW_FIELDS.map(([key,label,short,signed])=>({
    key,label,short,signed,value:amounts[key],
    full:money(amounts[key],currency,signed),
  }));
  const exposure=Array.isArray(positions)?portfolioExposureSummary(positions,markets):null;
  const show=()=>{
    const rect=buttonRef.current?.getBoundingClientRect();
    if(rect){
      const width=296,height=exposure?272:222;
      const left=Math.max(8,Math.min(window.innerWidth-width-8,rect.right-width));
      const top=rect.top-height-8>=8?rect.top-height-8:Math.min(window.innerHeight-height-8,rect.bottom+7);
      setPlacement({left,top});
    }
    setOpen(value=>!value);
  };
  React.useEffect(()=>{
    if(!open)return undefined;
    const outside=event=>{
      if(popupRef.current?.contains(event.target)||buttonRef.current?.contains(event.target))return;
      setOpen(false);
    };
    const escape=event=>{if(event.key==='Escape'){setOpen(false);buttonRef.current?.focus();}};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return <div className="v4-positions-account-summary" aria-label="Account trading metrics">
    {snapshot.map(metric=><div className={'v4-positions-metric metric-'+metric.key} key={metric.key}
      title={metric.label+' · '+metric.full}>
      <span className="v4-positions-metric-label">
        <span className="v4p-label-full">{metric.label}</span>
        <span className="v4p-label-short" aria-hidden="true">{metric.short}</span>
      </span>
      <strong className={metric.signed&&finiteOrNull(metric.value)!=null?'v4-position-pnl '+pnlTone(metric.value):''}
        aria-label={metric.label+' '+metric.full}>
        <span className="v4p-money-full">{metric.full}</span>
        <span className="v4p-money-compact" aria-hidden="true">{compactMoney(metric.value,currency,metric.signed)}</span>
      </strong>
    </div>)}
    <button type="button" className="v4-account-overview-trigger" ref={buttonRef} onClick={show}
      aria-expanded={open} aria-haspopup="dialog" aria-label="Account overview and margin details"
      title="View all account metrics and verified exposure">
      <Wallet size={14} aria-hidden="true"/><span>Overview</span><ChevronDown size={12} aria-hidden="true"/>
    </button>
    {open&&createPortal(
      <section ref={popupRef} className="v4-account-overview-popover" role="dialog"
        aria-label="Account overview" style={{position:'fixed',...placement,zIndex:9999}}>
        <div className="v4-account-overview-title">
          <strong>Account overview</strong>
          <span>{account?.valuationStatus||'Account snapshot'}</span>
        </div>
        <div className="v4-account-overview-grid">
          {snapshot.map(metric=><div className="v4-account-overview-field" key={metric.key}>
            <span>{metric.label}</span>
            <strong className={metric.signed?'v4-position-pnl '+pnlTone(metric.value):''}>
              {metric.full}
            </strong>
          </div>)}
        </div>
        {exposure&&<div className="v4-account-exposure">
          <div className="v4-account-exposure-title">Verified portfolio exposure</div>
          <div><span>Gross (USD)</span><strong title="Sum of absolute notionals, only when every position is priced">
            {exposure.complete?money(exposure.gross,'USD'):'Unavailable · '+exposure.priced+'/'+exposure.total+' priced'}
          </strong></div>
          <div><span>Net directional (USD)</span><strong title="Signed sum, not a hedging or risk offset measure">
            {exposure.complete?money(exposure.net,'USD',true):'Unavailable'}
          </strong></div>
        </div>}
      </section>,document.body
    )}
  </div>;
}
export function PositionsToolbar({view,onView,entity='position'}){
  const label=entity==='order'?'Pending orders table view':'Positions table view';
  return <div className="v4-positions-tools">
    <div className="v4-positions-selector" role="group" aria-label={label}>
      {['compact','risk','execution'].map(mode=><button key={mode} type="button"
        aria-pressed={mode===view} className={mode===view?'is-active':''}
        onClick={()=>onView(mode)}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}
    </div>
    <select className="v4-positions-view-select" aria-label={label} value={view}
      onChange={event=>onView(event.target.value)}>
      <option value="compact">Compact</option><option value="risk">Risk</option><option value="execution">Execution</option>
    </select>
  </div>;
}
function DisplayField({label,value,action=null}){
  return <div className="v4-position-detail-field">
    <span>{label}</span><strong>{value}</strong>{action}
  </div>;
}
function Identifiers({position,logs}){
  const [copied,setCopied]=React.useState(null);
  const posId=String(position?.positionId??position?.id??'');
  const orderIds=[...new Set([position?.raw?.sourceOrderId,...logs.filter(event=>event.kind==='order').map(event=>event.recordId)]
    .filter(value=>value!=null&&String(value).trim()).map(String))];
  const dealIds=[...new Set(logs.filter(event=>event.kind==='deal').map(event=>String(event.recordId)).filter(Boolean))];
  const items=[['Position ID',posId],...orderIds.map(id=>['Order ID',id]),...dealIds.map(id=>['Deal ID',id])].filter(([,id])=>id);
  const copy=async(value)=>{
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setCopied(null);
    }
  };
  return <details className="v4-position-identifiers">
    <summary>Identifiers <ChevronRight size={15} aria-hidden="true"/></summary>
    <div className="v4-position-identifiers-content" aria-label="Position technical identifiers">
      {items.length?items.map(([label,value],index)=><div key={label+value+index} className="v4-position-identifier">
        <span>{label}</span><code title={value}>{value}</code>
        <button type="button" aria-label={'Copy '+label+' '+value} title={'Copy '+label}
          onClick={e=>{e.stopPropagation();void copy(value);}}>
          {copied===value?<Check size={14}/>:<Copy size={14}/>}
        </button>
      </div>):<span>No verified identifiers available</span>}
    </div>
  </details>;
}
export function PositionsExpandedDetails({
  position,instrument,markets=[],account,activityOrders=[],activityDeals=[],activityFills=[],
  onEditProtection,onOpenJournal,readOnly,
}){
  const id=positionIdentity(position);
  const opened=positionOpened(position);
  const currency=account?.currency||'USD';
  const margin=positionMargin(position);
  const exposure=positionExposure(position,instrument);
  const notional=positionVerifiedUsdNotional(position,instrument,markets);
  const costs=positionRecordedCosts(position);
  const sl=finiteOrNull(position?.sl),tp=finiteOrNull(position?.tp);
  const risk=positionRiskAtStop(position,instrument,account,estimatePositionPnlAtPrice);
  const logs=positionLifecycleEvents(position,{orders:activityOrders,deals:activityDeals,fills:activityFills});
  const formatTime=iso=>new Date(iso).toLocaleTimeString('en-GB',
    {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  return <div className="v4-position-expanded" role="region" aria-label={'Position '+id+' details'}>
    <div className="v4-position-details-heading">
      <strong>Position details</strong>
      <span className="v4-position-opened">Opened {opened?opened.date+' · '+opened.time+' '+opened.offset:'timestamp unavailable'}</span>
      <Identifiers position={position} logs={logs}/>
    </div>
    <div className="v4-position-detail-columns">
      <section aria-label="Protection">
        <h4>Protection</h4>
        {[['sl','Stop loss',sl],['tp','Take profit',tp]].map(([field,label,value])=>
          <DisplayField key={field} label={label}
            value={value==null?'Not set':formatInstrumentPrice(value,instrument)}
            action={<button type="button" className="v4-position-protection-action"
              disabled={readOnly} aria-label={(value==null?'Add ':'Edit ')+label.toLowerCase()+' for '+position.symbol}
              onClick={e=>{e.stopPropagation();onEditProtection(id,field);}}>
              {value==null?'Add':'Edit'}
            </button>}/>)}
        <div className="v4-position-details-divider"/>
        <DisplayField label="Estimated loss at stop" value={sl==null||risk==null?'—':money(risk,currency)}/>
        {sl==null&&<p className="v4-position-detail-hint">Set a stop loss to estimate risk.</p>}
      </section>
      <section aria-label="Exposure and costs">
        <h4>Exposure &amp; costs</h4>
        <DisplayField label="Exposure" value={exposure?
          fixedNumber(exposure.quantity,Number.isInteger(exposure.quantity)?0:2)+' '+exposure.unit:'Not available'}/>
        <DisplayField label="Notional · live" value={notional==null?'Not available':money(notional,'USD')}/>
        <DisplayField label="Reserved margin" value={money(margin,currency)}/>
        <div className="v4-position-details-divider"/>
        <DisplayField label="Commission" value={costs.commission==null?'Not available':money(costs.commission,currency)}/>
        <DisplayField label="Swap / financing" value={costs.swap==null?'Not available':money(costs.swap,currency,true)}/>
      </section>
      <section aria-label="Activity">
        <h4>Activity</h4>
        {logs.length?logs.slice(0,3).map(event=><div key={event.id} className="v4-position-activity">
          <time dateTime={event.timestamp}>{formatTime(event.timestamp)}</time>
          <span>{event.label}</span>
        </div>):<p className="v4-position-no-activity">No verified execution records available.</p>}
        <div className="v4-position-details-divider"/>
        <button type="button" className="v4-position-view-activity"
          onClick={e=>{e.stopPropagation();onOpenJournal(id);}}>View history <ChevronRight size={15} aria-hidden="true"/></button>
      </section>
    </div>
  </div>;
}
export function PositionsExposureFooter({positions,markets}){
  // Never sum underlying EUR, BTC and shares. A single USD figure requires a
  // validated notional for EVERY open position; filtered rows are irrelevant.
  const totals=portfolioExposureSummary(positions,markets);
  const ready=totals.complete;
  const explanation=totals.breakdown.map(item=>item.available
    ? item.symbol+' '+item.side+' '+money(item.usd,'USD')
    : item.symbol+' '+item.side+' unavailable: '+item.reason).join(' | ');
  const unavailable='Not available · '+totals.priced+'/'+totals.total+' priced';
  return <div className="v4-positions-footer" data-v4-exposure-footer="true">
    <span>{positions.length} open {positions.length===1?'position':'positions'}</span>
    {positions.length>0&&<div className="v4-positions-exposures"
      title={explanation||'No verified USD exposures'}>
      <span title={'Gross: sum of absolute USD notionals. '+explanation}>Gross exposure (USD) <strong>{ready?money(totals.gross,'USD'):unavailable}</strong></span>
      <i aria-hidden="true"/>
      <span title={'Directional sum of signed USD notionals, not a portfolio hedge or risk offset. '+explanation}>
        Net directional (USD) <strong>{ready?money(totals.net,'USD',true):unavailable}</strong>
      </span>
    </div>}
  </div>;
}
