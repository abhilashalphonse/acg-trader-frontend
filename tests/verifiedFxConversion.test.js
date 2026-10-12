import test from 'node:test';
import assert from 'node:assert/strict';
import {convertFreshFx,conversionQuoteSymbolsForInstrument} from '../src/utils/verifiedFxConversion.js';

const now=1760300000000;
const quote=(symbol,bid,ask,extras={})=>({symbol,bid,ask,live:true,subscribed:true,
  isStale:false,sessionOpen:true,receivedAtMs:now,...extras});
test('AUDCAD in USD account subscribes USDCAD even if not in watchlist',()=>{
 const catalog=[{symbol:'AUDCAD'},{symbol:'USDCAD'},{symbol:'EURUSD'}];
 const symbols=conversionQuoteSymbolsForInstrument({symbol:'AUDCAD',marginCurrency:'CAD',pnlCurrency:'CAD',quoteCurrency:'CAD'},catalog);
 assert.deepEqual(symbols,['USDCAD']);
});
test('USD conversion respects executable bid/ask signs and inverse USDCAD',()=>{
 const fx=[quote('USDCAD',1.37,1.38)];
 assert.ok(Math.abs(convertFreshFx(13.8,'CAD','USD',fx,now)-10)<1e-10);
 assert.ok(Math.abs(convertFreshFx(-13.7,'CAD','USD',fx,now)+10)<1e-10);
 assert.equal(convertFreshFx(10,'USD','USD',[],now),10);
 const direct=[quote('CADUSD',0.722,0.731)];
 assert.equal(convertFreshFx(10,'CAD','USD',direct,now),7.22);
 assert.equal(convertFreshFx(-10,'CAD','USD',direct,now),-7.31);
});
test('stale, unsubscribed, malformed, and missing conversion quotes fail closed',()=>{
 const q=quote('USDCAD',1.37,1.38);
 for(const candidate of [
  {...q,receivedAtMs:now-10001},{...q,receivedAtMs:now+2000},
  {...q,live:false},{...q,subscribed:false},{...q,isStale:true},
  {...q,sessionOpen:false},{...q,bid:0},{...q,ask:1.2},
  {...q,receivedAtMs:null}
 ])assert.equal(convertFreshFx(10,'CAD','USD',[candidate],now),null);
 assert.equal(convertFreshFx(10,'CAD','USD',[],now),null);
});
test('two-leg non-USD cross works only when both USD legs are fresh',()=>{
 const fx=[quote('EURUSD',1.1,1.11),quote('USDCAD',1.37,1.38)];
 const cad=convertFreshFx(10,'EUR','CAD',fx,now);
 assert.ok(Math.abs(cad-15.07)<1e-9);
 assert.equal(convertFreshFx(10,'EUR','CAD',[fx[0]],now),null);
});
