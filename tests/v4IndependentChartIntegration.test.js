import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const chart=read('src/components/trading-v2/ChartArea.jsx');
const multi=read('src/components/trading-v2/desktop/DesktopMultiChart.jsx');
const desktop=read('src/components/trading-v2/DesktopTerminal.jsx');
const layer=read('src/components/trading-v2/v4/V4ChartOrderLayer.jsx');
const parent=read('src/pages/TradingTerminalV2.jsx');

test('Audit route renders isolated V4 order UI and keeps legacy for normal/mobile views',()=>{
 assert.match(chart,/desktopEnhanced && chartOrderV4 && !mobileOverlayStyle \? \(/);
 assert.match(chart,/<V4ChartOrderLayer/);
 assert.match(chart,/\) : \(<>/);
 assert.doesNotMatch(layer,/from ['"].*ChartArea/);
 assert.doesNotMatch(layer,/<TradePlanOverlay|<PendingOrderOverlay|<OpenPositionEntryOverlay|<OpenPositionProtectionOverlay/);
});

test('Mandatory Save Cancel callbacks traverse full terminal tree',()=>{
 assert.match(parent,/onCancelPositionProtection=\{cancelPositionProtection\}/);
 assert.match(parent,/onApplyPositionProtection=\{overrides => applyPositionProtection/);
 for(const file of [desktop,multi,chart]) {
  assert.match(file,/onCancelPositionProtection=/);
  assert.match(file,/onApplyPositionProtection=/);
  assert.match(file,/positionProtectionSaving=/);
 }
 assert.match(layer,/onCancelPositionProtection/);
 assert.match(layer,/onApplyPositionProtection/);
 assert.match(layer,/onPositionProtectionDraftChange/);
});

test('New chart keeps backend-accepted values separate from local preview and requires Save',()=>{
 assert.match(layer,/v4ShowAcceptedBadge/);
 assert.match(layer,/data-v4-line-state=\{level\.accepted\?'solid':'dotted'\}/);
 assert.match(layer,/window\.addEventListener\('pointerup',up\)/);
 assert.match(layer,/status:'review'/);
 assert.match(layer,/Math\.abs\(event\.clientY-drag\.startY\)<5/);
 assert.match(layer,/await onUpdatePosition\(level\.ownerId,\{\[level\.field\]:price\}\)/);
 assert.match(layer,/await onMovePending\(level\.ownerId,price,level\.field\)/);
 assert.match(layer,/setEdit\(null\)/);
 assert.match(layer,/onSave=\{save\}/);
 assert.match(layer,/Confirm removal/);
 assert.doesNotMatch(layer,/onPointerUp=\{.*onUpdatePosition/);
});

test('Pending amendment results explicitly report rejected commands',()=>{
 const start=parent.indexOf('const movePendingOrder = async');
 const end=parent.indexOf('const modifyPendingOrder =',start);
 const body=parent.slice(start,end);
 assert.match(body,/return true/);
 assert.match(body,/return false/);
 assert.match(body,/await trading\.replacePendingOrder/);
});
