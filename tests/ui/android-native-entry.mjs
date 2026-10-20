// Native entry visual/interaction acceptance in real Chrome at Android-like widths.
// Uses isolated development origin. Never logs into production or creates accounts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import process from 'node:process';

const origin = 'http://127.0.0.1:4197';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4197','--strictPort'], {
  stdio:'ignore',
  env:{...process.env,VITE_ACG_NATIVE_UI_PREVIEW:'true',VITE_ACG_TRADER_API_BASE:origin,VITE_ACG_SUPABASE_AUTH_ENABLED:'false'},
});
let browser;
try {
  let up=false;
  for(let i=0;i<65;i++) {
    try {if((await fetch(origin+'/?acg_mobile_onboarding=1')).ok){up=true;break;}}
    catch {/* Vite warming up */}
    await delay(220);
  }
  assert.ok(up,'native preview server starts');
  browser=await chromium.launch({headless:true,channel:'chrome'});
  await mkdir('artifacts',{recursive:true});
  for (const [width,height] of [[360,740],[393,852],[430,932]]) {
    const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await ctx.newPage();
    await page.route('**/v1/auth/refresh',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:'TRADER_REFRESH_INVALID'})}));
    await page.goto(origin+'/?acg_mobile_onboarding=1');
    await page.getByRole('heading',{name:'Your workspace.'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Connect prop firm'}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Continue with ACG demo'}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Create a free demo'}).count(),1);
    assert.equal(await page.locator('img[src="/acg-trader-wordmark.svg"]').count(),1);
    assert.equal(await page.getByText('broker',{exact:false}).count(),0,'No brokerage advertising');
    const primaryButton = await page.getByRole('button',{name:'Connect prop firm'}).evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(primaryButton,'rgb(245, 245, 245)');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'welcome no horizontal overflow '+width);
    await page.screenshot({path:`artifacts/native-welcome-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Help',exact:true}).click();
    assert.ok(await page.getByRole('dialog',{name:'Connecting to ACG Trader'}).isVisible());
    await page.getByRole('button',{name:'Got it'}).click();
    assert.equal(await page.getByRole('dialog').count(),0);
    await page.getByRole('button',{name:'Connect prop firm'}).click();
    await page.waitForURL('**/?acg_connect_prop=1');
    await page.getByRole('heading',{name:/Welcome back/}).waitFor();
    assert.equal(await page.getByRole('textbox',{name:/Tenant ID/}).count(),1);
    assert.equal(await page.getByRole('textbox',{name:/Trading account ID/}).count(),1);
    const primary=await page.getByRole('button',{name:/Sign in to terminal/}).evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.equal(primary,'rgb(242, 242, 242)','white/silver button, never neon blue');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'trading login no overflow '+width);
    await page.screenshot({path:`artifacts/native-trading-login-${width}.png`,fullPage:true});
    await page.getByRole('link',{name:/New to ACG Trader/}).click();
    await page.waitForURL('**/?acg_auth=signup&acg_onboarding_audit=1');
    await page.getByRole('heading',{name:/Create your account/}).waitFor();
    assert.ok(await page.getByText('REGISTRATION NOT YET ENABLED').isVisible());
    assert.ok(await page.getByRole('button',{name:'Create account'}).last().isDisabled(),'signup cannot create accounts when backend disabled');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'signup no overflow '+width);
    await page.screenshot({path:`artifacts/native-signup-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('heading',{name:'Sign in.'}).waitFor();
    await page.screenshot({path:`artifacts/native-personal-signin-${width}.png`,fullPage:true});
    await page.goto(origin+'/?acg_mobile_onboarding=1');
    await page.getByRole('button',{name:'Continue with ACG demo'}).click();
    await page.waitForURL('**/?acg_auth=signin&acg_onboarding_audit=1');
    await page.goto(origin+'/?acg_mobile_onboarding=1');
    await page.getByRole('button',{name:'Create a free demo'}).click();
    await page.waitForURL('**/?acg_auth=signup&acg_onboarding_audit=1');
    assert.ok(await page.getByText('REGISTRATION NOT YET ENABLED').isVisible());
    await ctx.close();
  }
  console.log('ANDROID_NATIVE_ENTRY_BROWSER_PASS 3 widths x 4 screens, no credentials');
} finally {
  if(browser)await browser.close();
  server.kill();
}
