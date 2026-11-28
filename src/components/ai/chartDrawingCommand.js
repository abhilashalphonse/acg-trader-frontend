// Explicit direct-user chart-only intent. Never parse assistant output,
// quotations, external notes, financial instructions or streamed text.
const LIQ='(?:the )?(?:significant |key |current |recent )?liquidity(?: levels| references)?';
const FVG='(?:the )?(?:significant |key |current |recent )?(?:fvgs?|fair value gaps?)';
const verb='(?:mark|draw|plot) ';
const end='(?: on (?:my|the) chart)?[.!]?$';
const one=(noun)=>new RegExp('^'+verb+noun+end,'i');
const pair=(first,second)=>new RegExp('^'+verb+first+'(?:,? then | and (?:then )?)(?:'+verb+')?'+second+end,'i');
const undo=/^undo (?:the |my )?(?:last |previous )?ai (?:drawing batch|drawings?)(?: on (?:my|the) chart)?[.!]?$/i;
export function chartDrawingCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 if(undo.test(q))return 'UNDO';
 if(one(LIQ).test(q))return 'LIQUIDITY';
 if(one(FVG).test(q))return 'FVG';
 if(pair(LIQ,FVG).test(q))return 'LIQUIDITY_THEN_FVG';
 if(pair(FVG,LIQ).test(q))return 'FVG_THEN_LIQUIDITY';
 return null;
}
export function verifiedDrawingResponse(value,{request,symbol,timeframe,command}){
 if(value?.contractVersion!=='restricted-pilot-v1'||value.mode!=='WORKSPACE_CHAT'||value.executionAllowed!==false||
 value.actionId!==request.actionId||value.workspace?.symbol!==symbol||value.workspace?.timeframe!==timeframe)return null;
 if(value.state==='NO_CANDIDATES'&&value.receipt===null)return {state:'EMPTY'};
 if(value.state!=='DRAWING_READY'||value.receipt?.actionId!==request.actionId||
 value.receipt?.context?.chartContextVersion!==request.chartContextVersion||
 value.receipt?.context?.latestClosedAtMs!==request.latestClosedAtMs)return null;
 // Only the ordered drawing types requested by the user may be accepted.
 if(command){
  const order={LIQUIDITY:['hline'],FVG:['rectangle'],LIQUIDITY_THEN_FVG:['hline','rectangle'],FVG_THEN_LIQUIDITY:['rectangle','hline']}[command];
  const actions=value.receipt.actions;
  if(!order||!Array.isArray(actions)||actions.length<1||actions.length>6)return null;
  let previous=-1;const counts=new Map();
  for(const a of actions){
   const type=a?.geometry?.type,index=order.indexOf(type);
   counts.set(type,(counts.get(type)||0)+1);
   if(index<0||index<previous||counts.get(type)>(order.length===1?6:3))return null;
   previous=index;
  }
 }
 return {state:'READY',receipt:value.receipt};
}
