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
