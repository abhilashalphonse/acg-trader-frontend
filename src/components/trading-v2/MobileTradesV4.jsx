import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,ArrowUpRight} from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import {formatInstrumentPrice,instrumentForSymbol} from '../../utils/instrumentFormatting.js';
import {positionCloseAvailability} from '../../utils/marketExecutionAvailability.js';
import {isAmbiguousExecutionError} from '../../utils/executionReconciliation.js';
import {MOBILE_HISTORY_PERIODS,historyTimestamp,mobileHistoryRows,mobilePartialCloseAllowed} from '../../utils/mobileTradeHistory.js';
import {MobileWorkspaceV4,WorkspaceMetric,WorkspaceDetails,workspaceMoney,workspaceNumber,workspaceTone,workspaceDate} from './MobileWorkspaceV4.jsx';
import '../../styles/mobileWorkspacesV4.css';

const status = item => String(item.status || '').replaceAll('_',' ').toLowerCase();
const lots = item => workspaceNumber(item.volume ?? item.lots) ? `${Number(item.volume ?? item.lots).toLocaleString('en-US',{maximumFractionDigits:8})} lots` : '—';
const symbolLabel = value => /^[A-Z]{6}$/.test(value || '') ? `${value.slice(0,3)}/${value.slice(3)}` : value;
const opened = item => item.openedAtIso || item.raw?.openedAt || item.raw?.createdAt || item.createdAt || item.openedAt;
const kindLabel = item => String(item.orderType || item.type || '').replaceAll('_',' ').replaceAll('-',' ').toUpperCase();

