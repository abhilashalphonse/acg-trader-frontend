import test from 'node:test';
import assert from 'node:assert/strict';
import { buildV4MarketSections, selectV4Markets, v4MarketPricePresentation } from '../src/utils/v4MarketsDiscovery.js';
const items=[
 {symbol:'EURUSD',assetClass:'FOREX',bid:1.103,ask:1.1032,pipSize:'0.0001',name:'Euro / US Dollar',changePercent:1.4,volume:11},
 {symbol:'AUDCAD',assetClass:'FOREX',bid:0.94,ask:0.9401,pipSize:'0.0001',name:'Australian Dollar / Canadian Dollar',changePercent:-0.2,volume:8},
 {symbol:'AAPL',assetClass:'EQUITY',last:218,changePercent:0.45,volume:20,name:'Apple'},
 {symbol:'BTCUSD',assetClass:'CRYPTO',last:101000,changePercent:-4,volume:15},
 {symbol:'USDCAD',assetClass:'FOREX',bid:1.32,ask:1.321,pipSize:'0.0001',name:'US Dollar / Canadian Dollar'},
];
test('Markets V4 searches every category by symbol or name',()=>{
 assert.deepEqual(selectV4Markets({markets:items,category:'forex',search:'cad',view:'all'}).map(i=>i.symbol),['AUDCAD','USDCAD']);
 assert.deepEqual(selectV4Markets({markets:items,category:'forex',search:'AUD/CAD',view:'all'}).map(i=>i.symbol),['AUDCAD']);
 assert.deepEqual(selectV4Markets({markets:items,category:'stocks',search:'cad',view:'all'}).map(i=>i.symbol),['AUDCAD','USDCAD']);
});
test('Markets V4 popular mode ranks known symbols without hiding other categories',()=>{
 const a=selectV4Markets({markets:items,category:'forex',view:'popular',popularSymbols:['EURUSD','USDCAD']});
 assert.deepEqual(a.map(i=>i.symbol),['EURUSD','USDCAD','AUDCAD']);
});
test('Markets V4 sort, recents and unavailable symbols do not manufacture values',()=>{
 assert.deepEqual(selectV4Markets({markets:items,category:'favorites',watched:items.map(i=>i.symbol),view:'movers'}).map(i=>i.symbol).slice(0,2),['BTCUSD','EURUSD']);
 assert.deepEqual(selectV4Markets({markets:items,category:'favorites',watched:items.map(i=>i.symbol),view:'recent',recent:['AUDCAD','AAPL']}).map(i=>i.symbol),['AUDCAD','AAPL']);
 assert.equal(v4MarketPricePresentation({...items[0],isStale:true},true).bid,'—');
 assert.equal(v4MarketPricePresentation(items[0],true).spread,'2.0p');
 assert.equal(v4MarketPricePresentation(items[2],false).change,'+0.45%');
});

test('Favorites is the existing saved Watchlist subset across markets and categories',()=>{
 assert.deepEqual(selectV4Markets({markets:items,category:'favorites',watched:['AAPL','AUDCAD'],view:'all'}).map(i=>i.symbol),['AAPL','AUDCAD']);
 assert.deepEqual(selectV4Markets({markets:items,category:'favorites',watched:[],view:'all'}),[]);
});
test('Global Stocks US / India submenus split equities without putting India indices into Stocks',()=>{
 const rows=[...items,
  {symbol:'RELIANCE',assetClass:'EQUITY',timezone:'Asia/Kolkata',quoteCurrency:'INR',name:'Reliance'},
  {symbol:'NIFTY',assetClass:'INDEX',timezone:'Asia/Kolkata',quoteCurrency:'INR',name:'NIFTY 50'},
  {symbol:'SAP',assetClass:'EQUITY',listingCountry:'DE',quoteCurrency:'EUR',name:'SAP'},
 ];
 assert.deepEqual(selectV4Markets({markets:rows,category:'stocks',stockCountry:'us',view:'all'}).map(x=>x.symbol),['AAPL']);
 assert.deepEqual(selectV4Markets({markets:rows,category:'stocks',stockCountry:'india',view:'all'}).map(x=>x.symbol),['RELIANCE']);
 assert.deepEqual(selectV4Markets({markets:rows,category:'all',search:'NIFTY',view:'all'}).map(x=>x.symbol),['NIFTY']);
 assert.deepEqual(selectV4Markets({markets:rows,category:'all',search:'SAP',view:'all'}).map(x=>x.symbol),['SAP']);
});

test('V4 search searches the full catalog even from Forex, Favorites or Stocks and cannot hide results with Recent sort',()=>{
 const all=[...items,{symbol:'NIFTY',assetClass:'INDEX',timezone:'Asia/Kolkata',name:'NIFTY 50'}];
 for(const category of ['forex','stocks','favorites','commodities','crypto']){
   assert.deepEqual(selectV4Markets({markets:all,category,stockCountry:'india',watched:[],search:'NIFTY',view:'recent'}).map(x=>x.symbol),['NIFTY']);
 }
 assert.deepEqual(selectV4Markets({markets:all,category:'forex',search:'AUD/CAD',view:'popular'}).map(x=>x.symbol),['AUDCAD']);
});
test('Favorites sections are grouped by market with asset-specific price columns',()=>{
 const all=[...items,
   {symbol:'XAUUSD',assetClass:'METAL',name:'Gold',bid:2601,ask:2601.2},
   {symbol:'NIFTY',assetClass:'INDEX',timezone:'Asia/Kolkata',name:'NIFTY 50'},
   {symbol:'UNKNOWN',assetClass:'MYSTERY',name:'Unknown'},
 ];
 const selection=selectV4Markets({markets:all,category:'favorites',watched:['EURUSD','XAUUSD','AAPL','BTCUSD','NIFTY','UNKNOWN'],view:'all'});
 const sections=buildV4MarketSections(selection,{category:'favorites'});
 assert.deepEqual(sections.map(s=>[s.id,s.layout,s.rows.map(r=>r.symbol)]),[
  ['forex','forex',['EURUSD']],['commodities','mixed',['XAUUSD']],
  ['stocks','last',['AAPL']],['crypto','last',['BTCUSD']],
  ['indices','last',['NIFTY']],['other','last',['UNKNOWN']],
 ]);
 const search=buildV4MarketSections([all[all.length-2]],{category:'forex',search:'NIFTY'});
 assert.equal(search[0].id,'indices');
});
test('Non-search category never mixes Forex with Stocks or Indices',()=>{
 const all=[...items,{symbol:'NIFTY',assetClass:'INDEX',timezone:'Asia/Kolkata'}];
 assert.deepEqual(selectV4Markets({markets:all,category:'forex',view:'all'}).map(r=>r.symbol),['AUDCAD','EURUSD','USDCAD']);
 assert.equal(selectV4Markets({markets:all,category:'forex',view:'all'}).some(r=>r.symbol==='AAPL'),false);
});
