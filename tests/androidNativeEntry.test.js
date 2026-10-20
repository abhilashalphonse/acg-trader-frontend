import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPresentNativeEntry } from '../src/native/nativePresentation.js';
import { mayIssueExistingBetaRequest } from '../src/native/existingAccountBeta.js';

test('native screens are unconditional only in actual Android; web preview needs a build flag',()=>{
  const android={Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'}};
  const web={Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'}};
  assert.equal(shouldPresentNativeEntry(android,{}),true);
  assert.equal(shouldPresentNativeEntry(web,{}),false);
  assert.equal(shouldPresentNativeEntry(web,{VITE_ACG_NATIVE_UI_PREVIEW:'true'}),true);
  assert.equal(shouldPresentNativeEntry(web,{VITE_ACG_NATIVE_UI_PREVIEW:'false'}),false);
});

test('existing-account production app remains read-only including profile changes',()=>{
  for(const [verb,route] of [
    ['POST','/v1/trading/orders/market'],
    ['PATCH','/v1/trading/positions/xyz/protection'],
    ['POST','/v1/trading/accounts/xyz/positions/close-all'],
    ['POST','/v1/auth/personal/demo'],
    ['PUT','/v1/profile']
  ]) assert.equal(mayIssueExistingBetaRequest(verb,route),false,route);
});
