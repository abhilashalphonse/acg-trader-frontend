import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,Maximize2,Minimize2,MoreHorizontal} from 'lucide-react';
import {formatInstrumentPrice,instrumentForSymbol} from '../../utils/instrumentFormatting.js';
import {estimatePositionPnlAtPrice} from '../../utils/tradingRisk.js';
import {positionCloseAvailability} from '../../utils/marketExecutionAvailability.js';
import {
  V4_POSITION_MIN_WIDTHS,validPositionView,finiteOrNull,fixedNumber,money,
  pnlTone,positionMargin,positionExposure,positionOpened,positionExecutionSource,
  positionUnrealizedPnl,positionRiskAtStop,positionIdentity,
} from '../../utils/v4PositionsPresentation.js';
import './PositionsDockV4.css';

const STORAGE_KEY='acg-v4-positions-view-v1';
const columns={
  compact:[['Instrument','26%','left'],['Size','15%','right'],['Current price','21%','right'],['Unrealized P&L','20%','right'],['Actions','18%','right']],
  risk:[['Instrument','22%','left'],['Exposure','15%','right'],['Margin','12%','right'],['Stop loss','13%','right'],['Take profit','13%','right'],['Risk at stop','12%','right'],['Unrealized P&L','13%','right']],
  execution:[['Instrument','25%','left'],['Size','13%','right'],['Entry price','17%','right'],['Opened','23%','left'],['Source','10%','left'],['Position ID','12%','right']],
};
function initialView(){
  if(typeof window==='undefined')return 'compact';
  try {return validPositionView(window.localStorage.getItem(STORAGE_KEY));}
  catch {return 'compact';}
}
const classForPnl=value=>'v4-position-pnl '+pnlTone(value);
function CloseMenu({menu,onClose,onSelect,onRequestClose,onEditProtection,closeDisabled}){
  if(!menu)return null;
  const {position,rect}=menu;
  const top=Math.min(window.innerHeight-154,rect.bottom+5);
  const style={position:'fixed',left:Math.max(8,rect.right-186),top:Math.max(8,top),width:186,zIndex:9999};
  return createPortal(
    <div className="v4-positions-popover" role="menu" aria-label={'Actions for '+position.symbol} style={style}>
      <button role="menuitem" type="button" onClick={()=>{onSelect(position.id);onClose();}}>Manage position</button>
      <button role="menuitem" type="button" onClick={()=>{onEditProtection(position.id,'sl');onClose();}}>Edit stop loss</button>
      <button role="menuitem" type="button" onClick={()=>{onEditProtection(position.id,'tp');onClose();}}>Edit take profit</button>
      <button role="menuitem" type="button" disabled={closeDisabled}
        onClick={()=>{onRequestClose(position.id);onClose();}}>Review close</button>
    </div>,document.body
  );
}
function InstrumentCell({position,instrument,execution,onToggle,expanded}){
  const side=String(position.side||'').toUpperCase();
  const symbol=instrument?.displaySymbol||position.symbol||'—';
  return <span className="v4-position-instrument">
    {execution&&<button type="button" className="v4-position-chevron" aria-label={(expanded?'Collapse':'Expand')+' execution details for '+symbol}
      title={(expanded?'Collapse':'Expand')+' execution details'} aria-expanded={expanded}
      onClick={event=>{event.stopPropagation();onToggle();}}>{expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button>}
    <strong title={symbol}>{symbol}</strong>
    <span className={'v4-position-side '+(side==='BUY'?'is-buy':'is-sell')}>{side||'—'}</span>
  </span>;
}
function Cell({children,align='right',title,className=''}) {
  return <td className={'v4-position-cell '+(align==='left'?'is-left':'is-right')+' '+className} title={title}>
    <span className="v4-position-cell-inner">{children}</span>
  </td>;
}
function Amount({position,account}){
  const pnl=positionUnrealizedPnl(position,account);
  return <span className={classForPnl(pnl.value)}
    title={'Floating P&L in '+pnl.currency+'. Commission/swap treatment follows the authoritative account valuation; no frontend adjustment is applied.'}>
    {money(pnl.value,pnl.currency,true)}
  </span>;
}
function TableRow({position,instrument,account,view,selected,expanded,onSelect,onToggle,onEditProtection,onReviewClose,onOpenMenu}){
  const id=positionIdentity(position);
  const margin=positionMargin(position);
  const exposure=positionExposure(position,instrument);
  const opened=positionOpened(position);
  const validClose=positionCloseAvailability(instrument);
  const sl=finiteOrNull(position.sl),tp=finiteOrNull(position.tp);
  const source=positionExecutionSource(position);
  const displayId=String(position.positionId||id);
  const currentPrice=finiteOrNull(position.closePrice);
  const stopRisk=positionRiskAtStop(position,instrument,account,estimatePositionPnlAtPrice);
  const rowLabel=(position.symbol||'Instrument')+' '+(position.side||'')+', '+view+' position';
  return <>
    <tr key={id} className={'v4-position-row '+(selected?'is-selected ':'')+(view==='execution'?'is-execution':'')}
      data-v4-position-id={id} aria-selected={selected} tabIndex={0} aria-label={rowLabel}
      onClick={()=>onSelect(id)}
      onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(id);}}}>
      <Cell align="left"><InstrumentCell position={position} instrument={instrument} execution={view==='execution'} expanded={expanded} onToggle={onToggle}/></Cell>
      {view==='compact'&&<>
        <Cell>{fixedNumber(position.volume,2)} lots</Cell>
        <Cell>{currentPrice==null?'—':formatInstrumentPrice(currentPrice,instrument)}</Cell>
        <Cell><Amount position={position} account={account}/></Cell>
        <Cell className="v4-position-actions-cell">
          <span className="v4-position-actions">
            <button type="button" className="v4-position-control v4-position-close"
              disabled={!validClose.allowed} title={validClose.allowed?'Review closing this position':validClose.reason}
              onClick={event=>{event.stopPropagation();onReviewClose(id);}}>Close</button>
            <button type="button" className="v4-position-control v4-position-more" aria-label={'More actions for '+position.symbol}
              title="More position actions" aria-haspopup="menu" onClick={event=>{event.stopPropagation();onOpenMenu(event,position,validClose);}}>
              <MoreHorizontal size={16}/>
            </button>
          </span>
        </Cell>
      </>}
      {view==='risk'&&<>
        <Cell title={exposure?.description}>{exposure?fixedNumber(exposure.quantity,Number.isInteger(exposure.quantity)?0:exposure.quantity<1?4:2)+' '+exposure.unit:'—'}</Cell>
        <Cell title="Position-level reserved margin; account currency">{money(margin,account?.currency)}</Cell>
        {['sl','tp'].map(field=>{
          const value=field==='sl'?sl:tp;
          return <Cell key={field}><button type="button" className="v4-position-protection"
            title={(value==null?'Add ':'Edit ')+(field==='sl'?'stop loss':'take profit')+' for '+position.symbol}
            aria-label={(value==null?'Add ':'Edit ')+(field==='sl'?'stop loss':'take profit')+' for '+position.symbol}
            onClick={event=>{event.stopPropagation();onEditProtection(id,field);}}>
            {value==null?'+ Add':formatInstrumentPrice(value,instrument)}
          </button></Cell>;
        })}
        <Cell title={sl==null?'No stop loss configured':'Estimated adverse P&L to stop in account currency; fees and swaps are not independently included'}>{sl==null||stopRisk==null?'—':money(stopRisk,account?.currency)}</Cell>
        <Cell><Amount position={position} account={account}/></Cell>
      </>}
      {view==='execution'&&<>
        <Cell>{fixedNumber(position.volume,2)} lots</Cell>
        <Cell>{formatInstrumentPrice(position.entry,instrument)}</Cell>
        <Cell align="left" title={opened?.iso||'Fill timestamp unavailable'}>
          <span className="v4-position-time">{opened?<><span>{opened.date}</span><span>{opened.time} {opened.offset}</span></>:'—'}</span>
        </Cell>
        <Cell align="left" title={source==='—'?'Execution source unavailable':source}>{source}</Cell>
        <Cell title={displayId}><span className="v4-position-id">{displayId}</span></Cell>
      </>}
    </tr>
    {view==='execution'&&expanded&&
      <tr className="v4-position-detail-row" data-v4-position-detail={id}>
        <td colSpan={6}>
          <div className="v4-position-detail">
            <div><span>Position ID</span><strong>{displayId}</strong></div>
            <div><span>Fill time</span><strong>{opened?opened.date+' · '+opened.time+' '+opened.offset:'—'}</strong></div>
            <div><span>Entry price</span><strong>{formatInstrumentPrice(position.entry,instrument)}</strong></div>
            <div><span>Opening source</span><strong>{source}</strong></div>
            <div><span>Order ID</span><strong>{String(position.raw?.sourceOrderId||'—')}</strong></div>
          </div>
        </td>
      </tr>}
  </>;
}
export default function PositionsDockV4({
  positions=[],markets=[],account={},counts={},onTabChange=()=>{},
  selectedPositionId=null,onSelectPosition=()=>{},onEditProtection=()=>{},
  onRequestClose=()=>{},collapsed=false,compactDock=false,expanded=false,
  onToggleExpanded=()=>{},loading=false,error=null,onRetry=()=>{},
}){
  const [view,setView]=useState(initialView);
  const [expandedIds,setExpandedIds]=useState(()=>new Set());
  const [menu,setMenu]=useState(null);
  const onCloseMenu=()=>setMenu(null);
  useEffect(()=>{
    try {window.localStorage.setItem(STORAGE_KEY,view);} catch { /* storage disabled */ }
    onCloseMenu();
  },[view]);
  useEffect(()=>{
    if(!menu)return undefined;
    const closeOnOutside=event=>{
      if(!event.target.closest('.v4-positions-popover, .v4-position-more'))onCloseMenu();
    };
    const escape=event=>{if(event.key==='Escape')onCloseMenu();};
    window.addEventListener('pointerdown',closeOnOutside);
    window.addEventListener('keydown',escape);
    window.addEventListener('scroll',onCloseMenu,true);
    window.addEventListener('resize',onCloseMenu);
    return ()=>{
      window.removeEventListener('pointerdown',closeOnOutside);
      window.removeEventListener('keydown',escape);
      window.removeEventListener('scroll',onCloseMenu,true);
      window.removeEventListener('resize',onCloseMenu);
    };
  },[menu]);
  const toggleRow=id=>setExpandedIds(current=>{
    const next=new Set(current);
    if(next.has(id))next.delete(id);else next.add(id);
    return next;
  });
  const openMenu=(event,position,closeAvailability)=>{
    if(menu?.position.id===position.id){onCloseMenu();return;}
    setMenu({position,rect:event.currentTarget.getBoundingClientRect(),closeDisabled:!closeAvailability.allowed});
  };
  const tabs=[['positions','Positions'],['orders','Pending'],['history','History'],['journal','Journal']];
  return <div className="acg-v4-positions" data-v4-positions="true" data-v4-position-view={view}>
    <div className="v4-positions-header">
      <nav aria-label="Trading activity tabs" className="v4-positions-tabs">
        {tabs.map(([key,label])=><button key={key} className={'v4-positions-tab '+(key==='positions'?'is-active':'')}
          type="button" aria-current={key==='positions'?'page':undefined} onClick={()=>onTabChange(key)}>
          {label}<span className="v4-positions-count">{counts[key]??0}</span>
        </button>)}
      </nav>
      <div className="v4-positions-header-right">
        <div className="v4-positions-selector" role="group" aria-label="Positions table view">
          {['compact','risk','execution'].map(mode=><button key={mode} type="button"
            aria-pressed={mode===view} className={mode===view?'is-active':''}
            onClick={()=>setView(mode)}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}
        </div>
        <button type="button" className="v4-positions-expand" onClick={onToggleExpanded}
          aria-label={expanded?'Restore positions workspace':'Expand positions workspace'}
          title={expanded?'Restore workspace':'Expand positions workspace'}>
          {expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}
        </button>
      </div>
    </div>
    {!collapsed&&!compactDock&&<div className="v4-positions-scroller" data-v4-position-scroller="true">
      <table className="v4-positions-table" style={{minWidth:V4_POSITION_MIN_WIDTHS[view]}}>
        <colgroup>{columns[view].map(([label,width])=><col key={label} style={{width}}/>)}</colgroup>
        <thead><tr>{columns[view].map(([label,,align])=><th scope="col" key={label} className={align==='left'?'is-left':'is-right'}>{label}</th>)}</tr></thead>
        <tbody>
          {loading&&!positions.length&&Array.from({length:3},(_,i)=><tr key={i} className="v4-positions-skeleton" aria-hidden="true">
            {columns[view].map(([label])=><td key={label}><span/></td>)}
          </tr>)}
          {!loading&&!error&&!positions.length&&<tr><td colSpan={columns[view].length}>
            <div className="v4-positions-empty"><strong>No open positions</strong><span>Your active positions will appear here.</span></div>
          </td></tr>}
          {positions.map(position=>{
            const id=positionIdentity(position);
            return <TableRow key={id} position={position} instrument={instrumentForSymbol(markets,position.symbol)}
              account={account} view={view} selected={String(selectedPositionId)===id}
              expanded={expandedIds.has(id)} onSelect={onSelectPosition} onToggle={()=>toggleRow(id)}
              onEditProtection={onEditProtection} onReviewClose={onRequestClose} onOpenMenu={openMenu}/>;
          })}
        </tbody>
      </table>
      {error&&<div className="v4-positions-error" role="alert">
        <span>{String(error)}</span><button type="button" onClick={onRetry}>Retry</button>
      </div>}
    </div>}
    <CloseMenu menu={menu} onClose={onCloseMenu} onSelect={onSelectPosition}
      onRequestClose={onRequestClose} onEditProtection={onEditProtection} closeDisabled={menu?.closeDisabled}/>
  </div>;
}
