import process from 'node:process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin=process.env.RISK_DRAWING_URL ||
  'http://127.0.0.1:5174/tests/fixtures/risk-position-drawing.html';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1200,height:750},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));

const shape=page.getByTestId('risk-position-drawing');
const label=name=>page.getByTestId(name);
const assertFits=async name=>{
  const chart=await page.getByTestId('risk-chart-fixture').boundingBox();
  const tag=await label(name).boundingBox();
  assert.ok(tag && chart,`${name} should be rendered`);
  assert.ok(tag.x>=chart.x-1,`${name} left edge should fit`);
  assert.ok(tag.x+tag.width<=chart.x+chart.width+1,`${name} right edge should fit`);
  assert.ok(tag.y>=chart.y-1,`${name} top edge should fit`);
  assert.ok(tag.y+tag.height<=chart.y+chart.height+1,`${name} bottom edge should fit`);
};
try {
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await shape.waitFor({state:'visible'});
  assert.equal(await shape.getAttribute('data-position-side'),'long');
  assert.equal(await shape.getAttribute('data-selected'),'true');
  assert.match(await label('position-target-label').textContent(),/Target/);
  assert.match(await label('position-stop-label').textContent(),/Stop/);
  assert.match(await label('position-risk-summary').textContent(),/R:R 2\.00/);
  assert.match(await label('position-risk-summary').textContent(),/Risk 0\.50%/);
  assert.equal(await shape.locator('rect[fill="rgba(6,9,11,0.94)"]').count(),0,
    'Never draw old oversized black info card');
  assert.equal(await shape.getByTestId('position-handle-entry').count(),1);
  assert.equal(await shape.getByTestId('position-handle-stop').count(),1);
  assert.equal(await shape.getByTestId('position-handle-target').count(),1);
  await shape.getByTestId('position-handle-target').locator('circle').dispatchEvent('pointerdown',{button:0});
  assert.equal(await label('last-handle').textContent(),'riskTarget');
  await assertFits('position-target-label');
  await assertFits('position-stop-label');
  await assertFits('position-risk-summary');

  await page.getByRole('button',{name:'Toggle selection'}).click();
  assert.equal(await shape.getAttribute('data-selected'),'false');
  assert.equal(await label('position-risk-summary').count(),0,
    'Deselected drawing must be clean rather than cluttered');
  assert.equal(await label('position-target-price').count(),1);
  assert.equal(await label('position-stop-price').count(),1);
  assert.equal(await label('position-entry-price').count(),1);
  assert.equal(await shape.getByTestId('position-handle-entry').count(),0);

  await page.getByRole('button',{name:'Short drawing'}).click();
  assert.equal(await shape.getAttribute('data-position-side'),'short');
  assert.equal(await label('position-target-price').count(),1);
  assert.equal(await label('position-stop-price').count(),1);
  const target=await label('risk-reward-zone').boundingBox();
  const stop=await label('risk-stop-zone').boundingBox();
  assert.ok(target.y>stop.y,'SHORT reward must be below entry and stop above');
  await page.getByRole('button',{name:'Toggle selection'}).click();
  assert.match(await label('position-target-label').textContent(),/Target/);
  assert.match(await label('position-stop-label').textContent(),/Stop/);

  await page.getByRole('button',{name:'Toggle narrow chart'}).click();
  for(const n of ['position-target-label','position-stop-label','position-risk-summary','position-entry-label'])
    await assertFits(n);
  await page.getByRole('button',{name:'Toggle theme'}).click();
  assert.equal(await page.getByTestId('risk-chart-fixture').evaluate(el=>getComputedStyle(el).backgroundColor),
    'rgb(9, 9, 11)');
  assert.deepEqual(errors,[],'No browser errors or exception during position changes');
  console.log('ACG_LONG_SHORT_DRAWING_ACCEPTANCE_PASS');
} finally {
  await browser.close();
}
