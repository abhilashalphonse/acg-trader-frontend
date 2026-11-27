import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAnalysisReport,isNativeTable,outlookTone} from '../src/components/ai/analysisReport.js';
const report=[
  '## Market outlook','**Bullish structure, short-term pullback**','The broader chart is stronger than the lower timeframe.','','## Timeframe outlook','| Timeframe | Outlook | Evidence |','| --- | --- | --- |','| H4 | Bullish | Higher high |','| M1 | Bearish | Pullback |','','## Key price levels','| Level | Price | Context |','| --- | --- | --- |','| Resistance | 3679.58 | Observed high |','| Pullback | 3667.03–3670.10 | Gap zone |','','## Bullish scenario','- **Trigger:** wait for a reclaim.','','## Bearish scenario','- Wait for breakdown.','','## Current assessment','No confirmed entry.'
].join('\n');
test('market report preserves all sections, exact price text and evidence',()=>{
  const groups=parseAnalysisReport(report);
  assert.deepEqual(groups.map(g=>g.kind),['outlook','timeframes','levels','bullish','bearish','assessment']);
  assert.equal(isNativeTable(groups[1].blocks[0],'timeframes'),true);
  assert.equal(isNativeTable(groups[2].blocks[0],'levels'),true);
  assert.deepEqual(groups[2].blocks[0].rows[1],['Pullback','3667.03–3670.10','Gap zone']);
  assert.equal(groups[5].blocks[0].text,'No confirmed entry.');
});
test('simple conversation and malformed report retain general Markdown rendering',()=>{
  assert.equal(parseAnalysisReport('Hello! **How can I help?**'),null);
  assert.equal(parseAnalysisReport('## Market outlook\nOnly this section.'),null);
  assert.equal(parseAnalysisReport('## Market outlook\nFirst\n## Market outlook\nSecond'),null);
  assert.equal(parseAnalysisReport('## Market outlook\nFirst\n## Current assessment'),null);
});
test('only explicit outlook labels get directional styling',()=>{
  assert.equal(outlookTone('**Bullish**'),'positive');
  assert.equal(outlookTone('Bearish'),'negative');
  assert.equal(outlookTone('Not bullish'),'neutral');
  assert.equal(outlookTone('Mixed'),'neutral');
  assert.equal(outlookTone('<script>bullish</script>'),'neutral');
});
test('unknown table schema remains ordinary table instead of guessing fields',()=>{
  assert.equal(isNativeTable({type:'table',headers:['Price','Level','Context']},'levels'),false);
});