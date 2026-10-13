import React,{useState} from 'react';
import {Maximize2,Minimize2} from 'lucide-react';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import {instrumentForSymbol,formatInstrumentPrice} from '../../utils/instrumentFormatting.js';
import {finiteOrNull,money,pnlTone,fixedNumber} from '../../utils/v4PositionsPresentation.js';
import {PositionsAccountSummary} from './PositionsWorkspaceChromeV4.jsx';
import {filterActivity,V4_ACTIVITY_RANGES,activityTimestamp} from '../../utils/v4ActivityRanges.js';
import './PositionsDockV4.css';
import './ActivityDockV4.css';

function formatStamp(ms) {
  if(ms==null)return '—';
  const d=new Date(ms);
  return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
const present=number=>finiteOrNull(number)==null?'—':fixedNumber(number,2);
const kindLabel=kind=>String(kind||'event').replaceAll('_',' ').toUpperCase();
export default function ActivityDockV4({
  tab='history',onTabChange=()=>{},counts={},account={},markets=[],history=[],journal=[],
  collapsed=false,compactDock=false,expanded=false,onToggleExpanded=()=>{},
  historyError=null,historyLoading=false,onRetry=()=>{},
}){
  const [rangeByTab,setRangeByTab]=useState({history:'30D',journal:'30D'});
  const [showAccount,setShowAccount]=useState(true);
  const range=rangeByTab[tab]||'30D';
  const isHistory=tab==='history';
  const data=filterActivity(isHistory?history:journal,range,tab);
  const pnl=isHistory?data.reduce((sum,item)=>sum+(finiteOrNull(item.pnl)??0),0):0;
  const pnlValid=isHistory&&data.some(item=>finiteOrNull(item.pnl)!=null);
  const currency=account?.currency||'USD';
  const tabs=[['positions','Positions'],['orders','Pending'],['history','History'],['journal','Journal']];
  return <div className="acg-v4-positions acg-v4-activity-dock" data-v4-activity={tab} data-v4-activity-range={range}>
    <div className="v4-positions-header">
      <nav aria-label="Trading activity tabs" className="v4-positions-tabs">
        {tabs.map(([key,label])=><button key={key} type="button"
          className={'v4-positions-tab '+(tab===key?'is-active':'')}
          aria-current={tab===key?'page':undefined} onClick={()=>onTabChange(key)}>
          {label}{(key==='positions'||key==='orders')&&<span className="v4-positions-count">{counts[key]??0}</span>}
        </button>)}
      </nav>
      <div className="v4-positions-header-right">
        {showAccount&&<PositionsAccountSummary account={account}/>}
        <button type="button" className="v4-positions-expand" onClick={onToggleExpanded}
          aria-label={expanded?'Restore workspace':'Expand workspace'} title={expanded?'Restore workspace':'Expand workspace'}>
          {expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}
        </button>
      </div>
    </div>
    {!collapsed&&!compactDock&&<>
      <div className="v4-activity-toolbar">
        <div className="v4-activity-summary">
          <strong>{isHistory?'Closed positions':'Local activity journal'}</strong>
          <span>{data.length} {data.length===1?'record':'records'} in selected range</span>
          {pnlValid&&<span>Realized P&amp;L <b className={'v4-position-pnl '+pnlTone(pnl)}>{money(pnl,currency,true)}</b></span>}
        </div>
        <div className="v4-activity-options">
          <div className="v4-positions-selector" role="group" aria-label={isHistory?'History date range':'Journal date range'}>
            {V4_ACTIVITY_RANGES.map(option=><button key={option} type="button"
              aria-pressed={range===option} className={range===option?'is-active':''}
              onClick={()=>setRangeByTab(current=>({...current,[tab]:option}))}>{option}</button>)}
          </div>
          <button type="button" className="v4-activity-toggle" aria-pressed={showAccount}
            onClick={()=>setShowAccount(x=>!x)} title="Toggle account summary">Overview</button>
        </div>
      </div>
      <div className="v4-positions-scroller v4-activity-scroller">
        {isHistory?<table className="v4-positions-table v4-activity-table" style={{minWidth:1120}}>
          <thead><tr>
            {['Instrument','Side','Size','Entry','Exit','Opened','Closed','Realized P&L','Commission','Swap','Close reason'].map((label,i)=>
              <th key={label} scope="col" className={i===0||i===5||i===6||i===10?'is-left':'is-right'}>{label}</th>)}
          </tr></thead><tbody>
            {data.map(item=>{
              const instrument=instrumentForSymbol(markets,item.symbol);
              const id=String(item.id||item.positionId||'');
              const hasCommission=item.raw?.commissionPaid!=null||
                item.executionEvents?.some(event=>event.raw?.commission!=null);
              const hasSwap=item.raw?.swapPaid!=null||
                item.executionEvents?.some(event=>event.raw?.swap!=null);
              return <tr key={id} className="v4-activity-row">
                <td><span className="v4-activity-symbol"><InstrumentAvatar instrument={instrument} size={20}/>
                  <strong>{instrument?.displaySymbol||item.symbol||'—'}</strong></span></td>
                <td className="is-right"><span className={'v4-position-side '+(String(item.side).toUpperCase()==='BUY'?'is-buy':'is-sell')}>{String(item.side||'—').toUpperCase()}</span></td>
                <td className="is-right">{present(item.volume)} lots</td>
                <td className="is-right">{formatInstrumentPrice(item.entry,instrument)}</td>
                <td className="is-right">{formatInstrumentPrice(item.closePrice,instrument)}</td>
                <td>{item.raw?.openedAt?formatStamp(Date.parse(item.raw.openedAt)):'—'}</td>
                <td>{formatStamp(activityTimestamp(item,'history'))}</td>
                <td className="is-right"><span className={'v4-position-pnl '+pnlTone(item.pnl)}>{money(item.pnl,item.pnlCurrency||currency,true)}</span></td>
                <td className="is-right" title="Recorded commission; never subtracted twice">{!hasCommission?'—':money(item.commission,currency)}</td>
                <td className="is-right" title="Recorded financing/swap">{!hasSwap?'—':money(item.swap,currency,true)}</td>
                <td title={String(item.closeType||'')}>{item.closeType||'—'}</td>
              </tr>;
            })}
          </tbody>
        </table>:<table className="v4-positions-table v4-activity-table v4-journal-table" style={{minWidth:760}}>
          <thead><tr>{['Timestamp','Event','Instrument','Description','Reference / Result'].map(label=><th scope="col" key={label} className="is-left">{label}</th>)}</tr></thead>
          <tbody>{data.map(item=><tr key={item.id} className="v4-activity-row">
            <td>{formatStamp(activityTimestamp(item,'journal'))}</td>
            <td><span className="v4-activity-type">{kindLabel(item.type)}</span></td>
            <td>{item.symbol||'—'}</td>
            <td title={String(item.message||'')}>{item.message||'—'}</td>
            <td title={String(item.positionId||item.orderId||'')}>{item.positionId||item.orderId||item.latencyMs!=null&&('Execution '+item.latencyMs+'ms')||'—'}</td>
          </tr>)}</tbody>
        </table>}
        {!historyLoading&&data.length===0&&<div className="v4-positions-empty">
          <strong>{isHistory?'No closed positions in this period':'No local journal activity in this period'}</strong>
          <span>{isHistory?'Closed trades with verified timestamps will appear here.':'Journal entries are local to this browser.'}</span>
        </div>}
        {isHistory&&historyLoading&&<div className="v4-positions-empty" role="status">Loading trade history…</div>}
        {isHistory&&historyError&&<div className="v4-positions-error" role="alert">
          <span>History unavailable: {String(historyError)}</span>
          <button type="button" onClick={onRetry}>Retry</button>
        </div>}
      </div>
      <div className="v4-positions-footer">
        <span>{isHistory?'Closed trades':'Local journal events'} · {range}</span>
        <span>Older than 1 calendar month is not displayed</span>
      </div>
    </>}
  </div>;
}
