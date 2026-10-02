// Local deterministic calibration; no live market or trading requests.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/auth/AuthProvider.jsx';
import { TradingContext } from '../../src/store/TradingProvider.jsx';
import TradingChart from '../../src/components/TradingChart.jsx';
import DesktopChartSettingsPopover from '../../src/components/trading-v2/desktop/DesktopChartSettingsPopover.jsx';
import { normalizeDesktopChartSettings } from '../../src/utils/desktopChartSettings.js';
import '../../src/index.css';

const instruments = {
  GBPUSD: { symbol: 'GBPUSD', digits: 5, tickSize: .00001, base: 1.32, unit: .001 },
  USDJPY: { symbol: 'USDJPY', digits: 3, tickSize: .001, base: 149, unit: .1 },
  XAUUSD: { symbol: 'XAUUSD', digits: 2, tickSize: .01, base: 2700, unit: 10 },
};
const lastTime = Date.UTC(2026, 9, 2, 14, 40) / 1000;
const data = Object.fromEntries(Object.entries(instruments).map(([symbol, instrument]) => [symbol,
  Array.from({ length: 120 }, (_, i) => {
    const open = instrument.base + instrument.unit * (i * .05 + Math.sin(i * .4));
    const close = open + Math.cos(i * .9) * instrument.unit * .4;
    return { time: lastTime - (119 - i) * 300, open, high: Math.max(open, close) + instrument.unit * .3,
      low: Math.min(open, close) - instrument.unit * .3, close };
  }),
]));
window.fetch = async input => {
  const url = new URL(String(input), window.location.origin);
  if (!url.pathname.endsWith('/v1/market/candles')) throw new Error('Fixture blocks external requests');
  return new Response(JSON.stringify({ candles: data[url.searchParams.get('symbol')], pagination: { hasMore: false } }), { headers: { 'Content-Type': 'application/json' } });
};
const store = { market: { candlesByKey: {} }, connection: { status: 'connected' }, subscribeMarket: () => () => {} };
const empty = [];
export default function Fixture() {
  const [symbol, setSymbol] = useState('GBPUSD');
  const [settings, setSettings] = useState(() => normalizeDesktopChartSettings(null));
  const [api, setApi] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const instrument = instruments[symbol];
  const last = data[symbol].at(-1).close;
  const windowStart = new Date((lastTime - (Math.min(120, settings.viewport.bars) - 1) * 300) * 1000).toISOString().slice(11, 16);
  return <AuthContext.Provider value={{ authenticated: true }}><TradingContext.Provider value={store}>
    <main style={{ width: 'min(1120px, 95vw)', margin: '24px auto', color: '#ddd', fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16 }}>
        <strong>Viewport calibration · synthetic M5 data</strong>
        <select aria-label="Instrument" value={symbol} onChange={event => setSymbol(event.target.value)} style={{ background: '#222' }}>
          {Object.keys(instruments).map(key => <option key={key}>{key}</option>)}
        </select>
        <button onClick={() => api?.resetView()}>Reset viewport</button>
        <button onClick={() => setSettingsOpen(!settingsOpen)}>Chart settings</button>
      </header>
      <p style={{ fontSize: 12, marginBottom: 12 }}>UTC · Initial window: {windowStart}–14:40 · Top {Math.round(settings.viewport.top * 100)}% / Bottom {Math.round(settings.viewport.bottom * 100)}% · {settings.viewport.bars} candles</p>
      <div style={{ height: 740, position: 'relative' }}>
        <TradingChart symbol={symbol} instrument={instrument} timeframe="M5" desktopEnhanced showBidAskLines
          indicators={empty} positions={empty} priceScaleAnchors={empty}
          candleAppearance={settings.candle} viewportSettings={settings.viewport} chartTimezone="UTC"
          bidPrice={last - instrument.tickSize * 2} askPrice={last + instrument.tickSize * 2} onCoordinateApi={setApi} />
        <DesktopChartSettingsPopover open={settingsOpen} settings={settings}
          onChange={next => setSettings(normalizeDesktopChartSettings(next))} onClose={() => setSettingsOpen(false)} />
      </div>
    </main>
  </TradingContext.Provider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
