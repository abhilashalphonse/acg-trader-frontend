import process from 'node:process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.V4_DRAWING_PICKER_URL || 'http://127.0.0.1:5174/tests/fixtures/v4-drawing-palette.html';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1000,height:700}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const style=()=>page.locator('[data-testid="drawing-style"]').textContent().then(JSON.parse);
try {
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const toolbar=page.locator('[data-v4-floating-drawing-editor]');
  await toolbar.waitFor({state:'visible'});
  assert.equal((await style()).width,1);
  assert.equal((await style()).color,'#AEB6C2');
  await toolbar.getByRole('button',{name:'Drawing color'}).click();
  const dialog=page.getByRole('dialog',{name:'Drawing color palette'});
  await dialog.waitFor({state:'visible'});
  assert.equal(await dialog.locator('.acg-drawing-color-swatch').count(),99);
  assert.equal(await dialog.locator('.acg-drawing-color-swatch[aria-pressed=true]').count(),1);
  const toolbarBox=await toolbar.boundingBox();
  const panelBox=await dialog.boundingBox();
  assert.ok(panelBox.y>=toolbarBox.y && panelBox.x>=0,'Palette must render above chart, outside clipped toolbar');

  await dialog.getByRole('button',{name:'Select #E1E4E7'}).click();
  assert.equal((await style()).color,'#E1E4E7');
  assert.equal((await style()).width,1,'Changing color must never change line width');
  const slider=dialog.getByRole('slider',{name:'Drawing opacity'});
  await slider.focus();
  await slider.press('Home');
  for(let i=0;i<30;i++)await slider.press('ArrowRight');
  assert.equal((await style()).opacity,0.3);

  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Use risk drawing'}).click();
  await toolbar.getByRole('button',{name:'Drawing color'}).click();
  await dialog.getByRole('button',{name:'Select #ECEEEF'}).click();
  assert.equal((await style()).type,'long-position');
  assert.equal((await style()).color,'#ECEEEF','Risk entry uses shared palette');
  await page.keyboard.press('Escape');

  await page.getByRole('button',{name:'Use text drawing'}).click();
  await toolbar.getByRole('button',{name:'Drawing color'}).click();
  await dialog.getByRole('button',{name:'Select #FFFFFF'}).click();
  assert.equal((await style()).type,'text');
  assert.equal((await style()).color,'#FFFFFF','Text annotation uses shared palette');
  assert.deepEqual(errors,[],'No browser JavaScript exceptions');
  console.log('ACG_DRAWING_V4_PALETTE_PASS');
} finally { await browser.close(); }
