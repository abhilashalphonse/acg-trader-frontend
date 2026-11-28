import {useLayoutEffect,useState} from 'react';
import AgentCursor from './AgentCursor.jsx';
import {createAgentCursor} from './agentCursorController.js';
import {createNativeAgentDrawingExecutor} from './nativeAgentDrawingExecutor.js';
import {getDrawingSnapshot} from '../../utils/drawingStore.js';

// Private chart capability scoped to the active mounted chart. The context
// token binds to a local snapshot; the server independently verifies market
// evidence and the completed-candle time. It is not an authentication token.
export default function AgentDrawingSurface({symbol,timeframe,chartInstanceId,coordinateApi,onReady}){
 const [cursor,setCursor]=useState(null);
 useLayoutEffect(()=>{
  if(!coordinateApi?.plotSize||!coordinateApi?.toScreen||!coordinateApi?.agentDrawingSnapshot||typeof onReady!=='function')return;
  const workspace=Object.freeze({symbol,timeframe,chartInstanceId});
  let pinned=null,disposed=false;
  const controller=createAgentCursor({getBounds:()=>coordinateApi.plotSize()});
  const readCurrentContext=()=>{
   const snapshot=coordinateApi.agentDrawingSnapshot();
   if(disposed||!pinned||!snapshot||snapshot.fingerprint!==pinned.fingerprint||snapshot.latestClosedAtMs!==pinned.latestClosedAtMs)return null;
   return {enabled:true,workspace,chartContextVersion:pinned.chartContextVersion,latestClosedAtMs:pinned.latestClosedAtMs};
  };
  const executor=createNativeAgentDrawingExecutor({workspace,coordinateApi,cursor:controller,readCurrentContext});
  const port=Object.freeze({
   prepare(){
    if(disposed)return null;
    const snapshot=coordinateApi.agentDrawingSnapshot();
    if(!snapshot||!Number.isSafeInteger(snapshot.latestClosedAtMs))return null;
    const chartContextVersion=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    pinned={...snapshot,chartContextVersion};
    return Object.freeze({workspace,actionId:crypto.randomUUID(),chartContextVersion,latestClosedAtMs:snapshot.latestClosedAtMs,drawingRevision:getDrawingSnapshot(symbol).revision,userRequested:true,complete:true});
   },
   execute:executor.execute,
   stop:executor.stop,
   undoLastBatch:executor.undoLastBatch
  });
  setCursor(controller);onReady(port);
  return ()=>{disposed=true;pinned=null;executor.dispose();controller.dispose();onReady(null);};
 },[symbol,timeframe,chartInstanceId,coordinateApi,onReady]);
 return cursor?<AgentCursor controller={cursor}/>:null;
}
