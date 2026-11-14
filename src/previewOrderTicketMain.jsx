import React from 'react';
import { createRoot } from 'react-dom/client';
import OrderTicketV4Preview from './components/trading-v2/desktop/OrderTicketV4Preview.jsx';
import './index.css';

// Deliberately independent of App, SessionGate, AuthProvider, TradingProvider,
// live quote feeds and execution commands. Firebase PR channels only.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OrderTicketV4Preview />
  </React.StrictMode>
);
