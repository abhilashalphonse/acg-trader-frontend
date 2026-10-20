import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useTraderAuth } from '../hooks/useTraderAuth.js';
import { SupabaseBrowserAuth, supabaseOnboardingEnabled } from '../auth/supabase-browser.js';
import { useNativeEntryScreens } from '../native/nativePresentation.js';
import NativePersonalAuthPage from './native/NativePersonalAuthPage.jsx';

const isStrongEnough = password => typeof password === 'string' && password.length >= 12 && password.length <= 128;

function authMode() {
  if (window.location.pathname === '/auth/callback') return 'callback';
  const value = new URLSearchParams(window.location.search).get('acg_auth');
  return ['signin', 'signup', 'recover'].includes(value) ? value : 'signin';
}

function ScreenCard({ children }) {
  return <section className="acg-auth-card w-full rounded-[24px] border border-[#dddfd9] bg-white p-6 shadow-[0_20px_70px_rgba(12,16,14,.05)] sm:p-9">
    {children}
  </section>;
}

function Button({ children, secondary = false, disabled = false, onClick, submit = false }) {
  return <button type={submit ? 'submit' : 'button'} onClick={onClick} disabled={disabled}
    className={`acg-auth-button-${secondary ? 'secondary' : 'primary'} flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-45 ${secondary
      ? 'border border-[#d6d9d4] bg-white text-[#171919] hover:bg-[#f5f6f3]'
      : 'bg-[#141516] text-white hover:bg-[#303233]'}`}>{children}</button>;
}

function Input({ label, type = 'text', value, onChange, autoComplete, required = true, minLength }) {
  return <label className="block space-y-2">
    <span className="acg-auth-label text-xs font-bold text-[#484d4a]">{label}</span>
    <input required={required} type={type} value={value} autoComplete={autoComplete}
      minLength={minLength} onChange={event => onChange(event.target.value)}
      className="acg-auth-input-field block min-h-12 w-full rounded-xl border border-[#d2d5ce] bg-[#fafbf8] px-4 text-base text-[#151715] outline-none focus:border-[#262825] focus:ring-2 focus:ring-[#262825]/10"
    />
  </label>;
}

