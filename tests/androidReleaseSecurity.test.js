import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNativeAuthCallback, startAndroidLifecycle } from '../src/native/androidLifecycle.js';
import { isExistingAccountReadOnlyBeta } from '../src/native/existingAccountBeta.js';

test('Android deep links only accept the app-owned PKCE callback, not arbitrary hosts or routes', () => {
  assert.equal(parseNativeAuthCallback('acgtrader://auth/callback?code=only-once'), '/auth/callback?code=only-once');
  assert.equal(parseNativeAuthCallback('acgtrader://auth/callback?token_hash=abc&type=recovery'), '/auth/callback?token_hash=abc&type=recovery');
  assert.equal(parseNativeAuthCallback('acgtrader://auth/callback?code=a&evil=browser-redirect'), '/auth/callback?code=a');
  for (const url of [
    'https://example.com/auth/callback?code=steal',
    'acgtrader://evil/callback?code=steal',
    'acgtrader://auth/other?code=steal',
    'acgtrader://auth/callback?next=https://evil.test',
    'not-an-absolute-uri',
  ]) assert.equal(parseNativeAuthCallback(url), null, url);
});

test('Android lifecycle only registers on actual native bridge and honors UI-handled Back', async () => {
  const handlers = new Map();
  let minimized = 0;
  let browserClosed = 0;
  let replaced = '';
  const runtime = {
    Capacitor: {isNativePlatform: () => true, getPlatform: () => 'android'},
    location: {pathname:'/terminal',search:'',replace:v=>{replaced=v;},assign:()=>{}},
    history: {back:()=>{throw Error('History should not be touched');}},
    dispatchEvent(event) {if(event.type==='acg-android-back')event.detail.handled=true;},
  };
  const app = {
    addListener: async (name,handler)=>{handlers.set(name,handler);return {remove:async()=>{handlers.delete(name);}};},
    getLaunchUrl:async()=>({}),
    minimizeApp: async()=>{minimized++;},
  };
  const browser={close:async()=>{browserClosed++;}};
  const dispose=await startAndroidLifecycle({runtime,app,browser});
  await handlers.get('backButton')({canGoBack:true});
  assert.equal(minimized,0);
  handlers.get('appUrlOpen')({url:'acgtrader://auth/callback?code=one-time'});
  assert.equal(replaced,'/auth/callback?code=one-time');
  await Promise.resolve();
  assert.equal(browserClosed,1);
  dispose();
  assert.equal(handlers.size,0);
});

test('normal production release flag enables the unchanged server-authorized trading flow', () => {
  assert.equal(isExistingAccountReadOnlyBeta({VITE_ACG_ANDROID_READ_ONLY_BETA:'false'}),false);
  assert.equal(isExistingAccountReadOnlyBeta({VITE_ACG_ANDROID_READ_ONLY_BETA:'true'}),true);
});
