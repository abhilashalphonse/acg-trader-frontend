import test from 'node:test';
import assert from 'node:assert/strict';
import { selectV4Markets, v4MarketPricePresentation } from '../src/utils/v4MarketsDiscovery.js';
const items=[
 {symbol:'EURUSD',assetClass:'FOREX',bid:1.103,ask:1.1032,pipSize:'0.0001',name:'Euro / US Dollar',changePercent:1.4,volume:11},
 {symbol:'AUDCAD',assetClass:'FOREX',bid:0.94,ask:0.9401,pipSize:'0.0001',name:'Australian Dollar / Canadian Dollar',changePercent:-0.2,volume:8},
 {symbol:'AAPL',assetClass:'EQUITY',last:218,changePercent:0.45,volume:20,name:'Apple'},
 {symbol:'BTCUSD',assetClass:'CRYPTO',last:101000,changePercent:-4,volume:15},
 {symbol:'USDCAD',assetClass:'FOREX',bid:1.32,ask:1.321,pipSize:'0.0001',name:'US Dollar / Canadian Dollar'},
];
test('Markets V4 preserves category while searching by symbol or name',()=>{
 assert.deepEqual(selectV4Markets({markets:items,category:'forex',search:'cad',view:'all'}).map(i=>i.symbol),['AUDCAD','USDCAD']);
 assert.deepEqual(selectV4Markets({markets:items,category:'forex',search:'AUD/CAD',view:'all'}).map(i=>i.symbol),['AUDCAD']);
 assert.deepEqual(selectV4Markets({markets:items,category:'stocks',search:'cad',view:'all'}),[]);
});
test('Markets V4 popular mode ranks known symbols without hiding other categories',()=>{
 const a=selectV4Markets({markets:items,category:'forex',view:'popular',popularSymbols:['EURUSD','USDCAD']});
 assert.deepEqual(a.map(i=>i.symbol),['EURUSD','USDCAD','AUDCAD']);
});
test('Markets V4 sort, recents and unavailable symbols do not manufacture values',()=>{
 assert.deepEqual(selectV4Markets({markets:items,view:'movers'}).map(i=>i.symbol).slice(0,2),['BTCUSD','EURUSD']);
 assert.deepEqual(selectV4Markets({markets:items,view:'recent',recent:['AUDCAD','AAPL']}).map(i=>i.symbol),['AUDCAD','AAPL']);
 assert.equal(v4MarketPricePresentation({...items[0],isStale:true},true).bid,'—');
 assert.equal(v4MarketPricePresentation(items[0],true).spread,'2.0p');
 assert.equal(v4MarketPricePresentation(items[2],false).change,'+0.45%');
});
