import React from 'react';
import {useTraderAuth} from '../hooks/useTraderAuth.js';
import ACGStartupLoader from './ACGStartupLoader.jsx';
import GuestMarketWorkspace from './public/GuestMarketWorkspace.jsx';
import {shouldUseGuestMarketWorkspace} from '../public/guestMarkets.js';

// Dedicated public entry; keep account/federation/explicit-login routes in their
// original authenticated terminal. Never initialize TradingProvider for guests.
export default function PublicTerminalGate({children}) {
  const auth=useTraderAuth();
  const path=typeof window==='undefined'?'':window.location.pathname;
  const query=typeof window==='undefined'?'':window.location.search;
  if(!shouldUseGuestMarketWorkspace(path,query))return children;
  if(auth.status==='bootstrapping'||auth.status==='authenticating')return <ACGStartupLoader/>;
  if(auth.authenticated)return children;
  return <GuestMarketWorkspace/>;
}
