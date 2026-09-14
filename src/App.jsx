import { useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CandlestickChart,
  Crosshair,
  Expand,
  History,
  LineChart,
  Menu,
  Minus,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sun,
  TextCursorInput,
  X,
} from 'lucide-react'
import TradingChart from './chart/TradingChart'
import './App.css'
import './MobileNav.css'

const MARKETS = [
  { symbol: 'AUDCAD', name: 'Australian Dollar vs Canadian Dollar', bid: 0.99368, ask: 0.99373, change: '-0.11%', digits: 5 },
  { symbol: 'AUDCHF', name: 'Australian Dollar vs Swiss Franc', bid: 0.58286, ask: 0.58289, change: '-0.46%', digits: 5 },
  { symbol: 'AUDDKK', name: 'Australian Dollar vs Danish Krone', bid: 4.61785, ask: 4.62535, change: '-0.04%', digits: 5 },
  { symbol: 'AUDHKD', name: 'Australian Dollar vs Hong Kong Dollar', bid: 5.60626, ask: 5.60658, change: '-0.28%', digits: 5 },
  { symbol: 'AUDHUF', name: 'Australian Dollar vs Hungarian Forint', bid: 220.748, ask: 220.991, change: '-0.23%', digits: 3 },
  { symbol: 'AUDJPY', name: 'Australian Dollar vs Japanese Yen', bid: 110.287, ask: 110.29, change: '0.13%', digits: 3 },
]

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN']
const TERMINAL_TABS = ['Positions', 'Orders', 'History']
const MOBILE_VIEWS = ['Quotes', 'Chart', 'Trade', 'History', 'More']

const HISTORY_ROWS = [
  { ticket: '1048101', time: '17:42:18', type: 'Buy', symbol: 'AUDCAD', volume: '0.01', price: '0.99342', profit: '+$0.18' },
  { ticket: '1048092', time: '16:58:04', type: 'Sell', symbol: 'AUDCHF', volume: '0.02', price: '0.58312', profit: '+$1.22' },
]

const ACCOUNT_METRICS = [
  ['Balance', '100 000.00'],
  ['Equity', '100 000.00'],
  ['Margin', '0.00'],
  ['Free margin', '100 000.00'],
  ['Level', '0.00%'],
  ['Profit', '0.00 USD'],
]

const RISK_ROWS = [
  ['Daily Loss', '$42 / $500'],
  ['Max Loss', '$51 / $1,000'],
  ['Profit Target', '$0 / $1,000'],
]

