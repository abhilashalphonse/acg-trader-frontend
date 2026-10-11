import test from 'node:test';
import assert from 'node:assert/strict';
import { v4ExitPriceFromInput, v4ExitValueFromPrice, V4_EXIT_UNITS } from '../src/utils/v4ProtectionPrecision.js';

const instrument = Object.freeze({
  symbol:'BTCUSD', bid:83001.02, ask:83020.98, tickSize:0.01, pipSize:0.01,
  volumeStep:0.01, minVolume:0.01, maxVolume:10, contractSize:1,
  marginCurrency:'USD', quoteCurrency:'USD', pnlCurrency:'USD',
  commissionPerLotPerSide:0,
});
const account=Object.freeze({currency:'USD',equity:100000,balance:100000});
const buy=Object.freeze({symbol:'BTCUSD',side:'buy',pending:false,orderType:'market',entry:83020.98,sl:82220.98,tp:84620.98});
const from=(field,unit,amount,override={})=>v4ExitPriceFromInput({field,unit,amount,plan:buy,instrument,lots:0.1,account,...override});
const as=(field,unit,price,override={})=>v4ExitValueFromPrice({field,unit,price,plan:buy,instrument,lots:0.1,account,...override});
const near=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,'expected '+expected+' got '+actual);

test('exactly five UI exits units, with one canonical price',()=>{
 assert.deepEqual(V4_EXIT_UNITS,['price','ticks','percent','usd','balance']);
 const levels=[from('sl','price',82220.98),from('sl','ticks',80000),from('sl','percent',800/83020.98*100),from('sl','usd',80),from('sl','balance',0.08)];
 for(const p of levels){assert.equal(p.valid,true);near(p.price,82220.98);}
});

test('unit changes only change editable representation, never canonical SL price',()=>{
 for(const unit of V4_EXIT_UNITS){
  const representation=as('sl',unit,82220.98);
  assert.equal(representation.valid,true,unit);
  near(representation.price,82220.98);
  const roundtrip=from('sl',unit,representation.value);
  assert.equal(roundtrip.valid,true,unit);
  near(roundtrip.price,82220.98);
 }
});

test('TP amount, ticks, price and percent compute same canonical target',()=>{
 const levels=[from('tp','price',84620.98),from('tp','ticks',160000),from('tp','percent',1600/83020.98*100),from('tp','usd',160),from('tp','balance',0.16)];
 for(const p of levels){assert.equal(p.valid,true);near(p.price,84620.98);}
 const money=as('tp','usd',84620.98);
 near(money.value,160);
 assert.equal(money.financialBasis,'GROSS_PRICE_PROFIT');
});

test('fee-inclusive SL money input never exceeds intended cash risk',()=>{
 const fees={...instrument,commissionPerLotPerSide:5};
 const p=from('sl','usd',80,{instrument:fees});
 assert.equal(p.valid,true);
 near(p.price,82230.98);
 const result=as('sl','usd',p.price,{instrument:fees});
 assert.ok(result.value<=80+1e-8);
 near(result.value,80);
 assert.equal(result.financialBasis,'LOSS_INCLUDING_ESTIMATED_FEES');
});

test('below the commission-plus-one-tick risk floor fails closed',()=>{
 const fees={...instrument,commissionPerLotPerSide:5};
 const p=from('sl','usd',0.50,{instrument:fees});
 assert.equal(p.valid,false);
 assert.equal(p.code,'INVALID_PRICE');
});

test('risk-based lot sizing cannot use a circular monetary SL input',()=>{
 for(const sizingMode of ['riskPercent','riskUSD']) for(const unit of ['usd','balance']){
  const p=from('sl',unit,80,{sizingMode});
  assert.equal(p.valid,false);
  assert.equal(p.code,'CIRCULAR_SIZING');
 }
});

test('money conversions require verified account P&L currency and volume',()=>{
 assert.equal(from('sl','usd',80,{instrument:{...instrument,pnlCurrency:'JPY'}}).code,'PNL_CONVERSION_UNKNOWN');
 assert.equal(from('tp','balance',0.1,{lots:null}).code,'PNL_CONVERSION_UNKNOWN');
 assert.equal(as('sl','usd',82220.98,{instrument:{...instrument,pnlCurrency:'JPY'}}).code,'PNL_CONVERSION_UNKNOWN');
});

test('Stop Limit uses limit execution leg as canonical reference',()=>{
 const p={...buy,pending:true,orderType:'stop-limit',entry:84000,limitPrice:84100,sl:83300,tp:85700};
 near(from('sl','ticks',80000,{plan:p}).price,83300);
 near(as('sl','ticks',83300,{plan:p}).value,80000);
});

test('short SL and TP geometry converts in opposite direction from long',()=>{
 const short={...buy,side:'sell',sl:83801.02,tp:81401.02};
 const sl=from('sl','ticks',80000,{plan:short});
 const tp=from('tp','usd',160,{plan:short});
 assert.equal(sl.valid,true);
 assert.equal(tp.valid,true);
 near(sl.price,83801.02);
 near(tp.price,81401.02);
});

test('reject invalid side, misaligned values, missing tick and improper directions',()=>{
 assert.equal(from('sl','ticks',1.5).code,'FRACTIONAL_TICK');
 assert.equal(from('tp','price',82220.98).code,'INVALID_PRICE');
 assert.equal(from('sl','price',84000).code,'INVALID_PRICE');
 assert.equal(from('sl','ticks',10,{instrument:{...instrument,tickSize:null}}).code,'TICK_UNKNOWN');
 assert.equal(from('sl','price',1,{plan:{...buy,side:null}}).code,'SIDE_REQUIRED');
 assert.equal(from('sl','unknown',1).code,'INVALID_UNIT');
});

test('percent-of-balance protection uses balance, NOT fluctuating account equity',()=>{
 const varied={...account,balance:200000,equity:50000};
 const p=from('sl','balance',0.04,{account:varied});
 assert.equal(p.valid,true);
 near(p.price,82220.98);
 const v=as('sl','balance',82220.98,{account:varied});
 near(v.value,0.04);
 near(v.accountPercent,0.04);
});
test('missing account balance fails percentage-budget conversion closed',()=>{
 const p=from('sl','balance',0.08,{account:{...account,balance:null}});
 assert.equal(p.valid,false);
 assert.equal(p.code,'BALANCE_UNAVAILABLE');
 const d=as('sl','balance',82220.98,{account:{...account,balance:null}});
 assert.equal(d.code,'BALANCE_UNAVAILABLE');
});
