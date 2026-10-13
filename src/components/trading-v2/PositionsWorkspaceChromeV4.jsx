import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import {
  finiteOrNull, money, fixedNumber, pnlTone,
  positionExposure, positionMargin, positionOpened, positionExecutionSource,
  positionRiskAtStop, positionIdentity, positionUsdNotional,
  positionMarginUtilization, positionRecordedCosts, positionHoldingDuration,
  positionUnrealizedPnl, positionProtectionIntelligence,
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
export function PositionsToolbar({view,onView,query,onQuery,instrument,onInstrument,instruments,
  columns,hiddenColumns,onToggleColumn,onResetColumns,showAccount,onShowAccount,showExposure,onShowExposure}) {
  const [menu,setMenu]=React.useState(null);
  const menuRef=React.useRef(null);
  React.useEffect(()=>{
    if(!menu)return undefined;
    function dismiss(e){if(e.key==='Escape')setMenu(null);}
    function outside(e){if(menuRef.current&&!menuRef.current.contains(e.target))setMenu(null);}
    document.addEventListener('keydown',dismiss);
    document.addEventListener('pointerdown',outside);
    return ()=>{document.removeEventListener('keydown',dismiss);document.removeEventListener('pointerdown',outside);};
  },[menu]);
  return <div className="v4-positions-toolbar">
    <div className="v4-positions-filters">
      <label className="v4-positions-search">
        <Search size={16} aria-hidden="true"/>
        <input type="search" value={query} onChange={e=>onQuery(e.target.value)}
          placeholder="Find position..." aria-label="Find position"/>
      </label>
      <select className="v4-positions-instrument-filter" aria-label="Filter by instrument"
        value={instrument} onChange={e=>onInstrument(e.target.value)}>
        <option value="">All instruments</option>
        {instruments.map(symbol=><option value={symbol} key={symbol}>{symbol}</option>)}
      </select>
    </div>
    <div className="v4-positions-tools" ref={menuRef}>
      <div className="v4-positions-selector" role="group" aria-label="Positions table view">
        {['compact','risk','execution'].map(mode=><button key={mode} type="button"
          aria-pressed={mode===view} className={mode===view?'is-active':''} onClick={()=>{onView(mode);setMenu(null);}}>
          {mode[0].toUpperCase()+mode.slice(1)}</button>)}
      </div>
      <div className="v4-positions-menu-anchor">
        <button type="button" className="v4-positions-settings" aria-label="Positions display settings"
          aria-expanded={menu==='settings'} title="Display settings"
          onClick={()=>setMenu(m=>m==='settings'?null:'settings')}>
          <SlidersHorizontal size={16}/>
        </button>
        {menu==='settings'&&<div className="v4-positions-options-popover" role="group" aria-label="Positions display settings">
          <label><input type="checkbox" checked={showAccount} onChange={e=>onShowAccount(e.target.checked)}/>Show account overview</label>
          <label><input type="checkbox" checked={showExposure} onChange={e=>onShowExposure(e.target.checked)}/>Show exposure footer</label>
        </div>}
      </div>
      <div className="v4-positions-menu-anchor">
        <button type="button" className="v4-positions-columns-button" aria-expanded={menu==='columns'}
          onClick={()=>setMenu(m=>m==='columns'?null:'columns')}>Columns</button>
        {menu==='columns'&&<div className="v4-positions-options-popover" role="group" aria-label={'Columns in '+view+' view'}>
          <strong>Visible columns</strong>
          {columns.map(([label])=><label key={label}>
            <input type="checkbox" checked={label==='Instrument'||!hiddenColumns.includes(label)}
              disabled={label==='Instrument'} onChange={()=>onToggleColumn(label)}/>{label}
          </label>)}
          <button type="button" className="v4-positions-reset-columns" onClick={()=>{onResetColumns();setMenu(null);}}>Reset columns</button>
        </div>}
      </div>
    </div>
  </div>;
}
function detailValue(label,value){return <div className="v4-position-detail-field" key={label}><span>{label}</span><strong>{value??'—'}</strong></div>;}
export function PositionsExpandedDetails({
  position,instrument,account,activityOrders=[],activityDeals=[],activityFills=[],onEditProtection,onOpenJournal,readOnly,view='compact',visibleColumns=[],
}){
  const id=positionIdentity(position);
  const opened=positionOpened(position);
  const created=position?.raw?.createdAt?new Date(position.raw.createdAt):null;
  const createdText=created&&Number.isFinite(created.getTime())?created.toLocaleString('en-GB'):'—';
  const currency=account?.currency||'USD';
  const costs=positionRecordedCosts(position);
  const margin=positionMargin(position);
  const marginPercent=positionMarginUtilization(position,account);
  const usdExposure=positionUsdNotional(position,instrument);
  const protection=positionProtectionIntelligence(position,instrument,account,estimatePositionPnlAtPrice);
  const sl=finiteOrNull(position?.sl),tp=finiteOrNull(position?.tp);
  const risk=positionRiskAtStop(position,instrument,account,estimatePositionPnlAtPrice);
  const pnl=positionUnrealizedPnl(position,account);
  const logs=positionLifecycleEvents(position,{orders:activityOrders,deals:activityDeals,fills:activityFills});
  const visible=label=>visibleColumns.includes(label);
  const distance=(value,delta)=>value==null?'—':
    fixedNumber(value,value<1?2:1)+' '+protection.unit+(delta==null?'':' · '+money(delta,currency,true));
  return <div className="v4-position-expanded" role="region" aria-label={'Position '+id+' details'}>
    <section>
      <h4>Execution</h4>
      {!visible('Position ID')&&detailValue('Position ID',String(position.positionId||id))}
      {!visible('Source')&&detailValue('Source',positionExecutionSource(position))}
      {detailValue('Order created',createdText)}
      {!visible('Opened')&&detailValue('Filled',opened?opened.date+' · '+opened.time+' '+opened.offset:'—')}
      {detailValue('Order ID',String(position.raw?.sourceOrderId||'—'))}
      {detailValue('Holding duration',positionHoldingDuration(position)||'—')}
      {detailValue('Recorded commission',costs.commission==null?'—':money(costs.commission,currency))}
      {detailValue('Recorded swap / financing',costs.swap==null?'—':money(costs.swap,currency,true))}
      {costs.realized!=null&&detailValue('Realized P&L',money(costs.realized,currency,true))}
      {!visible('Unrealized P&L')&&detailValue('Unrealized P&L',money(pnl.value,currency,true))}
    </section>
    <section>
      <h4>Risk &amp; protection</h4>
      {view!=='risk'&&detailValue('Reserved margin',money(margin,currency))}
      {detailValue('Margin / equity',marginPercent==null?'—':fixedNumber(marginPercent,2)+'%')}
      {detailValue('USD notional',usdExposure==null?'—':money(usdExposure,'USD'))}
      {view!=='risk'&&detailValue('Stop loss',sl==null?'Not set':formatInstrumentPrice(sl,instrument))}
      {view!=='risk'&&detailValue('Take profit',tp==null?'Not set':formatInstrumentPrice(tp,instrument))}
      {view!=='risk'&&detailValue('Risk at stop',risk==null?'—':money(risk,currency))}
      {sl!=null&&detailValue('Distance to SL',distance(protection.stopDistance,protection.currentToStop))}
      {tp!=null&&detailValue('Distance to TP',distance(protection.targetDistance,protection.currentToTarget))}
      {sl!=null&&tp!=null&&detailValue('Risk / reward',protection.rewardToRisk==null?'—':'1 : '+fixedNumber(protection.rewardToRisk,2))}
      {detailValue('R-multiple',protection.rMultiple==null?'—':fixedNumber(protection.rMultiple,2)+'R')}
      {detailValue('Trailing stop',position.trailingEnabled?'Enabled · '+fixedNumber(position.trailingPips,1)+' pips':'Disabled')}
      {view!=='risk'&&!readOnly&&<button type="button" className="v4-position-add-protection"
        onClick={e=>{e.stopPropagation();onEditProtection(id,sl==null?'sl':'tp');}}>
        + {sl==null?'Add protection':'Edit protection'}
      </button>}
    </section>
    <section>
      <h4>Position activity</h4>
      {logs.length?logs.slice(0,3).map(event=><div key={event.id} className="v4-position-activity">
        <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time>
        <span title={event.description||undefined}>{event.label}<small> {event.kind} #{event.recordId}</small></span>
      </div>):<p className="v4-position-no-activity">No verified execution records available.</p>}
      <button type="button" className="v4-position-view-activity"
        onClick={e=>{e.stopPropagation();onOpenJournal();}}>View history →</button>
    </section>
  </div>;
}
export function PositionsExposureFooter({positions,markets}){
  const exposure=positions.map(p=>({p,exposure:positionExposure(p,instrumentForSymbol(markets,p.symbol))}));
  const valid=exposure.filter(x=>x.exposure!=null);
  const commonUnit=valid.length&&valid.every(x=>x.exposure.unit===valid[0].exposure.unit)?valid[0].exposure.unit:null;
  const aggregate=valid.length===positions.length&&commonUnit!=null;
  const gross=aggregate?valid.reduce((sum,x)=>sum+Math.abs(x.exposure.quantity),0):null;
  const net=aggregate?valid.reduce((sum,x)=>sum+(String(x.p.side).toUpperCase()==='SELL'?-1:1)*x.exposure.quantity,0):null;
  const qty=value=>fixedNumber(value,Number.isInteger(value)?0:2);
  return <div className="v4-positions-footer" data-v4-exposure-footer="true">
    <span>{positions.length} open {positions.length===1?'position':'positions'}</span>
    {positions.length>0&&<div className="v4-positions-exposures" title="Underlying units, not account-currency notional">
      <span>Gross exposure <strong>{aggregate?qty(gross)+' '+commonUnit:'Multiple assets / unavailable'}</strong></span>
      <i aria-hidden="true"/>
      <span>Net exposure <strong>{aggregate?(net<0?'−':'')+qty(Math.abs(net))+' '+commonUnit:'—'}</strong></span>
    </div>}
  </div>;
}
