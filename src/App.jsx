import { useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  CalendarClock,
  CandlestickChart,
  ChevronRight,
  Crosshair,
  Expand,
  History,
  Link2,
  Menu,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Star,
  Sun,
  Moon,
  X,
} from 'lucide-react'
import TradingChart from './chart/TradingChart'
import './App.css'
import './MobileNav.css'

const markets = [
  { symbol: 'AUDCAD', name: 'Australian Dollar vs Canadian Dollar', assetClass: 'Forex', bid: 0.99253, ask: 0.99261, change: '-0.11%', digits: 5 },
  { symbol: 'AUDCHF', name: 'Australian Dollar vs Swiss Franc', assetClass: 'Forex', bid: 0.58286, ask: 0.58289, change: '-0.46%', digits: 5 },
  { symbol: 'AUDDKK', name: 'Australian Dollar vs Danish Krone', assetClass: 'Forex', bid: 4.61785, ask: 4.62535, change: '-0.04%', digits: 5 },
  { symbol: 'AUDHKD', name: 'Australian Dollar vs Hong Kong Dollar', assetClass: 'Forex', bid: 5.60626, ask: 5.60658, change: '-0.28%', digits: 5 },
  { symbol: 'AUDHUF', name: 'Australian Dollar vs Hungarian Forint', assetClass: 'Forex', bid: 220.748, ask: 220.991, change: '-0.23%', digits: 3 },
  { symbol: 'AUDJPY', name: 'Australian Dollar vs Japanese Yen', assetClass: 'Forex', bid: 110.287, ask: 110.290, change: '0.13%', digits: 3 },
]

const timeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN']
const history = [
  { ticket: '1048101', time: '17:42:18', type: 'Buy', symbol: 'AUDCAD', volume: '0.01', price: '0.99246', profit: '+$0.18' },
  { ticket: '1048092', time: '16:58:04', type: 'Sell', symbol: 'AUDCHF', volume: '0.02', price: '0.58312', profit: '+$1.22' },
]
const watchGroups = [
  { key: 'favorites', label: 'Favorites' },
  { key: 'Forex', label: 'Forex' },
  { key: 'Metals', label: 'Metals' },
  { key: 'Indices', label: 'Indices' },
]

