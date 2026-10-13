import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveLeverage, estimateRequiredMargin, estimateOpeningRequirement } from '../src/utils/tradingRisk.js';
import { deriveV4AffordableVolume } from '../src/utils/v4SliderSizing.js';

const account = { currency:'USD', leverage:100, balance:100000, equity:100000, freeMargin:100000 };
const limits = {
  FOREX:100, METAL:50, ENERGY:50, OTHER:50, INDEX:20, EQUITY:10, CRYPTO:2,
};

test('V4 position sizing previews respect the backend catalog for every asset class', () => {
  for(const [assetClass, defaultLeverage] of Object.entries(limits)) {
    const market={symbol:'SAMPLEUSD',assetClass,baseCurrency:'SAMPLE',
      quoteCurrency:'USD',marginCurrency:'USD',contractSize:1,
      defaultLeverage,marginRate:null};
    assert.equal(effectiveLeverage(account,market),defaultLeverage,assetClass);
    assert.equal(estimateRequiredMargin(10000,1,market,account),10000/defaultLeverage,assetClass);
  }
});

test('Account leverage lower than market ceiling is applied to margin previews',()=>{
  const market={symbol:'EURUSD',assetClass:'FOREX',contractSize:1,quoteCurrency:'USD',
    marginCurrency:'USD',defaultLeverage:100};
  assert.equal(effectiveLeverage({...account,leverage:5},market),5);
  assert.equal(estimateRequiredMargin(10000,1,market,{...account,leverage:5}),2000);
});

test('A configured marginRate cannot silently bypass crypto 2x ceiling',()=>{
  const market={symbol:'BTCUSD',assetClass:'CRYPTO',contractSize:1,
    quoteCurrency:'USD',marginCurrency:'USD',defaultLeverage:2,marginRate:0.01};
  assert.equal(effectiveLeverage(account,market),2);
  assert.equal(estimateRequiredMargin(10000,1,market,account),5000);
  assert.equal(effectiveLeverage(account,{...market,marginRate:0.75}),4/3);
  assert.equal(estimateRequiredMargin(10000,1,{...market,marginRate:0.75},account),7500);
  assert.equal(effectiveLeverage(account,{...market,defaultLeverage:null}),null);
  assert.equal(estimateOpeningRequirement(10000,1,{...market,defaultLeverage:null},account),null);
});

test('BTC 2x affordability follows the 50% margin floor and never uses account 100x',()=>{
  const market={symbol:'BTCUSD',assetClass:'CRYPTO',baseCurrency:'BTC',
    quoteCurrency:'USD',marginCurrency:'USD',contractSize:1,bid:100,ask:100,
    tickSize:0.01,minVolume:0.01,maxVolume:1000,volumeStep:0.01,
    defaultLeverage:2,marginRate:0.01,commissionRate:0};
  const preview=deriveV4AffordableVolume({instrument:market,account:{...account,freeMargin:1000},side:'buy'});
  assert.equal(preview.valid,true);
  assert.ok(preview.affordableLots<=20, String(preview.affordableLots));
  assert.ok(preview.affordableLots>=19.99, String(preview.affordableLots));
});
