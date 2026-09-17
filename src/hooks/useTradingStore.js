import { useContext } from 'react';
import { TradingContext } from '../store/TradingProvider.jsx';

export function useTradingStore() {
  const context = useContext(TradingContext);
  if (!context) throw new Error('useTradingStore must be used inside TradingProvider');
  return context;
}
