import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_DRAWING_COLOR, DEFAULT_DRAWING_STYLE, DEFAULT_DRAWING_WIDTH,
  DRAWING_PALETTE_ROWS, drawingStrokeWidth, drawingOpacity,
} from '../src/utils/drawingAppearance.js';
import {normalizeDrawing, patchDrawing, commitDrawings, getDrawingSnapshot} from '../src/utils/drawingStore.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const draw=(type,id='one',style)=>({
  id,type,a:{time:100,price:100},b:{time:120,price:110},
  ...(style ? {style}:{}),
});

test('every new drawing type shares light grey actual 1px defaults, not blue/1.5px',()=>{
  assert.equal(DEFAULT_DRAWING_COLOR,'#AEB6C2');
  assert.equal(DEFAULT_DRAWING_WIDTH,1);
  assert.equal(DEFAULT_DRAWING_STYLE.opacity,1);
  for(const type of ['trendline','ray','extended-line','hline','horizontal-ray','vline',
    'ruler','fibonacci','rectangle','text','long-position','short-position']) {
    const result=normalizeDrawing(draw(type,type));
    assert.equal(result.style.color,DEFAULT_DRAWING_COLOR,type);
    assert.equal(result.style.width,1,type);
    assert.equal(result.style.opacity,1,type);
  }
});

test('existing styles survive normalization, color changes and undo history',()=>{
  const original=normalizeDrawing(draw('trendline','existing',{color:'#195be1',width:1.5,opacity:0.33}));
  assert.equal(original.style.color,'#195be1');
  assert.equal(original.style.width,1.5);
  assert.equal(original.style.opacity,0.33);
  const symbol='DRAWING_PALETTE_PRESERVATION_TEST';
  commitDrawings(symbol,[original]);
  patchDrawing(symbol,'existing',{style:{color:'#E5E5E5',opacity:0.42}});
  const changed=getDrawingSnapshot(symbol).present[0].style;
  assert.equal(changed.color,'#E5E5E5');
  assert.equal(changed.opacity,0.42);
  assert.equal(changed.width,1.5,'color selection must not change saved width');
});

test('1px selected drawings stay 1px; opacity uses proper SVG stroke opacity',()=>{
  assert.equal(drawingStrokeWidth(DEFAULT_DRAWING_STYLE),1);
  assert.equal(drawingStrokeWidth({width:1.5}),1.5);
  assert.equal(drawingStrokeWidth({width:3}),3);
  assert.equal(drawingOpacity({opacity:0}),0);
  assert.equal(drawingOpacity({opacity:0.25}),0.25);
  assert.equal(drawingOpacity({opacity:5}),1);
  assert.equal(drawingOpacity({opacity:null}),1);
  const layer=source('src/components/trading-v2/DrawingLayer.jsx');
  assert.match(layer,/strokeWidth: drawingStrokeWidth\(style\)/);
  assert.match(layer,/strokeOpacity: drawingOpacity\(style\)/);
  assert.doesNotMatch(layer,/Math\.max\(2, \(Number\(style\.width\)/);
  assert.doesNotMatch(layer,/Math\.max\(1\.5, Number\(style\.width\)/);
  assert.match(layer,/strokeWidth=\{drawingStrokeWidth\(style\)\}/);
  assert.match(layer,/const widths = \[1, 2, 3, 4\]/);
});

test('palette has accessible neutral and colored swatches and shared editors',()=>{
  assert.equal(DRAWING_PALETTE_ROWS.length,9);
  assert.equal(DRAWING_PALETTE_ROWS[0].length,11);
  for(const row of DRAWING_PALETTE_ROWS) {
    assert.equal(row.length,11);
    for(const color of row) assert.match(color,/^#[A-F0-9]{6}$/);
  }
  const picker=source('src/components/trading-v2/DrawingColorPicker.jsx');
  assert.match(picker,/role="dialog" aria-label="Drawing color palette"/);
  assert.match(picker,/aria-label="Drawing opacity"/);
  assert.match(picker,/createPortal/);
  assert.match(source('src/components/trading-v2/v4/V4DrawingEditor.jsx'),/DrawingColorPicker/);
  assert.match(source('src/components/trading-v2/ChartToolControls.jsx'),/drawing \? <div className="acg-tool-colors">/);
  assert.match(source('src/components/trading-v2/DrawingProperties.jsx'),/Entry color and opacity/);
});
