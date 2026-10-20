import React, { useContext, useEffect, useState } from 'react';
import { ArrowRight, Building2, ChartNoAxesCombined, FlaskConical, Loader2, ShieldCheck } from 'lucide-react';
import { AuthContext } from '../auth/AuthProvider.jsx';
import { supabaseOnboardingEnabled } from '../auth/supabase-browser.js';
import { mobileContextDestination } from '../utils/mobileOnboardingNavigation.js';
import { shouldPresentNativeEntry } from '../native/nativePresentation.js';
import { isAndroidNativeRuntime } from '../native/androidRuntime.js';
import NativeWelcomePage from './native/NativeWelcomePage.jsx';

// Opt-in native-app-ready welcome route; never alters a desktop terminal,
// ticket redemption, or the ACG Funded credential flow.
export default function MobileOnboardingPage() {
  const auth = useContext(AuthContext);
  const [pendingContext, setPendingContext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const restoring = auth?.status === 'bootstrapping' || auth?.status === 'authenticating';
  const authenticated = Boolean(auth?.authenticated);
  const native = shouldPresentNativeEntry();
  useEffect(() => {
    // The first launch shows onboarding; a valid restored trader session goes
    // straight into V4 on subsequent launches, without replacing auth grants.
    if (isAndroidNativeRuntime() && auth?.accessReady && !busy && !pendingContext) window.location.replace('/terminal');
  }, [native, auth?.accessReady, busy, pendingContext]);

  const openContext = context => {
    if (restoring || busy) return;
    setError('');
    if (authenticated) {
      setPendingContext(context);
      return;
    }
    window.location.assign(mobileContextDestination(context));
  };
  const confirm = async () => {
    if (!pendingContext || busy || restoring) return;
    setBusy(true);
    setError('');
    try {
      if (authenticated) await auth.leaveTradingSession();
      window.location.assign(mobileContextDestination(pendingContext));
    } catch {
      setError('Could not securely leave your current trading session. Please retry.');
      setBusy(false);
    }
  };
  if (native) return <NativeWelcomePage
    restoring={restoring}
    busy={busy}
    sessionReady={Boolean(auth?.accessReady)}
    openContext={openContext}
    pendingContext={pendingContext}
    setPendingContext={setPendingContext}
    confirm={() => void confirm()}
    error={error}
  />;

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#050505] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(30px,env(safe-area-inset-top))] text-[#f4f4f4]">
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col">
        <header className="flex items-center justify-between gap-3">
          <img src="/acg-logo.png" alt="ACG Trader" className="h-auto w-[82px]" />
          {!native && <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#969696]">Mobile</span>}
        </header>
        <div className="mt-[clamp(32px,9dvh,100px)]">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-white/[0.12] bg-[#151515]"><ChartNoAxesCombined size={23}/></div>
          <h1 className="text-[clamp(32px,8vw,44px)] font-bold leading-[1.08] tracking-[-.055em]">Your markets.<br/>Your workspace.</h1>
          <p className="mt-4 max-w-[350px] text-[13px] leading-6 text-[#a8a8a8]">
            Connect a prop firm account or explore simulated markets using ACG Trader's independent virtual demo.
          </p>
        </div>

        {auth?.accessReady && (
          <a href="/terminal" className="mt-7 flex min-h-12 items-center justify-between rounded-xl border border-white/[0.18] bg-[#1b1b1b] px-4 text-[12px] font-bold text-white">
            Continue current trading session <ArrowRight size={17} />
          </a>
        )}
        <div className="mt-7 space-y-3">
          <button type="button" disabled={restoring || busy} onClick={() => openContext('partner')}
            className="flex min-h-[82px] w-full items-center gap-3 rounded-2xl border border-white/[0.13] bg-[#161616] px-4 text-left active:bg-[#222] disabled:opacity-50">
            <Building2 size={22} className="shrink-0 text-[#d7d7d7]" aria-hidden="true"/>
            <span className="min-w-0 flex-1"><strong className="block text-[14px] font-bold">Start Trading</strong>
              <small className="mt-1 block text-[11px] leading-4 text-[#aaa]">Connect Prop · Tenant ID, username and password</small></span>
            <ArrowRight size={17} className="shrink-0 text-[#b7b7b7]" aria-hidden="true"/>
          </button>
          <button type="button" disabled={restoring || busy} onClick={() => openContext('personal')}
            className="flex min-h-[82px] w-full items-center gap-3 rounded-2xl border border-white/[0.13] bg-[#101010] px-4 text-left active:bg-[#222] disabled:opacity-50">
            <FlaskConical size={22} className="shrink-0 text-[#d7d7d7]" aria-hidden="true"/>
            <span className="min-w-0 flex-1"><strong className="block text-[14px] font-bold">Try Demo</strong>
              <small className="mt-1 block text-[11px] leading-4 text-[#aaa]">
                $100,000 virtual practice · {supabaseOnboardingEnabled() ? 'Create or sign in to ACG Trader' : 'Registration preview only'}
              </small></span>
            <ArrowRight size={17} className="shrink-0 text-[#b7b7b7]" aria-hidden="true"/>
          </button>
        </div>
        {restoring && <p role="status" className="mt-3 text-[11px] text-[#aaa]">Checking for an existing trading session…</p>}
        {pendingContext && (
          <section aria-label="Confirm context change" className="mt-4 rounded-xl border border-white/[0.16] bg-[#191919] p-4">
            <p className="text-[12px] font-semibold">Leave your current account?</p>
            <p className="mt-2 text-[11px] leading-5 text-[#a7a7a7]">Open positions remain with that account. You must authenticate separately for the chosen workspace.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} className="min-h-11 flex-1 rounded-lg border border-white/[0.16] text-[12px]" onClick={() => setPendingContext(null)}>Cancel</button>
              <button type="button" disabled={busy} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white text-[12px] font-bold text-black disabled:opacity-50" onClick={() => void confirm()}>
                {busy && <Loader2 size={14} className="animate-spin"/>} Continue
              </button>
            </div>
          </section>
        )}
        {error && <p role="alert" className="mt-3 text-[11px] text-[#ff9da6]">{error}</p>}
        <footer className="mt-auto pt-10">
          <a href="/acg-landing-v6.html#business" className="inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold text-[#c5c5c5]">For trading businesses <ArrowRight size={15}/></a>
          <p className="mt-4 flex items-center gap-2 text-[10px] leading-4 text-[#858585]"><ShieldCheck size={14}/> Personal and partner identities are kept separate. Demo funds are virtual.</p>
        </footer>
      </div>
    </main>
  );
}
