import test from 'node:test';
import assert from 'node:assert/strict';
import { formatInstrumentPrice } from '../src/utils/instrumentFormatting.js';
import { normalizeTradePlan } from '../src/utils/tradePlanNormalization.js';
import {
  normalizePriceToTick,
  normalizeProtectionPrice,
  normalizeVolumeToStep,
  pendingPriceDirection,
} from '../src/utils/tradingCommandNormalization.js';
import { calculateRiskSizedLots, estimateStopRisk } from '../src/utils/tradingRisk.js';

test('displayed pending plan values equal the values execution normalization will send', () => {
  const instrument = {
    symbol: 'EURUSD',
    digits: 5,
    tickSize: 0.00001,
    pipSize: 0.0001,
    contractSize: 100000,
    volumeStep: 0.01,
    minVolume: 0.01,
    maxVolume: 100,
    pnlCurrency: 'USD',
    quoteCurrency: 'USD',
  };
  const rawPlan = {
    side: 'buy',
    orderType: 'limit',
    pending: true,
    sizingMode: 'risk',
    entry: 1.084567,
    sl: 1.083214,
    tp: 1.087654,
    limitPrice: null,
  };
  const plan = normalizeTradePlan(rawPlan, instrument);
  const side = 'BUY';

  const commandEntry = normalizePriceToTick(plan.entry, instrument, pendingPriceDirection('limit', side, 'entry'));
  const commandSl = normalizeProtectionPrice(plan.sl, instrument, side, 'sl');
  const commandTp = normalizeProtectionPrice(plan.tp, instrument, side, 'tp');

  assert.equal(plan.entry, commandEntry);
  assert.equal(plan.sl, commandSl);
  assert.equal(plan.tp, commandTp);
  assert.equal(formatInstrumentPrice(plan.entry, instrument), commandEntry.toFixed(5));
  assert.equal(formatInstrumentPrice(plan.sl, instrument), commandSl.toFixed(5));
  assert.equal(formatInstrumentPrice(plan.tp, instrument), commandTp.toFixed(5));

  const requestedLots = calculateRiskSizedLots(plan, 1, 10000, instrument, 'USD');
  const executionLots = normalizeVolumeToStep(requestedLots, instrument);
  const displayedRisk = estimateStopRisk(plan, executionLots, instrument, 'USD');
  const commandRisk = Math.abs(commandEntry - commandSl) * instrument.contractSize * executionLots;

  assert.equal(Number(displayedRisk.toFixed(8)), Number(commandRisk.toFixed(8)));
  assert.equal(executionLots % instrument.volumeStep < 1e-9, true);
});