export default function StandaloneAuthPage() {
  const auth = useTraderAuth();
  const browser = useMemo(() => new SupabaseBrowserAuth(), []);
  const [mode, setMode] = useState(authMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const enabled = supabaseOnboardingEnabled();
  const native = useNativeEntryScreens();

  const go = next => {
    setMode(next); setError(''); setPassword(''); setConfirmation('');
    const url = new URL(window.location.href);
    url.pathname = '/'; url.search = '';
    url.searchParams.set('acg_auth', next);
    url.searchParams.set('acg_onboarding_audit', '1');
    window.history.pushState({}, '', url.pathname + url.search);
  };

  // The backend selects the ACG Trader-owned demo namespace. No tenant
  // IDs, partner grants, balances or platform calculations are passed here.
  const startContext = async () => {
    const token = await browser.currentAccessToken();
    if (!token) { go('signin'); return; }
    try {
      await auth.loginPersonalDemo(token);
      window.location.assign('/terminal');
    } catch (nextError) {
      if (['PERSONAL_DEMO_LEDGER_UNAVAILABLE', 'PERSONAL_DEMO_UNAVAILABLE',
        'IDENTITY_CONFIRMATION_UNAVAILABLE', 'NETWORK_ERROR',
        'REQUEST_TIMEOUT'].includes(nextError?.code)) {
        setMode('setup');
      }
      throw nextError;
    }
  };

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const initialise = async () => {
      setBusy(true); setError('');
      try {
        if (window.location.pathname === '/auth/callback') {
          const result = await browser.consumeCallback();
          if (!active) return;
          if (result.kind === 'recovery') { setMode('reset'); return; }
          await startContext();
        } else if (browser.readSession()) {
          await startContext();
        }
      } catch (nextError) {
        if (!active) return;
        setError(nextError.message || 'Unable to complete authentication');
        const retryable = ['PERSONAL_DEMO_LEDGER_UNAVAILABLE', 'PERSONAL_DEMO_UNAVAILABLE',
          'IDENTITY_CONFIRMATION_UNAVAILABLE', 'NETWORK_ERROR', 'REQUEST_TIMEOUT'].includes(nextError?.code);
        setMode(retryable ? 'setup' : 'signin');
      } finally { if (active) setBusy(false); }
    };
    void initialise();
    return () => { active = false; };
  }, [browser, enabled]);

  const handleSubmit = async event => {
    event.preventDefault();
    if (!enabled || busy) return;
    setBusy(true); setError('');
    try {
      if (mode === 'signin') {
        await browser.signInPassword(email, password);
        await startContext();
      } else if (mode === 'signup') {
        if (!isStrongEnough(password)) throw new Error('Use a password of at least 12 characters.');
        const session = await browser.signUp(email, password);
        if (session) await startContext();
        else setMode('verify');
      } else if (mode === 'recover') {
        await browser.recover(email);
        setMode('recovery-sent');
      } else if (mode === 'reset') {
        if (!isStrongEnough(password) || password !== confirmation) throw new Error('Passwords must match and contain at least 12 characters.');
        await browser.changePassword(password);
        setMode('reset-complete');
      }
    } catch (nextError) { setError(nextError.message || 'Authentication failed'); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    setBusy(true); setError('');
    try { await browser.signOut(); go('signin'); }
    finally { setBusy(false); }
  };

  if (native) {
    return <NativePersonalAuthPage
      enabled={enabled} mode={mode} go={go} busy={busy} error={error}
      email={email} setEmail={setEmail}
      password={password} setPassword={setPassword}
      confirmation={confirmation} setConfirmation={setConfirmation}
      onSubmit={handleSubmit} startContext={() => void startContext().catch(e => setError(e.message))}
    />;
  }

  const showBusy = busy && <Loader2 size={16} className="animate-spin" aria-hidden="true"/>;
  return <main className={`${native ? 'acg-native-auth ' : ''}min-h-dvh bg-[#f5f6f3] text-[#161817]`}>
    <header className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-6 sm:px-9">
      <a href="/" className="text-xl font-black tracking-[-.065em] text-[#111312] no-underline">
        {native ? <img src="/acg-logo.png" alt="ACG Trader" className="h-auto w-[82px]" /> : <>ACG <span className="font-semibold tracking-[-.04em]">TRADER</span></>}
      </a>
      <a href="/?acg_connect_prop=1" className="text-xs font-semibold text-[#5b605d] hover:text-black">Connect Prop <ArrowRight size={13} className="inline" /></a>
    </header>
    <div className="mx-auto grid min-h-[calc(100dvh-150px)] max-w-[1160px] items-center gap-10 px-5 pb-16 pt-8 sm:px-9 lg:grid-cols-[1fr_440px] lg:gap-24">
      <div className="acg-auth-hero max-w-[520px]">
        <p className="mb-4 text-xs font-bold uppercase tracking-[.18em] text-[#757a74]">ACG TRADER / YOUR WORKSPACE</p>
        <h1 className="text-[clamp(42px,5.4vw,76px)] font-black leading-[.99] tracking-[-.068em]">
          Global markets.<br/><span className="text-[#8d938b]">One platform.</span>
        </h1>
        <p className="mt-7 max-w-[440px] text-[15px] leading-7 text-[#595f59]">
          Explore ACG Trader with a $100,000 virtual demo. Personal practice accounts stay separate from broker and prop-firm accounts.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-[#6b716b]">
          <ShieldCheck size={15}/> Secure identity and account access
        </div>
      </div>
      <ScreenCard>
        {!enabled ? <>
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#7b8179]">PREVIEW</p>
          <h2 className="mt-3 text-[28px] font-black tracking-[-.045em]">Standalone onboarding</h2>
          <p className="mt-4 text-sm leading-6 text-[#656b64]">
            Try Demo is being prepared for live signup. Email and Google registration remain disabled in this audit build; no personal account can be created until registration is enabled.
          </p>
          <div className="mt-7"><a href="/?acg_login=1" className="acg-native-preview-link block rounded-xl bg-[#141516] px-5 py-4 text-center text-sm font-bold text-white">Open existing login</a></div>
        </> : <>
          {['signin','signup','recover','reset'].includes(mode) && <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#858a83]">PERSONAL ACCESS</p>
              <h2 className="mt-2 text-[28px] font-black tracking-[-.045em]">
                {mode === 'signup' ? 'Create your account' : mode === 'recover' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Welcome back'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#697069]">
                {mode === 'signup' ? 'Start with your email or Google account.' :
                  mode === 'recover' ? 'We’ll send you a secure recovery link.' :
                  mode === 'reset' ? 'Set a new password to finish recovery.' : 'Sign in to your ACG Trader identity.'}
              </p>
            </div>
            {mode !== 'reset' && <Input label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" />}
            {!['recover'].includes(mode) && <Input label={mode === 'reset' ? 'New password' : 'Password'} type="password"
              value={password} onChange={setPassword} minLength={mode === 'signup' || mode === 'reset' ? 12 : undefined}
              autoComplete={mode === 'signup' || mode === 'reset' ? 'new-password' : 'current-password'} />}
            {mode === 'reset' && <Input label="Confirm new password" type="password" value={confirmation}
              onChange={setConfirmation} autoComplete="new-password" />}
            {error && <p role="alert" className="rounded-lg bg-[#fff1f0] p-3 text-sm text-[#942b27]">{error}</p>}
            <Button submit disabled={busy}>{showBusy}
              {mode === 'signup' ? 'Create account' : mode === 'recover' ? 'Send recovery link' : mode === 'reset' ? 'Update password' : 'Sign in'}
              {!busy && <ArrowRight size={16}/>}
            </Button>
            {mode !== 'recover' && mode !== 'reset' && <>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-[#868d85]"><span className="h-px flex-1 bg-[#e0e3dc]"/>OR<span className="h-px flex-1 bg-[#e0e3dc]"/></div>
              <Button secondary disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await browser.signInGoogle();}catch(e){setError(e.message);setBusy(false);}}}>
                Continue with Google
              </Button>
            </>}
            <div className="space-y-2 text-center text-xs font-semibold text-[#626961]">
              {mode === 'signin' && <>
                <button type="button" onClick={()=>go('recover')} className="underline underline-offset-4">Forgot password?</button>
                <p>New to ACG Trader? <button type="button" onClick={()=>go('signup')} className="font-bold text-[#161817] underline underline-offset-4">Create an account</button></p>
              </>}
              {mode !== 'signin' && <button type="button" onClick={()=>go('signin')} className="inline-flex items-center gap-1 underline underline-offset-4"><ArrowLeft size={13}/> Back to sign in</button>}
            </div>
          </form>}
          {mode === 'callback' && <div role="status" className="space-y-4 text-center">{showBusy}<h2 className="text-2xl font-bold">Completing secure sign-in…</h2></div>}
          {['verify','recovery-sent','reset-complete'].includes(mode) && <div className="space-y-5">
            <CheckCircle2 size={32} className="text-[#1f7565]" />
            <h2 className="text-[28px] font-black tracking-[-.04em]">
              {mode === 'verify' ? 'Check your email' : mode === 'recovery-sent' ? 'Recovery link sent' : 'Password updated'}
            </h2>
            <p className="text-sm leading-6 text-[#656b64]">{mode === 'verify' ?
              'Follow the verification link, then sign in to create your $100,000 virtual ACG Trader demo after email confirmation.' :
              mode === 'recovery-sent' ? 'If an account exists, you will receive a password recovery link.' :
              'Your password has been updated. Sign in to continue.'}</p>
            <Button onClick={()=>go('signin')}>Back to sign in</Button>
          </div>}
          {mode === 'setup' && <div className="space-y-5">
            <h2 className="text-[28px] font-black tracking-[-.04em]">Account setup in progress</h2>
            <p className="text-sm leading-6 text-[#656b64]">
              Your independent identity is ready. We could not finish setting up your $100,000 virtual demo yet. You can safely retry without creating a duplicate account.
            </p>
            {error && <p role="alert" className="text-sm text-[#942b27]">{error}</p>}
            <Button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await startContext();}catch(e){setError(e.message);}finally{setBusy(false);}}}>{showBusy} Retry demo setup</Button>
            <Button secondary disabled={busy} onClick={()=>void signOut()}>Sign out</Button>
          </div>}
        </>}
      </ScreenCard>
    </div>
    <footer className="mx-auto max-w-[1160px] px-5 pb-8 text-xs leading-5 text-[#878d86] sm:px-9">
      Trading access is permission-based. Market coverage varies; Futures and Options are planned offerings.
    </footer>
  </main>;
}
