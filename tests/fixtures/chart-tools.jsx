// Development-only fixture using real chart components and deterministic candles.
// Not an application entry point; never authenticates or submits orders.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/auth/AuthProvider.jsx';
import { TradingContext } from '../../src/store/TradingProvider.jsx';
import ChartArea from '../../src/components/trading-v2/ChartArea.jsx';
import IndicatorManager from '../../src/components/trading-v2/IndicatorManager.jsx';
import { createIndicator } from '../../src/utils/indicators.js';
import { getDrawingSnapshot } from '../../src/utils/drawingStore.js';
import '../../src/index.css';
import '../../src/styles/acg-pure-black.css';
import '../../src/styles/chart-tools.css';

const candles = Array.from({ length: 180 }, (_, i) => {
  const open = 1.08 + i * 0.00003 + Math.sin(i * 0.4) * 0.0007;
  const close = open + Math.cos(i * 0.9) * 0.0004;
  return { time: 1790323200 + i * 60, open, high: Math.max(open, close) + 0.00025, low: Math.min(open, close) - 0.00025, close, volume: 150 + i % 23 * 30 };
});
window.fetch = async request => {
  if (String(request).includes('/v1/market/candles')) return new Response(JSON.stringify({ candles, pagination: { hasMore: false } }), { headers: { 'Content-Type': 'application/json' } });
  throw new Error('The chart fixture blocks backend requests.');
};
const auth = { authenticated: true };
const store = { market: { candlesByKey: {} }, connection: { status: 'connected' }, subscribeMarket: () => () => {} };
const instrument = { symbol: 'EURUSD', digits: 5, tickSize: 0.00001, pipSize: 0.0001, sessionOpen: true };

export default function Fixture() {
  const [indicators, setIndicators] = useState([createIndicator('ema'), createIndicator('rsi')]);
  const [favorites, setFavorites] = useState(['ema', 'rsi']);
  const [tool, setTool] = useState('cursor');
  const [focus, setFocus] = useState(null);
  const remove = id => setIndicators(items => items.filter(item => item.instanceId !== id));
  const toggle = id => setIndicators(items => items.map(item => item.instanceId === id ? { ...item, visible: !item.visible } : item));
  useEffect(() => { window.chartToolsQA = { indicators, drawings: () => getDrawingSnapshot('EURUSD').present }; }, [indicators]);
  return <AuthContext.Provider value={auth}><TradingContext.Provider value={store}>
    <header className="fixture-header"><strong>ACG Trader <span> / Chart workspace</span></strong><span>TEST FIXTURE · SYNTHETIC DATA</span></header>
    <main className="fixture-layout"><section className="fixture-chart" aria-label="Analysis chart"><ChartArea symbol="EURUSD" instrument={instrument} chartTimeframe="M1" chartMode="candles" price={candles.at(-1).close} ask={candles.at(-1).close + .0001} selectedTool={tool} onSelectTool={setTool} indicators={indicators} onToggleIndicator={toggle} onRemoveIndicator={remove} onOpenIndicatorSettings={setFocus} embedded desktopEnhanced /></section>
      <aside className="fixture-library"><div className="fixture-library-title"><strong>Indicators</strong><span>Build your analysis</span></div><IndicatorManager applied={indicators} favorites={favorites} focusInstanceId={focus} onAdd={id => setIndicators(items => [...items, createIndicator(id)])} onRemove={remove} onToggleVisible={toggle} onUpdate={(id, patch) => setIndicators(items => items.map(item => item.instanceId === id ? { ...item, settings: { ...item.settings, ...patch } } : item))} onToggleFavorite={id => setFavorites(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id])} /></aside>
    </main>
    <style>{`.fixture-header{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px 24px;border-bottom:1px solid #2a303a;font:13px system-ui;color:#e1e8f2}.fixture-header span{color:#99a7ba;font-size:11px}.fixture-layout{display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:16px;padding:16px;align-items:start}.fixture-chart{height:650px;min-width:0}.fixture-library{background:#0e1116;border:1px solid #2a303a;border-radius:12px;padding:20px;min-width:0}.fixture-library-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;font:16px system-ui}.fixture-library-title span{color:#99a7ba;font-size:12px}@media(max-width:800px){.fixture-layout{grid-template-columns:minmax(0,1fr);padding:8px}.fixture-chart{height:440px}.fixture-library{padding:14px}.fixture-header{padding:14px}}`}</style>
  </TradingContext.Provider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
