import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedChatClient} from '../src/components/ai/isolatedChatClient.js';
const accountId='a'.repeat(24),connectionId='11111111-1111-4111-8111-111111111111',conversationId='22222222-2222-4222-8222-222222222222',messageId='33333333-3333-4333-8333-333333333333';
const offline={contractVersion:'native-chat-v1',runtimeEnabled:false,dispatchAllowed:false,creditDeducted:false,conversationId,messageId};
const setup=(post,isCurrent=()=>true)=>createIsolatedChatClient({isolated:true,accountId,connectionId,post,isCurrent});
test('Phase 4F isolated client is disabled by default and pins authority',async()=>{
  assert.throws(()=>createIsolatedChatClient({accountId,connectionId,post:async()=>offline,isCurrent:()=>true}),{code:'AI_CLIENT_DISABLED'});
  let calls=0;
  const client=setup(async(path,body)=>{calls++;assert.equal(path,'/v1/ai/chat/conversations/append');assert.deepEqual(body,{accountId,connectionId,conversationId,messageId,text:'Explain BOS'});return offline;});
  await assert.rejects(client.request('append',{conversationId,messageId,text:'Explain BOS',accountId:'b'.repeat(24)}),{code:'AI_INVALID_REQUEST'});
  await assert.rejects(client.request('dispatch',{}),{code:'AI_INVALID_REQUEST'});
  assert.equal(calls,0);
  assert.deepEqual(await client.request('append',{conversationId,messageId,text:'Explain BOS'}),offline);
  assert.equal(calls,1);
});
test('Phase 4F rejects live, charged, mismatched or incomplete envelopes',async()=>{
  for(const patch of [{runtimeEnabled:true},{dispatchAllowed:true},{creditDeducted:true},{messageId:connectionId},{contractVersion:'other'},{dispatchAllowed:undefined}]){
    await assert.rejects(setup(async()=>({...offline,...patch})).request('append',{conversationId,messageId,text:'x'}),{code:'AI_INVALID_RESPONSE'});
  }
});
test('Phase 4F suppresses late response after scope change or cancellation; never retries',async()=>{
  let current=true,calls=0;
  await assert.rejects(setup(async()=>{calls++;current=false;return offline;},()=>current).request('append',{conversationId,messageId,text:'x'}),{code:'AI_SCOPE_CHANGED'});
  assert.equal(calls,1);
  const controller=new AbortController();
  await assert.rejects(setup(async()=>{controller.abort();return offline;}).request('append',{conversationId,messageId,text:'x'},controller.signal),{code:'AI_SCOPE_CHANGED'});
  await assert.rejects(setup(async()=>{calls++;throw new Error('network');}).request('append',{conversationId,messageId,text:'x'}),{code:'AI_REQUEST_FAILED'});
  assert.equal(calls,2);
});
test('Phase 4F history must match conversation and only known paths are used',async()=>{
  const client=setup(async(path,body)=>{assert.equal(path,'/v1/ai/chat/conversations/history');assert.equal(body.accountId,accountId);return {contractVersion:'native-chat-v1',runtimeEnabled:false,conversation:{conversationId:messageId}};});
  await assert.rejects(client.request('history',{conversationId,afterSequence:0,limit:8}),{code:'AI_INVALID_RESPONSE'});
});
