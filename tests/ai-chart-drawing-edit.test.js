import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawingEditCommand} from '../src/components/ai/chartDrawingEdit.js';
test('geometry edit requests require bounded explicit user instructions',()=>{
 assert.deepEqual(drawingEditCommand('Extend selected AI FVG by 3 candles'),{kind:'EXTEND',target:'rectangle',selected:true,bars:3});
 assert.deepEqual(drawingEditCommand('Shorten AI fair value gap by 2 candles'),{kind:'SHORTEN',target:'rectangle',selected:false,bars:2});
 assert.deepEqual(drawingEditCommand('Extend selected FVG to latest closed candle'),{kind:'EXTEND_TO_CLOSE',target:'rectangle',selected:true});
 assert.deepEqual(drawingEditCommand('Move selected liquidity line to 1.2345'),{kind:'MOVE',target:'hline',selected:true,price:1.2345});
 for(const q of ['Extend FVG','Extend FVG by 0 candles','Extend FVG by 100 candles','Move liquidity line to -1','Move liquidity line to 1e9','Move liquidity line to 0','Move liquidity line to 1.25 and buy BTC','"Shorten FVG by 2 candles"','Shorten FVG by 2 candles?','Move liquidity line to 1.25 on BTCUSD','Delete the FVG'])assert.equal(drawingEditCommand(q),null,q);
});

test('appearance grammar is narrow, validates color and ranges and supports explicit selection',()=>{
 assert.deepEqual(drawingEditCommand('Change selected drawing to blue'),{kind:'COLOR',target:null,selected:true,color:'#2962FF'});
 assert.deepEqual(drawingEditCommand('Set AI FVG color to #12aBcD'),{kind:'COLOR',target:'rectangle',selected:false,color:'#12ABCD'});
 assert.equal(drawingEditCommand('Make selected liquidity line dashed').dash,'dashed');
 assert.equal(drawingEditCommand('Set AI FVG width to 3px').width,3);
 assert.equal(drawingEditCommand('Set AI FVG opacity to 60%').opacity,.6);
 assert.equal(drawingEditCommand('Label AI FVG as "Demand zone"').text,'Demand zone');
 assert.equal(drawingEditCommand('Clear label on AI FVG').text,'');
 assert.equal(drawingEditCommand('Hide AI FVG').kind,'HIDE');
 assert.equal(drawingEditCommand('Show AI FVG').kind,'SHOW');
 assert.equal(drawingEditCommand('Show AI FVG on all timeframes').visibility,'all');
 for(const q of ['Set AI FVG color to #fff','Set AI FVG width to 10px','Set AI FVG opacity to 0%','Label AI FVG as "<script>"','Change drawing to blue','Hide AI FVG and delete everything','Show AI FVG on BTCUSD'])assert.equal(drawingEditCommand(q),null,q);
});
