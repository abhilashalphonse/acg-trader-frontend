import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Bell,BellPlus,GripVertical,Pause,Plus,Settings2,Trash2} from 'lucide-react';
import {LineStyle} from 'lightweight-charts';
import {useAlerts} from './AlertsWorkspace.jsx';
import {chartAlertEntries,chartAlertLabel,chartAlertPrice,movedAlertCondition} from './chartAlertPresentation.js';
import './chartAlerts.css';

export default function ChartAlertsOverlay({chart,series,hostRef,symbol,instrument,theme='dark'}){
  const alerts=useAlerts(),enabled=alerts?.enabled;
  const entries=useMemo(()=>chartAlertEntries(alerts?.rules||[],symbol),[alerts?.rules,symbol]);
  const [view,setView]=useState({width:0,height:0,rows:[]}),[hovered,setHovered]=useState(null);
  const [pointer,setPointer]=useState(null),[menu,setMenu]=useState(null),[preview,setPreview]=useState(null),[notice,setNotice]=useState('');
  const previewRef=useRef(preview);previewRef.current=preview;
  const geometry=useRef(view),drag=useRef(null),pending=useRef(false),lines=useRef(new Map()),menuRef=useRef(null);
  const light=theme==='light';
  const update=useCallback(()=>{
    if(!chart||!series||!hostRef.current)return;
    try{
      const size=chart.paneSize(0);
      const next={width:size.width,height:size.height,rows:entries.map(entry=>{
        const draft=previewRef.current;
        const value=draft?.key===entry.key?Number(draft.value):entry.price;
        const y=series.priceToCoordinate(value);
        return {...entry,displayPrice:value,y:y==null?null:Number(y)};
      }).filter(entry=>entry.y!=null&&Number.isFinite(entry.y)&&entry.y>=10&&entry.y<=size.height-12)};
      geometry.current=next;
      setView(previous=>previous.width===next.width&&previous.height===next.height&&previous.rows.length===next.rows.length&&previous.rows.every((row,i)=>row.key===next.rows[i].key&&Math.abs(row.y-next.rows[i].y)<0.1&&row.displayPrice===next.rows[i].displayPrice&&row.rule===next.rows[i].rule)?previous:next);
    }catch{/* The chart may be disposing during a symbol switch. */}
  },[chart,series,hostRef,entries]);
  useEffect(()=>{
    if(!enabled||!chart||!series)return;
    const native=new Map();
    for(const entry of entries){
      native.set(entry.key,series.createPriceLine({price:entry.price,color:light?'#676C74':'#737883',lineWidth:1,lineStyle:LineStyle.Dashed,
        axisLabelVisible:true,axisLabelColor:light?'#30343A':'#30343B',axisLabelTextColor:'#F8FAFC',title:''}));
    }
    lines.current=native;
    return()=>{for(const line of native.values()){try{series.removePriceLine(line);}catch{/* chart disposed */}}lines.current=new Map();};
  },[enabled,chart,series,entries,light]);
  useEffect(()=>{
    for(const entry of entries){
      lines.current.get(entry.key)?.applyOptions({price:preview?.key===entry.key?Number(preview.value):entry.price,
        lineStyle:preview?.key===entry.key?LineStyle.Dotted:LineStyle.Dashed,
        color:preview?.key===entry.key?(light?'#333841':'#D0D4DC'):(light?'#676C74':'#737883')});
    }
    update();
  },[entries,preview,light,update]);
  useEffect(()=>{
    const host=hostRef.current,surface=host?.parentElement;
    if(!enabled||!chart||!series||!surface)return;
    let frame=null;
    const schedule=()=>{if(frame==null)frame=requestAnimationFrame(()=>{frame=null;update();});};
    const point=event=>{
      const rect=host.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,size=geometry.current;
      return x>=0&&x<=rect.width&&y>=10&&y<size.height-10?{x,y}:null;
    };
    const move=event=>{
      schedule();if(drag.current)return;
      const p=point(event);
      if(!p){setPointer(null);return;}
      const size=geometry.current;
      const overAxis=p.x>=size.width-24&&p.x<=host.clientWidth;
      setPointer(overAxis&&event.pointerType!=='touch'?{y:p.y,price:series.coordinateToPrice(p.y)}:null);
      if(event.target.closest?.('[data-chart-alert-tag]'))return;
      const closest=size.rows.reduce((best,row)=>Math.abs(row.y-p.y)<(best?Math.abs(best.y-p.y):7)?row:best,null);
      setHovered(closest?.key||null);
    };
    const leave=event=>{if(event.pointerType==='touch')return;if(!drag.current){setPointer(null);setHovered(null);}};
    const context=event=>{
      if(event.defaultPrevented||event.target.closest?.('button,input,select,textarea,[role="menu"]'))return;
      const p=point(event);if(!p)return;
      const value=chartAlertPrice(series.coordinateToPrice(p.y),instrument);if(!value)return;
      event.preventDefault();event.stopPropagation();
      setMenu({x:Math.max(6,Math.min(p.x,host.clientWidth-300)),y:Math.max(6,Math.min(p.y,host.clientHeight-130)),price:value});
    };
    const touch=event=>{if(event.pointerType==='touch')move(event);};
    const escape=event=>{if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();drag.current=null;setPreview(null);}};
    const blur=()=>{drag.current=null;setPreview(null);setMenu(null);setPointer(null);setHovered(null);};
    const time=chart.timeScale();
    time.subscribeVisibleLogicalRangeChange(schedule);time.subscribeSizeChange(schedule);series.subscribeDataChanged(schedule);
    surface.addEventListener('pointermove',move);surface.addEventListener('pointerleave',leave);
    surface.addEventListener('contextmenu',context);surface.addEventListener('pointerdown',touch);window.addEventListener('keydown',escape,true);window.addEventListener('blur',blur);
    surface.addEventListener('wheel',schedule,{passive:true});window.addEventListener('pointerup',schedule);
    const observer=new ResizeObserver(schedule);observer.observe(host);schedule();
    return()=>{
      time.unsubscribeVisibleLogicalRangeChange(schedule);time.unsubscribeSizeChange(schedule);series.unsubscribeDataChanged(schedule);
      surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerleave',leave);surface.removeEventListener('contextmenu',context);surface.removeEventListener('pointerdown',touch);window.removeEventListener('keydown',escape,true);window.removeEventListener('blur',blur);
      surface.removeEventListener('wheel',schedule);window.removeEventListener('pointerup',schedule);observer.disconnect();
      if(frame!=null)cancelAnimationFrame(frame);
    };
  },[enabled,chart,series,hostRef,instrument,update]);
  useEffect(()=>{
    if(!menu)return;
    const outside=event=>{if(!menuRef.current?.contains(event.target))setMenu(null);};
    const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setMenu(null);}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    menuRef.current?.querySelector('button')?.focus({preventScroll:true});
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
  },[menu]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{setMenu(null);setPreview(null);setHovered(null);setPointer(null);drag.current=null;},[symbol,chart]);
  const commit=async(entry,value)=>{
    if(pending.current||alerts.busy)return;
    const condition=movedAlertCondition(entry.rule,entry.field,value,instrument);if(!condition){setPreview(null);return;}
    if(Number(condition[entry.field])===entry.price){setPreview(null);return;}
    pending.current=true;setPreview({key:entry.key,value:condition[entry.field],saving:true});
    try{
      const saved=await alerts.move(entry.rule,condition);
      if(!saved)setNotice('Could not confirm the alert update. Check the alert settings before trying again.');
    }catch{setNotice('Could not confirm the alert update. Check the alert settings before trying again.');}
    finally{pending.current=false;setPreview(null);update();}
  };
  const startDrag=(event,entry)=>{
    if(pending.current||alerts.busy)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={entry,id:event.pointerId,value:entry.price};
    setHovered(entry.key);setPreview({key:entry.key,value:entry.price,saving:false});
  };
  const dragMove=event=>{
    const current=drag.current;if(!current||current.id!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    const rect=hostRef.current?.getBoundingClientRect();if(!rect)return;
    const y=Math.max(10,Math.min(event.clientY-rect.top,geometry.current.height-12));
    const condition=movedAlertCondition(current.entry.rule,current.entry.field,series.coordinateToPrice(y),instrument);
    if(condition){current.value=condition[current.entry.field];setPreview({key:current.entry.key,value:current.value,saving:false});}
  };
  const endDrag=event=>{
    const current=drag.current;if(!current||current.id!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();drag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    void commit(current.entry,current.value);
  };
  const cancelDrag=()=>{drag.current=null;setPreview(null);};
  if(!enabled||!chart||!series)return null;
  return <div className="acg-chart-alerts-layer" data-theme={light?'light':'dark'} data-chart-alerts-layer data-plot-width={view.width} data-acg-hotkeys-suspend="true">
    {view.rows.map(entry=>{
      const active=hovered===entry.key||preview?.key===entry.key;
      const text=chartAlertPrice(entry.displayPrice,instrument)||String(entry.displayPrice);
      const label=chartAlertLabel(entry,text);
      const uncertain=['WAITING_FOR_DATA','INTERRUPTED','RECOVERING','SOURCE_UNAVAILABLE'].includes(entry.rule.monitoring);
      return <div key={entry.key} data-chart-alert-tag={entry.key} className={`acg-chart-alert-tag ${active?'is-active':''}`}
        style={{top:entry.y,left:Math.max(8,Math.min(view.width*0.62,view.width-310)),maxWidth:Math.max(120,view.width-20)}}
        onPointerEnter={()=>setHovered(entry.key)} onFocus={()=>setHovered(entry.key)}
        onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setHovered(null);}}>
        <button type="button" className="acg-chart-alert-drag" aria-label={'Move '+entry.rule.symbol+' alert '+entry.field} title="Drag to change price · arrow keys adjust one tick"
          disabled={alerts.busy||preview?.saving} onPointerDown={event=>startDrag(event,entry)} onPointerMove={dragMove} onPointerUp={endDrag} onPointerCancel={cancelDrag} onLostPointerCapture={()=>{if(drag.current)cancelDrag();}}
          onKeyDown={event=>{
            if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelDrag();return;}
            if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();void commit(entry,entry.price+(event.key==='ArrowUp'?1:-1)*Number(instrument?.tickSize||10**-Number(instrument?.digits||5)));}
          }}><GripVertical size={12}/></button>
        <button type="button" className="acg-chart-alert-title" aria-label={'Edit '+label} title={label+(uncertain?' · '+entry.rule.monitoring.replaceAll('_',' '):'')}
          onClick={()=>alerts.edit(entry.rule)} disabled={preview?.saving}><Bell size={12} className={uncertain?'is-interrupted':''}/><span>{preview?.saving?'Saving…':label}</span></button>
        {active&&<><span className="acg-chart-alert-divider"/><button type="button" aria-label={'Pause '+entry.rule.symbol+' chart alert'} title="Pause alert" disabled={alerts.busy} onClick={async()=>{if(!await alerts.status(entry.rule))setNotice('Could not pause the alert. Open its settings to check the current status.');}}><Pause size={12}/></button><button type="button" aria-label={'Delete '+entry.rule.symbol+' chart alert'} title="Delete alert" disabled={alerts.busy} onClick={async()=>{if(!await alerts.remove(entry.rule))setNotice('Could not confirm deletion. Open Alerts to check the current status.');}}><Trash2 size={12}/></button></>}
      </div>;
    })}
    {pointer&&pointer.price>0&&!menu&&<>
      <div className="acg-chart-alert-price-guide" aria-hidden="true" style={{top:pointer.y,width:view.width}}/>
      <button type="button" className="acg-chart-alert-axis-add" aria-label={'Add alert at '+chartAlertPrice(pointer.price,instrument)} title={'Add alert on '+symbol+' at '+chartAlertPrice(pointer.price,instrument)}
        style={{left:Math.max(0,view.width-22),top:pointer.y}} onPointerDown={event=>event.stopPropagation()} onClick={()=>{
          const price=chartAlertPrice(pointer.price,instrument);if(price){setMenu({x:Math.max(6,view.width-310),y:Math.max(6,Math.min(pointer.y,view.height-125)),price});setPointer(null);}
        }}><span className="acg-chart-alert-axis-icon"><Plus size={14} strokeWidth={1.75}/></span><span className="acg-chart-alert-axis-price">{chartAlertPrice(pointer.price,instrument)}</span></button>
    </>}
    {menu&&<div ref={menuRef} className="acg-chart-alert-context" role="menu" aria-label="Chart alert actions" style={{left:menu.x,top:menu.y}} data-acg-hotkeys-suspend="true">
      <div className="acg-chart-alert-context-heading"><span>{symbol}</span><strong>{menu.price}</strong></div>
      <button type="button" role="menuitem" onClick={()=>{alerts.create(symbol,menu.price);setMenu(null);}}><BellPlus size={16}/><span>Add alert on {symbol} at {menu.price}</span><kbd>Alt A</kbd></button>
      <div className="acg-chart-alert-context-separator"/>
      <button type="button" role="menuitem" onClick={()=>{alerts.open(symbol);setMenu(null);}}><Settings2 size={15}/><span>Manage {symbol} alerts</span></button>
    </div>}
    {notice&&<div className="acg-chart-alert-notice" role="alert">{notice}</div>}
  </div>;
}
