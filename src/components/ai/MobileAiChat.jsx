import React,{useEffect,useRef} from 'react';
import NativeAiChat from './NativeAiChat.jsx';
export default function MobileAiChat(props){
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current,previous=document.activeElement;
    if(el&&!el.open)el.showModal();
    return ()=>{if(el?.open)el.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return <dialog ref={ref} className="acg-ai-chat-dialog" aria-label="ACG AI assistant preview" onCancel={e=>{e.preventDefault();props.onClose();}}>
    <NativeAiChat {...props} mobile/>
  </dialog>;
}
