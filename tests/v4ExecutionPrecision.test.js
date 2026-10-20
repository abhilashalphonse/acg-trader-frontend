import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveV4PositionSizing, V4_POSITION_MODES } from '../src/utils/v4ExecutionPrecision.js';

const instrument = Object.freeze({
  symbol: 'BTCUSD',
  assetClass: 'CRYPTO',
  bid: 83001.02, ask: 83020.98,
  tickSize: 0.01,
  pipSize: 0.01,
  volumeStep: 0.01,
  minVolume: 0.01, maxVolume: 10,
  contractSize: 1, defaultLeverage: 10,
  pnlCurrency: 'USD', quoteCurrency: 'USD', marginCurrency: 'USD',
  commissionPerLotPerSide: 0,
});
const account = Object.freeze({currency: 'USD', balance: 100000, equity: 100000, freeMargin: 20000, leverage: 10});
const plan = Object.freeze({symbol:'BTCUSD',side:'buy',pending:false,orderType:'market',entry:83020.98,sl:82220.98,tp:84620.98});
const run = (mode, amount, options={}) => resolveV4PositionSizing({mode,amount,plan,account,instrument,...options});
const near = (actual,expected,tolerance=0.00001) => assert.ok(Math.abs(actual-expected)<=tolerance,expected+' ≈ '+actual);

test('V4 exposes exactly the four approved sizing input modes', () => {
 assert.deepEqual(V4_POSITION_MODES, ['lots','margin','riskPercent','riskUSD']);
});

test('Lots mode maps into the existing lots contract and reports quote-currency exposure', () => {
 const result = run('lots',0.1);
 assert.equal(result.canExecute,true);
 assert.equal(result.backendSizingMode,'lots');
 assert.equal(result.manualLots,0.1);
 assert.equal(result.riskPercent,null);
 near(result.referencePrice,83020.98);
 near(result.margin,830.2098);
 near(result.openingRequirement,830.2098);
 near(result.freeAfter,19169.7902);
 near(result.notionalQuote,8302.098);
 near(result.notionalAccountPercent,8.302098);
 near(result.lossAtStop,80);
 near(result.grossProfitAtTarget,160);
});

test('Margin $ converts into allowed lots without exceeding the margin budget', () => {
 const result = run('margin',830.21);
 assert.equal(result.canExecute,true);
 assert.equal(result.backendSizingMode,'lots');
 assert.equal(result.lots,0.1);
 assert.ok(result.margin<=830.21);
 assert.ok(result.openingRequirement>=result.margin);
});

test('Margin $ fails rather than silently selecting min lots above the budget', () => {
 const result=run('margin',1);
 assert.equal(result.canExecute,false);
 assert.equal(result.code,'MARGIN_BELOW_MIN_VOLUME');
});

test('Margin mode takes actual volume bands into account instead of simple notional division', () => {
 const withBand={...instrument,spreadProfile:{volumeBands:[{upTo:0.05,extraPoints:0},{upTo:null,extraPoints:200000}]}};
 const result=run('margin',830.21,{instrument:withBand});
 assert.equal(result.canExecute,true);
 assert.ok(result.lots<0.1);
 assert.ok(result.margin<=830.21+1e-8);
});

test('Market lots use volume-band executable price for margin, risk and exposure',()=>{
 const withBand={...instrument,spreadProfile:{volumeBands:[{upTo:0.05,extraPoints:0},{upTo:null,extraPoints:10000}]}};
 const result=run('lots',0.1,{instrument:withBand});
 assert.equal(result.canExecute,true);
 near(result.referencePrice,83120.98);
 near(result.margin,831.2098);
 near(result.lossAtStop,90);
 near(result.grossProfitAtTarget,150);
 near(result.notionalQuote,8312.098);
});

test('notional exposure percent uses balance while risk percent uses equity',()=>{
 const a={...account,balance:200000,equity:50000};
 const r=run('lots',0.1,{account:a});
 assert.equal(r.canExecute,true);
 near(r.notionalAccountPercent,8302.098/200000*100);
 near(r.actualRiskPercent,80/50000*100);
});

test('unknown executable quote blocks even a pending limit plan from sizing',()=>{
 const bad=run('lots',0.1,{instrument:{...instrument,ask:null}});
 assert.equal(bad.canExecute,false);
 assert.equal(bad.code,'QUOTE_UNAVAILABLE');
});

