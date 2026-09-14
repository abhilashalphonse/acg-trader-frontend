import { useMemo, useState } from 'react'
import { BarChart3, CalendarDays, CandlestickChart, Crosshair, Expand, History, LineChart, Menu, Minus, MoreHorizontal, Plus, Search, Settings2, SlidersHorizontal, TextCursorInput, X, Sun, Moon } from 'lucide-react'
import TradingChart from './chart/TradingChart'
import './App.css'
import './MobileNav.css'

const markets = [
  { symbol: 'AUDCAD', name: 'Australian Dollar vs Canadian Dollar', bid: 0.99368, ask: 0.99373, change: '-0.11%', digits: 5 },
  { symbol: 'AUDCHF', name: 'Australian Dollar vs Swiss Franc', bid: 0.58286, ask: 0.58289, change: '-0.46%', digits: 5 },
  { symbol: 'AUDDKK', name: 'Australian Dollar vs Danish Krone', bid: 4.61785, ask: 4.62535, change: '-0.04%', digits: 5 },
  { symbol: 'AUDHKD', name: 'Australian Dollar vs Hong Kong Dollar', bid: 5.60626, ask: 5.60658, change: '-0.28%', digits: 5 },
  { symbol: 'AUDHUF', name: 'Australian Dollar vs Hungarian Forint', bid: 220.748, ask: 220.991, change: '-0.23%', digits: 3 },
  { symbol: 'AUDJPY', name: 'Australian Dollar vs Japanese Yen', bid: 110.287, ask: 110.290, change: '0.13%', digits: 3 },
]
const timeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN']
const history = [
  { ticket: '1048101', time: '17:42:18', type: 'Buy', symbol: 'AUDCAD', volume: '0.01', price: '0.99342', profit: '+$0.18' },
  { ticket: '1048092', time: '16:58:04', type: 'Sell', symbol: 'AUDCHF', volume: '0.02', price: '0.58312', profit: '+$1.22' },
]
const price = (n, digits = 5) => Number(n).toFixed(digits)

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('AUDCAD')
  const [timeframe, setTimeframe] = useState('M1')
  const [chartType, setChartType] = useState('candles')
  const [volume, setVolume] = useState(0.01)
  const [search, setSearch] = useState('')
  const [terminalTab, setTerminalTab] = useState('Positions')
  const [orderSide, setOrderSide] = useState('Buy')
  const [orderOpen, setOrderOpen] = useState(false)
  const [marketOpen, setMarketOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileView, setMobileView] = useState('Chart')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('acg-theme') === 'dark')
  const [pulse, setPulse] = useState(false)

  const market = useMemo(() => markets.find((m) => m.symbol === selectedSymbol) || markets[0], [selectedSymbol])
  const filteredMarkets = markets.filter((m) => `${m.symbol} ${m.name}`.toLowerCase().includes(search.toLowerCase()))
  const changeVolume = (delta) => setVolume((v) => Math.max(0.01, Math.min(100, Number((v + delta).toFixed(2)))))
  const quickOrder = (side) => { setOrderSide(side); setPulse(true); window.setTimeout(() => setPulse(false), 260); setOrderOpen(true) }
  const goMobile = (view) => { setMobileView(view); setMarketOpen(false); if (view !== 'More') setSettingsOpen(false) }
  const toggleTheme = () => setDarkMode((value) => { const next = !value; localStorage.setItem('acg-theme', next ? 'dark' : 'light'); return next })

  return <div className={`acg-app ${darkMode ? 'acg-dark' : 'acg-light'}`}>
    <style>{`
      .acg-dark { --acg-bg:#0f141c; --acg-panel:#151c26; --acg-panel2:#1b2430; --acg-border:#2a3544; --acg-text:#e6ebf2; --acg-muted:#8f9bab; --acg-blue:#4d9aff; background:var(--acg-bg)!important;color:var(--acg-text); }
      .acg-dark .acg-topbar,.acg-dark .terminal-workspace,.acg-dark .terminal-panel,.acg-dark .market-watch,.acg-dark .chart-toolbar,.acg-dark .chart-title-row,.acg-dark .desktop-status,.acg-dark .mobile-bottom-nav { background:var(--acg-panel)!important;color:var(--acg-text);border-color:var(--acg-border)!important; }
      .acg-dark button,.acg-dark input,.acg-dark select { color:var(--acg-text); }
      .acg-dark input,.acg-dark select,.acg-dark .symbol-search,.acg-dark .account-bar,.acg-dark .terminal-tabs,.acg-dark .watch-cols { background:var(--acg-panel2)!important;border-color:var(--acg-border)!important; }
      .acg-dark .watch-row,.acg-dark .history-row,.acg-dark .history-head { background:var(--acg-panel)!important;color:var(--acg-text);border-color:var(--acg-border)!important; }
      .acg-dark .watch-row.selected { background:#193453!important; }
      .acg-dark .watch-row small,.acg-dark .empty-state span,.acg-dark .watch-head span { color:var(--acg-muted)!important; }
      .acg-dark .empty-state,.acg-dark .empty-icon { background:var(--acg-panel)!important;color:var(--acg-text); }
      .acg-dark .drawing-rail { background:var(--acg-panel)!important;border-color:var(--acg-border)!important; }
      .acg-dark .tool-button { color:var(--acg-muted); }
      .acg-dark .settings-popover,.acg-dark .order-modal { background:#18212c!important;color:var(--acg-text)!important;border-color:var(--acg-border)!important;box-shadow:0 18px 50px rgba(0,0,0,.45); }
      .acg-dark .settings-popover span,.acg-dark .order-modal p { color:var(--acg-muted)!important; }
      .acg-dark .mobile-view-surface { background:var(--acg-bg)!important;color:var(--acg-text)!important; }
      .acg-dark .mobile-view-surface .mobile-card { background:var(--acg-panel)!important;border-color:var(--acg-border)!important; }
      .theme-toggle { width:46px;height:26px;border:0;border-radius:20px;padding:3px;background:#687589;cursor:pointer;display:flex;align-items:center;justify-content:flex-start;transition:.2s; }
      .theme-toggle.on { background:#1769e0;justify-content:flex-end; }
      .theme-toggle-knob { width:20px;height:20px;border-radius:50%;background:#fff;display:grid;place-items:center;color:#445063;box-shadow:0 1px 3px rgba(0,0,0,.25); }
      .settings-section { display:flex;align-items:center;justify-content:space-between;gap:20px;padding:12px 0;border-top:1px solid #e2e7ee; }
      .acg-dark .settings-section { border-color:var(--acg-border); }
    `}</style>

    <header className="acg-topbar">
      <div className="brand"><div className="brand-icon">a</div><div><strong>ACG</strong> TRADER</div></div>
      <div className="account-chip"><span className="live-dot" /> ACG-FUNDED <span>·</span> Account 1048217 <span>·</span> Demo</div>
      <div className="top-actions"><span className="balance-mini">Balance <strong>$100 000.00</strong></span><button type="button" onClick={() => setSettingsOpen((v) => !v)} aria-label="Settings"><Settings2 size={17} /></button><button type="button" className="mobile-only" onClick={() => setMarketOpen(true)} aria-label="Open quotes"><Menu size={18} /></button></div>
    </header>

    <div className="main-grid">
      <aside className="drawing-rail" aria-label="Chart tools"><ToolButton label="Cursor">↖</ToolButton><ToolButton label="Crosshair"><Crosshair size={16} /></ToolButton><ToolButton label="Trend line">╱</ToolButton><ToolButton label="Horizontal line"><Minus size={16} /></ToolButton><ToolButton label="Text"><TextCursorInput size={16} /></ToolButton><div className="rail-spacer" /><ToolButton label="Objects"><Settings2 size={16} /></ToolButton><ToolButton label="More"><MoreHorizontal size={17} /></ToolButton></aside>

      <section className="terminal-workspace">
        <div className="chart-toolbar"><div className="view-modes"><button className={chartType === 'candles' ? 'active' : ''} type="button" onClick={() => setChartType('candles')}><CandlestickChart size={15} /></button><button className={chartType === 'line' ? 'active' : ''} type="button" onClick={() => setChartType('line')}><LineChart size={15} /></button></div><div className="tf-scroll">{timeframes.map((tf) => <button key={tf} type="button" className={timeframe === tf ? 'active' : ''} onClick={() => setTimeframe(tf)}>{tf}</button>)}</div><div className="chart-actions"><button type="button"><Minus size={15} /></button><button type="button"><Plus size={15} /></button><button type="button"><SlidersHorizontal size={15} /></button><button type="button"><CalendarDays size={15} /></button><button type="button"><Expand size={15} /></button></div></div>
        <div className="chart-title-row"><div><strong>{market.symbol} · {timeframe}</strong><span className="live-badge">LIVE</span></div><button type="button" className="market-mobile-button" onClick={() => setMarketOpen(true)}><Search size={15} /> Market Watch</button></div>
        <div className="chart-wrap"><TradingChart symbol={selectedSymbol} timeframe={timeframe} chartType={chartType} /><div className="price-marker">{price(market.bid, market.digits)}</div><div className="quick-trade"><button className="quick-side sell" type="button" onClick={() => quickOrder('Sell')}><span>SELL</span><strong className={pulse ? 'quote-pulse' : ''}>{price(market.bid, market.digits)}</strong></button><div className="lot-control"><button type="button" onClick={() => changeVolume(-0.01)}><Minus size={14} /></button><strong>{volume.toFixed(2)}</strong><span>LOT</span><button type="button" onClick={() => changeVolume(0.01)}><Plus size={14} /></button></div><button className="quick-side buy" type="button" onClick={() => quickOrder('Buy')}><span>BUY</span><strong className={pulse ? 'quote-pulse' : ''}>{price(market.ask, market.digits)}</strong></button></div></div>
        <section className="terminal-panel"><div className="account-bar"><span>Balance: <strong>100 000.00</strong></span><span>Equity: <strong>100 000.00</strong></span><span>Margin: <strong>0.00</strong></span><span>Free margin: <strong>100 000.00</strong></span><span>Level: <strong>0.00%</strong></span><span>Profit: <strong>0.00 USD</strong></span></div><div className="terminal-tabs">{['Positions', 'Orders', 'History'].map((tab) => <button key={tab} type="button" className={terminalTab === tab ? 'active' : ''} onClick={() => setTerminalTab(tab)}>{tab}{tab === 'Positions' ? ' (0)' : ''}</button>)}<button className="new-order" type="button" onClick={() => setOrderOpen(true)}>+ Create New Order</button></div>{terminalTab === 'History' ? <HistoryTable /> : <EmptyState label={terminalTab === 'Positions' ? 'You don’t have any positions' : 'You don’t have any pending orders'} />}</section>
      </section>

      <aside className={`market-watch ${marketOpen ? 'mobile-open' : ''}`}><div className="watch-head"><div><span>MARKET WATCH</span><strong>Forex CFDs</strong></div><button type="button" className="close-watch mobile-only" onClick={() => setMarketOpen(false)}><X size={18} /></button></div><label className="symbol-search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search symbol" /></label><div className="watch-cols"><span>Symbol</span><span>Bid</span><span>Ask</span><span>Daily Ch...</span></div><div className="watch-list">{filteredMarkets.map((m) => <button key={m.symbol} className={`watch-row ${selectedSymbol === m.symbol ? 'selected' : ''}`} type="button" onClick={() => { setSelectedSymbol(m.symbol); setMarketOpen(false); setMobileView('Chart') }}><span><strong>{m.symbol}</strong><small>{m.name}</small></span><span>{price(m.bid, m.digits)}</span><span>{price(m.ask, m.digits)}</span><span className={m.change.startsWith('-') ? 'red-text' : 'blue-text'}>{m.change}</span></button>)}</div></aside>
    </div>

    <footer className="desktop-status"><span><i className="live-dot" /> Connected</span><span>Server time 19:54:22</span><span>Latency 24 ms</span><span className="risk-summary">Daily Loss 0.42% · Max Loss 0.51%</span></footer>
    <MobileView view={mobileView} filteredMarkets={filteredMarkets} selectedSymbol={selectedSymbol} search={search} setSearch={setSearch} setSelectedSymbol={setSelectedSymbol} setMobileView={setMobileView} terminalTab={terminalTab} setTerminalTab={setTerminalTab} setOrderSide={setOrderSide} setOrderOpen={setOrderOpen} setSettingsOpen={setSettingsOpen} darkMode={darkMode} toggleTheme={toggleTheme} />
    <nav className="mobile-bottom-nav"><button type="button" className={mobileView === 'Quotes' ? 'active' : ''} onClick={() => goMobile('Quotes')}><BarChart3 size={18} /><span>Quotes</span></button><button type="button" className={mobileView === 'Chart' ? 'active' : ''} onClick={() => goMobile('Chart')}><Crosshair size={18} /><span>Chart</span></button><button type="button" className={mobileView === 'Trade' ? 'active' : ''} onClick={() => goMobile('Trade')}><SlidersHorizontal size={18} /><span>Trade</span></button><button type="button" className={mobileView === 'History' ? 'active' : ''} onClick={() => goMobile('History')}><History size={18} /><span>History</span></button><button type="button" className={mobileView === 'More' ? 'active' : ''} onClick={() => goMobile('More')}><MoreHorizontal size={18} /><span>More</span></button></nav>
    {settingsOpen && <SettingsPanel darkMode={darkMode} toggleTheme={toggleTheme} onClose={() => setSettingsOpen(false)} />}
    {orderOpen && <OrderModal market={market} side={orderSide} volume={volume} onClose={() => setOrderOpen(false)} />}
  </div>
}

