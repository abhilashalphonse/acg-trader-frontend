import test from 'node:test';
import assert from 'node:assert/strict';
import {chartFeedStatus,followUpSuggestions,regenerationQuestion,workspaceFailureNotice} from '../src/components/ai/workspacePresentation.js';
test('status only shows live for the selected instrument with known current terminal quote',()=>{
  const q={symbol:'XAUUSD',sessionOpen:true,live:true,isStale:false,bid:3680,ask:3680.1};
  assert.equal(chartFeedStatus(q,'XAUUSD'),'LIVE');
  assert.equal(chartFeedStatus(q,'EURUSD'),'UNKNOWN');
  assert.equal(chartFeedStatus({...q,isStale:true},'XAUUSD'),'STALE');
  assert.equal(chartFeedStatus({...q,sessionOpen:false},'XAUUSD'),'CLOSED');
  assert.equal(chartFeedStatus({...q,isStale:undefined},'XAUUSD'),'UNKNOWN');
  assert.equal(chartFeedStatus({...q,ask:1},'XAUUSD'),'UNKNOWN');
});
test('follow-up choices depend on answer content and do not fabricate prices',()=>{
  assert.equal(followUpSuggestions('A breakout and retest would help.')[0].label,'Explain the retest');
  assert.equal(followUpSuggestions('Your margin and risk are important.')[0].label,'Explain the risk');
  assert.deepEqual(followUpSuggestions('Hello').map(s=>s.label),['Summarise']);
  assert.deepEqual(followUpSuggestions(''),[]);
});
test('regenerate only the latest answered question in the current context scope',()=>{
  const m=[{role:'user',text:'First'},{role:'assistant',id:'a',text:'Answer'},{role:'user',text:'Second'},{role:'assistant',id:'b',text:'Answer'}];
  assert.equal(regenerationQuestion(m,0,'b'),'Second');
  assert.equal(regenerationQuestion(m,0,'a'),null);
  assert.equal(regenerationQuestion(m,3,'b'),null);
  assert.equal(regenerationQuestion(m.slice(0,-1),0,'b'),null);
});

test('failure notice only trusts matching workspace response identity',()=>{
  const expected={operationId:'fixture',symbol:'XAUUSD',timeframe:'5m'};
  const result={contractVersion:'restricted-pilot-v1',mode:'WORKSPACE_CHAT',executionAllowed:false,operationId:'fixture',workspace:{symbol:'XAUUSD',timeframe:'5m'},state:'FAILED',failureReason:'COMPLETION_LIMIT'};
  assert.match(workspaceFailureNotice(result,expected),/response limit/);
  assert.match(workspaceFailureNotice({...result,operationId:'other'},expected),/could not be verified/);
  assert.match(workspaceFailureNotice({...result,state:'HELD_UNKNOWN'},expected),/outcome uncertain/);
  assert.match(workspaceFailureNotice({...result,failureReason:'INVALID_ANSWER'},expected),/unreadable answer/);
  assert.match(workspaceFailureNotice({...result,failureReason:'untrusted reason'},expected),/did not complete/);
});
