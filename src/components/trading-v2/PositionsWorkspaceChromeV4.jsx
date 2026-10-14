import React from 'react';
import { Search, Copy, Check, ChevronRight } from 'lucide-react';
import {
  finiteOrNull, money, fixedNumber, pnlTone,
  positionExposure, positionMargin, positionOpened, positionExecutionSource,
  positionRiskAtStop, positionIdentity, positionRecordedCosts,
  portfolioExposureSummary, positionVerifiedUsdNotional,
} from '../../utils/v4PositionsPresentation.js';
import { formatInstrumentPrice, instrumentForSymbol } from '../../utils/instrumentFormatting.js';
import { estimatePositionPnlAtPrice } from '../../utils/tradingRisk.js';
import { positionLifecycleEvents } from '../../utils/v4PositionLifecycle.js';

// Presentation is always derived from the authoritative account and position
// records. Never reconstruct used margin from leverage or fabricate activities.
export function PositionsAccountSummary({ account }) {
  const metrics=[
    ['Equity',account?.equity,false],
    ['Used margin',account?.usedMargin??account?.margin,false],
    ['Free margin',account?.freeMargin,false],
    ['Unrealized P&L',account?.floatingPnl,true],
  ];
  const currency=account?.currency||'USD';
  return <div className="v4-positions-account-summary" aria-label="Account trading metrics">
    {metrics.map(([label,value,signed])=><div className="v4-positions-metric" key={label}>
      <span>{label}</span>
      <strong className={signed&&finiteOrNull(value)!=null?'v4-position-pnl '+pnlTone(value):''}
        title={label+' · '+currency}>{money(value,currency,signed)}</strong>
    </div>)}
  </div>;
}
// Fixed, deliberate view presets: no user-editable Columns control.
export function PositionsToolbar({view,onView,query,onQuery,instrument,onInstrument,instruments,entity='position'}) {
  return <div className="v4-positions-toolbar">
    <div className="v4-positions-filters">
      <label className="v4-positions-search">
        <Search size={16} aria-hidden="true"/>
        <input type="search" value={query} onChange={e=>onQuery(e.target.value)}
          placeholder={'Find '+entity+'...'} aria-label={'Find '+entity}/>
      </label>
      <select className="v4-positions-instrument-filter" aria-label="Filter by instrument"
        value={instrument} onChange={e=>onInstrument(e.target.value)}>
        <option value="">All instruments</option>
        {instruments.map(symbol=><option value={symbol} key={symbol}>{symbol}</option>)}
      </select>
    </div>
    <div className="v4-positions-tools">
      <div className="v4-positions-selector" role="group" aria-label={entity==='order'?'Pending orders table view':'Positions table view'}>
        {['compact','risk','execution'].map(mode=><button key={mode} type="button"
          aria-pressed={mode===view} className={mode===view?'is-active':''}
          onClick={()=>onView(mode)}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}
      </div>
    </div>
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
  const created=logs.find(item=>item.kind==='order');
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
