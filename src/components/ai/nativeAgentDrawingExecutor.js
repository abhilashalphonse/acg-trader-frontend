// Phase 8B.3: native, chart-only executor. A trusted workspace adapter must
// bind a completed authenticated action response to the current direct user
// request. Chat text, streamed deltas and model coordinates are NOT inputs.
// No network, trading API, synthetic pointer events or approval dialogs.
import {getDrawingSnapshot,commitDrawings,normalizeDrawing,undoDrawings} from '../../utils/drawingStore.js';
import {canonicalDrawingTimeframe} from '../../utils/drawingTools.js';
import {prepareChartDrawingPlan} from './chartDrawingPlan.js';
import {registerVerifiedDrawings} from './chartDrawingInventory.js';

const VERSION='chart-drawing-candidates-v1';
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const sourceId=v=>typeof v==='string'&&/^draw_[a-f0-9]{32}$/.test(v);
const keys=(v,k)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===k;
const same=(a,b)=>a&&b&&a.symbol===b.symbol&&a.chartInstanceId===b.chartInstanceId&&canonicalDrawingTimeframe(a.timeframe)===canonicalDrawingTimeframe(b.timeframe);
const result=(state,extra={})=>Object.freeze({state,...extra});
// Page-session quarantine survives active chart remounts. Never retry an
// unverifiable transaction automatically. Manual chart controls remain usable.
const uncertainSymbols=new Set();
const exact=v=>JSON.stringify(v);
// Distances affect animation only, never data-space geometry or action authority.
const travelMs=(from,to)=>Math.round(Math.min(300,Math.max(90,90+Math.hypot(to.x-from.x,to.y-from.y)*0.30)));
const samePath=(a,b)=>a&&b&&a.length===b.length&&a.every((p,i)=>Math.hypot(p.x-b[i].x,p.y-b[i].y)<=2);

