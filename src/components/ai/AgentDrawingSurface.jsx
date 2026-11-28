import {useLayoutEffect,useRef,useState} from 'react';
import AgentCursor from './AgentCursor.jsx';
import {createAgentCursor} from './agentCursorController.js';
import {createNativeAgentDrawingExecutor} from './nativeAgentDrawingExecutor.js';
import {getDrawingSnapshot} from '../../utils/drawingStore.js';
import {inspectChartDrawings,drawingOwnershipEpoch} from './chartDrawingInventory.js';
import {buildLocalDrawingReceipt} from './localChartDrawing.js';

// Private chart capability scoped to the active mounted chart. The context
// token binds to the pinned native viewport snapshot, not server market data.
// It is not an authentication token.
export default function AgentDrawingSurface({symbol,timeframe,chartInstanceId,coordinateApi,onReady,mobile=false}){
 const [cursor,setCursor]=useState(null);
 const anchor=useRef(null);
 useLayoutEffect(()=>{
  if(!coordinateApi?.plotSize||!coordinateApi?.toScreen||!coordinateApi?.agentDrawingSnapshot||typeof onReady!=='function')return;
  const workspace=Object.freeze({symbol,timeframe,chartInstanceId});
  let pinned=null,disposed=false,selection=null;
  const selectionChanged=e=>{
   const d=e.detail;
   if(d?.symbol===symbol&&d.chartInstanceId===chartInstanceId)selection={symbol,chartInstanceId,selectedId:d.selectedId};
  };
  window.addEventListener('acg-trader-drawing-selection-change',selectionChanged);
  const usablePlot=()=>{
   const size=coordinateApi.plotSize();
   return !mobile||(Number.isFinite(size?.width)&&Number.isFinite(size?.height)&&size.width>=180&&size.height>=150);
  };
  const controller=createAgentCursor({getBounds:()=>coordinateApi.plotSize()});
  const readCurrentContext=()=>{
   const snapshot=coordinateApi.agentDrawingSnapshot();
   if(disposed||!pinned||!usablePlot()||!snapshot||snapshot.fingerprint!==pinned.fingerprint||snapshot.latestClosedAtMs!==pinned.latestClosedAtMs)return null;
   return {enabled:true,workspace,chartContextVersion:pinned.chartContextVersion,latestClosedAtMs:pinned.latestClosedAtMs};
  };
  const executor=createNativeAgentDrawingExecutor({workspace,coordinateApi,cursor:controller,readCurrentContext});
  // Cancel pending network requests as well as visible motion. Do not
  // consume events or synthesize clicks; manual chart controls take priority.
  const interrupt=reason=>{
   executor.cancelDeletion();
   const current=pinned;
   if(!current)return false;
   pinned=null;executor.stop();
   current.onInterrupt?.(reason);
   return true;
  };
  const host=anchor.current?.parentElement;
  const gesture=()=>interrupt('MANUAL_CHART_INTERACTION');
  const escape=e=>{if(e.key==='Escape')interrupt('ESCAPE');};
  const hidden=()=>{if(document.hidden)interrupt('PAGE_HIDDEN');};
  const blur=()=>interrupt('WINDOW_BLUR');
  const resize=()=>{if(mobile)interrupt('CHART_CHANGED');};
  if(mobile){window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);}
  host?.addEventListener('pointerdown',gesture,true);
  host?.addEventListener('wheel',gesture,{capture:true,passive:true});
  window.addEventListener('keydown',escape,true);
  window.addEventListener('blur',blur);
  document.addEventListener('visibilitychange',hidden);
  const port=Object.freeze({
   prepare({onInterrupt}={}){
    if(disposed||pinned||!usablePlot()||document.hidden||typeof onInterrupt!=='function')return null;
    const snapshot=coordinateApi.agentDrawingSnapshot();
    if(!snapshot||!Number.isSafeInteger(snapshot.latestClosedAtMs))return null;
    const chartContextVersion=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    const actionId=crypto.randomUUID();
    pinned={...snapshot,chartContextVersion,actionId,onInterrupt};
    return Object.freeze({workspace,actionId,chartContextVersion,latestClosedAtMs:snapshot.latestClosedAtMs,drawingRevision:getDrawingSnapshot(symbol).revision,ownershipEpoch:drawingOwnershipEpoch(),userRequested:true,complete:true});
   },
   async plan({request,command,signal}={}){
    if(!pinned||request?.actionId!==pinned.actionId||request?.chartContextVersion!==pinned.chartContextVersion||!readCurrentContext()||signal?.aborted)return null;
    const captured=pinned;
    const isVisible=g=>{
     const size=coordinateApi.plotSize();
     const point=(time,price)=>coordinateApi.toScreen({time,price});
     const inside=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=size.width&&p.y>=0&&p.y<=size.height;
     if(g.type==='hline')return inside(point(g.time,g.price));
     return inside(point(g.fromTime,g.upper))&&inside(point(g.toTime,g.lower));
    };
    const result=await buildLocalDrawingReceipt({snapshot:captured,request,command,signal,isVisible});
    return pinned===captured&&!signal?.aborted&&readCurrentContext()?result:null;
   },
   inspectDrawings(){return disposed||pinned?null:inspectChartDrawings({...workspace,selection});},
   execute:executor.execute,
   edit({request,question,signal}){return executor.edit({request,question,selection,readSelection:()=>selection,signal});},
   previewDeletion(question){return disposed||pinned||!usablePlot()||document.hidden?{state:'DENIED'}:executor.previewDeletion({question,selection});},
   confirmDeletion({preview,request,signal}){return executor.confirmDeletion({preview,request,selection,readSelection:()=>selection,signal});},
   cancelDeletion:executor.cancelDeletion,
   stop:()=>interrupt('STOP'),
   release(actionId){if(pinned?.actionId===actionId)pinned=null;},
   undoLastBatch:executor.undoLastBatch
  });
  setCursor(controller);onReady(port);
  return ()=>{
   disposed=true;selection=null;interrupt('CHART_CHANGED');
   window.removeEventListener('acg-trader-drawing-selection-change',selectionChanged);
   host?.removeEventListener('pointerdown',gesture,true);
   host?.removeEventListener('wheel',gesture,true);
   window.removeEventListener('keydown',escape,true);
   window.removeEventListener('blur',blur);
   if(mobile){window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);}
   document.removeEventListener('visibilitychange',hidden);
   executor.dispose();controller.dispose();onReady(null);
  };
 },[symbol,timeframe,chartInstanceId,coordinateApi,onReady,mobile]);
 return <><span ref={anchor} hidden aria-hidden="true"/>{cursor&&<AgentCursor controller={cursor}/>}</>;
}
