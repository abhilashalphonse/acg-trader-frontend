import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { isAndroidNativeRuntime } from '../../native/androidRuntime.js';

export default function NativeTradingLogin({ connectProp, tenant, form, setForm, submitting, ready, errorMessage, onSubmit, fundedUrl, isReadOnlyBeta }) {
  const [visible, setVisible] = useState(false);
  return <main className="acg-native-screen acg-native-signin">
    <div className="acg-native-frame">
      <header className="acg-native-brand-row">
        <a className="acg-native-back" href="/?acg_mobile_onboarding=1" aria-label="Back to welcome"><ArrowLeft size={20}/></a>
        <img src="/acg-logo.png" alt="ACG Trader" className="acg-native-logo" draggable="false"/>
        <span className="acg-native-meta">CONNECT PROP</span>
      </header>
      <section className="acg-native-form-heading">
        <p className="acg-native-eyebrow">EXISTING TRADING ACCOUNT</p>
        <h1>Welcome back.</h1>
        <p className="acg-native-description">Sign in with the credentials supplied for your trading account.</p>
      </section>
      <form className="acg-native-form" onSubmit={onSubmit} autoComplete="on">
        <label className="acg-native-field">
          <span>Tenant ID</span>
          <input value={connectProp ? form.tenant : tenant}
            onChange={e => setForm(f => ({ ...f, tenant: e.target.value }))}
            readOnly={!connectProp} disabled={submitting}
            autoComplete="organization" autoCapitalize="none" autoCorrect="off" spellCheck="false"
            placeholder="Your organization identifier" required maxLength={64}/>
          {!connectProp && <small>ACG Funded trading accounts</small>}
        </label>
        <label className="acg-native-field">
          <span>Trading account ID</span>
          <input value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false"
            placeholder="Enter trading account ID" disabled={submitting} required maxLength={64}/>
        </label>
        <label className="acg-native-field">
          <span>Password</span>
          <div className="acg-native-password">
            <input type={visible ? 'text' : 'password'} value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password" placeholder="Enter trading password"
              disabled={submitting} required maxLength={256}/>
            <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
              {visible ? <EyeOff size={20}/> : <Eye size={20}/>}
            </button>
          </div>
        </label>
        {errorMessage && <p className="acg-native-error" role="alert">{errorMessage}</p>}
        <button className="acg-native-primary acg-native-submit" type="submit" disabled={!ready || submitting}>
          <span>{submitting ? 'Signing in…' : 'Sign in to terminal'}</span>
          {!submitting && <ArrowRight size={18}/>}
        </button>
        <p className="acg-native-form-hint"><LockKeyhole size={15}/> Use your trading account password, not your ACG Funded website password.</p>
      </form>
      <div className="acg-native-login-bottom">
        {fundedUrl && <button type="button" className="acg-native-small-link"
          onClick={() => {
            try {
              const url = new URL(fundedUrl);
              if (url.protocol !== 'https:') return;
              if (isAndroidNativeRuntime()) void Browser.open({ url: url.href }).catch(() => {});
              else window.open(url.href, '_blank', 'noopener,noreferrer');
            } catch { /* invalid configured URL: remain inside the trusted app */ }
          }}>
          Find credentials in ACG Funded <ArrowUpRight size={15}/>
        </button>}
        <a className="acg-native-small-link" href="/?acg_auth=signup&acg_onboarding_audit=1">
          New to ACG Trader? Create an account <ArrowRight size={15}/>
        </a>
      </div>
      <footer className="acg-native-form-footer"><ShieldCheck size={14}/> {isReadOnlyBeta
        ? 'PRIVATE BETA · ACCOUNT VIEWING ONLY'
        : 'SECURE TRADING SESSION'}</footer>
    </div>
  </main>;
}
