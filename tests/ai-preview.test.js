import test from 'node:test';
import assert from 'node:assert/strict';
import {isAiChatPreviewEnabled,chartContextLabel,questionBytes,MAX_QUESTION_BYTES,SUGGESTIONS} from '../src/components/ai/aiPreview.js';
test('assistant preview cannot be enabled in a production build',()=>{
  for(const q of ['', '?acg_ai_preview=1','?acg_ai_preview=true','?acg_ai_preview=1&acg_v4_audit=1'])assert.equal(isAiChatPreviewEnabled(false,q),false);
  assert.equal(isAiChatPreviewEnabled(true,'?acg_ai_preview=1'),true);
  assert.equal(isAiChatPreviewEnabled(true,''),false);
  assert.equal(isAiChatPreviewEnabled('true','?acg_ai_preview=1'),false);
});
test('chart context only exposes normalized symbol and timeframe labels',()=>{
  assert.deepEqual(chartContextLabel('xauusd','1H'),{symbol:'XAUUSD',timeframe:'1h'});
  assert.deepEqual(chartContextLabel('<script>','fake'),{symbol:null,timeframe:null});
  assert.deepEqual(chartContextLabel(null,null),{symbol:null,timeframe:null});
});
test('composer measures UTF-8 bytes, not characters',()=>{
  assert.equal(questionBytes('€'),3);
  assert.equal(questionBytes('a'.repeat(4096)),MAX_QUESTION_BYTES);
  assert.ok(questionBytes('€'.repeat(1366))>MAX_QUESTION_BYTES);
  assert.ok(SUGGESTIONS.every(s=>questionBytes(s.prompt)<=MAX_QUESTION_BYTES));
});
