// Dedicated ACG Trader Supabase Auth API. No service-role credentials are used.
// This deliberately keeps provider access/refresh tokens separate from the
// existing HttpOnly ACG Trader trading-session cookie.
const STORE_KEY = 'acg-trader-supabase-session-v1';
const PKCE_KEY = 'acg-trader-supabase-pkce-v1';
const PKCE_MAX_AGE_MS = 10 * 60 * 1000;
const MIN_REMAINING_MS = 60 * 1000;

export const SUPABASE_PROJECT_REF = 'mwkwvchaqjqtyfgmialk';
// A publishable browser key is public by design; NEVER use the service_role key.
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jWU1C6V6HsdSM8JMb2KoKg_cnyPduhV';

export function supabaseOnboardingEnabled(env = import.meta.env) {
  return String(env.VITE_ACG_SUPABASE_AUTH_ENABLED || '').toLowerCase() === 'true';
}

export function onboardingPreview(search = '') {
  const p = new URLSearchParams(search);
  return p.get('acg_onboarding_audit') === '1';
}

function errorFrom(data, status) {
  const err = new Error(data?.msg || data?.error_description || data?.message || 'Authentication request failed');
  err.code = data?.code || data?.error_code || data?.error || 'SUPABASE_AUTH_ERROR';
  err.status = status;
  return err;
}

function tokenRecord(result, now) {
  if (!result?.access_token || !result?.refresh_token || !Number.isFinite(Number(result.expires_in))) {
    throw new Error('Supabase did not issue a complete session');
  }
  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: now() + Number(result.expires_in) * 1000,
  };
}

function encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export class SupabaseBrowserAuth {
  constructor({ projectRef = SUPABASE_PROJECT_REF, publishableKey = SUPABASE_PUBLISHABLE_KEY,
    fetchImpl = fetch, storage = globalThis.sessionStorage, cryptoImpl = globalThis.crypto,
    location = globalThis.location, history = globalThis.history, now = Date.now } = {}) {
    if (!/^[a-z0-9]{20}$/.test(projectRef) || !publishableKey.startsWith('sb_publishable_')) {
      throw new Error('ACG Trader Supabase public configuration is invalid');
    }
    this.root = `https://${projectRef}.supabase.co/auth/v1`;
    this.key = publishableKey;
    this.fetchImpl = fetchImpl;
    this.storage = storage;
    this.cryptoImpl = cryptoImpl;
    this.location = location;
    this.history = history;
    this.now = now;
    this.refreshPromise = null;
  }

  async request(path, { method = 'POST', body, token = null } = {}) {
    const res = await this.fetchImpl(this.root + path, {
      method,
      cache: 'no-store',
      headers: {
        apikey: this.key,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw errorFrom(data, res.status);
    return data;
  }

  callbackUrl() {
    // Fixed path on the CURRENT same origin. Untrusted query params never
    // determine the OAuth redirect target.
    return `${this.location.origin}/auth/callback`;
  }

  async preparePkce(kind) {
    if (!this.cryptoImpl?.subtle || !this.cryptoImpl?.getRandomValues) throw new Error('Secure browser context required for Google sign-in');
    const bytes = new Uint8Array(48);
    this.cryptoImpl.getRandomValues(bytes);
    const verifier = encode(bytes);
    const digest = await this.cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = encode(new Uint8Array(digest));
    this.storage.setItem(PKCE_KEY, JSON.stringify({ verifier, kind, createdAt: this.now() }));
    return challenge;
  }

  async signUp(email, password) {
    const challenge = await this.preparePkce('signup');
    const query = new URLSearchParams({ redirect_to: this.callbackUrl() });
    const result = await this.request(`/signup?${query}`, { body: {
      email: email.trim(), password, code_challenge: challenge, code_challenge_method: 's256',
    } });
    if (result?.access_token) return this.remember(result);
    return null; // Email verification pending. Do not imply a trading account was created.
  }

  async signInPassword(email, password) {
    const result = await this.request('/token?grant_type=password', {
      body: { email: email.trim(), password },
    });
    return this.remember(result);
  }

  async signInGoogle() {
    const challenge = await this.preparePkce('google');
    const params = new URLSearchParams({
      provider: 'google',
      redirect_to: this.callbackUrl(),
      code_challenge: challenge,
      code_challenge_method: 's256',
    });
    this.location.assign(`${this.root}/authorize?${params}`);
  }

  async recover(email) {
    const challenge = await this.preparePkce('recovery');
    const params = new URLSearchParams({ redirect_to: this.callbackUrl() });
    await this.request(`/recover?${params}`, { body: {
      email: email.trim(), code_challenge: challenge, code_challenge_method: 's256',
    } });
  }

  async consumeCallback(href = this.location.href) {
    const url = new URL(href);
    if (url.origin !== this.location.origin || url.pathname !== '/auth/callback') throw new Error('Invalid authentication callback URL');
    const message = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (message) {
      this.clearPkce();
      this.clearCallbackUrl();
      throw new Error(message);
    }
    const code = url.searchParams.get('code');
    const kind = this.readPkce()?.kind || 'signin';
    if (code) {
      const flow = this.readPkce();
      if (!flow || this.now() - flow.createdAt > PKCE_MAX_AGE_MS || this.now() < flow.createdAt - 60_000) {
        this.clearPkce();
        this.clearCallbackUrl();
        throw new Error('Sign-in link expired or belongs to another browser. Please sign in again.');
      }
      try {
        const result = await this.request('/token?grant_type=pkce', {
          body: { auth_code: code, code_verifier: flow.verifier },
        });
        this.clearCallbackUrl();
        return { kind, session: this.remember(result) };
      } finally { this.clearPkce(); }
    }
    // Default Supabase email templates may use token hashes rather than codes.
    // Only redeem via the fixed project's API, never trust JWTs in URL fragments.
    const hash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');
    if (hash && ['email', 'signup', 'recovery'].includes(type)) {
      try {
        const result = await this.request('/verify', { body: { token_hash: hash, type: type === 'signup' ? 'email' : type } });
        this.clearCallbackUrl();
        return { kind: type === 'recovery' ? 'recovery' : kind, session: this.remember(result) };
      } finally { this.clearPkce(); }
    }
    this.clearCallbackUrl();
    throw new Error('No valid authentication code was received. Please sign in again.');
  }

  clearCallbackUrl() {
    this.history.replaceState({}, '', '/?acg_auth=signin&acg_onboarding_audit=1');
  }

  readPkce() {
    try { return JSON.parse(this.storage.getItem(PKCE_KEY) || 'null'); }
    catch { return null; }
  }

  clearPkce() { this.storage.removeItem(PKCE_KEY); }

  remember(result) {
    const session = tokenRecord(result, this.now);
    this.storage.setItem(STORE_KEY, JSON.stringify(session));
    return session;
  }

  readSession() {
    try {
      const s = JSON.parse(this.storage.getItem(STORE_KEY) || 'null');
      return s?.access_token && s?.refresh_token && Number.isFinite(s.expires_at) ? s : null;
    } catch { return null; }
  }

  async currentAccessToken() {
    const session = this.readSession();
    if (!session) return null;
    if (session.expires_at - this.now() > MIN_REMAINING_MS) return session.access_token;
    if (!this.refreshPromise) {
      this.refreshPromise = this.request('/token?grant_type=refresh_token', {
        body: { refresh_token: session.refresh_token },
      }).then(result => this.remember(result)).catch(error => {
        this.clearSession();
        throw error;
      }).finally(() => { this.refreshPromise = null; });
    }
    return (await this.refreshPromise).access_token;
  }

  async changePassword(password) {
    const token = await this.currentAccessToken();
    if (!token) throw new Error('Your recovery session has expired. Please request a new link.');
    await this.request('/user', { method: 'PUT', token, body: { password } });
    this.clearPkce();
  }

  clearSession() {
    this.storage.removeItem(STORE_KEY);
    this.clearPkce();
  }

  async signOut() {
    const token = this.readSession()?.access_token;
    this.clearSession();
    if (token) await this.request('/logout', { token }).catch(() => {});
  }
}
