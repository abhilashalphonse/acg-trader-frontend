import React from 'react';
import {createRoot} from 'react-dom/client';
import NativeAiChat from '../../src/components/ai/NativeAiChat.jsx';
import MobileAiChat from '../../src/components/ai/MobileAiChat.jsx';
import {createIsolatedChatClient} from '../../src/components/ai/isolatedChatClient.js';
if(!import.meta.env.DEV||location.hostname!=='127.0.0.1'||!window.__phase4fAuthority)throw Error('Isolated fixture only');
const authority=Object.freeze({...window.__phase4fAuthority});
delete window.__phase4fAuthority;
const client=createIsolatedChatClient({isolated:true,...authority,isCurrent:()=>true,post:async(path,body,{signal})=>{
  const res=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal,redirect:'error',cache:'no-store'});
  if(!res.ok)throw Error('Request rejected');return res.json();
}});
const root=createRoot(document.getElementById('root'));
const Component=new URLSearchParams(location.search).get('mobile')==='1'?MobileAiChat:NativeAiChat;
root.render(<div style={{width:'min(100vw, 400px)',height:'100dvh',display:'flex'}}><Component symbol="XAUUSD" timeframe="1m" isolatedClient={client} onClose={()=>root.unmount()}/></div>);