export default function MobileTradesV4({account={},positions=[],pendingOrders=[],positionHistory=[],historyOrders=[],historyLoaded=false,historyError=null,onRetryHistory,onCheckStatus,commandPending=false,markets=[],onClose,onOpenChart,onViewClosedPositionChart,onEditPositionOnChart,onSelectPosition,onClosePosition,onCancelPending,onModifyPending,onBreakEven,initialTab,readOnly=false}) {
  const [view,setView]=useState(initialTab==='history'?'history':'trades');
  const [book,setBook]=useState('positions');
  const [historyKind,setHistoryKind]=useState('position');
  const [period,setPeriod]=useState(()=>{try {const v=localStorage.getItem('acg-mobile-history-period-v1');return MOBILE_HISTORY_PERIODS.some(([id])=>id===v)?v:'6months';}catch{return '6months';}});
  const [symbol,setSymbol]=useState('');
  const [start,setStart]=useState('');const [end,setEnd]=useState('');
  const [expanded,setExpanded]=useState(null);
  const [intent,setIntent]=useState(null);
  const [working,setWorking]=useState(null);
  const [error,setError]=useState('');
  const [delayed,setDelayed]=useState(false);
  const [checking,setChecking]=useState(false);
  const dispatchLock=useRef(false);
  const currency=account.currency || 'USD';
  const money=value=>workspaceMoney(value,currency);
  const instrument=s=>instrumentForSymbol(markets,s);
  const price=(value,s)=>workspaceNumber(value)&&Number(value)>0?formatInstrumentPrice(value,instrument(s)):'—';
  const locked=commandPending || Boolean(working) || readOnly;
  useEffect(()=>{try {localStorage.setItem('acg-mobile-history-period-v1',period);}catch{/* preferences are optional */}},[period]);
  useEffect(()=>{setExpanded(null);setIntent(null);setError('');},[view,book,historyKind,symbol,period]);
  useEffect(()=>{setWorking(null);setIntent(null);setExpanded(null);setError('');setDelayed(false);},[account.id]);
  useEffect(()=>{
    if(!working)return undefined;
    const owner=(working.kind==='cancel'?pendingOrders:positions).find(item=>String(item.id)===working.id);
    const complete=!owner || (working.kind==='close'&&working.percent<100&&Number(owner.volume ?? owner.lots)<working.volume) || (working.kind==='be'&&owner.sl!=null&&Math.abs(Number(owner.sl)-Number(owner.entry))<(Number(instrumentForSymbol(markets,owner.symbol)?.tickSize)||1e-8)*.51);
    if(complete){setWorking(null);setIntent(null);setDelayed(false);setError('');return undefined;}
    const timer=setTimeout(()=>setDelayed(true),Math.max(0,12000-(Date.now()-working.started)));
    return ()=>clearTimeout(timer);
  },[working,positions,pendingOrders,markets]);
  const execute=async()=>{
    if(!intent || locked || dispatchLock.current)return;
    const item=intent.item;
    const next={kind:intent.kind,id:String(item.id),percent:intent.percent || 100,volume:Number(item.volume ?? item.lots),started:Date.now()};
    dispatchLock.current=true;setError('');setDelayed(false);setWorking(next);
    try {
      const result=intent.kind==='cancel'?await onCancelPending(item.id):intent.kind==='be'?await onBreakEven(item.id):await onClosePosition(item.id,next.percent);
      if(result===false || result==null){setWorking(null);setError('Change was not accepted. The accepted trade remains unchanged.');}
      else setIntent(null);
    }catch(cause){
      if(isAmbiguousExecutionError(cause)){setDelayed(true);setError('Outcome unconfirmed. Check status before another attempt.');setIntent(null);}
      else {setWorking(null);setError(cause?.message || 'Change was not accepted.');}
    }finally{dispatchLock.current=false;}
  };
  const check=async()=>{if(checking)return;setChecking(true);try {await onCheckStatus?.();}catch{setError('Unable to refresh account status.');}finally{setChecking(false);}};
  const historySymbols=[...new Set([...positionHistory,...historyOrders].map(i=>i.symbol).filter(Boolean))].sort();
  const tradeSymbols=[...new Set([...positions,...pendingOrders].map(i=>i.symbol).filter(Boolean))].sort();
  const rows=useMemo(()=>mobileHistoryRows({positions:positionHistory,orders:historyOrders,kind:historyKind,symbol,period,start,end}),[positionHistory,historyOrders,historyKind,symbol,period,start,end]);
  const stats=useMemo(()=>rows.filter(row=>row.kind==='position').reduce((sum,{item})=>({pnl:sum.pnl+(Number(item.pnl)||0),commission:sum.commission+(Number(item.commission)||0),swap:sum.swap+(Number(item.swap)||0)}),{pnl:0,commission:0,swap:0}),[rows]);
  const validRange=period!=='custom'||!start||!end||start<=end;
  const visibleTrades=(book==='positions'?positions:pendingOrders).filter(i=>!symbol||i.symbol===symbol);
  const toggle=key=>{if(working)return;setExpanded(v=>v===key?null:key);setIntent(null);setError('');};
  const chartPosition=item=>{if(locked)return;onSelectPosition?.(item.id);onEditPositionOnChart?.(item);};
  const summaryReady=historyLoaded&&!historyError&&validRange;
  const renderCard=(item,key,type,time)=>{
    const pending=type==='pending';const history=type==='history-position'||type==='history-order';const order=pending||type==='history-order';
    const open=expanded===key;const side=String(item.side || '').toUpperCase();const market=instrument(item.symbol);
    const current=workspaceNumber(item.closePrice)?item.closePrice:market?.[side==='BUY'?'bid':'ask'];
    const availability=positionCloseAvailability(market);
    const canBE=Number(item.entry)>0&&Number(current)>0&&(side==='BUY'?Number(current)>Number(item.entry):Number(current)<Number(item.entry));
    const entry=item.entry ?? item.entryPrice ?? item.stopPrice ?? item.limitPrice ?? item.requestedPrice;
    const details=[['Size',lots(item)],['Entry',price(entry,item.symbol)],...(!history&&!pending?[['Current',price(current,item.symbol)]]:[]),...(history&&!order?[['Exit',price(item.closePrice,item.symbol)]]:[]),...(String(item.orderType).toLowerCase().replaceAll('_','-')==='stop-limit'?[['Limit price',price(item.limitPrice,item.symbol)]]:[]),['Stop loss',price(item.sl ?? item.stopLoss,item.symbol)],['Take profit',price(item.tp ?? item.takeProfit,item.symbol)],...(order?[['Status',status(item)||'Pending'],['Time in force',item.expiration || item.timeInForce || 'GTC'],['Expires',item.expiresAt?workspaceDate(item.expiresAt)+' UTC':'No expiry']]:[['Commission',money(item.commission)],['Swap / financing',money(item.swap)],['Margin',money(item.margin)]]),['Opened',workspaceDate(opened(item))+' UTC'],...(history?[['Completed',workspaceDate(historyTimestamp(item))+' UTC']]:[]),['ID',item.id]];
    return <article key={key} className="mw-card" data-v4-trade-card={key}>
      <button type="button" className="mw-card-toggle" aria-expanded={open} aria-label={`Details for ${symbolLabel(item.symbol)} ${side} ${pending?'pending order':history?'history record':'position'} ${item.id}`} onClick={()=>toggle(key)}>
        <div className="mw-row"><InstrumentAvatar instrument={market || {symbol:item.symbol}} size={22}/><span className="mw-pair">{symbolLabel(item.symbol)}</span><span className={`mw-side ${side.toLowerCase()}`}>{side}{order?` ${kindLabel(item)}`:''}</span><strong className={`mw-value ${order?'':workspaceTone(item.pnl)}`}>{order?(status(item)||'Pending'):money(item.pnl)}</strong><ChevronDown size={12} style={{color:'#929ba5',transform:open?'rotate(180deg)':undefined}}/></div>
        <div className="mw-subrow"><span>{lots(item)}</span><span>{price(entry,item.symbol)} {!pending?'→ '+price(history?item.closePrice:current,item.symbol):''}</span></div>
        <div className="mw-subrow"><span>{history?workspaceDate(time,true):`SL ${price(item.sl,item.symbol)} · TP ${price(item.tp,item.symbol)}`}</span><span>{history?'UTC':pending?'Pending order':'Open position'}</span></div>
      </button>
      {open && <div className="mw-expand"><WorkspaceDetails rows={details}/>
        {history ? <div className="mw-actions"><button type="button" className="mw-action primary" onClick={()=>type==='history-position'?onViewClosedPositionChart?.(item):onOpenChart?.(item.symbol)}><ArrowUpRight size={13}/>View on chart</button></div> : <>
          {!availability.allowed&&!pending&&<p className="mw-notice">{availability.reason}</p>}
          <div className="mw-actions"><button type="button" className="mw-action primary" disabled={locked} onClick={()=>pending?onModifyPending?.(item.id):chartPosition(item)}><ArrowUpRight size={13}/>Manage on chart</button><button type="button" className="mw-action danger" disabled={locked||(!pending&&!availability.allowed)} onClick={()=>setIntent({kind:pending?'cancel':'close',item,percent:100})}>{pending?'Cancel order':'Close'}</button></div>
          {!pending && <div className="mw-actions" style={{marginTop:6}}>{[25,50,75].map(percent=><button type="button" key={percent} className="mw-action" disabled={locked||!availability.allowed||!mobilePartialCloseAllowed(item,percent,market)} onClick={()=>setIntent({kind:'close',item,percent})}>Close {percent}%</button>)}<button type="button" className="mw-action" disabled={locked||!canBE} onClick={()=>setIntent({kind:'be',item})}>Break-even</button></div>}
          {intent?.item.id===item.id && <div className="mw-notice" role="group" aria-label="Confirm trade action"><p>{intent.kind==='cancel'?'Cancel this pending order':intent.kind==='be'?'Move stop loss to entry':intent.percent===100?'Close this position':`Close ${intent.percent}% of this position` }?</p><div className="mw-actions"><button type="button" className="mw-action" disabled={locked} onClick={()=>setIntent(null)}>Back</button><button type="button" className="mw-action danger" disabled={locked} onClick={execute}>Confirm</button></div></div>}
        </>}
      </div>}
    </article>;
  };
  return <MobileWorkspaceV4 title="Trades" surface="MobileTradesSheet" onClose={onClose} actions={<span>{account.accountCode || currency}</span>}>
    <nav className="mw-nav" role="tablist" aria-label="Trading workspace"><button type="button" role="tab" aria-selected={view==='trades'} onClick={()=>{setView('trades');setSymbol('');}}>Trades</button><button type="button" role="tab" aria-selected={view==='history'} onClick={()=>{setView('history');setSymbol('');}}>History</button></nav>
    {view==='trades'?<>
      <div className="mw-summary"><WorkspaceMetric label="Unrealized P&L" value={money(account.floatingPnl)} tone={workspaceTone(account.floatingPnl)}/><WorkspaceMetric label="Equity" value={money(account.equity)}/><WorkspaceMetric label="Free margin" value={money(account.freeMargin)}/></div>
      <nav className="mw-nav" role="tablist" aria-label="Active trades"><button type="button" role="tab" aria-selected={book==='positions'} onClick={()=>setBook('positions')}>Positions<small>{positions.length}</small></button><button type="button" role="tab" aria-selected={book==='pending'} onClick={()=>setBook('pending')}>Pending<small>{pendingOrders.length}</small></button></nav>
      <div className="mw-filters"><select aria-label="Filter active trades by instrument" value={symbol} onChange={e=>setSymbol(e.target.value)}><option value="">All instruments</option>{tradeSymbols.map(s=><option key={s} value={s}>{symbolLabel(s)}</option>)}</select><span style={{alignSelf:'center',fontSize:10,color:'#8f98a3',padding:'0 4px'}}>{visibleTrades.length} {book==='positions'?'positions':'orders'}</span></div>
    </>:<>
      <nav className="mw-nav" role="tablist" aria-label="History records"><button type="button" role="tab" aria-selected={historyKind==='position'} onClick={()=>setHistoryKind('position')}>Closed positions</button><button type="button" role="tab" aria-selected={historyKind==='order'} onClick={()=>setHistoryKind('order')}>Orders</button></nav>
      {historyKind==='position'&&<div className="mw-summary"><WorkspaceMetric label="Realized P&L" value={summaryReady?money(stats.pnl):'—'} tone={summaryReady?workspaceTone(stats.pnl):''}/><WorkspaceMetric label="Commission" value={summaryReady?money(stats.commission):'—'}/><WorkspaceMetric label="Swap / financing" value={summaryReady?money(stats.swap):'—'}/></div>}
      <div className="mw-filters"><select aria-label="History period" value={period} onChange={e=>setPeriod(e.target.value)}>{MOBILE_HISTORY_PERIODS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><select aria-label="History instrument" value={symbol} onChange={e=>setSymbol(e.target.value)}><option value="">All instruments</option>{historySymbols.map(s=><option key={s} value={s}>{symbolLabel(s)}</option>)}</select></div>
      {period==='custom'&&<div className="mw-dates"><label>From (UTC)<input type="date" aria-label="History start date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>To (UTC)<input type="date" aria-label="History end date" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>}
    </>}
    {readOnly&&<div className="mw-notice">Read-only account · trading actions are disabled.</div>}
    {(error||working)&&<div className="mw-notice" role="status">{error || (delayed?'Confirmation is delayed. Check status before another attempt.':'Waiting for account confirmation…')}{delayed&&<button type="button" className="mw-action" style={{marginTop:6}} disabled={checking} onClick={check}>{checking?'Checking…':'Check status'}</button>}</div>}
    <div className="mw-scroll" data-v4-trades-content>
      {view==='trades' ? visibleTrades.length?visibleTrades.map(item=>renderCard(item,`${book}:${item.id}`,book==='pending'?'pending':'position')):<div className="mw-empty">{symbol?'No matching trades':book==='positions'?'No open positions':'No pending orders'}<p>Your chart stays ready for the next trade.</p></div> : !validRange?<div className="mw-empty" role="alert">Start date must be before end date.</div>:historyError?<div className="mw-empty" role="alert">History could not be loaded.<p>{historyError}</p><button type="button" className="mw-action" onClick={onRetryHistory}>Retry history</button></div>:!historyLoaded?<div className="mw-empty" role="status">Loading trading history…</div>:rows.length?rows.map((row,index)=><React.Fragment key={row.key}>{(!index||workspaceDate(rows[index-1].time,true)!==workspaceDate(row.time,true))&&<h3 className="mw-day">{workspaceDate(row.time,true)} · UTC</h3>}{renderCard(row.item,row.key,row.kind==='position'?'history-position':'history-order',row.time)}</React.Fragment>):<div className="mw-empty">No history for these filters<p>Choose another period or instrument.</p></div>}
    </div>
  </MobileWorkspaceV4>;
}
