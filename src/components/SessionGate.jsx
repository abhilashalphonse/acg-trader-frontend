import React, { useState } from 'react';
import { ArrowUpRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useTraderAuth } from '../hooks/useTraderAuth.js';
import ACGStartupLoader from './ACGStartupLoader.jsx';
import { shouldPresentNativeEntry } from '../native/nativePresentation.js';
import { isAndroidNativeRuntime } from '../native/androidRuntime.js';
import { isExistingAccountReadOnlyBeta } from '../native/existingAccountBeta.js';
import NativeTradingLogin from './native/NativeTradingLogin.jsx';

function presentAuthError(error) {
  if (!error) return '';

  const code = String(error.code || '').toUpperCase();
  const status = Number(error.status || 0);

  if (status === 401 || ['INVALID_CREDENTIALS', 'AUTH_INVALID', 'LOGIN_FAILED'].includes(code)) {
    return 'Trading Account ID or password is incorrect.';
  }

  if (status === 403 || ['ACCOUNT_ACCESS_FORBIDDEN', 'ACCOUNT_BLOCKED', 'ACCOUNT_LOCKED'].includes(code)) {
    return 'This trading account is not available for sign-in. Check its status in ACG Funded.';
  }

  if (status === 429 || code === 'RATE_LIMITED') {
    return 'Too many sign-in attempts. Wait a moment and try again.';
  }

  if (code === 'REQUEST_TIMEOUT') {
    return 'Sign-in timed out. Check your connection and try again.';
  }

  if (code === 'NETWORK_ERROR') {
    return 'ACG Trader could not reach the server. Check your connection and try again.';
  }

  if (status >= 500) {
    return 'ACG Trader is temporarily unavailable. Try again shortly.';
  }

  return error.message || 'Unable to sign in.';
}

