// Direct user requests only. Editing changes the visual annotation, not
// detector evidence. Never infer a price, select an ambiguous object or use
// assistant text as an executable instruction.
import {drawingOwnership} from './chartDrawingInventory.js';
import {visibleDrawingOnTimeframe,normalizeDrawing} from '../../utils/drawingStore.js';
import {canonicalDrawingTimeframe} from '../../utils/drawingTools.js';
import {prepareChartDrawingPlan} from './chartDrawingPlan.js';
import {canonicalDrawingColor} from '../../utils/drawingAppearance.js';
const steps=Object.freeze({M1:60,M5:300,M15:900,M30:1800,H1:3600,H4:14400,D1:86400,W1:604800});
const timeframes=Object.keys(steps);
const fail=state=>({state});
const colors=Object.freeze({blue:'#2962FF',red:'#EF5350',green:'#26A69A',yellow:'#FBC02D',orange:'#FF9800',purple:'#AB47BC',white:'#FFFFFF',gray:'#AEB6C2',grey:'#AEB6C2'});
const targetText='(?:fvg|fair value gap|liquidity line|liquidity level|drawing)';
const targetPattern='(?:the )?(selected )?(?:ai )?('+targetText+')';
const targetFor=name=>/^(?:fvg|fair value gap)$/i.test(name)?'rectangle':/^liquidity /i.test(name)?'hline':null;
function appearanceCommand(q){
 let m=new RegExp('^(?:change|set) '+targetPattern+'(?: color)? to (#[0-9a-f]{6}|blue|red|green|yellow|orange|purple|white|gray|grey)[.!]?
export function drawingEditCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 let m=/^(extend|shorten) (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) by ([1-9][0-9]?) candles?[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:m[1].toUpperCase(),target:'rectangle',selected:!!m[2],bars:Number(m[3])});
 m=/^extend (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) to (?:the )?latest closed candle[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:!!m[1]});
 m=/^move (?:the )?(selected )?(?:ai )?liquidity (?:line|level) to ((?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,12})?)[.!]?$/i.exec(q);
 if(m&&Number(m[2])>0&&Number(m[2])<=1e12)return Object.freeze({kind:'MOVE',target:'hline',selected:!!m[1],price:Number(m[2])});
 const appearance=appearanceCommand(q);
 // Generic drawing references require a real selection, never a guess.
 return appearance&&(appearance.target||appearance.selected)?Object.freeze(appearance):null;
}
export function planDrawingEdit({question,workspace,snapshot,selection,latestClosedAtMs,now=Date.now()}={}){
 const command=drawingEditCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!timeframes.includes(frame)||!Array.isArray(snapshot?.present)||!Number.isSafeInteger(latestClosedAtMs)||latestClosedAtMs%1000!==0)return fail('DENIED');
 const symbol=workspace.symbol;
 const scoped=snapshot.present.filter(d=>['hline','rectangle'].includes(d.type)&&(!command.target||d.type===command.target)&&
   visibleDrawingOnTimeframe(command.kind==='SHOW'?{...d,hidden:false}:d,frame)&&
   (command.kind!=='SHOW'||d.hidden===true));
 let candidates;
 if(command.selected){
  if(selection?.symbol!==symbol||selection.chartInstanceId!==workspace.chartInstanceId)return fail('NO_TARGET');
  candidates=scoped.filter(d=>d.id===selection.selectedId);
 }else candidates=scoped;
 if(!candidates.length)return fail('NO_TARGET');
 if(candidates.length!==1)return fail('AMBIGUOUS_TARGET');
 const current=candidates[0];
 if(drawingOwnership(symbol,current)!=='VERIFIED_AI'||current.locked||(current.hidden&&command.kind!=='SHOW')||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return fail('PROTECTED_TARGET');
 const appearancePatch={COLOR:()=>({style:{...current.style,color:command.color}}),DASH:()=>({style:{...current.style,dash:command.dash}}),WIDTH:()=>({style:{...current.style,width:command.width}}),OPACITY:()=>({style:{...current.style,opacity:command.opacity}}),LABEL:()=>({text:command.text}),HIDE:()=>({hidden:true}),SHOW:()=>({hidden:false}),TIMEFRAME:()=>({timeframeVisibility:command.visibility==='all'?'all':frame})};
 if(Object.hasOwn(appearancePatch,command.kind)){
  const edited=normalizeDrawing({...current,...appearancePatch[command.kind]()});
  if(JSON.stringify(edited)===JSON.stringify(current))return fail('NO_CHANGES');
  return {state:'READY',current,edited,command};
 }
 let geometry;
 if(command.kind==='MOVE'){
  geometry={type:'hline',time:current.a.time,price:command.price};
 }else{
  const close=latestClosedAtMs/1000,fromTime=current.a.time,prior=current.b.time;
  const toTime=command.kind==='EXTEND_TO_CLOSE'?Math.max(prior,close):prior+(command.kind==='EXTEND'?1:-1)*command.bars*steps[frame];
  if(toTime<=fromTime||toTime>close)return fail('OUT_OF_RANGE');
  geometry={type:'rectangle',fromTime,toTime,lower:current.b.price,upper:current.a.price};
 }
 const plan=prepareChartDrawingPlan({workspace,actions:[geometry],now});
 if(!plan||plan.drawingRevision!==snapshot.revision||plan.actions[0].a.time*1000>latestClosedAtMs||plan.actions[0].b.time*1000>latestClosedAtMs)return fail('DENIED');
 const a=plan.actions[0].a,b=plan.actions[0].b;
 if(a.time===current.a.time&&a.price===current.a.price&&b.time===current.b.time&&b.price===current.b.price)return fail('NO_CHANGES');
 // Preserve the original detector reference but identify the annotation as
 // explicitly user-adjusted; it is not a newly verified market observation.
 const edited=normalizeDrawing({...current,a:{...a},b:{...b},aiGeometryAdjusted:true});
 return {state:'READY',current,edited,command};
}
,'i').exec(q);
 if(m)return {kind:'COLOR',target:targetFor(m[2]),selected:!!m[1],color:canonicalDrawingColor(colors[m[3].toLowerCase()]||m[3])};
 m=new RegExp('^make '+targetPattern+' (solid|dashed|dotted)[.!]?
export function drawingEditCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 let m=/^(extend|shorten) (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) by ([1-9][0-9]?) candles?[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:m[1].toUpperCase(),target:'rectangle',selected:!!m[2],bars:Number(m[3])});
 m=/^extend (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) to (?:the )?latest closed candle[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:!!m[1]});
 m=/^move (?:the )?(selected )?(?:ai )?liquidity (?:line|level) to ((?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,12})?)[.!]?$/i.exec(q);
 if(m&&Number(m[2])>0&&Number(m[2])<=1e12)return Object.freeze({kind:'MOVE',target:'hline',selected:!!m[1],price:Number(m[2])});
 return null;
}
export function planDrawingEdit({question,workspace,snapshot,selection,latestClosedAtMs,now=Date.now()}={}){
 const command=drawingEditCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!timeframes.includes(frame)||!Array.isArray(snapshot?.present)||!Number.isSafeInteger(latestClosedAtMs)||latestClosedAtMs%1000!==0)return fail('DENIED');
 const symbol=workspace.symbol;
 const scoped=snapshot.present.filter(d=>d.type===command.target&&visibleDrawingOnTimeframe(d,frame));
 let candidates;
 if(command.selected){
  if(selection?.symbol!==symbol||selection.chartInstanceId!==workspace.chartInstanceId)return fail('NO_TARGET');
  candidates=scoped.filter(d=>d.id===selection.selectedId);
 }else candidates=scoped;
 if(!candidates.length)return fail('NO_TARGET');
 if(candidates.length!==1)return fail('AMBIGUOUS_TARGET');
 const current=candidates[0];
 if(drawingOwnership(symbol,current)!=='VERIFIED_AI'||current.locked||current.hidden||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return fail('PROTECTED_TARGET');
 let geometry;
 if(command.kind==='MOVE'){
  geometry={type:'hline',time:current.a.time,price:command.price};
 }else{
  const close=latestClosedAtMs/1000,fromTime=current.a.time,prior=current.b.time;
  const toTime=command.kind==='EXTEND_TO_CLOSE'?Math.max(prior,close):prior+(command.kind==='EXTEND'?1:-1)*command.bars*steps[frame];
  if(toTime<=fromTime||toTime>close)return fail('OUT_OF_RANGE');
  geometry={type:'rectangle',fromTime,toTime,lower:current.b.price,upper:current.a.price};
 }
 const plan=prepareChartDrawingPlan({workspace,actions:[geometry],now});
 if(!plan||plan.drawingRevision!==snapshot.revision||plan.actions[0].a.time*1000>latestClosedAtMs||plan.actions[0].b.time*1000>latestClosedAtMs)return fail('DENIED');
 const a=plan.actions[0].a,b=plan.actions[0].b;
 if(a.time===current.a.time&&a.price===current.a.price&&b.time===current.b.time&&b.price===current.b.price)return fail('NO_CHANGES');
 // Preserve the original detector reference but identify the annotation as
 // explicitly user-adjusted; it is not a newly verified market observation.
 const edited=normalizeDrawing({...current,a:{...a},b:{...b},aiGeometryAdjusted:true});
 return {state:'READY',current,edited,command};
}
,'i').exec(q);
 if(m)return {kind:'DASH',target:targetFor(m[2]),selected:!!m[1],dash:m[3].toLowerCase()};
 m=new RegExp('^set '+targetPattern+' (width|opacity) to ([0-9]{1,3})(px|%)?[.!]?
export function drawingEditCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 let m=/^(extend|shorten) (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) by ([1-9][0-9]?) candles?[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:m[1].toUpperCase(),target:'rectangle',selected:!!m[2],bars:Number(m[3])});
 m=/^extend (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) to (?:the )?latest closed candle[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:!!m[1]});
 m=/^move (?:the )?(selected )?(?:ai )?liquidity (?:line|level) to ((?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,12})?)[.!]?$/i.exec(q);
 if(m&&Number(m[2])>0&&Number(m[2])<=1e12)return Object.freeze({kind:'MOVE',target:'hline',selected:!!m[1],price:Number(m[2])});
 return null;
}
export function planDrawingEdit({question,workspace,snapshot,selection,latestClosedAtMs,now=Date.now()}={}){
 const command=drawingEditCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!timeframes.includes(frame)||!Array.isArray(snapshot?.present)||!Number.isSafeInteger(latestClosedAtMs)||latestClosedAtMs%1000!==0)return fail('DENIED');
 const symbol=workspace.symbol;
 const scoped=snapshot.present.filter(d=>d.type===command.target&&visibleDrawingOnTimeframe(d,frame));
 let candidates;
 if(command.selected){
  if(selection?.symbol!==symbol||selection.chartInstanceId!==workspace.chartInstanceId)return fail('NO_TARGET');
  candidates=scoped.filter(d=>d.id===selection.selectedId);
 }else candidates=scoped;
 if(!candidates.length)return fail('NO_TARGET');
 if(candidates.length!==1)return fail('AMBIGUOUS_TARGET');
 const current=candidates[0];
 if(drawingOwnership(symbol,current)!=='VERIFIED_AI'||current.locked||current.hidden||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return fail('PROTECTED_TARGET');
 let geometry;
 if(command.kind==='MOVE'){
  geometry={type:'hline',time:current.a.time,price:command.price};
 }else{
  const close=latestClosedAtMs/1000,fromTime=current.a.time,prior=current.b.time;
  const toTime=command.kind==='EXTEND_TO_CLOSE'?Math.max(prior,close):prior+(command.kind==='EXTEND'?1:-1)*command.bars*steps[frame];
  if(toTime<=fromTime||toTime>close)return fail('OUT_OF_RANGE');
  geometry={type:'rectangle',fromTime,toTime,lower:current.b.price,upper:current.a.price};
 }
 const plan=prepareChartDrawingPlan({workspace,actions:[geometry],now});
 if(!plan||plan.drawingRevision!==snapshot.revision||plan.actions[0].a.time*1000>latestClosedAtMs||plan.actions[0].b.time*1000>latestClosedAtMs)return fail('DENIED');
 const a=plan.actions[0].a,b=plan.actions[0].b;
 if(a.time===current.a.time&&a.price===current.a.price&&b.time===current.b.time&&b.price===current.b.price)return fail('NO_CHANGES');
 // Preserve the original detector reference but identify the annotation as
 // explicitly user-adjusted; it is not a newly verified market observation.
 const edited=normalizeDrawing({...current,a:{...a},b:{...b},aiGeometryAdjusted:true});
 return {state:'READY',current,edited,command};
}
,'i').exec(q);
 if(m){
  const n=Number(m[4]),kind=m[3].toUpperCase();
  if(kind==='WIDTH'&&n>=1&&n<=4&&(!m[5]||m[5].toLowerCase()==='px'))return {kind,target:targetFor(m[2]),selected:!!m[1],width:n};
  if(kind==='OPACITY'&&n>=10&&n<=100&&m[5]==='%')return {kind,target:targetFor(m[2]),selected:!!m[1],opacity:n/100};
 }
 m=new RegExp('^label '+targetPattern+' as "([A-Za-z0-9 .,_:/()%-]{1,48})"[.!]?
export function drawingEditCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 let m=/^(extend|shorten) (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) by ([1-9][0-9]?) candles?[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:m[1].toUpperCase(),target:'rectangle',selected:!!m[2],bars:Number(m[3])});
 m=/^extend (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) to (?:the )?latest closed candle[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:!!m[1]});
 m=/^move (?:the )?(selected )?(?:ai )?liquidity (?:line|level) to ((?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,12})?)[.!]?$/i.exec(q);
 if(m&&Number(m[2])>0&&Number(m[2])<=1e12)return Object.freeze({kind:'MOVE',target:'hline',selected:!!m[1],price:Number(m[2])});
 return null;
}
export function planDrawingEdit({question,workspace,snapshot,selection,latestClosedAtMs,now=Date.now()}={}){
 const command=drawingEditCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!timeframes.includes(frame)||!Array.isArray(snapshot?.present)||!Number.isSafeInteger(latestClosedAtMs)||latestClosedAtMs%1000!==0)return fail('DENIED');
 const symbol=workspace.symbol;
 const scoped=snapshot.present.filter(d=>d.type===command.target&&visibleDrawingOnTimeframe(d,frame));
 let candidates;
 if(command.selected){
  if(selection?.symbol!==symbol||selection.chartInstanceId!==workspace.chartInstanceId)return fail('NO_TARGET');
  candidates=scoped.filter(d=>d.id===selection.selectedId);
 }else candidates=scoped;
 if(!candidates.length)return fail('NO_TARGET');
 if(candidates.length!==1)return fail('AMBIGUOUS_TARGET');
 const current=candidates[0];
 if(drawingOwnership(symbol,current)!=='VERIFIED_AI'||current.locked||current.hidden||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return fail('PROTECTED_TARGET');
 let geometry;
 if(command.kind==='MOVE'){
  geometry={type:'hline',time:current.a.time,price:command.price};
 }else{
  const close=latestClosedAtMs/1000,fromTime=current.a.time,prior=current.b.time;
  const toTime=command.kind==='EXTEND_TO_CLOSE'?Math.max(prior,close):prior+(command.kind==='EXTEND'?1:-1)*command.bars*steps[frame];
  if(toTime<=fromTime||toTime>close)return fail('OUT_OF_RANGE');
  geometry={type:'rectangle',fromTime,toTime,lower:current.b.price,upper:current.a.price};
 }
 const plan=prepareChartDrawingPlan({workspace,actions:[geometry],now});
 if(!plan||plan.drawingRevision!==snapshot.revision||plan.actions[0].a.time*1000>latestClosedAtMs||plan.actions[0].b.time*1000>latestClosedAtMs)return fail('DENIED');
 const a=plan.actions[0].a,b=plan.actions[0].b;
 if(a.time===current.a.time&&a.price===current.a.price&&b.time===current.b.time&&b.price===current.b.price)return fail('NO_CHANGES');
 // Preserve the original detector reference but identify the annotation as
 // explicitly user-adjusted; it is not a newly verified market observation.
 const edited=normalizeDrawing({...current,a:{...a},b:{...b},aiGeometryAdjusted:true});
 return {state:'READY',current,edited,command};
}
,'i').exec(q);
 if(m&&m[3].trim())return {kind:'LABEL',target:targetFor(m[2]),selected:!!m[1],text:m[3].trim()};
 m=new RegExp('^clear (?:the )?label (?:on|of) '+targetPattern+'[.!]?
export function drawingEditCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 let m=/^(extend|shorten) (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) by ([1-9][0-9]?) candles?[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:m[1].toUpperCase(),target:'rectangle',selected:!!m[2],bars:Number(m[3])});
 m=/^extend (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) to (?:the )?latest closed candle[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:!!m[1]});
 m=/^move (?:the )?(selected )?(?:ai )?liquidity (?:line|level) to ((?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,12})?)[.!]?$/i.exec(q);
 if(m&&Number(m[2])>0&&Number(m[2])<=1e12)return Object.freeze({kind:'MOVE',target:'hline',selected:!!m[1],price:Number(m[2])});
 return null;
}
export function planDrawingEdit({question,workspace,snapshot,selection,latestClosedAtMs,now=Date.now()}={}){
 const command=drawingEditCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!timeframes.includes(frame)||!Array.isArray(snapshot?.present)||!Number.isSafeInteger(latestClosedAtMs)||latestClosedAtMs%1000!==0)return fail('DENIED');
 const symbol=workspace.symbol;
 const scoped=snapshot.present.filter(d=>d.type===command.target&&visibleDrawingOnTimeframe(d,frame));
 let candidates;
 if(command.selected){
  if(selection?.symbol!==symbol||selection.chartInstanceId!==workspace.chartInstanceId)return fail('NO_TARGET');
  candidates=scoped.filter(d=>d.id===selection.selectedId);
 }else candidates=scoped;
 if(!candidates.length)return fail('NO_TARGET');
 if(candidates.length!==1)return fail('AMBIGUOUS_TARGET');
 const current=candidates[0];
 if(drawingOwnership(symbol,current)!=='VERIFIED_AI'||current.locked||current.hidden||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return fail('PROTECTED_TARGET');
 let geometry;
 if(command.kind==='MOVE'){
  geometry={type:'hline',time:current.a.time,price:command.price};
 }else{
  const close=latestClosedAtMs/1000,fromTime=current.a.time,prior=current.b.time;
  const toTime=command.kind==='EXTEND_TO_CLOSE'?Math.max(prior,close):prior+(command.kind==='EXTEND'?1:-1)*command.bars*steps[frame];
  if(toTime<=fromTime||toTime>close)return fail('OUT_OF_RANGE');
  geometry={type:'rectangle',fromTime,toTime,lower:current.b.price,upper:current.a.price};
 }
 const plan=prepareChartDrawingPlan({workspace,actions:[geometry],now});
 if(!plan||plan.drawingRevision!==snapshot.revision||plan.actions[0].a.time*1000>latestClosedAtMs||plan.actions[0].b.time*1000>latestClosedAtMs)return fail('DENIED');
 const a=plan.actions[0].a,b=plan.actions[0].b;
 if(a.time===current.a.time&&a.price===current.a.price&&b.time===current.b.time&&b.price===current.b.price)return fail('NO_CHANGES');
 // Preserve the original detector reference but identify the annotation as
 // explicitly user-adjusted; it is not a newly verified market observation.
 const edited=normalizeDrawing({...current,a:{...a},b:{...b},aiGeometryAdjusted:true});
 return {state:'READY',current,edited,command};
}
,'i').exec(q);
 if(m)return {kind:'LABEL',target:targetFor(m[2]),selected:!!m[1],text:''};
 m=new RegExp('^(hide|show) '+targetPattern+'[.!]?
export function drawingEditCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 let m=/^(extend|shorten) (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) by ([1-9][0-9]?) candles?[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:m[1].toUpperCase(),target:'rectangle',selected:!!m[2],bars:Number(m[3])});
 m=/^extend (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) to (?:the )?latest closed candle[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:!!m[1]});
 m=/^move (?:the )?(selected )?(?:ai )?liquidity (?:line|level) to ((?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,12})?)[.!]?$/i.exec(q);
 if(m&&Number(m[2])>0&&Number(m[2])<=1e12)return Object.freeze({kind:'MOVE',target:'hline',selected:!!m[1],price:Number(m[2])});
 return null;
}
export function planDrawingEdit({question,workspace,snapshot,selection,latestClosedAtMs,now=Date.now()}={}){
 const command=drawingEditCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!timeframes.includes(frame)||!Array.isArray(snapshot?.present)||!Number.isSafeInteger(latestClosedAtMs)||latestClosedAtMs%1000!==0)return fail('DENIED');
 const symbol=workspace.symbol;
 const scoped=snapshot.present.filter(d=>d.type===command.target&&visibleDrawingOnTimeframe(d,frame));
 let candidates;
 if(command.selected){
  if(selection?.symbol!==symbol||selection.chartInstanceId!==workspace.chartInstanceId)return fail('NO_TARGET');
  candidates=scoped.filter(d=>d.id===selection.selectedId);
 }else candidates=scoped;
 if(!candidates.length)return fail('NO_TARGET');
 if(candidates.length!==1)return fail('AMBIGUOUS_TARGET');
 const current=candidates[0];
 if(drawingOwnership(symbol,current)!=='VERIFIED_AI'||current.locked||current.hidden||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return fail('PROTECTED_TARGET');
 let geometry;
 if(command.kind==='MOVE'){
  geometry={type:'hline',time:current.a.time,price:command.price};
 }else{
  const close=latestClosedAtMs/1000,fromTime=current.a.time,prior=current.b.time;
  const toTime=command.kind==='EXTEND_TO_CLOSE'?Math.max(prior,close):prior+(command.kind==='EXTEND'?1:-1)*command.bars*steps[frame];
  if(toTime<=fromTime||toTime>close)return fail('OUT_OF_RANGE');
  geometry={type:'rectangle',fromTime,toTime,lower:current.b.price,upper:current.a.price};
 }
 const plan=prepareChartDrawingPlan({workspace,actions:[geometry],now});
 if(!plan||plan.drawingRevision!==snapshot.revision||plan.actions[0].a.time*1000>latestClosedAtMs||plan.actions[0].b.time*1000>latestClosedAtMs)return fail('DENIED');
 const a=plan.actions[0].a,b=plan.actions[0].b;
 if(a.time===current.a.time&&a.price===current.a.price&&b.time===current.b.time&&b.price===current.b.price)return fail('NO_CHANGES');
 // Preserve the original detector reference but identify the annotation as
 // explicitly user-adjusted; it is not a newly verified market observation.
 const edited=normalizeDrawing({...current,a:{...a},b:{...b},aiGeometryAdjusted:true});
 return {state:'READY',current,edited,command};
}
,'i').exec(q);
 if(m)return {kind:m[1].toUpperCase(),target:targetFor(m[3]),selected:!!m[2]};
 m=new RegExp('^show '+targetPattern+' on (all timeframes|this timeframe only)[.!]?
export function drawingEditCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 let m=/^(extend|shorten) (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) by ([1-9][0-9]?) candles?[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:m[1].toUpperCase(),target:'rectangle',selected:!!m[2],bars:Number(m[3])});
 m=/^extend (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) to (?:the )?latest closed candle[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:!!m[1]});
 m=/^move (?:the )?(selected )?(?:ai )?liquidity (?:line|level) to ((?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,12})?)[.!]?$/i.exec(q);
 if(m&&Number(m[2])>0&&Number(m[2])<=1e12)return Object.freeze({kind:'MOVE',target:'hline',selected:!!m[1],price:Number(m[2])});
 return null;
}
export function planDrawingEdit({question,workspace,snapshot,selection,latestClosedAtMs,now=Date.now()}={}){
 const command=drawingEditCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!timeframes.includes(frame)||!Array.isArray(snapshot?.present)||!Number.isSafeInteger(latestClosedAtMs)||latestClosedAtMs%1000!==0)return fail('DENIED');
 const symbol=workspace.symbol;
 const scoped=snapshot.present.filter(d=>d.type===command.target&&visibleDrawingOnTimeframe(d,frame));
 let candidates;
 if(command.selected){
  if(selection?.symbol!==symbol||selection.chartInstanceId!==workspace.chartInstanceId)return fail('NO_TARGET');
  candidates=scoped.filter(d=>d.id===selection.selectedId);
 }else candidates=scoped;
 if(!candidates.length)return fail('NO_TARGET');
 if(candidates.length!==1)return fail('AMBIGUOUS_TARGET');
 const current=candidates[0];
 if(drawingOwnership(symbol,current)!=='VERIFIED_AI'||current.locked||current.hidden||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return fail('PROTECTED_TARGET');
 let geometry;
 if(command.kind==='MOVE'){
  geometry={type:'hline',time:current.a.time,price:command.price};
 }else{
  const close=latestClosedAtMs/1000,fromTime=current.a.time,prior=current.b.time;
  const toTime=command.kind==='EXTEND_TO_CLOSE'?Math.max(prior,close):prior+(command.kind==='EXTEND'?1:-1)*command.bars*steps[frame];
  if(toTime<=fromTime||toTime>close)return fail('OUT_OF_RANGE');
  geometry={type:'rectangle',fromTime,toTime,lower:current.b.price,upper:current.a.price};
 }
 const plan=prepareChartDrawingPlan({workspace,actions:[geometry],now});
 if(!plan||plan.drawingRevision!==snapshot.revision||plan.actions[0].a.time*1000>latestClosedAtMs||plan.actions[0].b.time*1000>latestClosedAtMs)return fail('DENIED');
 const a=plan.actions[0].a,b=plan.actions[0].b;
 if(a.time===current.a.time&&a.price===current.a.price&&b.time===current.b.time&&b.price===current.b.price)return fail('NO_CHANGES');
 // Preserve the original detector reference but identify the annotation as
 // explicitly user-adjusted; it is not a newly verified market observation.
 const edited=normalizeDrawing({...current,a:{...a},b:{...b},aiGeometryAdjusted:true});
 return {state:'READY',current,edited,command};
}
,'i').exec(q);
 if(m)return {kind:'TIMEFRAME',target:targetFor(m[2]),selected:!!m[1],visibility:m[3].toLowerCase()==='all timeframes'?'all':'current'};
 return null;
}
export function drawingEditCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 let m=/^(extend|shorten) (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) by ([1-9][0-9]?) candles?[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:m[1].toUpperCase(),target:'rectangle',selected:!!m[2],bars:Number(m[3])});
 m=/^extend (?:the )?(selected )?(?:ai )?(?:fvg|fair value gap) to (?:the )?latest closed candle[.!]?$/i.exec(q);
 if(m)return Object.freeze({kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:!!m[1]});
 m=/^move (?:the )?(selected )?(?:ai )?liquidity (?:line|level) to ((?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,12})?)[.!]?$/i.exec(q);
 if(m&&Number(m[2])>0&&Number(m[2])<=1e12)return Object.freeze({kind:'MOVE',target:'hline',selected:!!m[1],price:Number(m[2])});
 return null;
}
export function planDrawingEdit({question,workspace,snapshot,selection,latestClosedAtMs,now=Date.now()}={}){
 const command=drawingEditCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!timeframes.includes(frame)||!Array.isArray(snapshot?.present)||!Number.isSafeInteger(latestClosedAtMs)||latestClosedAtMs%1000!==0)return fail('DENIED');
 const symbol=workspace.symbol;
 const scoped=snapshot.present.filter(d=>d.type===command.target&&visibleDrawingOnTimeframe(d,frame));
 let candidates;
 if(command.selected){
  if(selection?.symbol!==symbol||selection.chartInstanceId!==workspace.chartInstanceId)return fail('NO_TARGET');
  candidates=scoped.filter(d=>d.id===selection.selectedId);
 }else candidates=scoped;
 if(!candidates.length)return fail('NO_TARGET');
 if(candidates.length!==1)return fail('AMBIGUOUS_TARGET');
 const current=candidates[0];
 if(drawingOwnership(symbol,current)!=='VERIFIED_AI'||current.locked||current.hidden||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return fail('PROTECTED_TARGET');
 let geometry;
 if(command.kind==='MOVE'){
  geometry={type:'hline',time:current.a.time,price:command.price};
 }else{
  const close=latestClosedAtMs/1000,fromTime=current.a.time,prior=current.b.time;
  const toTime=command.kind==='EXTEND_TO_CLOSE'?Math.max(prior,close):prior+(command.kind==='EXTEND'?1:-1)*command.bars*steps[frame];
  if(toTime<=fromTime||toTime>close)return fail('OUT_OF_RANGE');
  geometry={type:'rectangle',fromTime,toTime,lower:current.b.price,upper:current.a.price};
 }
 const plan=prepareChartDrawingPlan({workspace,actions:[geometry],now});
 if(!plan||plan.drawingRevision!==snapshot.revision||plan.actions[0].a.time*1000>latestClosedAtMs||plan.actions[0].b.time*1000>latestClosedAtMs)return fail('DENIED');
 const a=plan.actions[0].a,b=plan.actions[0].b;
 if(a.time===current.a.time&&a.price===current.a.price&&b.time===current.b.time&&b.price===current.b.price)return fail('NO_CHANGES');
 // Preserve the original detector reference but identify the annotation as
 // explicitly user-adjusted; it is not a newly verified market observation.
 const edited=normalizeDrawing({...current,a:{...a},b:{...b},aiGeometryAdjusted:true});
 return {state:'READY',current,edited,command};
}
