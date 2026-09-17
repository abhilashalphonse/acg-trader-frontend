import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { TradingProvider } from './store/TradingProvider.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <TradingProvider>
        <App />
      </TradingProvider>
    </AuthProvider>
  </React.StrictMode>,
);