export default function SessionGate({ children }) {
  const auth = useTraderAuth();
  // The new marketing entry is isolated from the legacy ACG Funded gate.
  // The existing backend native auth endpoint resolves tenant by slug.
  const connectProp = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('acg_connect_prop') === '1';
  const configuredTenant = String(import.meta.env.VITE_ACG_TRADER_TENANT || 'acg-funded').trim();
  const fundedUrl = String(import.meta.env.VITE_ACG_FUNDED_URL || 'https://acgfunded.com').trim();
  // Existing-account private beta defaults to our own trading tenant, while
  // allowing partner traders to enter a different tenant explicitly.
  const [form, setForm] = useState({
    tenant: isExistingAccountReadOnlyBeta() ? 'acg-funded' : '',
    login: '',
    password: '',
  });
  const tenant = connectProp ? form.tenant.trim() : configuredTenant;
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Keep the native form mounted while authenticating: changing to a full-screen
  // loader after pressing Sign in would dismiss the keyboard and lose form state.
  if (auth.status === 'bootstrapping' ||
      (auth.status === 'authenticating' && !shouldPresentNativeEntry())) {
    return <ACGStartupLoader />;
  }

  if (auth.authenticated) return children;

  const login = form.login.trim();
  const ready = Boolean(tenant && login && form.password);
  const errorMessage = localError || presentAuthError(auth.error);

  const submit = async event => {
    event.preventDefault();
    if (!ready) return;

    setSubmitting(true);
    setLocalError('');

    try {
      await auth.login({ tenant, login, password: form.password });
    } catch (nextError) {
      setLocalError(presentAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  if (shouldPresentNativeEntry()) {
    return <NativeTradingLogin
      connectProp={connectProp} tenant={tenant} form={form} setForm={setForm}
      submitting={submitting} ready={ready} errorMessage={errorMessage}
      onSubmit={submit} fundedUrl={fundedUrl}
      isReadOnlyBeta={isExistingAccountReadOnlyBeta()}
    />;
  }

  return (
    <main className={`relative min-h-dvh overflow-x-hidden overflow-y-auto bg-black text-white ${isAndroidNativeRuntime() ? 'acg-native-login' : ''}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 50% 46%, rgba(25,91,225,0.07), transparent 30%)',
            'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: 'auto, 42px 42px, 42px 42px',
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(84px,calc(env(safe-area-inset-top)+48px))] sm:px-7 lg:max-w-none lg:items-center lg:justify-center lg:px-6 lg:py-10">
        <form
          onSubmit={submit}
          className="w-full lg:max-w-[460px] lg:rounded-[26px] lg:border lg:border-white/[0.09] lg:bg-[#0b0b0c] lg:p-8 lg:shadow-[0_32px_90px_rgba(0,0,0,.5)]"
        >
          <header>
            <img
              src="/acg-logo.png"
              alt="ACG"
              className="h-auto w-[82px] select-none lg:w-[92px]"
              draggable="false"
            />
            <h1 className="mt-7 text-[30px] font-black leading-none tracking-[-0.045em] text-white lg:mt-6">
              ACG Trader
            </h1>
            <p className="mt-3 max-w-[360px] text-[14px] leading-6 text-[#8b8d93] lg:text-[13px] lg:leading-5">
              {connectProp
                ? 'Connect to a supported broker or prop firm using the tenant identifier and trading credentials they provided.'
                : 'Access your trading workspace with the credentials issued from your ACG Funded account.'}
            </p>
            {isExistingAccountReadOnlyBeta() && (
              <p role="status" className="mt-3 text-[12px] font-semibold text-[#c4c4c4]">
                READ-ONLY BETA · Use your existing trading account ID and password, not your website email login.
              </p>
            )}
          </header>

          <div className="mt-9 space-y-5 lg:mt-8 lg:space-y-4">
            {connectProp && (
              <Field
                label="Tenant ID / identifier"
                value={form.tenant}
                onChange={value => setForm(current => ({ ...current, tenant: value }))}
                autoComplete="organization"
                placeholder="Enter your organization's tenant identifier"
              />
            )}
            <Field
              label={connectProp ? 'Username / Trading Account ID' : 'Trading Account ID'}
              value={form.login}
              onChange={value => setForm(current => ({ ...current, login: value }))}
              autoComplete="username"
              placeholder="Enter trading account ID"
            />
            <PasswordField
              value={form.password}
              onChange={value => setForm(current => ({ ...current, password: value }))}
              visible={showPassword}
              onToggle={() => setShowPassword(current => !current)}
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 rounded-[14px] border border-[#4b252b] bg-[#1b0f12] px-4 py-3 text-[12px] font-semibold leading-5 text-[#ff9da6]"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !ready}
            className={[
              'mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[14px] border text-[14px] font-extrabold transition duration-150 lg:h-[52px] lg:text-[13px]',
              ready && !submitting
                ? 'border-[#316df0] bg-[#195be1] text-white shadow-[0_10px_30px_rgba(25,91,225,.18)] hover:bg-[#1d63f2] active:translate-y-px'
                : 'cursor-not-allowed border-[#24262b] bg-[#111214] text-[#656870]',
            ].join(' ')}
          >
            {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          {!connectProp && fundedUrl && (
            <a
              href={fundedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-[#8c8f96] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#195be1]"
            >
              Find credentials in ACG Funded
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}

          <div className="mt-8 flex items-center justify-center gap-2 border-t border-white/[0.06] pt-5 text-[11px] font-medium text-[#5f6269] lg:mt-7">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Secure trading access</span>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, autoComplete, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.11em] text-[#858890]">
        {label}
      </span>
      <input
        type="text"
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="h-14 w-full rounded-[14px] border border-[#292b30] bg-[#0c0d0f] px-4 text-[16px] font-semibold text-white outline-none transition placeholder:text-[#4f5259] focus:border-[#195be1] focus:ring-2 focus:ring-[#195be1]/20 lg:h-[52px] lg:text-[14px]"
      />
    </label>
  );
}

function PasswordField({ value, onChange, visible, onToggle }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.11em] text-[#858890]">
        Password
      </span>
      <span className="relative block">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          value={value}
          placeholder="Enter password"
          onChange={event => onChange(event.target.value)}
          className="h-14 w-full rounded-[14px] border border-[#292b30] bg-[#0c0d0f] px-4 pr-14 text-[16px] font-semibold text-white outline-none transition placeholder:text-[#4f5259] focus:border-[#195be1] focus:ring-2 focus:ring-[#195be1]/20 lg:h-[52px] lg:text-[14px]"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 grid w-14 place-items-center rounded-r-[14px] text-[#777a82] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#195be1]"
        >
          {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}