test('Risk % uses the authoritative fee-inclusive risk-sizing engine', () => {
 const result = run('riskPercent',0.08);
 assert.equal(result.canExecute,true);
 assert.equal(result.backendSizingMode,'risk');
 assert.equal(result.riskPercent,0.08);
 assert.equal(result.manualLots,null);
 near(result.lots,0.1);
 near(result.lossAtStop,80);
 near(result.actualRiskPercent,0.08);
});

test('Risk USD converts into risk percentage from live equity (not balance)', () => {
 const result=run('riskUSD',80);
 assert.equal(result.canExecute,true);
 near(result.riskPercent,0.08);
 near(result.lots,0.1);
 const change=run('riskUSD',80,{account:{...account,equity:50000}});
 near(change.riskPercent,0.16);
});

test('Risk calculations include entry and exit commission; never round volume up', () => {
 const withFees={...instrument,commissionPerLotPerSide:5};
 const result=run('riskUSD',80,{instrument:withFees});
 assert.equal(result.canExecute,true);
 assert.equal(result.lots,0.09);
 assert.ok(result.lossAtStop<=80);
 near(result.lossAtStop,72.9);
 assert.ok(result.openingRequirement>result.margin);
});

test('Risk modes require a stop loss and valid side geometry', () => {
 const missing=run('riskUSD',50,{plan:{...plan,sl:null}});
 assert.equal(missing.canExecute,false);
 assert.equal(missing.code,'STOP_REQUIRED');
 const invalid=run('riskPercent',0.5,{plan:{...plan,sl:84000}});
 assert.equal(invalid.canExecute,false);
 assert.equal(invalid.code,'INVALID_STOP_GEOMETRY');
});

test('Risk sizing fails safely for cross-currency PnL rather than applying USD math', () => {
 const result=run('riskUSD',100,{instrument:{...instrument,pnlCurrency:'JPY'}});
 assert.equal(result.canExecute,false);
 assert.equal(result.code,'RISK_CONVERSION_UNKNOWN');
});

test('Margin input fails safely without an account-currency margin conversion', () => {
 const result=run('margin',200,{instrument:{...instrument,marginCurrency:'INR'}});
 assert.equal(result.canExecute,false);
 assert.equal(result.code,'MARGIN_CONVERSION_UNKNOWN');
});

test('Unverified account free margin blocks execution even when sizes calculate', () => {
 const result=run('lots',0.1,{account:{...account,freeMargin:null}});
 assert.equal(result.canExecute,false);
 assert.equal(result.code,'OPENING_REQUIREMENT_UNKNOWN');
});

test('Insufficient free margin blocks regardless of sizing mode', () => {
 const result=run('lots',0.1,{account:{...account,freeMargin:100}});
 assert.equal(result.canExecute,false);
 assert.equal(result.code,'INSUFFICIENT_MARGIN');
});

test('Stop Limit uses executable limit leg for risk and margin, not trigger leg', () => {
 const pending={...plan,pending:true,orderType:'stop-limit',entry:84000,limitPrice:84100,sl:83300,tp:85700};
 const result=run('lots',0.1,{plan:pending});
 assert.equal(result.canExecute,true);
 near(result.referencePrice,84100);
 near(result.lossAtStop,80);
 near(result.grossProfitAtTarget,160);
});

test('SELL risk geometry and projections are not long-only', () => {
 const result=run('riskPercent',0.08,{plan:{...plan,side:'sell',sl:83801.02,tp:81401.02}});
 assert.equal(result.canExecute,true);
 near(result.lots,0.1);
 near(result.actualRiskPercent,0.08);
});

test('Volume below minimum, beyond maximum or without limits never silently executes', () => {
 for(const n of [0.001,100]) {
  const r=run('lots',n);
  assert.equal(r.canExecute,false);
  assert.equal(r.code,'VOLUME_OUT_OF_RANGE');
 }
 const r=run('lots',0.1,{instrument:{...instrument,maxVolume:null}});
 assert.equal(r.canExecute,false);
 assert.equal(r.code,'INSTRUMENT_VOLUME_UNKNOWN');
});