const price = (n, digits = 5) => Number(n).toFixed(digits)
const changeClass = (change) => (String(change).startsWith('-') ? 'red-text' : 'green-text')
const tabular = { fontVariantNumeric: 'tabular-nums' }

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('AUDCAD')
  const [timeframe, setTimeframe] = useState('M1')
  const [chartType, setChartType] = useState('candles')
  const [volume, setVolume] = useState(0.01)
  const [terminalTab, setTerminalTab] = useState('Positions')
  const [orderSide, setOrderSide] = useState('Buy')
  const [orderOpen, setOrderOpen] = useState(false)
  const [marketOpen, setMarketOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileView, setMobileView] = useState('Chart')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('acg-theme') === 'dark')
  const [pulse, setPulse] = useState(false)
  const [favorites, setFavorites] = useState(() => new Set(['AUDCAD']))
  const [watchFilter, setWatchFilter] = useState('Forex')
  const [search, setSearch] = useState('')

  const market = useMemo(() => markets.find((item) => item.symbol === selectedSymbol) || markets[0], [selectedSymbol])
  const filteredMarkets = markets
    .filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase()))
    .filter((item) => watchFilter === 'favorites' ? favorites.has(item.symbol) : item.assetClass === watchFilter)

  const changeVolume = (delta) => setVolume((value) => Math.max(0.01, Math.min(100, Number((value + delta).toFixed(2)))))
  const goMobile = (view) => {
    setMobileView(view)
    setMarketOpen(false)
    setSettingsOpen(false)
  }
  const toggleTheme = () => setDarkMode((value) => {
    const next = !value
    localStorage.setItem('acg-theme', next ? 'dark' : 'light')
    return next
  })
  const toggleFavorite = (symbol, event) => {
    event.stopPropagation()
    setFavorites((previous) => {
      const next = new Set(previous)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }
  const quickOrder = (side) => {
    setOrderSide(side)
    setPulse(true)
    window.setTimeout(() => setPulse(false), 260)
    setOrderOpen(true)
  }

  const selectSymbol = (symbol) => {
    setSelectedSymbol(symbol)
    setMobileView('Chart')
    setMarketOpen(false)
  }

  return (
    <div className={`acg-app ${darkMode ? 'acg-dark' : ''}`}>
      <DesktopTerminal
        market={market}
        selectedSymbol={selectedSymbol}
        selectSymbol={selectSymbol}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        chartType={chartType}
        setChartType={setChartType}
        volume={volume}
        changeVolume={changeVolume}
        terminalTab={terminalTab}
        setTerminalTab={setTerminalTab}
        quickOrder={quickOrder}
        marketOpen={marketOpen}
        setMarketOpen={setMarketOpen}
        filteredMarkets={filteredMarkets}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        watchFilter={watchFilter}
        setWatchFilter={setWatchFilter}
        search={search}
        setSearch={setSearch}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
      />

      <MobileTerminal
        view={mobileView}
        market={market}
        selectedSymbol={selectedSymbol}
        setSelectedSymbol={selectSymbol}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        volume={volume}
        changeVolume={changeVolume}
        pulse={pulse}
        quickOrder={quickOrder}
        chartType={chartType}
        setChartType={setChartType}
        filteredMarkets={filteredMarkets}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        watchFilter={watchFilter}
        setWatchFilter={setWatchFilter}
        search={search}
        setSearch={setSearch}
        setOrderSide={setOrderSide}
        setOrderOpen={setOrderOpen}
        terminalTab={terminalTab}
        setTerminalTab={setTerminalTab}
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        goMobile={goMobile}
      />

      {settingsOpen && <SettingsPanel darkMode={darkMode} toggleTheme={toggleTheme} onClose={() => setSettingsOpen(false)} />}
      {orderOpen && <OrderModal market={market} side={orderSide} volume={volume} onClose={() => setOrderOpen(false)} />}
    </div>
  )
}

function DesktopTerminal({
  market,
  selectedSymbol,
  selectSymbol,
  timeframe,
  setTimeframe,
  chartType,
  setChartType,
  volume,
  changeVolume,
  terminalTab,
  setTerminalTab,
  quickOrder,
  filteredMarkets,
  favorites,
  toggleFavorite,
  watchFilter,
  setWatchFilter,
  search,
  setSearch,
  settingsOpen,
  setSettingsOpen,
}) {
  return (
    <div className="desktop-terminal">
      <header className="acg-topbar">
        <div className="brand"><div className="brand-icon">a</div><div><strong>ACG</strong> TRADER</div></div>
        <div className="account-chip"><span className="live-dot" /> ACG-FUNDED <span>·</span> Account 1048217 <span>·</span> Demo</div>
        <div className="top-actions">
          <span className="balance-mini">Balance <strong style={tabular}>$100 000.00</strong></span>
          <button type="button" onClick={() => setSettingsOpen((value) => !value)} aria-label="Settings"><Settings2 size={17} /></button>
        </div>
      </header>

      <div className="main-grid">
        <aside className="drawing-rail" aria-label="Chart tools">
          <ToolButton label="Cursor">↖</ToolButton>
          <ToolButton label="Crosshair"><Crosshair size={16} /></ToolButton>
          <ToolButton label="Trend line">╱</ToolButton>
          <ToolButton label="Horizontal line"><Minus size={16} /></ToolButton>
          <ToolButton label="Text">T</ToolButton>
          <div className="rail-spacer" />
          <ToolButton label="Objects"><Settings2 size={16} /></ToolButton>
          <ToolButton label="More"><MoreHorizontal size={17} /></ToolButton>
        </aside>

        <section className="terminal-workspace">
          <div className="chart-toolbar">
            <div className="view-modes">
              <button className={chartType === 'candles' ? 'active' : ''} type="button" onClick={() => setChartType('candles')}><CandlestickChart size={15} /></button>
              <button className={chartType === 'line' ? 'active' : ''} type="button" onClick={() => setChartType('line')}><Activity size={15} /></button>
            </div>
            <div className="tf-scroll">{timeframes.map((tf) => <button key={tf} type="button" className={timeframe === tf ? 'active' : ''} onClick={() => setTimeframe(tf)}>{tf}</button>)}</div>
            <div className="chart-actions"><button type="button"><Minus size={15} /></button><button type="button"><Plus size={15} /></button><button type="button"><SlidersHorizontal size={15} /></button><button type="button"><CalendarClock size={15} /></button><button type="button"><Expand size={15} /></button></div>
          </div>

          <div className="chart-title-row"><div><strong>{market.symbol} · {timeframe}</strong><span className="live-badge">LIVE</span></div></div>
          <div className="chart-wrap">
            <TradingChart symbol={selectedSymbol} timeframe={timeframe} chartType={chartType} showPriceAxis gridLines />
            <div className="price-marker" style={tabular}>{price(market.bid, market.digits)}</div>
            <div className="quick-trade">
              <button className="quick-side sell" type="button" onClick={() => quickOrder('Sell')}><span>SELL</span><strong style={tabular} className={pulse ? 'quote-pulse' : ''}>{price(market.bid, market.digits)}</strong></button>
              <div className="lot-control"><button type="button" onClick={() => changeVolume(-0.01)}><Minus size={14} /></button><strong style={tabular}>{volume.toFixed(2)}</strong><span>LOT</span><button type="button" onClick={() => changeVolume(0.01)}><Plus size={14} /></button></div>
              <button className="quick-side buy" type="button" onClick={() => quickOrder('Buy')}><span>BUY</span><strong style={tabular} className={pulse ? 'quote-pulse' : ''}>{price(market.ask, market.digits)}</strong></button>
            </div>
          </div>

          <section className="terminal-panel">
            <div className="account-bar"><span>Balance: <strong style={tabular}>100 000.00</strong></span><span>Equity: <strong style={tabular}>100 000.00</strong></span><span>Margin: <strong style={tabular}>0.00</strong></span><span>Free margin: <strong style={tabular}>100 000.00</strong></span><span>Level: <strong style={tabular}>0.00%</strong></span><span>Profit: <strong style={tabular}>0.00 USD</strong></span></div>
            <div className="terminal-tabs">{['Positions', 'Orders', 'History'].map((tab) => <button key={tab} type="button" className={terminalTab === tab ? 'active' : ''} onClick={() => setTerminalTab(tab)}>{tab}{tab === 'Positions' ? ' (0)' : ''}</button>)}<button type="button" className="new-order" onClick={() => quickOrder('Buy')}>+ Create New Order</button></div>
            {terminalTab === 'History' ? <HistoryTable /> : <EmptyState label={terminalTab === 'Positions' ? 'No open positions yet' : 'No pending orders yet'} onPlaceTrade={() => quickOrder('Buy')} />}
          </section>
        </section>

        <aside className="market-watch">
          <div className="watch-head"><div><span>MARKET WATCH</span><strong>Forex CFDs</strong></div></div>
          <WatchList
            markets={filteredMarkets}
            selectedSymbol={selectedSymbol}
            selectSymbol={selectSymbol}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            watchFilter={watchFilter}
            setWatchFilter={setWatchFilter}
            search={search}
            setSearch={setSearch}
          />
        </aside>
      </div>
      <footer className="desktop-status"><span><i className="live-dot" /> Connected</span><span>Server time 19:54:22</span><span>Latency 24 ms</span><span className="risk-summary">Daily Loss 0.42% · Max Loss 0.51%</span></footer>
    </div>
  )
}

function MobileTerminal({
  view,
  market,
  selectedSymbol,
  setSelectedSymbol,
  timeframe,
  setTimeframe,
  volume,
  changeVolume,
  pulse,
  quickOrder,
  chartType,
  setChartType,
  filteredMarkets,
  favorites,
  toggleFavorite,
  watchFilter,
  setWatchFilter,
  search,
  setSearch,
  setOrderSide,
  setOrderOpen,
  terminalTab,
  setTerminalTab,
  darkMode,
  toggleTheme,
  goMobile,
}) {
  return (
    <div className="mobile-terminal">
      {view === 'Quotes' && <QuotesScreen {...{ filteredMarkets, selectedSymbol, setSelectedSymbol, favorites, toggleFavorite, watchFilter, setWatchFilter, search, setSearch }} />}
      {view === 'Chart' && <MobileChart {...{ market, selectedSymbol, timeframe, setTimeframe, volume, changeVolume, pulse, quickOrder, chartType, setChartType }} />}
      {view === 'Trade' && <TradeScreen {...{ terminalTab, setTerminalTab, setOrderSide, setOrderOpen, darkMode }} />}
      {view === 'History' && <HistoryScreen darkMode={darkMode} />}
      {view === 'Settings' && <SettingsScreen darkMode={darkMode} toggleTheme={toggleTheme} />}

      <nav className="mobile-bottom-nav" aria-label="Primary">
        <MobileNavButton active={view === 'Quotes'} icon={<BarChart3 size={19} />} label="Quotes" onClick={() => goMobile('Quotes')} />
        <MobileNavButton active={view === 'Chart'} icon={<CandlestickChart size={19} />} label="Chart" onClick={() => goMobile('Chart')} />
        <MobileNavButton active={view === 'Trade'} icon={<SlidersHorizontal size={19} />} label="Trade" onClick={() => goMobile('Trade')} />
        <MobileNavButton active={view === 'History'} icon={<History size={19} />} label="History" onClick={() => goMobile('History')} />
        <MobileNavButton active={view === 'Settings'} icon={<Settings2 size={19} />} label="Settings" onClick={() => goMobile('Settings')} />
      </nav>
    </div>
  )
}

function MobileChart({ market, selectedSymbol, timeframe, setTimeframe, volume, changeVolume, pulse, quickOrder }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <section className="mobile-chart-screen">
      <div className="mobile-chart-toolbar">
        <button type="button" aria-label="Menu" onClick={() => setMenuOpen((value) => !value)}><Menu size={19} /></button>
        <button type="button" className="mobile-toolbar-active" aria-label="Chart type"><CandlestickChart size={18} /></button>
        <button type="button" aria-label="Indicators"><BarChart3 size={18} /></button>
        <button type="button" className="mobile-timeframe">{timeframe}<span>⌄</span></button>
        <button type="button" aria-label="Objects"><Link2 size={18} /></button>
        <button type="button" aria-label="Drawing tools"><Activity size={19} /></button>
      </div>
      <div className="mobile-quote-strip">
        <button className="mobile-quote-sell" type="button" onClick={() => quickOrder('Sell')}><span>SELL</span><strong style={tabular} className={pulse ? 'quote-pulse' : ''}>{price(market.bid, market.digits)}</strong></button>
        <div className="mobile-lot"><button type="button" onClick={() => changeVolume(-0.01)}><ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} /></button><strong style={tabular}>{volume.toFixed(2)}</strong><button type="button" onClick={() => changeVolume(0.01)}><ChevronRight size={15} /></button></div>
        <button className="mobile-quote-buy" type="button" onClick={() => quickOrder('Buy')}><span>BUY</span><strong style={tabular} className={pulse ? 'quote-pulse' : ''}>{price(market.ask, market.digits)}</strong></button>
      </div>
      <div className="mobile-chart-title">{market.symbol}, {timeframe}: {market.name}</div>
      <div className="mobile-chart-canvas">
        <TradingChart symbol={selectedSymbol} timeframe={timeframe} chartType="candles" showPriceAxis gridLines />
        <div className="mobile-price-tag" style={tabular}>{price(market.bid, market.digits)}</div>
      </div>
      <div className="mobile-chart-timeframes">{timeframes.slice(0, 6).map((tf) => <button key={tf} type="button" className={timeframe === tf ? 'active' : ''} onClick={() => setTimeframe(tf)}>{tf}</button>)}</div>
      {menuOpen && <div className="mobile-chart-menu"><strong>Chart</strong><button type="button">Indicators</button><button type="button">Objects</button><button type="button">Full screen</button></div>}
    </section>
  )
}

