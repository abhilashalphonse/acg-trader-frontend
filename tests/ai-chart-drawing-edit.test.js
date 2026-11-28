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
