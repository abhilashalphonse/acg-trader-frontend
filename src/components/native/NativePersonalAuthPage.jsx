import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function NativePersonalAuthPage({
  enabled, mode, go, busy, error, email, setEmail, password, setPassword,
  confirmation, setConfirmation, onSubmit, startContext,
}) {
  const [visible, setVisible] = useState(false);
  const isSignup = mode === 'signup';
  const isRecovery = mode === 'recover' || mode === 'reset';
  const formMode = ['signin','signup','recover','reset'].includes(mode);
  return <main className="acg-native-screen acg-native-signin">
    <div className="acg-native-frame">
      <header className="acg-native-brand-row">
        <a className="acg-native-back" href="/?acg_mobile_onboarding=1" aria-label="Back to welcome"><ArrowLeft size={20}/></a>
        <img src="/acg-trader-wordmark.svg" alt="ACG Trader" className="acg-native-logo" draggable="false"/>
        <span className="acg-native-meta">PERSONAL ACCESS</span>
      </header>
      <section className="acg-native-form-heading">
        <p className="acg-native-eyebrow">ACG TRADER ACCOUNT</p>
        <h1>{isSignup ? 'Create your account.' : mode === 'recover' ? 'Reset your password.' : mode === 'reset' ? 'Set a new password.' : mode === 'signin' ? 'Sign in.' : mode === 'verify' ? 'Check your inbox.' : mode === 'setup' ? 'Finish setup.' : 'Account update.'}</h1>
        <p className="acg-native-description">{isSignup
          ? 'Your independent demo identity, separate from prop-firm trading accounts.'
          : isRecovery ? 'Securely recover access to your personal account.'
          : 'Access your independent ACG Trader workspace.'}</p>
      </section>
      {!isRecovery && formMode && <div className="acg-native-segmented" role="group" aria-label="Personal account access">
        <button aria-pressed={!isSignup} onClick={() => go('signin')} type="button">Sign in</button>
        <button aria-pressed={isSignup} onClick={() => go('signup')} type="button">Create account</button>
      </div>}
      {!enabled && <div role="status" className="acg-native-disabled">
        <span className="acg-native-eyebrow">REGISTRATION NOT YET ENABLED</span>
        <p>Personal signup and the $100,000 virtual demo require backend activation. This is a design preview; it will not create an account.</p>
      </div>}
      {formMode && <form onSubmit={onSubmit} className="acg-native-form" autoComplete="on">
        {mode !== 'reset' && <label className="acg-native-field">
          <span>Email address</span>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            disabled={!enabled || busy} autoComplete="email" inputMode="email"
            placeholder="you@example.com" required/>
        </label>}
        {mode !== 'recover' && <label className="acg-native-field">
          <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
          <div className="acg-native-password">
            <input type={visible ? 'text' : 'password'} value={password}
              onChange={e=>setPassword(e.target.value)} disabled={!enabled || busy}
              autoComplete={isSignup || mode==='reset' ? 'new-password' : 'current-password'}
              minLength={isSignup || mode==='reset' ? 12 : undefined}
              placeholder={isSignup ? 'At least 12 characters' : 'Enter password'} required/>
            <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={()=>setVisible(v=>!v)}>
              {visible ? <EyeOff size={20}/> : <Eye size={20}/>}
            </button>
          </div>
        </label>}
        {mode === 'reset' && <label className="acg-native-field">
          <span>Confirm new password</span>
          <input type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}
            autoComplete="new-password" disabled={!enabled || busy} required minLength={12}/>
        </label>}
        {error && <p className="acg-native-error" role="alert">{error}</p>}
        <button type="submit" className="acg-native-primary acg-native-submit" disabled={!enabled || busy}>
          <span>{busy ? 'Please wait…' : isSignup ? 'Create account' : mode === 'recover' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Sign in'}</span>
          <ArrowRight size={18}/>
        </button>
        {mode === 'signin' && <button className="acg-native-text-link" type="button" onClick={() => go('recover')}>Forgot password?</button>}
        {isRecovery && <button className="acg-native-text-link" type="button" onClick={() => go('signin')}>Back to sign in</button>}
      </form>}
      {!formMode && <section className="acg-native-confirm">
        <span className="acg-native-eyebrow">{mode === 'verify' ? 'VERIFY EMAIL' : 'ACCOUNT ACCESS'}</span>
        <p>{mode === 'verify' ? 'Follow the verification link sent to your email, then sign in.'
          : mode === 'setup' ? 'Your personal identity is ready, but the virtual demo is not available yet.'
          : mode === 'recovery-sent' ? 'If an account exists, you will receive a password recovery link.'
          : 'Your password has been updated.'}</p>
        {error && <p className="acg-native-error" role="alert">{error}</p>}
        {mode === 'setup' && <button className="acg-native-primary" type="button" onClick={startContext} disabled={busy}>Retry account setup</button>}
        <button className="acg-native-secondary" type="button" onClick={() => go('signin')}>Back to sign in</button>
      </section>}
      <div className="acg-native-login-bottom">
        <a className="acg-native-small-link" href="/?acg_connect_prop=1">Already have a prop trading account? Connect it <ArrowRight size={15}/></a>
      </div>
      <footer className="acg-native-form-footer"><ShieldCheck size={14}/> PERSONAL ACCOUNTS ARE SEPARATE FROM PARTNER ACCOUNTS</footer>
    </div>
  </main>;
}
