import { useMemo, useState } from 'react'
import './App.css'

const markets = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', bid: '1.17482', ask: '1.17496', change: '+0.18', digits: 5 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', bid: '1.35648', ask: '1.35664', change: '+0.24', digits: 5 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', bid: '147.982', ask: '148.004', change: '-0.11', digits: 3 },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', bid: '0.79642', ask: '0.79658', change: '+0.09', digits: 5 },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', bid: '0.66224', ask: '0.66238', change: '-0.07', digits: 5 },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', bid: '1.38162', ask: '1.38178', change: '+0.13', digits: 5 },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', bid: '0.60384', ask: '0.60400', change: '+0.05', digits: 5 },
]

const candles = [
  18, 21, 20, 25, 24, 29, 27, 31, 34, 29, 32, 37, 35, 39, 42, 38, 45, 44, 47, 50, 48, 53, 49, 55, 58, 54, 61, 64, 62, 66, 63, 69, 71, 68, 74, 78, 75, 81, 79, 84, 87, 83, 89, 92, 88, 95,
]

const positions = [
  { ticket: '1048217', symbol: 'EURUSD', type: 'Buy', volume: '0.10', price: '1.17394', sl: '1.17180', tp: '1.17850', profit: '+$8.80' },
  { ticket: '1048272', symbol: 'GBPUSD', type: 'Sell', volume: '0.05', price: '1.35790', sl: '1.36120', tp: '1.35150', profit: '-$7.10' },
]

