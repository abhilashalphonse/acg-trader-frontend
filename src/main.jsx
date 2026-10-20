import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import StandaloneAuthPage from './components/StandaloneAuthPage.jsx';
import MobileOnboardingPage from './components/MobileOnboardingPage.jsx';
import SessionGate from './components/SessionGate.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { TradingProvider } from './store/TradingProvider.jsx';
import './index.css';
import './styles/acg-pure-black.css';
import './styles/acg-native-auth.css';
import './styles/acg-native-entry.css';
import { isAndroidNativeRuntime } from './native/androidRuntime.js';
import { ACTIVE_TERMINAL_MARKER, shouldOpenLandingPreview, shouldOpenMobileOnboarding, shouldOpenPublicHome, shouldOpenStandaloneAuth } from './landing/landing-routing.js';

let activeTerminal = false;
try { activeTerminal = window.sessionStorage.getItem(ACTIVE_TERMINAL_MARKER) === '1'; } catch { /* storage unavailable */ }
if (shouldOpenLandingPreview(window.location.search)) {
  window.location.replace('/acg-landing-v6.html');
 } else if (shouldOpenStandaloneAuth(window.location.pathname, window.location.search)) {
  createRoot(document.getElementById('root')).render(
    <AppErrorBoundary>
      <AuthProvider><StandaloneAuthPage /></AuthProvider>
    </AppErrorBoundary>,
  );
} else if (shouldOpenMobileOnboarding(window.location.pathname, window.location.search, isAndroidNativeRuntime(window))) {
  createRoot(document.getElementById('root')).render(
    <AppErrorBoundary>
      <AuthProvider><MobileOnboardingPage /></AuthProvider>
    </AppErrorBoundary>,
  );
} else if (shouldOpenPublicHome(window.location.pathname, window.location.search, activeTerminal)) {
  window.location.replace('/acg-landing-v6.html');
} else {
  createRoot(document.getElementById('root')).render(
    <AppErrorBoundary>
    <AuthProvider>
      <TradingProvider>
        <SessionGate>
          <App />
        </SessionGate>
      </TradingProvider>
    </AuthProvider>
    </AppErrorBoundary>,
  );
}
