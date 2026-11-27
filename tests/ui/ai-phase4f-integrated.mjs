import assert from 'node:assert/strict';
import {chromium} from 'playwright';
let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>16000)throw Error('Invalid fixture input');}
const {root,authority,token,foreignToken}=JSON.parse(raw);
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(root)||typeof token!=='string'||typeof foreignToken!=='string')throw Error('Isolated fixture required');
const base='http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
let calls=0;
async function pageFor(mobile,credential=token){
  const page=await browser.newPage({viewport:mobile?{width:393,height:852}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
  await page.addInitScript(a=>{window.__phase4fAuthority=a;},authority);
  await page.route('**/v1/ai/chat/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    assert.match(path,/^\/v1\/ai\/chat\/(?:capabilities|preflight|conversations\/(?:create|list|history|append|cancel|delete))$/);
    assert.equal(route.request().method(),'POST');
    const body=route.request().postData();calls++;
    const response=await fetch(root+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body,redirect:'error'});
    await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
  });
  await page.goto(base+'/ai-phase4f-audit.html'+(mobile?'?mobile=1':''));
  await page.locator('[data-ai-chat-preview]').waitFor();
  return page;
}
try{
  const desktop=await pageFor(false);
  const panel=desktop.locator('[data-ai-chat-preview]');
  const draft=panel.getByRole('textbox',{name:'Message ACG AI'});
  await draft.fill('Phase 4F isolated browser message');
  await panel.getByRole('button',{name:'Store offline message'}).click();
  await panel.getByText('Phase 4F isolated browser message',{exact:true}).waitFor();
  const item=panel.getByRole('button',{name:/Conversation .* · 1 messages/});
  // The fixture owner may already have another conversation; choose the newly created
  // conversation via the unique persisted message and explicit list ordering.
  const label=await item.first().textContent();
  await desktop.close();
  const mobile=await pageFor(true);
  const mp=mobile.locator('[data-ai-chat-preview]');
  await mp.getByRole('button',{name:label,exact:true}).click();
  await mp.getByText('Phase 4F isolated browser message',{exact:true}).waitFor();
  await mp.getByRole('button',{name:'Cancel message'}).click();
  await mp.getByText('Cancelled',{exact:true}).waitFor();
  await mp.getByRole('button',{name:'Delete conversation'}).click();
  await mp.getByText('Phase 4F isolated browser message',{exact:true}).waitFor({state:'detached'});
  await mp.getByRole('button',{name:label,exact:true}).waitFor({state:'detached'});
  await mobile.close();
  const denied=await pageFor(false,foreignToken);
  await denied.getByRole('alert').waitFor();
  assert.equal(await denied.getByRole('button',{name:'Store offline message'}).isDisabled(),true);
  await denied.close();
  assert.ok(calls>=10);
  console.log('PASS Phase 4F native desktop/mobile browser via actual authenticated loopback API: create, append, persisted history, cancel, delete, foreign-session rejection');
}finally{await browser.close();}
