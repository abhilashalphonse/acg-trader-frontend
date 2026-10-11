import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('V4 preview has its own Firebase PR-only HTML and React entry point', () => {
 const main = read('src/main.jsx');
 const preview = read('src/previewOrderTicketMain.jsx');
 const html = read('preview-order-ticket.html');
 const pr = read('.github/workflows/firebase-hosting-pull-request.yml');
 const prod = read('.github/workflows/firebase-hosting-live.yml');
 assert.match(main, /<SessionGate>/);
 assert.doesNotMatch(main, /OrderTicketV4Preview/);
 assert.match(preview, /import OrderTicketV4Preview/);
 assert.match(preview, /createRoot\(document\.getElementById\('root'\)\)/);
 assert.doesNotMatch(preview, /^\s*import[^\n]*(?:AuthProvider|SessionGate|TradingProvider|\.\/App\.jsx)/m);
 assert.match(html, /ACG Trader V4 Execution Design Preview/);
 assert.match(html, /\/src\/previewOrderTicketMain\.jsx/);
 assert.doesNotMatch(html, /Loading ACG Trader/);
 assert.match(pr, /cp preview-order-ticket\.html index\.html/);
 assert.match(pr, /grep -q 'ACG Trader V4 Execution Design Preview' dist\/index\.html/);
 assert.doesNotMatch(prod, /preview-order-ticket|VITE_ACG_V4_DESIGN_PREVIEW/);
});

test('V4 design studio has no live-data, auth or execution dependencies', () => {
 const preview = read('src/components/trading-v2/desktop/OrderTicketV4Preview.jsx');
 assert.doesNotMatch(preview, /from ['"][^'"]*(?:AuthProvider|TradingProvider|useTraderAuth|TradingTerminalV2|tradingApi|useTradingStore|WebSocket)/);
 assert.doesNotMatch(preview, /\b(fetch\s*\(|WebSocket\s*\(|onManualOrder\s*\(|onExecutePlan\s*\()/);
 assert.match(preview, /synthetic-data design preview/);
 assert.match(preview, /No order was sent/);
 assert.match(preview, /DEMO \/ NO EXECUTION/);
});

test('V4 modes and protections have direct interactive controls', () => {
 const preview = read('src/components/trading-v2/desktop/OrderTicketV4Preview.jsx');
 for(const name of ['Risk $','Risk %','Stop Loss','Take Profit','Limit','Stop Limit','GTC','Custom','Calculated volume','Risk / Reward','Margin required','Free after']) {
   assert.ok(preview.includes(name), 'missing design control: ' + name);
 }
 assert.match(preview, /setTpPrice\(Number\(p\.toFixed\(2\)\)\)/);
 assert.match(preview, /targetRisk \/ \(slDistance \* QUOTES\.contractSize\)/);
});

test('V4 is chart-black with no blue UI selection and compact 330px option', () => {
 const css = read('src/components/trading-v2/desktop/OrderTicketV4Preview.css');
 const jsx = read('src/components/trading-v2/desktop/OrderTicketV4Preview.jsx');
 assert.match(css, /--v4-bg:#09090b/);
 assert.match(css, /\.v4-pick\.is-on \{[^}]*#68686f/);
 assert.match(css, /\.v4-buy \{ background: #195be1/);
 assert.match(css, /\.v4-sell \{ background: #cd2139/);
 assert.doesNotMatch(css.replace(/\.v4-buy \{[^}]*\}/g, ''), /#195be1/i);
 assert.match(jsx, /330px dock/);
 assert.match(css, /@container \(max-width: 390px\)/);
});

test('Market/Pending uses a white capsule with black text, scoped to that selector only', () => {
 const css = read('src/components/trading-v2/desktop/OrderTicketV4Preview.css');
 const jsx = read('src/components/trading-v2/desktop/OrderTicketV4Preview.jsx');
 assert.match(jsx, /className="v4-segment v4-mainmodes"/);
 assert.match(css, /\.v4-mainmodes \{[\s\S]*?border-radius: 999px/);
 assert.match(css, /\.v4-mainmodes \.v4-pick\.is-on,[\s\S]*?background: #f7f7f8;/);
 assert.match(css, /\.v4-mainmodes \.v4-pick\.is-on,[\s\S]*?color: #0b0c0e;/);
 assert.match(css, /\.v4-mainmodes \.v4-pick:hover:not\(\.is-on\)/);
 assert.match(css, /\.v4-pick\.is-on \{ color: #fff/);
});
