import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const component=read('src/components/trading-v2/desktop/DesktopOrderTicketV4.jsx');
const css=read('src/components/trading-v2/desktop/DesktopOrderTicketV4.css');
const desktop=read('src/components/trading-v2/DesktopTerminal.jsx');
const original=read('src/components/trading-v2/desktop/DesktopOrderTicket.jsx');

test('V4 desktop ticket is enabled by default while V3 remains a targeted fallback',()=>{
 assert.match(desktop,/isV4DefaultEnabled\(\s*import\.meta\.env\.VITE_ACG_EXECUTION_V4_ENABLED/);
 assert.match(desktop,/typeof window !== 'undefined' \? window\.location\.search : ''/);
 assert.match(desktop,/V4_DESKTOP_EXECUTION_ENABLED \? \(/);
 assert.match(desktop,/<DesktopOrderTicketV4 /);
 assert.match(desktop,/<DesktopOrderTicket key=/);
 assert.match(desktop,/<DesktopOrderTicket\s+[\s\S]*?variant="floating"/);
 assert.match(desktop,/onCloseTicket=\{\(\) => setDesktopLayout/);
 assert.doesNotMatch(original,/DesktopOrderTicketV4/);
 const multiChart=read('src/components/trading-v2/desktop/DesktopMultiChart.jsx');
 const chartArea=read('src/components/trading-v2/ChartArea.jsx');
 assert.match(desktop,/chartOrderV4=\{V4_DESKTOP_EXECUTION_ENABLED\}/);
 assert.match(multiChart,/chartOrderV4=\{chartOrderV4\}/);
 assert.match(chartArea,/chartOrderV4 = false/);
 assert.match(chartArea,/desktopStyle=\{desktopEnhanced && chartOrderV4 && !mobileOverlayStyle\}/);

});

test('Production build enables V4 by default while retaining the emergency V3 component',()=>{
 const workflow=read('.github/workflows/firebase-hosting-live.yml');
 assert.match(workflow,/VITE_ACG_EXECUTION_V4_ENABLED: 'true'/);
 assert.match(workflow,/Assert V4 desktop is enabled by default in production/);
 assert.match(workflow,/isV4DefaultEnabled\(process\.env\.VITE_ACG_EXECUTION_V4_ENABLED, ''\), true/);
 assert.match(read('src/App.jsx'),/V4_FX_ENABLED = isV4DefaultEnabled\(/);
 assert.match(desktop,/V4_DESKTOP_EXECUTION_ENABLED \? \(/);
 assert.match(desktop,/<DesktopOrderTicket key=/);
});

test('V4 presents a single Market/Limit/Stop selector without exposing new Stop Limit creation',()=>{
 assert.match(component,/const entryOptions=\[\['market','Market'\],\['limit','Limit'\],\['stop','Stop'\]\]/);
 assert.match(component,/<Capsule className="v4-mainmodes v4-order-types" label="Order type" options=\{entryOptions\}/);
 assert.doesNotMatch(component,/label="Pending type"/);
 assert.doesNotMatch(component,/\['stop-limit','Stop Limit'\]/);
 assert.match(component,/orderType==='stop-limit'&&tradePlan\?\.editingOrderId/);
 assert.match(component,/if\(orderType==='stop-limit'&&!tradePlan\?\.editingOrderId\)onOrderTypeChange\('stop'\)/);
 assert.match(component,/if\(tradePlan\?\.editingOrderId\)/);
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
 assert.match(component,/resolveV4PositionSizing\(\{mode:uiMode,amount:value,plan,account:previewAccount,instrument:market\}\)/);
 assert.match(component,/conversionMarkets/);
 assert.match(component,/onRiskPercentChange\(percent\)/);
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
 assert.match(component,/canStartPlan&&\(requiresPlan\|\|\(financialVerified&&Boolean\(volume\)\)\)/);
 assert.match(component,/const requiresPlan=!tradePlan/);
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

test('V4 prevents duplicate click submissions and tracks actual command pending state',()=>{
 const parent=read('src/pages/TradingTerminalV2.jsx');
 assert.match(parent,/executionCommandPending=\{trading\.commandState\.pending === true\}/);
 assert.match(parent,/return runMarketExecution\(\{/);
 assert.match(desktop,/executionCommandPending=\{executionCommandPending\}/);
 assert.match(desktop,/return onManualOrder\(order, options\)/);
 assert.match(component,/submittingRef=useRef\(false\)/);
 assert.match(component,/!executionCommandPending&&!localSubmitting/);
 assert.match(component,/submitOnce\(\(\)=>onExecutePlan\(\)\)/);
 assert.match(component,/submitOnce\(\(\)=>onManualOrder\(/);
 assert.match(component,/Promise\.resolve\(callback\(\)\)/);
});

test('Audit bug regression: selecting BTC/USD opens existing Markets panel',()=>{
 assert.match(desktop,/onOpenMarkets=\{\(\) => openMarketPanel\('markets', true\)\}/);
 assert.match(component,/onClick=\{onOpenMarkets\} aria-label="Open markets and select instrument"/);
 assert.match(css,/\.v4-symbol-button \{/);
});

test('BTC quantity and affordable nonlinear lots slider are isolated to V4',()=>{
 assert.match(component,/deriveV4AffordableVolume\(/);
 assert.match(component,/v4LotsFromTrack\(Number\(e\.target\.value\),lotRange\)/);
 assert.match(component,/v4TrackFromLots\(selectedValue,lotRange\)/);
 assert.match(component,/v4CryptoQuantity\(volume,market\)/);
 assert.match(component,/Insufficient free margin — reduce position size\./);
 const legacy=read('src/components/trading-v2/desktop/DesktopOrderTicket.jsx');
 assert.doesNotMatch(legacy,/deriveV4AffordableVolume/);
});
test('Audit bug regression: Margin slider domain does not derive from current margin',()=>{
 assert.match(component,/marginBudget,setMarginBudget/);
 assert.match(component,/setMarginBudget\(value\)/);
 assert.match(component,/marginBudget\?\?margin/);
 assert.match(component,/Math\.min\(maxMargin,Number\(account\.freeMargin\)\)/);
 assert.doesNotMatch(component,/Number\(margin\|\|100\)\*4/);
});

test('Audit bug regression: Risk % and Risk USD work before a chart SL exists',()=>{
 assert.doesNotMatch(component,/Select Buy or Sell and set a valid SL before risk sizing/);
 assert.match(component,/const canStartPlan=/);
 assert.match(component,/const requiresPlan=!tradePlan/);
 assert.match(component,/onStartPlan\(side,orderType,\{protection/);
 assert.match(component,/const sl=positive\(effective\?\.sl\)\|\|defaultProtect\('sl'\)/);
 assert.match(component,/onRiskPercentChange\(percent\)/);
 assert.match(component,/if\(!result\.canExecute&&!tradePlan\)notice/);
});

test('Mobile execution and protected preview remain separate entry points',()=>{
 const main=read('src/main.jsx');
 assert.doesNotMatch(main,/DesktopOrderTicketV4/);
 assert.doesNotMatch(main,/OrderTicketV4Preview/);
 assert.match(read('src/pages/TradingTerminalV2.jsx'),/MobileScalperMode/);
 assert.doesNotMatch(component,/MobileScalperMode|ExecutionPanel/);
});

test('Risk sizing failures show the authoritative adapter reason rather than generic verification text',()=>{
 assert.match(component,/const riskSizingPreview=useMemo/);
 assert.match(component,/activeMode==='risk'&&riskSizingPreview&&!riskSizingPreview.canExecute/);
 assert.match(component,/riskSizingPreview\.message/);
 assert.match(component,/return riskSizingPreview\?\.canExecute\?riskSizingPreview\.lots:null/);
});
