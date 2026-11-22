import { DEFAULT_CHART_VIEWPORT, normalizeChartViewport } from './chartViewport.js';

export const DESKTOP_CHART_SETTINGS_KEY = 'acg-trader-desktop-chart-settings-v1';

export const DEFAULT_DESKTOP_CHART_SETTINGS = Object.freeze({
  theme: 'dark',
  candle: Object.freeze({
    upBody: '#089981',
    downBody: '#F23645',
    upBorder: '#089981',
    downBorder: '#F23645',
    upWick: '#089981',
    downWick: '#F23645',
  }),
  timezone: 'UTC',
  viewport: DEFAULT_CHART_VIEWPORT,
});


// Theme controls chart pixels and chart-local labels, not the surrounding
// terminal UI or financial state. Keep dark defaults backward compatible.
export const DESKTOP_CHART_PALETTES = Object.freeze({
  dark: Object.freeze({
    background: '#09090B',
    text: '#8B8B8F',
    gridline: '#1A1A1D',
    crosshair: '#6F7075',
    crosshairLabel: '#1B1B1D',
    border: '#242424',
    paneSeparator: '#1B1B1B',
    instrumentTitle: '#F0F3F6',
    instrumentMuted: '#7F8A95',
    instrumentValue: '#AAB9C8',
    readout: '#8E99A5',
    readoutShadow: '0 1px 2px #000, 0 0 6px #000',
    liveBidLine: '#B0B7BF',
    liveBidLabel: '#3B4148',
    liveAskLine: '#939BA4',
    liveAskLabel: '#4A5058',
    quoteLabelText: '#FFFFFF',
  }),
  light: Object.freeze({
    background: '#FAFBFC',
    // Price-axis numbers and time-axis ticks use near-black for crisp contrast.
    text: '#0B0D0F',
    gridline: '#E8EDF3',
    crosshair: '#A5B2C0',
    crosshairLabel: '#334155',
    border: '#DAE2EA',
    paneSeparator: '#DCE4EC',
    instrumentTitle: '#0B0D0F',
    instrumentMuted: '#0B0D0F',
    instrumentValue: '#0B0D0F',
    readout: '#0B0D0F',
    readoutShadow: 'none',
    // Price guides stay black; BID/ASK labels are charcoal on pale grey.
    liveBidLine: '#0B0D0F',
    liveBidLabel: '#E6E9ED',
    liveAskLine: '#0B0D0F',
    liveAskLabel: '#E6E9ED',
    quoteLabelText: '#3B424B',
  }),
});

export function desktopChartPalette(theme) {
  return DESKTOP_CHART_PALETTES[theme === 'light' ? 'light' : 'dark'];
}

export const CHART_TIMEZONE_OPTIONS = Object.freeze([
  { value: 'UTC', label: 'UTC' },
  { value: 'exchange', label: 'Exchange time' },
  { value: 'local', label: 'Browser local time' },
  { value: 'UTC-5', label: 'UTC-5' },
  { value: 'UTC-4', label: 'UTC-4' },
  { value: 'UTC+1', label: 'UTC+1' },
  { value: 'UTC+4', label: 'UTC+4' },
  { value: 'UTC+5:30', label: 'UTC+5:30' },
  { value: 'UTC+8', label: 'UTC+8' },
]);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function color(value, fallback) {
  return HEX_COLOR.test(String(value || '').trim()) ? String(value).toUpperCase() : fallback;
}

export function normalizeDesktopChartSettings(value) {
  const candle = value?.candle || {};
  const defaults = DEFAULT_DESKTOP_CHART_SETTINGS.candle;
  const timezone = CHART_TIMEZONE_OPTIONS.some(option => option.value === value?.timezone)
    ? value.timezone
    : DEFAULT_DESKTOP_CHART_SETTINGS.timezone;

  return {
    theme: value?.theme === 'light' ? 'light' : 'dark',
    candle: {
      upBody: color(candle.upBody, defaults.upBody),
      downBody: color(candle.downBody, defaults.downBody),
      upBorder: color(candle.upBorder, defaults.upBorder),
      downBorder: color(candle.downBorder, defaults.downBorder),
      upWick: color(candle.upWick, defaults.upWick),
      downWick: color(candle.downWick, defaults.downWick),
    },
    timezone,
    viewport: normalizeChartViewport(value?.viewport),
  };
}

