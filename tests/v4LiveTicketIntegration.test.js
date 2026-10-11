import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const component=read('src/components/trading-v2/desktop/DesktopOrderTicketV4.jsx');
const css=read('src/components/trading-v2/desktop/DesktopOrderTicketV4.css');
const desktop=read('src/components/trading-v2/DesktopTerminal.jsx');
const original=read('src/components/trading-v2/desktop/DesktopOrderTicket.jsx');

test('V4 production ticket is opt-in only; legacy desktop and floating tickets remain',()=>{
 assert.match(desktop,/V4_DESKTOP_EXECUTION_ENABLED = import\.meta\.env\.VITE_ACG_EXECUTION_V4_ENABLED === 'true'/);
 assert.match(desktop,/V4_DESKTOP_EXECUTION_ENABLED \? \(/);
 assert.match(desktop,/<DesktopOrderTicketV4 /);
 assert.match(desktop,/<DesktopOrderTicket key=/);
 assert.match(desktop,/<DesktopOrderTicket\s+[\s\S]*?variant="floating"/);
 assert.match(desktop,/onCloseTicket=\{\(\) => setDesktopLayout/);
 assert.doesNotMatch(original,/DesktopOrderTicketV4/);
});

test('V4 uses real market/account/plan props, not synthetic preview values',()=>{
 assert.match(component,/market,account=\{\}/);
 assert.match(component,/tradePlan,/);
 assert.match(component,/effectiveTradePlan\(tradePlan,market\)/);
 assert.doesNotMatch(component,/\b83020\.98\b|\b83001\.02\b|\b100000\b|DEMO_ACCOUNT|const DEMO =/);
 assert.doesNotMatch(component,/\b(fetch\s*\(|new WebSocket\(|tradingApi\.|import .*OrderTicketV4Preview)/);
});

test('V4 retains existing execution functions, not a new broker API or one-click toggle',()=>{
 for(const api of ['onManualOrder','onStartPlan','onExecutePlan','onTradePlanChange','onCancelPlan','onOrderTypeChange','onSizingModeChange']) {
  assert.ok(component.includes(api),api+' missing');
 }
 assert.match(component,/onManualOrder\(\{side,symbol:market\.symbol,lots:normalLots\(lots\)/);
 assert.match(component,/onStartPlan\(side,orderType/);
 assert.match(component,/onExecutePlan\(\)/);
 assert.doesNotMatch(component,/skipRiskGuard|Instant Trade|instantTrade|executeImmediately/);
});

test('Four-mode UI dispatches to existing fee-aware adapter, not preview math',()=>{
 for(const mode of ["'lots','Lots'","'margin','Margin $'","'riskPercent','Risk %'","'riskUSD','Risk USD'"])
  assert.ok(component.includes(mode),'missing '+mode);
 assert.match(component,/resolveV4PositionSizing\(\{mode:uiMode,amount:value,plan,account,instrument:market\}\)/);
 assert.match(component,/onRiskPercentChange\(result\.riskPercent\)/);
 assert.match(component,/onLotsChange\(result\.lots\)/);
 assert.match(component,/riskSizingSupported\(market,currency\)/);
 assert.match(component,/normalizeVolumeToStep/);
});

test('Protection units retain actual price as canonical source of truth',()=>{
 for(const unit of ["'price','Price'","'ticks','Ticks'","'percent','% Price'","'usd','USD'","'balance','% Balance'"])
  assert.ok(component.includes(unit),'missing '+unit);
 assert.match(component,/v4ExitValueFromPrice\(\{field,unit,price:rawPrice,plan,instrument:market,lots,account\}\)/);
 assert.match(component,/v4ExitPriceFromInput\(\{/);
 assert.match(component,/onTradePlanChange\(\{sl:price,activeField:'sl'/);
 assert.match(component,/onTradePlanChange\(\{tp:price,activeField:'tp'/);
 assert.match(component,/activeMode==='risk'/);
});

test('Rendering and callbacks fail closed when live numbers or permissions are unavailable',()=>{
 assert.match(component,/exposureAllowed&&financialVerified&&volume/);
 assert.match(component,/Number\.isFinite\(requirement\)&&Number\.isFinite\(freeAfter\)&&freeAfter>=0/);
 assert.match(component,/validMarket&&exposureAllowed&&!financialVerified/);
 assert.match(component,/market\?\.isStale!==true/);
 assert.match(component,/market\?\.sessionOpen!==false/);
 assert.match(component,/capabilities\.stopLossRequiredForManualLots/);
 assert.match(component,/validateTradePlanForExecution\(effective,market,\{preserveEntry:true\}\)/);
 assert.match(component,/onManualOrder\(/);
});

test('Frozen V4 layout and guardrails use graphite, white pills, pinned execution footer',()=>{
 assert.match(css, /--v4-bg:#09090b/);
 assert.match(css, /\.v4-exit-card \{[^}]*background: #202023/);
 assert.match(css, /\.v4-capsule-button\.selected \{[^}]*background: #f7f7f8/);
 assert.match(css, /\.v4-ticket\.v4-live-scope \{[^}]*display:flex; flex-direction:column/);
 assert.match(css, /\.v4-ticket\.v4-live-scope \.v4-ticket-body \{[^}]*overflow-y:auto/);
 assert.match(css, /\.v4-ticket\.v4-live-scope \.v4-execution-footer \{[^}]*flex-shrink:0/);
 assert.match(css, /\.v4-sell \{ background: #ce273e/);
 assert.match(css, /\.v4-buy \{ background: #195be1/);
});

test('Mobile execution and protected preview remain separate entry points',()=>{
 const main=read('src/main.jsx');
 assert.doesNotMatch(main,/DesktopOrderTicketV4/);
 assert.doesNotMatch(main,/OrderTicketV4Preview/);
 assert.match(read('src/pages/TradingTerminalV2.jsx'),/MobileScalperMode/);
 assert.doesNotMatch(component,/MobileScalperMode|ExecutionPanel/);
});
