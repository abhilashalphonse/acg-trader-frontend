import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info, Minus, Plus, Star, Check, SlidersHorizontal, Crosshair, AlertCircle } from 'lucide-react';
import './OrderTicketV4Preview.css';

// This component is an isolated, synthetic-data design preview. It deliberately
// imports no auth, market-data, orders, account APIs, sockets, or trade handlers.
const QUOTES = Object.freeze({ bid: 83001.02, ask: 83020.98, symbol: 'BTC/USD', tick: 0.01, minLots: 0.01, step: 0.01, leverage: 50, contractSize: 1 });
const DEMO_ACCOUNT = Object.freeze({ balance: 10000, equity: 10000, currency: 'USD', commissionPerLot: 0 });
const RR_PRESETS = [1, 1.5, 2, 3];
const LOT_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5];
const RISK_PRESETS = [0.25, 0.5, 1, 2];
const isFinitePositive = n => Number.isFinite(Number(n)) && Number(n) > 0;
const num = (n, places = 2) => Number.isFinite(n) ? Number(n).toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places }) : '—';
const usd = n => Number.isFinite(n) ? (n < 0 ? '−' : '') + '$' + num(Math.abs(n)) : '—';
const bounded = (n, min, max) => Math.min(max, Math.max(min, n));
const toLots = n => Number.isFinite(n) && n > 0 ? Math.max(0, Math.floor((n + 1e-9) / QUOTES.step) * QUOTES.step) : 0;

