import React,{useEffect,useRef,useState} from 'react';
import {ArrowUp,ChevronDown,ChevronLeft,MessageSquarePlus,Sparkles,X} from 'lucide-react';
import {chartContextLabel,MAX_QUESTION_BYTES,questionBytes,SUGGESTIONS} from './aiPreview.js';
import {workspaceContext} from './workspaceReport.js';
import VerifiedWorkspaceReport from './VerifiedWorkspaceReport.jsx';
import './nativeAiChat.css';
import StaffWorkspaceChat from './StaffWorkspaceChat.jsx';
import StaffLivePilotPanel from './StaffLivePilotPanel.jsx';
import IsolatedConversationPanel from './IsolatedConversationPanel.jsx';

// Consent is local, never restored automatically, and changing chart identity
// remounts the entire isolated controller, aborting old response handling.
function IsolatedScopedChat({client,chart}){
  const [consent,setConsent]=useState(false);
  return <IsolatedConversationPanel key={consent?'chart':'education'} client={client} chart={chart}
    workspace={workspaceContext(chart.symbol,chart.timeframe,consent)} onConsentChange={setConsent}/>;
}

// Presentation only in production. No fetch, generated response, credential entry, persistence,
// account values, trade actions or automatic context attachment.
export default function NativeAiChat({symbol,timeframe,onClose,mobile=false,reportFixture=null,isolatedClient=null,staffRuntime=null}){
  const chart=chartContextLabel(symbol,timeframe);
  const [draft,setDraft]=useState('');
  const [isolatedGeneration,setIsolatedGeneration]=useState(0);
  const [funding,setFunding]=useState('BYO_API');
  const [fundingOpen,setFundingOpen]=useState(false);
  const [attachChart,setAttachChart]=useState(false);
  const [report,setReport]=useState(null);
  const draftRef=useRef(null);
  const rootRef=useRef(null);
  const validContext=Boolean(chart.symbol&&chart.timeframe);
  const bytes=questionBytes(draft);
  useEffect(()=>{
    if(mobile)return;
    const previous=document.activeElement;
    rootRef.current?.focus({preventScroll:true});
    return ()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
  },[mobile]);
  useEffect(()=>{
    if(!fundingOpen)return;
    const dismiss=e=>{if(!rootRef.current?.querySelector('[data-ai-funding]')?.contains(e.target))setFundingOpen(false);};
    document.addEventListener('pointerdown',dismiss);
    return ()=>document.removeEventListener('pointerdown',dismiss);
  },[fundingOpen]);
  function choose(prompt){setDraft(prompt);draftRef.current?.focus();}
  function clear(){if(staffRuntime){setIsolatedGeneration(v=>v+1);return;}if(import.meta.env.DEV&&isolatedClient){setIsolatedGeneration(v=>v+1);return;}setReport(null);setDraft('');setFundingOpen(false);draftRef.current?.focus();}
  return <section ref={rootRef} tabIndex={-1} className={'acg-ai-chat'+(mobile?' acg-ai-chat-mobile':'')} aria-label="ACG AI assistant preview" data-ai-chat-preview onKeyDown={e=>{
    if(e.key==='Escape'){e.stopPropagation();if(fundingOpen)setFundingOpen(false);else onClose();}
  }}>
    <header className="aic-header">
      {mobile&&<button className="aic-icon" type="button" onClick={onClose} aria-label="Back to chart"><ChevronLeft size={19}/></button>}
      <Sparkles size={16} strokeWidth={1.7}/><h2>ACG AI</h2><span className="aic-preview">{staffRuntime?.runtimeMode==='WORKSPACE_CHAT'?'Staff':staffRuntime?'Staff pilot':'Preview'}</span>
      <button type="button" className="aic-icon aic-new" onClick={clear} title="New chat draft" aria-label="New chat draft"><MessageSquarePlus size={17}/></button>
      {!mobile&&<button type="button" className="aic-icon" onClick={onClose} aria-label="Close AI assistant"><X size={17}/></button>}
    </header>
    {staffRuntime?.runtimeMode==='WORKSPACE_CHAT'?<StaffWorkspaceChat key={JSON.stringify([isolatedGeneration,staffRuntime.sessionId,staffRuntime.accountId,chart.symbol,chart.timeframe])} runtime={staffRuntime} symbol={symbol} timeframe={timeframe}/>:staffRuntime?<StaffLivePilotPanel key={JSON.stringify([isolatedGeneration,staffRuntime.sessionId,staffRuntime.accountId,chart.symbol,chart.timeframe])} runtime={staffRuntime} symbol={symbol} timeframe={timeframe}/>:import.meta.env.DEV&&isolatedClient?<IsolatedScopedChat key={isolatedGeneration+':'+chart.symbol+':'+chart.timeframe} client={isolatedClient} chart={chart}/>:<>
    <div className="aic-context">
      <div><span>Workspace</span><strong>{validContext?chart.symbol+' · '+chart.timeframe:'No chart selected'}</strong></div>
      <label><input type="checkbox" disabled={!validContext} checked={attachChart&&validContext} onChange={e=>{setAttachChart(e.target.checked);setReport(null);}}/> Include chart context</label>
    </div>
    <div className="aic-body">
      {report&&attachChart&&validContext?<VerifiedWorkspaceReport envelope={report.envelope} expected={{...report.expected,symbol:chart.symbol,timeframe:chart.timeframe,includeChartContext:attachChart}} fixture/>:<>
      <div className="aic-empty">
        <Sparkles size={25} strokeWidth={1.4}/>
        <h3>What would you like to explore?</h3>
        <p>Prepare a question about the current chart or a trading concept.</p>
      </div>
      <div className="aic-suggestions" aria-label="Suggested questions">
        {SUGGESTIONS.map(s=><button type="button" key={s.label} onClick={()=>choose(s.prompt)}>{s.label}<span aria-hidden="true">↗</span></button>)}
      </div>
      </>}
      {import.meta.env.DEV&&typeof reportFixture==='function'&&attachChart&&validContext&&<button type="button" className="aic-report-trigger" onClick={()=>setReport(reportFixture(workspaceContext(symbol,timeframe,true)))}>Show sample report</button>}
    </div>
    <div className="aic-footer">
      <div className="aic-settings">
        <div className="aic-funding" data-ai-funding>
          <button type="button" className="aic-choice" onClick={()=>setFundingOpen(x=>!x)} aria-expanded={fundingOpen}>{funding==='BYO_API'?'Your API key':'ACG Credits'}<ChevronDown size={12}/></button>
          {fundingOpen&&<div className="aic-menu" role="group" aria-label="Preview funding choice">
            {['BYO_API','ACG_CREDITS'].map(v=><button key={v} type="button" aria-pressed={funding===v} onClick={()=>{setFunding(v);setFundingOpen(false);}}>{v==='BYO_API'?'Your API key':'ACG Credits'}</button>)}
          </div>}
        </div>
        <span className="aic-model">Model not connected</span>
      </div>
      <div className="aic-composer">
        <textarea ref={draftRef} aria-label="Message ACG AI" placeholder="Ask ACG AI…" value={draft} onChange={e=>{if(questionBytes(e.target.value)<=MAX_QUESTION_BYTES)setDraft(e.target.value);}} rows={3}/>
        <div className="aic-composer-bottom"><span>{bytes>0?bytes+' / '+MAX_QUESTION_BYTES+' bytes':'Draft only'}</span><button type="button" disabled aria-label="Send unavailable in preview" title="Inference is disabled"><ArrowUp size={17}/></button></div>
      </div>
      <p className="aic-disclaimer" role="status">Preview only. Nothing is sent to an AI provider. No orders or credits are affected.</p>
    </div>
    </>}
  </section>;
}
