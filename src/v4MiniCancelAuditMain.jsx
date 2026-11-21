import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import V4ChartOrderLayer from './components/trading-v2/v4/V4ChartOrderLayer.jsx';
import './index.css';

// Isolated chart-order presentation fixture; never loads TradingProvider,
// credentials, account APIs or a trading backend.
const direct=new URLSearchParams(location.search).get('direct')==='1';
const order={
  id:'mini-cancel-fixture-1',accountId:'mini-chart-fixture',symbol:'EURUSD',
  status:'PENDING',side:'SELL',orderType:'limit',volume:0.10,entry:1.12000,
};
const coordinateApi={
  priceToY:value=>220+(Number(value)-1.12)*50000,
  yToPrice:y=>1.12+(Number(y)-220)/50000,
};
function Fixture(){
  const [orders,setOrders]=useState([order]);
  const [cancellations,setCancellations]=useState(0);
  return <main style={{position:'relative',width:960,height:440,background:'#09090b',color:'white'}}>
    <output data-mini-cancel-count>{cancellations}</output>
    <V4ChartOrderLayer
      directPendingCancel={direct}
      accountId="mini-chart-fixture" symbol="EURUSD"
      positions={[]} pendingOrders={orders}
      coordinateApi={coordinateApi} height={440}
      instrument={{symbol:'EURUSD',tickSize:0.00001,contractSize:100000}}
      formatPrice={value=>Number(value).toFixed(5)}
      onCancelPending={async id=>{
        if(id!=='mini-cancel-fixture-1')throw Error('Unexpected fixture order');
        setCancellations(n=>n+1);
        setOrders([]);
        return true;
      }}/>
  </main>;
}
createRoot(document.getElementById('mini-cancel-fixture')).render(<Fixture/>);
