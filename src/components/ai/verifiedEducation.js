// Isolated presentation contract, not a replacement for server-side verification.
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const time=v=>Number.isSafeInteger(v)&&v>0&&v<=8640000000000000;
const token=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const ids=new Set(['EVIDENCE_QUALITY','MARKET_STRUCTURE','LIQUIDITY','FVG','SESSION_RANGE','MULTI_TIMEFRAME','INDICATORS','RISK_BOUNDARY']);
const str=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const invalid=()=>{throw Error('Invalid verified education response');};
export function projectVerifiedEducation(message){
  const run=message?.providerRun,view=message?.verifiedEducation;
  if(!run){if(view!=null||message?.fixtureProviderOnly===true)invalid();return null;}
  if(message.fixtureProviderOnly!==true||message.dispatchAllowed!==false||message.creditDeducted!==false||
    !['CLAIMED','VERIFIED','FAILED','HELD_UNKNOWN','SUPPRESSED'].includes(run.state)||
    !Array.isArray(run.referenceIds)||run.referenceIds.length>8||new Set(run.referenceIds).size!==run.referenceIds.length||
    !run.referenceIds.every(hash))invalid();
  if(run.state!=='VERIFIED'){
    if(view!=null||run.referenceIds.length||run.responseId!=null||run.responseStatus!=null)invalid();
    return {state:run.state,entries:[]};
  }
  if(message.status!=='STORED_OFFLINE'||!view||view.schemaVersion!=='verified-education-view-v1'||
    view.verification!=='RECOMPUTED_REFERENCE_SELECTION_ONLY'||view.catalogVersion!=='acg-knowledge-v1'||view.fixtureOnly!==true||
    !hash(run.responseId)||view.responseId!==run.responseId||!time(run.verifiedAtMs)||!time(run.responseExpiresAtMs)||
    run.verifiedAtMs>=run.responseExpiresAtMs||view.verifiedAtMs!==run.verifiedAtMs||view.responseExpiresAtMs!==run.responseExpiresAtMs||
    !token(run.inputTokens,8192)||!token(run.outputTokens,1024)||
    !['ANSWER','INSUFFICIENT_EVIDENCE','UNSUPPORTED'].includes(run.responseStatus)||view.status!==run.responseStatus||
    !Array.isArray(view.entries)||view.entries.length!==run.referenceIds.length||
    (view.status==='ANSWER'&&!view.entries.length)||(view.status==='UNSUPPORTED'&&view.entries.length))invalid();
  const entries=view.entries.map((e,i)=>{
    if(e?.knowledgeId!==run.referenceIds[i]||!ids.has(e.id)||!str(e.title,128)||!str(e.text,2048)||
      !str(e.methodVersion,128)||e.reviewStatus!=='ENGINEERING_DRAFT'||e.distribution!=='INTERNAL_ONLY')invalid();
    return {knowledgeId:e.knowledgeId,title:e.title,text:e.text,methodVersion:e.methodVersion};
  });
  return {state:'VERIFIED',status:view.status,verifiedAtMs:view.verifiedAtMs,entries};
}
