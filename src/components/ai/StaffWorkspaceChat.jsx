import React,{useEffect,useRef,useState} from 'react';
import {ArrowUp,Sparkles,Copy,Check,LoaderCircle,ChartNoAxesCombined,Crosshair,Layers,ShieldCheck,ArrowUpRight,ThumbsUp,ThumbsDown,RefreshCw,MessageCircle,AlignLeft} from 'lucide-react';
import {apiRequest} from '../../api/client.js';
import {chartContextLabel} from './aiPreview.js';
import AssistantMarkdown from './AssistantMarkdown.jsx';
import InstrumentAvatar from '../trading-v2/InstrumentAvatar.jsx';
import {chartFeedStatus,followUpSuggestions,regenerationQuestion} from './workspacePresentation.js';
const bytes=s=>new TextEncoder().encode(s).length;
const allowedFrames=['1m','5m','15m','30m','1h','4h','1d','1w'];
const secretPattern=/(?:sk-[A-Za-z0-9_-]{16,}|(?:api[_ -]?key|password|secret|authorization|bearer)\s*[:=]\s*\S+|-----BEGIN [A-Z ]+PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|mongodb(?:\+srv)?:\/\/)/i;
const validQuestion=q=>typeof q==='string'&&q.trim().length>0&&bytes(q)<=4096&&!secretPattern.test(q);
const instrumentNames={XAUUSD:'gold',XAGUSD:'silver',USOIL:'WTI oil',UKOIL:'Brent oil',NATGAS:'natural gas',BTCUSD:'Bitcoin',ETHUSD:'Ethereum'};
const suggestionIcons=[ChartNoAxesCombined,Crosshair,Layers,ShieldCheck];
function workspaceSuggestions(symbol){
  const name=Object.hasOwn(instrumentNames,symbol)?instrumentNames[symbol]:symbol;
  return [name?"What's happening with "+name+"?":"What's happening in the markets?","Are there any trading setups?","Analyse the market structure","How much risk am I taking?"];
}
export function boundedWorkspaceHistory(messages,question){
  const result=[];
  let remaining=6000-bytes(question);
  for(let i=messages.length-1;i>=0&&result.length<6;i--){
    const m=messages[i];
    if(!['user','assistant'].includes(m.role)||!validQuestion(m.text))break;
    const size=bytes(JSON.stringify({role:m.role,text:m.text}));
    if(size>remaining)break;
    result.unshift({role:m.role,text:m.text});remaining-=size;
  }
  return result;
}
export function projectWorkspaceAnswer(result,expected){
  if(result?.contractVersion!=='restricted-pilot-v1'||result.mode!=='WORKSPACE_CHAT'||
    result.executionAllowed!==false||result.operationId!==expected.operationId||
    result.workspace?.symbol!==expected.symbol||result.workspace?.timeframe!==expected.timeframe||
    result.state!=='ANSWERED'||typeof result.answer!=='string'||!result.answer.trim()||bytes(result.answer)>12000||
    result.context?.account!==expected.includeAccount||result.context?.market!==expected.includeMarket||
    !Number.isSafeInteger(result.usage?.inputTokens)||result.usage.inputTokens<0||result.usage.inputTokens>32768||
    !Number.isSafeInteger(result.usage?.outputTokens)||result.usage.outputTokens<0||result.usage.outputTokens>2048)return null;
  return {text:result.answer,context:result.context,tokens:result.usage.inputTokens+result.usage.outputTokens};
}
export default function StaffWorkspaceChat({runtime,symbol,timeframe,market}){
  const chart=chartContextLabel(symbol,timeframe);
  const suggestions=workspaceSuggestions(chart.symbol);
  const instrument=market?.symbol===chart.symbol?market:null;
  const feedStatus=chartFeedStatus(instrument,chart.symbol);
  const [connectionId]=useState(()=>crypto.randomUUID());
  const [consent,setConsent]=useState(null);
  const [includeMarket,setMarket]=useState(true);
  const [includeAccount,setAccount]=useState(true);
  const [messages,setMessages]=useState([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [copyState,setCopyState]=useState(null);
  const [feedback,setFeedback]=useState({});
  const latestAnswer=useRef(null);
  const active=useRef(null),inFlight=useRef(false),historyStart=useRef(0),bottom=useRef(null),input=useRef(null);
  const valid=Boolean(runtime?.token&&runtime.accountId&&chart.symbol&&allowedFrames.includes(chart.timeframe));
  const call=(op,extra,signal)=>apiRequest('/v1/ai/pilot/'+op,{method:'POST',token:runtime.token,
    body:{accountId:runtime.accountId,connectionId,symbol:chart.symbol,timeframe:chart.timeframe,...extra},signal,timeoutMs:40000});
  useEffect(()=>{
    if(!valid)return;
    const controller=new AbortController();active.current=controller;setConsent(null);setNotice('');
    call('status',{},controller.signal).then(v=>{
      if(!controller.signal.aborted&&v?.contractVersion==='restricted-pilot-v1'&&v.mode==='WORKSPACE_CHAT'&&
        v.executionAllowed===false&&v.model==='gpt-6-luna'&&Number.isSafeInteger(v.revision)&&v.revision>=0)setConsent(v);
      else if(!controller.signal.aborted)setNotice('AI workspace access is unavailable.');
    }).catch(()=>{if(!controller.signal.aborted)setNotice('AI workspace access is unavailable.');});
    return ()=>{controller.abort();active.current=null;};
  },[runtime?.token,runtime?.accountId,runtime?.sessionId,chart.symbol,chart.timeframe,connectionId,valid]);
  useEffect(()=>{
    const latest=messages.at(-1);
    if(!busy&&latest?.role==='assistant')latestAnswer.current?.scrollIntoView({block:'start',behavior:'auto'});
    else bottom.current?.scrollIntoView({block:'end',behavior:'auto'});
  },[messages,busy]);
  async function copyAnswer(message){
    try{await navigator.clipboard.writeText(message.text);setCopyState({id:message.id,ok:true});}
    catch{setCopyState({id:message.id,ok:false});}
  }
  function changeContext(setter,value){
    historyStart.current=messages.length;setter(value);
    setNotice('Context updated. Earlier messages will not be included in the next AI request.');
  }
  async function send(regenerateId=null){
    const retryQuestion=regenerateId?regenerationQuestion(messages,historyStart.current,regenerateId):null;
    if(regenerateId&&!retryQuestion)return;
    const controller=active.current,question=(retryQuestion||draft).trim();
    if(!valid||!consent||!controller||controller.signal.aborted||inFlight.current||!validQuestion(question))return;
    inFlight.current=true;setBusy(true);setNotice('');if(!regenerateId)setDraft('');setCopyState(null);
    const prior=regenerateId?messages.slice(0,-2):messages;
    const history=boundedWorkspaceHistory(prior.slice(historyStart.current),question);
    if(!regenerateId)setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text:question}]);
    try{
      const grant=await call('grant',{expectedRevision:consent.revision,explicitConsent:true},controller.signal);
      if(controller.signal.aborted)return;
      if(grant?.contractVersion!=='restricted-pilot-v1'||grant.mode!=='WORKSPACE_CHAT'||grant.executionAllowed!==false||grant.revision!==consent.revision+1)throw Error('Invalid grant');
      setConsent({...consent,revision:grant.revision,active:true});
      const operationId=crypto.randomUUID();
      const result=await call('generate',{operationId,intent:'WORKSPACE_CHAT',question,history,includeMarket,includeAccount},controller.signal);
      if(controller.signal.aborted)return;
      const answer=projectWorkspaceAnswer(result,{operationId,...chart,includeMarket,includeAccount});
      if(!answer){setNotice(result?.state==='HELD_UNKNOWN'?'Request outcome uncertain. No automatic retry.':'No AI answer returned.');return;}
      setMessages(m=>[...(regenerateId?m.slice(0,-1):m),{id:crypto.randomUUID(),role:'assistant',...answer}]);
    }catch{if(!controller.signal.aborted)setNotice('AI request unavailable. No automatic retry.');}
    finally{inFlight.current=false;if(!controller.signal.aborted)setBusy(false);}
  }
  return <>
    <div className="aic-context aic-workspace-context">
      <div className="aic-workspace-instrument"><div className="aic-instrument-identity">{instrument&&<InstrumentAvatar instrument={instrument} size={30}/>}<div className="aic-instrument-title"><strong>{chart.symbol||'No chart'}{feedStatus!=='UNKNOWN'&&<span className={'aic-feed-dot aic-feed-'+feedStatus.toLowerCase()} title={'Terminal feed: '+feedStatus.toLowerCase()} aria-label={'Terminal feed: '+feedStatus.toLowerCase()}/>}</strong><span>{Object.hasOwn(instrumentNames,chart.symbol)?instrumentNames[chart.symbol]+' · ':instrument?.name?instrument.name+' · ':''}{chart.timeframe||'—'}</span></div></div><span className="aic-model aic-model-pill" title="Current supported model">GPT-6 Luna</span></div>
    </div>
    <div className={'aic-body aic-workspace-body'+(!messages.length?' aic-welcome-body':'')} aria-live="polite">
      {!messages.length&&<div className="aic-welcome">
        <Sparkles className="aic-welcome-icon" size={32} strokeWidth={1.45} aria-hidden="true"/>
        <h3>What's on your mind?</h3>
        <p>Explore the markets, find trading opportunities or understand your risk.</p>
        <div className="aic-welcome-suggestions">{suggestions.map((q,i)=>{const Icon=suggestionIcons[i];return <button key={q} type="button" onClick={()=>{setDraft(q);input.current?.focus();}}><Icon size={16} strokeWidth={1.6} aria-hidden="true"/><span>{q}</span><ArrowUpRight className="aic-suggestion-arrow" size={13} aria-hidden="true"/></button>;})}</div>
      </div>}
      {messages.map((m,i)=><article key={m.id} ref={i===messages.length-1&&m.role==='assistant'?latestAnswer:null} className={'aic-workspace-message '+(m.role==='user'?'aic-user-message':'aic-assistant-message')}>
        {m.role==='assistant'&&<div className="aic-answer-heading"><span className="aic-answer-avatar"><Sparkles size={14}/></span><strong>ACG AI</strong><span className="aic-answer-instrument">GPT-6 Luna</span></div>}
        {m.role==='assistant'?<AssistantMarkdown text={m.text}/>:<div className="aic-message-text">{m.text}</div>}
        {m.role==='assistant'&&<>
          <div className="aic-answer-footer"><div className="aic-response-actions">
            <button type="button" className="aic-copy" aria-label="Copy response" title="Copy response" onClick={()=>void copyAnswer(m)}>{copyState?.id===m.id&&copyState.ok?<Check size={15}/>:<Copy size={15}/>}</button>
            <button type="button" className="aic-copy" aria-label="Helpful response" title="Mark helpful (this chat only)" aria-pressed={feedback[m.id]==='up'} onClick={()=>setFeedback(v=>({...v,[m.id]:v[m.id]==='up'?null:'up'}))}><ThumbsUp size={15}/></button>
            <button type="button" className="aic-copy" aria-label="Unhelpful response" title="Mark unhelpful (this chat only)" aria-pressed={feedback[m.id]==='down'} onClick={()=>setFeedback(v=>({...v,[m.id]:v[m.id]==='down'?null:'down'}))}><ThumbsDown size={15}/></button>
            {i===messages.length-1&&regenerationQuestion(messages,historyStart.current,m.id)&&<><span className="aic-action-divider"/><button type="button" className="aic-copy" aria-label="Regenerate response" title="Regenerate using current context (new AI request)" disabled={busy||!consent} onClick={()=>void send(m.id)}><RefreshCw size={15}/></button></>}
          </div>{copyState?.id===m.id&&<span role="status" className="aic-copy-status">{copyState.ok?'Copied':'Copy failed'}</span>}</div>
          {i===messages.length-1&&!busy&&i-1>=historyStart.current&&validQuestion(m.text)&&<div className="aic-followups">{followUpSuggestions(m.text).map((s,j)=><button key={s.label} type="button" onClick={()=>{setDraft(s.prompt);input.current?.focus();}}>{j===0&&s.label!=='Summarise'?<MessageCircle size={13}/>:<AlignLeft size={13}/>}<span>{s.label}</span></button>)}</div>}
          <p className="aic-answer-context">{m.context?.market?'Chart context':'No chart context'} · {m.context?.account?'Account context':'No account context'}</p>
        </>}
      </article>)}
      {busy&&<div className="aic-answer-heading aic-analysis-loading"><LoaderCircle size={14}/> Thinking…</div>}
      {notice&&<p role="status" className="aic-disclaimer">{notice}</p>}
      <div ref={bottom}/>
    </div>
    <div className="aic-footer aic-workspace-footer">
      <div className="aic-composer aic-workspace-composer">
        <textarea ref={input} value={draft} aria-label="Message ACG AI" placeholder="Ask ACG AI…" rows={2}
          onChange={e=>{if(bytes(e.target.value)<=4096)setDraft(e.target.value);}}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent?.isComposing){e.preventDefault();void send();}}}/>
        <div className="aic-composer-bottom">
          <div className="aic-context-chips" role="group" aria-label="Context shared with AI">
            <button type="button" className="aic-context-chip" aria-pressed={includeMarket} aria-label="Chart context" disabled={busy} onClick={()=>changeContext(setMarket,!includeMarket)}><span className="aic-chip-check">{includeMarket&&<Check size={12}/>}</span>Chart</button>
            <button type="button" className="aic-context-chip" aria-pressed={includeAccount} aria-label="Account context" disabled={busy} onClick={()=>changeContext(setAccount,!includeAccount)}><span className="aic-chip-check">{includeAccount&&<Check size={12}/>}</span>Account</button>
          </div>
          <button className="aic-workspace-send" type="button" aria-label="Send message" disabled={busy||!consent||!validQuestion(draft)} onClick={()=>void send()}>{busy?<LoaderCircle size={17} className="aic-send-spinner"/>:<ArrowUp size={17}/>}</button>
        </div>
      </div>
      <p className="aic-disclaimer">Selected context and messages are shared with OpenAI. AI can make mistakes. No trade execution.</p>
    </div>
  </>;
}
