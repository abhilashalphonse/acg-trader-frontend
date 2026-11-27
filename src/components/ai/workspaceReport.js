import {chartContextLabel} from './aiPreview.js';
const FACT_LABELS=Object.freeze({LAST_CLOSED_PRICE:'Last closed price',OBSERVED_RANGE_HIGH:'Observed high',OBSERVED_RANGE_LOW:'Observed low',
  SMA_20:'SMA 20',MEAN_TRUE_RANGE_14:'Mean true range (14)',CONFIRMED_SWING_HIGH:'Confirmed swing high',CONFIRMED_SWING_LOW:'Confirmed swing low'});
const COVERAGE=Object.freeze({MATCHES_CONFIGURED_CALENDAR:'Matches configured calendar',OUT_OF_SESSION_DATA_REJECTED:'Out-of-session data rejected',
  INCOMPLETE:'Incomplete coverage',UNKNOWN:'Coverage unknown'});
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const clock=v=>Number.isSafeInteger(v)&&v>0&&v<8640000000000000;
const decimal=v=>typeof v==='string'&&/^-?(?:0|[1-9]\d{0,19})(?:\.\d{1,12})?$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export function workspaceContext(symbol,timeframe,consent){
  const c=chartContextLabel(symbol,timeframe);
  return consent===true&&c.symbol&&c.timeframe?{...c,includeChartContext:true}:null;
}
// Presentation contract validation, not cryptographic evidence verification.
// Only use with a trusted authenticated server response or labelled test fixture.
export function projectWorkspaceReport(envelope,expected,now=Date.now()){
  if(!envelope||!expected||!clock(now)||envelope.contractVersion!=='native-chat-v1'||envelope.runtimeEnabled!==false||
    envelope.mode!=='DETERMINISTIC_HISTORICAL_REPORT'||envelope.semanticAnswer!==false||envelope.offlineOnly!==true||
    envelope.dispatchAllowed!==false||envelope.creditDeducted!==false||
    !uuid(expected.conversationId)||!uuid(expected.messageId)||envelope.conversationId!==expected.conversationId||envelope.messageId!==expected.messageId)return null;
  const w=workspaceContext(expected.symbol,expected.timeframe,expected.includeChartContext);
  if(!w||envelope.workspace?.symbol!==w.symbol||envelope.workspace?.timeframe!==w.timeframe||envelope.workspace?.includeChartContext!==true)return null;
  const r=envelope.response;
  if(!r||r.schemaVersion!=='verified-response-v1'||r.verification!=='RECOMPUTED_REFERENCE_SELECTION_ONLY'||
    r.symbol!==w.symbol||r.quoteStatus!=='UNAVAILABLE'||!hash(r.responseId)||!hash(r.contextId)||!hash(r.packageId)||
    !['ANSWER','INSUFFICIENT_EVIDENCE'].includes(r.status)||![r.asOfMs,r.verifiedAtMs,r.expiresAtMs].every(clock)||
    r.asOfMs>r.verifiedAtMs||r.verifiedAtMs>now||now>=r.expiresAtMs||r.expiresAtMs!==r.asOfMs+10000||
    !Array.isArray(r.observations)||r.observations.length>8||!Array.isArray(r.interpretations)||r.interpretations.length>1||
    !Array.isArray(r.education)||r.education.length!==0||!Array.isArray(r.frames)||r.frames.length!==1||r.frames[0].timeframe!==w.timeframe||
    !Array.isArray(r.limitations)||!r.limitations.includes('NO_SEMANTIC_RELEVANCE_OR_COMPLETENESS_PROOF')||
    !['twelve-data','accelpix'].includes(envelope.source?.provider))return null;
  const facts=[],seen=new Set();
  for(const o of r.observations){
    const d=o?.data;
    if(o?.type!=='FACT'||o.timeframe!==w.timeframe||!hash(o.referenceId)||!hash(o.sourceId)||seen.has(o.referenceId)||
      !Object.hasOwn(FACT_LABELS,d?.kind)||!decimal(d.value)||d.unit!=='price'||!clock(d.throughCloseTimeMs)||d.throughCloseTimeMs>r.asOfMs)return null;
    seen.add(o.referenceId);
    facts.push({id:o.referenceId,sourceId:o.sourceId,label:FACT_LABELS[d.kind],value:d.value,throughCloseTimeMs:d.throughCloseTimeMs});
  }
  let structure=null;
  if(r.interpretations.length){
    const i=r.interpretations[0],ref=i?.reference;
    if(i?.code!=='BREAK_HISTORY'||ref?.type!=='STRUCTURE_SUMMARY'||ref.timeframe!==w.timeframe||!hash(ref.referenceId)||!hash(ref.sourceId))return null;
    // Render fixed explanatory copy, never arbitrary provider text.
    structure={sourceId:ref.sourceId,text:'Observed closed-candle break history is not a forecast of future direction.'};
  }
  if((r.status==='ANSWER')!==Boolean(facts.length||structure))return null;
  const coverage=r.frames[0]?.coverage?.status;
  return {symbol:w.symbol,timeframe:w.timeframe,status:r.status,asOfMs:r.asOfMs,expiresAtMs:r.expiresAtMs,
    provider:envelope.source.provider,coverage:Object.hasOwn(COVERAGE,coverage)?COVERAGE[coverage]:'Coverage not independently verified',
    facts,structure};
}