export function loadDesktopChartSettings() {
  if (typeof window === 'undefined') return normalizeDesktopChartSettings(null);
  try {
    return normalizeDesktopChartSettings(
      JSON.parse(window.localStorage.getItem(DESKTOP_CHART_SETTINGS_KEY) || 'null'),
    );
  } catch {
    return normalizeDesktopChartSettings(null);
  }
}

export function saveDesktopChartSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      DESKTOP_CHART_SETTINGS_KEY,
      JSON.stringify(normalizeDesktopChartSettings(settings)),
    );
  } catch {
    // Local chart preferences are optional.
  }
}

function instrumentTimezone(instrument) {
  return instrument?.sessionTimezone
    || instrument?.exchangeTimezone
    || instrument?.timeZone
    || instrument?.timezone
    || 'UTC';
}

function fixedOffsetMinutes(value) {
  const match = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 14 || minutes > 59) return null;
  return sign * (hours * 60 + minutes);
}

export function resolveChartTimezone(selection, instrument = null) {
  if (selection === 'local') {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  }
  if (selection === 'exchange') return instrumentTimezone(instrument);
  if (selection === 'UTC') return 'UTC';

  const offset = fixedOffsetMinutes(selection);
  if (offset == null) return 'UTC';

  // Intl does not support arbitrary fixed-offset zone names consistently.
  // Returning the original selection lets the formatter apply the offset itself.
  return selection;
}

function timeMs(value) {
  if (value && typeof value === 'object' && Number.isFinite(Number(value.year))) {
    return Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day));
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 10_000_000_000 ? numeric : numeric * 1000;
}

function dateForSelection(value, selection, instrument) {
  const ms = timeMs(value);
  if (!Number.isFinite(ms)) return null;
  const offset = fixedOffsetMinutes(selection);
  if (offset == null) return { date: new Date(ms), timeZone: resolveChartTimezone(selection, instrument) };
  return { date: new Date(ms + offset * 60_000), timeZone: 'UTC' };
}

function formatter(selection, instrument, options) {
  const resolved = resolveChartTimezone(selection, instrument);
  const offset = fixedOffsetMinutes(selection);
  const timeZone = offset == null ? resolved : 'UTC';
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone, hourCycle: 'h23' });
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC', hourCycle: 'h23' });
  }
}

export function formatChartClock(date, selection = 'UTC', instrument = null) {
  const source = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(source.getTime())) return '—';
  const offset = fixedOffsetMinutes(selection);
  const adjusted = offset == null ? source : new Date(source.getTime() + offset * 60_000);
  return formatter(selection, instrument, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(adjusted);
}

export function chartTimezoneLabel(selection = 'UTC', instrument = null) {
  if (selection === 'exchange') {
    const zone = instrumentTimezone(instrument);
    return zone === 'UTC' ? 'UTC' : zone;
  }
  if (selection === 'local') {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'; } catch { return 'Local'; }
  }
  return selection;
}

export function formatChartTime(value, selection = 'UTC', instrument = null, options = {}) {
  const resolved = dateForSelection(value, selection, instrument);
  if (!resolved) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: resolved.timeZone,
      hourCycle: 'h23',
      ...options,
    }).format(resolved.date);
  } catch {
    return '';
  }
}

export function formatChartTick(value, tickMarkType, selection = 'UTC', instrument = null) {
  const type = Number(tickMarkType);
  if (type === 0) return formatChartTime(value, selection, instrument, { year: 'numeric' });
  if (type === 1) return formatChartTime(value, selection, instrument, { month: 'short' });
  if (type === 2) return formatChartTime(value, selection, instrument, { day: '2-digit', month: 'short' });
  if (type === 4) return formatChartTime(value, selection, instrument, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return formatChartTime(value, selection, instrument, { hour: '2-digit', minute: '2-digit' });
}

export function formatChartCrosshairTime(value, selection = 'UTC', instrument = null) {
  return formatChartTime(value, selection, instrument, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
