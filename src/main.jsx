import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import SessionGate from './components/SessionGate.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { TradingProvider } from './store/TradingProvider.jsx';
import './index.css';
import './styles/acg-pure-black.css';

const isIsolatedTicketPreview = import.meta.env.VITE_ACG_V4_DESIGN_PREVIEW === 'true'
  && window.location.pathname === '/preview/order-ticket';
const OrderTicketV4Preview = React.lazy(() => import('./components/trading-v2/desktop/OrderTicketV4Preview.jsx'));

createRoot(document.getElementById('root')).render(
  isIsolatedTicketPreview
    ? <React.Suspense fallback={<div className="acg-boot" role="status">Loading design studio…</div>}><OrderTicketV4Preview/></React.Suspense>
    : <AppErrorBoundary>
    <AuthProvider>
      <TradingProvider>
        <SessionGate>
          <App />
        </SessionGate>
      </TradingProvider>
    </AuthProvider>
  </AppErrorBoundary>,
);
