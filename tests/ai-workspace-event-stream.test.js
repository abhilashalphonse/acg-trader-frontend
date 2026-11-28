import test from 'node:test';
import assert from 'node:assert/strict';
import {readWorkspaceEventStream} from '../src/api/workspaceEventStream.js';
const e=(name,data)=>'event: '+name+'\ndata: '+JSON.stringify(data)+'\n\n';
const context=e('progress',{stage:'CONTEXT'}),generating=e('progress',{stage:'GENERATING'});
const result=e('result',{state:'ANSWERED',answer:'Verified ₹ answer'});
const response=(text,chunk=7)=>new Response(new ReadableStream({start(controller){const bytes=new TextEncoder().encode(text);for(let i=0;i<bytes.length;i+=chunk)controller.enqueue(bytes.slice(i,i+chunk));controller.close();}}));
test('reads fragmented UTF-8 progress and final result exactly once',async()=>{
  const stages=[];
  assert.deepEqual(await readWorkspaceEventStream(response(context+generating+result,1),s=>stages.push(s)),{state:'ANSWERED',answer:'Verified ₹ answer'});
  assert.deepEqual(stages,['CONTEXT','GENERATING']);
});
test('rejects premature, incomplete, duplicate, unknown and oversized streams',async()=>{
  for(const input of [result,context+result,context+generating,context+generating+result+result,
    context+generating+e('delta',{text:'unverified'}),context+generating+e('error',{code:'AI_UNAVAILABLE'}),
    context+generating+result.slice(0,-1),context+generating+e('result',{answer:'a'.repeat(66000)})])
    await assert.rejects(readWorkspaceEventStream(response(input,1024)));
});

test('renders ordered provisional deltas and requires exact final answer',async()=>{
  const seen=[];
  const text=context+generating+e('delta',{text:'Verified '})+e('delta',{text:'₹ answer'})+result;
  assert.equal((await readWorkspaceEventStream(response(text,1),null,d=>seen.push(d))).answer,'Verified ₹ answer');
  assert.deepEqual(seen,['Verified ','₹ answer']);
  await assert.rejects(readWorkspaceEventStream(response(context+generating+e('delta',{text:'mismatch'})+result)));
  await assert.rejects(readWorkspaceEventStream(response(context+e('delta',{text:'premature'})+generating+result)));
});
test('failed or interrupted token stream cannot produce a committed answer',async()=>{
  const partial=context+generating+e('delta',{text:'Partial answer'});
  await assert.rejects(readWorkspaceEventStream(response(partial)));
  assert.equal((await readWorkspaceEventStream(response(partial+e('result',{state:'HELD_UNKNOWN'})))).state,'HELD_UNKNOWN');
});
