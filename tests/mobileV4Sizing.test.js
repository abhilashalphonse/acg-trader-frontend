import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileSizingModeValue, mobileSizingHelper } from '../src/utils/mobileV4Sizing.js';
import { resolveV4PositionSizing } from '../src/utils/v4ExecutionPrecision.js';

const instrument = {symbol:'EURUSD',bid:1.12091,ask:1.12092,tickSize:0.00001,pipSize:0.0001,volumeStep:0.01,minVolume:0.01,maxVolume:100,contractSize:100000,quoteCurrency:'USD',marginCurrency:'USD',pnlCurrency:'USD',defaultLeverage:100,commissionPerLotPerSide:3};
const account = {currency:'USD',equity:98000,balance:100000,freeMargin:90000,leverage:100};
const plan = {side:'buy',orderType:'market',pending:false,entry:1.12092,sl:1.119,tp:1.125,sizingMode:'lots'};

test('unit switching preserves a fee-aware position across all four representations', () => {
  const original = resolveV4PositionSizing({mode:'lots',amount:'0.31',plan,account,instrument});
  assert.equal(original.canExecute,true);
  for (const nextMode of ['margin','riskPercent','riskUSD']) {
    const amount = mobileSizingModeValue({nextMode,mode:'lots',amount:'0.31',sizing:original,account});
    const converted = resolveV4PositionSizing({mode:nextMode,amount,plan,account,instrument});
    assert.equal(converted.canExecute,true, nextMode);
    assert.ok(Math.abs(converted.lots-original.lots) <= instrument.volumeStep + 1e-9, nextMode);
    assert.equal(mobileSizingModeValue({nextMode:'lots',mode:nextMode,amount,sizing:converted,account}),String(converted.lots));
  }
});

test('risk unit switching retains requested budget rather than rounding it repeatedly', () => {
  const usd = mobileSizingModeValue({nextMode:'riskUSD',mode:'riskPercent',amount:'0.53',sizing:{lossAtStop:500},account});
  assert.equal(Number(usd),519.4);
  assert.equal(mobileSizingModeValue({nextMode:'riskPercent',mode:'riskUSD',amount:usd,account}),'0.53');
  assert.equal(mobileSizingModeValue({nextMode:'riskUSD',mode:'lots',sizing:{lots:0.1},account}), '');
});

test('helper reports resolved margin/risk and keeps equity distinct from balance exposure', () => {
  const sizing = resolveV4PositionSizing({mode:'riskUSD',amount:101,plan,account,instrument});
  assert.equal(sizing.canExecute,true);
  const args = {sizing,account,instrument,formatMoney:v=>Number(v).toFixed(2),formatLots:v=>Number(v).toFixed(2)};
  assert.match(mobileSizingHelper({...args,mode:'riskUSD'}),new RegExp(sizing.lossAtStop.toFixed(2).replace('.','\\.')));
  assert.match(mobileSizingHelper({...args,mode:'riskUSD'}),/% equity/);
  assert.match(mobileSizingHelper({...args,mode:'margin'}),/% balance/);
  assert.match(mobileSizingHelper({...args,mode:'lots'}),/% balance/);
  const foreign = mobileSizingHelper({...args,mode:'lots',instrument:{...instrument,quoteCurrency:'JPY'}});
  assert.doesNotMatch(foreign,/% balance/,'unverified FX must not claim account-currency exposure');
});
