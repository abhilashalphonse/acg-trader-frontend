import React,{useEffect,useRef,useState} from 'react';
import {ArrowUp,Square,Sparkles,Copy,Check,LoaderCircle,ChartNoAxesCombined,Crosshair,Layers,ShieldCheck,ArrowUpRight,ThumbsUp,ThumbsDown,RefreshCw,MessageCircle,AlignLeft} from 'lucide-react';
import {apiRequest} from '../../api/client.js';
import {chartContextLabel} from './aiPreview.js';
import AssistantMarkdown from './AssistantMarkdown.jsx';
import {chartDrawingCommand} from './chartDrawingCommand.js';
import {drawingInspectionCommand} from './chartDrawingInventory.js';
import {drawingEditCommand} from './chartDrawingEdit.js';
import {drawingDeleteCommand} from './chartDrawingDelete.js';
import InstrumentAvatar from '../trading-v2/InstrumentAvatar.jsx';
import {chartFeedStatus,followUpSuggestions,regenerationQuestion,workspaceFailureNotice} from './workspacePresentation.js';
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
    (Object.hasOwn(result.context,'accountUsed')&&(typeof result.context.accountUsed!=='boolean'||(result.context.accountUsed&&!result.context.account)))||
    !Number.isSafeInteger(result.usage?.inputTokens)||result.usage.inputTokens<0||result.usage.inputTokens>32768||
    !Number.isSafeInteger(result.usage?.outputTokens)||result.usage.outputTokens<0||result.usage.outputTokens>2048)return null;
  return {text:result.answer,context:result.context,tokens:result.usage.inputTokens+result.usage.outputTokens};
}
export default function StaffWorkspaceChat({runtime,symbol,timeframe,market,agentDrawingPort=null}){
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
  const [progress,setProgress]=useState(null);
  const [preview,setPreview]=useState('');
  const [notice,setNotice]=useState('');
  const [copyState,setCopyState]=useState(null);
  const [feedback,setFeedback]=useState({});
  const [pendingDelete,setPendingDelete]=useState(null);
  const latestAnswer=useRef(null);
  const active=useRef(null),operation=useRef(null),inFlight=useRef(false),historyStart=useRef(0),bottom=useRef(null),input=useRef(null);
  const valid=Boolean(runtime?.token&&runtime.accountId&&chart.symbol&&allowedFrames.includes(chart.timeframe));
  const call=(op,extra,signal,workspaceProgress=null,workspaceDelta=null)=>apiRequest('/v1/ai/pilot/'+op,{method:'POST',token:runtime.token,
    body:{accountId:runtime.accountId,connectionId,symbol:chart.symbol,timeframe:chart.timeframe,...extra},signal,timeoutMs:40000,workspaceProgress,workspaceDelta});
  useEffect(()=>{
    if(!valid)return;
    const controller=new AbortController();active.current=controller;setPendingDelete(null);setConsent(null);setNotice('');setPreview('');setBusy(false);setProgress(null);
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
  },[messages,busy,preview]);
  useEffect(()=>{
    if(!pendingDelete)return;
    const timeout=setTimeout(()=>{
      pendingDelete.port.cancelDeletion();setPendingDelete(null);
      setNotice('Deletion confirmation expired. No drawing was removed.');
    },Math.max(0,pendingDelete.preview.expiresAtMs-Date.now()));
    return ()=>{clearTimeout(timeout);pendingDelete.port.cancelDeletion();};
  },[pendingDelete]);
  function cancelDelete(){
    pendingDelete?.port.cancelDeletion();setPendingDelete(null);setNotice('Deletion cancelled. No drawing was removed.');
  }
  async function confirmDelete(){
    const pending=pendingDelete,parent=active.current;
    if(!pending||inFlight.current||!parent||parent.signal.aborted||!valid||!includeMarket||consent?.chartDrawingEnabled!==true)return;
    if(agentDrawingPort?.get()!==pending.port||pending.parent!==parent||Date.now()>=pending.preview.expiresAtMs){
      pending.port.cancelDeletion();setPendingDelete(null);setNotice('Deletion confirmation is no longer valid. No drawing was removed.');return;
    }
    const controller=new AbortController();
    const request=pending.port.prepare({onInterrupt:()=>controller.abort()});
    if(!request){pending.port.cancelDeletion();setPendingDelete(null);setNotice('The chart changed. Request deletion again.');return;}
    const abort=()=>controller.abort();
    parent.signal.addEventListener('abort',abort,{once:true});
    operation.current=controller;inFlight.current=true;setBusy(true);setProgress('DRAWING');setNotice('');setPendingDelete(null);
    try{
      const outcome=await pending.port.confirmDeletion({preview:pending.preview,request,signal:controller.signal});
      if(parent.signal.aborted)return;
      const text=outcome.state==='DELETED'?'Deleted the confirmed AI drawing. You can undo this deletion.':
        outcome.state==='FAILED_UNCERTAIN'||outcome.state==='RECOVERY_REQUIRED'?'Deletion could not be verified. AI drawing actions are paused for this symbol until you reload. Inspect the chart first.':
        'Deletion stopped or the confirmation is no longer valid. No automatic retry.';
      setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text,action:true,context:{market:true,account:false}}]);
    }catch{if(!parent.signal.aborted)setNotice('Deletion result unavailable. Inspect the chart before retrying.');}
    finally{
      pending.port.release(request.actionId);parent.signal.removeEventListener('abort',abort);
      if(operation.current===controller){operation.current=null;inFlight.current=false;}
      if(!parent.signal.aborted){setBusy(false);setProgress(null);}
    }
  }
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
    const parent=active.current,question=(retryQuestion||draft).trim();
    if(!valid||!consent||!parent||parent.signal.aborted||inFlight.current||pendingDelete||!validQuestion(question))return;
    if(regenerateId&&drawingDeleteCommand(question))return;
    if(!regenerateId&&drawingDeleteCommand(question)){
      const port=includeMarket&&consent.chartDrawingEnabled===true?agentDrawingPort?.get():null;
      const outcome=port?.previewDeletion(question);
      if(outcome?.state==='CONFIRM_REQUIRED'){
        setPendingDelete({port,preview:outcome,parent});setNotice('');setDraft('');
        setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text:question}]);
      }else setNotice(outcome?.state==='AMBIGUOUS_TARGET'?'More than one drawing matches. Select the intended drawing first.':outcome?.state==='PROTECTED_TARGET'?'That drawing is protected and cannot be deleted by AI.':outcome?.state==='RECOVERY_REQUIRED'?'AI drawing actions are paused for this symbol until you reload.':'No eligible drawing found in the active chart. No drawing was removed.');
      return;
    }
    const inspectionCommand=!regenerateId&&consent.chartDrawingEnabled===true&&agentDrawingPort?drawingInspectionCommand(question):null;
    if(inspectionCommand){
      const view=includeMarket?agentDrawingPort.get()?.inspectDrawings():null;
      if(!view||view.symbol!==chart.symbol){setNotice('Open the active chart with chart context enabled to inspect drawings.');return;}
      const description={VERIFIED_AI:'AI-created and unchanged',PROTECTED_AI:'protected AI-created',MANUAL:'manual'};
      const text=inspectionCommand==='SELECTED'?view.selected?view.selected.label+' — '+description[view.selected.ownership]+(view.selected.locked?' · locked':'')+'.':'No visible drawing is selected on this chart.':
        'There are '+view.total+' visible drawings on your '+chart.symbol+' '+chart.timeframe+' chart.\n\n- AI-created and unchanged: '+view.counts.VERIFIED_AI+'\n- Protected AI-created: '+view.counts.PROTECTED_AI+'\n- Manual: '+view.counts.MANUAL+(view.selected?'\n\nSelected: '+view.selected.label+' ('+description[view.selected.ownership]+').':'');
      setDraft('');setNotice('');setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text:question},{id:crypto.randomUUID(),role:'assistant',text,action:true,context:{market:true,account:false}}]);return;
    }
    const drawingCommand=!regenerateId?(chartDrawingCommand(question)||(drawingEditCommand(question)?'EDIT':null)):null;
    if(drawingCommand&&(consent.chartDrawingEnabled!==true||!agentDrawingPort)){setNotice('Chart drawing actions are unavailable in this workspace. No provider request was sent.');return;}
    const drawingPort=drawingCommand?agentDrawingPort.get():null;
    const controller=new AbortController();
    let interruptReason=null;
    const drawingRequest=drawingPort&&includeMarket&&drawingCommand!=='UNDO'?drawingPort.prepare({onInterrupt:reason=>{interruptReason=reason;controller.abort();}}):null;
    if(drawingCommand&&(!drawingPort||!includeMarket||(drawingCommand!=='UNDO'&&(!drawingRequest||drawingRequest.workspace.symbol!==chart.symbol)))){if(drawingRequest)drawingPort.release(drawingRequest.actionId);setNotice('Open the active chart with chart context enabled and the cursor tool selected, then try again.');return;}
    if(regenerateId&&(chartDrawingCommand(question)||drawingInspectionCommand(question)||drawingEditCommand(question)))return;
    operation.current=controller;
    const abort=()=>controller.abort();parent.signal.addEventListener('abort',abort,{once:true});
    inFlight.current=true;setBusy(true);setPreview('');setProgress(null);setNotice('');if(!regenerateId)setDraft('');setCopyState(null);
    const prior=regenerateId?messages.slice(0,-2):messages;
    const history=boundedWorkspaceHistory(prior.slice(historyStart.current),question);
    if(!regenerateId)setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text:question}]);
    try{
      if(drawingCommand==='UNDO'){
        if(controller.signal.aborted||agentDrawingPort.get()!==drawingPort)return;
        const outcome=drawingPort.undoLastBatch();
        const text=outcome.state==='UNDONE'?'Undid the last AI drawing batch ('+outcome.count+' drawings).':outcome.state==='UNDO_CONFLICT'?'The chart was edited after that batch. Use the chart history controls to undo safely.':outcome.state==='NO_AI_BATCH'?'There is no verified AI drawing batch to undo on this chart.':outcome.state==='FAILED_NO_COMMIT'?'Undo was not applied. Your drawings remain unchanged.':outcome.state==='RECOVERY_REQUIRED'||outcome.state==='FAILED_UNCERTAIN'?'Undo could not be verified. AI drawing actions are paused for this symbol until you reload. Inspect your chart first.':'Undo is unavailable.';
        setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text,action:true,context:{market:true,account:false}}]);return;
      }
      if(drawingCommand==='EDIT'){
        if(controller.signal.aborted||agentDrawingPort.get()!==drawingPort)return;
        setProgress('DRAWING');
        const outcome=await drawingPort.edit({request:drawingRequest,question,signal:controller.signal});
        if(controller.signal.aborted)return;
        const messagesByState={
          EDITED:['MOVE','EXTEND','SHORTEN','EXTEND_TO_CLOSE'].includes(drawingEditCommand(question)?.kind)?'Updated the AI drawing as requested. Its original source reference is preserved, but the geometry is now user-adjusted. You can undo the edit.':'Updated the AI drawing appearance or visibility as requested. Its geometry and source reference are unchanged. You can undo the edit.',
          NO_TARGET:'No matching drawing was found in this chart scope. Select the intended visible drawing, or use a specific show command for a hidden drawing.',
          AMBIGUOUS_TARGET:'More than one drawing matches. Select the intended drawing and repeat the command with “selected”.',
          PROTECTED_TARGET:'That drawing is manual, locked, or no longer verified as unchanged AI-owned. It was not edited.',
          OUT_OF_RANGE:'The requested time extension or shortening is outside the available closed-candle range. No change was made.',
          NO_CHANGES:'The drawing already has the requested geometry.',
          OFFSCREEN:'The edit anchors are outside the visible chart. Adjust the view and try again.',
          FAILED_NO_COMMIT:'The drawing edit was not applied. No automatic retry.',
          FAILED_UNCERTAIN:'The edit could not be verified. AI drawing actions are paused for this symbol until you reload. Inspect your chart first.',
          RECOVERY_REQUIRED:'AI drawing actions are paused for this symbol until you reload. Inspect your chart first.'
        };
        const text=messagesByState[outcome.state]||'The chart changed or the edit was stopped. No automatic retry.';
        setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text,action:true,context:{market:true,account:false}}]);return;
      }
      const grant=await call('grant',{expectedRevision:consent.revision,explicitConsent:true},controller.signal);
      if(controller.signal.aborted)return;
      if(grant?.contractVersion!=='restricted-pilot-v1'||grant.mode!=='WORKSPACE_CHAT'||grant.executionAllowed!==false||grant.revision!==consent.revision+1)throw Error('Invalid grant');
      setConsent({...consent,revision:grant.revision,active:true});
      if(drawingCommand){
        if(controller.signal.aborted||agentDrawingPort.get()!==drawingPort)return;
        setProgress('CONTEXT');
        const verified=await drawingPort.plan({request:drawingRequest,command:drawingCommand,signal:controller.signal});
        if(controller.signal.aborted||agentDrawingPort.get()!==drawingPort)return;
        if(!verified){setNotice('Chart context changed. No drawings applied.');return;}
        let text;
        const combined=drawingCommand.includes('_THEN_');
        if(verified.state==='EMPTY')text='No eligible '+(combined?'liquidity levels or fair value gaps':drawingCommand==='FVG'?'fair value gaps':'liquidity levels')+' were found in the visible chart candles.';
        else{
          setProgress('DRAWING');
          const outcome=await drawingPort.execute({request:drawingRequest,receipt:verified.receipt,signal:controller.signal});
          if(outcome.state==='VERIFIED')text='Marked '+outcome.count+' '+(combined?'liquidity/FVG drawing(s)':drawingCommand==='FVG'?'fair value gap zone(s)':'liquidity level(s)')+' on your '+chart.symbol+' '+chart.timeframe+' chart. You can edit or undo them using the chart tools.';
          else if(outcome.state==='NO_CHANGES'||outcome.state==='ALREADY_APPLIED')text='These drawings are already present. Existing drawings and manual edits were preserved.';
          else{if(!controller.signal.aborted)setNotice(outcome.state==='OFFSCREEN'?'The chart moved while drawing. Adjust the view and try again.':outcome.state==='FAILED_UNCERTAIN'||outcome.state==='RECOVERY_REQUIRED'?'Drawing result could not be verified. AI drawing actions are paused for this symbol until you reload. Inspect your chart first.':outcome.state==='FAILED_NO_COMMIT'?'Drawing was not applied. No automatic retry.':'Chart changed or the drawing operation was stopped. No new action was committed.');return;}
        }
        setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text,action:true,context:{market:true,account:false}}]);return;
      }
      const operationId=crypto.randomUUID();
      const result=await call('generate',{operationId,intent:'WORKSPACE_CHAT',question,history,includeMarket,includeAccount},controller.signal,stage=>{if(!controller.signal.aborted)setProgress(stage);},delta=>{if(!controller.signal.aborted)setPreview(v=>v+delta);});
      if(controller.signal.aborted)return;
      const answer=projectWorkspaceAnswer(result,{operationId,...chart,includeMarket,includeAccount});
      if(!answer){setNotice(workspaceFailureNotice(result,{operationId,...chart}));return;}
      setMessages(m=>[...(regenerateId?m.slice(0,-1):m),{id:crypto.randomUUID(),role:'assistant',...answer}]);
    }catch{if(!controller.signal.aborted)setNotice('AI request unavailable. No automatic retry.');}
    finally{
      if(drawingRequest)drawingPort.release(drawingRequest.actionId);
      parent.signal.removeEventListener('abort',abort);
      if(operation.current===controller){operation.current=null;inFlight.current=false;}
      if(!parent.signal.aborted){
        setBusy(false);setProgress(null);setPreview('');
        if(controller.signal.aborted){
          setConsent(null);
          const stopped=interruptReason==='MANUAL_CHART_INTERACTION'?'Drawing stopped: manual chart interaction took priority.':interruptReason==='CHART_CHANGED'?'Drawing stopped: active chart changed.':interruptReason==='PAGE_HIDDEN'||interruptReason==='WINDOW_BLUR'?'Drawing stopped: workspace lost focus.':interruptReason==='ESCAPE'?'Drawing stopped with Escape.':'Response stopped.';
          if(drawingRequest){
            setNotice(stopped+' No automatic retry.');
            // Renew only the consent status, not the interrupted action. A new
            // user request is required. A stale revision fails closed at grant.
            call('status',{},parent.signal).then(v=>{
              if(active.current===parent&&!parent.signal.aborted&&v?.contractVersion==='restricted-pilot-v1'&&v.mode==='WORKSPACE_CHAT'&&v.executionAllowed===false&&v.model==='gpt-6-luna'&&Number.isSafeInteger(v.revision)&&v.revision>=0)setConsent(v);
            }).catch(()=>{});
          }else setNotice(stopped+' Reopen AI to refresh access. No automatic retry.');
        }
      }
    }
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
            {!m.action&&i===messages.length-1&&regenerationQuestion(messages,historyStart.current,m.id)&&<><span className="aic-action-divider"/><button type="button" className="aic-copy" aria-label="Regenerate response" title="Regenerate using current context (new AI request)" disabled={busy||!consent} onClick={()=>void send(m.id)}><RefreshCw size={15}/></button></>}
          </div>{copyState?.id===m.id&&<span role="status" className="aic-copy-status">{copyState.ok?'Copied':'Copy failed'}</span>}</div>
          {!m.action&&i===messages.length-1&&!busy&&i-1>=historyStart.current&&validQuestion(m.text)&&<div className="aic-followups">{followUpSuggestions(m.text).map((s,j)=><button key={s.label} type="button" onClick={()=>{setDraft(s.prompt);input.current?.focus();}}>{j===0&&s.label!=='Summarise'?<MessageCircle size={13}/>:<AlignLeft size={13}/>}<span>{s.label}</span></button>)}</div>}
          <p className="aic-answer-context">{m.context?.market?'Chart context':'No chart context'} · {(m.context?.accountUsed??m.context?.account)?'Account context':'No account context'}</p>
        </>}
      </article>)}
      {busy&&preview&&<article className="aic-workspace-message aic-assistant-message" aria-label="Response in progress"><div className="aic-answer-heading"><span className="aic-answer-avatar"><Sparkles size={14}/></span><strong>ACG AI</strong><span className="aic-answer-instrument">Generating…</span></div><div className="aic-message-text" style={{whiteSpace:'pre-wrap'}}>{preview}</div></article>}
      {busy&&!preview&&<div className="aic-answer-heading aic-analysis-loading"><LoaderCircle size={14}/> {progress==='DRAWING'?'Drawing on chart…':progress==='CONTEXT'?'Reading workspace…':progress==='GENERATING'?'Generating response…':'Thinking…'}</div>}
      {pendingDelete&&<div className="aic-workspace-message aic-assistant-message" role="group" aria-label="Confirm drawing deletion">
        <div className="aic-answer-heading"><strong>Confirm deletion</strong></div>
        <p>Remove one AI {pendingDelete.preview.type==='rectangle'?'FVG rectangle':'liquidity line'} on {pendingDelete.preview.symbol} {pendingDelete.preview.timeframe} at {pendingDelete.preview.lower==null?pendingDelete.preview.price:pendingDelete.preview.lower+' – '+pendingDelete.preview.price}? Other drawings will remain unchanged.</p>
        <div className="aic-followups"><button type="button" onClick={()=>void confirmDelete()}>Confirm deletion</button><button type="button" onClick={cancelDelete}>Cancel deletion</button></div>
        <p className="aic-answer-context">Expires after 30 seconds. Chart interaction invalidates confirmation.</p>
      </div>}
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
            <button type="button" className="aic-context-chip" aria-pressed={includeMarket} aria-label="Chart context" disabled={busy||!!pendingDelete} onClick={()=>changeContext(setMarket,!includeMarket)}><span className="aic-chip-check">{includeMarket&&<Check size={12}/>}</span>Chart</button>
            <button type="button" className="aic-context-chip" aria-pressed={includeAccount} aria-label="Account context" disabled={busy} onClick={()=>changeContext(setAccount,!includeAccount)}><span className="aic-chip-check">{includeAccount&&<Check size={12}/>}</span>Account</button>
          </div>
          <button className="aic-workspace-send" type="button" aria-label={busy?'Stop response':'Send message'} disabled={!busy&&(!consent||!!pendingDelete||!validQuestion(draft))} onClick={()=>busy?operation.current?.abort():void send()}>{busy?<Square size={15}/>:<ArrowUp size={17}/>}</button>
        </div>
      </div>
      <p className="aic-disclaimer">Selected context and messages are shared with OpenAI. AI can make mistakes. No trade execution.</p>
    </div>
  </>;
}
