import React, { useState } from 'react';
import { Loader2, LockKeyhole } from 'lucide-react';
import { useTraderAuth } from '../hooks/useTraderAuth.js';

export default function SessionGate({ children }) {
  const auth = useTraderAuth();
  const tenant = String(import.meta.env.VITE_ACG_TRADER_TENANT || 'acg-funded').trim();
  const fundedUrl = String(import.meta.env.VITE_ACG_FUNDED_URL || '').trim();
  const [form, setForm] = useState({ login: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (auth.status === 'bootstrapping' || auth.status === 'authenticating') {
    return <div className="grid min-h-dvh place-items-center bg-[#050b12] text-[#7f93a6]"><div className="flex items-center gap-2 text-sm font-semibold"><Loader2 size={16} className="animate-spin"/>Preparing ACG Trader…</div></div>;
  }

  if (auth.authenticated) return children;

  const submit = async event => {
    event.preventDefault();
    if (!tenant || !form.login.trim() || !form.password) return;
    setSubmitting(true);
    setError('');
    try {
      await auth.login({ tenant, login: form.login.trim(), password: form.password });
    } catch (nextError) {
      setError(nextError?.message || 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-[#050b12] px-4 text-[#eef4f8]">
      <form onSubmit={submit} className="w-full max-w-[390px] rounded-[22px] border border-[#1a3142] bg-[#08141e] p-5 shadow-[0_28px_80px_rgba(0,0,0,.38)]">
        <div className="grid size-10 place-items-center rounded-xl border border-[#21445d] bg-[#0b2434] text-[#62caff]"><LockKeyhole size={18}/></div>
        <h1 className="mt-4 text-[22px] font-black tracking-[-0.04em]">ACG Trader</h1>
        <p className="mt-1.5 text-[10px] leading-relaxed text-[#71869a]">Sign in with the trading credentials from your ACG Funded dashboard or credential email.</p>

        <div className="mt-5 space-y-2.5">
          <Field label="Trading account" value={form.login} onChange={value => setForm(current => ({ ...current, login: value }))} autoComplete="username" />
          <Field label="Password" value={form.password} onChange={value => setForm(current => ({ ...current, password: value }))} type="password" autoComplete="current-password" />
        </div>

        {(error || auth.error) && <div className="mt-3 rounded-xl border border-[#5a2a34] bg-[#251217] px-3 py-2.5 text-[9px] font-semibold text-[#ff9aa4]">{error || auth.error?.message}</div>}

        <button type="submit" disabled={submitting || !tenant || !form.login.trim() || !form.password} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#24658a] bg-[#0e4260] text-[10px] font-black text-[#dff5ff] disabled:cursor-not-allowed disabled:opacity-45">
          {submitting && <Loader2 size={14} className="animate-spin"/>}{submitting ? 'Signing in…' : 'Sign in'}
        </button>
        {fundedUrl && (
          <a href={fundedUrl} className="mt-3 flex h-10 w-full items-center justify-center text-[10px] font-semibold text-[#71869a] transition hover:text-[#dff5ff]">
            Open ACG Funded
          </a>
        )}
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', autoComplete }) {
  return <label className="block"><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.09em] text-[#63798e]">{label}</span><input type={type} autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-[#1b3141] bg-[#09151f] px-3 text-[11px] font-semibold text-[#edf4f8] outline-none transition focus:border-[#2c6689]" /></label>;
}
