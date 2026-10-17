import React, { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { useTraderAuth } from '../../hooks/useTraderAuth.js';
import { signOutDestination } from '../../utils/signOutDestination.js';

// Place sign-out in account management rather than consuming trading/chart
// space. Require a second click to avoid accidental loss of the session.
export default function SignOutAction({ variant = 'desktop' }) {
  const auth = useTraderAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const desktop = variant === 'desktop';

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const next = signOutDestination(auth.principal?.authMethod, window.location.search);
    try {
      await auth.logout();
      window.location.assign(next);
    } catch {
      setError('Could not securely sign out. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <div data-v4-signout={variant} className={desktop
      ? 'border-t border-white/[0.07] px-2 py-2'
      : 'mt-3 rounded-xl border border-white/[0.07] bg-[#090b0e] p-2'}>
      {!confirming ? (
        <button type="button" onClick={() => { setError(''); setConfirming(true); }}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[11px] font-semibold text-[#aeb8c3] hover:bg-white/[0.045] hover:text-white active:bg-white/[0.07]">
          <LogOut size={15} aria-hidden="true" /> Sign out
        </button>
      ) : (
        <div className="space-y-2 px-1 py-1">
          <p className="text-[11px] font-semibold text-[#e6edf3]">Sign out of this trading session?</p>
          <p className="text-[10px] leading-4 text-[#8d98a5]">Your account and trades will remain on the server.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => { setConfirming(false); setError(''); }}
              className="min-h-10 flex-1 rounded-lg border border-white/[0.12] px-3 text-[11px] font-semibold text-[#b7c0c9] disabled:opacity-50">
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={() => void signOut()}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[11px] font-bold text-black disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <LogOut size={13} aria-hidden="true" />}
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="px-2 py-2 text-[11px] text-[#f59da5]">{error}</p>}
    </div>
  );
}
