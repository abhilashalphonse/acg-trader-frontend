import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { riskPositionReadout, clampRiskTag } from '../src/utils/riskPositionReadout.js';

const position = (type,entry,stop,target) => ({
  type,a:{time:100,price:entry},b:{time:200,price:stop},
  riskTarget:{time:200,price:target},
});
const metrics={canCreateOrder:true,sizing:{requestedLots:0.17,actualRisk:142.35,actualRiskPercent:0.5}};

test('LONG target/stop readout uses actual price distances and risk, never hypothetical open PnL',()=>{
  const d=position('long-position',59755.8,59340.64,60586.12);
  const out=riskPositionReadout(d,metrics);
  assert.equal(out.sideValid,true);
  assert.equal(out.ready,true);
  assert.ok(Math.abs(out.rr-2)<1e-10);
  assert.equal(out.targetText,'Target  +830.32 (1.39%)');
  assert.equal(out.stopText,'Stop  −415.16 (0.69%)');
  assert.match(out.centerText,/R:R 2\.00/);
  assert.match(out.centerText,/Risk 0\.50%/);
  assert.match(out.centerText,/Qty 0\.17 lots/);
  assert.doesNotMatch(JSON.stringify(out),/Open PnL|guaranteed|profit/i);
});

test('SHORT reverses target and stop directions but still displays a positive possible target distance',()=>{
  const d=position('short-position',59755.8,60170.96,58925.48);
  const out=riskPositionReadout(d,metrics);
  assert.equal(out.sideValid,true);
  assert.equal(out.ready,true);
  assert.ok(Math.abs(out.rr-2)<1e-10);
  assert.match(out.targetText,/Target  \+830\.32/);
  assert.match(out.stopText,/Stop  −415\.16/);
});

test('invalid risk direction is not shown as order-ready even when preliminary metrics say yes',()=>{
  const invalid=position('long-position',100,110,90);
  assert.equal(riskPositionReadout(invalid,metrics).ready,false);
  assert.equal(riskPositionReadout(position('short-position',100,90,110),metrics).sideValid,false);
  assert.equal(riskPositionReadout(position('long-position',100,99,102),null).ready,false);
  assert.equal(riskPositionReadout(position('short-position',100,101,98),null).quantity,null);
});

test('labels remain in viewport at edges or narrow chart widths',()=>{
  for(const point of [-300,0,80,200,1800]) {
    const p=clampRiskTag(point,-50,'Target 60,586.12 +2.00% · hypothetical',300,160);
    assert.ok(p.x>=6);
    assert.ok(p.x+p.width<=300-6);
    assert.ok(p.y>=4);
    assert.ok(p.y+p.height<=160-4);
  }
});

test('risk drawings replace the old black information panel but preserve drag transactions and order planner',()=>{
  const shape=readFileSync(new URL('../src/components/trading-v2/DrawingLayer.jsx',import.meta.url),'utf8');
  const overlay=readFileSync(new URL('../src/components/trading-v2/RiskPositionDrawing.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(shape,/fill="rgba\(6,9,11,0\.94\)"/);
  assert.match(shape,/RiskPositionDrawing/);
  assert.match(shape,/onCreateRiskOrder\(\{/);
  assert.match(overlay,/data-testid="risk-reward-zone"/);
  assert.match(overlay,/data-testid="risk-stop-zone"/);
  assert.match(overlay,/onStartHandle\(event, drawing\.id, 'riskTarget'\)/);
  assert.match(overlay,/testId="position-risk-summary"/);
  assert.match(overlay,/showDetails \? \(/);
});
