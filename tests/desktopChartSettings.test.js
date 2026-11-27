import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DESKTOP_CHART_SETTINGS,
  chartCandleColor,
  desktopChartPalette,
  chartTimezoneLabel,
  formatChartClock,
  formatChartCrosshairTime,
  formatChartTick,
  normalizeDesktopChartSettings,
} from '../src/utils/desktopChartSettings.js';

test('desktop chart settings default to TradingView-style candle colors and UTC', () => {
  const settings = normalizeDesktopChartSettings(null);
  assert.deepEqual(settings, {
    theme: 'dark',
    candle: {
      upBody: '#089981',
      downBody: '#F23645',
      upBorder: '#089981',
      downBorder: '#F23645',
      upWick: '#089981',
      downWick: '#F23645',
      upBodyOpacity: 1,
      downBodyOpacity: 1,
      upBorderOpacity: 1,
      downBorderOpacity: 1,
      upWickOpacity: 1,
      downWickOpacity: 1,
    },
    timezone: 'UTC',
    viewport: { top: 0.12, bottom: 0.16, bars: 42 },
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

test('candle opacity is normalized and renders through the shared palette', () => {
  const settings = normalizeDesktopChartSettings({
    candle: {
      upBody: '#12AB34', upBodyOpacity: 0.4,
      downWick: '#102030', downWickOpacity: 0,
      upBorderOpacity: 4,
      downBodyOpacity: -2,
      downBorderOpacity: 'invalid',
    },
  });
  assert.equal(settings.candle.upBodyOpacity, 0.4);
  assert.equal(settings.candle.downWickOpacity, 0);
  assert.equal(settings.candle.upBorderOpacity, 1);
  assert.equal(settings.candle.downBodyOpacity, 0);
  assert.equal(settings.candle.downBorderOpacity, 1);
  assert.equal(chartCandleColor(settings.candle, 'upBody', '#000000'), 'rgba(18,171,52,0.4)');
  assert.equal(chartCandleColor(settings.candle, 'downWick', '#000000'), 'rgba(16,32,48,0)');
  assert.equal(chartCandleColor(settings.candle, 'upBorder', '#000000'), '#089981');
  assert.equal(chartCandleColor(null, 'upBody', '#123456'), '#123456');
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

test('light and dark chart themes normalize without losing saved candles and viewport', () => {
  const light = normalizeDesktopChartSettings({
    theme: 'light',
    candle: { upBody: '#123456' },
    timezone: 'UTC+1',
    viewport: { top: 0.15, bottom: 0.13, bars: 48 },
  });
  assert.equal(light.theme, 'light');
  assert.equal(light.candle.upBody, '#123456');
  assert.equal(light.timezone, 'UTC+1');
  assert.equal(light.viewport.bars, 48);
  assert.equal(normalizeDesktopChartSettings({ theme: 'rainbow' }).theme, 'dark');
  assert.equal(desktopChartPalette('dark').background, '#09090B');
  assert.equal(desktopChartPalette('light').background, '#FAFBFC');
  assert.equal(desktopChartPalette('light').gridline, '#E8EDF3');
  assert.notEqual(desktopChartPalette('light').text, desktopChartPalette('light').background);
});

test('premium light chart retains black price/time ticks, softened guides and charcoal BID/ASK', () => {
  const light = desktopChartPalette('light');
  const dark = desktopChartPalette('dark');
  assert.equal(light.text, '#000000');
  assert.equal(light.instrumentTitle, '#000000');
  assert.equal(light.instrumentMuted, '#000000');
  assert.equal(light.instrumentValue, '#000000');
  assert.equal(light.readout, '#000000');
  assert.equal(light.instrumentMeta, '#6B7280');
  assert.equal(light.instrumentSource, '#929BA7');
  assert.equal(light.ohlcLabel, '#8A929C');
  assert.equal(light.candleChangeUp, '#157A5A');
  assert.equal(light.candleChangeDown, '#BF3E4B');
  assert.equal(light.candleChangeFlat, '#6B7280');
  assert.equal(light.liveBidLine, 'rgba(0,0,0,0.18)');
  assert.equal(light.liveAskLine, 'rgba(0,0,0,0.18)');
  assert.equal(light.quoteLabelText, '#3B424B');
  assert.notEqual(light.quoteLabelText, light.text);
  assert.equal(light.liveBidLabel, '#E6E9ED');
  assert.equal(light.liveAskLabel, '#E6E9ED');
  assert.equal(dark.text, '#8B8B8F');
  assert.equal(dark.liveBidLine, '#B0B7BF');
  assert.equal(dark.liveAskLine, '#939BA4');
  assert.equal(dark.quoteLabelText, '#FFFFFF');
});
