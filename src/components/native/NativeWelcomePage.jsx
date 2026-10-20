import React from 'react';
import { ArrowRight, Building2, ChartNoAxesCombined, LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabaseOnboardingEnabled } from '../../auth/supabase-browser.js';

export default function NativeWelcomePage({ restoring, busy, sessionReady, openContext, pendingContext, setPendingContext, confirm, error }) {
  return <main className="acg-native-screen acg-native-welcome">
    <div className="acg-native-frame">
      <header className="acg-native-brand-row">
        <img src="/acg-logo.png" alt="ACG Trader" className="acg-native-logo" draggable="false" />
        <span className="acg-native-meta">TRADING PLATFORM</span>
      </header>
      <section className="acg-native-welcome-hero">
        <div className="acg-native-line" aria-hidden="true"/>
        <p className="acg-native-eyebrow">ACG TRADER</p>
        <h1>Markets.<span> In focus.</span></h1>
        <p className="acg-native-description">Your chart-first trading workspace, built for the markets you follow.</p>
      </section>
      <section className="acg-native-welcome-actions" aria-label="Choose how to access ACG Trader">
        {sessionReady && <a className="acg-native-primary acg-native-resume" href="/terminal">
          <span>Continue your session</span><ArrowRight size={18} aria-hidden="true"/>
        </a>}
        <button type="button" disabled={restoring || busy} onClick={() => openContext('partner')}
          className="acg-native-access acg-native-access-primary">
          <span className="acg-native-access-icon"><Building2 size={20} strokeWidth={1.7}/></span>
          <span className="acg-native-access-copy"><strong>Start trading</strong><small>Connect your broker or prop trading account</small></span>
          <ArrowRight className="acg-native-access-arrow" size={20} strokeWidth={1.6}/>
        </button>
        <button type="button" disabled={restoring || busy} onClick={() => openContext('personal')}
          className="acg-native-access">
          <span className="acg-native-access-icon"><ChartNoAxesCombined size={20} strokeWidth={1.7}/></span>
          <span className="acg-native-access-copy"><strong>Try the demo</strong><small>{supabaseOnboardingEnabled()
            ? 'Create your personal ACG Trader account'
            : 'Explore the personal account signup preview'}</small></span>
          <ArrowRight className="acg-native-access-arrow" size={20} strokeWidth={1.6}/>
        </button>
      </section>
      {restoring && <p className="acg-native-inline-status" role="status">Restoring your trading session…</p>}
      {pendingContext && <section className="acg-native-confirm" role="group" aria-label="Confirm workspace switch">
        <p className="acg-native-eyebrow">CONFIRM ACCOUNT CHANGE</p>
        <h2>Leave your current workspace?</h2>
        <p>Existing positions stay on your account. You will sign in separately to the selected workspace.</p>
        <div className="acg-native-confirm-actions">
          <button type="button" className="acg-native-secondary" disabled={busy} onClick={() => setPendingContext(null)}>Cancel</button>
          <button type="button" className="acg-native-primary" disabled={busy} onClick={confirm}>Continue <ArrowRight size={16}/></button>
        </div>
      </section>}
      {error && <p role="alert" className="acg-native-error">{error}</p>}
      <footer className="acg-native-welcome-footer">
        <span><ShieldCheck size={15}/> Separate personal and partner accounts</span>
        <span className="acg-native-footer-note"><LockKeyhole size={14}/> Secure account access</span>
      </footer>
    </div>
  </main>;
}
