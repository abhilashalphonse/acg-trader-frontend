// Shared Android/web terminal chart starting state.
//
// V1 automatically persisted 1m + Volume on mount, even when a trader never
// selected either. Move that unmistakable starter combination to 30m with a
// clean indicator stack only once. Leave custom indicators and non-1m choices.
export const DEFAULT_CHART_TIMEFRAME = '30m';
export const INDICATORS_KEY = 'acg-trader-indicators-v1';
export const TERMINAL_PREFERENCES_KEY = 'acg-trader-terminal-prefs-v1';
export const MULTI_CHART_PREFERENCES_KEY = 'acg-trader-multi-chart-v1';
const MIGRATION_KEY = 'acg-trader-chart-startup-defaults-v2';

const ALLOWED_TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W']);

export function normalizeChartTimeframe(value) {
  const raw = String(value || '');
  const aliases = { '1h': '1H', '4h': '4H', '1d': '1D', D: '1D', '1w': '1W' };
  const normalized = aliases[raw] || raw;
  return ALLOWED_TIMEFRAMES.has(normalized) ? normalized : DEFAULT_CHART_TIMEFRAME;
}

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch { return null; }
}

// Only matches the prior automatically generated Volume indicator. Customized
// Volume instances (or any additional indicators) remain exactly as saved.
export function isLegacyStarterVolume(indicators) {
  if (!Array.isArray(indicators) || indicators.length !== 1) return false;
  const only = indicators[0];
  if (!only || only.id !== 'volume' || only.visible === false) return false;
  const settings = only.settings || {};
  if (!['all', undefined].includes(settings.timeframeVisibility)) return false;
  const extras = Object.keys(settings).filter(key => !['timeframeVisibility', 'style', 'midStyle', 'signalStyle'].includes(key));
  if (extras.length) return false;
  for (const key of ['style', 'midStyle', 'signalStyle']) {
    if (settings[key] && Object.keys(settings[key]).length) return false;
  }
  return true;
}

export function migrateChartStartupDefaults(storage) {
  if (!storage || storage.getItem(MIGRATION_KEY) === '1') return;
  const indicators = readJson(storage, INDICATORS_KEY);
  const prefs = readJson(storage, TERMINAL_PREFERENCES_KEY);
  const autoVolume = isLegacyStarterVolume(indicators);
  const starterIndicators = indicators == null || (Array.isArray(indicators) && indicators.length === 0) || autoVolume;
  // We cannot distinguish an old automatically persisted 1m from an explicit
  // click, so only update it when no custom indicator setup is saved.
  if (starterIndicators && prefs && typeof prefs === 'object' && !Array.isArray(prefs) && prefs.timeframe === '1m') {
    storage.setItem(TERMINAL_PREFERENCES_KEY, JSON.stringify({ ...prefs, timeframe: DEFAULT_CHART_TIMEFRAME }));
    const multi = readJson(storage, MULTI_CHART_PREFERENCES_KEY);
    if (multi && Number(multi.layout) === 1 && Array.isArray(multi.cells) && multi.cells[0]?.timeframe === '1m'
      && (multi.cells[0].indicators == null || isLegacyStarterVolume(multi.cells[0].indicators) || multi.cells[0].indicators.length === 0)) {
      const cells = [...multi.cells];
      cells[0] = { ...cells[0], timeframe: DEFAULT_CHART_TIMEFRAME, indicators: [] };
      storage.setItem(MULTI_CHART_PREFERENCES_KEY, JSON.stringify({ ...multi, cells }));
    }
  }
  if (autoVolume) storage.setItem(INDICATORS_KEY, JSON.stringify([]));
  storage.setItem(MIGRATION_KEY, '1');
}

export function initialChartIndicators(storage) {
  const stored = storage ? readJson(storage, INDICATORS_KEY) : null;
  return Array.isArray(stored) ? stored : [];
}

export function initialTerminalPreferences(storage) {
  const stored = storage ? readJson(storage, TERMINAL_PREFERENCES_KEY) : null;
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { timeframe: DEFAULT_CHART_TIMEFRAME };
  return { ...stored, timeframe: normalizeChartTimeframe(stored.timeframe) };
}
