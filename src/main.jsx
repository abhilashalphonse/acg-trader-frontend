import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import SessionGate from './components/SessionGate.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { TradingProvider } from './store/TradingProvider.jsx';
import './index.css';
import './styles/acg-pure-black.css';

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
