import { useMemo, useState } from 'react'
import { BarChart3, CalendarDays, CandlestickChart, Crosshair, Expand, History, LineChart, Menu, Minus, MoreHorizontal, Plus, Search, Settings2, SlidersHorizontal, TextCursorInput, X } from 'lucide-react'
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
  const [pulse, setPulse] = useState(false)

  const market = useMemo(() => markets.find((m) => m.symbol === selectedSymbol) || markets[0], [selectedSymbol])
  const filteredMarkets = markets.filter((m) => `${m.symbol} ${m.name}`.toLowerCase().includes(search.toLowerCase()))
  const changeVolume = (delta) => setVolume((v) => Math.max(0.01, Math.min(100, Number((v + delta).toFixed(2)))))
  const quickOrder = (side) => { setOrderSide(side); setPulse(true); window.setTimeout(() => setPulse(false), 260); setOrderOpen(true) }

  return <div className="acg-app">
    <header className="acg-topbar">
      <div className="brand"><div className="brand-icon">a</div><div><strong>ACG</strong> TRADER</div></div>
      <div className="account-chip"><span className="live-dot" /> ACG-FUNDED <span>·</span> Account 1048217 <span>·</span> Demo</div>
      <div className="top-actions"><span className="balance-mini">Balance <strong>$100 000.00</strong></span><button type="button" onClick={() => setSettingsOpen((v) => !v)} aria-label="Settings"><Settings2 size={17} /></button><button type="button" className="mobile-only" onClick={() => setMarketOpen(true)} aria-label="Menu"><Menu size={18} /></button></div>
    </header>

    <div className="main-grid">
      <aside className="drawing-rail" aria-label="Chart tools">
        <ToolButton label="Cursor">↖</ToolButton><ToolButton label="Crosshair"><Crosshair size={16} /></ToolButton><ToolButton label="Trend line">╱</ToolButton><ToolButton label="Horizontal line"><Minus size={16} /></ToolButton><ToolButton label="Text"><TextCursorInput size={16} /></ToolButton><div className="rail-spacer" /><ToolButton label="Objects"><Settings2 size={16} /></ToolButton><ToolButton label="More"><MoreHorizontal size={17} /></ToolButton>
      </aside>

      <section className="terminal-workspace">
        <div className="chart-toolbar">
          <div className="view-modes"><button className={chartType === 'candles' ? 'active' : ''} type="button" onClick={() => setChartType('candles')}><CandlestickChart size={15} /></button><button className={chartType === 'bars' ? 'active' : ''} type="button" onClick={() => setChartType('bars')}><BarChart3 size={15} /></button><button className={chartType === 'line' ? 'active' : ''} type="button" onClick={() => setChartType('line')}><LineChart size={15} /></button></div>
          <div className="tf-scroll">{timeframes.map((tf) => <button key={tf} type="button" className={timeframe === tf ? 'active' : ''} onClick={() => setTimeframe(tf)}>{tf}</button>)}</div>
          <div className="chart-actions"><button type="button"><Minus size={15} /></button><button type="button"><Plus size={15} /></button><button type="button"><SlidersHorizontal size={15} /></button><button type="button"><CalendarDays size={15} /></button><button type="button"><Expand size={15} /></button></div>
        </div>

        <div className="chart-title-row"><div><strong>{market.symbol}, {timeframe}: {market.name}</strong><span className="live-badge">LIVE</span></div><button type="button" className="market-mobile-button" onClick={() => setMarketOpen(true)}><Search size={15} /> Market Watch</button></div>

        <div className="chart-wrap"><TradingChart symbol={selectedSymbol} timeframe={timeframe} chartType={chartType} /><div className="price-marker">{price(market.bid, market.digits)}</div><div className="quick-trade">
          <button className="quick-side sell" type="button" onClick={() => quickOrder('Sell')}><span>SELL</span><strong className={pulse ? 'quote-pulse' : ''}>{price(market.bid, market.digits)}</strong></button>
          <div className="lot-control"><button type="button" onClick={() => changeVolume(-0.01)}><Minus size={14} /></button><strong>{volume.toFixed(2)}</strong><span>LOT</span><button type="button" onClick={() => changeVolume(0.01)}><Plus size={14} /></button></div>
          <button className="quick-side buy" type="button" onClick={() => quickOrder('Buy')}><span>BUY</span><strong className={pulse ? 'quote-pulse' : ''}>{price(market.ask, market.digits)}</strong></button>
        </div></div>

        <section className="terminal-panel">
          <div className="account-bar"><span>Balance: <strong>100 000.00</strong></span><span>Equity: <strong>100 000.00</strong></span><span>Margin: <strong>0.00</strong></span><span>Free margin: <strong>100 000.00</strong></span><span>Level: <strong>0.00%</strong></span><span>Profit: <strong>0.00 USD</strong></span></div>
          <div className="terminal-tabs">{['Positions', 'Orders', 'History'].map((tab) => <button key={tab} type="button" className={terminalTab === tab ? 'active' : ''} onClick={() => setTerminalTab(tab)}>{tab}{tab === 'Positions' ? ' (0)' : ''}</button>)}<button className="new-order" type="button" onClick={() => setOrderOpen(true)}>+ Create New Order</button></div>
          {terminalTab === 'History' ? <HistoryTable /> : <EmptyState label={terminalTab === 'Positions' ? 'You don’t have any positions' : 'You don’t have any pending orders'} />}
        </section>
      </section>

      <aside className={`market-watch ${marketOpen ? 'mobile-open' : ''}`}>
        <div className="watch-head"><div><span>MARKET WATCH</span><strong>Forex CFDs</strong></div><button type="button" className="close-watch mobile-only" onClick={() => setMarketOpen(false)}><X size={18} /></button></div>
        <label className="symbol-search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search symbol" /></label>
        <div className="watch-cols"><span>Symbol</span><span>Bid</span><span>Ask</span><span>Daily Ch...</span></div>
        <div className="watch-list">{filteredMarkets.map((m) => <button key={m.symbol} className={`watch-row ${selectedSymbol === m.symbol ? 'selected' : ''}`} type="button" onClick={() => { setSelectedSymbol(m.symbol); setMarketOpen(false) }}><span><strong>{m.symbol}</strong><small>{m.name}</small></span><span>{price(m.bid, m.digits)}</span><span>{price(m.ask, m.digits)}</span><span className={m.change.startsWith('-') ? 'red-text' : 'blue-text'}>{m.change}</span></button>)}</div>
      </aside>
    </div>

    <footer className="desktop-status"><span><i className="live-dot" /> Connected</span><span>Server time 19:54:22</span><span>Latency 24 ms</span><span className="risk-summary">Daily Loss 0.42% · Max Loss 0.51%</span></footer>
    <nav className="mobile-bottom-nav"><button type="button" onClick={() => setMarketOpen(true)}><BarChart3 size={18} /><span>Quotes</span></button><button type="button" className="active"><Crosshair size={18} /><span>Chart</span></button><button type="button" onClick={() => { setOrderSide('Buy'); setOrderOpen(true) }}><SlidersHorizontal size={18} /><span>Trade</span></button><button type="button" onClick={() => setTerminalTab('History')}><History size={18} /><span>History</span></button><button type="button" onClick={() => setSettingsOpen((v) => !v)}><Settings2 size={18} /><span>Settings</span></button></nav>
    {settingsOpen && <div className="settings-popover"><strong>ACG Trader</strong><span>Theme: Light</span><span>One-click trading: On</span><span>Chart: {chartType}</span></div>}
    {orderOpen && <OrderModal market={market} side={orderSide} volume={volume} onClose={() => setOrderOpen(false)} />}
  </div>
}

