import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateExecutionPrice, resolveExecutionPreview, volumeBandFor } from '../src/utils/executionPricing.js';
import { readFileSync } from 'node:fs';
import { effectiveTradePlan } from '../src/utils/tradePlanExecution.js';
import { estimateLossAtStopWithCosts } from '../src/utils/tradingRisk.js';

const xau = {
  bid: 4310.80,
  ask: 4310.90,
  tickSize: 0.01,
  spreadPoints: 10,
  spreadProfile: {
    volumeBands: [
      { upTo: 1, extraPoints: 0 },
      { upTo: 5, extraPoints: 5 },
      { upTo: 15, extraPoints: 10 },
      { upTo: null, extraPoints: 40 },
    ],
  },
};

test('volume band selection mirrors backend boundary semantics', () => {
  assert.equal(volumeBandFor(xau.spreadProfile.volumeBands, 1).extraPoints, 0);
  assert.equal(volumeBandFor(xau.spreadProfile.volumeBands, 5).extraPoints, 5);
  assert.equal(volumeBandFor(xau.spreadProfile.volumeBands, 15).extraPoints, 10);
  assert.equal(volumeBandFor(xau.spreadProfile.volumeBands, 31).extraPoints, 40);
});

test('execution preview applies adverse volume adjustment to the executable side', () => {
  const buy = estimateExecutionPrice(xau, 'buy', 5);
  const sell = estimateExecutionPrice(xau, 'sell', 5);
  assert.equal(buy.price, 4310.95);
  assert.equal(sell.price, 4310.75);
  assert.equal(buy.liquidityAdjustmentPoints, 5);
  assert.equal(sell.liquidityAdjustmentPoints, 5);
  assert.equal(buy.effectiveExecutionSpreadPoints, 15);
});

test('execution preview stays at the quoted price inside the first volume band', () => {
  assert.equal(estimateExecutionPrice(xau, 'buy', 0.5).price, 4310.90);
  assert.equal(estimateExecutionPrice(xau, 'sell', 0.5).price, 4310.80);
});


test('execution preview resolves risk sizing against the volume-adjusted market entry', () => {
  const instrument = {
    ...xau,
    symbol: 'XAUUSD',
    pnlCurrency: 'USD',
    quoteCurrency: 'USD',
    marginCurrency: 'USD',
    contractSize: 100,
    defaultLeverage: 100,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
  };
  const account = { currency: 'USD', equity: 100000, freeMargin: 100000, leverage: 100 };
  const plan = { symbol: 'XAUUSD', side: 'buy', pending: false, sizingMode: 'risk', entry: 4310.90, sl: 4300.90, manualLots: 0.5 };
  const result = resolveExecutionPreview({ plan, riskPercent: 1, manualLots: 0.5, account, instrument });
  assert.ok(Number.isFinite(result.sizing.lots));
  assert.equal(result.plan.entry, estimateExecutionPrice(instrument, 'buy', result.sizing.lots).price);
});


test('STOP_LIMIT risk previews size against the limit fill leg, not the trigger', () => {
  const instrument = { symbol: 'TESTUSD', pnlCurrency: 'USD', quoteCurrency: 'USD', marginCurrency: 'USD',
    contractSize: 1, tickSize: 0.01, defaultLeverage: 100, minVolume: 0.01, maxVolume: 1000, volumeStep: 0.01 };
  const account = { currency: 'USD', equity: 10000, freeMargin: 10000, leverage: 100 };
  const plan = { side: 'buy', pending: true, orderType: 'stop-limit', sizingMode: 'risk',
    entry: 100, limitPrice: 101, sl: 99 };
  const preview = resolveExecutionPreview({ plan, riskPercent: 1, account, instrument, manualLots: 0.1 });
  assert.equal(preview.plan.entry, 100);
  assert.equal(preview.riskPlan.entry, 101);
  assert.equal(preview.sizing.lots, 50);
});


test('BTC/USD risk preview uses live ask instead of a stale chart entry and respects selected risk', () => {
  const market = {
    symbol: 'BTCUSD', bid: 82626.60, ask: 82628.60, tickSize: 0.01,
    spreadPoints: 200, pnlCurrency: 'USD', quoteCurrency: 'USD', marginCurrency: 'USD',
    contractSize: 1, defaultLeverage: 100, volumeStep: 0.01,
    minVolume: 0.01, maxVolume: 1000, commissionRate: 0.0002,
    spreadProfile: { volumeBands: [{ upTo: 1, extraPoints: 0 }, { upTo: 5, extraPoints: 5 }, { upTo: null, extraPoints: 20 }] },
  };
  const account = { equity: 100000, freeMargin: 100000, leverage: 100, currency: 'USD' };
  const draft = { symbol: 'BTCUSD', side: 'buy', sizingMode: 'risk',
    pending: false, entry: 82612.00, sl: 82336.74, manualLots: 0.1 };
  const normalized = effectiveTradePlan(draft, market);
  assert.equal(normalized.entry, market.ask);

  // DesktopTerminal provides one such preview to both the chart and ticket.
  const shared = resolveExecutionPreview({ plan: normalized, riskPercent: 1, manualLots: 0.1, account, instrument: market });
  const lotsForChart = shared.sizing.lots;
  const lotsForTicket = shared.sizing.lots;
  assert.equal(lotsForChart, lotsForTicket);
  assert.ok(lotsForTicket > 0);
  assert.ok(estimateLossAtStopWithCosts(shared.riskPlan, lotsForTicket, market, account) <= 1000);
});

test('desktop chart and fixed/floating tickets receive the same canonical preview', () => {
  const src = path => readFileSync(new URL(`../src/components/trading-v2/${path}`, import.meta.url), 'utf8');
  const desktop = src('DesktopTerminal.jsx');
  const multiChart = src('desktop/DesktopMultiChart.jsx');
  const chart = src('ChartArea.jsx');
  const ticket = src('desktop/DesktopOrderTicket.jsx');
  assert.match(desktop, /const orderExecutionPreview = React\.useMemo/);
  assert.equal((desktop.match(/orderExecutionPreview=\{orderExecutionPreview\}/g) || []).length, 3);
  assert.match(multiChart, /orderExecutionPreview=\{isActive \? orderExecutionPreview : null\}/);
  assert.match(chart, /!dragPreviewActive && orderExecutionPreview/);
  assert.match(ticket, /tradePlan && orderExecutionPreview \? orderExecutionPreview : localExecutionPreview/);
});
