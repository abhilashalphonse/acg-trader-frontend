// Phase 8B.3: native, chart-only executor. A trusted workspace adapter must
// bind a completed authenticated action response to the current direct user
// request. Chat text, streamed deltas and model coordinates are NOT inputs.
// No network, trading API, synthetic pointer events or approval dialogs.
import {getDrawingSnapshot,commitDrawings,normalizeDrawing,undoDrawings} from '../../utils/drawingStore.js';
import {canonicalDrawingTimeframe} from '../../utils/drawingTools.js';
import {prepareChartDrawingPlan} from './chartDrawingPlan.js';
import {registerVerifiedDrawings,drawingOwnership,drawingOwnershipEpoch} from './chartDrawingInventory.js';
import {resolveDrawingDeletion} from './chartDrawingDelete.js';
import {planDrawingEdit} from './chartDrawingEdit.js';

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
 const chart=Object.freeze({...workspace});let active=null,disposed=false,lastBatch=null,pendingDeletion=null;const applied=new Map();
 const cancelDeletion=()=>{const had=Boolean(pendingDeletion);pendingDeletion=null;return had;};
 const stop=()=>{cancelDeletion();if(!active)return false;active.cancelled=true;if(active.token)cursor.stop(active.token);return true;};
 function executeCheck(request,receipt,signal,op,{checkRevision=true}={}){
  if(disposed||(op&&op.epoch!==drawingOwnershipEpoch())||signal?.aborted||op?.cancelled||!request||request.ownershipEpoch!==drawingOwnershipEpoch()||!same(request.workspace,chart)||request.userRequested!==true||request.complete!==true||!id(request.actionId)||!hex(request.chartContextVersion)||!Number.isSafeInteger(request.drawingRevision))return false;
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
  cancelDeletion();
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
  const op={epoch:drawingOwnershipEpoch(),cancelled:false,token:null,lastPoint:null,committed:false,writeStarted:false};active=op;
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
   lastBatch={epoch:op.epoch,after,before:baseline,expected,count:additions.length};
   op.committed=true;
   // Recognition authority is issued only after exact native readback.
   // A registry failure must not turn a committed drawing into a false failure.
   try{if(op.epoch===drawingOwnershipEpoch())registerVerifiedDrawings(chart.symbol,additions);}catch{/* remain protected */}
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
 // Geometry edits use explicit user input, current chart selection and
 // verified session ownership. No model proposals or external coordinates.
 function previewDeletion({question,selection}={}){
  cancelDeletion();
  if(disposed||active)return result('DENIED');
  if(uncertainSymbols.has(chart.symbol))return result('RECOVERY_REQUIRED');
  const before=getDrawingSnapshot(chart.symbol);
  const resolved=resolveDrawingDeletion({question,workspace:chart,snapshot:before,selection});
  if(resolved.state!=='READY')return result(resolved.state);
  const current=resolved.current;
  const preview=Object.freeze({state:'CONFIRM_REQUIRED',symbol:chart.symbol,timeframe:canonicalDrawingTimeframe(chart.timeframe),type:current.type,price:current.a.price,lower:current.type==='rectangle'?current.b.price:null,expiresAtMs:now()+30000});
  pendingDeletion={epoch:drawingOwnershipEpoch(),preview,before,baseline:exact(before.present),question,selection:structuredClone(selection),targetId:current.id,target:exact(current)};
  return preview;
 }
 async function confirmDeletion({preview,request,selection,readSelection,signal}={}){
  const deletion=pendingDeletion;
  cancelDeletion();
  if(!deletion||deletion.epoch!==drawingOwnershipEpoch()||deletion.preview!==preview||now()>=preview.expiresAtMs||
   getDrawingSnapshot(chart.symbol)!==deletion.before||exact(getDrawingSnapshot(chart.symbol).present)!==deletion.baseline||exact(selection)!==exact(deletion.selection))return result('STALE');
  return runEdit({request,question:deletion.question,selection,readSelection,signal},deletion);
 }
 const edit=args=>{cancelDeletion();return runEdit(args);};
 async function runEdit({request,question,selection,readSelection,signal}={},deletion=null){
  if(active)return result('BUSY');
  if(uncertainSymbols.has(chart.symbol))return result('RECOVERY_REQUIRED');
  if(!request||typeof readSelection!=='function')return result('DENIED');
  try{request=structuredClone(request);selection=structuredClone(selection);}catch{return result('DENIED');}
  // Reuse the same pinned context and time bounds as the creation path.
  const receipt={contractVersion:VERSION,actionId:request.actionId,context:{symbol:chart.symbol,timeframe:chart.timeframe,chartContextVersion:request.chartContextVersion,latestClosedAtMs:request.latestClosedAtMs,expiresAtMs:now()+10000}};
  if(!executeCheck(request,receipt,signal))return result('DENIED');
  const before=getDrawingSnapshot(chart.symbol),baseline=exact(before.present);
  const planned=deletion?resolveDrawingDeletion({question,workspace:chart,snapshot:before,selection}):planDrawingEdit({question,workspace:chart,snapshot:before,selection,latestClosedAtMs:request.latestClosedAtMs,now:now()});
  if(planned.state!=='READY')return result(planned.state);
  const {current,edited,command}=planned;
  if(deletion&&(deletion.before!==before||deletion.targetId!==current.id||deletion.target!==exact(current)||now()>=deletion.preview.expiresAtMs))return result('STALE');
  const oldPath=points(current),newPath=deletion?oldPath:points(edited);
  if(!oldPath||!newPath)return result('OFFSCREEN');
  const next=deletion?before.present.filter(d=>d.id!==current.id):before.present.map(d=>d.id===current.id?edited:d),expected=exact(next);
  const op={epoch:drawingOwnershipEpoch(),cancelled:false,token:null,lastPoint:null,committed:false,writeStarted:false};active=op;
  const abort=()=>{if(active===op)stop();};
  signal?.addEventListener?.('abort',abort,{once:true});
  const stillValid=()=>executeCheck(request,receipt,signal,op)&&getDrawingSnapshot(chart.symbol)===before&&
    (!command.selected&&!deletion||exact(readSelection())===exact(selection))&&drawingOwnership(chart.symbol,current)==='VERIFIED_AI'&&samePath(oldPath,points(current))&&
    (deletion?now()<deletion.preview.expiresAtMs:samePath(newPath,points(edited)));
  try{
   if(!stillValid())return result('STALE');
   for(const p of deletion?oldPath:[...oldPath,...newPath]){
    if(!op.token){op.token=cursor.start(p);if(!op.token)return result('STOPPED');if(!await cursor.move(op.token,p,{durationMs:100}))return result('STOPPED');}
    else if(!await cursor.move(op.token,p,{durationMs:travelMs(op.lastPoint,p)}))return result('STOPPED');
    op.lastPoint=p;
    if(!stillValid())return result(op.cancelled||signal?.aborted?'STOPPED':'STALE');
   }
   if(!stillValid())return result(op.cancelled||signal?.aborted?'STOPPED':'STALE');
   op.writeStarted=true;let notificationWarning=false;
   try{commitDrawings(chart.symbol,next);}catch{notificationWarning=true;}
   const after=getDrawingSnapshot(chart.symbol);
   if(after.revision!==before.revision+1||exact(after.present)!==expected||exact(after.past.at(-1))!==baseline||after.future.length){
    if(after===before&&exact(after.present)===baseline)return result('FAILED_NO_COMMIT');
    uncertainSymbols.add(chart.symbol);return result('FAILED_UNCERTAIN');
   }
   lastBatch={epoch:op.epoch,after,before:baseline,expected,count:1};op.committed=true;
   try{if(!deletion&&op.epoch===drawingOwnershipEpoch())registerVerifiedDrawings(chart.symbol,[edited]);}catch{/* conservative ownership downgrade */}
   try{cursor.pulse(op.token);}catch{/* visual-only */}
   return result(deletion?'DELETED':'EDITED',{count:1,notificationWarning});
  }catch{
   if(op.writeStarted){uncertainSymbols.add(chart.symbol);return result('FAILED_UNCERTAIN');}
   return result(op.cancelled||signal?.aborted?'STOPPED':'FAILED_NO_COMMIT');
  }finally{
   signal?.removeEventListener?.('abort',abort);
   try{if(op.token)cursor.finish(op.token,{lingerMs:op.committed?300:0});}catch{}
   if(active===op)active=null;
  }
 }
 // Undo only the exact latest verified AI transaction. A later manual edit,
 // native undo/redo, or chart disposal invalidates this capability.
 function undoLastBatch(){
  cancelDeletion();
  if(disposed||active)return result('DENIED');
  if(uncertainSymbols.has(chart.symbol))return result('RECOVERY_REQUIRED');
  if(!lastBatch)return result('NO_AI_BATCH');
  if(lastBatch.epoch!==drawingOwnershipEpoch()){lastBatch=null;return result('NO_AI_BATCH');}
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
 return Object.freeze({execute,edit,previewDeletion,confirmDeletion,cancelDeletion,stop,undoLastBatch,dispose(){disposed=true;lastBatch=null;stop();applied.clear();}});
}
