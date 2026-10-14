import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveV4AffordableVolume,v4LotsFromTrack,v4TrackFromLots,v4CryptoQuantity} from '../src/utils/v4SliderSizing.js';
import {estimateOpeningRequirement} from '../src/utils/tradingRisk.js';
import {estimateExecutionPrice} from '../src/utils/executionPricing.js';

const btc=Object.freeze({
  symbol:'BTCUSD',baseCurrency:'BTC',assetClass:'CRYPTO',
  quoteCurrency:'USD',marginCurrency:'USD',
  contractSize:1,bid:83600,ask:83602,tickSize:0.01,
  minVolume:0.01,maxVolume:1000,volumeStep:0.01,
  defaultLeverage:2,commissionRate:0.0002,
});
const account=Object.freeze({
  currency:'USD',balance:100000,equity:100000,freeMargin:100000,leverage:100,
});
const calculate=(a=account,i=btc,options={})=>deriveV4AffordableVolume({instrument:i,account:a,side:'buy',...options});
const expense=(volume,a=account,i=btc)=>{
  const price=estimateExecutionPrice(i,'buy',volume)?.price;
  return estimateOpeningRequirement(price,volume,i,a);
};

test('BTC default 2x: account affordability and fees cap a 1000-lot catalog ceiling',()=>{
 const r=calculate();
 assert.equal(r.valid,true);
 assert.ok(r.affordableLots>2.3&&r.affordableLots<2.5,String(r.affordableLots));
 assert.equal(r.minLots,0.01);
 assert.ok(expense(r.affordableLots)<=account.freeMargin+1e-6);
 assert.ok(expense(r.affordableLots+0.01)>account.freeMargin-1e-6);
 assert.equal(btc.maxVolume,1000);
});
test('legacy 100x BTC quotes still cannot jump to 189 lots at first slider click',()=>{
 const liveLike={...btc,defaultLeverage:100};
 const r=calculate(account,liveLike);
 assert.ok(r.affordableLots>110&&r.affordableLots<120);
 const lot=v4LotsFromTrack(190,{minLots:r.minLots,maxLots:r.affordableLots,step:0.01});
 assert.ok(lot>=0.01&&lot<0.2,'190/1000 track unexpectedly selected '+lot+' lots');
 assert.equal(v4LotsFromTrack(0,{minLots:r.minLots,maxLots:r.affordableLots,step:0.01}),0.01);
 assert.equal(v4LotsFromTrack(1000,{minLots:r.minLots,maxLots:r.affordableLots,step:0.01}),r.affordableLots);
 assert.ok(v4TrackFromLots(0.01,{minLots:r.minLots,maxLots:r.affordableLots})<1);
});
test('slider maintains fine steps around very small crypto holdings',()=>{
 const range={minLots:0.01,maxLots:2.39,step:0.01};
 const outputs=[0,50,100,190,300,400,600,800,1000].map(p=>v4LotsFromTrack(p,range));
 assert.deepEqual([...outputs].sort((a,b)=>a-b),outputs);
 assert.ok(outputs[3]<0.1);
 assert.ok(outputs.every(l=>Number.isInteger(Math.round(l*100))));
 assert.equal(outputs.at(-1),2.39);
});
test('opening costs include commissions and volume-band spread and use SELL bid',()=>{
 const banded={...btc,spreadProfile:{volumeBands:[{upTo:0.3,extraPoints:0},{upTo:null,extraPoints:3000000}]}};
 const a={...account,freeMargin:20000,leverage:10};
 const buy=calculate(a,banded);
 assert.equal(buy.valid,true);
 assert.ok(expense(buy.affordableLots,a,banded)<=a.freeMargin+1e-7);
 const sell=calculate(a,banded,{side:'sell'});
 assert.equal(sell.valid,true);
 assert.ok(sell.affordableLots<=banded.maxVolume);
});
test('unknown FX margin, account or quote fail closed, never produce plausible slider limits',()=>{
 assert.equal(calculate({...account,currency:'EUR'}).valid,false);
 assert.equal(calculate({...account,freeMargin:null}).valid,false);
 assert.equal(calculate(account,{...btc,ask:null}).valid,false);
 assert.equal(calculate({...account,freeMargin:3}).affordableLots,0);
});
test('crypto quantity in BTC; noncrypto lots remain lots',()=>{
 assert.deepEqual(v4CryptoQuantity(0.01,btc),{quantity:0.01,unit:'BTC'});
 assert.deepEqual(v4CryptoQuantity(0.25,{...btc,baseCurrency:null}),{quantity:0.25,unit:'BTC'});
 assert.equal(v4CryptoQuantity(0.01,{...btc,assetClass:'FOREX'}),null);
});

test('USD account previews AUD/CAD margin only with fresh live USDCAD conversion',()=>{
 const now=Date.now();
 const audcad={symbol:'AUDCAD',quoteCurrency:'CAD',marginCurrency:'CAD',pnlCurrency:'CAD',
   contractSize:100000,bid:0.99395,ask:0.99401,minVolume:0.01,maxVolume:10,
   volumeStep:0.01,defaultLeverage:100};
 const fx={symbol:'USDCAD',bid:1.376,ask:1.377,receivedAtMs:now,
   subscribed:true,live:true,isStale:false,sessionOpen:true};
 const convertedAccount={...account,conversionMarkets:[fx]};
 const expected=(0.99401*100000*0.01/100)/1.377;
 const cost=estimateOpeningRequirement(0.99401,0.01,audcad,convertedAccount);
 assert.ok(Math.abs(cost-expected)<1e-9);
 const affordable=deriveV4AffordableVolume({instrument:audcad,account:convertedAccount});
 assert.equal(affordable.valid,true);
 assert.ok(affordable.affordableLots>=0.01);
 for(const invalid of [
   {...fx,receivedAtMs:now-11000},
   {...fx,live:false},
   {...fx,isStale:true},
   {...fx,subscribed:false},
   {...fx,ask:null}
 ]) {
   const invalidAccount={...account,conversionMarkets:[invalid]};
   assert.equal(estimateOpeningRequirement(0.99401,0.01,audcad,invalidAccount),null);
   assert.equal(deriveV4AffordableVolume({instrument:audcad,account:invalidAccount}).valid,false);
 }
});
