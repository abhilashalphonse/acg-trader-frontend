import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,Maximize2,Minimize2,MoreHorizontal} from 'lucide-react';
import {formatInstrumentPrice,instrumentForSymbol} from '../../utils/instrumentFormatting.js';
import InstrumentAvatar from './InstrumentAvatar.jsx';
import {estimatePositionPnlAtPrice} from '../../utils/tradingRisk.js';
import {positionCloseAvailability} from '../../utils/marketExecutionAvailability.js';
import {
  V4_POSITION_MIN_WIDTHS,validPositionView,finiteOrNull,fixedNumber,money,
  pnlTone,positionMargin,positionExposure,positionOpened,positionExecutionSource,
  positionUnrealizedPnl,positionRiskAtStop,positionIdentity,
} from '../../utils/v4PositionsPresentation.js';
import { PositionsAccountSummary,PositionsToolbar,PositionsExpandedDetails,PositionsExposureFooter } from './PositionsWorkspaceChromeV4.jsx';
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
function CloseMenu({menu,onClose,onManagePosition,onRequestClose,onEditProtection,onBreakEven,onSetTrailing,closeDisabled,readOnly}){
  if(!menu)return null;
  const {position,rect}=menu;
  const edge=8, width=210, estimatedContent=506;
  const below=Math.max(0,window.innerHeight-rect.bottom-edge*2);
  const above=Math.max(0,rect.top-edge*2);
  const placeAbove=below<estimatedContent&&above>below;
  const available=Math.max(112,Math.min(window.innerHeight-edge*2,placeAbove?above:below));
  const maxHeight=Math.min(estimatedContent,available);
  const top=placeAbove?Math.max(edge,rect.top-maxHeight-5):Math.min(rect.bottom+5,window.innerHeight-maxHeight-edge);
  const left=Math.min(Math.max(edge,rect.right-width),Math.max(edge,window.innerWidth-width-edge));
  const style={position:'fixed',left,top,width,maxHeight,zIndex:9999};
  const entry=finiteOrNull(position.entry),current=finiteOrNull(position.closePrice);
  const side=String(position.side||'').toUpperCase();
  const favorable=entry!=null&&current!=null&&position.valuationStatus==='LIVE'&&
    (side==='BUY'?current>entry:side==='SELL'&&current<entry);
  return createPortal(
    <div className="v4-positions-popover" role="menu" aria-label={'Actions for '+position.symbol} style={style}>
      <button role="menuitem" type="button" onClick={()=>{onManagePosition(position.id);onClose();}}>Manage position</button>
      <button role="menuitem" type="button" disabled={readOnly} onClick={()=>{onEditProtection(position.id,'sl');onClose();}}>Edit stop loss</button>
      <button role="menuitem" type="button" disabled={readOnly} onClick={()=>{onEditProtection(position.id,'tp');onClose();}}>Edit take profit</button>
      <button role="menuitem" type="button" disabled={readOnly||!favorable}
        title={!favorable?'Requires a live favorable price':'Move SL to entry'}
        onClick={()=>{onBreakEven(position.id);onClose();}}>Move to break-even</button>
      <div className="v4-positions-menu-divider" role="separator"/>
      {[5,10,20].map(pips=><button key={pips} role="menuitem" type="button" disabled={readOnly}
        onClick={()=>{onSetTrailing(position.id,true,pips);onClose();}}>Trailing stop · {pips} pips</button>)}
      {position.trailingEnabled&&<button role="menuitem" type="button" disabled={readOnly}
        onClick={()=>{onSetTrailing(position.id,false,position.trailingPips||5);onClose();}}>Disable trailing stop</button>}
      <div className="v4-positions-menu-divider" role="separator"/>
      {[25,50,75].map(percent=><button key={percent} role="menuitem" type="button" disabled={closeDisabled}
        onClick={()=>{onRequestClose(position.id,percent);onClose();}}>Review close {percent}%</button>)}
      <button role="menuitem" type="button" disabled={closeDisabled}
        onClick={()=>{onRequestClose(position.id,100);onClose();}}>Review close full position</button>
    </div>,document.body
  );
}
function InstrumentCell({position,instrument,onToggle,expanded}){
  const side=String(position.side||'').toUpperCase();
  const symbol=instrument?.displaySymbol||position.symbol||'—';
  return <span className="v4-position-instrument">
    <button type="button" className="v4-position-chevron" aria-label={(expanded?'Collapse':'Expand')+' position details for '+symbol}
      title={(expanded?'Collapse':'Expand')+' position details'} aria-expanded={expanded}
      onClick={event=>{event.stopPropagation();onToggle();}}>{expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button>
    <span className="v4-position-avatar" aria-hidden="true"><InstrumentAvatar instrument={instrument} size={24} singleAsset/></span>
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
function TableRow({position,instrument,account,view,visibleColumns,selected,expanded,onSelect,onToggle,onEditProtection,
  onReviewClose,onOpenMenu,onOpenJournal,journal,activityOrders,activityDeals,activityFills,readOnly}) {
  const id=positionIdentity(position);
  const displayed=label=>visibleColumns.includes(label);
  const margin=positionMargin(position);
  const exposure=positionExposure(position,instrument);
  const opened=positionOpened(position);
  const validClose=positionCloseAvailability(instrument);
  const sl=finiteOrNull(position.sl),tp=finiteOrNull(position.tp);
  const source=positionExecutionSource(position);
  const displayId=String(position.positionId||id);
  const currentPrice=finiteOrNull(position.closePrice);
  const stopRisk=positionRiskAtStop(position,instrument,account,estimatePositionPnlAtPrice);
  const canExpand=true;
  const rowLabel=(position.symbol||'Instrument')+' '+(position.side||'')+', '+view+' position';
  return <>
    <tr key={id} className={'v4-position-row '+(selected?'is-selected ':'')+(view==='execution'?'is-execution':'')}
      data-v4-position-id={id} aria-selected={selected} tabIndex={0} aria-label={rowLabel}
      onClick={()=>{onSelect(id);onToggle();}}
      onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(id);onToggle();}}}>
      <Cell align="left"><InstrumentCell position={position} instrument={instrument} expanded={expanded} onToggle={()=>{onSelect(id);onToggle();}}/></Cell>
      {view==='compact'&&<>
        {displayed('Size')&&<Cell>{fixedNumber(position.volume,2)} lots</Cell>}
        {displayed('Current price')&&<Cell>{currentPrice==null?'—':formatInstrumentPrice(currentPrice,instrument)}</Cell>}
        {displayed('Unrealized P&L')&&<Cell><Amount position={position} account={account}/></Cell>}
        {displayed('Actions')&&<Cell className="v4-position-actions-cell">
          <span className="v4-position-actions">
            <button type="button" className="v4-position-control v4-position-close"
              disabled={readOnly||!validClose.allowed} title={readOnly?'Account is read-only':validClose.allowed?'Review closing this position':validClose.reason}
              onClick={event=>{event.stopPropagation();onReviewClose(id);}}>Close</button>
            <button type="button" className="v4-position-control v4-position-more" aria-label={'More actions for '+position.symbol}
              title="More position actions" aria-haspopup="menu" onClick={event=>{event.stopPropagation();onOpenMenu(event,position,validClose);}}>
              <MoreHorizontal size={16}/>
            </button>
          </span>
        </Cell>}
      </>}
      {view==='risk'&&<>
        {displayed('Exposure')&&<Cell title={exposure?.description}>{exposure?fixedNumber(exposure.quantity,Number.isInteger(exposure.quantity)?0:exposure.quantity<1?4:2)+' '+exposure.unit:'—'}</Cell>}
        {displayed('Margin')&&<Cell title="Position-level reserved margin; account currency">{money(margin,account?.currency)}</Cell>}
        {['sl','tp'].map(field=>{
          const label=field==='sl'?'Stop loss':'Take profit';
          if(!displayed(label))return null;
          const value=field==='sl'?sl:tp;
          return <Cell key={field}><button type="button" className="v4-position-protection"
            title={(value==null?'Add ':'Edit ')+(field==='sl'?'stop loss':'take profit')+' for '+position.symbol}
            aria-label={(value==null?'Add ':'Edit ')+(field==='sl'?'stop loss':'take profit')+' for '+position.symbol}
            disabled={readOnly} onClick={event=>{event.stopPropagation();onEditProtection(id,field);}}>
            {value==null?'+ Add':formatInstrumentPrice(value,instrument)}
          </button></Cell>;
        })}
        {displayed('Risk at stop')&&<Cell title={sl==null?'No stop loss configured':'Estimated adverse P&L to stop in account currency; fees and swaps are not independently included'}>{sl==null||stopRisk==null?'—':money(stopRisk,account?.currency)}</Cell>}
        {displayed('Unrealized P&L')&&<Cell><Amount position={position} account={account}/></Cell>}
      </>}
      {view==='execution'&&<>
        {displayed('Size')&&<Cell>{fixedNumber(position.volume,2)} lots</Cell>}
        {displayed('Entry price')&&<Cell>{formatInstrumentPrice(position.entry,instrument)}</Cell>}
        {displayed('Opened')&&<Cell align="left" title={opened?.iso||'Fill timestamp unavailable'}>
          <span className="v4-position-time">{opened?<><span>{opened.date}</span><span>{opened.time} {opened.offset}</span></>:'—'}</span>
        </Cell>}
        {displayed('Source')&&<Cell align="left" title={source==='—'?'Execution source unavailable':source}>{source}</Cell>}
        {displayed('Position ID')&&<Cell title={displayId}><span className="v4-position-id">{displayId}</span></Cell>}
      </>}
    </tr>
    {canExpand&&expanded&&<tr className="v4-position-detail-row" data-v4-position-detail={id}>
      <td colSpan={visibleColumns.length}>
        <PositionsExpandedDetails position={position} instrument={instrument} account={account}
          view={view} visibleColumns={visibleColumns}
          journal={journal} activityOrders={activityOrders} activityDeals={activityDeals} activityFills={activityFills} onEditProtection={onEditProtection} readOnly={readOnly}
          onOpenJournal={onOpenJournal}/>
      </td>
    </tr>}
  </>;
}
export default function PositionsDockV4({
  positions=[],markets=[],account={},counts={},journal=[],positionActivityOrders=[],positionActivityDeals=[],positionActivityFills=[],onTabChange=()=>{},
  selectedPositionId=null,onSelectPosition=()=>{},onManagePosition=()=>{},onEditProtection=()=>{},
  onRequestClose=()=>{},onBreakEven=()=>{},onSetTrailing=()=>{},collapsed=false,compactDock=false,expanded=false,
  onToggleExpanded=()=>{},loading=false,error=null,onRetry=()=>{},readOnly=false,
}){
  const [view,setView]=useState(initialView);
  const [expandedIds,setExpandedIds]=useState(()=>new Set());
  const scrollerRef=useRef(null);
  const revealRef=useRef(null);
  const [menu,setMenu]=useState(null);
  const [query,setQuery]=useState('');
  const [instrumentFilter,setInstrumentFilter]=useState('');
  const [hiddenByView,setHiddenByView]=useState({});
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
    return ()=>{
      window.removeEventListener('pointerdown',closeOnOutside);
      window.removeEventListener('keydown',escape);
    };
  },[menu]);
  const toggleRow=id=>setExpandedIds(current=>{
    const opening=!current.has(id);
    const next=new Set();
    if(opening)next.add(id); // Single expanded position keeps details focused.
    if(opening)revealRef.current=id;
    return next;
  });
  useEffect(()=>{
    const id=revealRef.current;
    if(!id||!expandedIds.has(id))return;
    const scroller=scrollerRef.current;
    const detail=scroller&&Array.from(scroller.querySelectorAll('[data-v4-position-detail]'))
      .find(item=>item.getAttribute('data-v4-position-detail')===id);
    if(!detail)return;
    const raf=window.requestAnimationFrame(()=>{
      const current=scrollerRef.current;
      const row=current&&Array.from(current.querySelectorAll('[data-v4-position-id]'))
        .find(item=>item.getAttribute('data-v4-position-id')===id);
      if(!current||!row)return;
      const bounds=current.getBoundingClientRect();
      const rowBounds=row.getBoundingClientRect();
      // Preserve the dock height. Put the expanded position below the sticky
      // column headings when needed; longer details scroll inside this dock.
      const delta=rowBounds.top-bounds.top-33;
      if(delta>1)current.scrollTo({top:current.scrollTop+delta,behavior:'auto'});
      revealRef.current=null;
    });
    return ()=>window.cancelAnimationFrame(raf);
  },[expandedIds]);
  const openMenu=(event,position,closeAvailability)=>{
    if(menu?.position.id===position.id){onCloseMenu();return;}
    setMenu({position,rect:event.currentTarget.getBoundingClientRect(),closeDisabled:!closeAvailability.allowed});
  };
  const hiddenColumns=hiddenByView[view]||[];
  const visibleColumns=columns[view].filter(([label])=>label==='Instrument'||!hiddenColumns.includes(label));
  const validSymbols=[...new Set(positions.map(item=>String(item.symbol||'').trim()).filter(Boolean))].sort();
  const visiblePositions=positions.filter(position=>{
    if(instrumentFilter&&position.symbol!==instrumentFilter)return false;
    if(!query.trim())return true;
    const pattern=query.trim().toLowerCase();
    return [position.symbol,position.positionId,position.id,position.side]
      .some(value=>String(value||'').toLowerCase().includes(pattern));
  });
  const toggleColumn=label=>{
    if(label==='Instrument')return;
    setHiddenByView(current=>{
      const hidden=current[view]||[];
      const next=hidden.includes(label)?hidden.filter(item=>item!==label):[...hidden,label];
      return {...current,[view]:next};
    });
  };
  const tabs=[['positions','Positions'],['orders','Pending'],['history','History'],['journal','Journal']];
  return <div className="acg-v4-positions" data-v4-positions="true" data-v4-position-view={view}>
    <div className="v4-positions-header">
      <nav aria-label="Trading activity tabs" className="v4-positions-tabs">
        {tabs.map(([key,label])=><button key={key} className={'v4-positions-tab '+(key==='positions'?'is-active':'')}
          type="button" aria-current={key==='positions'?'page':undefined} onClick={()=>onTabChange(key)}>
          {label}{(key==='positions'||key==='orders')&&<span className="v4-positions-count">{counts[key]??0}</span>}
        </button>)}
      </nav>
      <div className="v4-positions-header-right">
        <PositionsAccountSummary account={account}/>
        <button type="button" className="v4-positions-expand" onClick={onToggleExpanded}
          aria-label={expanded?'Restore positions workspace':'Expand positions workspace'}
          title={expanded?'Restore workspace':'Expand positions workspace'}>
          {expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}
        </button>
      </div>
    </div>
    {!collapsed&&!compactDock&&<>
      <PositionsToolbar view={view} onView={setView} query={query} onQuery={setQuery}
        instrument={instrumentFilter} onInstrument={setInstrumentFilter} instruments={validSymbols}
        columns={columns[view]} hiddenColumns={hiddenColumns} onToggleColumn={toggleColumn}
        onResetColumns={()=>setHiddenByView(current=>({...current,[view]:[]}))}/>
      <div ref={scrollerRef} className="v4-positions-scroller" data-v4-position-scroller="true">
        <table className="v4-positions-table" style={{minWidth:V4_POSITION_MIN_WIDTHS[view]}}>
          <colgroup>{visibleColumns.map(([label,width])=><col key={label} style={{width}}/>)}</colgroup>
          <thead><tr>{visibleColumns.map(([label,,align])=><th scope="col" key={label} className={align==='left'?'is-left':'is-right'}>{label}</th>)}</tr></thead>
          <tbody>
            {loading&&!positions.length&&Array.from({length:3},(_,i)=><tr key={i} className="v4-positions-skeleton" aria-hidden="true">
              {visibleColumns.map(([label])=><td key={label}><span/></td>)}
            </tr>)}
            {!loading&&!error&&!positions.length&&<tr><td colSpan={visibleColumns.length}>
              <div className="v4-positions-empty"><strong>No open positions</strong><span>Your active positions will appear here.</span></div>
            </td></tr>}
            {!loading&&!error&&positions.length>0&&!visiblePositions.length&&<tr><td colSpan={visibleColumns.length}>
              <div className="v4-positions-empty"><strong>No matching positions</strong><span>Change your search or instrument filter.</span></div>
            </td></tr>}
            {visiblePositions.map(position=>{
              const id=positionIdentity(position);
              return <TableRow key={id} position={position} instrument={instrumentForSymbol(markets,position.symbol)}
                account={account} view={view} visibleColumns={visibleColumns.map(([name])=>name)}
                selected={String(selectedPositionId)===id}
                expanded={expandedIds.has(id)} onSelect={onSelectPosition} onToggle={()=>toggleRow(id)}
                journal={journal} activityOrders={positionActivityOrders} activityDeals={positionActivityDeals} activityFills={positionActivityFills} onOpenJournal={()=>onTabChange('history')}
                onEditProtection={onEditProtection} onReviewClose={onRequestClose} onOpenMenu={openMenu} readOnly={readOnly}/>;
            })}
          </tbody>
        </table>
        {error&&<div className="v4-positions-error" role="alert">
          <span>{String(error)}</span><button type="button" onClick={onRetry}>Retry</button>
        </div>}
      </div>
      <PositionsExposureFooter positions={positions} markets={markets}/>
    </>}
    <CloseMenu menu={menu} onClose={onCloseMenu} onManagePosition={onManagePosition}
      onRequestClose={onRequestClose} onEditProtection={onEditProtection} onBreakEven={onBreakEven} onSetTrailing={onSetTrailing} closeDisabled={menu?.closeDisabled||readOnly} readOnly={readOnly}/>
  </div>;
}