function QuotesScreen({ filteredMarkets, selectedSymbol, setSelectedSymbol, favorites, toggleFavorite, watchFilter, setWatchFilter, search, setSearch }) {
  return <section className="mobile-data-screen"><ScreenHeader title="Quotes" /><div className="mobile-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search symbol" /></div><div className="mobile-group-tabs">{watchGroups.map((group) => <button key={group.key} type="button" className={watchFilter === group.key ? 'active' : ''} onClick={() => setWatchFilter(group.key)}>{group.label}</button>)}</div><div className="mobile-quote-head"><span>Symbol</span><span>Bid</span><span>Ask</span><span>Change</span></div><div className="mobile-list">{filteredMarkets.map((item) => { const fav = favorites.has(item.symbol); return <button key={item.symbol} type="button" className={`mobile-market-row ${selectedSymbol === item.symbol ? 'selected' : ''}`} onClick={() => setSelectedSymbol(item.symbol)}><span className="mobile-symbol-cell"><button type="button" className={`fav-star ${fav ? 'active' : ''}`} onClick={(event) => toggleFavorite(item.symbol, event)}><Star size={14} fill={fav ? 'currentColor' : 'none'} /></button><span><strong>{item.symbol}</strong><small>{item.name}</small></span></span><span style={tabular} className={changeClass(item.change)}>{price(item.bid, item.digits)}</span><span style={tabular} className={changeClass(item.change)}>{price(item.ask, item.digits)}</span><span style={tabular} className={changeClass(item.change)}>{item.change}</span></button> })}{filteredMarkets.length === 0 && <EmptyList label={watchFilter === 'favorites' ? 'No favorites yet' : `No ${watchFilter.toLowerCase()} symbols yet`} />}</div></section>
}

