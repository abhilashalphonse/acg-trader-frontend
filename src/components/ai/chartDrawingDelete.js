// Selective deletion is a separate capability, never an edit command.
// One visible, verified AI drawing; all bulk or inferred deletions denied.
import {drawingOwnership} from './chartDrawingInventory.js';
import {visibleDrawingOnTimeframe} from '../../utils/drawingStore.js';
import {canonicalDrawingTimeframe} from '../../utils/drawingTools.js';
export function drawingDeleteCommand(question){
 if(typeof question!=='string')return null;
 const m=/^(?:delete|remove) (?:the )?(selected )?(?:ai )?(fvg|fair value gap|liquidity line|liquidity level|drawing)[.!]?$/i.exec(question.trim().replace(/\s+/g,' '));
 if(!m)return null;
 const target=/^(?:fvg|fair value gap)$/i.test(m[2])?'rectangle':/^liquidity /i.test(m[2])?'hline':null;
 return target||m[1]?Object.freeze({selected:!!m[1],target}):null;
}
export function resolveDrawingDeletion({question,workspace,snapshot,selection}={}){
 const command=drawingDeleteCommand(question),frame=canonicalDrawingTimeframe(workspace?.timeframe);
 if(!command||!Array.isArray(snapshot?.present)||!workspace?.symbol||!workspace.chartInstanceId||!frame)return {state:'DENIED'};
 let matches=snapshot.present.filter(d=>['hline','rectangle'].includes(d.type)&&(!command.target||d.type===command.target)&&visibleDrawingOnTimeframe(d,frame));
 if(command.selected){
  if(selection?.symbol!==workspace.symbol||selection.chartInstanceId!==workspace.chartInstanceId)return {state:'NO_TARGET'};
  matches=matches.filter(d=>d.id===selection.selectedId);
 }
 if(!matches.length)return {state:'NO_TARGET'};
 if(matches.length!==1)return {state:'AMBIGUOUS_TARGET'};
 const current=matches[0];
 if(current.locked||drawingOwnership(workspace.symbol,current)!=='VERIFIED_AI'||canonicalDrawingTimeframe(current.sourceTimeframe)!==frame)return {state:'PROTECTED_TARGET'};
 return {state:'READY',current,command};
}
