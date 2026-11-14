import React, { useContext, useState } from 'react';
import { ArrowRight, Building2, FlaskConical, Loader2 } from 'lucide-react';
import { AuthContext } from '../../auth/AuthProvider.jsx';
import { supabaseOnboardingEnabled } from '../../auth/supabase-browser.js';
import {
  mobileContextDescription,
  mobileContextDestination,
  mobileContextSwitchAllowed,
} from '../../utils/mobileOnboardingNavigation.js';

// Deliberately offered as two separate authentication journeys. We do not
// infer first-party ownership from authMethod, account code or tenant ID.
const CONTEXTS = [
  { key: 'personal', label: 'ACG Trader Demo', icon: FlaskConical },
  { key: 'partner', label: 'Connect Prop / Broker', icon: Building2 },
];

export default function MobileContextActions({ blocked = false, commandPending = false, executionUncertain = false }) {
  const auth = useContext(AuthContext);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const enabled = mobileContextSwitchAllowed({
    authenticated: Boolean(auth?.accessReady && auth?.leaveTradingSession),
    accountSwitching: blocked,
    commandPending,
    executionUncertain,
  });
  const demoEnabled = supabaseOnboardingEnabled();

  const change = async () => {
    if (!target || !enabled || busy) return;
    setBusy(true);
    setError('');
    try {
      // The existing server revokes the opaque trading session and HttpOnly
      // refresh cookie before any new context's login page is opened.
      // Provider credentials remain separate and may be reused explicitly.
      await auth.leaveTradingSession();
      window.location.assign(mobileContextDestination(target));
    } catch {
      setError('Could not securely leave this trading session. Check your connection and retry.');
      setBusy(false);
    }
  };

  if (!auth?.authenticated) return null;
  return (
    <section className="mt-4" data-mobile-context-switch>
      <div className="mb-2 px-1">
        <h3 className="text-[11px] font-bold text-[#e2e4e7]">Switch trading workspace</h3>
        <p className="mt-1 text-[10px] leading-4 text-[#858b94]">
          Personal and partner accounts have separate sign-ins, permissions, balances and positions.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0b]">
        {CONTEXTS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button"
            disabled={!enabled || busy}
            aria-expanded={target === key}
            onClick={() => { setError(''); setTarget(key); }}
            className="flex min-h-[56px] w-full items-center gap-3 border-b border-white/[0.06] px-3 text-left last:border-0 active:bg-white/[0.05] disabled:opacity-45">
            <Icon size={17} className="shrink-0 text-[#b6bac0]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <strong className="block text-[11px] font-semibold text-[#e5e6e8]">{label}</strong>
              <small className="mt-1 block text-[9px] leading-4 text-[#8c939b]">
                {key === 'personal' && !demoEnabled
                  ? 'Registration preview · not yet enabled'
                  : mobileContextDescription(key)}
              </small>
            </span>
            <ArrowRight size={15} className="shrink-0 text-[#979ba2]" aria-hidden="true" />
          </button>
        ))}
      </div>
      {target && (
        <div className="mt-2 rounded-xl border border-white/[0.12] bg-[#111214] p-3" role="group" aria-label="Confirm workspace change">
          <p className="text-[11px] font-semibold text-white">Leave this trading session?</p>
          <p className="mt-1 text-[10px] leading-4 text-[#a7abb2]">
            Your open positions and pending orders stay on their original account.
            Unsaved chart or order drafts will be discarded. You'll authenticate
            separately for {target === 'personal' ? 'ACG Trader Demo' : 'the broker or prop firm'}.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={() => setTarget(null)}
              className="min-h-11 flex-1 rounded-lg border border-white/[0.13] text-[11px] font-semibold text-white disabled:opacity-50">
              Cancel
            </button>
            <button type="button" disabled={!enabled || busy} onClick={() => void change()}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[11px] font-bold text-black disabled:opacity-50">
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {busy ? 'Switching…' : 'Continue'}
            </button>
          </div>
        </div>
      )}
      {(executionUncertain || commandPending) && <p role="status" className="mt-2 px-1 text-[10px] leading-4 text-[#c9ccd0]">
        Finish or reconcile the active order before changing workspaces.
      </p>}
      {error && <p role="alert" className="mt-2 text-[10px] leading-4 text-[#ff9da6]">{error}</p>}
    </section>
  );
}
