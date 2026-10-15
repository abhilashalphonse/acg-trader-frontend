import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ui = 'http://127.0.0.1:5174/';
const api = 'http://127.0.0.1:4000';
if (process.env.CI !== 'true' || process.env.PR72_E2E_DISPOSABLE !== '1'
  || !process.env.PR72_E2E_PRIVATE_DATA || !process.env.PR72_E2E_REPORT) {
  throw Error('PR72 browser acceptance is restricted to disposable CI.');
}
const privateData = JSON.parse(fs.readFileSync(process.env.PR72_E2E_PRIVATE_DATA, 'utf8'));
const checks = [];
const record = name => checks.push(name);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
const report = { outcome:'FAIL', checks:[], browser:'Chrome', authPaths:[], providerLive:false,
  credentialPersistence:false, frontendSha:process.env.PR72_FRONTEND_SHA,
  backendSha:process.env.PR72_BACKEND_SHA, blockedReason:null };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function requestJson(request, method, path, token, data, accepted=[200,201]) {
  const response = await request.fetch(api + path, {
    method, headers: { Authorization:'Bearer ' + token }, data,
    timeout: 12000, failOnStatusCode: false,
  });
  if (!accepted.includes(response.status())) {
    const value = await response.json().catch(()=>({}));
    throw Error(method + ' ' + path.replace(/\/[0-9a-f]{24}/ig,'/:id')
      + ' unexpected HTTP ' + response.status() + ' (' + (value.error?.code||'UNKNOWN') + ')');
  }
  return { response, value:await response.json() };
}
async function control(request, action, payload={}) {
  const response = await request.post(api + '/__pr72_ci/' + action, {
    headers: { 'x-pr72-ci-control':privateData.controlToken }, data:payload, timeout:10000,
  });
  if (!response.ok()) throw Error('Disposable control failed: ' + action + ' HTTP '+response.status());
  return response.json();
}
async function quote(request, symbol) {
  const response = await request.get(api+'/v1/market/quotes?symbols='+symbol, {timeout:10000});
  if (!response.ok()) throw Error('Provider quote request failed HTTP '+response.status());
  const body=await response.json();
  return body.quotes?.find(q=>q.symbol===symbol)||null;
}
async function freshQuote(request, symbol, timeout=60000) {
  const until=Date.now()+timeout;
  while(Date.now()<until) {
    const q=await quote(request,symbol);
    if(q&&q.isStale!==true&&Number(q.ask)>=Number(q.bid)&&Number(q.bid)>0
      &&Date.now()-Number(q.receivedAtMs)<6000&&Date.now()-Number(q.receivedAtMs)>=-10000
      &&/twelve-data/i.test(String(q.source))) return q;
    await delay(1500);
  }
  throw Error('BLOCKED: real provider quote unavailable or too old for '+symbol);
}
async function finishFailure(e) {
  report.outcome='FAIL';
  report.blockedReason=String(e.message||e)
    .replace(/ticket=[^&\s]+/ig,'ticket=[REDACTED]')
    .replace(/Bearer\s+[^\s'"]+/ig,'Bearer [REDACTED]')
    .replace(/\b[0-9a-f]{24}\b/ig,':id')
    .slice(0,240);
  report.checks=checks;
  fs.writeFileSync(process.env.PR72_E2E_REPORT,JSON.stringify(report,null,2),{mode:0o600});
  console.error('PR72_E2E_FAIL',report.blockedReason);
  process.exitCode=1;
}
try {
  const nativeContext = await browser.newContext({ viewport:{width:1440,height:900} });
  const native = await nativeContext.newPage();
  const pageErrors=[];
  native.on('pageerror',err=>pageErrors.push(err.name));
  await native.goto(ui);
  await native.getByRole('textbox',{name:'Trading Account ID'}).fill(privateData.nativeLogin);
  await native.getByLabel('Password',{exact:true}).fill(privateData.nativePassword);
  const nativeAuth = native.waitForResponse(response=>response.url().endsWith('/v1/auth/login')&&response.request().method()==='POST');
  await native.getByRole('button',{name:'Sign in'}).click();
  assert.equal((await nativeAuth).status(),200,'native session must pass actual HTTP login');
  await native.getByRole('button',{name:'Switch trading account'}).waitFor({timeout:40000});
  record('native login via actual application form');
  report.authPaths.push('native UI');
  // Browser reload must bootstrap via actual refresh cookie, not storageState.
  const refresh = native.waitForResponse(r=>r.url().endsWith('/v1/auth/refresh')&&r.request().method()==='POST');
  await native.reload();
  assert.equal((await refresh).status(),200,'cookie refresh after browser reload');
  await native.getByRole('button',{name:'Switch trading account'}).waitFor({timeout:35000});
  record('browser session refresh after reload');
  await nativeContext.close();

  const federatedContext = await browser.newContext({ viewport:{width:1440,height:900} });
  const ticket = await control(federatedContext.request, 'federation');
  const page = await federatedContext.newPage();
  page.on('pageerror',err=>pageErrors.push(err.name));
  const exchange = page.waitForResponse(r=>r.url().endsWith('/v1/auth/federated/exchange')&&r.request().method()==='POST');
  await page.goto(ui+'?ticket='+encodeURIComponent(ticket.ticket));
  const exchanged = await exchange;
  assert.equal(exchanged.status(),200,'real federation ticket exchange');
  const auth = await exchanged.json();
  const token = auth.accessToken;
  assert(typeof token==='string' && token.length>20);
  await page.getByRole('button',{name:'Switch trading account'}).waitFor({timeout:35000});
  record('federated ticket exchanged by application bootstrap');
  report.authPaths.push('federated UI');

  const active = page.locator('[data-v4-header-account-name]');
  await active.waitFor({timeout:20000});
  await page.getByRole('button',{name:'Switch trading account'}).click();
  const target = page.locator('[data-v4-header-menu="account"]').getByRole('button').filter({hasText:privateData.accountCodes.secondary});
  await target.click();
  await page.waitForFunction(code=>document.querySelector('[data-v4-header-account]')?.getAttribute('title')===code,
    privateData.accountCodes.secondary,{timeout:30000});
  record('account switching through V4 account dropdown');
  const granted=await requestJson(federatedContext.request,'GET','/v1/auth/accounts',token);
  assert(granted.value.accounts.length>=3,'federated grants include USD and EUR account');
  const acc = privateData.accounts.primary;

  const liveBtc=await freshQuote(federatedContext.request,'BTCUSD');
  const liveFx=await freshQuote(federatedContext.request,'EURUSD');
  assert(liveBtc.source&&liveFx.source);
  report.providerLive=true;
  record('real provider quote freshness for BTCUSD and EURUSD');

  // Unlike the browser-authenticated HTTP checks below, this is a true
  // execution click in the V4 ticket: no hand-written command is submitted.
  // The V4 desktop defaults to a collapsed right execution rail.
  await page.getByRole('button',{name:'Trade',exact:true}).click();
  const ticketPanel = page.getByRole('region',{name:'ACG Trader V4 live execution ticket'});
  await ticketPanel.waitFor({state:'visible',timeout:30000});
  record('V4 desktop execution available by default without audit query flag');
  const buyButton=ticketPanel.getByRole('button',{name:/^BUY\b/});
  const deadline=Date.now()+30000;
  while (!(await buyButton.isEnabled()) && Date.now()<deadline) await delay(750);
  assert(await buyButton.isEnabled(),'V4 Buy must be enabled on fresh provider quotes');
  const marketResponse=r=>r.url().endsWith('/v1/trading/orders/market')&&r.request().method()==='POST';
  const firstAttempt=page.waitForResponse(marketResponse,{timeout:5000}).catch(()=>null);
  await buyButton.click();
  let uiFilled=await firstAttempt;
  if(!uiFilled){
    // V4 sometimes requires a chart-plan review rather than one-click fill.
    // Continue through the visible confirmation action as a real user would.
    const confirmation=ticketPanel.getByRole('button',{name:/^Place BUY MARKET$/});
    const action=await confirmation.isVisible()?confirmation:buyButton;
    const secondAttempt=page.waitForResponse(marketResponse,{timeout:20000});
    await action.click();
    uiFilled=await secondAttempt;
  }
  assert.equal(uiFilled.status(),201,'V4 ticket actually submitted and filled');
  const uiPosition=(await uiFilled.json()).position;
  assert(uiPosition?.id,'V4 ticket returned an open position');
  record('V4 ticket Buy button executes through authenticated backend');
  await requestJson(federatedContext.request,'POST','/v1/trading/positions/'+uiPosition.id+'/close',token,
    {accountId:privateData.accounts.secondary,clientOrderId:'ci-ui-close'});

  const first=await requestJson(federatedContext.request,'POST','/v1/trading/orders/market',token,
    {accountId:acc,clientOrderId:'ci-market-primary',symbol:'BTCUSD',side:'BUY',volume:'0.1'});
  assert.equal(first.value.position.status,'OPEN');
  assert(Number(first.value.position.margin)>0,'positive live quote margin');
  const pid=first.value.position.id;
  record('authenticated provider-price market order and initial margin');
  // Provider quotes can have odd cents; halving one is not necessarily tick-aligned.
  // Read the actual instrument contract and round the distant BUY level down.
  const contract = await requestJson(federatedContext.request,'GET','/v1/instruments/BTCUSD',token);
  const { tickSize, digits } = contract.value.instrument;
  const tick = Number(tickSize);
  assert(tick > 0 && Number.isInteger(digits) && digits >= 0 && digits <= 12);
  const tickCount = Math.floor(Number(liveBtc.bid) * 0.5 / tick);
  assert(Number.isSafeInteger(tickCount) && tickCount > 0);
  const distantBuyPrice = (tickCount * tick).toFixed(digits);
  await requestJson(federatedContext.request,'PATCH','/v1/trading/positions/'+pid+'/protection',token,
    {accountId:acc,clientRequestId:'ci-protection-1',stopLoss:distantBuyPrice});
  record('live-position stop loss edit');
  const pending=await requestJson(federatedContext.request,'POST','/v1/trading/orders/pending',token,
    {accountId:acc,clientOrderId:'ci-pending-1',symbol:'BTCUSD',side:'BUY',type:'LIMIT',
      volume:'0.1',limitPrice:distantBuyPrice});
  assert.equal(pending.value.order.status,'PENDING');
  const oid=pending.value.order.id;
  await requestJson(federatedContext.request,'POST','/v1/trading/orders/'+oid+'/cancel',token,
    {accountId:acc,clientRequestId:'ci-cancel-1'});
  record('authenticated pending creation and cancellation');
  await requestJson(federatedContext.request,'POST','/v1/trading/positions/'+pid+'/close',token,
    {accountId:acc,clientOrderId:'ci-partial-close-1',volume:'0.05'});
  await requestJson(federatedContext.request,'POST','/v1/trading/positions/'+pid+'/close',token,
    {accountId:acc,clientOrderId:'ci-final-close-1',volume:'0.05'});
  record('partial close and full close at provider-derived executable prices');

  const euro=privateData.accounts.eur;
  const euroTrade=await requestJson(federatedContext.request,'POST','/v1/trading/orders/market',token,
    {accountId:euro,clientOrderId:'ci-eur-cross',symbol:'BTCUSD',side:'BUY',volume:'0.1'});
  assert(Number(euroTrade.value.position.margin)>0,'EUR account margin');
  record('cross-currency EUR account trade with live EURUSD conversion');
  // Keep an open cross-currency position while interrupting its FX converter.
  // This must not present cached equity as a valid live account metric.
  await page.getByRole('button',{name:'Switch trading account'}).click();
  await page.locator('[data-v4-header-menu="account"]').getByRole('button')
    .filter({hasText:privateData.accountCodes.eur}).click();
  await page.waitForFunction(code=>document.querySelector('[data-v4-header-account]')?.getAttribute('title')===code,
    privateData.accountCodes.eur,{timeout:30000});
  const equityInDock = () => page.locator('[aria-label="Account trading metrics"] .v4-positions-metric')
    .filter({hasText:'Equity'}).locator('strong');
  await equityInDock().waitFor({state:'visible',timeout:30000});
  await page.waitForFunction(() => {
    const row=[...document.querySelectorAll('[aria-label="Account trading metrics"] .v4-positions-metric')]
      .find(el=>el.querySelector('span')?.textContent==='Equity');
    const displayed=row?.querySelector('strong')?.textContent;
    return displayed && displayed!=='—';
  },null,{timeout:25000});
  await control(federatedContext.request,'outage',{symbol:'EURUSD'});
  await page.waitForFunction(() => {
    const row=[...document.querySelectorAll('[aria-label="Account trading metrics"] .v4-positions-metric')]
      .find(el=>el.querySelector('span')?.textContent==='Equity');
    return row?.querySelector('strong')?.textContent==='—';
  },null,{timeout:15000});
  record('frontend hides unverified cross-currency equity on controlled feed outage');
  const afterOutage=await requestJson(federatedContext.request,'POST','/v1/trading/orders/market',token,
    {accountId:euro,clientOrderId:'ci-eur-fx-outage',symbol:'BTCUSD',side:'BUY',volume:'0.1'},[409,422,503]);
  assert.notEqual(afterOutage.value?.position?.status,'OPEN','stale FX must not execute');
  record('isolated FX delivery interruption blocks exposure');
  await control(federatedContext.request,'recover',{symbol:'EURUSD'});
  await freshQuote(federatedContext.request,'EURUSD');
  await page.waitForFunction(() => {
    const row=[...document.querySelectorAll('[aria-label="Account trading metrics"] .v4-positions-metric')]
      .find(el=>el.querySelector('span')?.textContent==='Equity');
    const display=row?.querySelector('strong')?.textContent;
    return display && display!=='—';
  },null,{timeout:30000});
  record('frontend restores verified equity only after provider recovery');
  await requestJson(federatedContext.request,'POST','/v1/trading/positions/'+euroTrade.value.position.id+'/close',token,
    {accountId:euro,clientOrderId:'ci-eur-close'});
  const resumed=await requestJson(federatedContext.request,'POST','/v1/trading/orders/market',token,
    {accountId:euro,clientOrderId:'ci-eur-fx-recovered',symbol:'BTCUSD',side:'BUY',volume:'0.1'});
  assert.equal(resumed.value.position.status,'OPEN');
  await requestJson(federatedContext.request,'POST','/v1/trading/positions/'+resumed.value.position.id+'/close',token,
    {accountId:euro,clientOrderId:'ci-eur-fx-recovered-close'});
  record('real FX quote recovery restores trading');
  const value=await requestJson(federatedContext.request,'GET','/v1/trading/accounts/'+euro+'/valuation',token);
  assert.equal(value.value.valuationStatus,'LIVE');
  assert(Number(value.value.equity)>0);
  record('authenticated live valuation after all positions closed');
  assert.equal(pageErrors.length,0,'no uncaught browser exceptions');
  record('browser runtime without uncaught errors');
  await federatedContext.close();
  report.outcome='PASS';report.checks=checks;
  fs.writeFileSync(process.env.PR72_E2E_REPORT,JSON.stringify(report,null,2),{mode:0o600});
  console.log('PR72_E2E_PASS',JSON.stringify({checks:checks.length,
    backendSha:report.backendSha,frontendSha:report.frontendSha,providerLive:true}));
} catch(error) {
  await finishFailure(error);
} finally {
  await browser.close();
}
