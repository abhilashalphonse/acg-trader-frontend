import { useMemo, useState } from 'react'
import { BarChart3, ChevronDown, Crosshair, History, Maximize2, MoreHorizontal, Search, Settings2, SlidersHorizontal, WalletCards, X } from 'lucide-react'
import TradingChart from './chart/TradingChart'
import './App.css'
import './MobileNav.css'

const markets = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', bid: 1.17482, ask: 1.17496, change: '+0.18', digits: 5 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', bid: 1.35648, ask: 1.35664, change: '+0.24', digits: 5 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', bid: 147.982, ask: 148.004, change: '-0.11', digits: 3 },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', bid: 0.79642, ask: 0.79658, change: '+0.09', digits: 5 },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', bid: 0.66224, ask: 0.66238, change: '-0.07', digits: 5 },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', bid: 1.38162, ask: 1.38178, change: '+0.13', digits: 5 },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', bid: 0.60384, ask: 0.60400, change: '+0.05', digits: 5 },
]

const positions = [
  { ticket: '1048217', symbol: 'EURUSD', type: 'Buy', volume: '0.10', price: '1.17394', sl: '1.17180', tp: '1.17850', current: '1.17482', profit: '+$8.80' },
  { ticket: '1048272', symbol: 'GBPUSD', type: 'Sell', volume: '0.05', price: '1.35790', sl: '1.36120', tp: '1.35150', current: '1.35648', profit: '-$7.10' },
]

const orders = [
  { ticket: '1048304', symbol: 'EURUSD', type: 'Buy Limit', volume: '0.10', price: '1.17220', status: 'Pending' },
  { ticket: '1048311', symbol: 'USDJPY', type: 'Sell Stop', volume: '0.10', price: '147.600', status: 'Pending' },
]

const timeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

