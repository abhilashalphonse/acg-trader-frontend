import React, { useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';

export default function ExecutionPanel({ market }) {
  const [lots, setLots] = useState(0.10);
  const decrease = () => setLots(v => Math.max(0.01, +(v - 0.01).toFixed(2)));
  const increase = () => setLots(v => +(v + 0.01).toFixed(2));

  return (
    <section className="v2-execution-panel">
      <div className="v2-execution-grid">
        <button className="v2-exec-button sell">
          <span>SELL</span>
          <strong>{market.bid}</strong>
        </button>

        <div className="v2-lot-selector">
          <button className="v2-lot-value">{lots.toFixed(2)} <ChevronDown size={13}/></button>
          <span>Lots</span>
          <div className="v2-lot-controls">
            <button onClick={decrease} aria-label="Decrease lot size"><Minus size={14}/></button>
            <button onClick={increase} aria-label="Increase lot size"><Plus size={14}/></button>
          </div>
        </div>

        <button className="v2-exec-button buy">
          <span>BUY</span>
          <strong>{market.ask}</strong>
        </button>
      </div>

      <div className="v2-execution-stats">
        <div><span>Spread</span><b>0.5 pips</b></div>
        <i/>
        <div><span>Commission</span><b>$0</b></div>
        <i/>
        <div><span>Leverage</span><b>1:100</b></div>
        <div className="margin"><span>Margin Required</span><b>$99.37</b></div>
      </div>
    </section>
  );
}