const orders = [
  { ticket: '1048304', symbol: 'EURUSD', type: 'Buy Limit', volume: '0.10', price: '1.17220', status: 'Pending' },
  { ticket: '1048311', symbol: 'USDJPY', type: 'Sell Stop', volume: '0.10', price: '147.600', status: 'Pending' },
]

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD')
  const [timeframe, setTimeframe] = useState('M15')
  const [orderSide, setOrderSide] = useState('Buy')
  const [volume, setVolume] = useState(0.1)
  const [activePanel, setActivePanel] = useState('Positions')
  const [chartCount, setChartCount] = useState(1)
  const [showMarketDepth, setShowMarketDepth] = useState(false)
  const [search, setSearch] = useState('')

  const market = useMemo(
    () => markets.find((item) => item.symbol === selectedSymbol) ?? markets[0],
    [selectedSymbol],
  )

  const filteredMarkets = markets.filter((item) =>
    `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase()),
  )

  const increaseVolume = () => setVolume((value) => Math.min(10, Number((value + 0.01).toFixed(2))))
  const decreaseVolume = () => setVolume((value) => Math.max(0.01, Number((value - 0.01).toFixed(2))))

  return (
    <div className="terminal-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">a</span>
          <span>ACG <strong>TRADER</strong></span>
        </div>
        <div className="account-strip">
          <div className="connection-dot" />
          <span className="account-label">ACG-FUNDED</span>
          <span className="account-number">#1048217</span>
          <span className="account-separator" />
          <span>Balance</span>
          <strong>$100,482.31</strong>
          <span>Equity</span>
          <strong className="positive">$100,491.11</strong>
          <button className="icon-button" type="button" aria-label="Account menu">⋮</button>
        </div>
      </header>

      <div className="toolbar">
        <div className="symbol-select">
          <span className="symbol-dot" />
          <select value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value)}>
            {markets.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}
          </select>
          <span className="quote">{market.bid} / {market.ask}</span>
        </div>
        <div className="timeframes" aria-label="Timeframe">
          {['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((item) => (
            <button key={item} className={timeframe === item ? 'active' : ''} type="button" onClick={() => setTimeframe(item)}>{item}</button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={() => setShowMarketDepth((value) => !value)} className={showMarketDepth ? 'toolbar-active' : ''}>Depth</button>
          <button type="button" onClick={() => setChartCount((value) => value === 4 ? 1 : value + 1)}>▦ {chartCount}</button>
          <button type="button">⌖</button>
          <button type="button">⚙</button>
        </div>
      </div>

      <main className="workspace">
        <aside className="watchlist-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">MARKET WATCH</span><strong>Forex</strong></div>
            <button type="button" className="small-button">＋</button>
          </div>
          <label className="search-box">
            <span>⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search symbol" />
          </label>
          <div className="watchlist-header"><span>Symbol</span><span>Bid</span><span>Ask</span></div>
          <div className="watchlist">
            {filteredMarkets.map((item) => (
              <button key={item.symbol} type="button" className={`market-row ${selectedSymbol === item.symbol ? 'selected' : ''}`} onClick={() => setSelectedSymbol(item.symbol)}>
                <span><strong>{item.symbol}</strong><small>{item.name}</small></span>
                <span>{item.bid}</span>
                <span>{item.ask}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="center-column">
          <div className="chart-panel">
            <div className="chart-header">
              <div>
                <div className="instrument-title"><strong>{market.symbol}</strong><span>Forex</span></div>
                <div className="price-line"><span className="bid-price">{market.bid}</span><span className="slash">/</span><span className="ask-price">{market.ask}</span><span className="change">{market.change}%</span></div>
              </div>
              <div className="chart-tools">
                <button type="button">☰</button>
                <button type="button">⌁</button>
                <button type="button">✚</button>
                <button type="button">⤢</button>
              </div>
            </div>

            <div className="chart-area">
              <div className="price-scale"><span>1.1790</span><span>1.1770</span><span>1.1750</span><span>1.1730</span><span>1.1710</span></div>
              <div className="chart-grid">
                <div className="grid-line one" /><div className="grid-line two" /><div className="grid-line three" /><div className="grid-line four" />
                <div className="candles">
                  {candles.map((height, index) => {
                    const rising = index % 4 !== 1
                    const wick = 7 + (index % 5) * 2
                    return <div className={`candle ${rising ? 'up' : 'down'}`} style={{ '--h': `${height}px`, '--wick': `${wick}px` }} key={`${height}-${index}`}><span /></div>
                  })}
                </div>
                <div className="last-price"><span>{market.bid}</span></div>
                <div className="time-scale"><span>09:00</span><span>10:00</span><span>11:00</span><span>12:00</span><span>13:00</span><span>14:00</span></div>
              </div>
              <div className="chart-overlay"><span>ACG Trader · {timeframe}</span><span>Bid</span></div>
            </div>

            <div className="quick-trade-bar">
              <div className="quick-label">ONE-CLICK TRADING</div>
              <button className="quick-sell" type="button" onClick={() => setOrderSide('Sell')}><small>SELL</small><strong>{market.bid}</strong></button>
              <div className="quick-volume">{volume.toFixed(2)}<span>lots</span></div>
              <button className="quick-buy" type="button" onClick={() => setOrderSide('Buy')}><small>BUY</small><strong>{market.ask}</strong></button>
            </div>
          </div>

          {showMarketDepth && (
            <div className="depth-panel">
              <div className="panel-title"><span>DEPTH OF MARKET</span><strong>{market.symbol}</strong></div>
              {[1, 2, 3, 4].map((row) => <div className="depth-row" key={row}><span>{(Number(market.ask) + row * 0.00002).toFixed(5)}</span><span>{row * 10000}</span><span>{(Number(market.bid) - row * 0.00002).toFixed(5)}</span><span>{row * 12000}</span></div>)}
            </div>
          )}

          <section className="trade-terminal-panel">
            <div className="tabs">
              {['Positions', 'Orders', 'History'].map((item) => <button key={item} type="button" className={activePanel === item ? 'active' : ''} onClick={() => setActivePanel(item)}>{item}<span>{item === 'Positions' ? positions.length : item === 'Orders' ? orders.length : 18}</span></button>)}
            </div>
            {activePanel === 'Positions' && <TradeTable rows={positions} type="positions" />}
            {activePanel === 'Orders' && <TradeTable rows={orders} type="orders" />}
            {activePanel === 'History' && <HistoryTable />}
          </section>
        </section>

        <aside className="order-panel">
          <div className="order-heading">
            <span className="eyebrow">NEW ORDER</span>
            <button className="small-button" type="button">×</button>
          </div>
          <div className="order-instrument"><strong>{market.symbol}</strong><span>Forex CFD · {timeframe}</span></div>
          <div className="side-toggle">
            <button type="button" className={orderSide === 'Buy' ? 'buy-active' : ''} onClick={() => setOrderSide('Buy')}>Buy</button>
            <button type="button" className={orderSide === 'Sell' ? 'sell-active' : ''} onClick={() => setOrderSide('Sell')}>Sell</button>
          </div>
          <label className="field"><span>Order type</span><select><option>Market Execution</option><option>Buy Limit</option><option>Sell Limit</option><option>Buy Stop</option><option>Sell Stop</option></select></label>
          <label className="field"><span>Volume</span><div className="number-control"><button type="button" onClick={decreaseVolume}>−</button><input value={volume.toFixed(2)} onChange={(event) => setVolume(Math.max(0.01, Number(event.target.value) || 0.01))} /><span>lots</span><button type="button" onClick={increaseVolume}>＋</button></div></label>
          <div className="price-pair"><div><span>Bid</span><strong>{market.bid}</strong></div><div><span>Ask</span><strong>{market.ask}</strong></div></div>
          <label className="field"><span>Stop Loss <em>optional</em></span><input placeholder="Price" /></label>
          <label className="field"><span>Take Profit <em>optional</em></span><input placeholder="Price" /></label>
          <button className={`place-order ${orderSide.toLowerCase()}`} type="button">{orderSide} {market.symbol}<span>{orderSide === 'Buy' ? market.ask : market.bid}</span></button>
          <div className="trade-hint"><span>⌁</span><p>One-click trading is enabled. Orders are sent at market price.</p></div>
          <div className="risk-summary"><div><span>Margin</span><strong>$117.50</strong></div><div><span>Free margin</span><strong>$99,874.61</strong></div></div>
        </aside>
      </main>

      <footer className="statusbar">
        <div><span className="status-dot" /> Connected · Demo environment</div>
        <div>Data <strong>24 ms</strong></div>
        <div>Server time <strong>15:06:24</strong></div>
        <div className="footer-right">ACG Trader · Forex CFDs</div>
      </footer>
    </div>
  )
}

function TradeTable({ rows, type }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Ticket</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>SL</th><th>TP</th><th>{type === 'positions' ? 'P&L' : 'Status'}</th><th /></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.ticket}><td className="muted">{row.ticket}</td><td><strong>{row.symbol}</strong></td><td><span className={row.type.includes('Buy') ? 'trade-buy' : 'trade-sell'}>{row.type}</span></td><td>{row.volume}</td><td>{row.price}</td><td>{row.sl || '—'}</td><td>{row.tp || '—'}</td><td className={row.profit?.startsWith('+') ? 'positive' : row.profit ? 'negative' : ''}>{row.profit || row.status}</td><td><button className="row-action" type="button">•••</button></td></tr>)}</tbody>
      </table>
    </div>
  )
}

function HistoryTable() {
  const history = [
    ['1048172', 'EURUSD', 'Buy', '0.10', '1.17104', '+$26.20'],
    ['1047903', 'USDJPY', 'Sell', '0.20', '148.410', '+$14.90'],
    ['1047428', 'GBPUSD', 'Buy', '0.10', '1.35220', '+$18.40'],
  ]
  return <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Close</th><th>P&L</th><th>Time</th></tr></thead><tbody>{history.map((item, index) => <tr key={item[0]}><td className="muted">{item[0]}</td><td><strong>{item[1]}</strong></td><td>{item[2]}</td><td>{item[3]}</td><td>{item[4]}</td><td className="positive">{item[5]}</td><td>Today {14 - index}:2{index}</td></tr>)}</tbody></table></div>
}

export default App
