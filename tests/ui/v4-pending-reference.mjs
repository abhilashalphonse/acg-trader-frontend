import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(a,label)=>{assert.ok(a,label);checks++;};
try{
  await page.addInitScript(()=>{
    window.localStorage.setItem('acg-trader-desktop-layout-v2',JSON.stringify({
      dockHeight:320,sidebarCollapsed:false,dockCollapsed:false,sidebarWidth:360
    }));
    window.localStorage.removeItem('acg-v4-pending-view-v1');
  });
  const response=await page.goto('http://127.0.0.1:5174/v4-positions-audit.html?acg_v4_audit=1',{waitUntil:'domcontentloaded'});
  eq(response?.status(),200,'Full-terminal pending fixture loads');
  await page.locator('[data-v4-positions="true"]').getByRole('button',{name:/Pending/}).click();
  const pending=page.locator('[data-v4-pending="true"]');
  await pending.waitFor({state:'visible'});
  eq(await pending.getAttribute('data-v4-pending-view'),'compact','Pending starts Compact');
  const rows=()=>pending.locator('tr[data-v4-pending-id]');
  eq(await rows().count(),1,'One confirmed pending fixture');
  eq(await pending.locator('thead th').allTextContents(),
    ['Instrument','Type','Size','Trigger / Limit','Status','Actions'],'Compact pending headings');
  ok((await rows().first().innerText()).includes('STOP LIMIT'),'Order type not mislabeled');
  ok((await rows().first().innerText()).includes('1.11980'),'Stop-Limit has actual limit price');
  const header=pending.locator('.v4-positions-header');
  eq(await header.evaluate(el=>el.getBoundingClientRect().height),48,'Header matches approved 48px');
  await rows().first().click();
  eq(await rows().first().getAttribute('aria-selected'),'true','Row inspection highlights pending');
  eq(await page.locator('[data-v4-manage-pending]').count(),0,'Clicking pending row never opens right side management');
  await rows().first().getByRole('button',{name:'Expand order details for EUR/USD'}).click();
  const details=pending.locator('[data-v4-pending-detail="pending-eur-1"]');
  eq(await details.count(),1,'Inline pending details');
  const detailText=await details.innerText();
  ok(detailText.includes('Order setup'),'Expanded order setup section');
  ok(detailText.includes('Projected exposure & risk'),'Expanded projected risk section');
  ok(detailText.includes('Order activity'),'Expanded activity section');
  ok(detailText.includes('Order recorded'),'Creation only from real timestamp');
  await rows().first().getByRole('button',{name:'Collapse order details for EUR/USD'}).click();
  await pending.getByRole('button',{name:'Risk',exact:true}).click();
  eq(await pending.locator('thead th').allTextContents(),
    ['Instrument','Projected exposure','Est. margin','Stop loss','Take profit','Est. risk','Status'],'Risk pending headings');
  const riskText=await rows().first().innerText();
  ok(riskText.includes('$3,360.00'),'Projected USD notional shows estimate not stored exposure');
  ok(riskText.includes('$15.00'),'Risk at stop uses quote-safe projected outcome');
  eq(await page.locator('[data-v4-manage-pending]').count(),0,'Risk switch does not open management');
  await pending.getByRole('button',{name:'Execution',exact:true}).click();
  eq(await pending.locator('thead th').allTextContents(),
    ['Instrument','Type','Trigger','Limit','Created','Expires','Order ID'],'Execution pending headings');
  ok((await rows().first().innerText()).includes('13 Oct 2026'),'Actual creation timestamp');
  ok((await rows().first().innerText()).includes('GTC'),'Correct time in force');
  await pending.getByRole('button',{name:'Compact',exact:true}).click();
  await rows().first().getByRole('button',{name:'Review cancel for EUR/USD'}).click();
  eq(await page.locator('[data-v4-manage-pending="pending-eur-1"]').count(),1,'Explicit cancel review opens existing Pending Manager');
  eq(await page.locator('[data-v4-manage-pending="pending-eur-1"]').getByRole('dialog',{name:'Confirm order cancellation'}).count(),1,'Pending cancel opens established confirmation, not direct execution');
  const narrowBefore=await pending.locator('.v4-positions-scroller').evaluate(el=>el.scrollWidth);
  await page.setViewportSize({width:768,height:850});
  await pending.getByRole('button',{name:'Risk',exact:true}).click();
  const sizes=await pending.locator('.v4-positions-scroller').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
  ok(sizes.scroll>sizes.width,'Narrow Pending Risk scrolls horizontally');
  ok(narrowBefore>0,'Dock table scroll region exists');
  console.log('V4_PENDING_REFERENCE_PASS',JSON.stringify({checks,sizes}));
}catch(error){console.error('V4_PENDING_REFERENCE_FAIL',error);throw error;}
finally{await browser.close();}