function formatPrice(value, digits) {
  return Number(value).toFixed(digits)
}

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD')
  const [timeframe, setTimeframe] = useState('M15')
  const [orderSide, setOrderSide] = useState('Buy')
  const [volume, setVolume] = useState(0.1)
  const [activePanel, setActivePanel] = useState('Positions')
  const [search, setSearch] = useState('')
  const [depthOpen, setDepthOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [mobileWatch, setMobileWatch] = useState(false)
  const [mobileView, setMobileView] = useState('chart')

  const market = useMemo(() => markets.find((item) => item.symbol === selectedSymbol) ?? markets[0], [selectedSymbol])
  const filteredMarkets = markets.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase()))
  const changeVolume = (amount) => setVolume((value) => Math.max(0.01, Math.min(10, Number((value + amount).toFixed(2)))))
  const openQuickOrder = (side) => { setOrderSide(side); setOrderOpen(true) }

  const goMobile = (view) => {
    setMobileView(view)
    if (view === 'markets') setMobileWatch(true)
    else setMobileWatch(false)
    if (view === 'trade') setActivePanel('Positions')
    if (view === 'history') setActivePanel('History')
  }

  return (
    <div className="terminal-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">a</span><span>ACG <strong>TRADER</strong></span></div>
        <div className="account-strip"><span className="connection-dot" /><span className="account-label">ACG-FUNDED</span><span className="account-number">#1048217</span><span className="account-separator" /><span>Balance</span><strong>$100,482.31</strong><span>Equity</span><strong className="positive">$100,491.11</strong><span className="account-metric">Margin <strong>$117.50</strong></span><span className="account-metric">Free <strong>$100,373.61</strong></span></div>
        <button className="mobile-menu" type="button" onClick={() => goMobile('markets')} aria-label="Open markets"><SlidersHorizontal size={17} /></button>
      </header>

      <div className="toolbar">
        <button className="mobile-watch-button" type="button" onClick={() => goMobile('markets')}><BarChart3 size={15} /> Markets</button>
        <div className="symbol-select"><span className="symbol-dot" /><select value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value)}>{markets.map((item) => <option key={item.symbol}>{item.symbol}</option>)}</select><span className="quote">{formatPrice(market.bid, market.digits)} / {formatPrice(market.ask, market.digits)}</span></div>
        <div className="timeframes">{timeframes.map((item) => <button key={item} className={timeframe === item ? 'active' : ''} type="button" onClick={() => setTimeframe(item)}>{item}</button>)}</div>
        <button className="timeframe-more" type="button" aria-label="More timeframes"><ChevronDown size={13} /></button>
        <div className="toolbar-actions"><button type="button" onClick={() => setDepthOpen((value) => !value)} className={depthOpen ? 'toolbar-active' : ''}>Depth</button><button type="button" onClick={() => setOrderOpen(true)}>New Order</button><button type="button" aria-label="Crosshair"><Crosshair size={14} /></button><button type="button" aria-label="Chart settings"><Settings2 size={14} /></button></div>
      </div>

      <main className="workspace">
        <aside className={`watchlist-panel ${mobileWatch ? 'mobile-open' : ''}`}>
          <div className="panel-heading"><div><span className="eyebrow">MARKET WATCH</span><strong>Forex CFDs</strong></div><button type="button" className="small-button" onClick={() => setMobileWatch(false)} aria-label="Close market watch"><X size={15} /></button></div>
          <label className="search-box"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search symbol" /></label>
          <div className="watchlist-header"><span>Symbol</span><span>Bid</span><span>Ask</span></div>
          <div className="watchlist">{filteredMarkets.map((item) => <button key={item.symbol} type="button" className={`market-row ${selectedSymbol === item.symbol ? 'selected' : ''}`} onDoubleClick={() => setOrderOpen(true)} onClick={() => { setSelectedSymbol(item.symbol); setMobileWatch(false) }}><span><strong>{item.symbol}</strong><small>{item.name}</small></span><span>{formatPrice(item.bid, item.digits)}</span><span>{formatPrice(item.ask, item.digits)}</span></button>)}</div>
          <div className="watchlist-hint">Double-click a symbol to open a new order.</div>
        </aside>

        <section className="center-column">
          <div className="chart-panel">
            <div className="chart-header"><div><div className="instrument-title"><strong>{market.symbol}</strong><span>Forex CFD</span><span className="live-pill">LIVE</span></div><div className="price-line"><span className="bid-price">{formatPrice(market.bid, market.digits)}</span><span className="slash">/</span><span className="ask-price">{formatPrice(market.ask, market.digits)}</span><span className="change">{market.change}%</span></div></div><div className="chart-tools"><button type="button" aria-label="Crosshair"><Crosshair size={15} /></button><button type="button" aria-label="Chart controls"><SlidersHorizontal size={15} /></button><button type="button" aria-label="Chart type"><BarChart3 size={15} /></button><button type="button" aria-label="Fullscreen"><Maximize2 size={15} /></button></div></div>
            <div className="chart-area"><TradingChart symbol={market.symbol} timeframe={timeframe} /><div className="chart-badge">ACG Trader · {timeframe}</div></div>
            <div className="quick-trade-bar"><div className="quick-label">ONE-CLICK TRADING</div><button className="quick-sell" type="button" onClick={() => openQuickOrder('Sell')}><small>SELL</small><strong>{formatPrice(market.bid, market.digits)}</strong></button><div className="quick-volume"><button type="button" onClick={() => changeVolume(-0.01)} aria-label="Decrease volume">−</button><strong>{volume.toFixed(2)}</strong><span>lots</span><button type="button" onClick={() => changeVolume(0.01)} aria-label="Increase volume">+</button></div><button className="quick-buy" type="button" onClick={() => openQuickOrder('Buy')}><small>BUY</small><strong>{formatPrice(market.ask, market.digits)}</strong></button></div>
          </div>

          {depthOpen && <MarketDepth market={market} />}
          <section className="trade-terminal-panel"><div className="tabs">{['Positions', 'Orders', 'History'].map((item) => <button key={item} type="button" className={activePanel === item ? 'active' : ''} onClick={() => setActivePanel(item)}>{item}<span>{item === 'Positions' ? positions.length : item === 'Orders' ? orders.length : 18}</span></button>)}</div>{activePanel === 'Positions' && <TradeTable rows={positions} type="positions" />}{activePanel === 'Orders' && <TradeTable rows={orders} type="orders" />}{activePanel === 'History' && <HistoryTable />}</section>
        </section>
      </main>

      <div className="mobile-settings" style={{ display: mobileView === 'more' ? 'block' : 'none' }}>
        <div className="mobile-settings-header"><strong>Settings</strong><button className="small-button" type="button" onClick={() => goMobile('chart')} aria-label="Close settings"><X size={18} /></button></div>
        <div className="mobile-settings-card"><strong>Trading account</strong><span>ACG-FUNDED · #1048217</span></div>
        <div className="mobile-settings-card"><strong>Risk</strong><span>Daily loss 0.42% · Maximum loss 0.51%</span></div>
        <div className="mobile-settings-card"><strong>Chart</strong><span>Default timeframe: {timeframe} · Candlesticks</span></div>
        <div className="mobile-settings-card"><strong>Notifications</strong><span>Price alerts and trading notifications</span></div>
      </div>

      <footer className="statusbar"><div><span className="status-dot" /> Connected · Demo environment</div><div>Data <strong>24 ms</strong></div><div>Server <strong>15:06:24</strong></div><div className="footer-right">Daily Loss <strong>0.42%</strong> · Max Loss <strong>0.51%</strong> · Target <strong>4.8%</strong></div></footer>

      <nav className="mobile-nav" aria-label="Trading navigation">
        <button type="button" className={mobileView === 'markets' ? 'active' : ''} onClick={() => goMobile('markets')}><BarChart3 size={18} /><span>Markets</span></button>
        <button type="button" className={mobileView === 'chart' ? 'active' : ''} onClick={() => goMobile('chart')}><Crosshair size={18} /><span>Chart</span></button>
        <button type="button" className={mobileView === 'trade' ? 'active' : ''} onClick={() => goMobile('trade')}><WalletCards size={18} /><span>Trade</span></button>
        <button type="button" className={mobileView === 'history' ? 'active' : ''} onClick={() => goMobile('history')}><History size={18} /><span>History</span></button>
        <button type="button" className={mobileView === 'more' ? 'active' : ''} onClick={() => goMobile('more')}><Settings2 size={18} /><span>More</span></button>
      </nav>

      {orderOpen && <OrderModal market={market} side={orderSide} volume={volume} setSide={setOrderSide} setVolume={setVolume} onClose={() => setOrderOpen(false)} />}
    </div>
  )
}

