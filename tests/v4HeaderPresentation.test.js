import test from 'node:test';
import assert from 'node:assert/strict';
import {v4HeaderAccountLabel,v4HeaderFxMonogram,v4HeaderMarketStatus} from '../src/utils/v4HeaderPresentation.js';
test('Market header never reports unknown, stale, or disconnected feeds as open',()=>{
 assert.equal(v4HeaderMarketStatus(null),'unavailable');
 assert.equal(v4HeaderMarketStatus({marketState:'WAITING'}),'unavailable');
 assert.equal(v4HeaderMarketStatus({marketState:'LIVE',isStale:true}),'unavailable');
 assert.equal(v4HeaderMarketStatus({sessionOpen:false,marketState:'LIVE'}),'closed');
 assert.equal(v4HeaderMarketStatus({sessionOpen:true,marketState:'LIVE'}),'open');
 assert.equal(v4HeaderMarketStatus({marketState:'LIVE'}),'open');
});
test('FX monogram is only used for supported currency pairs; keep native icon otherwise',()=>{
 assert.equal(v4HeaderFxMonogram({symbol:'GBPUSD',assetClass:'FOREX'}),'£$');
 assert.equal(v4HeaderFxMonogram({symbol:'EUR/USD',assetClass:'FOREX'}),'€$');
 assert.equal(v4HeaderFxMonogram({symbol:'BTCUSD',assetClass:'CRYPTO'}),null);
 assert.equal(v4HeaderFxMonogram({symbol:'ZARUSD',assetClass:'FOREX'}),null);
});
test('Short account label never substitutes for the full account code in the menu',()=>{
 assert.equal(v4HeaderAccountLabel({accountCode:'ACG-33E47A598D2F'}),'ACG · 598D2F');
 assert.equal(v4HeaderAccountLabel({}),'Trading account');
});
