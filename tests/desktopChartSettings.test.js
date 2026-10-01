import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DESKTOP_CHART_SETTINGS,
  chartTimezoneLabel,
  formatChartClock,
  formatChartCrosshairTime,
  formatChartTick,
  normalizeDesktopChartSettings,
} from '../src/utils/desktopChartSettings.js';

test('desktop chart settings default to TradingView-style candle colors and UTC', () => {
  const settings = normalizeDesktopChartSettings(null);
  assert.deepEqual(settings, {
    candle: {
      upBody: '#089981',
      downBody: '#F23645',
      upBorder: '#089981',
      downBorder: '#F23645',
      upWick: '#089981',
      downWick: '#F23645',
    },
    timezone: 'UTC',
  });
  assert.equal(settings.candle.upBody, DEFAULT_DESKTOP_CHART_SETTINGS.candle.upBody);
});

test('invalid stored colors and timezone fall back safely', () => {
  const settings = normalizeDesktopChartSettings({
    candle: {
      upBody: 'red',
      downBody: '#123456',
      upBorder: '#abcdef',
    },
    timezone: 'Mars/Olympus',
  });
  assert.equal(settings.candle.upBody, '#089981');
  assert.equal(settings.candle.downBody, '#123456');
  assert.equal(settings.candle.upBorder, '#ABCDEF');
  assert.equal(settings.timezone, 'UTC');
});

test('fixed offset timezone formatting is deterministic', () => {
  const date = new Date('2026-10-01T12:00:00.000Z');
  assert.equal(formatChartClock(date, 'UTC'), '12:00:00');
  assert.equal(formatChartClock(date, 'UTC+5:30'), '17:30:00');
  assert.equal(formatChartClock(date, 'UTC-4'), '08:00:00');
});

test('exchange timezone resolves per instrument and formats chart ticks', () => {
  const instrument = { timezone: 'Asia/Kolkata' };
  assert.equal(chartTimezoneLabel('exchange', instrument), 'Asia/Kolkata');
  assert.equal(formatChartTick(1790856000, 3, 'exchange', instrument), '17:30');
  assert.match(formatChartCrosshairTime(1790856000, 'exchange', instrument), /01\/10\/2026, 17:30:00/);
});
