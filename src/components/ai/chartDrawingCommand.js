// Explicit direct-user drawing intent only. Never parse assistant output,
// quoted instructions, external notes, compound commands or streamed text.
export function chartDrawingCommand(question){
 if(typeof question!=='string')return null;
 const q=question.trim().replace(/\s+/g,' ');
 if(/^(?:mark|draw|plot) (?:the )?(?:significant |key |current |recent )?liquidity(?: levels| references)?(?: on (?:my|the) chart)?[.!]?$/i.test(q))return 'LIQUIDITY';
 if(/^(?:mark|draw|plot) (?:the )?(?:significant |key |current |recent )?(?:fvgs?|fair value gaps?)(?: on (?:my|the) chart)?[.!]?$/i.test(q))return 'FVG';
 return null;
}
export function verifiedDrawingResponse(value,{request,symbol,timeframe}){
 if(value?.contractVersion!=='restricted-pilot-v1'||value.mode!=='WORKSPACE_CHAT'||value.executionAllowed!==false||
 value.actionId!==request.actionId||value.workspace?.symbol!==symbol||value.workspace?.timeframe!==timeframe)return null;
 if(value.state==='NO_CANDIDATES'&&value.receipt===null)return {state:'EMPTY'};
 if(value.state!=='DRAWING_READY'||value.receipt?.actionId!==request.actionId||
 value.receipt?.context?.chartContextVersion!==request.chartContextVersion||
 value.receipt?.context?.latestClosedAtMs!==request.latestClosedAtMs)return null;
 return {state:'READY',receipt:value.receipt};
}