function ToolButton({ children, label }) { return <button type="button" className="tool-button" title={label}>{children}</button> }
function EmptyState({ label }) { return <div className="empty-state"><div className="empty-icon"><History size={18} /></div><strong>{label}</strong><span>Your active trades will appear here.</span></div> }
function HistoryTable() { return <div className="history-table"><div className="history-head"><span>Symbol</span><span>Ticket</span><span>Time</span><span>Type</span><span>Volume</span><span>Price</span><span>Profit</span></div>{history.map((r) => <div className="history-row" key={r.ticket}><span>{r.symbol}</span><span>{r.ticket}</span><span>{r.time}</span><span>{r.type}</span><span>{r.volume}</span><span>{r.price}</span><span className="profit">{r.profit}</span></div>)}</div> }
function OrderModal({ market, side, volume, onClose }) { return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="order-modal"><div className="modal-head"><div><span>NEW ORDER</span><strong>{market.symbol}</strong></div><button type="button" onClick={onClose}><X size={18} /></button></div><div className="modal-quote"><div className="modal-sell"><span>SELL</span><strong>{price(market.bid, market.digits)}</strong></div><div className="modal-mid">{volume.toFixed(2)} LOT</div><div className="modal-buy"><span>BUY</span><strong>{price(market.ask, market.digits)}</strong></div></div><label>Order type<select><option>Market Execution</option><option>Pending Order</option></select></label><div className="two-inputs"><label>Stop Loss<input placeholder="Optional" /></label><label>Take Profit<input placeholder="Optional" /></label></div><button type="button" className={side === 'Buy' ? 'submit-buy' : 'submit-sell'} onClick={onClose}>Place {side} Order</button><p>Execution is simulated in the frontend; risk and broker adapters will connect to the live engine.</p></div></div> }
