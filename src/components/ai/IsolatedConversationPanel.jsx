import React,{useEffect,useRef,useState} from 'react';
import {ArrowUp} from 'lucide-react';
import {questionBytes,MAX_QUESTION_BYTES} from './aiPreview.js';
import {projectVerifiedEducation} from './verifiedEducation.js';
import {matchesConversationWorkspace,projectWorkspaceReport,projectMarketRun,projectMarketGeneration} from './workspaceReport.js';
import VerifiedWorkspaceReport from './VerifiedWorkspaceReport.jsx';
import './isolatedConversation.css';

const stateText={CLAIMED:'Outcome pending or unconfirmed. No automatic retry.',FAILED:'Response not verified. No answer displayed.',HELD_UNKNOWN:'Provider outcome unknown. No automatic retry.',SUPPRESSED:'Response cancelled or suppressed.'};
function EducationAnswer({answer}){
  if(!answer)return null;
  if(answer.state!=='VERIFIED')return <div className="aic-answer" data-provider-state={answer.state}><small>{stateText[answer.state]}</small></div>;
  return <div className="aic-answer" data-provider-state="VERIFIED" data-verified-education>
    <div className="aic-answer-label">ACG AI · Verified reference selection</div>
    {answer.status!=='ANSWER'&&<p>{answer.status==='UNSUPPORTED'?'Question unsupported.':'Insufficient evidence for a complete answer.'}</p>}
    {answer.entries.map(e=><article key={e.knowledgeId}><strong>{e.title}</strong><p>{e.text}</p><small>{e.methodVersion}</small></article>)}
    <small>Historical isolated fixture · Engineering draft · Not a live market answer</small>
  </div>;
}

