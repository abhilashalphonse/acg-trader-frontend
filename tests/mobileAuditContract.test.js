import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveV4PositionSizing } from '../src/utils/v4ExecutionPrecision.js';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = source('src/App.jsx');
const shell = source('src/pages/MobileTraderShell.jsx');
const dock = source('src/components/trading-v2/MobileAuditExecutionDock.jsx');
const marketPanel = source('src/components/trading-v2/MarketPanel.jsx');
const header = source('src/components/trading-v2/MobileAuditHeader.jsx');
const chartArea = source('src/components/trading-v2/ChartArea.jsx');
const palette = source('src/components/trading-v2/MobileAuditDrawingPalette.jsx');
const css = source('src/styles/acg-pure-black.css');

test('Production defaults are preserved and mobile audit is opt-in only', () => {
  assert.match(app, /get\('acg_mobile_audit'\) === '1'/);
  assert.match(app, /isDesktop\s*\?\s*<TradingTerminalV2/);
  assert.match(app, /<MobileTraderShell \{\.\.\.sharedProps\} mobileAudit=\{MOBILE_AUDIT_ENABLED\}/);
  assert.match(shell, /mobileAudit \? <MobileAuditHeader/);
  assert.match(shell, /: <MobileTradingHeader/);
  assert.match(shell, /mobileAudit \? <MobileAuditExecutionDock/);
  assert.match(shell, /: <ExecutionPanel/);
  assert.match(marketPanel, /\{!auditMobile && <ChartControls/);
  assert.match(marketPanel, /auditMobile=\{auditMobile\}/);
  assert.match(chartArea, /auditMobilePalette && <MobileAuditDrawingPalette/);
  assert.match(chartArea, /toolbarVisible = auditMobilePalette \? false/);
  assert.match(palette, /V4_DRAWING_TOOL_SECTIONS/);
  assert.match(palette, /aria-expanded=\{expanded\}/);
});

test('Mobile audit routes through existing authoritative trading and FX contracts only', () => {
  assert.match(shell, /resolveV4PositionSizing\(/);
  assert.match(shell, /validateTradePlanForExecution\(basePlan, planMarket\)/);
  assert.match(shell, /conversionMarkets: markets/);
  assert.match(shell, /await trading\.placePendingOrder\(request\)/);
  assert.match(shell, /await trading\.openMarketOrder\(\{/);
  assert.match(shell, /trading\.commandState\.pending/);
  assert.match(shell, /auditSubmissionRef\.current/);
  assert.match(shell, /auditUnknownSubmission/);
  assert.match(shell, /if \(mobileAudit && !result\?\.order\?\.id\)/);
  assert.match(shell, /if \(mobileAudit && !\(result\?\.position \|\| result\?\.reconciled/);
  assert.doesNotMatch(dock, /onManualOrder|tradingApi|openMarketOrder\(|placePendingOrder\(/);
  assert.match(shell, /mobileAudit \? \{ auditMode: 'riskPercent', auditValue: String\(numericRisk\)/);
});

test('Cancelling an audit draft never executes the existing live-position close path', () => {
  assert.match(shell, /if \(mobileAudit\) \{\s*if \(tradePlan\?\.open\) \{/);
  assert.match(shell, /setTradePlan\(null\);\s*return;\s*\}/);
  assert.match(shell, /auditIdentityRef\.current !== identity/);
  assert.match(shell, /setPositionProtectionDraft\(null\);/);
});

test('Review is an explicit state transition and editing invalidates review', () => {
  assert.match(dock, /onStartPlan\(side, type,/);
  assert.match(dock, /onTradePlanChange\(\{ stage: 'review' \}\)/);
  assert.match(dock, /onExecutePlan\(\)/);
  assert.match(dock, /canSubmit = canReview && reviewing/);
  assert.match(shell, /stage: patch\?\.stage === 'review' \? 'review' : 'planning'/);
  assert.match(shell, /if \(mobileAudit && tradePlan\.stage !== 'review'\) return/);
  for (const label of ['Set stop loss', 'Set take profit', 'Edit entry price', 'Edit position sizing'])
    assert.ok(dock.includes(label), label);
});

test('Requested mobile geometry and safe-area rules are present without affecting desktop', () => {
  for (const value of ['h-[32px]', 'h-[20px]', 'h-[48px]', 'mx-[6px]', 'p-[8px]', 'grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]'])
    assert.ok(dock.includes(value), value);
  assert.match(header, /48px\+env\(safe-area-inset-top\)/);
  assert.match(shell, /env\(safe-area-inset-bottom\)/);
  assert.match(shell, /acg-mobile-audit-shell/);
  assert.match(css, /\.acg-mobile-audit-shell \.acg-mobile-reference-content/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\)!important/);
  assert.doesNotMatch(dock, /Free Margin|Free<|free-margin footer/);
  assert.doesNotMatch(dock, /1120\.92|1\.13%|DEMO_ACCOUNT/);
});

test('Existing V4 risk adapter respects fixed risk budget and does not resize when TP moves', () => {
  const account = { currency: 'USD', balance: 100000, equity: 100000, freeMargin: 9000, leverage: 100 };
  const instrument = {
    symbol:'EURUSD', bid:1.12091, ask:1.12092, sessionOpen:true, live:true,
    tickSize:0.00001, volumeStep:0.01,minVolume:0.01,maxVolume:10,
    contractSize:100000, quoteCurrency:'USD', pnlCurrency:'USD',
    marginCurrency:'USD',defaultLeverage:100,
  };
  const plan = {symbol:'EURUSD',side:'buy',orderType:'market',pending:false,entry:1.12092,sl:1.119, tp:1.125 };
  const size = p => resolveV4PositionSizing({mode:'riskUSD',amount:100,plan:p,account,instrument});
  const first = size(plan);
  const farther = size({...plan,sl:1.118});
  const changedTp = size({...plan,tp:1.128});
  assert.equal(first.canExecute, true);
  assert.equal(farther.canExecute,true);
  assert.ok(farther.lots < first.lots);
  assert.equal(changedTp.lots, first.lots);
  assert.equal(first.code, 'READY');
});