const formatPrice = (value, digits = 5) => Number(value).toFixed(digits)
const changeClass = (change) => (change.startsWith('-') ? 'red-text' : 'green-text')

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
  const [darkMode, setDarkMode] = useState(() => getStoredTheme() !== 'light')
  const [pulse, setPulse] = useState(false)

  const market = useMemo(
    () => MARKETS.find((item) => item.symbol === selectedSymbol) ?? MARKETS[0],
    [selectedSymbol],
  )

  const filteredMarkets = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return MARKETS
    return MARKETS.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(query))
  }, [search])

  const changeVolume = (delta) => {
    setVolume((current) => Math.max(0.01, Math.min(100, Number((current + delta).toFixed(2)))))
  }

  const quickOrder = (side) => {
    setOrderSide(side)
    setPulse(true)
    window.setTimeout(() => setPulse(false), 260)
    setOrderOpen(true)
  }

  const goMobile = (view) => {
    setMobileView(view)
    setMarketOpen(false)
    if (view !== 'More') setSettingsOpen(false)
  }

  const toggleTheme = () => {
    setDarkMode((current) => {
      const next = !current
      window.localStorage.setItem('acg-theme', next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <div className={`acg-app ${darkMode ? 'acg-dark' : 'acg-light'}`}>
      <TopBar
        onSettings={() => setSettingsOpen((open) => !open)}
        onOpenQuotes={() => setMarketOpen(true)}
      />

      <div className="main-grid">
        <DrawingRail />

        <section className="terminal-workspace">
          <ChartToolbar
            chartType={chartType}
            timeframe={timeframe}
            onChartTypeChange={setChartType}
            onTimeframeChange={setTimeframe}
          />

          <ChartTitle
            market={market}
            timeframe={timeframe}
            onOpenMarketWatch={() => setMarketOpen(true)}
          />

          <ChartWorkspace
            market={market}
            selectedSymbol={selectedSymbol}
            timeframe={timeframe}
            chartType={chartType}
            volume={volume}
            pulse={pulse}
            onVolumeChange={changeVolume}
            onQuickOrder={quickOrder}
          />

          <TerminalPanel
            activeTab={terminalTab}
            onTabChange={setTerminalTab}
            onCreateOrder={() => setOrderOpen(true)}
          />
        </section>

        <MarketWatch
          markets={filteredMarkets}
          selectedSymbol={selectedSymbol}
          open={marketOpen}
          search={search}
          onSearchChange={setSearch}
          onSelect={(symbol) => {
            setSelectedSymbol(symbol)
            setMarketOpen(false)
            setMobileView('Chart')
          }}
          onClose={() => setMarketOpen(false)}
        />
      </div>

      <DesktopStatus />

      <MobileView
        view={mobileView}
        markets={filteredMarkets}
        selectedSymbol={selectedSymbol}
        search={search}
        terminalTab={terminalTab}
        darkMode={darkMode}
        onSearchChange={setSearch}
        onSelectSymbol={setSelectedSymbol}
        onViewChange={setMobileView}
        onTerminalTabChange={setTerminalTab}
        onOrderSideChange={setOrderSide}
        onOpenOrder={() => setOrderOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleTheme={toggleTheme}
      />

      <MobileBottomNav activeView={mobileView} onChange={goMobile} />

      {settingsOpen && (
        <SettingsPanel
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {orderOpen && (
        <OrderModal
          market={market}
          side={orderSide}
          volume={volume}
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  )
}

function getStoredTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.localStorage.getItem('acg-theme') ?? 'dark'
}

function TopBar({ onSettings, onOpenQuotes }) {
  return (
    <header className="acg-topbar">
      <div className="brand">
        <div className="brand-icon">a</div>
        <div><strong>ACG</strong> TRADER</div>
      </div>
      <div className="account-chip"><span className="live-dot" /> ACG-FUNDED <span>·</span> Account 1048217 <span>·</span> Demo</div>
      <div className="top-actions">
        <span className="balance-mini">Balance <strong className="tabular-nums">$100 000.00</strong></span>
        <button type="button" onClick={onSettings} aria-label="Settings"><Settings2 size={17} /></button>
        <button type="button" className="mobile-only" onClick={onOpenQuotes} aria-label="Open quotes"><Menu size={18} /></button>
      </div>
    </header>
  )
}

function DrawingRail() {
  return (
    <aside className="drawing-rail" aria-label="Chart tools">
      <ToolButton label="Cursor">↖</ToolButton>
      <ToolButton label="Crosshair"><Crosshair size={16} /></ToolButton>
      <ToolButton label="Trend line">╱</ToolButton>
      <ToolButton label="Horizontal line"><Minus size={16} /></ToolButton>
      <ToolButton label="Text"><TextCursorInput size={16} /></ToolButton>
      <div className="rail-spacer" />
      <ToolButton label="Objects"><Settings2 size={16} /></ToolButton>
      <ToolButton label="More"><MoreHorizontal size={17} /></ToolButton>
    </aside>
  )
}

function ChartToolbar({ chartType, timeframe, onChartTypeChange, onTimeframeChange }) {
  return (
    <div className="chart-toolbar">
      <div className="view-modes">
        <ChartModeButton active={chartType === 'candles'} onClick={() => onChartTypeChange('candles')}><CandlestickChart size={15} /></ChartModeButton>
        <ChartModeButton active={chartType === 'line'} onClick={() => onChartTypeChange('line')}><LineChart size={15} /></ChartModeButton>
      </div>
      <div className="tf-scroll">
        {TIMEFRAMES.map((item) => (
          <button key={item} type="button" className={timeframe === item ? 'active' : ''} onClick={() => onTimeframeChange(item)}>{item}</button>
        ))}
      </div>
      <div className="chart-actions">
        <ToolbarButton label="Zoom out"><Minus size={15} /></ToolbarButton>
        <ToolbarButton label="Zoom in"><Plus size={15} /></ToolbarButton>
        <ToolbarButton label="Indicators"><SlidersHorizontal size={15} /></ToolbarButton>
        <ToolbarButton label="Calendar"><CalendarDays size={15} /></ToolbarButton>
        <ToolbarButton label="Fullscreen"><Expand size={15} /></ToolbarButton>
      </div>
    </div>
  )
}

function ChartModeButton({ active, onClick, children }) {
  return <button className={active ? 'active' : ''} type="button" onClick={onClick}>{children}</button>
}

function ToolbarButton({ label, children }) {
  return <button type="button" aria-label={label} title={label}>{children}</button>
}

function ChartTitle({ market, timeframe, onOpenMarketWatch }) {
  return (
    <div className="chart-title-row">
      <div><strong>{market.symbol} · {timeframe}</strong><span className="live-badge">LIVE</span></div>
      <button type="button" className="market-mobile-button" onClick={onOpenMarketWatch}><Search size={15} /> Market Watch</button>
    </div>
  )
}

function ChartWorkspace({ market, selectedSymbol, timeframe, chartType, volume, pulse, onVolumeChange, onQuickOrder }) {
  return (
    <div className="chart-wrap">
      <TradingChart symbol={selectedSymbol} timeframe={timeframe} chartType={chartType} showPriceAxis gridLines />
      <div className="price-marker tabular-nums">{formatPrice(market.bid, market.digits)}</div>
      <div className="quick-trade">
        <QuickSide side="sell" label="SELL" value={market.bid} digits={market.digits} pulse={pulse} onClick={() => onQuickOrder('Sell')} />
        <LotControl volume={volume} onChange={onVolumeChange} />
        <QuickSide side="buy" label="BUY" value={market.ask} digits={market.digits} pulse={pulse} onClick={() => onQuickOrder('Buy')} />
      </div>
    </div>
  )
}

function QuickSide({ side, label, value, digits, pulse, onClick }) {
  return (
    <button className={`quick-side ${side}`} type="button" onClick={onClick}>
      <span>{label}</span>
      <strong className={`tabular-nums ${pulse ? 'quote-pulse' : ''}`}>{formatPrice(value, digits)}</strong>
    </button>
  )
}

function LotControl({ volume, onChange }) {
  return (
    <div className="lot-control">
      <button type="button" onClick={() => onChange(-0.01)} aria-label="Decrease volume"><Minus size={14} /></button>
      <strong className="tabular-nums">{volume.toFixed(2)}</strong>
      <span>LOT</span>
      <button type="button" onClick={() => onChange(0.01)} aria-label="Increase volume"><Plus size={14} /></button>
    </div>
  )
}

function TerminalPanel({ activeTab, onTabChange, onCreateOrder }) {
  return (
    <section className="terminal-panel">
      <div className="account-bar">
        {ACCOUNT_METRICS.map(([label, value]) => (
          <span key={label}>{label}: <strong className="tabular-nums">{value}</strong></span>
        ))}
      </div>
      <div className="terminal-tabs">
        {TERMINAL_TABS.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => onTabChange(tab)}>
            {tab}{tab === 'Positions' ? ' (0)' : ''}
          </button>
        ))}
        <button className="new-order" type="button" onClick={onCreateOrder}>+ Create New Order</button>
      </div>
      {activeTab === 'History' ? (
        <HistoryTable />
      ) : (
        <EmptyState
          label={activeTab === 'Positions' ? 'No open positions yet' : 'No pending orders yet'}
          onPlaceTrade={onCreateOrder}
        />
      )}
    </section>
  )
}

function MarketWatch({ markets, selectedSymbol, open, search, onSearchChange, onSelect, onClose }) {
  return (
    <aside className={`market-watch ${open ? 'mobile-open' : ''}`}>
      <div className="watch-head">
        <div><span>MARKET WATCH</span><strong>Forex CFDs</strong></div>
        <button type="button" className="close-watch mobile-only" onClick={onClose} aria-label="Close market watch"><X size={18} /></button>
      </div>
      <label className="symbol-search">
        <Search size={15} />
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search symbol" />
      </label>
      <div className="watch-cols"><span>Symbol</span><span>Bid</span><span>Ask</span><span>Daily Ch...</span></div>
      <div className="watch-list">
        {markets.map((market) => (
          <button key={market.symbol} className={`watch-row ${selectedSymbol === market.symbol ? 'selected' : ''}`} type="button" onClick={() => onSelect(market.symbol)}>
            <span><strong>{market.symbol}</strong><small>{market.name}</small></span>
            <span className="tabular-nums">{formatPrice(market.bid, market.digits)}</span>
            <span className="tabular-nums">{formatPrice(market.ask, market.digits)}</span>
            <span className={`tabular-nums ${changeClass(market.change)}`}>{market.change}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function DesktopStatus() {
  return (
    <footer className="desktop-status">
      <span><i className="live-dot" /> Connected</span>
      <span>Server time 19:54:22</span>
      <span>Latency 24 ms</span>
      <span className="risk-summary">Daily Loss 0.42% · Max Loss 0.51%</span>
    </footer>
  )
}

function MobileBottomNav({ activeView, onChange }) {
  const items = [
    ['Quotes', BarChart3],
    ['Chart', Crosshair],
    ['Trade', SlidersHorizontal],
    ['History', History],
    ['More', MoreHorizontal],
  ]

  return (
    <nav className="mobile-bottom-nav">
      {items.map(([label, Icon]) => (
        <button key={label} type="button" className={activeView === label ? 'active' : ''} onClick={() => onChange(label)}>
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

function SettingsPanel({ darkMode, onToggleTheme, onClose }) {
  return (
    <div className="settings-popover settings-panel">
      <div className="settings-header">
        <strong>Settings</strong>
        <button type="button" onClick={onClose} aria-label="Close settings"><X size={17} /></button>
      </div>
      <div className="settings-section">
        <div className="settings-copy"><strong>Appearance</strong><span>{darkMode ? 'Dark mode' : 'Light mode'}</span></div>
        <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
      </div>
      <div className="settings-section">
        <div className="settings-copy"><strong>One-click trading</strong><span>Enabled</span></div>
        <span className="settings-on">ON</span>
      </div>
    </div>
  )
}

function ThemeToggle({ darkMode, onToggle }) {
  return (
    <button type="button" className={`theme-toggle ${darkMode ? 'on' : ''}`} onClick={onToggle} aria-label="Toggle dark mode">
      <span className="theme-toggle-knob">{darkMode ? <Moon size={11} /> : <Sun size={11} />}</span>
    </button>
  )
}

function MobileView({ view, markets, selectedSymbol, search, terminalTab, darkMode, onSearchChange, onSelectSymbol, onViewChange, onTerminalTabChange, onOrderSideChange, onOpenOrder, onOpenSettings, onToggleTheme }) {
  if (view === 'Chart') return null

  const close = <IconButton label="Close" onClick={() => onViewChange('Chart')}><X size={17} /></IconButton>

  if (view === 'Quotes') {
    return (
      <MobileSurface title="Quotes" darkMode={darkMode} close={close}>
        <div className="mobile-content"><label className="symbol-search quote-search"><Search size={15} /><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search symbol" /></label></div>
        <div className="mobile-quote-list">
          {markets.map((market) => (
            <button key={market.symbol} type="button" className={`mobile-quote-row ${selectedSymbol === market.symbol ? 'selected' : ''}`} onClick={() => { onSelectSymbol(market.symbol); onViewChange('Chart') }}>
              <span><strong>{market.symbol}</strong><small>{market.name}</small></span>
              <span className="mobile-quote-values tabular-nums"><strong>{formatPrice(market.bid, market.digits)}</strong><span>{formatPrice(market.ask, market.digits)} · <em className={changeClass(market.change)}>{market.change}</em></span></span>
            </button>
          ))}
        </div>
      </MobileSurface>
    )
  }

  if (view === 'Trade') {
    return (
      <MobileSurface title="Trade" darkMode={darkMode} headerAction={<button type="button" className="mobile-primary" onClick={() => { onOrderSideChange('Buy'); onOpenOrder() }}>+ New Order</button>}>
        <div className="mobile-metric-grid">
          <Metric label="Balance" value="$100,000.00" />
          <Metric label="Equity" value="$100,000.00" />
          <Metric label="Free Margin" value="$100,000.00" />
          <Metric label="Margin Level" value="—" />
        </div>
        <div className="mobile-card mobile-trade-card">
          <div className="mobile-tabs">
            {['Positions', 'Orders'].map((tab) => (
              <button key={tab} type="button" className={terminalTab === tab ? 'active' : ''} onClick={() => onTerminalTabChange(tab)}>{tab}</button>
            ))}
          </div>
          <EmptyState
            label={terminalTab === 'Positions' ? 'No open positions yet' : 'No pending orders yet'}
            onPlaceTrade={() => { onOrderSideChange('Buy'); onOpenOrder() }}
          />
        </div>
        <div className="mobile-card mobile-risk-card">
          <div className="risk-title">ACG CHALLENGE</div>
          <div className="risk-status">● SAFE</div>
          <div className="risk-list">{RISK_ROWS.map(([label, value]) => <RiskRow key={label} label={label} value={value} />)}</div>
        </div>
      </MobileSurface>
    )
  }

  if (view === 'History') {
    return (
      <MobileSurface title="History" darkMode={darkMode} headerAction={<span className="mobile-muted">Today</span>}>
        <div className="mobile-history-list">
          {HISTORY_ROWS.map((row) => (
            <button key={row.ticket} type="button" className="mobile-history-row">
              <div><strong>{row.symbol}</strong><strong className="profit tabular-nums">{row.profit}</strong></div>
              <div><span>{row.type} {row.volume}</span><span className="tabular-nums">{row.price}</span><span>{row.time}</span></div>
            </button>
          ))}
        </div>
      </MobileSurface>
    )
  }

  return (
    <MobileSurface title="More" darkMode={darkMode} close={close}>
      <div className="mobile-more-list">
        <div className="mobile-card mobile-appearance-card">
          <div className="mobile-setting-row">
            <div className="settings-copy"><strong>Appearance</strong><span>{darkMode ? 'Dark mode' : 'Light mode'}</span></div>
            <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
          </div>
        </div>
        {['Challenge & Risk', 'Alerts', 'Economic Calendar', 'Trade Journal', 'Account', 'Settings', 'Help'].map((item) => (
          <button key={item} type="button" className="mobile-more-item" onClick={() => {
            if (item === 'Challenge & Risk') onViewChange('Trade')
            if (item === 'Settings') onOpenSettings()
          }}>
            {item}<span>›</span>
          </button>
        ))}
      </div>
    </MobileSurface>
  )
}

function MobileSurface({ title, darkMode, headerAction, close, children }) {
  return (
    <section className="mobile-view-surface">
      <div className="mobile-view-header">
        <strong>{title}</strong>
        {headerAction ?? close}
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value }) {
  return <div className="mobile-metric-card"><span>{label}</span><strong className="tabular-nums">{value}</strong></div>
}

function RiskRow({ label, value }) {
  return <div><span>{label}</span><strong className="tabular-nums">{value}</strong></div>
}

function IconButton({ label, onClick, children }) {
  return <button type="button" className="icon-button" onClick={onClick} aria-label={label}>{children}</button>
}

function ToolButton({ children, label }) {
  return <button type="button" className="tool-button" title={label}>{children}</button>
}

function EmptyState({ label, onPlaceTrade }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><History size={18} /></div>
      <strong>{label}</strong>
      <span>Your active trades will appear here.</span>
      {onPlaceTrade && <button type="button" className="empty-cta" onClick={onPlaceTrade}>Place a trade</button>}
    </div>
  )
}

function HistoryTable() {
  return (
    <div className="history-table">
      <div className="history-head"><span>Symbol</span><span>Ticket</span><span>Time</span><span>Type</span><span>Volume</span><span>Price</span><span>Profit</span></div>
      {HISTORY_ROWS.map((row) => (
        <div className="history-row" key={row.ticket}>
          <span>{row.symbol}</span>
          <span>{row.ticket}</span>
          <span>{row.time}</span>
          <span>{row.type}</span>
          <span className="tabular-nums">{row.volume}</span>
          <span className="tabular-nums">{row.price}</span>
          <span className="profit tabular-nums">{row.profit}</span>
        </div>
      ))}
    </div>
  )
}

function OrderModal({ market, side, volume, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="order-modal">
        <div className="modal-head">
          <div><span>NEW ORDER</span><strong>{market.symbol}</strong></div>
          <button type="button" onClick={onClose} aria-label="Close order"><X size={18} /></button>
        </div>
        <div className="modal-quote">
          <div className="modal-sell"><span>SELL</span><strong className="tabular-nums">{formatPrice(market.bid, market.digits)}</strong></div>
          <div className="modal-mid">{volume.toFixed(2)} LOT</div>
          <div className="modal-buy"><span>BUY</span><strong className="tabular-nums">{formatPrice(market.ask, market.digits)}</strong></div>
        </div>
        <label>Order type<select><option>Market Execution</option><option>Pending Order</option></select></label>
        <div className="two-inputs"><label>Stop Loss<input placeholder="Optional" /></label><label>Take Profit<input placeholder="Optional" /></label></div>
        <button type="button" className={side === 'Buy' ? 'submit-buy' : 'submit-sell'} onClick={onClose}>Place {side} Order</button>
        <p>Execution is simulated in the frontend; risk and broker adapters will connect to the live engine.</p>
      </div>
    </div>
  )
}
