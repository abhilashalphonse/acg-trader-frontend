import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveV4AffordableVolume,deriveV4AffordableRiskRange,v4LotsFromTrack,v4TrackFromLots,v4CryptoQuantity} from '../src/utils/v4SliderSizing.js';
import {resolveV4PositionSizing} from '../src/utils/v4ExecutionPrecision.js';
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

test('Risk % and USD slider endpoints remain executable and stop below unaffordable BTC risk',()=>{
 const plan={symbol:'BTCUSD',side:'buy',pending:false,orderType:'market',
   entry:btc.ask,sl:btc.ask-400,tp:null,sizingMode:'risk'};
 const available=calculate();
 const range=deriveV4AffordableRiskRange({instrument:btc,account,plan,affordableLots:available.affordableLots});
 assert.equal(range.valid,true,JSON.stringify(range));
 assert.ok(range.percent.min>0 && range.percent.max<5,JSON.stringify(range));
 assert.ok(range.usd.max<5000,JSON.stringify(range));
 for(const [mode,r] of [['riskPercent',range.percent],['riskUSD',range.usd]]){
   for(const amount of [r.min,r.max]){
     const result=resolveV4PositionSizing({mode,amount,plan,account,instrument:btc});
     assert.equal(result.canExecute,true,JSON.stringify({mode,amount,result}));
     assert.ok(result.openingRequirement<=account.freeMargin+1e-8);
   }
 }
 const beyond=resolveV4PositionSizing({mode:'riskUSD',amount:range.usd.max+100,plan,account,instrument:btc});
 assert.equal(beyond.canExecute,false);
 assert.equal(beyond.code,'INSUFFICIENT_MARGIN');
});

test('Risk slider re-evaluates on margin, stop distance, and side; unknown data fails closed',()=>{
 const buy={symbol:'BTCUSD',side:'buy',pending:false,orderType:'market',entry:btc.ask,sl:btc.ask-400,sizingMode:'risk'};
 const sell={...buy,side:'sell',entry:btc.bid,sl:btc.bid+400};
 const make=(a,p,i=btc)=>{
   const available=calculate(a,i,{side:p.side});
   return deriveV4AffordableRiskRange({instrument:i,account:a,plan:p,affordableLots:available.affordableLots});
 };
 const full=make(account,buy);
 const reduced=make({...account,freeMargin:50000},buy);
 const tightStop=make(account,{...buy,sl:btc.ask-100});
 const short=make(account,sell);
 assert.equal(full.valid,true,JSON.stringify(full));
 assert.equal(reduced.valid,true,JSON.stringify(reduced));
 assert.equal(tightStop.valid,true,JSON.stringify(tightStop));
 assert.equal(short.valid,true,JSON.stringify(short));
 assert.ok(reduced.usd.max<full.usd.max);
 assert.ok(reduced.percent.max<full.percent.max);
 assert.ok(tightStop.usd.max<full.usd.max);
 assert.equal(make(account,{...buy,sl:null}).valid,false);
 assert.equal(make({...account,freeMargin:null},buy).valid,false);
 assert.equal(make({...account,freeMargin:3},buy).valid,false);
 assert.equal(make(account,{...buy,sl:btc.ask+50}).valid,false);
 assert.equal(make(account,buy,{...btc,ask:null}).valid,false);
});

test('Risk slider uses opening fees and market liquidity bands rather than account percent alone',()=>{
 const banded={...btc,spreadProfile:{volumeBands:[{upTo:1,extraPoints:0},{upTo:null,extraPoints:250000}]}};
 const plan={symbol:'BTCUSD',side:'buy',pending:false,orderType:'market',entry:banded.ask,sl:banded.ask-400,sizingMode:'risk'};
 const affordable=calculate(account,banded);
 const range=deriveV4AffordableRiskRange({instrument:banded,account,plan,affordableLots:affordable.affordableLots});
 assert.equal(range.valid,true,JSON.stringify(range));
 const result=resolveV4PositionSizing({mode:'riskUSD',amount:range.usd.max,plan,account,instrument:banded});
 assert.equal(result.canExecute,true,JSON.stringify(result));
 assert.ok(result.openingRequirement<=account.freeMargin);
});
