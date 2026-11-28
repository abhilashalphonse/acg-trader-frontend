// Presentation-only helpers. No market claims are derived from assistant prose.
export function chartFeedStatus(market,symbol){
  if(!market||market.symbol!==symbol)return 'UNKNOWN';
  if(market.sessionOpen===false)return 'CLOSED';
  if(market.isStale===true)return 'STALE';
  if(market.sessionOpen===true&&market.live===true&&market.isStale===false&&
    Number(market.bid)>0&&Number(market.ask)>=Number(market.bid))return 'LIVE';
  return 'UNKNOWN';
}
export function followUpSuggestions(text){
  if(typeof text!=='string'||!text.trim())return [];
  const choices=[];
  if(/\b(retest|reclaim)\b/i.test(text))choices.push({label:'Explain the retest',prompt:'Explain the retest or reclaim you mentioned, and what would confirm it.'});
  else if(/\b(risk|margin|exposure|position sizing)\b/i.test(text))choices.push({label:'Explain the risk',prompt:'Explain the risk in your previous answer in more detail.'});
  else if(/\b(breakout|breakdown|confirmation|setup)\b/i.test(text))choices.push({label:'What confirms it?',prompt:'What would confirm the setup or scenario you just described?'});
  else if(/\b(liquidity|structure|FVG|support|resistance)\b/i.test(text))choices.push({label:'Explain the levels',prompt:'Explain the market references and levels you just described.'});
  choices.push({label:'Summarise',prompt:'Summarise your previous answer in a few sentences.'});
  return choices;
}
export function regenerationQuestion(messages,historyStart,answerId){
  const index=messages.length-1;
  if(index<1||messages[index]?.role!=='assistant'||messages[index].id!==answerId||
    messages[index-1]?.role!=='user'||index-1<historyStart)return null;
  return messages[index-1].text;
}

export function workspaceFailureNotice(result,expected){
  if(result?.contractVersion!=='restricted-pilot-v1'||result.mode!=='WORKSPACE_CHAT'||result.executionAllowed!==false||
    result.operationId!==expected.operationId||result.workspace?.symbol!==expected.symbol||result.workspace?.timeframe!==expected.timeframe)
    return 'AI response could not be verified. No automatic retry.';
  if(result.state==='HELD_UNKNOWN')return 'Request outcome uncertain. No automatic retry.';
  if(result.state!=='FAILED')return 'AI response could not be verified. No automatic retry.';
  switch(result.failureReason){
    case 'DAILY_REQUEST_LIMIT':return 'Daily AI request allowance reached. Requests reset at 00:00 UTC.';
    case 'DAILY_SPEND_LIMIT':return 'Daily AI spending allowance cannot cover this request. Try after the 00:00 UTC reset.';
    case 'COMPLETION_LIMIT':return 'AI reached its response limit before finishing. Try a more focused question.';
    case 'PROVIDER_REFUSED':return 'The AI provider did not return an answer.';
    case 'INVALID_ANSWER':return 'AI returned an unreadable answer. No automatic retry.';
    case 'DELIVERY_UNAVAILABLE':return 'AI response could not be delivered. No automatic retry.';
    default:return 'AI did not complete this answer. No automatic retry.';
  }
}