function SettingsPanel({ darkMode, toggleTheme, onClose }) { return <div className="settings-popover" style={{ minWidth: 260, padding: 16, display: 'grid', gap: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>Settings</strong><button type="button" onClick={onClose} style={{ border: 0, background: 'transparent' }}><X size={17} /></button></div><div className="settings-section"><div><strong style={{ display: 'block', fontSize: 12 }}>Appearance</strong><span style={{ fontSize: 9, color: '#7d8998' }}>{darkMode ? 'Dark mode' : 'Light mode'}</span></div><button type="button" className={`theme-toggle ${darkMode ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode"><span className="theme-toggle-knob">{darkMode ? <Moon size={11} /> : <Sun size={11} />}</span></button></div><div className="settings-section"><div><strong style={{ display: 'block', fontSize: 12 }}>One-click trading</strong><span style={{ fontSize: 9, color: '#7d8998' }}>Enabled</span></div><span style={{ fontSize: 9, fontWeight: 800, color: '#1769e0' }}>ON</span></div></div> }

function MobileView({ view, filteredMarkets, selectedSymbol, search, setSearch, setSelectedSymbol, setMobileView, terminalTab, setTerminalTab, setOrderSide, setOrderOpen, setSettingsOpen, darkMode, toggleTheme }) {
  if (view === 'Chart') return null
  const shell = { position: 'fixed', inset: '48px 0 62px', zIndex: 20, background: darkMode ? '#0f141c' : '#fff', color: darkMode ? '#e6ebf2' : '#273246', overflow: 'auto' }
  const header = { height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: `1px solid ${darkMode ? '#2a3544' : '#e2e7ee'}`, position: 'sticky', top: 0, zIndex: 2, background: darkMode ? '#151c26' : '#fff' }
  const title = { fontSize: 14, fontWeight: 800 }
  const close = <button type="button" onClick={() => setMobileView('Chart')} style={iconButton}><X size={17} /></button>
  if (view === 'Quotes') return <section className="mobile-view-surface" style={shell}><div style={header}><strong style={title}>Quotes</strong>{close}</div><div style={{ padding: 10 }}><label className="symbol-search" style={{ margin: 0 }}><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search symbol" /></label></div><div style={{ padding: '0 10px' }}>{filteredMarkets.map((m) => <button key={m.symbol} type="button" onClick={() => { setSelectedSymbol(m.symbol); setMobileView('Chart') }} style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', textAlign: 'left', border: 0, borderBottom: `1px solid ${darkMode ? '#2a3544' : '#eef1f5'}`, background: selectedSymbol === m.symbol ? (darkMode ? '#193453' : '#edf5ff') : (darkMode ? '#151c26' : '#fff'), color: darkMode ? '#e6ebf2' : '#273246', padding: '12px 8px' }}><span><strong style={{ display: 'block', fontSize: 11 }}>{m.symbol}</strong><small style={{ display: 'block', marginTop: 3, fontSize: 8, color: darkMode ? '#8f9bab' : '#96a1b0' }}>{m.name}</small></span><span style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: 9 }}><strong style={{ display: 'block' }}>{price(m.bid, m.digits)}</strong><span>{price(m.ask, m.digits)} · </span><span className={m.change.startsWith('-') ? 'red-text' : 'blue-text'}>{m.change}</span></span></button>)}</div></section>
  if (view === 'Trade') return <section style={{ ...shell, background: darkMode ? '#0f141c' : '#f5f7fa' }}><div style={header}><strong style={title}>Trade</strong><button type="button" onClick={() => { setOrderSide('Buy'); setOrderOpen(true) }} style={primary}>+ New Order</button></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, padding: 10 }}><Metric label="Balance" value="$100,000.00" darkMode={darkMode} /><Metric label="Equity" value="$100,000.00" darkMode={darkMode} /><Metric label="Free Margin" value="$100,000.00" darkMode={darkMode} /><Metric label="Margin Level" value="—" darkMode={darkMode} /></div><div style={{ ...card(darkMode) }}><div style={{ display: 'flex', borderBottom: `1px solid ${darkMode ? '#2a3544' : '#e5e9ef'}` }}>{['Positions', 'Orders'].map((tab) => <button key={tab} type="button" onClick={() => setTerminalTab(tab)} style={{ ...tabButton, background: darkMode ? '#151c26' : '#fff', color: terminalTab === tab ? '#4d9aff' : '#788598', fontWeight: terminalTab === tab ? 800 : 500 }}>{tab}</button>)}</div><EmptyState label={terminalTab === 'Positions' ? 'You don’t have any positions' : 'You don’t have any pending orders'} /></div><div style={{ ...card(darkMode), padding: 12 }}><div style={{ fontSize: 9, color: '#8a96a5', fontWeight: 800, letterSpacing: '.7px' }}>ACG CHALLENGE</div><div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: darkMode ? '#e6ebf2' : '#273246' }}>● SAFE</div><div style={{ marginTop: 10, display: 'grid', gap: 7 }}><RiskRow label="Daily Loss" value="$42 / $500" /><RiskRow label="Max Loss" value="$51 / $1,000" /><RiskRow label="Profit Target" value="$0 / $1,000" /></div></div></section>
  if (view === 'History') return <section style={shell}><div style={header}><strong style={title}>History</strong><span style={{ fontSize: 9, color: '#8a96a5' }}>Today</span></div><div style={{ padding: '0 10px' }}>{history.map((r) => <button key={r.ticket} type="button" style={{ width: '100%', textAlign: 'left', border: 0, borderBottom: `1px solid ${darkMode ? '#2a3544' : '#eef1f5'}`, background: darkMode ? '#151c26' : '#fff', color: darkMode ? '#e6ebf2' : '#273246', padding: '13px 8px' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: 11 }}>{r.symbol}</strong><strong className="profit" style={{ fontSize: 10 }}>{r.profit}</strong></div><div style={{ marginTop: 5, display: 'flex', gap: 10, fontSize: 8, color: '#7b8797' }}><span>{r.type} {r.volume}</span><span>{r.price}</span><span>{r.time}</span></div></button>)}</div></section>
  return <section style={{ ...shell, background: darkMode ? '#0f141c' : '#f5f7fa' }}><div style={header}><strong style={title}>More</strong>{close}</div><div style={{ padding: 10, display: 'grid', gap: 8 }}><div className="mobile-card" style={card(darkMode)}><div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><strong style={{ display: 'block', fontSize: 11 }}>Appearance</strong><span style={{ fontSize: 8, color: '#8a96a5' }}>{darkMode ? 'Dark mode' : 'Light mode'}</span></div><button type="button" className={`theme-toggle ${darkMode ? 'on' : ''}`} onClick={toggleTheme}><span className="theme-toggle-knob">{darkMode ? <Moon size={11} /> : <Sun size={11} />}</span></button></div></div>{['Challenge & Risk', 'Alerts', 'Economic Calendar', 'Trade Journal', 'Account', 'Settings', 'Help'].map((item, i) => <button key={item} type="button" onClick={() => i === 0 ? setMobileView('Trade') : i === 5 ? setSettingsOpen(true) : undefined} style={{ ...card(darkMode), margin: 0, minHeight: 54, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', color: darkMode ? '#e6ebf2' : '#273246', fontWeight: 700, fontSize: 10 }}>{item}<span style={{ color: '#9aa5b3' }}>›</span></button>)}</div></section>
}

const iconButton = { border: 0, background: 'transparent', color: '#718096', width: 32, height: 32, display: 'grid', placeItems: 'center' }
const primary = { border: 0, borderRadius: 6, background: '#1769e0', color: '#fff', height: 32, padding: '0 12px', fontSize: 9, fontWeight: 800 }
const card = (dark) => ({ margin: '10px', border: `1px solid ${dark ? '#2a3544' : '#e2e7ee'}`, borderRadius: 8, overflow: 'hidden', background: dark ? '#151c26' : '#fff' })
const tabButton = { flex: 1, height: 38, border: 0, fontSize: 9 }
function Metric({ label, value, darkMode }) { return <div style={{ border: `1px solid ${darkMode ? '#2a3544' : '#e2e7ee'}`, borderRadius: 7, background: darkMode ? '#151c26' : '#fff', padding: 10 }}><div style={{ fontSize: 7, color: '#8a96a5', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div><strong style={{ display: 'block', marginTop: 5, fontSize: 10, color: darkMode ? '#e6ebf2' : '#273246' }}>{value}</strong></div> }
function RiskRow({ label, value }) { return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}><span style={{ color: '#7b8797' }}>{label}</span><strong>{value}</strong></div> }
function ToolButton({ children, label }) { return <button type="button" className="tool-button" title={label}>{children}</button> }
function EmptyState({ label }) { return <div className="empty-state"><div className="empty-icon"><History size={18} /></div><strong>{label}</strong><span>Your active trades will appear here.</span></div> }
function HistoryTable() { return <div className="history-table"><div className="history-head"><span>Symbol</span><span>Ticket</span><span>Time</span><span>Type</span><span>Volume</span><span>Price</span><span>Profit</span></div>{history.map((r) => <div className="history-row" key={r.ticket}><span>{r.symbol}</span><span>{r.ticket}</span><span>{r.time}</span><span>{r.type}</span><span>{r.volume}</span><span>{r.price}</span><span className="profit">{r.profit}</span></div>)}</div> }
function OrderModal({ market, side, volume, onClose }) { return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="order-modal"><div className="modal-head"><div><span>NEW ORDER</span><strong>{market.symbol}</strong></div><button type="button" onClick={onClose}><X size={18} /></button></div><div className="modal-quote"><div className="modal-sell"><span>SELL</span><strong>{price(market.bid, market.digits)}</strong></div><div className="modal-mid">{volume.toFixed(2)} LOT</div><div className="modal-buy"><span>BUY</span><strong>{price(market.ask, market.digits)}</strong></div></div><label>Order type<select><option>Market Execution</option><option>Pending Order</option></select></label><div className="two-inputs"><label>Stop Loss<input placeholder="Optional" /></label><label>Take Profit<input placeholder="Optional" /></label></div><button type="button" className={side === 'Buy' ? 'submit-buy' : 'submit-sell'} onClick={onClose}>Place {side} Order</button><p>Execution is simulated in the frontend; risk and broker adapters will connect to the live engine.</p></div></div> }
