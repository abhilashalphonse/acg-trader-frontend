import test from 'node:test';
import assert from 'node:assert/strict';
import {accountSwitcherId, buildAccountSwitcherSections, isArchivedAccount} from '../src/utils/accountSwitcherPresentation.js';

const current={id:'one',accountCode:'ACG-886425',accountType:'TRIAL',status:'ACTIVE'};
const second={id:'two',accountCode:'ACG-886426',accountType:'CHALLENGE',status:'ACTIVE'};
const breached={id:'old',accountCode:'ACG-OLDER',accountType:'TRIAL',status:'BREACHED'};
const closed={id:'closed',accountCode:'ACG-CLOSED',accountType:'CHALLENGE',status:'CLOSED'};
test('selected account is first; only other active/available accounts are selectable rows',()=>{
  const x=buildAccountSwitcherSections([current,second,breached,closed],current,'one');
  assert.equal(x.current.id,'one');
  assert.deepEqual(x.other.map(a=>a.id),['two']);
  assert.deepEqual(x.archived.map(a=>a.id),['old','closed']);
  assert.equal(x.activeCount,2);
  assert.equal(x.archivedCount,2);
  assert.equal(x.total,4);
});
test('breached current account remains current and is not duplicated in archive',()=>{
  const x=buildAccountSwitcherSections([current,second,breached,closed],breached,'old');
  assert.equal(x.current.id,'old');
  assert.deepEqual(x.archived.map(a=>a.id),['closed']);
  assert.equal(x.archivedCount,2);
  assert.equal(x.total,4);
});
test('missing current ID picks safe authoritative account and deduplicates references',()=>{
  const x=buildAccountSwitcherSections([current,current,second],current,'missing-id');
  assert.equal(x.current.id,'one');
  assert.equal(x.total,2);
});
test('archived state includes all terminal historical statuses',()=>{
  for(const status of ['BREACHED','CLOSED','DISABLED','EXPIRED','TERMINATED','PASSED'])assert.equal(isArchivedAccount({status}),true);
  for(const status of ['ACTIVE','PAUSED','PENDING','UNKNOWN'])assert.equal(isArchivedAccount({status}),false);
});
test('handles empty account list and missing identifiers',()=>{
  assert.deepEqual(buildAccountSwitcherSections([],null,null),{current:null,other:[],archived:[],total:0,activeCount:0,archivedCount:0});
  assert.equal(accountSwitcherId({id:42}),'42');
  assert.equal(accountSwitcherId({accountId:'fallback'}),'fallback');
});