// Dev harness only: actual authenticated offline conversation persistence.
// Only explicitly advertised local provider fixtures; no public inference or production mount.
export default function IsolatedConversationPanel({client,chart,workspace=null,onConsentChange}){
  const [options,setOptions]=useState([]),[selection,setSelection]=useState(null);
  const [list,setList]=useState([]),[active,setActive]=useState(null),[messages,setMessages]=useState([]);
  const [draft,setDraft]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState(false);
  const lifecycle=useRef(null),lock=useRef(false),pending=useRef(null);
  const [pendingLocked,setPendingLocked]=useState(false);
  const [providerEnabled,setProviderEnabled]=useState(false);
  const [workspaceEnabled,setWorkspaceEnabled]=useState(false);
  const [marketProviderEnabled,setMarketProviderEnabled]=useState(false);
  const [report,setReport]=useState(null);
  const chartMode=workspace!==null;
  const [generationUnconfirmed,setGenerationUnconfirmed]=useState(false);
  const load=async(signal)=>{
    const v=await client.request('list',{},signal);
    if(!Array.isArray(v.conversations)||v.conversations.length>8)throw Error('Invalid history');
    setList(v.conversations.filter(c=>matchesConversationWorkspace(c,workspace)&&typeof c.conversationId==='string'));
  };
  const history=async(conversationId,signal)=>{
    setReport(null);
    const all=[];let cursor=0;
    for(let i=0;i<2;i++){
      const page=await client.request('history',{conversationId,afterSequence:cursor,limit:8},signal);
      if(!matchesConversationWorkspace(page.conversation,workspace)||!Array.isArray(page.messages)||page.messages.length>8)throw Error('Invalid history');
      for(const m of page.messages){
        if(m.role!=='USER'||m.conversationId!==conversationId||m.sequence!==all.length+1||
          !['STORED_OFFLINE','CANCELLED'].includes(m.status)||typeof m.text!=='string'||questionBytes(m.text)>MAX_QUESTION_BYTES||
          m.dispatchAllowed!==false||m.creditDeducted!==false||typeof m.messageId!=='string')throw Error('Invalid message');
        all.push({...m,answer:chartMode?null:projectVerifiedEducation(m),marketRun:chartMode?projectMarketRun(m):null});
      }
      if(page.nextAfterSequence===null){setMessages(all);setActive(conversationId);return;}
      if(page.nextAfterSequence!==all.length||page.nextAfterSequence<=cursor)throw Error('Invalid cursor');
      cursor=page.nextAfterSequence;
    }
    throw Error('History exceeds limit');
  };
  useEffect(()=>{
    const controller=new AbortController();lifecycle.current=controller;
    setBusy(true);setError(false);setActive(null);setMessages([]);setList([]);setSelection(null);setOptions([]);setDraft('');pending.current=null;setPendingLocked(false);setProviderEnabled(false);setWorkspaceEnabled(false);setMarketProviderEnabled(false);setReport(null);setGenerationUnconfirmed(false);
    (async()=>{
      const v=await client.request('capabilities',{},controller.signal);
      if(v.sendEnabled!==false||!Array.isArray(v.rehearsalOptions)||v.rehearsalOptions.length>16)throw Error('Invalid capability');
      const allowed=v.rehearsalOptions.filter(o=>o.status==='SYNTHETIC_TEST_ONLY'&&o.runtimeEnabled===false&&o.profile==='EDUCATION'&&o.fundingMode==='BYO_API');
      setWorkspaceEnabled(v.workspaceAnalysisEnabled===true);setProviderEnabled(v.fixtureProviderEnabled===true);setMarketProviderEnabled(v.marketProviderEnabled===true&&v.workspaceAnalysisEnabled===true&&v.fixtureProviderEnabled===true);setOptions(allowed);setSelection(allowed[0]||null);if(chartMode&&v.workspaceAnalysisEnabled!==true)throw Error('Chart analysis disabled');await load(controller.signal);
    })().catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>{controller.abort();lock.current=false;};
  },[client]); // client is stable and scope-bound in the test host
  async function run(fn){
    const signal=lifecycle.current?.signal;
    if(!signal||signal.aborted||lock.current)return;
    lock.current=true;setBusy(true);setError(false);
    try{await fn(signal);}catch{if(!signal.aborted){setError(true);setMessages([]);setReport(null);}}
    finally{if(!signal.aborted){lock.current=false;setBusy(false);}}
  }
  async function analyze(conversationId,messageId,signal){
    if(!chartMode||!workspaceEnabled)throw Error('Chart consent required');
    setReport(null);
    const envelope=await client.request('analyze',{conversationId,messageId},signal);
    const expected={...workspace,conversationId,messageId};
    if(!projectWorkspaceReport(envelope,expected))throw Error('Invalid or expired workspace report');
    setReport({envelope,expected,messageId});
  }
  function send(){
    if(!selection||(chartMode&&!workspaceEnabled)||!draft.trim()||questionBytes(draft)>MAX_QUESTION_BYTES)return;
    // Preserve immutable IDs on ambiguous network failures; no automatic retry.
    const attempt=pending.current||{conversationId:active||crypto.randomUUID(),messageId:crypto.randomUUID(),text:draft,create:!active};
    if(attempt.text!==draft)return;
    pending.current=attempt;setPendingLocked(true);
    run(async signal=>{
      const {providerId,modelId,descriptorId,fundingMode}=selection;
      const s={providerId,modelId,descriptorId,fundingMode};
      if(attempt.create){
        const config={selection:s,profile:chartMode?'STRUCTURE':'EDUCATION',...(chartMode?{workspace}:{})};
        await client.request('preflight',config,signal);
        await client.request('create',{conversationId:attempt.conversationId,...config},signal);
      }
      await client.request('append',{conversationId:attempt.conversationId,messageId:attempt.messageId,text:attempt.text},signal);
      pending.current=null;setPendingLocked(false);setDraft('');setActive(attempt.conversationId);
      let providerReport=null;
      if((providerEnabled&&!chartMode)||(chartMode&&marketProviderEnabled)){
        // A lost generation acknowledgement must not cause a second generation call.
        setGenerationUnconfirmed(true);
        const result=await client.request('generate',{conversationId:attempt.conversationId,messageId:attempt.messageId},signal);
        if(chartMode){
          const expected={...workspace,conversationId:attempt.conversationId,messageId:attempt.messageId};
          const envelope=projectMarketGeneration(result,expected);
          if(envelope)providerReport={envelope,expected,messageId:attempt.messageId};
        }else projectVerifiedEducation(result);
      }
      await history(attempt.conversationId,signal);await load(signal);setGenerationUnconfirmed(false);
      if(chartMode&&!marketProviderEnabled)await analyze(attempt.conversationId,attempt.messageId,signal);
      else if(providerReport&&projectWorkspaceReport(providerReport.envelope,providerReport.expected))setReport(providerReport);
    });
  }
  return <>
    <div className="aic-context"><div><span>Isolated authenticated chat</span><strong>{chartMode?workspace.symbol+' · '+workspace.timeframe:providerEnabled?'Local provider fixture':'Offline storage only'}</strong></div>
      {(workspaceEnabled||chartMode)&&chart?.symbol&&chart?.timeframe&&<label><input type="checkbox" checked={chartMode} onChange={e=>onConsentChange(e.target.checked)}/> Include chart context</label>}
    </div>
    <div className="aic-body">
      <div className="aic-suggestions">
        {list.map(c=><button type="button" key={c.conversationId} disabled={busy||pendingLocked} onClick={()=>run(async s=>{await history(c.conversationId,s);setGenerationUnconfirmed(false);})}>Conversation {c.conversationId.slice(0,8)} · {c.messageCount} messages</button>)}
      </div>
      {active&&<button type="button" disabled={busy||pendingLocked} onClick={()=>run(async s=>{await client.request('delete',{conversationId:active},s);setActive(null);setMessages([]);setReport(null);setGenerationUnconfirmed(false);await load(s);})}>Delete conversation</button>}
      {messages.map(m=><div key={m.messageId} data-isolated-message><p>{m.text}</p><small>{m.status==='CANCELLED'?'Cancelled':'Stored offline'}</small><EducationAnswer answer={m.answer}/>{m.marketRun&&<small data-market-provider-state={m.marketRun.state}>{m.marketRun.state==='VERIFIED'?'Verified provider selection · historical evidence not retained':stateText[m.marketRun.state]}</small>}{chartMode&&report?.messageId===m.messageId&&m.status==='STORED_OFFLINE'&&<VerifiedWorkspaceReport envelope={report.envelope} expected={report.expected} isolated/>}{chartMode&&m.status==='STORED_OFFLINE'&&<button type="button" disabled={busy||pendingLocked||!workspaceEnabled} onClick={()=>run(s=>analyze(active,m.messageId,s))}>Refresh historical report</button>}{m.status==='STORED_OFFLINE'&&<button type="button" disabled={busy||pendingLocked} onClick={()=>run(async s=>{await client.request('cancel',{conversationId:active,messageId:m.messageId},s);await history(active,s);})}>Cancel message</button>}</div>)}
      {error&&<p role="alert">{generationUnconfirmed?'Generation not confirmed. Check saved history; no automatic retry.':'Request not confirmed. No automatic retry. Refresh saved history or reopen the test panel.'}</p>}
      {active&&error&&<button type="button" disabled={busy||pendingLocked} onClick={()=>run(async s=>{await history(active,s);await load(s);setGenerationUnconfirmed(false);})}>Check saved history</button>}
    </div>
    <div className="aic-footer">
      <div className="aic-settings"><span className="aic-model">{options.length?selection?.modelId:'No isolated model available'}</span></div>
      <div className="aic-composer"><textarea aria-label="Message ACG AI" value={draft} disabled={busy||pendingLocked} onChange={e=>{if(questionBytes(e.target.value)<=MAX_QUESTION_BYTES)setDraft(e.target.value);}} rows={3}/>
      <div className="aic-composer-bottom"><span>Offline test</span><button type="button" disabled={busy||!selection||!draft.trim()||(chartMode&&!workspaceEnabled)} aria-label={chartMode?(marketProviderEnabled?'Ask AI about chart':'Analyze chart'):providerEnabled?'Send to isolated provider':'Store offline message'} onClick={send}><ArrowUp size={17}/></button></div></div>
      <p role="status" className="aic-disclaimer">{chartMode?(marketProviderEnabled?'Isolated AI reference selection. Historical evidence only; no public inference, credits or trade requests.':'Read-only historical analysis. Explicit chart consent; no public inference, credits or trade requests.'):providerEnabled?'Isolated provider fixture only. No public inference, credits or trade requests.':'Isolated test only. No AI provider, credit or trade requests.'}</p>
    </div>
  </>;
}
