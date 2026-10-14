import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import V4DrawingToolbar from './components/trading-v2/v4/V4DrawingToolbar.jsx';
import './index.css';

function Audit(){
 const [selected,setSelected]=useState('cursor');
 const [show,setShow]=useState(true);
 const [snap,setSnap]=useState('off');
 const [locked,setLocked]=useState(false);
 const [pinned,setPinned]=useState(false);
 const [plan,setPlan]=useState(false);
 const [height,setHeight]=useState(340);
 const [log,setLog]=useState([]);
 window.v4DrawingQA={
  get selected(){return selected;},get show(){return show;},
  get snap(){return snap;},get locked(){return locked;},get pinned(){return pinned;},
  get log(){return log;},
  setPlan,setHeight
 };
 return <div style={{display:'flex',height:'100vh',minHeight:0,background:'#050506',padding:12}}>
  <aside data-v4-drawing-toolbar="true" className="acg-v4-drawing-rail" style={{height}}>
   <V4DrawingToolbar selectedTool={selected} tradePlanActive={plan} drawingCount={3}
    onSelectTool={id=>{setSelected(id);setLog(v=>[...v,'select:'+id]);}}
    showDrawings={show} onToggleVisibility={()=>{setShow(v=>!v);setLog(v=>[...v,'visibility']);}}
    drawingSnap={snap} onCycleSnap={()=>{setSnap(v=>v==='off'?'weak':v==='weak'?'strong':'off');setLog(v=>[...v,'snap']);}}
    lockAllDrawings={locked} onToggleLock={()=>{setLocked(v=>!v);setLog(v=>[...v,'lock']);}}
    keepDrawingTool={pinned} onTogglePin={()=>{setPinned(v=>!v);setLog(v=>[...v,'pin']);}}/>
  </aside>
 </div>;
}
createRoot(document.getElementById('v4-drawing-root')).render(<Audit/>);
