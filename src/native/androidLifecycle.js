import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isAndroidNativeRuntime } from './androidRuntime.js';

// Only our registered Android callback may inject a one-time Supabase PKCE code.
// Never redirect to the host or path supplied by an untrusted deep link.
export function parseNativeAuthCallback(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    if (url.protocol !== 'acgtrader:' || url.hostname !== 'auth' || url.pathname !== '/callback') return null;
    const allowed = new URLSearchParams();
    for (const field of ['code','token_hash','type','error','error_description']) {
      const value = url.searchParams.get(field);
      if (value && value.length <= 4096) allowed.set(field,value);
    }
    if (!allowed.has('code') && !allowed.has('token_hash') && !allowed.has('error')) return null;
    return '/auth/callback?' + allowed.toString();
  } catch { return null; }
}

export async function startAndroidLifecycle({ runtime = globalThis, app = CapacitorApp, browser = Browser } = {}) {
  if (!isAndroidNativeRuntime(runtime)) return () => {};
  const handleUrl = event => {
    const target = parseNativeAuthCallback(event?.url);
    if (!target) return;
    void browser.close().catch(() => {});
    // This top-level route is owned by our existing provider's PKCE verifier
    // and does not expose the callback code to the backend or a web URL.
    runtime.location.replace(target);
  };
  const onBack = async ({ canGoBack } = {}) => {
    const back = new CustomEvent('acg-android-back', { detail: { handled: false } });
    runtime.dispatchEvent(back);
    if (back.detail.handled) return;
    const location = runtime.location;
    const parameters = new URLSearchParams(location.search);
    if (parameters.has('acg_connect_prop') || parameters.has('acg_login') || parameters.has('acg_auth')) {
      location.assign('/?acg_mobile_onboarding=1');
      return;
    }
    if (location.pathname !== '/' && location.pathname !== '/terminal' && canGoBack) {
      runtime.history.back();
      return;
    }
    await app.minimizeApp();
  };
  const onResume = ({ isActive } = {}) => {
    if (!isActive) return;
    runtime.dispatchEvent(new Event('focus'));
    runtime.dispatchEvent(new Event('online'));
  };
  const subscriptions = await Promise.all([
    app.addListener('appUrlOpen', handleUrl),
    app.addListener('backButton', onBack),
    app.addListener('appStateChange', onResume),
  ]);
  const launch = await app.getLaunchUrl();
  if (launch?.url) handleUrl(launch);
  return () => { for (const sub of subscriptions) void sub.remove(); };
}
