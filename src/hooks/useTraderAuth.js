import { useContext } from 'react';
import { AuthContext } from '../auth/AuthProvider.jsx';

export function useTraderAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useTraderAuth must be used inside AuthProvider');
  return context;
}