function TradeScreen({ terminalTab, setTerminalTab, setOrderSide, setOrderOpen, darkMode }) {
  return <section className="mobile-data-screen trade-screen"><ScreenHeader title="Trade" action={<button type="button" className="mobile-primary" onClick={() => { setOrderSide('Buy'); setOrderOpen(true) }}>+ New Order</button>} /><div className="mobile-metrics"><Metric label="Balance" value="$100,000.00" /><Metric label="Equity" value="$100,000.00" /><Metric label="Free Margin" value="$100,000.00" /><Metric label="Profit" value="$0.00" /></div><section className="mobile-panel"><div className="mobile-tabs">{['Positions', 'Orders'].map((tab) => <button key={tab} type="button" className={terminalTab === tab ? 'active' : ''} onClick={() => setTerminalTab(tab)}>{tab}</button>)}</div><EmptyState label={terminalTab === 'Positions' ? 'No open positions' : 'No pending orders'} onPlaceTrade={() => { setOrderSide('Buy'); setOrderOpen(true) }} /></section><section className="mobile-panel mobile-risk"><div className="mobile-panel-kicker">ACG CHALLENGE</div><strong className="safe-text">● SAFE</strong><RiskRow label="Daily Loss" value="$42 / $500" /><RiskRow label="Max Loss" value="$51 / $1,000" /><RiskRow label="Profit Target" value="$0 / $1,000" /></section></section>
}

