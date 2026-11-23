import React, {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,Plus,X,Pause,Play,Pencil,Trash2,Check,ExternalLink,Volume2,VolumeX} from 'lucide-react';
import {useTraderAuth} from '../../hooks/useTraderAuth.js';
import {apiRequest} from '../../api/client.js';
import {createAlertSound} from './alertSound.js';
import './alerts.css';

const AlertsContext=createContext(null);
export const useAlerts=()=>useContext(AlertsContext);
export const CONDITIONS={crosses:'Crosses',crosses_above:'Crosses above',crosses_below:'Crosses below',enters_range:'Enters range',exits_range:'Exits range',candle_close_above:'Candle closes above',candle_close_below:'Candle closes below'};
function conditionText(rule){const c=rule.condition||{};return `${CONDITIONS[c.type]||c.type} ${c.lower?`${c.lower} – ${c.upper}`:c.level||''}`;}
function labelStatus(rule){if(!['STARTING','MONITORING'].includes(rule.status))return rule.status.toLowerCase();return (rule.monitoring||'STARTING').toLowerCase().replaceAll('_',' ');}
function blank(symbol,level){return {symbol:symbol||'XAUUSD',name:'',note:'',condition:{type:'crosses',level:level?String(level):''},priceSource:'last',timeframe:null,frequency:'once',cooldownMs:60000,expiresAt:null,pushEnabled:false,soundEnabled:true};}
function mergeEvents(newer,older){const seen=new Set();return [...newer,...older].filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;});}

