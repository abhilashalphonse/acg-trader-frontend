import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Full terminal on isolated synthetic account data, without trading commands.
const base='http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const chart=page.locator('[data-acg-chart-theme]').first();
  await chart.waitFor({state:'visible',timeout:20000});
  assert.equal(await page.locator('.acg-mobile-history-controls').count(),0,
    'Floating Undo/Redo widget must not appear on the desktop chart');
  assert.equal(await page.locator('[title="Reset chart view"]').count(),0,
    'Floating reset icon must not appear over the chart');
  assert.equal(await page.locator('[title="Fit chart"]').count(),0,
    'Floating fit icon must not appear over the chart');
  assert.equal(await chart.getAttribute('data-acg-chart-theme'),'dark',
    'Existing users default to the approved dark chart');
  await page.getByRole('button',{name:'Trade',exact:true}).click();
  const settingsButton=page.getByRole('button',{name:'Chart appearance settings'});
  await settingsButton.click();
  const theme=page.getByRole('group',{name:'Chart canvas theme'});
  await theme.getByRole('button',{name:'Light'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-acg-chart-theme]')?.getAttribute('data-acg-chart-theme')==='light');
  assert.equal(await chart.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(250, 251, 252)',
    'Light canvas uses soft premium white instead of stark browser white');
  const ohlc=chart.locator('[data-testid="chart-ohlc"]');
  await ohlc.waitFor({state:'visible'});
  assert.equal(await ohlc.evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 0)',
    'Light-mode OHLC labels use true black');
  assert.equal(await ohlc.locator('b').first().evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 0)',
    'Light-mode OHLC values use true black');
  assert.equal(await chart.locator('[data-chart-instrument-info] > div').first()
    .evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 0)',
    'Light-mode instrument heading uses true black');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('acg-trader-desktop-chart-settings-v1')||'{}').theme==='light');
  assert.equal(await theme.getByRole('button',{name:'Light'}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.v4-execution-footer').count()>0,true,
    'Trading controls remain rendered alongside light chart');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-acg-chart-theme="light"]').first().waitFor({state:'visible',timeout:20000});
  await page.getByRole('button',{name:'Chart appearance settings'}).click();
  await page.getByRole('group',{name:'Chart canvas theme'}).getByRole('button',{name:'Dark'}).click();
  await page.locator('[data-acg-chart-theme="dark"]').first().waitFor({state:'visible'});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('acg-trader-desktop-chart-settings-v1')||'{}').theme==='dark');
  assert.deepEqual(errors,[],'Theme switching does not cause a runtime crash');
  console.log('DESKTOP_CHART_THEME_PASS');
}finally{await browser.close();}
