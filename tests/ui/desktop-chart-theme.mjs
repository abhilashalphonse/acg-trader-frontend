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
  const sessionButton=chart.locator('[data-acg-chart-session-button]').first();
  await sessionButton.waitFor({state:'visible'});
  await sessionButton.click();
  const sessionPopover=page.getByRole('dialog',{name:'Market session details'});
  await sessionPopover.waitFor({state:'visible'});
  assert.equal(await sessionPopover.getByText('Session timezone').count(),1,
    'Session details identify their exchange timezone');
  assert.equal(await sessionPopover.getByText('Trading schedule').count(),1,
    'Instrument session timeline and hours are present');
  await page.keyboard.press('Escape');
  await sessionPopover.waitFor({state:'hidden'});
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
  const symbolRow=chart.locator('[data-testid="chart-symbol-row"]');
  await symbolRow.waitFor({state:'visible'});
  assert.equal(await symbolRow.locator('[data-testid="chart-symbol"]').evaluate(el=>getComputedStyle(el).color),
    'rgb(0, 0, 0)', 'Symbol remains bold and black');
  assert.equal(await symbolRow.locator('[data-testid="chart-timeframe"]').evaluate(el=>getComputedStyle(el).color),
    'rgb(107, 114, 128)', 'Timeframe metadata should recede behind the symbol');
  assert.equal(await ohlc.locator('[data-testid="chart-ohlc-label-O"]').evaluate(el=>getComputedStyle(el).color),
    'rgb(138, 146, 156)', 'OHLC labels should be muted rather than black');
  assert.equal(await ohlc.locator('[data-testid="chart-ohlc-value-O"]').evaluate(el=>getComputedStyle(el).color),
    'rgb(0, 0, 0)', 'OHLC values should retain high contrast');
  // This synthetic fixture can intentionally have no completed OHLC bar.
  // Candle-change text is shown only for a valid open/close; when present,
  // it must use the restrained semantic light-mode palette.
  const change=ohlc.locator('[data-testid="chart-ohlc-change"]');
  if (await change.count()) {
    assert.ok(['rgb(21, 122, 90)', 'rgb(191, 62, 75)', 'rgb(107, 114, 128)'].includes(
      await change.evaluate(el=>getComputedStyle(el).color)
    ), 'Candle move should use an understated semantic color');
  }
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('acg-trader-desktop-chart-settings-v1')||'{}').theme==='light');
  assert.equal(await theme.getByRole('button',{name:'Light'}).getAttribute('aria-pressed'),'true');
  // The chart candle swatches must open the same portal palette as drawings.
  await page.getByRole('button',{name:'Bullish body color'}).click();
  const candlePalette=page.getByRole('dialog',{name:'Bullish body color palette'});
  await candlePalette.waitFor({state:'visible'});
  await candlePalette.getByRole('button',{name:'Select #FFFFFF'}).click();
  await candlePalette.getByRole('slider',{name:'Bullish body color opacity'}).fill('40');
  await page.waitForFunction(()=>{
    const candle=JSON.parse(localStorage.getItem('acg-trader-desktop-chart-settings-v1')||'{}').candle||{};
    return candle.upBody==='#FFFFFF' && candle.upBodyOpacity===0.4;
  });
  assert.equal(await page.getByRole('dialog',{name:'Chart appearance settings'}).count(),1,
    'Adjusting the palette must not close chart settings');
  await page.getByRole('button',{name:'Bullish body color'}).click();
  assert.equal(await page.locator('.v4-execution-footer').count()>0,true,
    'Trading controls remain rendered alongside light chart');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-acg-chart-theme="light"]').first().waitFor({state:'visible',timeout:20000});
  await page.getByRole('button',{name:'Chart appearance settings'}).click();
  assert.equal(await page.getByRole('button',{name:'Bullish body color'}).getAttribute('aria-expanded'),'false');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('acg-trader-desktop-chart-settings-v1')||'{}'));
  assert.equal(stored.candle.upBody,'#FFFFFF','Candle palette color persists after reload');
  assert.equal(stored.candle.upBodyOpacity,0.4,'Candle opacity persists after reload');
  await page.getByRole('group',{name:'Chart canvas theme'}).getByRole('button',{name:'Dark'}).click();
  await page.locator('[data-acg-chart-theme="dark"]').first().waitFor({state:'visible'});
  assert.equal(await page.locator('[data-testid="chart-symbol-row"]').count()>=1,true,
    'Both themes render the same compact chart instrument header');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('acg-trader-desktop-chart-settings-v1')||'{}').theme==='dark');
  assert.deepEqual(errors,[],'Theme switching does not cause a runtime crash');
  console.log('DESKTOP_CHART_THEME_PASS');
}finally{await browser.close();}
