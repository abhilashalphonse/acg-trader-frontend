import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { isV4DefaultEnabled } from '../src/utils/chartOrderPresentation.js';

const read = file => readFileSync(fileURLToPath(new URL('../'+file, import.meta.url)), 'utf8');

test('Railway production Docker build activates the approved V4 desktop', () => {
  const docker = read('Dockerfile');
  assert.match(docker, /ARG VITE_ACG_EXECUTION_V4_ENABLED=true/);
  assert.ok(docker.indexOf('ARG VITE_ACG_EXECUTION_V4_ENABLED=true') < docker.indexOf('RUN npm run build'));
  assert.equal(isV4DefaultEnabled('true', ''), true);
  assert.equal(isV4DefaultEnabled('true', '?acg_v4_audit=0'), false,
    'support fallback remains available without editing account settings');
  assert.equal(isV4DefaultEnabled('false',''), false);
});

test('new domain starts on 30m and does not preinstall Volume', () => {
  const source=read('src/pages/TradingTerminalV2.jsx');
  const loader=source.match(/function loadIndicators\(\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(loader,'indicator loader must exist');
  assert.match(loader,/if \(Array\.isArray\(stored\)\) return stored;/,
    'keep the users explicitly stored indicators');
  assert.match(loader,/if \(typeof window === 'undefined'\) return \[\];/);
  assert.match(loader,/return \[\];\s*$/);
  assert.match(source,/return ALLOWED_TIMEFRAMES\.has\(normalized\) \? normalized : '30m';/);
  assert.match(source,/useState\(prefsRef\.current\.timeframe \|\| '30m'\)/);
  assert.match(source,/const ALLOWED_TIMEFRAMES = new Set\(\['1m'.*'30m'/);
  assert.match(source,/if \(Array\.isArray\(stored\)\) return stored;/);
});

test('desktop empty chart preferences are aligned with the primary 30m choice', () => {
  const desktop=read('src/components/trading-v2/DesktopTerminal.jsx');
  const multiChart=read('src/components/trading-v2/desktop/DesktopMultiChart.jsx');
  assert.match(desktop,/return timeframes\.some\(\(\[id\]\) => id === normalized\) \? normalized : '30m';/);
  assert.match(desktop,/timeframe: timeframe \|\| '30m'/);
  assert.match(desktop,/timeframe = '30m'/);
  assert.match(multiChart,/TIMEFRAMES\.includes\(cell\.timeframe\) \? cell\.timeframe : '30m'/);
});
