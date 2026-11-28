// Phase 8B.5.1: local, chart-scoped drawing recognition. Persisted
// createdBy/sourceId metadata is descriptive only, never mutation authority.
import {getDrawingSnapshot,subscribeDrawings,visibleDrawingOnTimeframe} from '../../utils/drawingStore.js';
import {canonicalDrawingTimeframe} from '../../utils/drawingTools.js';
const owned=new Map();
const MAX_SYMBOLS=128,MAX_OWNED=256,MAX_LIST=20;
const FRAMES=new Set(['M1','M5','M15','M30','H1','H4','D1','W1']);
const exact=x=>JSON.stringify(x);
const symbolKey=s=>typeof s==='string'&&/^[A-Z0-9._-]{1,32}$/.test(s)?s:null;
const sourceOk=s=>typeof s==='string'&&/^draw_[a-f0-9]{32}$/.test(s);
function prune(symbol,entry){
 const current=getDrawingSnapshot(symbol).present;
 for(const [id,baseline] of entry.items){
  const item=current.find(d=>d.id===id);
  if(!item||exact(item)!==baseline)entry.items.delete(id);
 }
 if(!entry.items.size){entry.unsubscribe();owned.delete(symbol);}
}
// Called only after the native executor has verified the exact committed
// drawing transaction. No hydration from persistence or assistant responses.
export function registerVerifiedDrawings(symbol,drawings){
 if(!symbolKey(symbol)||!Array.isArray(drawings)||drawings.length>8)return false;
 const current=getDrawingSnapshot(symbol).present;
 const verified=drawings.filter(d=>d?.createdBy==='ai'&&sourceOk(d.sourceId)&&d.id==='ai-'+d.sourceId&&current.some(x=>x.id===d.id&&exact(x)===exact(d)));
 if(verified.length!==drawings.length||!verified.length)return false;
 let entry=owned.get(symbol);
 if(!entry){
  if(owned.size>=MAX_SYMBOLS)return false;
  entry={items:new Map(),unsubscribe:null};
  entry.unsubscribe=subscribeDrawings(symbol,()=>prune(symbol,entry));
  owned.set(symbol,entry);
 }
 if(entry.items.size+verified.length>MAX_OWNED)return false;
 for(const d of verified)entry.items.set(d.id,exact(d));
 return true;
}
export function drawingOwnership(symbol,drawing){
 if(drawing?.createdBy!=='ai')return 'MANUAL';
 if(!symbolKey(symbol)||drawing.locked||!sourceOk(drawing.sourceId)||drawing.id!=='ai-'+drawing.sourceId)return 'PROTECTED_AI';
 return owned.get(symbol)?.items.get(drawing.id)===exact(drawing)?'VERIFIED_AI':'PROTECTED_AI';
}
const labels={hline:'Horizontal line',rectangle:'Rectangle'};
const project=(symbol,d)=>Object.freeze({id:d.id,type:d.type,label:Object.hasOwn(labels,d.type)?labels[d.type]:'Chart drawing',ownership:drawingOwnership(symbol,d),locked:d.locked===true,hidden:d.hidden===true});
export function inspectChartDrawings({symbol,timeframe,chartInstanceId,selection=null}={}){
 if(!symbolKey(symbol)||typeof chartInstanceId!=='string'||!chartInstanceId)return null;
 const frame=canonicalDrawingTimeframe(timeframe);
 if(!FRAMES.has(frame))return null;
 const snapshot=getDrawingSnapshot(symbol);
 const visible=snapshot.present.filter(d=>visibleDrawingOnTimeframe(d,frame));
 const selected=selection?.symbol===symbol&&selection.chartInstanceId===chartInstanceId?visible.find(d=>d.id===selection.selectedId):null;
 const counts={VERIFIED_AI:0,PROTECTED_AI:0,MANUAL:0};
 for(const d of visible)counts[drawingOwnership(symbol,d)]++;
 return Object.freeze({symbol,timeframe:frame,revision:snapshot.revision,total:visible.length,counts:Object.freeze(counts),selected:selected?project(symbol,selected):null,drawings:Object.freeze(visible.slice(0,MAX_LIST).map(d=>project(symbol,d))),truncated:visible.length>MAX_LIST});
}
export function drawingInspectionCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 if(/^(?:list|show|identify) (?:the |my )?(?:chart )?drawings(?: on (?:my|the) chart)?[.!]?$/i.test(q))return 'LIST';
 if(/^(?:which drawing is selected|what drawing is selected|identify (?:the )?selected drawing)[.!?]?$/i.test(q))return 'SELECTED';
 return null;
}
