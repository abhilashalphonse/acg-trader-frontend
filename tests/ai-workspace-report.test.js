import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceContext,projectWorkspaceReport} from '../src/components/ai/workspaceReport.js';
import {sampleWorkspaceReport} from './fixtures/aiWorkspaceReport.js';
const now=Date.UTC(2026,0,5,10,20);
test('workspace context requires explicit consent and only symbol/timeframe',()=>{
  assert.equal(workspaceContext('XAUUSD','1m',false),null);
  assert.equal(workspaceContext('XAUUSD','fake',true),null);
  assert.deepEqual(workspaceContext('xauusd','1H',true),{symbol:'XAUUSD',timeframe:'1h',includeChartContext:true});
});
test('verified report projection renders only allowlisted historical facts',()=>{
  const {envelope,expected}=sampleWorkspaceReport(workspaceContext('XAUUSD','1m',true),now);
  const v=projectWorkspaceReport(envelope,expected,now);
  assert.equal(v.facts[0].value,'119');assert.equal(v.facts[0].label,'Last closed price');
  assert.equal(projectWorkspaceReport(envelope,expected,now+10000),null);
  assert.equal(projectWorkspaceReport(envelope,{...expected,symbol:'EURUSD'},now),null);
  assert.equal(projectWorkspaceReport(envelope,{...expected,messageId:'3'.repeat(36)},now),null);
  for(const mutate of [e=>{e.response.quoteStatus='RECENT_PROVIDER_EVENT';},e=>{e.dispatchAllowed=true;},
    e=>{e.response.observations[0].data.kind='BUY_NOW';},e=>{e.response.observations[0].data.value='<img onerror=alert(1)>';},
    e=>{e.response.observations[0].timeframe='5m';},e=>{e.response.observations.push(e.response.observations[0]);},
    e=>{e.response.expiresAtMs+=1;},e=>{e.response.observations[0].data.throughCloseTimeMs=now+1;}]){
    const bad=structuredClone(envelope);mutate(bad);assert.equal(projectWorkspaceReport(bad,expected,now),null);
  }
});
