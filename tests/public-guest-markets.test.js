import test from 'node:test';
import assert from 'node:assert/strict';
import {GUEST_MARKETS,GUEST_TIMEFRAMES,makeGuestCandles,shouldUseGuestMarketWorkspace} from '../src/public/guestMarkets.js';

test('guest entry is isolated from explicit login, federation, and account routes',()=>{
 assert.equal(shouldUseGuestMarketWorkspace('/terminal',''),true);
 for(const path of ['/','/auth/callback','/terminal/login','/account'])assert.equal(shouldUseGuestMarketWorkspace(path,''),false);
 for(const query of ['?acg_login=1','?acg_connect_prop=1','?ticket=abc','?acg_ticket=abc','?acg_terminal=1','?acg_auth=signup','?acg_v4_audit=0','?acg_mobile_audit=1','?acg_onboarding_audit=1'])
   assert.equal(shouldUseGuestMarketWorkspace('/terminal',query),false,query);
});
test('sample charts are deterministic, positive, valid and chronological',()=>{
 for(const market of GUEST_MARKETS)for(const timeframe of GUEST_TIMEFRAMES){
  const a=makeGuestCandles(market.symbol,timeframe.key);
  assert.deepEqual(a,makeGuestCandles(market.symbol,timeframe.key));
  assert.equal(new Set(a.map(bar=>bar.time)).size,a.length);
  for(let i=0;i<a.length;i++){
    const bar=a[i];
    assert.ok(bar.high>=Math.max(bar.open,bar.close)&&bar.low<=Math.min(bar.open,bar.close)&&bar.low>0);
    if(i)assert.equal(bar.time-a[i-1].time,timeframe.seconds);
  }
 }
});
test('sample output is bounded and limited to the explicit catalog',()=>{
 assert.deepEqual(GUEST_MARKETS.map(x=>x.symbol),['EURUSD','XAUUSD','BTCUSD']);
 assert.equal(makeGuestCandles('EURUSD','M30',1).length,60);
 assert.equal(makeGuestCandles('EURUSD','M30',50000).length,350);
});
