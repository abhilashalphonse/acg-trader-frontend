import React,{useEffect,useState} from 'react';
import {ChevronDown,ChevronRight,Maximize2,Minimize2,MoreHorizontal} from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import {PositionsAccountSummary,PositionsToolbar} from './PositionsWorkspaceChromeV4.jsx';
import {instrumentForSymbol,formatInstrumentPrice} from '../../utils/instrumentFormatting.js';
import {estimateRequiredMargin,estimatePositionPnlAtPrice} from '../../utils/tradingRisk.js';
import {finiteOrNull,fixedNumber,money,positionExposure} from '../../utils/v4PositionsPresentation.js';
import './PositionsDockV4.css';

const COLUMN_SPECS={
  compact:[['Instrument','23%','left'],['Type','14%','left'],['Size','13%','right'],['Trigger / Limit','23%','right'],['Status','13%','right'],['Actions','14%','right']],
  risk:[['Instrument','22%','left'],['Projected exposure','19%','right'],['Est. margin','13%','right'],['Stop loss','13%','right'],['Take profit','13%','right'],['Est. risk','12%','right'],['Status','8%','right']],
  execution:[['Instrument','22%','left'],['Type','13%','left'],['Trigger','13%','right'],['Limit','13%','right'],['Created','16%','left'],['Expires','14%','left'],['Order ID','9%','right']],
};
const MIN_WIDTH={compact:760,risk:960,execution:900};
const dateParts=value=>{
  const d=new Date(value);
  if(!value||!Number.isFinite(d.getTime()))return null;
  return {
    date:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),
    time:d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
  };
};
const orderPrice=(order,instrument,field)=>{
  const raw=finiteOrNull(order?.[field]);
  return raw!=null&&raw>0?formatInstrumentPrice(raw,instrument):'—';
};
function pendingProjections(order,instrument,account){
  const price=finiteOrNull(order?.entry);
  const exposure=positionExposure(order,instrument);
  const base=String(instrument?.baseCurrency||'').toUpperCase();
  const quote=String(instrument?.quoteCurrency||'').toUpperCase();
  const currency=String(account?.currency||'USD').toUpperCase();
  const usd=exposure&&(base==='USD'?exposure.quantity:quote==='USD'&&price!=null?exposure.quantity*price:null);
  // Margin engine estimate is only expressed in account currency if the
  // quote already matches account currency. It is NOT reserved margin.
  const margin=price!=null&&quote===currency
    ? finiteOrNull(estimateRequiredMargin(price,order.volume,instrument,account)):null;
  const estimate=target=>price!=null&&quote===currency&&finiteOrNull(target)!=null
    ? finiteOrNull(estimatePositionPnlAtPrice({...order,entry:price},target,instrument)):null;
  const loss=estimate(order.sl),gain=estimate(order.tp);
  return {usd,margin,loss:loss!=null?Math.max(0,-loss):null,
    gain:gain!=null?Math.max(0,gain):null,
    rr:loss!=null&&loss<0&&gain!=null&&gain>0?gain/-loss:null};
}
function PendingCell({children,left=false}) {
  return <td className={'v4-position-cell '+(left?'is-left':'is-right')}>
    <span className="v4-position-cell-inner">{children}</span>
  </td>;
}
function PendingRow({order,market,account,view,selected,expanded,onSelect,onExpand,onManage,onReviewCancel,readOnly,visible}){
  const id=String(order.id);
  const typ=String(order.orderType||'').replaceAll('-',' ').toUpperCase();
  const side=String(order.side||'').toUpperCase();
  const status=String(order.status||'PENDING').toUpperCase();
  const created=dateParts(order.raw?.createdAt||order.raw?.receivedAt);
  const expiry=dateParts(order.expiresAt);
  const proj=pendingProjections(order,market,account);
  const price=orderPrice(order,market,'entry');
  const stopLimit=String(order.orderType||'').toUpperCase().includes('STOP-LIMIT');
  const label=market?.displaySymbol||order.symbol;
  const shown=name=>visible.includes(name);
  return <>
    <tr data-v4-pending-id={id} className={'v4-position-row '+(selected?'is-selected ':'')+(view==='execution'?'is-execution':'')}
      aria-selected={selected} tabIndex={0} aria-label={label+' '+typ+' pending order'}
      onClick={()=>onSelect(id)}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id);}}}>
      <PendingCell left><span className="v4-position-instrument">
        <button type="button" className="v4-position-chevron" aria-label={(expanded?'Collapse':'Expand')+' order details for '+label}
          title="Toggle inline pending order details" aria-expanded={expanded}
          onClick={e=>{e.stopPropagation();onExpand();}}>
          {expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
        </button>
        <span className="v4-position-avatar" aria-hidden="true"><InstrumentAvatar instrument={market} size={24}/></span>
        <strong title={label}>{label}</strong>
        <span className={'v4-position-side '+(side==='BUY'?'is-buy':'is-sell')}>{side}</span>
      </span></PendingCell>
      {view==='compact'&&<>
        {shown('Type')&&<PendingCell left>{typ}</PendingCell>}
        {shown('Size')&&<PendingCell>{fixedNumber(order.volume,2)} lots</PendingCell>}
        {shown('Trigger / Limit')&&<PendingCell>
          {stopLimit?price+' / '+orderPrice(order,market,'limitPrice'):price}
        </PendingCell>}
        {shown('Status')&&<PendingCell>{status}</PendingCell>}
        {shown('Actions')&&<PendingCell><span className="v4-position-actions">
          <button className="v4-position-control v4-position-close" type="button"
            onClick={e=>{e.stopPropagation();onManage(id);}}>Manage</button>
          <button className="v4-position-control v4-position-more" type="button"
            aria-label={'Review cancel for '+label} disabled={readOnly}
            title="Review pending order cancellation"
            onClick={e=>{e.stopPropagation();onReviewCancel(id);}}><MoreHorizontal size={16}/></button>
        </span></PendingCell>}
      </>}
      {view==='risk'&&<>
        {shown('Projected exposure')&&<PendingCell title="Projected USD notional, not reserved exposure">{proj.usd==null?'—':money(proj.usd,'USD')}</PendingCell>}
        {shown('Est. margin')&&<PendingCell title="Estimated requirement if filled; no actual margin reserved">{money(proj.margin,account.currency)}</PendingCell>}
        {shown('Stop loss')&&<PendingCell><button type="button" className="v4-position-protection" disabled={readOnly}
          onClick={e=>{e.stopPropagation();onManage(id);}}>{order.sl==null?'+ Add':orderPrice(order,market,'sl')}</button></PendingCell>}
        {shown('Take profit')&&<PendingCell><button type="button" className="v4-position-protection" disabled={readOnly}
          onClick={e=>{e.stopPropagation();onManage(id);}}>{order.tp==null?'+ Add':orderPrice(order,market,'tp')}</button></PendingCell>}
        {shown('Est. risk')&&<PendingCell>{proj.loss==null?'—':money(proj.loss,account.currency)}</PendingCell>}
        {shown('Status')&&<PendingCell>{status}</PendingCell>}
      </>}
      {view==='execution'&&<>
        {shown('Type')&&<PendingCell left>{typ}</PendingCell>}
        {shown('Trigger')&&<PendingCell>{price}</PendingCell>}
        {shown('Limit')&&<PendingCell>{stopLimit?orderPrice(order,market,'limitPrice'):'—'}</PendingCell>}
        {shown('Created')&&<PendingCell left>{created?<span className="v4-position-time"><span>{created.date}</span><span>{created.time}</span></span>:'—'}</PendingCell>}
        {shown('Expires')&&<PendingCell left>{expiry?<span className="v4-position-time"><span>{expiry.date}</span><span>{expiry.time}</span></span>:String(order.expiration||'GTC').toUpperCase()}</PendingCell>}
        {shown('Order ID')&&<PendingCell>{id}</PendingCell>}
      </>}
    </tr>
    {expanded&&<tr className="v4-position-detail-row" data-v4-pending-detail={id}><td colSpan={visible.length}>
      <div className="v4-position-expanded" role="region" aria-label={'Pending order '+id+' details'}>
        <section>
          <h4>Order setup</h4>
          {view!=='execution'&&<div className="v4-position-detail-field"><span>Order ID</span><strong>{id}</strong></div>}
          <div className="v4-position-detail-field"><span>Remaining</span><strong>{fixedNumber(order.volume,2)} lots</strong></div>
          <div className="v4-position-detail-field"><span>Time in force</span><strong>{String(order.expiration||'GTC').toUpperCase()}</strong></div>
          {view!=='execution'&&<div className="v4-position-detail-field"><span>Created</span><strong>{created?created.date+' · '+created.time:'—'}</strong></div>}
        </section>
        <section>
          <h4>Projected exposure &amp; risk</h4>
          {view!=='risk'&&<div className="v4-position-detail-field"><span>Est. margin</span><strong>{money(proj.margin,account.currency)}</strong></div>}
          <div className="v4-position-detail-field"><span>Underlying size</span><strong>{positionExposure(order,market)?fixedNumber(positionExposure(order,market).quantity,2)+' '+positionExposure(order,market).unit:'—'}</strong></div>
          {view!=='risk'&&<div className="v4-position-detail-field"><span>Projected USD</span><strong>{money(proj.usd,'USD')}</strong></div>}
          <div className="v4-position-detail-field"><span>Projected R:R</span><strong>{proj.rr==null?'—':'1 : '+fixedNumber(proj.rr,2)}</strong></div>
          <button type="button" className="v4-position-add-protection" onClick={e=>{e.stopPropagation();onManage(id);}}>Review order setup →</button>
        </section>
        <section>
          <h4>Order activity</h4>
          {created?<div className="v4-position-activity"><time>{created.time}</time><span>Order recorded <small>order #{id}</small></span></div>
            :<p className="v4-position-no-activity">No verified order timestamps available.</p>}
          <div className="v4-position-detail-field"><span>Current status</span><strong>{status}</strong></div>
          <p className="v4-position-no-activity">Historical modifications require recorded backend events.</p>
        </section>
      </div>
    </td></tr>}
  </>;
}
export default function PendingDockV4({
  orders=[],markets=[],account={},counts={},onTabChange=()=>{},selectedOrderId=null,
  onInspect=()=>{},onManage=()=>{},onReviewCancel=()=>{},
  collapsed=false,compactDock=false,expanded=false,onToggleExpanded=()=>{},
  loading=false,error=null,onRetry=()=>{},readOnly=false,
}){
  const [view,setView]=useState(()=>{
    if(typeof window==='undefined')return 'compact';
    try {const stored=window.localStorage.getItem('acg-v4-pending-view-v1');return ['compact','risk','execution'].includes(stored)?stored:'compact';}
    catch {return 'compact';}
  });
  useEffect(()=>{try {window.localStorage.setItem('acg-v4-pending-view-v1',view);}catch{ /* no storage */ }},[view]);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('');
  const [expandedIds,setExpandedIds]=useState(()=>new Set());
  const [hidden,setHidden]=useState({});
  const ids=orders.map(order=>String(order.id));
  const symbols=[...new Set(orders.map(o=>o.symbol).filter(Boolean))].sort();
  const shownOrders=orders.filter(order=>
    (!filter||order.symbol===filter)&&(!query.trim()||
      [order.id,order.clientOrderId,order.symbol,order.orderType,order.side].some(v=>String(v||'').toLowerCase().includes(query.trim().toLowerCase()))));
  const hiddenInView=hidden[view]||[];
  const columns=COLUMN_SPECS[view].filter(([label])=>label==='Instrument'||!hiddenInView.includes(label));
  const tabs=[['positions','Positions'],['orders','Pending'],['history','History'],['journal','Journal']];
  return <div className="acg-v4-positions" data-v4-pending="true" data-v4-pending-view={view}>
    <div className="v4-positions-header">
      <nav className="v4-positions-tabs" aria-label="Trading activity tabs">
        {tabs.map(([key,label])=><button key={key} type="button"
          className={'v4-positions-tab '+(key==='orders'?'is-active':'')} aria-current={key==='orders'?'page':undefined}
          onClick={()=>onTabChange(key)}>{label}{(key==='positions'||key==='orders')&&<span className="v4-positions-count">{counts[key]??0}</span>}</button>)}
      </nav>
      <div className="v4-positions-header-right">
        <PositionsAccountSummary account={account}/>
        <button type="button" className="v4-positions-expand" onClick={onToggleExpanded}
          aria-label={expanded?'Restore pending workspace':'Expand pending workspace'}>
          {expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}
        </button>
      </div>
    </div>
    {!collapsed&&!compactDock&&<>
      <PositionsToolbar entity="order" view={view} onView={setView} query={query} onQuery={setQuery}
        instrument={filter} onInstrument={setFilter} instruments={symbols}
        columns={COLUMN_SPECS[view]} hiddenColumns={hiddenInView}
        onToggleColumn={label=>setHidden(cur=>({...cur,[view]:hiddenInView.includes(label)?hiddenInView.filter(x=>x!==label):[...hiddenInView,label]}))}
        onResetColumns={()=>setHidden(cur=>({...cur,[view]:[]}))}/>
      <div className="v4-positions-scroller">
        <table className="v4-positions-table" style={{minWidth:MIN_WIDTH[view]}}>
          <colgroup>{columns.map(([name,width])=><col key={name} style={{width}}/>)}</colgroup>
          <thead><tr>{columns.map(([name,,align])=><th key={name} scope="col" className={align==='left'?'is-left':'is-right'}>{name}</th>)}</tr></thead>
          <tbody>
            {loading&&!orders.length&&Array.from({length:3},(_,i)=><tr key={i} className="v4-positions-skeleton" aria-hidden="true">{columns.map(([name])=><td key={name}><span/></td>)}</tr>)}
            {!loading&&!error&&!orders.length&&<tr><td colSpan={columns.length}><div className="v4-positions-empty"><strong>No pending orders</strong><span>Orders awaiting execution will appear here.</span></div></td></tr>}
            {!loading&&!error&&orders.length>0&&!shownOrders.length&&<tr><td colSpan={columns.length}><div className="v4-positions-empty"><strong>No matching orders</strong><span>Change the search or instrument filter.</span></div></td></tr>}
            {shownOrders.map(order=><PendingRow key={order.id} order={order}
              market={instrumentForSymbol(markets,order.symbol)} account={account} view={view}
              visible={columns.map(([name])=>name)} readOnly={readOnly}
              selected={String(selectedOrderId)===String(order.id)} expanded={expandedIds.has(String(order.id))}
              onSelect={onInspect} onManage={onManage} onReviewCancel={onReviewCancel}
              onExpand={()=>setExpandedIds(prev=>{const next=new Set(prev);if(next.has(String(order.id)))next.delete(String(order.id));else next.add(String(order.id));return next;})}/>)}
          </tbody>
        </table>
        {error&&<div className="v4-positions-error" role="alert"><span>{String(error)}</span><button type="button" onClick={onRetry}>Retry</button></div>}
      </div>
      <div className="v4-positions-footer">
        <span>{orders.length} pending {orders.length===1?'order':'orders'}</span>
        <span className="v4-positions-exposures">{ids.length} awaiting review / execution</span>
      </div>
    </>}
  </div>;
}
