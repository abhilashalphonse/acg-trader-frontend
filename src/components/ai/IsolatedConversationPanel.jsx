import React,{useEffect,useRef,useState} from 'react';
import {ArrowUp} from 'lucide-react';
import {questionBytes,MAX_QUESTION_BYTES} from './aiPreview.js';
import {projectVerifiedEducation} from './verifiedEducation.js';
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
export default function IsolatedConversationPanel({client}){
  const [options,setOptions]=useState([]),[selection,setSelection]=useState(null);
  const [list,setList]=useState([]),[active,setActive]=useState(null),[messages,setMessages]=useState([]);
  const [draft,setDraft]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState(false);
  const lifecycle=useRef(null),lock=useRef(false),pending=useRef(null);
  const [pendingLocked,setPendingLocked]=useState(false);
  const [providerEnabled,setProviderEnabled]=useState(false);
  const [generationUnconfirmed,setGenerationUnconfirmed]=useState(false);
  const load=async(signal)=>{
    const v=await client.request('list',{},signal);
    if(!Array.isArray(v.conversations)||v.conversations.length>8)throw Error('Invalid history');
    setList(v.conversations.filter(c=>c.status==='ACTIVE'&&c.profile==='EDUCATION'&&typeof c.conversationId==='string'));
  };
  const history=async(conversationId,signal)=>{
    const all=[];let cursor=0;
    for(let i=0;i<2;i++){
      const page=await client.request('history',{conversationId,afterSequence:cursor,limit:8},signal);
      if(!Array.isArray(page.messages)||page.messages.length>8)throw Error('Invalid history');
      for(const m of page.messages){
        if(m.role!=='USER'||m.conversationId!==conversationId||m.sequence!==all.length+1||
          !['STORED_OFFLINE','CANCELLED'].includes(m.status)||typeof m.text!=='string'||questionBytes(m.text)>MAX_QUESTION_BYTES||
          m.dispatchAllowed!==false||m.creditDeducted!==false||typeof m.messageId!=='string')throw Error('Invalid message');
        all.push({...m,answer:projectVerifiedEducation(m)});
      }
      if(page.nextAfterSequence===null){setMessages(all);setActive(conversationId);return;}
      if(page.nextAfterSequence!==all.length||page.nextAfterSequence<=cursor)throw Error('Invalid cursor');
      cursor=page.nextAfterSequence;
    }
    throw Error('History exceeds limit');
  };
  useEffect(()=>{
    const controller=new AbortController();lifecycle.current=controller;
    setBusy(true);setError(false);setActive(null);setMessages([]);setList([]);setSelection(null);setOptions([]);setDraft('');pending.current=null;setPendingLocked(false);setProviderEnabled(false);setGenerationUnconfirmed(false);
    (async()=>{
      const v=await client.request('capabilities',{},controller.signal);
      if(v.sendEnabled!==false||!Array.isArray(v.rehearsalOptions)||v.rehearsalOptions.length>16)throw Error('Invalid capability');
      const allowed=v.rehearsalOptions.filter(o=>o.status==='SYNTHETIC_TEST_ONLY'&&o.runtimeEnabled===false&&o.profile==='EDUCATION'&&o.fundingMode==='BYO_API');
      setProviderEnabled(v.fixtureProviderEnabled===true);setOptions(allowed);setSelection(allowed[0]||null);await load(controller.signal);
    })().catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>{controller.abort();lock.current=false;};
  },[client]); // client is stable and scope-bound in the test host
  async function run(fn){
    const signal=lifecycle.current?.signal;
    if(!signal||signal.aborted||lock.current)return;
    lock.current=true;setBusy(true);setError(false);
    try{await fn(signal);}catch{if(!signal.aborted){setError(true);setMessages([]);}}
    finally{if(!signal.aborted){lock.current=false;setBusy(false);}}
  }
  function send(){
    if(!selection||!draft.trim()||questionBytes(draft)>MAX_QUESTION_BYTES)return;
    // Preserve immutable IDs on ambiguous network failures; no automatic retry.
    const attempt=pending.current||{conversationId:active||crypto.randomUUID(),messageId:crypto.randomUUID(),text:draft,create:!active};
    if(attempt.text!==draft)return;
    pending.current=attempt;setPendingLocked(true);
    run(async signal=>{
      const {providerId,modelId,descriptorId,fundingMode}=selection;
      const s={providerId,modelId,descriptorId,fundingMode};
      if(attempt.create){
        await client.request('preflight',{selection:s,profile:'EDUCATION'},signal);
        await client.request('create',{conversationId:attempt.conversationId,selection:s,profile:'EDUCATION'},signal);
      }
      await client.request('append',{conversationId:attempt.conversationId,messageId:attempt.messageId,text:attempt.text},signal);
      pending.current=null;setPendingLocked(false);setDraft('');setActive(attempt.conversationId);
      if(providerEnabled){
        // A lost generation acknowledgement must not cause a second generation call.
        setGenerationUnconfirmed(true);
        const result=await client.request('generate',{conversationId:attempt.conversationId,messageId:attempt.messageId},signal);
        projectVerifiedEducation(result);
      }
      await history(attempt.conversationId,signal);await load(signal);setGenerationUnconfirmed(false);
    });
  }
  return <>
    <div className="aic-context"><div><span>Isolated authenticated chat</span><strong>{providerEnabled?'Local provider fixture':'Offline storage only'}</strong></div></div>
    <div className="aic-body">
      <div className="aic-suggestions">
        {list.map(c=><button type="button" key={c.conversationId} disabled={busy||pendingLocked} onClick={()=>run(async s=>{await history(c.conversationId,s);setGenerationUnconfirmed(false);})}>Conversation {c.conversationId.slice(0,8)} · {c.messageCount} messages</button>)}
      </div>
      {active&&<button type="button" disabled={busy||pendingLocked} onClick={()=>run(async s=>{await client.request('delete',{conversationId:active},s);setActive(null);setMessages([]);setGenerationUnconfirmed(false);await load(s);})}>Delete conversation</button>}
      {messages.map(m=><div key={m.messageId} data-isolated-message><p>{m.text}</p><small>{m.status==='CANCELLED'?'Cancelled':'Stored offline'}</small><EducationAnswer answer={m.answer}/>{m.status==='STORED_OFFLINE'&&<button type="button" disabled={busy||pendingLocked} onClick={()=>run(async s=>{await client.request('cancel',{conversationId:active,messageId:m.messageId},s);await history(active,s);})}>Cancel message</button>}</div>)}
      {error&&<p role="alert">{generationUnconfirmed?'Generation not confirmed. Check saved history; no automatic retry.':'Request not confirmed. No automatic retry. Refresh saved history or reopen the test panel.'}</p>}
      {active&&error&&<button type="button" disabled={busy||pendingLocked} onClick={()=>run(async s=>{await history(active,s);await load(s);setGenerationUnconfirmed(false);})}>Check saved history</button>}
    </div>
    <div className="aic-footer">
      <div className="aic-settings"><span className="aic-model">{options.length?selection?.modelId:'No isolated model available'}</span></div>
      <div className="aic-composer"><textarea aria-label="Message ACG AI" value={draft} disabled={busy||pendingLocked} onChange={e=>{if(questionBytes(e.target.value)<=MAX_QUESTION_BYTES)setDraft(e.target.value);}} rows={3}/>
      <div className="aic-composer-bottom"><span>Offline test</span><button type="button" disabled={busy||!selection||!draft.trim()} aria-label={providerEnabled?'Send to isolated provider':'Store offline message'} onClick={send}><ArrowUp size={17}/></button></div></div>
      <p role="status" className="aic-disclaimer">{providerEnabled?'Isolated provider fixture only. No public inference, credits or trade requests.':'Isolated test only. No AI provider, credit or trade requests.'}</p>
    </div>
  </>;
}
