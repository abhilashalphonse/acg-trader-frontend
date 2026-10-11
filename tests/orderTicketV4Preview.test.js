import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('unauthenticated V4 preview is an opt-in build-only route', () => {
 const main = read('src/main.jsx');
 const pr = read('.github/workflows/firebase-hosting-pull-request.yml');
 const prod = read('.github/workflows/firebase-hosting-live.yml');
 assert.match(main, /import\.meta\.env\.VITE_ACG_V4_DESIGN_PREVIEW === 'true'/);
 assert.match(main, /window\.location\.pathname === '\/preview\/order-ticket'/);
 assert.match(main, /isIsolatedTicketPreview\s*\?\s*<React\.Suspense/);
 assert.match(main, /<SessionGate>/);
 assert.match(pr, /VITE_ACG_V4_DESIGN_PREVIEW: 'true'/);
 assert.doesNotMatch(prod, /VITE_ACG_V4_DESIGN_PREVIEW/);
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
