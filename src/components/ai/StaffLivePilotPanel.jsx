import React,{useEffect,useRef,useState} from 'react';
import {apiRequest} from '../../api/client.js';
import {chartContextLabel} from './aiPreview.js';
const labels=Object.freeze({LAST_CLOSED_PRICE:'Last closed price',OBSERVED_RANGE_HIGH:'Observed high',OBSERVED_RANGE_LOW:'Observed low',
  SMA_20:'SMA 20',MEAN_TRUE_RANGE_14:'Mean true range (14)',CONFIRMED_SWING_HIGH:'Confirmed swing high',CONFIRMED_SWING_LOW:'Confirmed swing low'});
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const decimal=v=>typeof v==='string'&&/^-?(?:0|[1-9]\d{0,19})(?:\.\d{1,12})?$/.test(v);
const utc=v=>new Date(v).toISOString().replace('T',' ').slice(0,19)+' UTC';
export function projectStaffPilotResult(result,{symbol,timeframe,operationId},now=Date.now()){
  const r=result?.response;
  if(result?.contractVersion!=='restricted-pilot-v1'||result.mode!=='HISTORICAL_REFERENCE_ONLY'||result.executionAllowed!==false||
    result.operationId!==operationId||result.state!=='VERIFIED'||result.workspace?.symbol!==symbol||result.workspace?.timeframe!==timeframe||
    result.workspace?.includeChartContext!==true||!['twelve-data','accelpix'].includes(result.source?.provider)||
    r?.schemaVersion!=='verified-response-v1'||r.verification!=='RECOMPUTED_REFERENCE_SELECTION_ONLY'||r.symbol!==symbol||
    r.quoteStatus!=='UNAVAILABLE'||!hash(r.responseId)||!hash(r.packageId)||!hash(r.contextId)||
    !['ANSWER','INSUFFICIENT_EVIDENCE','UNSUPPORTED'].includes(r.status)||
    !Number.isSafeInteger(r.asOfMs)||!Number.isSafeInteger(r.verifiedAtMs)||!Number.isSafeInteger(r.expiresAtMs)||
    r.asOfMs<=0||r.asOfMs>r.verifiedAtMs||r.verifiedAtMs>now+5000||r.verifiedAtMs>=r.expiresAtMs||r.expiresAtMs!==r.asOfMs+10000||
    now>=r.expiresAtMs||!Array.isArray(r.frames)||r.frames.length!==1||r.frames[0]?.timeframe!==timeframe||
    !Array.isArray(r.observations)||r.observations.length>32||!Array.isArray(r.interpretations)||r.interpretations.length>8||
    !Array.isArray(r.education)||r.education.length>8)return null;
  const facts=[],structure=[];
  for(const ref of r.observations){
    if(!hash(ref?.referenceId)||!hash(ref.sourceId)||ref.timeframe!==timeframe)continue;
    const d=ref.data;
    if(ref.type==='FACT'&&Object.hasOwn(labels,d?.kind)&&decimal(d.value)&&Number.isSafeInteger(d.throughCloseTimeMs)&&d.throughCloseTimeMs<=r.asOfMs)
      facts.push({id:ref.referenceId,label:labels[d.kind],value:d.value});
    if(ref.type==='STRUCTURE_SUMMARY'&&['BULLISH','BEARISH','NEUTRAL','UNDETERMINED','UNKNOWN'].includes(d?.bias))
      structure.push({id:ref.referenceId,label:'Observed structure',value:d.bias});
    if(ref.type==='FVG_ZONE'&&decimal(d?.lower)&&decimal(d?.upper))
      structure.push({id:ref.referenceId,label:'Historical gap zone',value:d.lower+' – '+d.upper});
    if(ref.type==='LIQUIDITY_REFERENCE'&&decimal(d?.level))
      structure.push({id:ref.referenceId,label:'Potential liquidity reference',value:d.level});
  }
  for(const i of r.interpretations){
    if(i?.code==='BREAK_HISTORY'&&i.reference?.type==='STRUCTURE_SUMMARY'&&hash(i.reference.referenceId)&&
      ['BULLISH','BEARISH','NEUTRAL','UNDETERMINED','UNKNOWN'].includes(i.reference.data?.bias))
      structure.push({id:i.reference.referenceId,label:'Observed break history',value:i.reference.data.bias});
  }
  const usage=result.usage;
  if(!Number.isSafeInteger(usage?.inputTokens)||usage.inputTokens<0||usage.inputTokens>32768||
     !Number.isSafeInteger(usage?.outputTokens)||usage.outputTokens<0||usage.outputTokens>1024)return null;
  return {status:r.status,asOfMs:r.asOfMs,source:result.source.provider,facts:[...new Map([...facts,...structure].map(f=>[f.id,f])).values()],
    tokens:usage.inputTokens+usage.outputTokens};
}
export function projectStaffEducationResult(result,operationId,now=Date.now()){
  const r=result?.response;
  if(result?.contractVersion!=='restricted-pilot-v1'||result.mode!=='EDUCATION_ONLY'||result.executionAllowed!==false||
    result.operationId!==operationId||result.state!=='VERIFIED'||result.workspace?.symbol!=='EDUCATION'||
    result.workspace?.timeframe!=='1m'||result.workspace?.includeChartContext!==false||result.source?.provider!=='ACG_INTERNAL_ORIGINAL'||
    r?.schemaVersion!=='verified-response-v1'||r.verification!=='RECOMPUTED_REFERENCE_SELECTION_ONLY'||r.symbol!==null||r.contextId!==null||
    !hash(r.responseId)||!hash(r.packageId)||!['ANSWER','INSUFFICIENT_EVIDENCE','UNSUPPORTED'].includes(r.status)||
    !Number.isSafeInteger(r.verifiedAtMs)||!Number.isSafeInteger(r.expiresAtMs)||r.verifiedAtMs>now+5000||
    now>=r.expiresAtMs||r.verifiedAtMs>=r.expiresAtMs||
    !Array.isArray(r.frames)||r.frames.length!==0||!Array.isArray(r.observations)||r.observations.length!==0||
    !Array.isArray(r.interpretations)||r.interpretations.length!==0||
    !Array.isArray(r.education)||r.education.length>8)return null;
  if(!r.education.every(k=>hash(k.knowledgeId)&&k.origin==='ACG_INTERNAL_ORIGINAL'&&k.reviewStatus==='ENGINEERING_DRAFT'&&
    typeof k.title==='string'&&k.title.length<=120&&typeof k.text==='string'&&k.text.length<=1500))return null;
  const u=result.usage;
  if(!Number.isSafeInteger(u?.inputTokens)||u.inputTokens<0||u.inputTokens>32768||
     !Number.isSafeInteger(u?.outputTokens)||u.outputTokens<0||u.outputTokens>1024)return null;
  return {status:r.status,education:r.education,tokens:u.inputTokens+u.outputTokens};
}
export default function StaffLivePilotPanel({runtime,symbol,timeframe}){
  const educationOnly=runtime?.runtimeMode==='EDUCATION_ONLY';
  const chart=educationOnly?{symbol:'EDUCATION',timeframe:'1m'}:chartContextLabel(symbol,timeframe);
  const [connectionId]=useState(()=>crypto.randomUUID());
  const [consent,setConsent]=useState(null);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState(null);
  const [notice,setNotice]=useState('');
  const active=useRef(null),inFlight=useRef(false);
  const valid=Boolean(chart.symbol&&chart.timeframe&&runtime?.token&&runtime.accountId);
  const body=()=>({accountId:runtime.accountId,connectionId,symbol:chart.symbol,timeframe:chart.timeframe});
  const call=(op,extra,signal)=>apiRequest('/v1/ai/pilot/'+op,{method:'POST',token:runtime.token,body:{...body(),...extra},signal,timeoutMs:15000});
  useEffect(()=>{
    if(!valid)return;
    const controller=new AbortController();active.current=controller;
    setConsent(null);setChecked(false);setReport(null);setNotice('');
    call('status',{},controller.signal).then(v=>{
      if(!controller.signal.aborted&&v?.contractVersion==='restricted-pilot-v1'&&v.executionAllowed===false&&
        Number.isSafeInteger(v.revision)&&v.revision>=0&&v.model==='gpt-6-luna'&&v.mode===(educationOnly?'EDUCATION_ONLY':'HISTORICAL_REFERENCE_ONLY'))setConsent(v);
    }).catch(()=>{if(!controller.signal.aborted)setNotice('Pilot unavailable for this chart or account.');});
    return ()=>{controller.abort();active.current=null;};
  },[runtime?.token,runtime?.accountId,runtime?.sessionId,chart.symbol,chart.timeframe,connectionId,valid,educationOnly]);
  async function run(intent){
    const controller=active.current;
    if(!valid||!controller||controller.signal.aborted||inFlight.current||!checked||!consent)return;
    inFlight.current=true;setBusy(true);setReport(null);setNotice('');
    try{
      const grant=await call('grant',{expectedRevision:consent.revision,explicitConsent:true},controller.signal);
      if(controller.signal.aborted)return;
      if(grant?.contractVersion!=='restricted-pilot-v1'||grant.executionAllowed!==false||grant.revision!==consent.revision+1)throw Error('Invalid grant');
      setConsent({...consent,revision:grant.revision,active:true});
      const operationId=crypto.randomUUID();
      const result=await call('generate',{operationId,intent},controller.signal);
      if(controller.signal.aborted)return;
      const projected=educationOnly?projectStaffEducationResult(result,operationId):projectStaffPilotResult(result,{...chart,operationId});
      if(!projected){setNotice(result?.state==='HELD_UNKNOWN'?'Request outcome uncertain. No automatic retry.':'No verified report returned.');return;}
      setReport(projected);
    }catch{if(!controller.signal.aborted)setNotice('Request unavailable. No automatic retry.');}
    finally{inFlight.current=false;if(!controller.signal.aborted)setBusy(false);}
  }
  async function revoke(){
    const controller=active.current;
    setChecked(false);setReport(null);
    if(!consent?.active||!controller||controller.signal.aborted||inFlight.current)return;
    inFlight.current=true;setBusy(true);
    try{
      const r=await call('revoke',{expectedRevision:consent.revision},controller.signal);
      if(!controller.signal.aborted&&r?.revoked===true)setConsent({...consent,revision:r.revision,active:false});
    }catch{if(!controller.signal.aborted)setNotice('Consent status uncertain. Reopen the panel to check.');}
    finally{inFlight.current=false;if(!controller.signal.aborted)setBusy(false);}
  }
  return <>
    <div className="aic-context"><div><span>Staff pilot · GPT-6 Luna</span><strong>{educationOnly?'Education · no chart export':(chart.symbol||'No chart')+' · '+(chart.timeframe||'—')}</strong></div>
      <label><input type="checkbox" checked={checked} disabled={!consent||busy} onChange={e=>e.target.checked?setChecked(true):void revoke()}/> {educationOnly?'Allow AI education request':'Include historical chart context'}</label></div>
    <div className="aic-body">
      {educationOnly?(report?<section className="aic-report" aria-label="Verified educational AI response">
        <div className="aic-report-heading"><strong>AI-selected explanation</strong><span>GPT-6 Luna</span></div>
        {report.education.length?report.education.map(k=><div key={k.knowledgeId}><strong>{k.title}</strong><p>{k.text}</p></div>):<p>No supported reference selected.</p>}
        <p>{report.tokens} provider-reported tokens. ACG reference material; no market data or trade execution.</p>
      </section>:<div className="aic-empty"><h3>Test ACG AI</h3><p>Ask about a trading concept. This live pilot sends only original ACG education material, not your chart or account data.</p></div>):report?<section className="aic-report" aria-label="Verified historical AI report">
        <div className="aic-report-heading"><strong>AI-selected historical report</strong><span>{chart.symbol} · {chart.timeframe}</span></div>
        <p>GPT-6 Luna selected references; ACG recomputed the facts. As of {utc(report.asOfMs)}. Source: {report.source}.</p>
        {report.facts.length?<dl className="aic-report-facts">{report.facts.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>:<p>No supported numerical or structural reference selected.</p>}
        <p>{report.tokens} provider-reported tokens. Historical evidence only; no execution or prediction.</p>
      </section>:<div className="aic-empty"><h3>Analyse the current chart</h3><p>Choose an approved historical analysis. No order execution or account data export.</p></div>}
      {notice&&<p role="status">{notice}</p>}
      <div className="aic-suggestions">{educationOnly?<>{[['EDUCATION_STRUCTURE','Market structure / BOS'],['EDUCATION_LIQUIDITY','Liquidity references'],['EDUCATION_FVG','Fair value gaps']].map(([intent,label])=><button key={intent} disabled={!checked||busy||!consent} onClick={()=>void run(intent)}>{label}</button>)}</>:<><button disabled={!checked||busy||!consent} onClick={()=>void run('HISTORICAL_OVERVIEW')}>Market overview</button>
        <button disabled={!checked||busy||!consent} onClick={()=>void run('HISTORICAL_STRUCTURE')}>Market structure</button></>}</div>
    </div>
    <div className="aic-footer"><span className="aic-model">{busy?'Analysing…':'Staff pilot · $1/day · 20 requests/day'}</span></div>
  </>;
}
