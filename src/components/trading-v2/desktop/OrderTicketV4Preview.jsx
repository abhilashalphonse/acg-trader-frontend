import React, { useState } from 'react';
import { Bitcoin, ChevronDown, ChevronUp, CheckCircle2, Circle, Ellipsis, X, Minus, Plus, ArrowRight, Info, RotateCcw } from 'lucide-react';
import './OrderTicketV4Preview.css';

// Isolated, synthetic-data design preview; no auth, feeds, orders, sockets or APIs.
const DEMO = Object.freeze({
  symbol: 'BTC/USD', name: 'Bitcoin / US Dollar',
  bid: 83001.02, ask: 83020.98, tick: 1, contractSize: 1,
  lotStep: 0.01, minLots: 0.01, leverage: 10,
  balance: 100000, equity: 100000, commissionPerLot: 0,
});
const MODES = [
  { id: 'lots', label: 'Lots', min: 0.01, max: 1, step: 0.01, marks: ['0.01', '0.25', '0.50', '0.75', '1.00'] },
  { id: 'margin', label: 'Margin $', min: 0, max: 10000, step: 50, marks: ['$0', '$2.5k', '$5k', '$7.5k', '$10k'] },
  { id: 'riskPercent', label: 'Risk %', min: 0, max: 2, step: 0.01, marks: ['0%', '0.5%', '1%', '1.5%', '2%'] },
  { id: 'riskUSD', label: 'Risk USD', min: 0, max: 500, step: 10, marks: ['$0', '$125', '$250', '$375', '$500'] },
];
const EXIT_UNITS = [
  { id: 'price', label: 'Price' },
  { id: 'ticks', label: 'Ticks' },
  { id: 'percent', label: '% Price' },
  { id: 'usd', label: 'USD' },
  { id: 'balance', label: '% Balance' },
];
const fmt = (n, d = 2) => Number.isFinite(n) ? Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const money = n => Number.isFinite(n) ? '$' + fmt(n) : '—';
const floorLots = n => Number.isFinite(n) && n >= DEMO.minLots
  ? Math.floor((n + 1e-9) / DEMO.lotStep) * DEMO.lotStep : 0;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const isRiskSizing = mode => mode === 'riskPercent' || mode === 'riskUSD';
const riskSide = (side, kind) => side === 'buy'
  ? (kind === 'sl' ? -1 : 1) : (kind === 'sl' ? 1 : -1);

