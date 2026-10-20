import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHART_TIMEFRAME,
  normalizeChartTimeframe,
  initialTerminalPreferences,
  initialChartIndicators,
  migrateChartStartupDefaults,
  isLegacyStarterVolume,
  INDICATORS_KEY,
  TERMINAL_PREFERENCES_KEY,
  MULTI_CHART_PREFERENCES_KEY,
} from '../src/utils/chartStartupDefaults.js';
import { createIndicator } from '../src/utils/indicators.js';

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    dump: () => Object.fromEntries(data),
  };
}

test('fresh Android and web sessions start on 30m without volume or other indicators', () => {
  assert.equal(DEFAULT_CHART_TIMEFRAME, '30m');
  const s = storage();
  migrateChartStartupDefaults(s);
  assert.equal(initialTerminalPreferences(s).timeframe, '30m');
  assert.deepEqual(initialChartIndicators(s), []);
  assert.equal(normalizeChartTimeframe('bad'), '30m');
  assert.equal(normalizeChartTimeframe('1m'), '1m');
  assert.equal(normalizeChartTimeframe('4h'), '4H');
});

test('legacy automatically persisted 1m + volume becomes 30m with an empty chart', () => {
  const oldVolume = createIndicator('volume');
  assert.equal(isLegacyStarterVolume([oldVolume]), true);
  const s = storage({
    [TERMINAL_PREFERENCES_KEY]: JSON.stringify({timeframe: '1m', chartMode: 'candles', lots: .1}),
    [INDICATORS_KEY]: JSON.stringify([oldVolume]),
    [MULTI_CHART_PREFERENCES_KEY]: JSON.stringify({
      layout:1, activeCell:0, cells:[{symbol:'EURUSD',timeframe:'1m',indicators:[oldVolume]}],
    }),
  });
  migrateChartStartupDefaults(s);
  assert.equal(initialTerminalPreferences(s).timeframe,'30m');
  assert.equal(initialTerminalPreferences(s).lots,.1);
  assert.deepEqual(initialChartIndicators(s),[]);
  const multi = JSON.parse(s.getItem(MULTI_CHART_PREFERENCES_KEY));
  assert.equal(multi.cells[0].timeframe,'30m');
  assert.deepEqual(multi.cells[0].indicators,[]);
  // A deliberate 1m selection after the one-time migration must survive reload.
  s.setItem(TERMINAL_PREFERENCES_KEY, JSON.stringify({timeframe:'1m'}));
  migrateChartStartupDefaults(s);
  assert.equal(initialTerminalPreferences(s).timeframe,'1m');
});

test('saved timeframe and explicitly customized indicator setups are preserved', () => {
  const ema = createIndicator('ema');
  const volume = createIndicator('volume');
  const s = storage({
    [TERMINAL_PREFERENCES_KEY]: JSON.stringify({timeframe:'1m'}),
    [INDICATORS_KEY]: JSON.stringify([ema,volume]),
  });
  migrateChartStartupDefaults(s);
  assert.equal(initialTerminalPreferences(s).timeframe,'1m');
  assert.deepEqual(initialChartIndicators(s),[ema,volume]);
  const selected = storage({
    [TERMINAL_PREFERENCES_KEY]: JSON.stringify({timeframe:'15m'}),
    [INDICATORS_KEY]: JSON.stringify([volume]),
  });
  migrateChartStartupDefaults(selected);
  assert.equal(initialTerminalPreferences(selected).timeframe,'15m');
  assert.deepEqual(initialChartIndicators(selected),[],'legacy auto-added volume removed independently');
  const customVolume = createIndicator('volume',{timeframeVisibility:['M30']});
  assert.equal(isLegacyStarterVolume([customVolume]),false);
  const custom = storage({[INDICATORS_KEY]:JSON.stringify([customVolume])});
  migrateChartStartupDefaults(custom);
  assert.deepEqual(initialChartIndicators(custom),[customVolume]);
});

test('missing/invalid local preferences produce safe defaults', () => {
  const bad = storage({[TERMINAL_PREFERENCES_KEY]:'{oops',[INDICATORS_KEY]:'not json'});
  migrateChartStartupDefaults(bad);
  assert.equal(initialTerminalPreferences(bad).timeframe,'30m');
  assert.deepEqual(initialChartIndicators(bad),[]);
});
