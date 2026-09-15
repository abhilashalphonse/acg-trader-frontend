import React from 'react';
import { ChevronDown, Star } from 'lucide-react';

export default function InstrumentHeader({ market }) {
  const symbol = market.symbol === 'AUDCAD' ? 'AUD/CAD' : market.symbol;
  const positive = !String(market.change || '').startsWith('-');
  return (
    <div className="v2-instrument-header">
      <div className="v2-instrument-left">
        <button className="v2-symbol-button">{symbol}<ChevronDown size={15}/></button>
        <span>Australian Dollar / Canadian Dollar</span>
      </div>
      <div className="v2-instrument-price">
        <strong>{market.bid}</strong>
        <span className={positive ? 'positive' : 'negative'}>{positive ? '+0.00052 (+0.05%)' : market.change}</span>
      </div>
      <div className="v2-instrument-stats">
        <div><span>High</span><b>0.99421</b></div>
        <div><span>Low</span><b>0.99283</b></div>
        <div><span>Vol</span><b>12.4K</b></div>
      </div>
      <button className="v2-favorite" aria-label="Favorite"><Star size={17}/></button>
    </div>
  );
}
