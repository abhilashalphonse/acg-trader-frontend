import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

const positions = [
  { id: 1, flags: '🇦🇺 🇨🇦', symbol: 'AUD/CAD', side: 'BUY', volume: '0.01', entry: '0.99342', pnl: '+$0.18', tp: '0.99500', sl: '0.99000' },
  { id: 2, flags: '🇪🇺 🇺🇸', symbol: 'EUR/USD', side: 'SELL', volume: '0.02', entry: '1.08460', pnl: '+$0.78', tp: '1.08000', sl: '1.09000' },
];

export default function PositionsPanel() {
  const [tab, setTab] = useState('positions');
  return (
    <section className="v2-positions-panel">
      <div className="v2-position-tabs">
        <div className="v2-tab-group">
          <button className={tab==='positions'?'active':''} onClick={()=>setTab('positions')}>Positions <i>2</i></button>
          <button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}>Orders <i>1</i></button>
          <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}>History</button>
        </div>
        <button className="v2-close-all">Close All</button>
      </div>

      <div className="v2-position-list">
        {positions.map((p, index) => (
          <React.Fragment key={p.id}>
            <div className="v2-position-row">
              <div className="v2-position-identity">
                <span className="v2-flags">{p.flags}</span>
                <div><strong>{p.symbol}</strong><small>{p.volume} · {p.entry}</small></div>
                <span className={`v2-side ${p.side.toLowerCase()}`}>{p.side}</span>
              </div>
              <div className="v2-position-metric"><span>P&amp;L</span><b className="positive">{p.pnl}</b></div>
              <div className="v2-position-metric"><span>TP</span><b>{p.tp}</b></div>
              <div className="v2-position-metric"><span>SL</span><b>{p.sl}</b></div>
              <button className="v2-position-more" aria-label="Position actions"><MoreHorizontal size={18}/></button>
            </div>
            {index < positions.length - 1 && <div className="v2-position-divider"/>}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
