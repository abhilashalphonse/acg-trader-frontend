import React, {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,Plus,X,Pause,Play,Pencil,Trash2,ChevronLeft,Check,ExternalLink} from 'lucide-react';
import {useTraderAuth} from '../../hooks/useTraderAuth.js';
import {apiRequest} from '../../api/client.js';
import './alerts.css';

const AlertsContext=createContext(null);
export const useAlerts=()=>useContext(AlertsContext);
export const CONDITIONS={crosses:'Crosses',crosses_above:'Crosses above',crosses_below:'Crosses below',enters_range:'Enters range',exits_range:'Exits range',candle_close_above:'Candle closes above',candle_close_below:'Candle closes below'};
function conditionText(rule){const c=rule.condition||{};return `${CONDITIONS[c.type]||c.type} ${c.lower?`${c.lower} – ${c.upper}`:c.level||''}`;}
function labelStatus(rule){if(!['STARTING','MONITORING'].includes(rule.status))return rule.status.toLowerCase();return (rule.monitoring||'STARTING').toLowerCase().replaceAll('_',' ');}
function blank(symbol,level){return {symbol:symbol||'XAUUSD',name:'',note:'',condition:{type:'crosses',level:level?String(level):''},priceSource:'last',timeframe:null,frequency:'once',cooldownMs:60000,expiresAt:null,pushEnabled:false};}
export function AlertsProvider({children,markets=[],symbol,onSelectSymbol}){
  const auth=useTraderAuth();
  const [config,setConfig]=useState(null),[rules,setRules]=useState([]),[events,setEvents]=useState([]),[gaps,setGaps]=useState([]);
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(null),[tab,setTab]=useState('alerts'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[toast,setToast]=useState(null);
  const seen=useRef(null),requestId=useRef(null),panelRef=useRef(null),triggerRef=useRef(null);
  const scopeRevision=useRef(0);
  const request=useCallback(async(path='',options={})=>{
    const token=await auth.ensureFreshAccessToken();if(!token)throw new Error('Reconnect to manage alerts');
    return apiRequest('/v1/alerts'+path,{...options,token});
  },[auth.ensureFreshAccessToken]);
  const refresh=useCallback(async()=>{
    const revision=scopeRevision.current;
    const [list,history]=await Promise.all([request(),request('/history')]);
    if(revision!==scopeRevision.current)return;
    setRules(list.alerts);setEvents(history.events);setGaps(history.gaps);
    const fresh=history.events.filter(e=>!e.readAt&&!seen.current?.has(e.id));
    if(seen.current&&fresh.length)setToast(fresh[0]);
    seen.current=new Set(history.events.map(e=>e.id));
  },[request]);
  useEffect(()=>{
    let alive=true;scopeRevision.current++;setConfig(null);setRules([]);setEvents([]);setDraft(null);setOpen(false);setToast(null);seen.current=null;
    if(!auth.authenticated)return;
    request('/config').then(c=>{if(alive){setConfig(c);refresh().catch(()=>{});}}).catch(()=>{});
    return()=>{alive=false;scopeRevision.current++;};
  },[auth.authenticated,auth.principal?.tenantId,auth.principal?.ownerExternalRef,request,refresh]);
  useEffect(()=>{if(!config)return;let pending=false;const poll=async()=>{if(pending)return;pending=true;try{await refresh();}catch(e){if(open)setError(e.message);}finally{pending=false;}};const timer=setInterval(poll,5000);return()=>clearInterval(timer);},[config,refresh,open]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),12000);return()=>clearTimeout(timer);},[toast]);
  const close=useCallback(()=>{setOpen(false);setDraft(null);setError('');triggerRef.current?.focus?.();},[]);
  useEffect(()=>{
    if(!open)return;triggerRef.current=document.activeElement;const previous=document.activeElement;
    const frame=requestAnimationFrame(()=>panelRef.current?.querySelector('button,input,select')?.focus());
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();close();}
      if(e.key==='Tab'){
        const items=[...panelRef.current.querySelectorAll('button:not(:disabled),input,select,textarea,[tabindex="0"]')];
        const first=items[0],last=items.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',key);previous?.focus?.();};
  },[open,close]);
  const create=useCallback((atSymbol=symbol,level)=>{requestId.current=crypto.randomUUID();setDraft(blank(atSymbol,level));setError('');setOpen(true);},[symbol]);
  const openChart=useCallback(async(event)=>{
    const found=rules.find(r=>r.id===event.alertId);const target=found?.symbol||event.evidence.streamId.split(':').at(-1);
    onSelectSymbol(target);if(event.evidence.timeframe)window.dispatchEvent(new CustomEvent('acg-alert-timeframe',{detail:event.evidence.timeframe}));
    await request('/history/read',{method:'POST',body:{ids:[event.id]}});setToast(null);close();await refresh();
  },[rules,onSelectSymbol,request,close,refresh]);
  useEffect(()=>{
    const navigate=data=>{if(markets.some(m=>m.symbol===data.symbol)){onSelectSymbol(data.symbol);if(data.timeframe)window.dispatchEvent(new CustomEvent('acg-alert-timeframe',{detail:data.timeframe}));}};
    const message=e=>{if(e.data?.type==='ACG_ALERT_OPEN')navigate(e.data);};
    navigator.serviceWorker?.addEventListener('message',message);
    const url=new URL(window.location.href);if(url.searchParams.has('alertSymbol')&&markets.length){navigate({symbol:url.searchParams.get('alertSymbol'),timeframe:url.searchParams.get('alertTimeframe')});url.searchParams.delete('alertSymbol');url.searchParams.delete('alertTimeframe');history.replaceState({},'',url);}
    return()=>navigator.serviceWorker?.removeEventListener('message',message);
  },[markets,onSelectSymbol]);
  useEffect(()=>{const key=e=>{if(e.altKey&&e.key.toLowerCase()==='a'&&config){e.preventDefault();create();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[create,config]);
  const action=async(fn)=>{setBusy(true);setError('');try{await fn();await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const save=async body=>action(async()=>{
    await request(draft.id?'/'+draft.id:'',{method:draft.id?'PUT':'POST',body:draft.id?{...body,version:draft.version}:{...body,clientRequestId:requestId.current}});
    setDraft(null);setTab('alerts');
  });
  const push=async()=>action(async()=>{
    if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Push is not supported in this browser. On iPhone, add ACG Trader to your Home Screen first.');
    const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Allow notifications in your browser settings to enable push.');
    const registration=await navigator.serviceWorker.register('/alerts-sw.js');await navigator.serviceWorker.ready;
    const text=config.pushPublicKey.replaceAll('-','+').replaceAll('_','/');
    const bytes=Uint8Array.from(atob(text+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));
    const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    const json=subscription.toJSON();await request('/push',{method:'POST',body:{endpoint:json.endpoint,keys:json.keys}});setError('Push enabled on this device.');
  });
  const value={enabled:!!config, rules,create,open:()=>{setDraft(null);setOpen(true);setError('');},edit:rule=>{setDraft(rule);setOpen(true);},unread:events.filter(e=>!e.readAt).length};
  return <AlertsContext.Provider value={value}>{children}{config&&createPortal(<>
    {toast&&<div className="acg-alert-toast" role="status"><Bell size={17}/><div><strong>{rules.find(r=>r.id===toast.alertId)?.symbol||'Market'} alert triggered</strong><p>{conditionText({condition:toast.evidence.condition})}</p><button onClick={()=>openChart(toast).catch(e=>setError(e.message))}>Open chart</button></div><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={15}/></button></div>}
    {open&&<><div className="acg-alert-backdrop" onClick={close}/><section ref={panelRef} className="acg-alert-panel" role="dialog" aria-modal="true" aria-label={draft?'Alert settings':'Alerts'}>
      <header><div><Bell size={17}/><h2>{draft?(draft.id?'Edit alert':'Create alert'):'Alerts'}</h2></div><button onClick={close} aria-label="Close alerts"><X size={18}/></button></header>
      {error&&<div className="acg-alert-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss message"><X size={13}/></button></div>}
      {draft?<AlertForm key={draft.id||requestId.current} draft={draft} markets={markets} busy={busy} pushAvailable={!!config.pushPublicKey} onSave={save} onBack={()=>setDraft(null)}/>:<>
        <div className="acg-alert-tabs"><button aria-pressed={tab==='alerts'} onClick={()=>setTab('alerts')}>Alerts <span>{rules.length}</span></button><button aria-pressed={tab==='history'} onClick={()=>setTab('history')}>History</button><button className="acg-alert-add" onClick={()=>create()} aria-label="Create alert"><Plus size={17}/></button></div>
        {tab==='alerts'?<AlertList rules={rules} symbol={symbol} busy={busy} onEdit={value.edit} onCreate={()=>create()} onStatus={r=>action(()=>request('/'+r.id+'/status',{method:'PATCH',body:{version:r.version,status:['STARTING','MONITORING'].includes(r.status)?'PAUSED':'STARTING'}}))} onDelete={r=>action(()=>request('/'+r.id,{method:'DELETE',body:{version:r.version}}))}/>:<div className="acg-alert-scroll">
          {!events.length&&<div className="acg-alert-empty"><Bell size={28}/><h3>No triggered alerts</h3><p>Your alert history will appear here.</p></div>}
          {events.map(e=><article key={e.id} className="acg-alert-row"><div className="acg-alert-row-title"><strong>{e.evidence.streamId.split(':').at(-1)}</strong>{!e.readAt&&<span className="acg-alert-unread">New</span>}</div><p>{conditionText({condition:e.evidence.condition})}</p><small>{new Date(e.evidence.marketTimeMs).toLocaleString()} · {e.evidence.priceSource}{e.evidence.observedPrice?' · '+e.evidence.observedPrice:''}{e.pushStatus?' · Push '+(e.pushStatus==='ACCEPTED'?'sent':e.pushStatus.toLowerCase()):''}</small><button className="acg-alert-link" onClick={()=>action(()=>openChart(e))}>Open chart <ExternalLink size={12}/></button></article>)}
          {gaps.map(g=><article className="acg-alert-row acg-alert-gap" key={g.id}><strong>Monitoring gap · {g.streamId.split(':').at(-1)}</strong><p>Market data was unavailable. Monitoring resumed with a fresh baseline.</p><small>{new Date(g.createdAt).toLocaleString()}</small></article>)}
        </div>}
        <footer><span>Runs when your terminal is closed</span>{config.pushPublicKey&&<button disabled={busy} onClick={push}>Enable device push</button>}</footer>
      </>}
    </section></>}
  </>,document.body)}</AlertsContext.Provider>;
}
function AlertList({rules,symbol,busy,onEdit,onCreate,onStatus,onDelete}){
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
  const shown=rules.filter(r=>(filter==='all'||filter==='current'&&r.symbol===symbol||filter==='active'&&['STARTING','MONITORING'].includes(r.status))&&`${r.symbol} ${r.name}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="acg-alert-filters"><input aria-label="Search alerts" placeholder="Search instrument or alert" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter alerts" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All alerts</option><option value="current">This instrument</option><option value="active">Monitoring</option></select></div><div className="acg-alert-scroll">
    {!shown.length&&<div className="acg-alert-empty"><Bell size={28}/><h3>{rules.length?'No matching alerts':'Your next move, on watch'}</h3><p>{rules.length?'Try another search or filter.':'Set a price or candle condition. We’ll keep watching while you’re away.'}</p>{!rules.length&&<button className="acg-alert-primary" onClick={onCreate}><Plus size={14}/> Create alert</button>}</div>}
    {shown.map(r=><article className="acg-alert-row" key={r.id}><div className="acg-alert-row-title"><strong>{r.symbol}</strong><span className={r.monitoring==='MONITORING'&&r.status==='MONITORING'?'acg-alert-monitoring':''}>{labelStatus(r)}</span></div>{r.name&&<b>{r.name}</b>}<p>{conditionText(r)}</p><small>{r.priceSource.toUpperCase()}{r.timeframe?` · ${r.timeframe}`:''} · {r.frequency==='once'?'Once':'Repeating'}</small>{r.note&&<p className="acg-alert-note">{r.note}</p>}<div className="acg-alert-row-bottom"><small>{r.expiresAt?'Until '+new Date(r.expiresAt).toLocaleString():'Until cancelled'}</small><div><button disabled={busy} onClick={()=>onEdit(r)} aria-label={'Edit '+r.symbol+' alert'}><Pencil size={14}/></button><button disabled={busy} onClick={()=>onStatus(r)} aria-label={r.status==='PAUSED'?'Resume alert':'Pause or restart alert'}>{r.status==='PAUSED'||['COMPLETED','EXPIRED'].includes(r.status)?<Play size={14}/>:<Pause size={14}/>}</button><button disabled={busy} onClick={()=>onDelete(r)} aria-label={'Delete '+r.symbol+' alert'}><Trash2 size={14}/></button></div></div></article>)}
  </div></>;
}
function AlertForm({draft,markets,busy,pushAvailable,onSave,onBack}){
  const [form,setForm]=useState(()=>({...blank(draft.symbol),...draft,condition:{...draft.condition}}));
  const patch=(key,value)=>setForm(f=>({...f,[key]:value}));
  const type=form.condition.type,range=type.includes('range'),candle=type.startsWith('candle');
  const body={symbol:form.symbol,name:form.name,note:form.note,condition:range?{type,lower:form.condition.lower||'',upper:form.condition.upper||''}:{type,level:form.condition.level||''},priceSource:candle?'last':form.priceSource,timeframe:candle?(form.timeframe||'15m'):null,frequency:form.frequency,cooldownMs:Number(form.cooldownMs),expiresAt:form.expiresAt,pushEnabled:form.pushEnabled};
  return <form className="acg-alert-form" onSubmit={e=>{e.preventDefault();onSave(body);}}><button className="acg-alert-back" type="button" onClick={onBack}><ChevronLeft size={14}/> All alerts</button>
    <label>Instrument<select aria-label="Instrument" value={form.symbol} onChange={e=>patch('symbol',e.target.value)}>{[...new Set([form.symbol,...markets.map(m=>m.symbol)])].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Condition<select aria-label="Condition" value={type} onChange={e=>patch('condition',{...form.condition,type:e.target.value})}>{Object.entries(CONDITIONS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <div className="acg-alert-form-grid">{range?<><label>Lower price<input required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={form.condition.lower||''} onChange={e=>patch('condition',{...form.condition,lower:e.target.value})}/></label><label>Upper price<input required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={form.condition.upper||''} onChange={e=>patch('condition',{...form.condition,upper:e.target.value})}/></label></>:<><label>Price<input autoFocus required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={form.condition.level||''} onChange={e=>patch('condition',{...form.condition,level:e.target.value})}/></label><label>{candle?'Timeframe':'Price source'}<select aria-label={candle?"Timeframe":"Price source"} value={candle?(form.timeframe||'15m'):form.priceSource} onChange={e=>patch(candle?'timeframe':'priceSource',e.target.value)}>{(candle?['1m','5m','15m','30m','1h','4h','1d']:['last','bid','ask']).map(v=><option key={v} value={v}>{v.toUpperCase()}</option>)}</select></label></>}</div>
    {range&&<label>Price source<select value={form.priceSource} onChange={e=>patch('priceSource',e.target.value)}>{['last','bid','ask'].map(v=><option key={v}>{v}</option>)}</select></label>}
    <div className="acg-alert-form-grid"><label>Frequency<select aria-label="Frequency" value={form.frequency} onChange={e=>patch('frequency',e.target.value)}><option value="once">Once</option><option value="repeat">Repeating</option></select></label>{form.frequency==='repeat'&&<label>Minimum interval<select aria-label="Minimum interval" value={form.cooldownMs} onChange={e=>patch('cooldownMs',Number(e.target.value))}><option value="0">Every crossing</option><option value="60000">1 minute</option><option value="300000">5 minutes</option><option value="3600000">1 hour</option></select></label>}</div>
    <details><summary>More options</summary><label>Name<input maxLength={80} value={form.name} placeholder="Optional" onChange={e=>patch('name',e.target.value)}/></label><label>Personal note<textarea maxLength={300} value={form.note} placeholder="What are you watching for?" onChange={e=>patch('note',e.target.value)}/></label><label>Expiry<select value={form.expiresAt?'custom':'none'} onChange={e=>patch('expiresAt',e.target.value==='none'?null:new Date(Date.now()+7*86400000).toISOString())}><option value="none">Until cancelled</option><option value="custom">Choose date and time</option></select></label>{form.expiresAt&&<input aria-label="Expiry date and time" type="datetime-local" required value={new Date(Date.parse(form.expiresAt)-new Date(form.expiresAt).getTimezoneOffset()*60000).toISOString().slice(0,16)} onChange={e=>{if(e.target.value)patch('expiresAt',new Date(e.target.value).toISOString());}}/>}</details>
    {pushAvailable&&<label className="acg-alert-checkbox"><input type="checkbox" checked={form.pushEnabled} onChange={e=>patch('pushEnabled',e.target.checked)}/> Device push <span>Enable this device in Alerts first</span></label>}
    <div className="acg-alert-summary"><Bell size={15}/><p>{form.symbol} · {conditionText(body)}<br/><small>{candle?`${body.timeframe} close · LAST`:body.priceSource.toUpperCase()} · {form.frequency==='once'?'Notify once':'Repeat after reset'}</small></p></div>
    <button className="acg-alert-primary" disabled={busy}>{busy?'Saving…':draft.id?'Save changes':'Create alert'}<Check size={15}/></button><p className="acg-alert-footnote">Alerts notify you when a condition occurs. They do not place trades.</p>
  </form>;
}
