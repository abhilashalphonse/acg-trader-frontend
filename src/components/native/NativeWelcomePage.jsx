import React, { useEffect, useRef, useState } from 'react';

// The native welcome is a connection selector, not a second trading terminal.
// Keep brokerage/real-capital language out of this simulated prop + demo flow.
export default function NativeWelcomePage({ restoring, busy, openContext, pendingContext, setPendingContext, confirm, error }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef(null);
  const helpButtonRef = useRef(null);

  useEffect(() => {
    if (!helpOpen) return undefined;
    helpRef.current?.focus();
    const closeOnBack = event => {
      event.detail.handled = true;
      setHelpOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') setHelpOpen(false);
    };
    window.addEventListener('acg-android-back', closeOnBack);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('acg-android-back', closeOnBack);
      window.removeEventListener('keydown', closeOnEscape);
      helpButtonRef.current?.focus();
    };
  }, [helpOpen]);

  return (
    <main className="acg-native-screen acg-native-welcome acg-native-welcome-v2">
      <div className="acg-native-frame acg-welcome-frame">
        <div className="acg-welcome-mark">
          <img src="/acg-trader-wordmark.svg" alt="ACG Trader" draggable="false" />
        </div>

        <section className="acg-welcome-content" aria-label="Choose your workspace">
          <h1>Your workspace.</h1>
          <p className="acg-welcome-subtitle">Choose how you connect.</p>
          <div className="acg-welcome-choices">
            <button type="button" className="acg-welcome-connect"
              onClick={() => openContext('partner')} disabled={restoring || busy}>
              Connect prop firm
            </button>
            <button type="button" className="acg-welcome-demo"
              onClick={() => openContext('personal')} disabled={restoring || busy}>
              Continue with ACG demo
            </button>
          </div>
          <button type="button" className="acg-welcome-create"
            onClick={() => openContext('signup')} disabled={restoring || busy}>
            Create a free demo
          </button>
          {restoring && <p className="acg-welcome-status" role="status">Checking your session…</p>}
          {pendingContext && (
            <section className="acg-native-confirm" aria-label="Confirm workspace change">
              <p className="acg-native-eyebrow">CHANGE WORKSPACE</p>
              <h2>Leave your current account?</h2>
              <p>Open positions stay with that account. The selected workspace requires its own sign-in.</p>
              <div className="acg-native-confirm-actions">
                <button type="button" className="acg-native-secondary" disabled={busy} onClick={() => setPendingContext(null)}>Cancel</button>
                <button type="button" className="acg-native-primary" disabled={busy} onClick={confirm}>Continue</button>
              </div>
            </section>
          )}
          {error && <p role="alert" className="acg-native-error">{error}</p>}
        </section>

        <footer className="acg-welcome-footer">
          <button ref={helpButtonRef} type="button" className="acg-welcome-help" onClick={() => setHelpOpen(true)}>
            Help
          </button>
        </footer>
      </div>

      {helpOpen && (
        <div className="acg-welcome-help-backdrop" onClick={() => setHelpOpen(false)}>
          <section ref={helpRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="acg-welcome-help-title"
            className="acg-welcome-help-sheet" onClick={event => event.stopPropagation()}>
            <div className="acg-welcome-help-heading">
              <h2 id="acg-welcome-help-title">Connecting to ACG Trader</h2>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help">×</button>
            </div>
            <p><strong>Prop firm account</strong> — use the tenant ID, trading account ID and password provided by your firm.</p>
            <p><strong>ACG demo</strong> — sign in to an existing personal virtual-practice account.</p>
            <p><strong>New demo</strong> — registration will become available once personal demo onboarding is enabled.</p>
            <button type="button" className="acg-native-primary" onClick={() => setHelpOpen(false)}>Got it</button>
          </section>
        </div>
      )}
    </main>
  );
}
