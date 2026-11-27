import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceContext,projectWorkspaceReport,matchesConversationWorkspace,projectMarketGeneration,projectMarketRun} from '../src/components/ai/workspaceReport.js';
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
    e=>{e.response.frames=[null];},e=>{e.response.expiresAtMs+=1;},e=>{e.response.observations[0].data.throughCloseTimeMs=now+1;}]){
    const bad=structuredClone(envelope);mutate(bad);assert.equal(projectWorkspaceReport(bad,expected,now),null);
  }
});

test('chart conversation scope is pinned to explicit consent and chart identity',()=>{
  const w=workspaceContext('XAUUSD','1m',true),c={status:'ACTIVE',profile:'STRUCTURE',workspace:w};
  assert.equal(matchesConversationWorkspace(c,w),true);
  assert.equal(matchesConversationWorkspace(c,null),false);
  assert.equal(matchesConversationWorkspace(c,workspaceContext('EURUSD','1m',true)),false);
  assert.equal(matchesConversationWorkspace(c,workspaceContext('XAUUSD','5m',true)),false);
  assert.equal(matchesConversationWorkspace({...c,status:'DELETED'},w),false);
  assert.equal(matchesConversationWorkspace({status:'ACTIVE',profile:'EDUCATION',workspace:null},null),true);
});

test('market provider report requires matching verified receipt and cannot be reconstructed from history',()=>{
  const {envelope,expected}=sampleWorkspaceReport(workspaceContext('XAUUSD','1m',true),now);
  const report={...envelope,mode:'FIXTURE_PROVIDER_MARKET_REPORT',fixtureProviderOnly:true};
  const result={contractVersion:'native-chat-v1',runtimeEnabled:false,fixtureProviderOnly:true,dispatchAllowed:false,creditDeducted:false,verifiedEducation:null,
    providerRun:{state:'VERIFIED',referenceIds:[],responseId:report.response.responseId,verifiedAtMs:report.response.verifiedAtMs,responseExpiresAtMs:report.response.expiresAtMs},
    verifiedMarket:report,replayed:false};
  assert.equal(projectWorkspaceReport(projectMarketGeneration(result,expected,now),expected,now).providerSelected,true);
  const {verifiedMarket,...history}=result;
  assert.equal(projectMarketRun(history).state,'VERIFIED');
  assert.equal(projectMarketGeneration({...history,replayed:true},expected,now),null);
  assert.throws(()=>projectMarketGeneration({...result,replayed:true},expected,now));
  assert.throws(()=>projectMarketGeneration({...result,providerRun:{...result.providerRun,responseId:'f'.repeat(64)}},expected,now));
  assert.throws(()=>projectMarketGeneration(result,expected,now+10000));
});
