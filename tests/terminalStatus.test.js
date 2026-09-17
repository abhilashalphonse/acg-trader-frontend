import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTerminalStatus } from '../src/utils/terminalStatus.js';

const liveAccount = { id: 'a1', status: 'ACTIVE', tradingEnabled: true, valuationStatus: 'LIVE', staleSymbols: [] };
const liveMarket = { symbol: 'EURUSD', displaySymbol: 'EUR/USD', bid: '1.10000', ask: '1.10010', sessionOpen: true, isStale: false, marketState: 'LIVE' };

function base(overrides = {}) {
  return {
    authStatus: 'authenticated',
    authenticated: true,
    connectionStatus: 'ready',
    account: liveAccount,
    valuationStatus: 'LIVE',
    marketStatus: 'LIVE',
    activeMarket: liveMarket,
    ...overrides,
  };
}

test('returns null when the terminal is fully live', () => {
  assert.equal(deriveTerminalStatus(base()), null);
});

test('blocks new exposure when realtime is reconnecting', () => {
  const result = deriveTerminalStatus(base({ connectionStatus: 'reconnecting' }));
  assert.equal(result.code, 'REALTIME_RECONNECTING');
  assert.equal(result.blocksNewExposure, true);
});

test('surfaces paused and breached account controls', () => {
  assert.equal(deriveTerminalStatus(base({ account: { ...liveAccount, status: 'PAUSED' } })).code, 'ACCOUNT_PAUSED');
  assert.equal(deriveTerminalStatus(base({ account: { ...liveAccount, status: 'BREACHED' } })).code, 'ACCOUNT_BREACHED');
});

test('surfaces stale quotes and stale account valuation', () => {
  assert.equal(deriveTerminalStatus(base({ activeMarket: { ...liveMarket, isStale: true, marketState: 'STALE' } })).code, 'QUOTE_STALE');
  assert.equal(deriveTerminalStatus(base({ account: { ...liveAccount, valuationStatus: 'STALE', staleSymbols: ['EURUSD'] }, valuationStatus: 'STALE' })).code, 'VALUATION_STALE');
});

test('surfaces market session closure before allowing new exposure', () => {
  const result = deriveTerminalStatus(base({ activeMarket: { ...liveMarket, sessionOpen: false } }));
  assert.equal(result.code, 'SESSION_CLOSED');
  assert.equal(result.blocksNewExposure, true);
});