export function AlertsProvider({children,markets=[],symbol,onSelectSymbol}){
  const auth=useTraderAuth(),sound=useRef(null);
  if(!sound.current)sound.current=createAlertSound();
  const [soundEnabled,setSoundEnabled]=useState(sound.current.enabled);
  const [config,setConfig]=useState(null),[rules,setRules]=useState([]),[events,setEvents]=useState([]),[gaps,setGaps]=useState([]);
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(null),[tab,setTab]=useState('alerts'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[toast,setToast]=useState(null);
  const [hosted,setHosted]=useState(false),[filterSymbol,setFilterSymbol]=useState(null),[nextBefore,setNextBefore]=useState(null);
  const host=useRef(null),seen=useRef(null),requestId=useRef(null),scopeRevision=useRef(0),olderLoaded=useRef(false);
  const registerHost=useCallback(value=>{
    host.current=value;setHosted(true);
    return()=>{if(host.current===value){host.current=null;setHosted(false);setOpen(false);}};
  },[]);
  const request=useCallback(async(path='',options={})=>{
    const token=await auth.ensureFreshAccessToken();if(!token)throw new Error('Reconnect to manage alerts');
    return apiRequest('/v1/alerts'+path,{...options,token});
  },[auth.ensureFreshAccessToken]);
  const refresh=useCallback(async()=>{
    const revision=scopeRevision.current;
    const [list,history]=await Promise.all([request(),request('/history')]);
    if(revision!==scopeRevision.current)return;
    setRules(list.alerts);setEvents(previous=>olderLoaded.current?mergeEvents(history.events,previous):history.events);setGaps(history.gaps);
    if(!olderLoaded.current)setNextBefore(history.nextBefore||null);
    const fresh=history.events.filter(e=>!e.readAt&&!seen.current?.has(e.id));
    if(seen.current&&fresh.length){
      setToast(fresh[0]);
      if(fresh.some(e=>e.evidence.soundEnabled!==false))void sound.current.play();
    }
    seen.current=new Set(history.events.map(e=>e.id));
  },[request]);
  useEffect(()=>{
    let alive=true;scopeRevision.current++;setConfig(null);setRules([]);setEvents([]);setGaps([]);setNextBefore(null);setDraft(null);setOpen(false);setToast(null);setBusy(false);setError('');seen.current=null;olderLoaded.current=false;
    if(!auth.authenticated)return;
    request('/config').then(c=>{if(alive){setConfig(c);refresh().catch(()=>{});}}).catch(()=>{});
    return()=>{alive=false;scopeRevision.current++;};
  },[auth.authenticated,auth.principal?.tenantId,auth.principal?.ownerExternalRef,request,refresh]);
  useEffect(()=>{
    if(!config)return;let pending=false;
    const poll=async()=>{if(pending)return;pending=true;try{await refresh();}catch(e){if(open)setError(e.message);}finally{pending=false;}};
    const timer=setInterval(poll,5000);return()=>clearInterval(timer);
  },[config,refresh,open]);
  useEffect(()=>{if(!config)return;sound.current.start();return()=>sound.current.stop();},[config]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),12000);return()=>clearTimeout(timer);},[toast]);
  const close=useCallback(()=>{setOpen(false);setError('');host.current?.hide();},[]);
  const show=useCallback(()=>{setOpen(true);host.current?.show();},[]);
  const openManager=useCallback((atSymbol=null)=>{const target=typeof atSymbol==='string'?atSymbol:null;setDraft(null);setFilterSymbol(target);if(target)setTab('alerts');setError('');show();},[show]);
  const create=useCallback((atSymbol=symbol,level)=>{requestId.current=crypto.randomUUID();setDraft(blank(atSymbol,level));setError('');show();},[symbol,show]);
  const edit=useCallback(rule=>{setDraft(rule);setError('');show();},[show]);
  const openChart=useCallback(async(event)=>{
    const target=event.evidence.symbol||rules.find(r=>r.id===event.alertId)?.symbol||event.evidence.streamId.split(':').at(-1);
    onSelectSymbol(target);if(event.evidence.timeframe)window.dispatchEvent(new CustomEvent('acg-alert-timeframe',{detail:event.evidence.timeframe}));
    await request('/history/read',{method:'POST',body:{ids:[event.id]}});setToast(null);
    if(!host.current)close();await refresh();
  },[rules,onSelectSymbol,request,close,refresh]);
  useEffect(()=>{
    const navigate=data=>{if(markets.some(m=>m.symbol===data.symbol)){onSelectSymbol(data.symbol);if(data.timeframe)window.dispatchEvent(new CustomEvent('acg-alert-timeframe',{detail:data.timeframe}));}};
    const message=e=>{if(e.data?.type==='ACG_ALERT_OPEN')navigate(e.data);};
    navigator.serviceWorker?.addEventListener('message',message);
    const url=new URL(window.location.href);
    if(url.searchParams.has('alertSymbol')&&markets.length){navigate({symbol:url.searchParams.get('alertSymbol'),timeframe:url.searchParams.get('alertTimeframe')});url.searchParams.delete('alertSymbol');url.searchParams.delete('alertTimeframe');history.replaceState({},'',url);}
    return()=>navigator.serviceWorker?.removeEventListener('message',message);
  },[markets,onSelectSymbol]);
  useEffect(()=>{const key=e=>{if(e.altKey&&e.key.toLowerCase()==='a'&&config){e.preventDefault();create();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[create,config]);
  const action=async(fn)=>{
    const revision=scopeRevision.current;setBusy(true);setError('');
    try{await fn();if(revision===scopeRevision.current)await refresh();}
    catch(e){if(revision===scopeRevision.current)setError(e.message);}
    finally{if(revision===scopeRevision.current)setBusy(false);}
  };
  const save=async body=>action(async()=>{
    const revision=scopeRevision.current;
    await request(draft.id?'/'+draft.id:'',{method:draft.id?'PUT':'POST',body:draft.id?{...body,version:draft.version}:{...body,clientRequestId:requestId.current}});
    if(revision===scopeRevision.current){setDraft(null);setTab('alerts');}
  });
  const loadMore=()=>action(async()=>{
    if(!nextBefore)return;const revision=scopeRevision.current;
    const page=await request('/history?before='+encodeURIComponent(nextBefore));
    if(revision!==scopeRevision.current)return;
    olderLoaded.current=true;setEvents(previous=>mergeEvents(previous,page.events));setNextBefore(page.nextBefore||null);
  });
  const toggleSound=()=>{const next=!soundEnabled;sound.current.setEnabled(next);setSoundEnabled(next);if(next)void sound.current.preview();};
  const testSound=async()=>{if(!await sound.current.preview())setError('Sound could not play. Check this tab is unmuted and your device volume is on.');};
  const push=()=>action(async()=>{
    if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Push is not supported in this browser. On iPhone, add ACG Trader to your Home Screen first.');
    const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Allow notifications in your browser settings to enable push.');
    const registration=await navigator.serviceWorker.register('/alerts-sw.js');await navigator.serviceWorker.ready;
    const text=config.pushPublicKey.replaceAll('-','+').replaceAll('_','/');
    const bytes=Uint8Array.from(atob(text+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));
    const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    const json=subscription.toJSON();await request('/push',{method:'POST',body:{endpoint:json.endpoint,keys:json.keys}});setError('Push enabled on this device.');
  });
  const value={enabled:!!config,rules,events,gaps,config,tab,setTab,error,setError,busy,symbol,markets,filterSymbol,setFilterSymbol,
    create,open:openManager,close,edit,registerHost,isOpen:open,hosted,soundEnabled,toggleSound,testSound,push,loadMore,nextBefore,openChart,
    inspect:rule=>onSelectSymbol(rule.symbol),
    status:rule=>action(()=>request('/'+rule.id+'/status',{method:'PATCH',body:{version:rule.version,status:['STARTING','MONITORING'].includes(rule.status)?'PAUSED':'STARTING'}})),
    remove:rule=>action(()=>request('/'+rule.id,{method:'DELETE',body:{version:rule.version}})),
    unread:events.filter(e=>!e.readAt).length};
  return <AlertsContext.Provider value={value}>{children}{config&&createPortal(<>
    {toast&&<div className="acg-alert-toast" role="status"><Bell size={17}/><div><strong>{toast.evidence.symbol||rules.find(r=>r.id===toast.alertId)?.symbol||'Market'} alert triggered</strong><p>{conditionText({condition:toast.evidence.condition})}</p><button onClick={()=>openChart(toast).catch(e=>setError(e.message))}>Open chart</button></div><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={15}/></button></div>}
    {open&&!hosted&&!draft&&<AlertModal title="Alerts" onClose={close} sheet><AlertsPanel/></AlertModal>}
    {draft&&<AlertModal title={draft.id?'Edit alert':'Create alert'} onClose={()=>{setDraft(null);setError('');}}>
      <header className="acg-alert-editor-header"><div><Bell size={17}/><h2>{draft.id?'Edit alert':'Create alert'}</h2></div><button type="button" aria-label="Close alert settings" onClick={()=>{setDraft(null);setError('');}}><X size={18}/></button></header>
      <AlertMessage/>
      <AlertForm key={draft.id||requestId.current} draft={draft} markets={markets} busy={busy} pushAvailable={!!config.pushPublicKey}
        onSave={save} onCancel={()=>{setDraft(null);setError('');}} onTestSound={testSound} onEnablePush={push}/>
    </AlertModal>}
  </>,document.body)}</AlertsContext.Provider>;
}

function AlertModal({title,onClose,sheet=false,children}){
  const ref=useRef(null),returnFocus=useRef(null);
  useEffect(()=>{
    returnFocus.current=document.activeElement;
    const frame=requestAnimationFrame(()=>ref.current?.querySelector('button,input,select')?.focus());
    return()=>{cancelAnimationFrame(frame);if(returnFocus.current?.isConnected)returnFocus.current.focus();};
  },[]);
  const key=e=>{
    e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();onClose();return;}
    if(e.key!=='Tab')return;
    const items=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(!first){e.preventDefault();ref.current.focus();}
    else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  return <div className={`acg-v3-sheet acg-alert-modal ${sheet?'acg-alert-modal--sheet':''}`} onMouseDown={onClose}>
    <section ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} data-acg-hotkeys-suspend="true"
      className={`acg-alert-dialog ${sheet?'acg-alert-dialog--sheet':''}`} onMouseDown={e=>e.stopPropagation()} onKeyDown={key}>{children}</section>
  </div>;
}
function AlertMessage(){const a=useAlerts();return a.error&&<div className="acg-alert-error" role="alert">{a.error}<button onClick={()=>a.setError('')} aria-label="Dismiss message"><X size={13}/></button></div>;}

export function AlertsPanel(){
  const a=useAlerts();
  if(!a?.enabled)return null;
  return <section className="acg-alert-panel" role="region" aria-label="Alerts panel" data-acg-alert-panel data-acg-hotkeys-suspend="true" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();a.close();}}}>
    <header><div><Bell size={17}/><h2>Alerts</h2></div><div><button onClick={()=>a.create()} aria-label="Create alert" title="Create alert (Alt+A)"><Plus size={17}/></button><button onClick={a.close} aria-label="Close alerts"><X size={17}/></button></div></header>
    <AlertMessage/>
    <div className="acg-alert-tabs" role="tablist" aria-label="Alert views"><button role="tab" aria-selected={a.tab==='alerts'} onClick={()=>a.setTab('alerts')}>Alerts <span>{a.rules.length}</span></button><button role="tab" aria-selected={a.tab==='log'} onClick={()=>a.setTab('log')}>Log {a.unread>0&&<span>{a.unread}</span>}</button></div>
    {a.tab==='alerts'?<AlertList/>:<div className="acg-alert-scroll" role="tabpanel" aria-label="Alert log">
      {!a.events.length&&<div className="acg-alert-empty"><Bell size={26}/><h3>No triggered alerts</h3><p>Your alert log will appear here.</p></div>}
      {a.events.map(e=><article key={e.id} className="acg-alert-row"><div className="acg-alert-row-title"><strong>{e.evidence.symbol||e.evidence.streamId.split(':').at(-1)}</strong>{!e.readAt&&<span className="acg-alert-unread">New</span>}</div><p>{conditionText({condition:e.evidence.condition})}</p><small>{new Date(e.evidence.marketTimeMs).toLocaleString()} · {e.evidence.priceSource}{e.evidence.observedPrice?' · '+e.evidence.observedPrice:''}{e.pushStatus?' · Push '+(e.pushStatus==='ACCEPTED'?'accepted':e.pushStatus.toLowerCase()):''}</small><button className="acg-alert-link" onClick={()=>a.openChart(e).catch(error=>a.setError(error.message))}>Open chart <ExternalLink size={12}/></button></article>)}
      {a.nextBefore&&<button className="acg-alert-load-more" disabled={a.busy} onClick={a.loadMore}>Load older alerts</button>}
      {a.gaps.map(g=><article className="acg-alert-row acg-alert-gap" key={g.id}><strong>Monitoring gap · {g.streamId.split(':').at(-1)}</strong><p>Coverage was incomplete. No crossing is inferred across this interval. Check the alert's current monitoring status.</p><small>{new Date(g.createdAt).toLocaleString()}</small></article>)}
    </div>}
    <footer><span>Monitors when the terminal is closed</span><button onClick={a.toggleSound} aria-label={a.soundEnabled?'Mute alert sound':'Enable alert sound'} aria-pressed={a.soundEnabled}>{a.soundEnabled?<Volume2 size={15}/>:<VolumeX size={15}/>}</button><button disabled={!a.soundEnabled} onClick={a.testSound}>Test sound</button></footer>
  </section>;
}
function AlertList(){
  const a=useAlerts(),[search,setSearch]=useState(''),[filter,setFilter]=useState('all');
  const shown=a.rules.filter(r=>(!a.filterSymbol||r.symbol===a.filterSymbol)&&(filter==='all'||filter==='current'&&r.symbol===a.symbol||filter==='active'&&['STARTING','MONITORING'].includes(r.status))&&`${r.symbol} ${r.name}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="acg-alert-filters"><input aria-label="Search alerts" placeholder="Search instrument or alert" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter alerts" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All alerts</option><option value="current">This instrument</option><option value="active">Monitoring</option></select></div>
    {a.filterSymbol&&<button className="acg-alert-symbol-filter" onClick={()=>a.setFilterSymbol(null)}>{a.filterSymbol} · Show all <X size={12}/></button>}
    <div className="acg-alert-scroll" role="tabpanel" aria-label="Saved alerts">
      {!shown.length&&<div className="acg-alert-empty"><Bell size={26}/><h3>{a.rules.length?'No matching alerts':'Your next move, on watch'}</h3><p>{a.rules.length?'Try another search or filter.':'Set a price or candle condition. We’ll keep watching while you’re away.'}</p><button className="acg-alert-primary" onClick={()=>a.create(a.filterSymbol||a.symbol)}><Plus size={14}/> Create alert</button></div>}
      {shown.map(r=><article className="acg-alert-row" key={r.id}><div className="acg-alert-row-title"><button className="acg-alert-symbol" onClick={()=>a.inspect(r)}>{r.symbol}</button><span className={r.monitoring==='MONITORING'&&r.status==='MONITORING'?'acg-alert-monitoring':''}>{labelStatus(r)}</span></div>{r.name&&<b>{r.name}</b>}<p>{conditionText(r)}</p><small>{r.priceSource.toUpperCase()}{r.timeframe?` · ${r.timeframe}`:''} · {r.frequency==='once'?'Once':'Repeating'}</small>{r.note&&<p className="acg-alert-note">{r.note}</p>}<div className="acg-alert-row-bottom"><small>{r.expiresAt?'Until '+new Date(r.expiresAt).toLocaleString():'Until cancelled'}</small><div><button disabled={a.busy} onClick={()=>a.edit(r)} aria-label={'Edit '+r.symbol+' alert'}><Pencil size={14}/></button><button disabled={a.busy} onClick={()=>a.status(r)} aria-label={r.status==='PAUSED'?'Resume alert':'Pause or restart alert'}>{r.status==='PAUSED'||['COMPLETED','EXPIRED'].includes(r.status)?<Play size={14}/>:<Pause size={14}/>}</button><button disabled={a.busy} onClick={()=>a.remove(r)} aria-label={'Delete '+r.symbol+' alert'}><Trash2 size={14}/></button></div></div></article>)}
    </div></>;
}
function AlertForm({draft,markets,busy,pushAvailable,onSave,onCancel,onTestSound,onEnablePush}){
  const [form,setForm]=useState(()=>({...blank(draft.symbol),...draft,condition:{...draft.condition}})),[tab,setTab]=useState('settings');
  const patch=(key,value)=>setForm(f=>({...f,[key]:value}));
  const type=form.condition.type,range=type.includes('range'),candle=type.startsWith('candle');
  const body={symbol:form.symbol,name:form.name,note:form.note,condition:range?{type,lower:form.condition.lower||'',upper:form.condition.upper||''}:{type,level:form.condition.level||''},priceSource:candle?'last':form.priceSource,timeframe:candle?(form.timeframe||'15m'):null,frequency:form.frequency,cooldownMs:Number(form.cooldownMs),expiresAt:form.expiresAt,pushEnabled:form.pushEnabled,soundEnabled:form.soundEnabled!==false};
  // Keep Settings mounted so native required-field validation also runs when Notifications is selected.
  return <form className="acg-alert-editor" onSubmit={e=>{e.preventDefault();onSave(body);}} onInvalid={()=>setTab('settings')}>
    <div className="acg-alert-tabs" role="tablist" aria-label="Alert configuration"><button type="button" role="tab" aria-selected={tab==='settings'} onClick={()=>setTab('settings')}>Settings</button><button type="button" role="tab" aria-selected={tab==='notifications'} onClick={()=>setTab('notifications')}>Notifications</button></div>
    <div className="acg-alert-form" hidden={tab!=='settings'} role="tabpanel" aria-label="Alert settings">
      <label>Instrument<select aria-label="Instrument" value={form.symbol} onChange={e=>patch('symbol',e.target.value)}>{[...new Set([form.symbol,...markets.map(m=>m.symbol)])].map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Condition<select aria-label="Condition" value={type} onChange={e=>patch('condition',{...form.condition,type:e.target.value})}>{Object.entries(CONDITIONS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <div className="acg-alert-form-grid">{range?<><label>Lower price<input required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={form.condition.lower||''} onChange={e=>patch('condition',{...form.condition,lower:e.target.value})}/></label><label>Upper price<input required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={form.condition.upper||''} onChange={e=>patch('condition',{...form.condition,upper:e.target.value})}/></label></>:<><label>Price<input required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={form.condition.level||''} onChange={e=>patch('condition',{...form.condition,level:e.target.value})}/></label><label>{candle?'Timeframe':'Price source'}<select aria-label={candle?'Timeframe':'Price source'} value={candle?(form.timeframe||'15m'):form.priceSource} onChange={e=>patch(candle?'timeframe':'priceSource',e.target.value)}>{(candle?['1m','5m','15m','30m','1h','4h','1d']:['last','bid','ask']).map(v=><option key={v} value={v}>{v.toUpperCase()}</option>)}</select></label></>}</div>
      {range&&<label>Price source<select value={form.priceSource} onChange={e=>patch('priceSource',e.target.value)}>{['last','bid','ask'].map(v=><option key={v}>{v}</option>)}</select></label>}
      <div className="acg-alert-form-grid"><label>Frequency<select aria-label="Frequency" value={form.frequency} onChange={e=>patch('frequency',e.target.value)}><option value="once">Once</option><option value="repeat">Repeating</option></select></label>{form.frequency==='repeat'&&<label>Minimum interval<select aria-label="Minimum interval" value={form.cooldownMs} onChange={e=>patch('cooldownMs',Number(e.target.value))}><option value="0">Every crossing</option><option value="60000">1 minute</option><option value="300000">5 minutes</option><option value="3600000">1 hour</option></select></label>}</div>
      <label>Expiry<select value={form.expiresAt?'custom':'none'} onChange={e=>patch('expiresAt',e.target.value==='none'?null:new Date(Date.now()+7*86400000).toISOString())}><option value="none">Until cancelled</option><option value="custom">Choose date and time</option></select></label>
      {form.expiresAt&&<input aria-label="Expiry date and time" type="datetime-local" required value={new Date(Date.parse(form.expiresAt)-new Date(form.expiresAt).getTimezoneOffset()*60000).toISOString().slice(0,16)} onChange={e=>{if(e.target.value)patch('expiresAt',new Date(e.target.value).toISOString());}}/>}
      <label>Name<input maxLength={80} value={form.name} placeholder="Optional" onChange={e=>patch('name',e.target.value)}/></label>
      <label>Personal note<textarea maxLength={300} value={form.note} placeholder="What are you watching for?" onChange={e=>patch('note',e.target.value)}/></label>
    </div>
    <div className="acg-alert-form" hidden={tab!=='notifications'} role="tabpanel" aria-label="Alert notifications">
      <div className="acg-alert-notification-option"><Bell size={16}/><div><strong>Terminal notification</strong><p>Every trigger is saved in the log and shown in the terminal.</p></div></div>
      <label className="acg-alert-checkbox"><input type="checkbox" checked={form.soundEnabled!==false} onChange={e=>patch('soundEnabled',e.target.checked)}/> Play sound</label>
      <button type="button" className="acg-alert-link" onClick={onTestSound}>Preview sound</button>
      <p className="acg-alert-footnote">Sound plays while the terminal is open. The terminal mute control overrides this alert's setting.</p>
      {pushAvailable&&<><label className="acg-alert-checkbox"><input type="checkbox" checked={form.pushEnabled} onChange={e=>patch('pushEnabled',e.target.checked)}/> Device push notification</label><button type="button" className="acg-alert-link" disabled={busy} onClick={onEnablePush}>Enable this device</button><p className="acg-alert-footnote">Allow notifications on this device to receive pushes while the terminal is closed.</p></>}
    </div>
    <div className="acg-alert-editor-actions"><div className="acg-alert-summary"><p>{form.symbol} · {conditionText(body)}<br/><small>{candle?`${body.timeframe} close · LAST`:body.priceSource.toUpperCase()} · {form.frequency==='once'?'Notify once':'Repeat after reset'}</small></p></div><div><button type="button" onClick={onCancel}>Cancel</button><button className="acg-alert-primary" disabled={busy}>{busy?'Saving…':draft.id?'Save changes':'Create alert'}<Check size={15}/></button></div><p className="acg-alert-footnote">Alerts notify you. They do not place trades.</p></div>
  </form>;
}