export function createNativeAgentDrawingExecutor({workspace,coordinateApi,cursor,readCurrentContext,now=Date.now}={}){
 if(!workspace||typeof coordinateApi?.toScreen!=='function'||typeof coordinateApi?.plotSize!=='function'||!cursor||typeof readCurrentContext!=='function')throw new TypeError('Native chart ports required');
 const chart=Object.freeze({...workspace});let active=null,disposed=false,lastBatch=null;const applied=new Map();
 const stop=()=>{if(!active)return false;active.cancelled=true;if(active.token)cursor.stop(active.token);return true;};
 function executeCheck(request,receipt,signal,op,{checkRevision=true}={}){
  if(disposed||signal?.aborted||op?.cancelled||!request||!same(request.workspace,chart)||request.userRequested!==true||request.complete!==true||!id(request.actionId)||!hex(request.chartContextVersion)||!Number.isSafeInteger(request.drawingRevision))return false;
  const c=receipt?.context,t=now();
  if(receipt?.contractVersion!==VERSION||receipt.actionId!==request.actionId||!keys(c,'chartContextVersion,expiresAtMs,latestClosedAtMs,symbol,timeframe')||c.symbol!==chart.symbol||canonicalDrawingTimeframe(c.timeframe)!==canonicalDrawingTimeframe(chart.timeframe)||c.chartContextVersion!==request.chartContextVersion||c.latestClosedAtMs!==request.latestClosedAtMs||!Number.isSafeInteger(c.latestClosedAtMs)||!Number.isSafeInteger(c.expiresAtMs)||!Number.isSafeInteger(t)||t>=c.expiresAtMs||c.expiresAtMs-t>10000)return false;
  const current=readCurrentContext();
  return current?.enabled===true&&same(current.workspace,chart)&&current.chartContextVersion===request.chartContextVersion&&current.latestClosedAtMs===request.latestClosedAtMs&&(!checkRevision||getDrawingSnapshot(chart.symbol).revision===request.drawingRevision);
 }
 function points(action){
  const size=coordinateApi.plotSize(),a=coordinateApi.toScreen(action.a),b=coordinateApi.toScreen(action.b);
  if(!Number.isFinite(size?.width)||!Number.isFinite(size?.height)||size.width<=0||size.height<=0||!a||!b)return null;
  const inPlot=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=size.width&&p.y>=0&&p.y<=size.height;
  if(action.type==='hline'){
   if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.y<0||a.y>size.height)return null;
   return [{x:Math.max(0,Math.min(a.x,size.width)),y:a.y}];
  }
  if(!inPlot(a)||!inPlot(b))return null;
  return [a,b];
 }
 async function execute({request,receipt,signal}={}){
  if(active)return result('BUSY');
  if(uncertainSymbols.has(chart.symbol))return result('RECOVERY_REQUIRED');
  // Pin the accepted request and receipt before the first animation await.
  try{request=structuredClone(request);receipt=structuredClone(receipt);}catch{return result('DENIED');}
  if(!executeCheck(request,receipt,signal,null,{checkRevision:false}))return result('DENIED');
  if(!keys(receipt,'actionId,actions,context,contractVersion')||!Array.isArray(receipt.actions)||receipt.actions.length<1||receipt.actions.length>8)return result('DENIED');
  const ids=new Set();
  for(const a of receipt.actions){
   if(!keys(a,'drawingKey,geometry,sourceId,sourceTimeframe')||!sourceId(a.sourceId)||a.drawingKey!==a.sourceId||ids.has(a.sourceId)||canonicalDrawingTimeframe(a.sourceTimeframe)!==canonicalDrawingTimeframe(chart.timeframe))return result('DENIED');
   ids.add(a.sourceId);
  }
  const batchKey=exact([request,receipt]);
  for(const [key,v] of applied)if(v.expiresAtMs<=now())applied.delete(key);
  const previous=applied.get(request.actionId);
  if(previous)return previous.key===batchKey&&getDrawingSnapshot(chart.symbol)===previous.after?result('ALREADY_APPLIED',{count:0}):result('DENIED');
  if(applied.size>=128||!executeCheck(request,receipt,signal))return result('DENIED');
  const plan=prepareChartDrawingPlan({workspace:chart,actions:receipt.actions.map(a=>a.geometry),now:now()});
  if(!plan||plan.drawingRevision!==request.drawingRevision)return result('DENIED');
  if(plan.actions.some(a=>a.a.time*1000>request.latestClosedAtMs||a.b.time*1000>request.latestClosedAtMs))return result('DENIED');
  // Keep existing objects (including manually modified AI objects) untouched.
  // Updating them requires the explicit edit/provenance work of 8B.5.
  const before=getDrawingSnapshot(chart.symbol);
  const additions=[];
  for(let i=0;i<plan.actions.length;i++){
   const a=plan.actions[i],source=receipt.actions[i].sourceId,drawingId='ai-'+source;
   const existing=before.present.find(d=>d.id===drawingId);
   if(existing){
    if(existing.createdBy!=='ai'||existing.sourceId!==source)return result('DENIED');
    continue;
   }
   const drawing=normalizeDrawing({id:drawingId,type:a.type,a:{...a.a},b:{...a.b},text:'',locked:false,hidden:false,timeframeVisibility:canonicalDrawingTimeframe(chart.timeframe),createdBy:'ai',actionId:request.actionId,sourceId:source,sourceTimeframe:canonicalDrawingTimeframe(chart.timeframe)});
   additions.push(drawing);
  }
  if(!additions.length){applied.set(request.actionId,{key:batchKey,expiresAtMs:receipt.context.expiresAtMs,after:before});return result('NO_CHANGES',{count:0});}
  // Offscreen zones are deferred, never silently repositioned. All anchors
  // are computed by the real chart transform; pixel positions are visual only.
  if(additions.some(a=>!points(a)))return result('OFFSCREEN');
  const expected=exact([...before.present,...additions]);
  const baseline=exact(before.present);
  const op={cancelled:false,token:null,lastPoint:null,committed:false,writeStarted:false};active=op;
  const abort=()=>{if(active===op)stop();};
  signal?.addEventListener?.('abort',abort,{once:true});
  try{
   const visited=[];
   for(const drawing of additions){
    if(!executeCheck(request,receipt,signal,op))return result(op.cancelled||signal?.aborted?'STOPPED':'STALE');
    const path=points(drawing);
    if(!path)return result('OFFSCREEN');
    for(const p of path){
     if(!op.token){
      op.token=cursor.start(p);if(!op.token)return result('STOPPED');
      // First target deserves one visible beat, even for a single level.
      if(!await cursor.move(op.token,p,{durationMs:100}))return result('STOPPED');
     }else if(!await cursor.move(op.token,p,{durationMs:travelMs(op.lastPoint,p)}))return result('STOPPED');
     op.lastPoint=p;
     if(!executeCheck(request,receipt,signal,op))return result(op.cancelled||signal?.aborted?'STOPPED':'STALE');
    }
    if(!samePath(path,points(drawing)))return result('STALE');
    visited.push(path);
   }
   if(!executeCheck(request,receipt,signal,op)||additions.some((a,i)=>!samePath(visited[i],points(a))))return result(op.cancelled||signal?.aborted?'STOPPED':'STALE');
   // Single synchronous commit is the only mutation; native undo treats the
   // whole batch as one transaction. No partially applied streamed actions.
   let commitError=false;
   op.writeStarted=true;
   try{commitDrawings(chart.symbol,existing=>[...existing,...additions]);}catch{commitError=true;}
   const after=getDrawingSnapshot(chart.symbol);
   const verified=after.revision===before.revision+1&&exact(after.present)===expected&&exact(after.past.at(-1))===baseline&&after.future.length===0;
   if(!verified){
    if(after===before&&exact(after.present)===baseline)return result('FAILED_NO_COMMIT',{count:0});
    uncertainSymbols.add(chart.symbol);return result('FAILED_UNCERTAIN',{count:0});
   }
   applied.set(request.actionId,{key:batchKey,expiresAtMs:receipt.context.expiresAtMs,after});
   lastBatch={after,before:baseline,expected,count:additions.length};
   op.committed=true;
   // Recognition authority is issued only after exact native readback.
   // A registry failure must not turn a committed drawing into a false failure.
   try{registerVerifiedDrawings(chart.symbol,additions);}catch{/* remain protected */}
   let visualWarning=false;
   try{if(op.token)cursor.pulse(op.token);}catch{visualWarning=true;}
   return result('VERIFIED',{count:additions.length,ids:Object.freeze(additions.map(d=>d.id)),notificationWarning:commitError,visualWarning});
  }catch{
   if(op.writeStarted){uncertainSymbols.add(chart.symbol);return result('FAILED_UNCERTAIN',{count:0});}
   return result(op.cancelled||signal?.aborted?'STOPPED':'FAILED_NO_COMMIT',{count:0});
  }finally{
   signal?.removeEventListener?.('abort',abort);
   try{if(op.token)cursor.finish(op.token,{lingerMs:op.committed?300:0});}catch{/* visual cleanup cannot override a verified transaction */}
   if(active===op)active=null;
  }
 }
 // Undo only the exact latest verified AI transaction. A later manual edit,
 // native undo/redo, or chart disposal invalidates this capability.
 function undoLastBatch(){
  if(disposed||active)return result('DENIED');
  if(uncertainSymbols.has(chart.symbol))return result('RECOVERY_REQUIRED');
  if(!lastBatch)return result('NO_AI_BATCH');
  const current=getDrawingSnapshot(chart.symbol),batch=lastBatch;
  if(current!==batch.after||exact(current.present)!==batch.expected||exact(current.past.at(-1))!==batch.before)return result('UNDO_CONFLICT');
  let warning=false;
  try{undoDrawings(chart.symbol);}catch{warning=true;}
  const after=getDrawingSnapshot(chart.symbol);
  if(after===current)return result('FAILED_NO_COMMIT');
  if(after.revision!==current.revision+1||exact(after.present)!==batch.before||exact(after.future[0])!==batch.expected){uncertainSymbols.add(chart.symbol);return result('FAILED_UNCERTAIN');}
  lastBatch=null;
  return result('UNDONE',{count:batch.count,...(warning?{notificationWarning:true}:{})});
 }
 return Object.freeze({execute,stop,undoLastBatch,dispose(){disposed=true;lastBatch=null;stop();applied.clear();}});
}
