import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAssistantMarkdown,inlineParts} from '../src/components/ai/assistantMarkdown.js';
test('analysis headings and price scenarios preserve order and emphasis',()=>{
  const a=parseAssistantMarkdown('## Market outlook\nNo clear entry.\n\n1. **Long:** wait for 1.0985.\n   - Confirmation: M5 close.\n   - Invalidation: 1.0960.\n2. **Short:** wait for rejection.\n\n## Risk\nDefine risk first.');
  assert.deepEqual(a.map(b=>b.type),['heading','paragraph','list','heading','paragraph']);
  assert.equal(a[2].items.length,2);
  assert.equal(a[2].items[0].children[0].items.length,2);
  assert.deepEqual(inlineParts(a[2].items[0].text),[{type:'strong',text:'Long:'},{type:'text',text:' wait for 1.0985.'}]);
});
test('tables keep cell order, numeric text and escaped pipe',()=>{
  const a=parseAssistantMarkdown('| Setup | Level |\n| --- | ---: |\n| Long | 1.09850 |\n| Short \\| wait | 1.09600 |');
  assert.equal(a[0].type,'table');
  assert.deepEqual(a[0].rows,[['Long','1.09850'],['Short | wait','1.09600']]);
});
test('plain text, unsafe HTML and URLs remain inert text',()=>{
  const text='<img src=x onerror=alert(1)> [click](javascript:alert(1))';
  assert.deepEqual(parseAssistantMarkdown(text),[{type:'paragraph',text}]);
  assert.deepEqual(inlineParts(text),[{type:'text',text}]);
});
test('code fences, incomplete formatting and blank lines remain readable',()=>{
  const a=parseAssistantMarkdown('Some **unfinished\n\n```json\n{"price":1.09}\n```\n\n---\n> Check risk');
  assert.deepEqual(a.map(b=>b.type),['paragraph','codeBlock','rule','quote']);
  assert.equal(a[0].text,'Some **unfinished');
  assert.equal(a[1].text,'{"price":1.09}');
});
test('numbered list start and wrapped continuation are preserved',()=>{
  const a=parseAssistantMarkdown('3. Wait for confirmation\n   before considering entry.\n\n4. Review risk.');
  assert.equal(a[0].start,3);
  assert.equal(a[0].items[0].text,'Wait for confirmation before considering entry.');
  assert.equal(a[0].items.length,2);
});
test('conversational trading follow-up preserves normal paragraph and optional short heading',()=>{
  const text="You've probably missed the first rally, but the opportunity may not be over.\n\n### What I'd watch next\n- **3680.26:** Wait for a confirmed breakout.\n- **3672.02:** A breakdown could suggest a deeper pullback.\n\nThe live quote is unavailable.";
  const blocks=parseAssistantMarkdown(text);
  assert.deepEqual(blocks.map(b=>b.type),['paragraph','heading','list','paragraph']);
  assert.equal(blocks[0].text,"You've probably missed the first rally, but the opportunity may not be over.");
  assert.deepEqual(inlineParts(blocks[0].text),[{type:'text',text:blocks[0].text}]);
  assert.equal(blocks[2].items.length,2);
});