function Capsule({ options, value, onChange, className = '', ariaLabel }) {
  return <div className={'v4-capsule ' + className} role="group" aria-label={ariaLabel}>
    {options.map(o => <button key={o.id} type="button" className={'v4-capsule-button' + (o.id === value ? ' selected' : '')}
      aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>)}
  </div>;
}
function CloseableNumber({ value, onCommit, label, maxChars = 12 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const start = () => { setDraft(String(Number.isFinite(value) ? Number(value.toFixed(4)) : '')); setEditing(true); };
  const finish = () => {
    if (draft.trim() !== '' && Number.isFinite(Number(draft)) && Number(draft) >= 0) onCommit(Number(draft));
    setEditing(false);
  };
  return <div className="v4-hero-input">
    {editing
      ? <input aria-label={label} autoFocus inputMode="decimal" type="text" value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={finish} onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setDraft(''); setEditing(false); }
        }} />
      : <button type="button" aria-label={'Edit ' + label} title="Click to edit" onClick={start} className="v4-hero-value"
        data-maxchars={maxChars}>{Number.isFinite(value) ? fmt(value) : '—'}</button>}
  </div>;
}
function ExitEditor({ kind, enabled, onToggle, unit, onUnit, price, entry, lots, onPrice, side, financialInputLocked }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const label = kind === 'sl' ? 'Stop Loss' : 'Take Profit';
  const d = Math.abs(entry - price);
  const valid = enabled && Number.isFinite(price) && price > 0 && (price - entry) * riskSide(side, kind) > 0;
  const financial = Number.isFinite(lots) && lots >= DEMO.minLots ? d * lots * DEMO.contractSize : NaN;
  const value = unit === 'price' ? price : unit === 'ticks' ? d / DEMO.tick
    : unit === 'percent' ? d / entry * 100
    : unit === 'usd' ? financial : financial / DEMO.equity * 100;
  const labelFor = u => u === 'usd' ? (kind === 'sl' ? 'Risk USD' : 'Profit USD')
    : u === 'balance' ? (kind === 'sl' ? 'Risk % Bal.' : 'Profit % Bal.')
      : EXIT_UNITS.find(x => x.id === u)?.label || u;
  const convert = raw => {
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n) || n < 0) return;
    if (financialInputLocked && kind === 'sl' && (unit === 'usd' || unit === 'balance')) return;
    const distance = unit === 'ticks' ? n * DEMO.tick
      : unit === 'percent' ? n * entry / 100
      : unit === 'usd' ? n / (lots * DEMO.contractSize)
      : unit === 'balance' ? n * DEMO.equity / (100 * lots * DEMO.contractSize) : 0;
    const newPrice = unit === 'price' ? n : entry + riskSide(side, kind) * distance;
    if (Number.isFinite(newPrice) && newPrice > 0) onPrice(Number(newPrice.toFixed(2)));
  };
  const shown = Number.isFinite(value) ? String(Number(value.toFixed(unit === 'ticks' ? 0 : (unit === 'percent' || unit === 'balance') ? 4 : 2))) : '';
  return <div className={'v4-exit-card' + (enabled ? '' : ' is-disabled')}>
    <div className="v4-exit-heading">
      <strong>{label}</strong>
      <button type="button" className="v4-exit-toggle" onClick={onToggle} aria-label={(enabled ? 'Disable ' : 'Enable ') + label}
        aria-pressed={enabled}>
        {enabled ? <CheckCircle2 size={20} fill="#F2F2F4" color="#F2F2F4" className="v4-check-on" /> : <Circle size={20} color="#898990"/>}
        <span>{enabled ? 'Enabled' : 'Disabled'}</span>
      </button>
    </div>
    {enabled && <>
      <div className="v4-exit-controls">
        <input type="text" inputMode="decimal" aria-label={label + ' value'} value={editing ? draft : shown}
          onFocus={() => { setDraft(shown); setEditing(true); }}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (editing) convert(draft); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setEditing(false); e.currentTarget.blur(); } }}
          disabled={financialInputLocked && kind === 'sl' && (unit === 'usd' || unit === 'balance')}
        />
        <div className="v4-select-wrap">
          <select aria-label={label + ' input unit'} value={unit} onChange={e => { onUnit(e.target.value); setEditing(false); }}>
            {EXIT_UNITS.map(o => <option key={o.id} value={o.id}
              disabled={kind === 'sl' && financialInputLocked && (o.id === 'usd' || o.id === 'balance')}>
              {labelFor(o.id)}
            </option>)}
          </select>
          <ChevronDown size={15}/>
        </div>
      </div>
      <div className="v4-exit-result">
        <span>Price {fmt(price)}</span>
        <strong>{valid ? money(financial) + ' · ' + fmt(financial / DEMO.equity * 100) + '%' : '—'}</strong>
      </div>
      {!valid && <div className="v4-validation">Set a valid {label.toLowerCase()} on the {kind === 'sl' ? 'loss' : 'profit'} side.</div>}
    </>}
  </div>;
}
function Ticket({ initialMode = 'market', compact = false }) {
  const [mode, setMode] = useState(initialMode);
  const [pendingType, setPendingType] = useState('limit');
  const [pendingEntry, setPendingEntry] = useState(82950);
  const [stopLimitPrice, setStopLimitPrice] = useState(82945);
  const [side, setSide] = useState('buy');
  const [sizeMode, setSizeMode] = useState('lots');
  const [lotTarget, setLotTarget] = useState(0.10);
  const [marginTarget, setMarginTarget] = useState(830.21);
  const [riskPercentTarget, setRiskPercentTarget] = useState(0.08);
  const [riskUSDTarget, setRiskUSDTarget] = useState(80);
  const [slEnabled, setSlEnabled] = useState(true);
  const [tpEnabled, setTpEnabled] = useState(true);
  const [slPrice, setSlPrice] = useState(82220.98);
  const [tpPrice, setTpPrice] = useState(84620.98);
  const [slUnit, setSlUnit] = useState('ticks');
  const [tpUnit, setTpUnit] = useState('ticks');
  const [advanced, setAdvanced] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const [expiry, setExpiry] = useState('GTC');
  const [expiryDate, setExpiryDate] = useState('');
  const [notice, setNotice] = useState('');
  const entry = mode === 'market' ? (side === 'buy' ? DEMO.ask : DEMO.bid) : pendingEntry;
  const slDistance = slEnabled && (slPrice - entry) * riskSide(side, 'sl') > 0 ? Math.abs(entry - slPrice) : NaN;
  const tpDistance = tpEnabled && (tpPrice - entry) * riskSide(side, 'tp') > 0 ? Math.abs(tpPrice - entry) : NaN;
  const lots = floorLots(sizeMode === 'lots' ? lotTarget
    : sizeMode === 'margin' ? marginTarget * DEMO.leverage / (entry * DEMO.contractSize)
      : Number.isFinite(slDistance) && slDistance > 0
        ? (sizeMode === 'riskPercent' ? DEMO.equity * riskPercentTarget / 100 : riskUSDTarget)
          / (slDistance * DEMO.contractSize) : NaN);
  const validLots = lots >= DEMO.minLots;
  const exposure = validLots ? lots * entry * DEMO.contractSize : NaN;
  const margin = Number.isFinite(exposure) ? exposure / DEMO.leverage : NaN;
  const freeAfter = Number.isFinite(margin) ? DEMO.equity - margin : NaN;
  const risk = slEnabled && validLots && Number.isFinite(slDistance) ? lots * slDistance * DEMO.contractSize : NaN;
  const reward = tpEnabled && validLots && Number.isFinite(tpDistance) ? lots * tpDistance * DEMO.contractSize : NaN;
  const rr = Number.isFinite(risk) && risk > 0 && Number.isFinite(reward) ? reward / risk : NaN;
  const value = sizeMode === 'lots' ? lotTarget : sizeMode === 'margin' ? marginTarget
    : sizeMode === 'riskPercent' ? riskPercentTarget : riskUSDTarget;
  const conf = MODES.find(x => x.id === sizeMode);
  const setValue = n => {
    if (!Number.isFinite(n) || n < 0) return;
    if (sizeMode === 'lots') setLotTarget(floorLots(clamp(n, DEMO.minLots, 100)) || DEMO.minLots);
    else if (sizeMode === 'margin') setMarginTarget(n);
    else if (sizeMode === 'riskPercent') setRiskPercentTarget(n);
    else setRiskUSDTarget(n);
  };
  const selectMode = m => {
    if (isRiskSizing(m) && !Number.isFinite(slDistance)) {
      setNotice('Set a valid Stop Loss before selecting a risk-based size.');
      return;
    }
    // Convert the CURRENT position before selecting the new input anchor.
    if (m === 'lots') setLotTarget(lots || DEMO.minLots);
    if (m === 'margin') setMarginTarget(Number.isFinite(margin) ? margin : 0);
    if (m === 'riskPercent') setRiskPercentTarget(Number.isFinite(risk) ? risk / DEMO.equity * 100 : 0);
    if (m === 'riskUSD') setRiskUSDTarget(Number.isFinite(risk) ? risk : 0);
    if (isRiskSizing(m) && (slUnit === 'usd' || slUnit === 'balance')) setSlUnit('ticks');
    setSizeMode(m);
    setNotice('');
  };
  const setExitUnit = (kind, u) => {
    if (kind === 'sl' && isRiskSizing(sizeMode) && (u === 'usd' || u === 'balance')) {
      setNotice('Use Price, Ticks or % Price for SL when position volume is risk-based.');
      return;
    }
    kind === 'sl' ? setSlUnit(u) : setTpUnit(u);
    setNotice('');
  };
  const selectSide = newSide => {
    const newEntry = mode === 'market' ? (newSide === 'buy' ? DEMO.ask : DEMO.bid) : pendingEntry;
    const distSL = Math.abs(slPrice - entry), distTP = Math.abs(tpPrice - entry);
    setSlPrice(Number((newEntry + riskSide(newSide, 'sl') * distSL).toFixed(2)));
    setTpPrice(Number((newEntry + riskSide(newSide, 'tp') * distTP).toFixed(2)));
    setSide(newSide);
    setNotice('Preview direction changed to ' + newSide.toUpperCase() + '. No order was sent.');
  };
  const changeOrderMode = newMode => {
    const newEntry = newMode === 'market' ? (side === 'buy' ? DEMO.ask : DEMO.bid) : pendingEntry;
    const dSL = Math.abs(slPrice - entry), dTP = Math.abs(tpPrice - entry);
    setSlPrice(Number((newEntry + riskSide(side, 'sl') * dSL).toFixed(2)));
    setTpPrice(Number((newEntry + riskSide(side, 'tp') * dTP).toFixed(2)));
    setMode(newMode);
    setNotice('');
  };
  const onPendingType = next => {
    const reference = side === 'buy' ? DEMO.ask : DEMO.bid;
    const p = (next === 'limit') ? reference + (side === 'buy' ? -70 : 70)
      : reference + (side === 'buy' ? 130 : -130);
    const dSL = Math.abs(slPrice - entry), dTP = Math.abs(tpPrice - entry);
    setPendingEntry(Number(p.toFixed(2)));
    setSlPrice(Number((p + riskSide(side, 'sl') * dSL).toFixed(2)));
    setTpPrice(Number((p + riskSide(side, 'tp') * dTP).toFixed(2)));
    setStopLimitPrice(Number((p + (side === 'buy' ? 5 : -5)).toFixed(2)));
    setPendingType(next);
  };
  const formatted = m => {
    if (!Number.isFinite(lots) || !validLots) return 'Set SL to calculate size';
    if (m === 'lots') return <>{fmt(lots)} lots <ArrowRight size={13}/> ~{money(exposure)} <span>({fmt(exposure / DEMO.balance * 100)}%)</span></>;
    if (m === 'margin') return <>{money(margin)} margin <ArrowRight size={13}/> {fmt(lots)} lots <span>({fmt(margin / DEMO.balance * 100)}% bal)</span></>;
    if (m === 'riskPercent') return <>{fmt(risk / DEMO.equity * 100)}% risk <ArrowRight size={13}/> {money(risk)} <span>({fmt(lots)} lots)</span></>;
    return <>{money(risk)} risk <ArrowRight size={13}/> {fmt(lots)} lots <span>({fmt(risk / DEMO.equity * 100)}%)</span></>;
  };
  const warnings = [
    !validLots && 'Volume is below the minimum lot step.',
    slEnabled && !Number.isFinite(slDistance) && 'Set SL on the loss side of the entry.',
    tpEnabled && !Number.isFinite(tpDistance) && 'Set TP on the profit side of the entry.',
    Number.isFinite(freeAfter) && freeAfter < 0 && 'Insufficient demo free margin.',
    mode === 'pending' && (!Number.isFinite(pendingEntry) || pendingEntry <= 0) && 'Enter a valid pending entry price.',
    mode === 'pending' && expiry === 'GTD' && !expiryDate && 'Select the pending order expiry.',
  ].filter(Boolean);
  const showButton = btnSide => {
    selectSide(btnSide);
    setNotice((btnSide === 'buy' ? 'BUY' : 'SELL') + ' preview only. No order was sent.');
  };
  if (closed) return <section className="v4-ticket v4-closed">
    <p>Execution panel closed in the preview.</p>
    <button type="button" onClick={() => setClosed(false)}>Reopen execution panel</button>
  </section>;
  return <section className={'v4-ticket v4-baseline' + (compact ? ' compact' : '')} aria-label="ACG Trader demo execution ticket">
    <div className="v4-ticket-body">
      <header className="v4-instrument">
        <div className="v4-coin"><Bitcoin size={24} strokeWidth={2.5}/></div>
        <div className="v4-symbol"><strong>{DEMO.symbol} <ChevronDown size={14}/></strong><span>{DEMO.name}</span></div>
        <div className="v4-head-actions">
          <button type="button" aria-label="Ticket configuration" title="Ticket configuration" onClick={() => setSettingsOpen(v => !v)}><Ellipsis size={20}/></button>
          <button type="button" aria-label="Close execution panel" title="Close execution panel" onClick={() => setClosed(true)}><X size={19}/></button>
        </div>
      </header>
      {settingsOpen && <div className="v4-settings">
        <div>Ticket configuration</div>
        <label><span>Expand Advanced</span><input type="checkbox" checked={advanced} onChange={e => setAdvanced(e.target.checked)}/></label>
        <span>Preview only · Nothing saved</span>
      </div>}
      <div className="v4-session"><span><i/>Market Open</span><span>24/7 session (demo)</span></div>
      <div className="v4-quote-strip">
        <span>Bid <strong>{fmt(DEMO.bid)}</strong></span><span>Ask <strong>{fmt(DEMO.ask)}</strong></span>
        <span>Spr <strong>{fmt(DEMO.ask - DEMO.bid)}</strong></span>
      </div>
      <Capsule className="v4-mainmodes" ariaLabel="Order entry type"
        options={[{ id: 'market', label: 'Market' }, { id: 'pending', label: 'Pending' }]} value={mode} onChange={changeOrderMode}/>
      {mode === 'pending' && <div className="v4-pending v4-block">
        <Capsule ariaLabel="Pending order type" options={[{id:'limit',label:'Limit'},{id:'stop',label:'Stop'},{id:'stop-limit',label:'Stop Limit'}]}
          value={pendingType} onChange={onPendingType}/>
        <label className="v4-inline-setting">Entry price <input aria-label="Pending entry price" type="number" value={pendingEntry}
          onChange={e => setPendingEntry(Number(e.target.value))} /></label>
        {pendingType === 'stop-limit' && <label className="v4-inline-setting">Limit price <input aria-label="Stop-limit execution price"
          type="number" value={stopLimitPrice} onChange={e => setStopLimitPrice(Number(e.target.value))}/></label>}
      </div>}
      <div className="v4-position v4-block">
        <div className="v4-section-heading"><span>POSITION</span><span title="Instrument leverage (read-only)">{DEMO.leverage}x <ChevronDown size={13}/></span></div>
        <Capsule className="v4-position-modes" ariaLabel="Position sizing mode" options={MODES} value={sizeMode} onChange={selectMode}/>
        <div className="v4-amount">
          <button type="button" aria-label="Decrease position size" onClick={() => setValue(Number((Math.max(conf.min, value - conf.step)).toFixed(4)))}><Minus size={18}/></button>
          <CloseableNumber key={sizeMode} label={conf.label + ' sizing value'} value={value} onCommit={setValue}/>
          <button type="button" aria-label="Increase position size" onClick={() => setValue(Number((value + conf.step).toFixed(4)))}><Plus size={18}/></button>
        </div>
        <div className="v4-slider">
          <input aria-label={conf.label + ' slider'} type="range" min={conf.min} max={conf.max} step={conf.step}
            value={clamp(Number.isFinite(value) ? value : conf.min, conf.min, conf.max)}
            onChange={e => setValue(Number(e.target.value))}
            style={{ '--fill': ((clamp(Number.isFinite(value) ? value : conf.min, conf.min, conf.max) - conf.min) / (conf.max - conf.min) * 100) + '%' }}/>
          <div className="v4-scale">{conf.marks.map((m,i)=><span key={i}>{m}</span>)}</div>
        </div>
        <div className="v4-translation" title="Lots mode percent shows notional exposure as a percentage of account balance">{formatted(sizeMode)}</div>
      </div>
      <div className="v4-exits v4-block">
        <div className="v4-section-heading"><span>EXITS / PROTECTION</span><ChevronUp size={15}/></div>
        <ExitEditor kind="sl" enabled={slEnabled} onToggle={() => setSlEnabled(v => !v)}
          unit={slUnit} onUnit={u => setExitUnit('sl', u)} price={slPrice} onPrice={setSlPrice} entry={entry}
          lots={lots} side={side} financialInputLocked={isRiskSizing(sizeMode)}/>
        <ExitEditor kind="tp" enabled={tpEnabled} onToggle={() => setTpEnabled(v => !v)}
          unit={tpUnit} onUnit={u => setExitUnit('tp', u)} price={tpPrice} onPrice={setTpPrice} entry={entry}
          lots={lots} side={side} financialInputLocked={false}/>
        <div className="v4-ratio-slab">
          <div><span>Risk / Reward</span><strong>{Number.isFinite(rr) ? '1:' + fmt(rr) : '—'}</strong></div>
          <div><span>Position volume</span><strong>{validLots ? fmt(lots) + ' lots' : '—'}</strong></div>
        </div>
      </div>
      <div className="v4-block">
        <button type="button" className="v4-disclosure" aria-expanded={advanced} onClick={() => setAdvanced(v => !v)}>ADVANCED {advanced ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>
        {advanced && <div className="v4-advanced-content">
          {mode === 'pending' && <>
            <label>Time in force <select value={expiry} onChange={e => setExpiry(e.target.value)}>
              <option value="GTC">GTC</option><option value="DAY">Day</option><option value="GTD">Custom</option></select></label>
            {expiry === 'GTD' && <label>Expiry <input aria-label="Expiry date and time" type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}/></label>}
          </>}
          <div><span>Instrument leverage</span><strong>{DEMO.leverage}x</strong></div>
          <div><span>Indicative spread cost</span><strong>{validLots ? money((DEMO.ask - DEMO.bid)*lots*DEMO.contractSize) : '—'}</strong></div>
          <div><span>Estimated commission</span><strong>{validLots ? money(lots*DEMO.commissionPerLot) : '—'}</strong></div>
          <p>Spread is reflected in the executable Buy/Ask and Sell/Bid prices and is not charged twice.</p>
        </div>}
      </div>
      {(warnings.length > 0 || notice) && <div className="v4-notice" role="status">{warnings[0] || notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={13}/></button></div>}
    </div>
    <div className="v4-execution-footer">
      <div className="v4-margin-summary"><div><span>Required margin</span><strong>{money(margin)}</strong></div><div><span>Free after</span><strong>{money(freeAfter)}</strong></div></div>
      <div className="v4-trade-actions">
        <button type="button" className="v4-sell" onClick={() => showButton('sell')}><span>{mode === 'market' ? 'SELL' : 'SELL ' + pendingType.toUpperCase().replace('-', ' ')}</span><strong>{fmt(mode === 'market' ? DEMO.bid : pendingEntry)}</strong></button>
        <button type="button" className="v4-buy" onClick={() => showButton('buy')}><span>{mode === 'market' ? 'BUY' : 'BUY ' + pendingType.toUpperCase().replace('-', ' ')}</span><strong>{fmt(mode === 'market' ? DEMO.ask : pendingEntry)}</strong></button>
      </div>
      <div className="v4-safety">DEMO / NO EXECUTION · Synthetic market values</div>
    </div>
  </section>;
}
export default function OrderTicketV4Preview() {
  const [width, setWidth] = useState('compact');
  const [view, setView] = useState('compare');
  const [revision, setRevision] = useState(0);
  const compact = width === 'compact';
  return <main className="v4-page">
    <div className="v4-topbar">
      <div><span className="v4-eyebrow">ACG TRADER / DESIGN STUDIO</span><h1>Execution V4 <small>Baseline 1</small></h1>
        <p>Chart-black · metallic graphite · white selection · real 330px dock</p></div>
      <div className="v4-toolbar">
        <Capsule ariaLabel="Ticket width" options={[{id:'compact',label:'330px dock'},{id:'reference',label:'Expanded'}]} value={width} onChange={setWidth}/>
        <Capsule ariaLabel="Preview mode" options={[{id:'compare',label:'Compare'},{id:'market',label:'Market'},{id:'pending',label:'Pending'}]} value={view} onChange={setView}/>
        <button className="v4-reset" type="button" onClick={() => setRevision(v => v + 1)}><RotateCcw size={13}/> Reset</button>
      </div>
    </div>
    <div key={revision} className={'v4-demo-grid ' + (compact ? 'is-compact ' : 'is-expanded ') + (view === 'compare' ? 'is-compare' : 'is-single')}>
      {(view === 'compare' || view === 'market') && <div className="v4-display"><div className="v4-panel-label">MARKET MODE</div><Ticket initialMode="market" compact={compact}/></div>}
      {(view === 'compare' || view === 'pending') && <div className="v4-display"><div className="v4-panel-label">PENDING MODE</div><Ticket initialMode="pending" compact={compact}/></div>}
    </div>
    <footer className="v4-page-note"><Info size={13}/> No real orders, sessions, positions, market data feeds or API connections. Numeric outcomes use a synthetic $100,000 account, 10x leverage, one BTC per lot and $1 tick size. Risk is illustrative and does not include slippage or gaps.</footer>
  </main>;
}
