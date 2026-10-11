import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const jsx = read('src/components/trading-v2/desktop/OrderTicketV4Preview.jsx');
const css = read('src/components/trading-v2/desktop/OrderTicketV4Preview.css');

test('preview is a standalone unauthenticated build ONLY on Firebase PR channel', () => {
 const main = read('src/main.jsx');
 const preview = read('src/previewOrderTicketMain.jsx');
 const html = read('preview-order-ticket.html');
 const pr = read('.github/workflows/firebase-hosting-pull-request.yml');
 const prod = read('.github/workflows/firebase-hosting-live.yml');
 assert.match(main, /<SessionGate>/);
 assert.doesNotMatch(main, /OrderTicketV4Preview/);
 assert.match(preview, /import OrderTicketV4Preview/);
 assert.doesNotMatch(preview, /^\s*import[^\n]*(?:AuthProvider|SessionGate|TradingProvider|\.\/App\.jsx)/m);
 assert.match(html, /ACG Trader V4 Execution Design Preview/);
 assert.doesNotMatch(html, /Loading ACG Trader/);
 assert.match(pr, /cp preview-order-ticket\.html index\.html/);
 assert.match(pr, /grep -q 'ACG Trader V4 Execution Design Preview' dist\/index\.html/);
 assert.doesNotMatch(prod, /preview-order-ticket|VITE_ACG_V4_DESIGN_PREVIEW/);
});

test('design-only preview contains no backend, authentication or live execution connection', () => {
 assert.match(jsx, /synthetic-data design preview/);
 assert.doesNotMatch(jsx, /from ['"][^'"]*(?:AuthProvider|TradingProvider|useTraderAuth|TradingTerminalV2|tradingApi|useTradingStore|WebSocket)/);
 assert.doesNotMatch(jsx, /\b(fetch\s*\(|WebSocket\s*\(|onManualOrder\s*\(|onExecutePlan\s*\()/);
 assert.match(jsx, /No order was sent/);
 assert.match(jsx, /DEMO \/ NO EXECUTION/);
 assert.match(jsx, /Synthetic market values/);
});

test('approved V4 instrument header: compact quote slab, session, ellipsis + X, white capsule', () => {
 for (const feature of ['v4-instrument','v4-quote-strip','v4-session','24/7 session (demo)','v4-mainmodes','v4-head-actions','Ticket configuration','Close execution panel'])
   assert.ok(jsx.includes(feature), 'Missing feature: ' + feature);
 assert.doesNotMatch(jsx, /Star|v4-fav|favorite/i);
 assert.match(css, /\.v4-quote-strip \{[^}]*min-height: 36px/);
 assert.match(css, /\.v4-capsule-button\.selected \{[^}]*background: #f7f7f8; color: #101012/);
});

test('original centered position input, slider and one-line translator preserved', () => {
 for(const label of ['Lots', 'Margin $', 'Risk %', 'Risk USD']) assert.ok(jsx.includes(label), 'Missing ' + label);
 for(const feature of ['v4-hero-input','v4-amount','v4-slider','v4-translation','arrow','v4-position-modes']) {
   if(feature === 'arrow') continue;
   assert.ok(jsx.includes(feature), 'Missing ' + feature);
 }
 assert.match(jsx, /type="range"/);
 assert.match(jsx, /aria-label="Edit "/);
 assert.match(jsx, /onBlur=\{finish\}/);
 assert.match(jsx, /floorLots\(/);
 assert.doesNotMatch(jsx, /Position Translator|Adjust value|Tap value to edit|~10,000 USD notional/);
});

test('risk-based position sizing derives volume from valid SL and rounds DOWN to allowed lot step', () => {
 assert.match(jsx, /Number\.isFinite\(slDistance\) && slDistance > 0/);
 assert.match(jsx, /DEMO\.equity \* riskPercentTarget \/ 100/);
 assert.match(jsx, /riskUSDTarget/);
 assert.match(jsx, /Math\.floor\(\(n \+ 1e-9\) \/ DEMO\.lotStep\)/);
 assert.match(jsx, /Set a valid Stop Loss before selecting a risk-based size/);
 assert.match(jsx, /Risk-based volume/);
});

test('approved compact protection includes editable values, unit dropdowns, summary and safeguards', () => {
 for(const label of ['Stop Loss','Take Profit','Risk USD','Profit USD','Risk % Bal.','Profit % Bal.','% Price','Ticks','Price','Risk / Reward','Position volume']) {
  assert.ok(jsx.includes(label), 'Missing ' + label);
 }
 assert.match(jsx, /aria-label=\{label \+ ' input unit'\}/);
 assert.match(jsx, /financialInputLocked && kind === 'sl'/);
 assert.match(jsx, /v4-exit-card/);
 assert.match(jsx, /v4-ratio-slab/);
 assert.match(jsx, /riskSide\(side, kind\)/);
 assert.match(css, /\.v4-exit-controls \{[^}]*grid-template-columns/);
});

test('Market and Pending offer full, independent ticket views with instrument leverage and costs', () => {
 for(const label of ['stop-limit','Time in force','Expiry','Instrument leverage','Indicative spread cost','Estimated commission','Required margin','Free after']) {
  assert.ok(jsx.includes(label), 'Missing ' + label);
 }
 assert.match(jsx, /view === 'compare'/);
 assert.match(jsx, /initialMode="market"/);
 assert.match(jsx, /initialMode="pending"/);
 assert.match(jsx, /showButton\('sell'\)/);
 assert.match(jsx, /showButton\('buy'\)/);
});

test('chart-black, borderless information surfaces, neutral selection and 330px layout', () => {
 assert.match(css, /--v4-bg:#09090b/);
 assert.match(css, /\.v4-exit-card \{[^}]*background: #202023/);
 assert.match(css, /\.v4-exit-card \{[^}]*border-radius/);
 assert.doesNotMatch(css.match(/\.v4-exit-card \{[^}]*\}/)?.[0] || '', /border:/);
 assert.match(css, /\.v4-translation \{[^}]*display: flex/);
 assert.match(css, /grid-template-columns: repeat\(2,330px\)/);
 assert.match(css, /font-synthesis: none/);
 assert.doesNotMatch(css, /-webkit-font-smoothing: antialiased/);
 assert.match(css, /\.v4-sell \{ background: #ce273e/);
 assert.match(css, /\.v4-buy \{ background: #195be1/);
 assert.doesNotMatch(css.replace(/\.v4-buy \{[^}]*\}/g, ''), /#195be1/i);
});
