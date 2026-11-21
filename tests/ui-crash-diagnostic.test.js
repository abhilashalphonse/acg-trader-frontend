import assert from 'node:assert/strict';
import test from 'node:test';
import { uiCrashSummary, formatUiCrashSummary } from '../src/utils/uiCrashDiagnostic.js';

test('React desktop error gives a useful message and component names without user data',()=>{
  const err = new TypeError("Cannot read properties of undefined (reading 'map')");
  const info = {componentStack: '\n    at DesktopOrderTicketV4 (https://acgtrader.com/assets/private.js)\n    at DesktopTerminal (https://acgtrader.com/assets/private.js)\n    at TradingTerminalV2'};
  const summary = uiCrashSummary(err, info);
  assert.equal(summary.type, 'TypeError');
  assert.match(summary.message, /undefined.*map/);
  assert.deepEqual(summary.components,['DesktopOrderTicketV4','DesktopTerminal','TradingTerminalV2']);
  const rendered = formatUiCrashSummary(summary, 1440);
  assert.match(rendered, /DesktopOrderTicketV4/);
  assert.match(rendered, /1440px/);
  assert.ok(!rendered.includes('https://'));
});

test('diagnostic strips credentials, IDs, source URLs and overlong messages',()=>{
  const err = new Error('token: eyJabc.eyJdef.XYZ https://somewhere.example/secret/path?key=abc contact=user@example.com account=8c8dd3c2-09d7-4d5e-b162-29a9e6a3f38f');
  const output = formatUiCrashSummary(uiCrashSummary(err));
  assert.ok(!output.includes('eyJabc'));
  assert.ok(!output.includes('somewhere.example'));
  assert.ok(!output.includes('user@example.com'));
  assert.ok(!output.includes('8c8dd3c2-09d7'));
  assert.ok(output.includes('[redacted]'));
  assert.ok(output.length < 400);
});

test('unexpected browser data cannot throw while formatting the fallback',()=>{
  const output = formatUiCrashSummary(uiCrashSummary(null, {componentStack: {toString:()=>''}}),0);
  assert.match(output,/Error/);
  assert.ok(!output.includes('Viewport:'));
});
