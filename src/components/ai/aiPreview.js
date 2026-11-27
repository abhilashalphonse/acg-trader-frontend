// Development-only presentation gate. Query parameters cannot enable a production build.
export function isAiChatPreviewEnabled(dev,search=''){
  return dev===true&&new URLSearchParams(search).get('acg_ai_preview')==='1';
}
const symbols=/^[A-Z0-9._-]{1,32}$/;
const timeframes=new Set(['1m','5m','15m','30m','1h','4h','1d','1w']);
export function chartContextLabel(symbol,timeframe){
  const s=typeof symbol==='string'?symbol.toUpperCase():'';
  const tf=typeof timeframe==='string'?timeframe.toLowerCase():'';
  return {symbol:symbols.test(s)?s:null,timeframe:timeframes.has(tf)?tf:null};
}
export function questionBytes(value){return new TextEncoder().encode(value).length;}
export const MAX_QUESTION_BYTES=4096;
export const SUGGESTIONS=Object.freeze([
  {label:'Market structure',prompt:'Describe the observed market structure.'},
  {label:'Key levels',prompt:'Identify the key observed support and resistance references.'},
  {label:'Explain BOS',prompt:'Explain break of structure (BOS).'},
]);