function HistoryScreen({ darkMode }) {
  return <section className="mobile-data-screen"><ScreenHeader title="History" action={<span className="screen-muted">Today</span>} /><div className="mobile-list">{history.map((row) => <button key={row.ticket} type="button" className="mobile-history-row"><div><strong>{row.symbol}</strong><strong className="green-text" style={tabular}>{row.profit}</strong></div><div><span>{row.type} {row.volume}</span><span style={tabular}>{row.price}</span><span>{row.time}</span></div></button>)}</div></section>
}

function SettingsScreen({ darkMode, toggleTheme }) {
  const rows = ['Account', 'Trading preferences', 'Alerts', 'Economic calendar', 'Challenge & risk', 'Help & support']
  return <section className="mobile-data-screen settings-screen"><ScreenHeader title="Settings" /><div className="settings-card"><div><strong>Appearance</strong><span>{darkMode ? 'Dark mode' : 'Light mode'}</span></div><button type="button" className={`theme-toggle ${darkMode ? 'on' : ''}`} onClick={toggleTheme}><span className="theme-toggle-knob">{darkMode ? <Moon size={11} /> : <Sun size={11} />}</span></button></div><div className="settings-list">{rows.map((label) => <button type="button" key={label}><span>{label}</span><ChevronRight size={16} /></button>)}</div></section>
}