function MarketDepth({ market }) {
  const levels = [1, 2, 3, 4, 5]
  const step = market.symbol === 'USDJPY' ? 0.01 : 0.0001
  return <div className="depth-panel"><div className="panel-title"><span>DEPTH OF MARKET · SIMULATED</span><strong>{market.symbol}</strong></div>{levels.map((row) => <div className="depth-row" key={row}><span>{formatPrice(market.ask + step * row, market.digits)}</span><span>{row * 10}</span><span>{formatPrice(market.bid - step * row, market.digits)}</span><span>{row * 14}</span></div>)}</div>
}

function OrderModal({ market, side, setSide, volume, setVolume, onClose }) {
  const [type, setType] = useState('Market Execution')
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="order-modal"><div className="modal-head"><div><span className="eyebrow">NEW ORDER</span><strong>{market.symbol}</strong></div><button type="button" onClick={onClose} aria-label="Close order"><X size={17} /></button></div><div className="side-toggle"><button type="button" className={side === 'Buy' ? 'buy-active' : ''} onClick={() => setSide('Buy')}>Buy</button><button type="button" className={side === 'Sell' ? 'sell-active' : ''} onClick={() => setSide('Sell')}>Sell</button></div><label className="field"><span>Order type</span><select value={type} onChange={(event) => setType(event.target.value)}><option>Market Execution</option><option>Buy Limit</option><option>Sell Limit</option><option>Buy Stop</option><option>Sell Stop</option></select></label><label className="field"><span>Volume</span><input value={volume.toFixed(2)} onChange={(event) => setVolume(Math.max(0.01, Number(event.target.value) || 0.01))} /></label>{type !== 'Market Execution' && <label className="field"><span>Price</span><input placeholder="Entry price" /></label>}<div className="price-pair"><div><span>Bid</span><strong>{formatPrice(market.bid, market.digits)}</strong></div><div><span>Ask</span><strong>{formatPrice(market.ask, market.digits)}</strong></div></div><div className="two-fields"><label className="field"><span>Stop Loss</span><input placeholder="Optional" /></label><label className="field"><span>Take Profit</span><input placeholder="Optional" /></label></div><button className={`place-order ${side.toLowerCase()}`} type="button" onClick={onClose}>{side} {market.symbol}<span>{formatPrice(side === 'Buy' ? market.ask : market.bid, market.digits)}</span></button><p className="trade-hint">Demo execution is simulated. Risk controls will be connected to the ACG trading adapter later.</p></div></div>
}

function TradeTable({ rows, type }) {
  return <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>SL</th><th>TP</th>{type === 'positions' && <th>Current</th>}<th>{type === 'positions' ? 'P&L' : 'Status'}</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.ticket}><td className="muted">{row.ticket}</td><td><strong>{row.symbol}</strong></td><td><span className={row.type.includes('Buy') ? 'trade-buy' : 'trade-sell'}>{row.type}</span></td><td>{row.volume}</td><td>{row.price}</td><td>{row.sl || '—'}</td><td>{row.tp || '—'}</td>{type === 'positions' && <td>{row.current}</td>}<td className={row.profit?.startsWith('+') ? 'positive' : row.profit ? 'negative' : ''}>{row.profit || row.status}</td><td><button className="row-action" type="button" aria-label={`Actions for ${row.ticket}`}><MoreHorizontal size={15} /></button></td></tr>)}</tbody></table></div>
}

function HistoryTable() {
  const history = [['1048172', 'EURUSD', 'Buy', '0.10', '1.17104', '+$26.20'], ['1047903', 'USDJPY', 'Sell', '0.20', '148.410', '+$14.90'], ['1047428', 'GBPUSD', 'Buy', '0.10', '1.35220', '+$18.40']]
  return <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Close</th><th>P&L</th><th>Time</th></tr></thead><tbody>{history.map((item, index) => <tr key={item[0]}><td className="muted">{item[0]}</td><td><strong>{item[1]}</strong></td><td>{item[2]}</td><td>{item[3]}</td><td>{item[4]}</td><td className="positive">{item[5]}</td><td>Today {14 - index}:2{index}</td></tr>)}</tbody></table></div>
}