function Tip({ text }) { return <span className="v4-tip" title={text} aria-label={text}><Info size={12}/></span>; }
function Pick({ active, onClick, children, disabled, title }) {
  return <button type="button" className={'v4-pick' + (active ? ' is-on' : '')} onClick={onClick} disabled={disabled} title={title} aria-pressed={active}>{children}</button>;
}
function Stat({ label, value, detail }) {
  return <div className="v4-stat"><div className="v4-label">{label}</div><strong className="v4-stat-value">{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}
function NumericInput({ value, onChange, step = 1, min = 0, max = Infinity, label, places = 2, suffix }) {
  const valueNumber = Number(value);
  const applyDelta = delta => { const next = bounded((Number.isFinite(valueNumber) ? valueNumber : 0) + delta, min, max); onChange(Number(next.toFixed(8))); };
  return <div className="v4-number">
    <button type="button" aria-label={'Decrease ' + label} onClick={() => applyDelta(-step)}><Minus size={14}/></button>
    <input aria-label={label} type="number" min={min} max={Number.isFinite(max) ? max : undefined} step="any" value={Number.isFinite(value) ? value : ''} onChange={e => { if (e.target.value === '') { onChange(NaN); return; } onChange(Number(e.target.value)); }} />
    {suffix && <span className="v4-number-unit">{suffix}</span>}
    <button type="button" aria-label={'Increase ' + label} onClick={() => applyDelta(step)}><Plus size={14}/></button>
  </div>;
}
function Exit({ type, on, toggle, price, setPrice, entry, side, lots, riskMode }) {
  const isStop = type === 'sl';
  const distance = Number.isFinite(price) ? Math.abs(price - entry) : NaN;
  const outcome = on && Number.isFinite(distance) ? distance * lots * QUOTES.contractSize : NaN;
  const [unit, setUnit] = useState('ticks');
  const distanceTicks = Number.isFinite(distance) ? Math.round(distance / QUOTES.tick) : NaN;
  const moveDistance = next => {
    if (!isFinitePositive(next)) return;
    const d = Number(next) * (unit === 'ticks' ? QUOTES.tick : 1);
    setPrice(Number((entry + (isStop ? (side === 'buy' ? -d : d) : (side === 'buy' ? d : -d))).toFixed(2)));
  };
  const meaningful = isStop ? 'Projected loss at stop (not guaranteed)' : 'Projected profit at target (not guaranteed)';
  return <div className={'v4-exit' + (on ? ' is-enabled' : '')}>
    <div className="v4-exit-top"><button className={'v4-switch' + (on ? ' is-on' : '')} type="button" role="switch" aria-checked={on} aria-label={isStop ? 'Enable stop loss' : 'Enable take profit'} onClick={toggle}><span/></button><strong>{isStop ? 'Stop Loss' : 'Take Profit'}</strong><Tip text={meaningful}/></div>
    <label className="v4-field-label">Price</label>
    <NumericInput value={price} onChange={setPrice} step={5} min={1} places={2} label={isStop ? 'Stop loss price' : 'Take profit price'} />
    <label className="v4-field-label">Distance</label>
    <div className="v4-distance">
      <input aria-label={isStop ? 'Stop loss distance' : 'Take profit distance'} type="number" min="0" step="any" disabled={!on} value={on && Number.isFinite(distance) ? (unit === 'ticks' ? distanceTicks : Number(distance.toFixed(2))) : ''} onChange={e => moveDistance(Number(e.target.value))}/>
      <select aria-label={isStop ? 'Stop loss distance unit' : 'Take profit distance unit'} value={unit} onChange={e => setUnit(e.target.value)}><option value="ticks">Ticks</option><option value="price">Price Δ</option></select>
    </div>
    <div className="v4-projection"><span>{isStop ? 'Est. loss' : 'Est. profit'}</span><strong title={meaningful}>{on ? usd(isStop ? -outcome : outcome) : '—'}</strong></div>
    <div className="v4-projection v4-mini"><span>Account impact</span><span>{on && Number.isFinite(outcome) ? num(outcome / DEMO_ACCOUNT.equity * 100) + '%' : '—'}</span></div>
    {riskMode && isStop && !on && <div className="v4-warning-inline">Enable SL to calculate risk size</div>}
  </div>;
}
function Ticket({ initialMode = 'market', compact = false, label }) {
  const [mode, setMode] = useState(initialMode);
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('limit');
  const [sizing, setSizing] = useState('lots');
  const [lotsInput, setLotsInput] = useState(0.12);
  const [riskUSD, setRiskUSD] = useState(100);
  const [riskPercent, setRiskPercent] = useState(1);
  const [entryPrice, setEntryPrice] = useState(83150);
  const [slOn, setSlOn] = useState(true);
  const [tpOn, setTpOn] = useState(true);
  const [stopPrice, setStopPrice] = useState(82220.98);
  const [tpPrice, setTpPrice] = useState(84620.98);
  const [advanced, setAdvanced] = useState(true);
  const [expiry, setExpiry] = useState('GTC');
  const [expiryDate, setExpiryDate] = useState('');
  const [limitPrice, setLimitPrice] = useState(83145);
  const [toast, setToast] = useState('');
  const entry = mode === 'pending' ? entryPrice : (side === 'buy' ? QUOTES.ask : QUOTES.bid);
  const slDistance = Number.isFinite(stopPrice) ? Math.abs(entry - stopPrice) : NaN;
  const tpDistance = Number.isFinite(tpPrice) ? Math.abs(tpPrice - entry) : NaN;
  const targetRisk = sizing === 'usd' ? riskUSD : DEMO_ACCOUNT.equity * riskPercent / 100;
  const derivedLots = slOn && isFinitePositive(slDistance) && isFinitePositive(targetRisk) ? toLots(targetRisk / (slDistance * QUOTES.contractSize)) : NaN;
  const lots = sizing === 'lots' ? lotsInput : derivedLots;
  const validLots = isFinitePositive(lots) && lots >= QUOTES.minLots;
  const spread = QUOTES.ask - QUOTES.bid;
  const referencePrice = mode === 'pending' && orderType === 'stop-limit' ? limitPrice : entry;
  const notional = validLots && isFinitePositive(referencePrice) ? lots * referencePrice * QUOTES.contractSize : NaN;
  const margin = Number.isFinite(notional) ? notional / QUOTES.leverage : NaN;
  const freeAfter = Number.isFinite(margin) ? DEMO_ACCOUNT.equity - margin : NaN;
  const spreadCost = validLots ? spread * lots * QUOTES.contractSize : NaN;
  const estimatedCommission = validLots ? lots * DEMO_ACCOUNT.commissionPerLot : NaN;
  const stopLoss = slOn && validLots && Number.isFinite(slDistance) ? slDistance * lots * QUOTES.contractSize : NaN;
  const reward = tpOn && validLots && Number.isFinite(tpDistance) ? tpDistance * lots * QUOTES.contractSize : NaN;
  const ratio = slOn && tpOn && isFinitePositive(slDistance) ? tpDistance / slDistance : NaN;
  const stopDirectionOkay = side === 'buy' ? stopPrice < entry : stopPrice > entry;
  const tpDirectionOkay = side === 'buy' ? tpPrice > entry : tpPrice < entry;
  const estimatedImpact = validLots ? (notional / DEMO_ACCOUNT.equity) * 100 : NaN;
  const reasons = [
    !validLots && 'Select a valid position size',
    sizing !== 'lots' && !slOn && 'Stop Loss required to calculate risk-based size',
    slOn && !stopDirectionOkay && 'Stop Loss must be on the loss side of entry',
    tpOn && !tpDirectionOkay && 'Take Profit must be on the profit side of entry',
    Number.isFinite(freeAfter) && freeAfter < 0 && 'Insufficient demo margin',
    mode === 'pending' && orderType === 'stop-limit' && !isFinitePositive(limitPrice) && 'Enter a valid stop-limit price',
    mode === 'pending' && expiry === 'SPECIFIED' && !expiryDate && 'Select an expiry date/time',
  ].filter(Boolean);
  const chooseSide = next => {
    const newEntry = mode === 'pending' ? entryPrice : (next === 'buy' ? QUOTES.ask : QUOTES.bid);
    const distSL = isFinitePositive(slDistance) ? slDistance : 800;
    const distTP = isFinitePositive(tpDistance) ? tpDistance : 1600;
    setSide(next);
    setStopPrice(Number((newEntry + (next === 'buy' ? -distSL : distSL)).toFixed(2)));
    setTpPrice(Number((newEntry + (next === 'buy' ? distTP : -distTP)).toFixed(2)));
  };
  const applyRR = multiplier => {
    if (!slOn || !isFinitePositive(slDistance)) { setToast('Enable Stop Loss to set a risk/reward ratio.'); return; }
    setTpOn(true);
    const p = entry + (side === 'buy' ? 1 : -1) * slDistance * multiplier;
    setTpPrice(Number(p.toFixed(2)));
  };
  const commitPreview = action => setToast(action + ' is a visual demo only. No order was sent.');
  const themeSize = compact ? ' compact' : '';
  return <section className={'v4-ticket' + themeSize} aria-label={(label || 'ACG') + ' demo execution ticket'}>
    <header className="v4-heading"><div className="v4-coin" aria-hidden="true">₿</div><div className="v4-headnames"><strong>BTC/USD <ChevronDown size={15}/></strong><small>Bitcoin / US Dollar</small></div><button className="v4-fav" type="button" aria-label="Add to favorites" onClick={() => setToast('Favorite selection is not saved in demo.')}><Star size={19}/></button></header>
    <div className="v4-quote">
      <Stat label="Bid" value={num(QUOTES.bid)}/><Stat label="Ask" value={num(QUOTES.ask)}/>
      <div className="v4-stat"><div className="v4-label">Spread</div><strong className="v4-stat-value">{num(spread)}</strong><small>Indicative</small></div>
    </div>
    <div className="v4-section v4-modes"><div className="v4-segment v4-mainmodes"><Pick active={mode === 'market'} onClick={() => setMode('market')}>Market</Pick><Pick active={mode === 'pending'} onClick={() => setMode('pending')}>Pending</Pick></div><p>{mode === 'market' ? 'Execute at current quote · demo' : 'Prepare an order at your chosen entry price'}</p></div>
    {mode === 'pending' && <div className="v4-section v4-pending">
      <div className="v4-section-head"><strong>Order type</strong><div className="v4-segment"><Pick active={orderType === 'limit'} onClick={() => setOrderType('limit')}>Limit</Pick><Pick active={orderType === 'stop'} onClick={() => setOrderType('stop')}>Stop</Pick><Pick active={orderType === 'stop-limit'} onClick={() => setOrderType('stop-limit')}>Stop Limit</Pick></div></div>
      <label className="v4-field-label">Entry price</label><NumericInput label="Pending entry price" value={entryPrice} onChange={setEntryPrice} step={5} min={1}/>
      {orderType === 'stop-limit' && <><label className="v4-field-label">Limit price</label><NumericInput label="Stop-limit limit price" value={limitPrice} onChange={setLimitPrice} step={5} min={1}/></>}
    </div>}
    <div className="v4-section v4-sizing">
      <div className="v4-section-head"><strong>Position size <Tip text="Choose volume or target risk. Risk modes derive volume from your stop distance."/></strong><div className="v4-segment"><Pick active={sizing === 'lots'} onClick={() => setSizing('lots')}>Lots</Pick><Pick active={sizing === 'usd'} onClick={() => setSizing('usd')}>Risk $</Pick><Pick active={sizing === 'percent'} onClick={() => setSizing('percent')}>Risk %</Pick></div></div>
      {sizing === 'lots'
        ? <><NumericInput label="Position size in lots" value={lotsInput} onChange={setLotsInput} min={0.01} step={0.01} suffix="lots"/><div className="v4-presets">{LOT_PRESETS.map(v => <Pick key={v} active={Math.abs(lotsInput-v)<0.001} onClick={()=>setLotsInput(v)}>{num(v)}</Pick>)}</div></>
        : <><NumericInput label={sizing === 'usd' ? 'Maximum risk in USD' : 'Account risk percent'} value={sizing === 'usd' ? riskUSD : riskPercent} onChange={sizing === 'usd' ? setRiskUSD : setRiskPercent} min={0.01} step={sizing === 'usd'?10:0.25} suffix={sizing === 'usd'?'USD':'%'}/><div className="v4-presets">{RISK_PRESETS.map(v => <Pick key={v} active={sizing === 'percent' ? Math.abs(riskPercent-v)<0.001 : Math.abs(riskUSD - DEMO_ACCOUNT.equity*v/100) <0.01} onClick={()=>{setRiskPercent(v);setRiskUSD(DEMO_ACCOUNT.equity*v/100);}}>{v}%</Pick>)}</div><div className="v4-calc-size"><span>{slOn ? 'Calculated volume' : 'Enable SL to calculate volume'}</span><strong>{validLots ? num(lots) + ' lots' : '—'}</strong></div></>}
      <div className="v4-summary"><div><span>Notional value</span><strong>{usd(notional)}</strong></div><div><span>Margin required</span><strong>{usd(margin)}</strong></div><div><span>Free after</span><strong>{usd(freeAfter)}</strong></div></div>
    </div>
    <div className="v4-section">
      <div className="v4-section-head"><strong>Exits / Protection <Tip text="Stop/target values update risk and volume; a stop does not guarantee final fill."/></strong><button type="button" className="v4-chartlink" onClick={() => setToast('Chart-linked SL/TP comes with live-terminal integration after design approval.')}><Crosshair size={13}/> Chart</button></div>
      <div className="v4-exit-grid">
        <Exit type="sl" on={slOn} toggle={()=>setSlOn(v=>!v)} price={stopPrice} setPrice={setStopPrice} entry={entry} lots={validLots?lots:NaN} side={side} riskMode={sizing!=='lots'}/>
        <Exit type="tp" on={tpOn} toggle={()=>setTpOn(v=>!v)} price={tpPrice} setPrice={setTpPrice} entry={entry} lots={validLots?lots:NaN} side={side} riskMode={false}/>
      </div>
      <div className="v4-rr"><div className="v4-section-head"><strong>Risk / Reward <Tip text="Presets calculate TP from the stop distance and order direction."/></strong><div className="v4-small-ratio">R:R {num(ratio, 1)}</div></div><div className="v4-presets v4-rr-presets">{RR_PRESETS.map(v => <Pick key={v} active={Number.isFinite(ratio) && Math.abs(ratio-v)<0.01} onClick={()=>applyRR(v)}>1:{v}</Pick>)}</div><div className="v4-rr-stats"><Stat label="Risk" value={usd(stopLoss)}/><Stat label="Reward" value={usd(reward)}/><Stat label="R:R" value={Number.isFinite(ratio)?'1:'+num(ratio,1):'—'}/></div></div>
    </div>
    <div className="v4-section v4-advanced"><button type="button" className="v4-expand" onClick={()=>setAdvanced(v=>!v)} aria-expanded={advanced}><strong>Advanced</strong>{advanced?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>{advanced && <div className="v4-advanced-content">
      {mode==='pending' && <div className="v4-info-row"><span>Time in force</span><select value={expiry} onChange={e=>setExpiry(e.target.value)} aria-label="Time in force"><option value="GTC">GTC</option><option value="TODAY">Today</option><option value="SPECIFIED">Custom</option></select></div>}
      {mode==='pending' && expiry==='SPECIFIED' && <div className="v4-info-row"><span>Expiry</span><input type="datetime-local" aria-label="Order expiry" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)}/></div>}
      <div className="v4-info-row"><span>Instrument leverage</span><strong>1:{QUOTES.leverage} <Tip text="Read-only sample leverage. Actual instrument leverage is set by ACG Trader rules."/></strong></div>
      <div className="v4-info-row"><span>Indicative spread value</span><strong>{usd(spreadCost)}</strong></div>
      <div className="v4-info-row"><span>Est. commission</span><strong>{usd(estimatedCommission)}</strong></div>
      <p className="v4-advanced-note">Spread is already reflected by the Buy/Ask and Sell/Bid quotes. It is not added again to margin or projected P&amp;L.</p>
    </div>}</div>
    {reasons.length>0 && <div className="v4-notice" role="status"><AlertCircle size={14}/><span>{reasons[0]}</span></div>}
    <div className="v4-sticky"><div className="v4-footer-stats"><Stat label="Margin required" value={usd(margin)}/><Stat label="Free after" value={usd(freeAfter)}/></div>
      <div className="v4-actions"><button className="v4-sell" type="button" onClick={()=>{chooseSide('sell');commitPreview('Sell');}}><span>{mode==='market'?'SELL':'SELL '+orderType.toUpperCase().replace('-',' ')}</span><strong>{num(mode==='market'?QUOTES.bid:entryPrice)}</strong></button><button className="v4-buy" type="button" onClick={()=>{chooseSide('buy');commitPreview('Buy');}}><span>{mode==='market'?'BUY':'BUY '+orderType.toUpperCase().replace('-',' ')}</span><strong>{num(mode==='market'?QUOTES.ask:entryPrice)}</strong></button></div>
      <div className="v4-preview-footer"><span><Check size={11}/> DEMO / NO EXECUTION</span><span>Illustrative quotes · {side.toUpperCase()} selected</span></div>
    </div>
    {toast && <div className="v4-toast" role="status" onClick={()=>setToast('')}><span>{toast}</span><button type="button" onClick={()=>setToast('')} aria-label="Dismiss notification">×</button></div>}
  </section>;
}
export default function OrderTicketV4Preview() {
 const [width,setWidth] = useState('reference');
 const [view,setView] = useState('compare');
 const [revision,setRevision] = useState(0);
 const narrow = width==='compact';
 return <main className="v4-page">
   <div className="v4-topbar"><div><span className="v4-eyebrow">ACG TRADER · DESIGN STUDIO</span><h1>Execution V4 <small>Preview only</small></h1><p>Metallic black · Silver selections · Buy/Sell color only</p></div><div className="v4-toolbar"><div className="v4-segment"><Pick active={width==='reference'} onClick={()=>setWidth('reference')}>Reference</Pick><Pick active={width==='compact'} onClick={()=>setWidth('compact')}>330px dock</Pick></div><div className="v4-segment"><Pick active={view==='compare'} onClick={()=>setView('compare')}>Compare</Pick><Pick active={view==='market'} onClick={()=>setView('market')}>Market</Pick><Pick active={view==='pending'} onClick={()=>setView('pending')}>Pending</Pick></div><button type="button" className="v4-reset" onClick={()=>setRevision(n=>n+1)}>Reset demo</button></div></div>
   <div className={'v4-demo-grid '+(narrow?' is-compact ':'')+(view==='compare'?' is-compare':' is-single')} key={revision}>
    {(view==='compare'||view==='market') && <div className="v4-display"><div className="v4-panel-label">MARKET MODE</div><Ticket initialMode="market" compact={narrow} label="Market"/></div>}
    {(view==='compare'||view==='pending') && <div className="v4-display"><div className="v4-panel-label">PENDING MODE</div><Ticket initialMode="pending" compact={narrow} label="Pending"/></div>}
   </div>
   <footer className="v4-page-note"><SlidersHorizontal size={14}/> Review the selection behavior, spacing, and responsiveness. All figures are local demo calculations; no account, authentication session, quote feed, or execution APIs are used.</footer>
 </main>;
}
