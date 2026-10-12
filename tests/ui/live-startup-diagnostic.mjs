// Anonymous, read-only live-site bootstrap smoke. Never attach a federation ticket
// or submit credentials/trading commands. This diagnoses the deployed HTML/JS.
import { createRequire } from 'node:module';
import process from 'node:process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const origin='https://acg-trader.web.app/';
const errors=[],failed=[],httpFailures=[];
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',err=>errors.push(String(err.message).slice(0,350)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,350));});
 page.on('requestfailed',req=>failed.push({url:new URL(req.url()).pathname,error:req.failure()?.errorText}));
 page.on('response',res=>{if(res.status()>=400)httpFailures.push({path:new URL(res.url()).pathname,status:res.status()});});
 const resp=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForTimeout(12000);
 const result=await page.evaluate(()=>({
  title:document.title,
  htmlBoot:!!document.querySelector('#root > .acg-boot'),
  loaderCount:document.querySelectorAll('[aria-label="Loading ACG Trader"]').length,
  rootChildren:document.querySelector('#root')?.children.length,
  mainScriptCount:document.querySelectorAll('script[type="module"]').length,
  bodyText:document.body?.innerText?.slice(0,180),
 }));
 console.log('LIVE_STARTUP_DIAGNOSTIC',JSON.stringify({pageStatus:resp?.status(),...result,errors,failed,httpFailures}));
 if(result.htmlBoot || result.loaderCount)process.exitCode=1;
}finally{await browser.close();}
