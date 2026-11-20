import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { approvedFundedUrl } from '../src/security/approvedAuthUrls.js';
import { SupabaseBrowserAuth } from '../src/auth/supabase-browser.js';

function fixture() {
  const entries = new Map([['acg-trader-supabase-session-v1', '{"access_token":"old","refresh_token":"stolen"}']]);
  const storage = { getItem: k => entries.get(k) || null,
    setItem: (k,v) => entries.set(k,v), removeItem: k => entries.delete(k) };
  const location = { origin: 'https://acg-trader.web.app',
    href: 'https://acg-trader.web.app/auth/callback' };
  let scrubbed = '';
  const history = { replaceState: (_state,_unused,url) => { scrubbed = url; } };
  const calls = [];
  let responder = () => ({access_token:'provider-access',refresh_token:'provider-refresh',expires_in:3600});
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    const response = responder(url, options);
    return {ok:!response.error,status:response.error?400:200,json:async()=>response};
  };
  const auth = new SupabaseBrowserAuth({ storage, location, history, fetchImpl,
    cryptoImpl:webcrypto, now:()=>1800000000000, sessionCache:{current:null} });
  return {auth,storage,calls,getScrubbed:()=>scrubbed,setResponder:v=>{responder=v;}};
}

test('legitimate Funded help remains HTTPS and lookalikes cannot receive trading credentials', () => {
  assert.equal(approvedFundedUrl('https://acgfunded.com/dashboard'), 'https://acgfunded.com/dashboard');
  assert.equal(approvedFundedUrl('https://www.acgfunded.com'), 'https://www.acgfunded.com/');
  for (const untrusted of [
    'https://acgfunded.com.evil.example/login', 'https://acgfunded.com@evil.example/',
    'http://acgfunded.com/', 'javascript:alert(1)', 'https://evil.example',
    'https://acgfunded.com:8443/', '//evil.example', 'invalid URL',
  ]) {
    assert.equal(approvedFundedUrl(untrusted), null, untrusted);
  }
});

test('legacy browser-stored provider tokens are wiped and no longer persisted', async () => {
  const x = fixture();
  assert.equal(x.storage.getItem('acg-trader-supabase-session-v1'), null);
  const s = await x.auth.signInPassword('trader@example.com', 'strongpassphrase');
  assert.equal(s.access_token, 'provider-access');
  assert.equal(x.auth.readSession().refresh_token, 'provider-refresh');
  assert.equal(x.storage.getItem('acg-trader-supabase-session-v1'), null);
  await x.auth.signOut();
  assert.equal(x.auth.readSession(), null);
});

test('provider-controlled callback error text cannot be injected into login UI', async () => {
  const x = fixture();
  const hostile = '<b>Go to fake.bank and enter recovery codes</b>';
  await assert.rejects(x.auth.consumeCallback(
    'https://acg-trader.web.app/auth/callback?error=access_denied&error_description=' + encodeURIComponent(hostile),
  ), /Authentication could not be completed/);
  assert.equal(x.getScrubbed(), '/?acg_auth=signin&acg_onboarding_audit=1');
  assert.equal(x.calls.length, 0);
});

test('unsolicited recovery token hashes fail closed without an initiating session', async () => {
  const x = fixture();
  await assert.rejects(x.auth.consumeCallback(
    'https://acg-trader.web.app/auth/callback?token_hash=forged&type=recovery',
  ), /expired or belongs to another browser/);
  assert.equal(x.getScrubbed(), '/?acg_auth=signin&acg_onboarding_audit=1');
  assert.equal(x.calls.length, 0);
});

test('signup verifier must not be reused to accept a password recovery link', async () => {
  const x = fixture();
  await x.auth.signUp('trader@example.com','strongpassphrase');
  await assert.rejects(x.auth.consumeCallback(
    'https://acg-trader.web.app/auth/callback?token_hash=forged&type=recovery',
  ), /expired or belongs to another browser/);
  assert.equal(x.calls.length, 1);
});

test('failed callback exchange still removes the authentication code from browser URL', async () => {
  const x = fixture();
  await x.auth.preparePkce('google');
  x.setResponder(()=>({error:'invalid_grant',message:'Expired token'}));
  await assert.rejects(x.auth.consumeCallback('https://acg-trader.web.app/auth/callback?code=bad-code'), /Expired token/);
  assert.equal(x.getScrubbed(), '/?acg_auth=signin&acg_onboarding_audit=1');
});

test('Hosting prohibits inline scripts and allows only the audited first-party motion file on public landing', () => {
  const config=JSON.parse(readFileSync(new URL('../firebase.json',import.meta.url),'utf8'));
  const csp=config.hosting.headers.flatMap(x=>x.headers).find(x=>x.key==='Content-Security-Policy')?.value;
  assert.match(csp, /script-src 'self';/);
  assert.match(csp, /script-src-attr 'none';/);
  assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp,/script-src[^;]*'unsafe-eval'/);
  assert.match(csp,/frame-ancestors 'none'/);
  assert.match(csp,/form-action 'self'/);
  const html=readFileSync(new URL('../public/acg-landing-v6.html',import.meta.url),'utf8');
  const tags = [...html.matchAll(/<script\b[^>]*>/g)].map(x => x[0]);
  assert.deepEqual(tags, ['<script src="/acg-landing-motion.js" defer>']);
  assert.doesNotMatch(html, /<script\b[^>]*>[\s\S]+?<\/script>/i);
  const motion = readFileSync(new URL('../public/acg-landing-motion.js', import.meta.url), 'utf8');
  assert.doesNotMatch(motion, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|eval\s*\(|new Function\s*\(/);
});

test('disabled personal account flow scrubs any OAuth callback URL', () => {
  const source=readFileSync(new URL('../src/components/StandaloneAuthPage.jsx',import.meta.url),'utf8');
  assert.match(source,/if \(!enabled\) \{[\s\S]*?browser\.clearCallbackUrl\(\)/);
});
