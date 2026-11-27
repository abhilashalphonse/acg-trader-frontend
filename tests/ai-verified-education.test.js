import test from 'node:test';
import assert from 'node:assert/strict';
import {projectVerifiedEducation} from '../src/components/ai/verifiedEducation.js';
const id='a'.repeat(64),responseId='b'.repeat(64),verifiedAtMs=1700000000000,responseExpiresAtMs=verifiedAtMs+10000;
const entry={knowledgeId:id,id:'MARKET_STRUCTURE',title:'Structure and confirmation',text:'Server catalog content',methodVersion:'structure-liquidity-v1',reviewStatus:'ENGINEERING_DRAFT',distribution:'INTERNAL_ONLY'};
const good=()=>({status:'STORED_OFFLINE',fixtureProviderOnly:true,dispatchAllowed:false,creditDeducted:false,
  providerRun:{state:'VERIFIED',referenceIds:[id],responseId,responseStatus:'ANSWER',verifiedAtMs,responseExpiresAtMs,inputTokens:100,outputTokens:20},
  verifiedEducation:{schemaVersion:'verified-education-view-v1',verification:'RECOMPUTED_REFERENCE_SELECTION_ONLY',catalogVersion:'acg-knowledge-v1',fixtureOnly:true,
    responseId,status:'ANSWER',verifiedAtMs,responseExpiresAtMs,entries:[entry]}});
test('verified reference projection and historical presentation',()=>{
  assert.deepEqual(projectVerifiedEducation(good()),{state:'VERIFIED',status:'ANSWER',verifiedAtMs,entries:[{knowledgeId:id,title:entry.title,text:entry.text,methodVersion:entry.methodVersion}]});
  assert.equal(projectVerifiedEducation({status:'STORED_OFFLINE'}),null);
});
test('reject malformed, unverified, charged or mismatched responses',()=>{
  for(const mutate of [m=>m.creditDeducted=true,m=>m.status='CANCELLED',m=>m.providerRun.referenceIds=['c'.repeat(64)],
    m=>m.verifiedEducation.responseId='c'.repeat(64),m=>m.verifiedEducation=null,m=>m.verifiedEducation.fixtureOnly=false,
    m=>m.providerRun.inputTokens=9000,m=>m.verifiedEducation.entries=[{...entry,reviewStatus:'APPROVED'}]]){
    const m=structuredClone(good());mutate(m);assert.throws(()=>projectVerifiedEducation(m));
  }
});
test('nonverified states never render answer content',()=>{
  for(const state of ['CLAIMED','FAILED','HELD_UNKNOWN','SUPPRESSED']){
    const m={...good(),providerRun:{state,referenceIds:[],responseId:null,responseStatus:null},verifiedEducation:null};
    assert.deepEqual(projectVerifiedEducation(m),{state,entries:[]});
    assert.throws(()=>projectVerifiedEducation({...m,verifiedEducation:good().verifiedEducation}));
  }
});
