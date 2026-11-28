import {useLayoutEffect,useState} from 'react';
import AgentCursor from './AgentCursor.jsx';
import {createAgentCursor} from './agentCursorController.js';
import {createNativeAgentDrawingExecutor} from './nativeAgentDrawingExecutor.js';

// Private opt-in chart port, not a global event bus. Only a trusted parent
// may receive the executor; no window hooks or raw AI text dispatch.
export default function AgentDrawingSurface({symbol,timeframe,chartInstanceId,coordinateApi,readCurrentContext,onReady}){
 const [cursor,setCursor]=useState(null);
 useLayoutEffect(()=>{
  if(!coordinateApi?.plotSize||!coordinateApi?.toScreen||typeof readCurrentContext!=='function'||typeof onReady!=='function')return;
  const controller=createAgentCursor({getBounds:()=>coordinateApi.plotSize()});
  const executor=createNativeAgentDrawingExecutor({workspace:{symbol,timeframe,chartInstanceId},coordinateApi,cursor:controller,readCurrentContext});
  setCursor(controller);
  onReady(executor);
  return ()=>{
   executor.dispose();controller.dispose();onReady(null);setCursor(null);
  };
 },[symbol,timeframe,chartInstanceId,coordinateApi,readCurrentContext,onReady]);
 return cursor?<AgentCursor controller={cursor}/>:null;
}
