import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { SupabaseBrowserAuth, supabaseOnboardingEnabled } from '../src/auth/supabase-browser.js';
import { shouldOpenStandaloneAuth } from '../src/landing/landing-routing.js';

const base = 'https://mwkwvchaqjqtyfgmialk.supabase.co/auth/v1';
function fixture() {
  const data=new Map();
  const storage={getItem:key=>data.get(key)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const location={origin:'https://acg-trader.web.app',href:'https://acg-trader.web.app/auth/callback',assign(url){this.assigned=url;}};
  let lastHistory='';
  const history={replaceState(_state,_unused,url){lastHistory=url;}};
  let responder=async()=>({access_token:'signed-jwt',refresh_token:'provider-refresh',expires_in:3600});
  const calls=[];
  const fetchImpl=async (url,opts)=>{
    calls.push({url,opts});
    const payload=await responder(url,opts);
    return {ok:!payload?.error,status:payload?.error?400:200,json:async()=>payload};
  };
  const auth = new SupabaseBrowserAuth({storage,location,history,fetchImpl,cryptoImpl:webcrypto,now:()=>1800000000000});
  return {auth, calls,location,storage,getHistory:()=>lastHistory,setResponder:next=>{responder=next;}};
}
test('onboarding is disabled by default and federation ticket keeps existing route',()=>{
 assert.equal(supabaseOnboardingEnabled({}),false);
 assert.equal(supabaseOnboardingEnabled({VITE_ACG_SUPABASE_AUTH_ENABLED:'true'}),true);
 assert.equal(shouldOpenStandaloneAuth('/','?acg_auth=signup&acg_onboarding_audit=1'),true);
 assert.equal(shouldOpenStandaloneAuth('/auth/callback',''),true);
 assert.equal(shouldOpenStandaloneAuth('/','?acg_auth=signup'),false);
 assert.equal(shouldOpenStandaloneAuth('/','?ticket=private&acg_auth=signin&acg_onboarding_audit=1'),false);
 assert.equal(shouldOpenStandaloneAuth('/','?acg_ticket=private&acg_auth=signin&acg_onboarding_audit=1'),false);
});
test('email signup uses a PKCE challenge and fixed callback URL',async()=>{
 const fx=fixture();
 fx.setResponder(async()=>({user:{id:'new-user'}}));
 assert.equal(await fx.auth.signUp(' user@example.com ','twelve-letter-password'),null);
 const call=fx.calls[0];
 assert.ok(call.url.startsWith(base+'/signup?'));
 assert.equal(new URL(call.url).searchParams.get('redirect_to'),'https://acg-trader.web.app/auth/callback');
 const body=JSON.parse(call.opts.body);
 assert.equal(body.email,'user@example.com');
 assert.equal(body.code_challenge_method,'s256');
 assert.ok(body.code_challenge.length>=43);
 assert.equal(fx.auth.readPkce().kind,'signup');
});
test('Google OAuth uses PKCE and stores verifier only in session storage',async()=>{
 const fx=fixture();
 await fx.auth.signInGoogle();
 const url=new URL(fx.location.assigned);
 assert.equal(url.origin,'https://mwkwvchaqjqtyfgmialk.supabase.co');
 assert.equal(url.pathname,'/auth/v1/authorize');
 assert.equal(url.searchParams.get('provider'),'google');
 assert.equal(url.searchParams.get('redirect_to'),'https://acg-trader.web.app/auth/callback');
 assert.equal(url.searchParams.get('code_challenge_method'),'s256');
 assert.ok(url.searchParams.has('code_challenge'));
 assert.equal(url.searchParams.has('code_verifier'),false);
});
test('authorization code exchange requires same-browser verifier, consumes code and sanitizes URL',async()=>{
 const fx=fixture();
 await fx.auth.signInGoogle();
 const verifier=fx.auth.readPkce().verifier;
 const result=await fx.auth.consumeCallback('https://acg-trader.web.app/auth/callback?code=opaque-code');
 assert.equal(result.kind,'google');
 assert.equal(result.session.access_token,'signed-jwt');
 assert.equal(fx.calls.length,1);
 assert.deepEqual(JSON.parse(fx.calls[0].opts.body),{auth_code:'opaque-code',code_verifier:verifier});
 assert.equal(fx.auth.readPkce(),null);
 assert.equal(fx.getHistory(),'/?acg_auth=signin&acg_onboarding_audit=1');
});
test('callback without a corresponding verifier fails closed',async()=>{
 const fx=fixture();
 await assert.rejects(fx.auth.consumeCallback('https://acg-trader.web.app/auth/callback?code=unowned'),
 /expired or belongs to another browser/);
 assert.equal(fx.calls.length,0);
});
test('recovery and token-hash callback never expose provider tokens in URL',async()=>{
 const fx=fixture();
 await fx.auth.recover('user@example.com');
 assert.equal(fx.auth.readPkce().kind,'recovery');
 const verified=await fx.auth.consumeCallback('https://acg-trader.web.app/auth/callback?token_hash=opaque-hash&type=recovery');
 assert.equal(verified.kind,'recovery');
 assert.equal(fx.getHistory(),'/?acg_auth=signin&acg_onboarding_audit=1');
 assert.deepEqual(JSON.parse(fx.calls[1].opts.body),{token_hash:'opaque-hash',type:'recovery'});
});
test('refresh rotates Supabase provider token and sign out clears local storage',async()=>{
 const fx=fixture();
 fx.auth.remember({access_token:'old',refresh_token:'refresh-1',expires_in:1});
 assert.equal(await fx.auth.currentAccessToken(),'signed-jwt');
 assert.ok(fx.calls[0].url.endsWith('/token?grant_type=refresh_token'));
 assert.equal((await fx.auth.currentAccessToken()),'signed-jwt');
 assert.equal(fx.calls.length,1);
 await fx.auth.signOut();
 assert.equal(fx.auth.readSession(),null);
 assert.ok(fx.calls[1].url.endsWith('/logout'));
});
test('provider HTTP errors surface user-facing messages without session creation',async()=>{
 const fx=fixture();
 fx.setResponder(async()=>({error:'invalid_credentials',message:'Invalid login credentials'}));
 await assert.rejects(fx.auth.signInPassword('u@example.com','wrong'),/Invalid login credentials/);
 assert.equal(fx.auth.readSession(),null);
});