function ScreenHeader({ title, action }) { return <header className="mobile-screen-header"><strong>{title}</strong>{action || <span />}</header> }
function MobileNavButton({ active, icon, label, onClick }) { return <button type="button" className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button> }
function Metric({ label, value }) { return <div className="metric-card"><span>{label}</span><strong style={tabular}>{value}</strong></div> }
function RiskRow({ label, value }) { return <div className="risk-row"><span>{label}</span><strong style={tabular}>{value}</strong></div> }
function EmptyList({ label }) { return <div className="empty-list">{label}</div> }
function ToolButton({ children, label }) { return <button type="button" className="tool-button" title={label}>{children}</button> }
function EmptyState({ label, onPlaceTrade }) { return <div className="empty-state"><div className="empty-icon"><History size={18} /></div><strong>{label}</strong><span>Your active trades will appear here.</span>{onPlaceTrade && <button type="button" className="empty-cta" onClick={onPlaceTrade}>Place a trade</button>}</div> }
function HistoryTable() { return <div className="history-table"><div className="history-head"><span>Symbol</span><span>Ticket</span><span>Time</span><span>Type</span><span>Volume</span><span>Price</span><span>Profit</span></div>{history.map((row) => <div className="history-row" key={row.ticket}><span>{row.symbol}</span><span>{row.ticket}</span><span>{row.time}</span><span>{row.type}</span><span style={tabular}>{row.volume}</span><span style={tabular}>{row.price}</span><span className="green-text" style={tabular}>{row.profit}</span></div>)}</div> }
function WatchList({ markets, selectedSymbol, selectSymbol, favorites, toggleFavorite, watchFilter, setWatchFilter, search, setSearch }) { return <><label className="symbol-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search symbol" /></label><div className="watch-filter-tabs">{watchGroups.map((group) => <button key={group.key} type="button" className={watchFilter === group.key ? 'active' : ''} onClick={() => setWatchFilter(group.key)}>{group.label}</button>)}</div><div className="watch-cols"><span /><span>Symbol</span><span>Bid</span><span>Ask</span><span>Daily Ch...</span></div><div className="watch-list">{markets.map((item) => { const fav = favorites.has(item.symbol); return <div key={item.symbol} className={`watch-row ${selectedSymbol === item.symbol ? 'selected' : ''}`} onClick={() => selectSymbol(item.symbol)}><button type="button" className={`fav-star ${fav ? 'active' : ''}`} onClick={(event) => toggleFavorite(item.symbol, event)}><Star size={14} fill={fav ? 'currentColor' : 'none'} /></button><span><strong>{item.symbol}</strong><small>{item.name}</small></span><span style={tabular} className={changeClass(item.change)}>{price(item.bid, item.digits)}</span><span style={tabular} className={changeClass(item.change)}>{price(item.ask, item.digits)}</span><span style={tabular} className={changeClass(item.change)}>{item.change}</span></div> })}</div></> }
function SettingsPanel({ darkMode, toggleTheme, onClose }) { return <div className="settings-popover"><div className="settings-popover-head"><strong>Settings</strong><button type="button" onClick={onClose}><X size={17} /></button></div><div className="settings-section"><div><strong>Appearance</strong><span>{darkMode ? 'Dark mode' : 'Light mode'}</span></div><button type="button" className={`theme-toggle ${darkMode ? 'on' : ''}`} onClick={toggleTheme}><span className="theme-toggle-knob">{darkMode ? <Moon size={11} /> : <Sun size={11} />}</span></button></div><div className="settings-section"><div><strong>One-click trading</strong><span>Enabled</span></div><b className="settings-on">ON</b></div></div> }
function OrderModal({ market, side, volume, onClose }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="order-modal"><div className="modal-head"><div><span>NEW ORDER</span><strong>{market.symbol}</strong></div><button type="button" onClick={onClose}><X size={18} /></button></div><div className="modal-quote"><div className="modal-sell"><span>SELL</span><strong style={tabular}>{price(market.bid, market.digits)}</strong></div><div className="modal-mid">{volume.toFixed(2)} LOT</div><div className="modal-buy"><span>BUY</span><strong style={tabular}>{price(market.ask, market.digits)}</strong></div></div><label>Order type<select><option>Market Execution</option><option>Pending Order</option></select></label><div className="two-inputs"><label>Stop Loss<input placeholder="Optional" /></label><label>Take Profit<input placeholder="Optional" /></label></div><button type="button" className={side === 'Buy' ? 'submit-buy' : 'submit-sell'} onClick={onClose}>Place {side} Order</button><p>Execution is simulated in the frontend; risk and broker adapters will connect to the live engine.</p></div></div> }
