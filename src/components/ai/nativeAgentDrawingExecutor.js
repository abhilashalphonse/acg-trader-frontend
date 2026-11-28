// Phase 8B.3: native, chart-only executor. A trusted workspace adapter must
// bind a completed authenticated action response to the current direct user
// request. Chat text, streamed deltas and model coordinates are NOT inputs.
// No network, trading API, synthetic pointer events or approval dialogs.
import {getDrawingSnapshot,commitDrawings,normalizeDrawing} from '../../utils/drawingStore.js';
import {canonicalDrawingTimeframe} from '../../utils/drawingTools.js';
import {prepareChartDrawingPlan} from './chartDrawingPlan.js';

const VERSION='chart-drawing-candidates-v1';
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const sourceId=v=>typeof v==='string'&&/^draw_[a-f0-9]{32}$/.test(v);
const keys=(v,k)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===k;
const same=(a,b)=>a&&b&&a.symbol===b.symbol&&a.chartInstanceId===b.chartInstanceId&&canonicalDrawingTimeframe(a.timeframe)===canonicalDrawingTimeframe(b.timeframe);
const result=(state,extra={})=>Object.freeze({state,...extra});
const anchors=(a,b)=>a?.time===b?.time&&a?.price===b?.price;
const fingerprint=d=>JSON.stringify([d.type,d.a,d.b,d.timeframeVisibility,d.hidden,d.locked,d.style,d.text]);
export function createNativeAgentDrawingExecutor({workspace,coordinateApi,cursor,readCurrentContext,now=Date.now}={}){
 if(!workspace||typeof coordinateApi?.toScreen!=='function'||typeof coordinateApi?.plotSize!=='function'||!cursor||typeof readCurrentContext!=='function')throw new TypeError('Native chart ports required');
 const chart=Object.freeze({...workspace});let active=null,disposed=false;const applied=new Map();
 const stop=()=>{if(!active)return false;active.cancelled=true;if(active.token)cursor.stop(active.token);return true;};
 function executeCheck(request,receipt,signal,op){
  if(disposed||signal?.aborted||op?.cancelled||!request||!same(request.workspace,chart)||request.userRequested!==true||request.complete!==true||!id(request.actionId)||!hex(request.chartContextVersion)||!Number.isSafeInteger(request.drawingRevision))return false;
  const c=receipt?.context,t=now();
  if(receipt?.contractVersion!==VERSION||receipt.actionId!==request.actionId||!keys(c,'chartContextVersion,expiresAtMs,latestClosedAtMs,symbol,timeframe')||c.symbol!==chart.symbol||canonicalDrawingTimeframe(c.timeframe)!==canonicalDrawingTimeframe(chart.timeframe)||c.chartContextVersion!==request.chartContextVersion||c.latestClosedAtMs!==request.latestClosedAtMs||!Number.isSafeInteger(c.latestClosedAtMs)||!Number.isSafeInteger(c.expiresAtMs)||!Number.isSafeInteger(t)||t>=c.expiresAtMs||c.expiresAtMs-t>10000)return false;
  const current=readCurrentContext();
  return current?.enabled===true&&same(current.workspace,chart)&&current.chartContextVersion===request.chartContextVersion&&current.latestClosedAtMs===request.latestClosedAtMs&&getDrawingSnapshot(chart.symbol).revision===request.drawingRevision;
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
  if(!executeCheck(request,receipt,signal))return result('DENIED');
  if(!keys(receipt,'actionId,actions,context,contractVersion')||!Array.isArray(receipt.actions)||receipt.actions.length<1||receipt.actions.length>8)return result('DENIED');
  const ids=new Set();
  for(const a of receipt.actions){
   if(!keys(a,'drawingKey,geometry,sourceId,sourceTimeframe')||!sourceId(a.sourceId)||a.drawingKey!==a.sourceId||ids.has(a.sourceId)||canonicalDrawingTimeframe(a.sourceTimeframe)!==canonicalDrawingTimeframe(chart.timeframe))return result('DENIED');
   ids.add(a.sourceId);
  }
  const plan=prepareChartDrawingPlan({workspace:chart,actions:receipt.actions.map(a=>a.geometry),now:now()});
  if(!plan||plan.drawingRevision!==request.drawingRevision)return result('DENIED');
  if(plan.actions.some(a=>a.a.time*1000>request.latestClosedAtMs||a.b.time*1000>request.latestClosedAtMs))return result('DENIED');
  const batchKey=JSON.stringify(receipt.actions.map(a=>[a.sourceId,a.geometry]));
  for(const [key,v] of applied)if(v.expiresAtMs<=now())applied.delete(key);
  const previous=applied.get(request.actionId);
  if(previous)return previous.key===batchKey?result('ALREADY_APPLIED',{count:0}):result('DENIED');
  if(applied.size>=128)return result('DENIED');
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
  if(!additions.length){applied.set(request.actionId,{key:batchKey,expiresAtMs:receipt.context.expiresAtMs});return result('NO_CHANGES',{count:0});}
  // Offscreen zones are deferred, never silently repositioned. All anchors
  // are computed by the real chart transform; pixel positions are visual only.
  if(additions.some(a=>!points(a)))return result('OFFSCREEN');
  const op={cancelled:false,token:null};active=op;
  const abort=()=>{if(active===op)stop();};
  signal?.addEventListener?.('abort',abort,{once:true});
  try{
   for(const drawing of additions){
    if(!executeCheck(request,receipt,signal,op))return result(op.cancelled||signal?.aborted?'STOPPED':'STALE');
    const path=points(drawing);
    if(!path)return result('OFFSCREEN');
    for(const p of path){
     if(!op.token){op.token=cursor.start(p);if(!op.token)return result('STOPPED');}
     else if(!await cursor.move(op.token,p,{durationMs:180}))return result('STOPPED');
     if(!executeCheck(request,receipt,signal,op))return result(op.cancelled||signal?.aborted?'STOPPED':'STALE');
    }
   }
   if(!executeCheck(request,receipt,signal,op)||additions.some(a=>!points(a)))return result(op.cancelled||signal?.aborted?'STOPPED':'STALE');
   // Single synchronous commit is the only mutation; native undo treats the
   // whole batch as one transaction. No partially applied streamed actions.
   let commitError=false;
   try{commitDrawings(chart.symbol,existing=>[...existing,...additions]);}catch{commitError=true;}
   const after=getDrawingSnapshot(chart.symbol);
   const verified=after.revision===before.revision+1&&after.present.length===before.present.length+additions.length&&before.present.every(d=>after.present.some(x=>x.id===d.id&&fingerprint(x)===fingerprint(d)))&&additions.every(d=>after.present.some(x=>x.id===d.id&&x.type===d.type&&x.sourceId===d.sourceId&&x.actionId===d.actionId&&x.createdBy==='ai'&&x.timeframeVisibility===d.timeframeVisibility&&anchors(x.a,d.a)&&anchors(x.b,d.b)));
   if(!verified)return result('FAILED_UNCERTAIN',{count:0});
   applied.set(request.actionId,{key:batchKey,expiresAtMs:receipt.context.expiresAtMs});
   if(op.token)cursor.pulse(op.token);
   return result('VERIFIED',{count:additions.length,ids:Object.freeze(additions.map(d=>d.id)),notificationWarning:commitError});
  }finally{
   signal?.removeEventListener?.('abort',abort);
   if(op.token)cursor.finish(op.token);
   if(active===op)active=null;
  }
 }
 return Object.freeze({execute,stop,dispose(){disposed=true;stop();applied.clear();}});
}
