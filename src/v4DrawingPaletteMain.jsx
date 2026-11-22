import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import V4DrawingEditor from './components/trading-v2/v4/V4DrawingEditor.jsx';
import {DEFAULT_DRAWING_STYLE} from './utils/drawingAppearance.js';
import './index.css';

// Only a visual fixture: never creates, modifies or submits a trading order.
function Preview() {
  const [type,setType]=useState('trendline');
  const [style,setStyle]=useState({...DEFAULT_DRAWING_STYLE});
  const drawing={id:'fixture',type,style,locked:false};
  return <div style={{minHeight:'100vh',background:'#FAFBFC',padding:20}}>
    <div style={{height:140,position:'relative'}}>
      <V4DrawingEditor drawing={drawing} label={type==='trendline'?'Trend line':type}
        metrics={{riskReward:2,canCreateOrder:false}} lockAll={false}
        onAppearance={appearance=>setStyle(current=>({...current,...appearance}))}
        onWidth={()=>setStyle(current=>({...current,width:current.width===1?2:1}))}
        onDash={()=>{}} onCreateOrder={()=>{}} onHide={()=>{}} onLock={()=>{}}
        onDuplicate={()=>{}} onSettings={()=>{}} onDelete={()=>{}} onClose={()=>{}}
        onDragStart={()=>{}} onDragMove={()=>{}} onDragEnd={()=>{}}
        onDragCancel={()=>{}} style={{left:16,top:14}} />
    </div>
    <button type="button" aria-label="Use risk drawing" onClick={()=>{setType('long-position');setStyle({...DEFAULT_DRAWING_STYLE});}}>Risk drawing</button>
    <button type="button" aria-label="Use text drawing" onClick={()=>{setType('text');setStyle({...DEFAULT_DRAWING_STYLE});}}>Text drawing</button>
    <output data-testid="drawing-style">{JSON.stringify({type,...style})}</output>
  </div>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
