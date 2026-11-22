import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import RiskPositionDrawing from './components/trading-v2/RiskPositionDrawing.jsx';
import './index.css';

// Synthetic browser visual fixture. Does not import or access execution APIs.
function Fixture() {
  const [side,setSide]=useState('long');
  const [selected,setSelected]=useState(true);
  const [theme,setTheme]=useState('light');
  const [narrow,setNarrow]=useState(false);
  const [lastDrag,setLastDrag]=useState('');
  const width=narrow?360:950,height=570;
  const entry=59755.8;
  const stop=side==='long'?59340.64:60170.96;
  const targetPrice=side==='long'?60586.12:58925.48;
  const a={x:narrow?95:400,y:270};
  const b={x:narrow?255:665,y:side==='long'?423:126};
  const target={x:b.x,y:side==='long'?100:475};
  const drawing={
    id:'synthetic-risk',type:side+'-position',
    a:{time:100,price:entry},
    b:{time:120,price:stop},
    riskTarget:{time:120,price:targetPrice},
    style:{color:'#AEB6C2',opacity:1,width:1},
  };
  const metrics={riskReward:2,canCreateOrder:true,sizing:{
    requestedLots:0.17,actualRisk:142.35,actualRiskPercent:0.5}};
  return <main style={{padding:16,background:'#25292E',minHeight:'100vh'}}>
    <div style={{display:'flex',gap:8,marginBottom:12}}>
      <button type="button" onClick={()=>setSide('long')} aria-label="Long drawing">Long</button>
      <button type="button" onClick={()=>setSide('short')} aria-label="Short drawing">Short</button>
      <button type="button" onClick={()=>setSelected(x=>!x)} aria-label="Toggle selection">Select</button>
      <button type="button" onClick={()=>setTheme(x=>x==='light'?'dark':'light')} aria-label="Toggle theme">Theme</button>
      <button type="button" onClick={()=>setNarrow(x=>!x)} aria-label="Toggle narrow chart">Narrow</button>
    </div>
    <svg data-testid="risk-chart-fixture" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      style={{backgroundColor:theme==='light'?'#FAFBFC':'#09090B'}}>
      <defs><pattern id="risk-grid" width="70" height="65" patternUnits="userSpaceOnUse">
        <path d="M70 0H0V65" fill="none" stroke={theme==='light'?'#E8EDF3':'#202228'} strokeWidth="1" />
      </pattern></defs>
      <rect x="0" y="0" width={width} height={height} fill="url(#risk-grid)"/>
      <RiskPositionDrawing drawing={drawing} a={a} b={b} target={target}
        selected={selected} interactive={true} effectiveLocked={false}
        common={{className:'pointer-events-auto cursor-move',onPointerDown:()=>setSelected(true)}}
        onStartHandle={(_event,_id,handle)=>setLastDrag(handle)}
        size={{width,height}} riskMetrics={metrics}
        instrument={{symbol:'BTCUSD',priceDecimals:2}} chartTheme={theme}/>
    </svg>
    <output data-testid="last-handle">{lastDrag}</output>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
