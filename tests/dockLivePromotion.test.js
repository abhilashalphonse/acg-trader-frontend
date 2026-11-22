import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDockAuditEnabled,isDockLiveEnabled} from '../src/utils/dockAuditMode.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('approved compact dock and popup are available by default in production builds',()=>{
  assert.equal(isDockLiveEnabled('',true),true);
  assert.equal(isDockLiveEnabled('?other=1',true),true);
  assert.equal(isDockLiveEnabled('?acg_dock_audit=0',true),false);
  assert.equal(isDockLiveEnabled('?acg_dock_audit=1',true),true);
  assert.equal(isDockLiveEnabled('',false),false);
  assert.equal(isDockLiveEnabled('?acg_dock_audit=1',false),true);
  assert.equal(isDockAuditEnabled(''),false);
  assert.equal(isDockAuditEnabled('?acg_dock_audit=1'),true);
});

test('production build promotes existing tested V4 UI without changing order execution',()=>{
  const docker=read('Dockerfile');
  const terminal=read('src/components/trading-v2/DesktopTerminal.jsx');
  assert.match(docker,/ARG VITE_ACG_DOCK_LIVE_ENABLED=true/);
  assert.match(terminal,/isDockLiveEnabled\(/);
  assert.match(terminal,/import\.meta\.env\.VITE_ACG_DOCK_LIVE_ENABLED === 'true'/);
  assert.match(terminal,/V4_DESKTOP_EXECUTION_ENABLED && isDockLiveEnabled/);
  assert.match(terminal,/onOpenMiniTerminal=\{DOCK_AUDIT_ENABLED \? openMiniTerminal : undefined\}/);
  assert.match(terminal,/directPendingCancel=\{DOCK_AUDIT_ENABLED && miniTerminalDetached\}/);
  assert.match(terminal,/onManualOrder=\{submitOneClick\}/);
});
