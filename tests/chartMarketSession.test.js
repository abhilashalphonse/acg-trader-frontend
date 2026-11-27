import test from 'node:test';
import assert from 'node:assert/strict';
import { chartMarketSession, chartSessionClock, chartSessionDuration } from '../src/utils/chartMarketSession.js';

const fxSessions = [
  { days: [0], open: '22:00', close: '23:59' },
  { days: [1, 2, 3, 4], open: '00:00', close: '23:59' },
  { days: [5], open: '00:00', close: '22:00' },
];
const fx = { symbol: 'XAUUSD', name: 'Gold Spot / US Dollar', assetClass: 'METAL',
  timezone: 'UTC', tradingSessions: fxSessions };

test('gold shows the scheduled Friday close and next Sunday opening', () => {
  const friday = Date.parse('2026-11-27T23:00:00Z');
  const session = chartMarketSession(fx, friday);
  assert.equal(session.status, 'closed');
  assert.equal(session.timeZone, 'UTC');
  assert.equal(new Date(session.nextAt).toISOString(), '2026-11-29T22:00:00.000Z');
  assert.equal(chartSessionDuration(session.nextAt - friday), '1d 23h');

  const beforeClose = chartMarketSession(fx, Date.parse('2026-11-27T21:00:00Z'));
  assert.equal(beforeClose.status, 'open');
  assert.equal(new Date(beforeClose.nextAt).toISOString(), '2026-11-27T22:00:00.000Z');
  assert.equal(beforeClose.todayWindows.length, 1);
  assert.equal(chartSessionClock(beforeClose.nextAt, 'UTC'), '22:00');
});

test('BTC is scheduled 24/7, without fabricating a session cutoff', () => {
  const session = chartMarketSession({ symbol: 'BTCUSD', assetClass: 'CRYPTO', timezone: 'UTC', tradingSessions: [] },
    Date.parse('2026-11-28T03:00:00Z'));
  assert.equal(session.status, 'open');
  assert.equal(session.isContinuous, true);
  assert.equal(session.nextAt, null);
  assert.deepEqual(session.daySegments, [{ from: 0, width: 100 }]);
});

test('non-crypto instruments without schedule are marked unknown, never open by guess', () => {
  const session = chartMarketSession({ symbol: 'US500', assetClass: 'INDEX', tradingSessions: [] });
  assert.equal(session.status, 'unknown');
  assert.equal(session.hasPublishedHours, false);
});

test('New York equity hours handle DST and preserve timezone labels', () => {
  const stock = { symbol: 'AAPL', assetClass: 'EQUITY', timezone: 'America/New_York',
    tradingSessions: [{ days: [1, 2, 3, 4, 5], open: '09:30', close: '16:00' }] };
  const winter = chartMarketSession(stock, Date.parse('2026-11-30T15:00:00Z'));
  const summer = chartMarketSession(stock, Date.parse('2026-07-13T14:00:00Z'));
  assert.equal(winter.status, 'open');
  assert.equal(summer.status, 'open');
  assert.equal(new Date(winter.active.openAt).toISOString(), '2026-11-30T14:30:00.000Z');
  assert.equal(new Date(summer.active.openAt).toISOString(), '2026-07-13T13:30:00.000Z');
  assert.equal(chartSessionClock(winter.active.openAt, stock.timezone), '09:30');
});

test('holiday closures and explicit venue-state overrides are respected', () => {
  const holiday = chartMarketSession({ ...fx, tradingHolidays: ['2026-11-27'] },
    Date.parse('2026-11-27T16:00:00Z'));
  assert.equal(holiday.status, 'closed');
  const authoritativeClosed = chartMarketSession({ ...fx, sessionOpen: false },
    Date.parse('2026-11-27T16:00:00Z'));
  assert.equal(authoritativeClosed.status, 'closed');
  const unavailable = chartMarketSession({ ...fx, marketState: 'DISCONNECTED' },
    Date.parse('2026-11-27T16:00:00Z'));
  assert.equal(unavailable.status, 'unavailable');
});

test('cross-midnight windows remain open after midnight, then close at session end', () => {
  const instrument = { symbol: 'TEST', assetClass: 'METAL', timezone: 'UTC',
    tradingSessions: [{ days: [5], open: '22:00', close: '02:00' }] };
  const open = chartMarketSession(instrument, Date.parse('2026-11-28T01:00:00Z'));
  const closed = chartMarketSession(instrument, Date.parse('2026-11-28T02:00:00Z'));
  assert.equal(open.status, 'open');
  assert.equal(new Date(open.nextAt).toISOString(), '2026-11-28T02:00:00.000Z');
  assert.equal(closed.status, 'closed');
});