test('Bad plan or non-positive sizing cannot be represented as executable', () => {
 assert.equal(run('lots',0).code,'INVALID_AMOUNT');
 assert.equal(run('margin',5,{plan:{...plan,side:null}}).code,'ENTRY_UNAVAILABLE');
 assert.equal(run('riskUSD',20,{plan:{...plan,side:null}}).code,'ENTRY_UNAVAILABLE');
 assert.equal(run('unknown',5).code,'UNSUPPORTED_MODE');
});

test('Risk below min or above maximum remains blocked by existing engine limits', () => {
 const tiny=run('riskUSD',0.1);
 assert.equal(tiny.canExecute,false);
 assert.equal(tiny.code,'MIN_VOLUME');
 const huge=run('riskUSD',100000);
 assert.equal(huge.canExecute,false);
 assert.equal(huge.code,'MAX_VOLUME');
});

test('Fresh USDCAD unlocks USD-denominated margin-budget sizing for AUD/CAD, stale FX blocks it',()=>{
 const now=Date.now();
 const pair={symbol:'AUDCAD',assetClass:'FOREX',bid:0.99395,ask:0.99401,
   quoteCurrency:'CAD',marginCurrency:'CAD',pnlCurrency:'CAD',
   contractSize:100000,tickSize:0.00001,volumeStep:0.01,minVolume:0.01,maxVolume:10,defaultLeverage:100};
 const fx={symbol:'USDCAD',bid:1.376,ask:1.377,receivedAtMs:now,subscribed:true,
   live:true,isStale:false,sessionOpen:true};
 const a={...account,leverage:100,conversionMarkets:[fx]};
 const p={symbol:'AUDCAD',side:'buy',pending:false,orderType:'market',entry:0.99401,sl:null,tp:null};
 const valid=resolveV4PositionSizing({mode:'margin',amount:10,plan:p,account:a,instrument:pair});
 assert.equal(valid.canExecute,true,JSON.stringify(valid));
 assert.ok(valid.margin<=10+1e-7);
 assert.equal(valid.backendSizingMode,'lots');
 const blocked=resolveV4PositionSizing({mode:'margin',amount:10,plan:p,
   account:{...a,conversionMarkets:[{...fx,receivedAtMs:now-12000}]},instrument:pair});
 assert.equal(blocked.canExecute,false);
 assert.equal(blocked.code,'MARGIN_CONVERSION_UNKNOWN');
});

test('BTC 2x: risk is limited by margin rather than an arbitrary 1 percent ceiling', () => {
 const btc={...instrument,bid:82736.88,ask:82738.88,defaultLeverage:2,maxVolume:5,commissionPerLotPerSide:15};
 const funded={...account,balance:101416,equity:101416,freeMargin:101416,leverage:100};
 const protectedBuy={...plan,entry:82738.88,sl:82342.19,tp:null};
 const props={instrument:btc,account:funded,plan:protectedBuy};
 const valid=run('riskUSD',1047,props);
 assert.equal(valid.canExecute,true,JSON.stringify(valid));
 assert.ok(valid.lossAtStop<=1047);
 assert.ok(valid.openingRequirement<=funded.freeMargin);
 const validPercent=run('riskPercent',0.95,props);
 assert.equal(validPercent.canExecute,true,JSON.stringify(validPercent));
 for(const [mode,amount] of [['riskUSD',1463],['riskPercent',1.65]]) {
   const blocked=run(mode,amount,props);
   assert.equal(blocked.canExecute,false);
   assert.equal(blocked.code,'INSUFFICIENT_MARGIN');
   assert.match(blocked.message,/Insufficient free margin/);
   assert.match(blocked.message,/Estimated opening cost: USD/);
   assert.ok(blocked.riskSizing.totalRequirement>funded.freeMargin);
   assert.ok(blocked.riskSizing.maxMarginLots>0);
 }
});

test('V4 risk sizing reports minimum and maximum volume reasons, not a generic engine failure', () => {
 const tooSmall=run('riskUSD',0.1);
 assert.equal(tooSmall.code,'MIN_VOLUME');
 assert.match(tooSmall.message,/minimum/);
 const tooLarge=run('riskUSD',100000);
 assert.equal(tooLarge.code,'MAX_VOLUME');
 assert.match(tooLarge.message,/maximum/);
});
