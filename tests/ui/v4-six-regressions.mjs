import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import process from 'node:process';
import { readFileSync } from 'node:fs';
const { chromium }=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1320,height:850}});
const errors=[];
let checks=0;
page.on('pageerror',e=>errors.push(e.message));
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const wait=()=>page.waitForTimeout(100);
const badge=id=>page.locator('[data-v4-badge="qa-account:'+id+'"]');
const accepted=id=>page.locator('[data-v4-accepted-line="qa-account:'+id+'"]');
const visual=locator=>locator.evaluate(el=>{const s=getComputedStyle(el);return {
  background:s.backgroundColor,color:s.color,height:Math.round(el.getBoundingClientRect().height),
  radius:s.borderRadius
};});
const drag=async (selector,dy)=>{
  const grip=page.locator(selector);
  await grip.scrollIntoViewIfNeeded();
  const rect=await grip.boundingBox();
  ok(Boolean(rect),'drag control must have a bounding box');
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x,y+dy,{steps:8});
  return {x,y};
};
const end=async()=>{await page.mouse.up();await wait();};
try{
 await page.goto('http://127.0.0.1:5174/v4-six-fixes-audit.html?acg_v4_audit=1',{waitUntil:'networkidle'});
 // DesktopMultiChart is the production wrapper between DesktopTerminal and
 // ChartArea. Assert the full prop chain; the isolated fixture alone missed
 // the originally reported full-terminal Sell Limit selection failure.
 // Opt-in Markets V4 exercises production component and existing watchlist callbacks.
 const markets=page.locator('#v4-markets-fixture');
 const discovery=markets.locator('[data-v4-markets-panel]');
 await discovery.waitFor();
 eq(await discovery.count(),1,'Unified V4 Markets renders only in owner-audit mode');
 eq(await markets.getByRole('heading',{name:'Markets'}).count(),1,'one compact Markets title');
 eq(await markets.getByRole('button',{name:'Favorites',exact:true}).count(),1,'Favorites star is in category row');
 eq(await markets.getByRole('button',{name:'All',exact:true}).count(),0,'All is removed from the V4 category row');
 eq(await markets.getByRole('button',{name:'Forex',exact:true}).count(),1);
 eq(await markets.getByRole('button',{name:'Commodities',exact:true}).count(),1);
 eq(await markets.getByRole('button',{name:'Stocks',exact:true}).count(),1);
 eq(await markets.getByRole('button',{name:'Crypto',exact:true}).count(),1);
 eq(await markets.getByRole('button',{name:'Indices',exact:true}).count(),0,'Indices no longer occupy category row');
 eq(await markets.getByRole('button',{name:'India',exact:true}).count(),0,'India is a Stocks subcategory, not a main tab');
 eq(await markets.getByRole('button',{name:'Watchlist',exact:true}).count(),0,'no separate Watchlist tab');
 eq(await markets.getByText('Popular markets',{exact:true}).count(),0,'repeated Popular markets section removed');
 eq(await markets.getByRole('combobox',{name:'Market sort'}).count(),0,'sort select removed from header');
 eq(await markets.getByRole('button',{name:'Search markets',exact:true}).count(),1,'search icon by close');
 eq(await markets.getByRole('button',{name:'Market options'}).count(),1,'sort moved into three-dot menu');
 ok((await markets.getByRole('button',{name:'Forex',exact:true}).evaluate(el=>getComputedStyle(el).fontFamily)).startsWith('Inter'),
   'Markets category navigation uses Inter consistently');
 ok((await markets.getByRole('button',{name:'Search markets'}).evaluate(el=>getComputedStyle(el).fontFamily)).startsWith('Inter'),
   'Markets header actions inherit V4 font');
 eq(await markets.getByRole('button',{name:'Close markets panel'}).count(),1);
 eq(await markets.getByRole('textbox',{name:'Search markets input'}).isVisible(),false,'search hidden by default');
 eq(await markets.locator('[data-market-symbol]').count(),2,'Forex is the default and never mixes asset classes');
 ok((await markets.locator('[data-market-symbol="AUDCAD"]').innerText()).includes('Spread'),
   'Forex row retains visible Spread');
 eq(await markets.locator('[data-market-symbol] .acg-v4-market-avatar').count(),2,'Every Forex row preserves its instrument icon');
 eq(await markets.locator('[data-market-symbol] button').count(),2,'Exactly one chart-navigation action per row');
 eq(await markets.locator('[data-market-symbol] [aria-label*="watchlist"]').count(),0,
    'No redundant row Favorites star; the chart-header star owns saved-state changes');
 eq(await markets.locator('[data-v4-market-header]').count(),1,'One fixed price header');
 eq(await markets.getByText('BID',{exact:true}).count(),1,'Forex opens with its own Bid header');
 eq(await markets.getByText('ASK',{exact:true}).count(),1,'Mixed-markets header labels Ask');
 eq(await markets.getByText('CHG %',{exact:true}).count(),1,'Daily change has its own column');
 const compactGeometry=async width=>{
   await markets.evaluate((el,w)=>{el.style.width=w+'px';},width);
   const geom=await markets.evaluate(el=>{
     const panel=el.querySelector('[data-v4-market-scroll]');
     const nav=el.querySelector('nav[aria-label="Asset categories"]');
     const tabs=[...nav.querySelectorAll('button')];
     const navRect=nav.getBoundingClientRect();
     const tabGeometry=tabs.map(tab=>{
       const r=tab.getBoundingClientRect();
       return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,
         label:tab.getAttribute('aria-label')||tab.textContent,visibleText:tab.scrollWidth<=tab.clientWidth+1};
     });
     const row=el.querySelector('[data-market-symbol="EURUSD"] .acg-v4-market-row');
     const bid=row.querySelector('[data-v4-bid]'),ask=row.querySelector('[data-v4-ask]'),change=row.querySelector('[data-v4-change]');
     const title=row.querySelector('.acg-v4-market-symbol'),icon=row.querySelector('.acg-v4-market-avatar');
     const header=panel.querySelector('[data-v4-market-header]');
     const headerBid=header.querySelector('.acg-v4-market-col-bid-label');
     const rect=x=>{const r=x.getBoundingClientRect();return {l:r.left,r:r.right,w:r.width,h:r.height};};
     return {width:el.clientWidth,scroll:el.scrollWidth,scrollInner:panel.scrollWidth,scrollView:panel.clientWidth,
       navScroll:nav.scrollWidth,navWidth:nav.clientWidth,nav:{left:navRect.left,right:navRect.right},
       tabs:tabGeometry,
       row:rect(row),bid:rect(bid),ask:rect(ask),change:rect(change),icon:rect(icon),title:rect(title),
       headerBid:rect(headerBid),bidText:bid.textContent,askText:ask.textContent,
       changeText:change.textContent,rowHeight:row.getBoundingClientRect().height,
       iconSize:icon.getBoundingClientRect().width,
       cssGrid:getComputedStyle(row).gridTemplateColumns,
       font:getComputedStyle(bid).fontFamily,
       priceFontWeight:getComputedStyle(bid).fontWeight,
       percentFont:getComputedStyle(change).fontFamily,
       symbolFont:getComputedStyle(title).fontFamily,
       tabular:getComputedStyle(bid).fontVariantNumeric,
     };
   });
   ok(geom.scroll<=geom.width+1,`Market panel does not overflow ${width}px dock`);
   ok(geom.navScroll<=geom.navWidth+1,`Category navigation does not scroll or clip at ${width}px`);
   eq(geom.tabs.length,5,`Favorite star plus four market categories render at ${width}px`);
   ok(geom.tabs.every(t=>t.visibleText),`All category labels fit their buttons at ${width}px`);
   ok(geom.tabs.every(t=>t.left>=geom.nav.left-1&&t.right<=geom.nav.right+1),
      `Category buttons stay fully within navigation at ${width}px`);
   ok(geom.tabs.every((t,i)=>i===0||(t.left>=geom.tabs[i-1].right+3)),
      `Category tabs maintain consistent ≥3px gaps at ${width}px`);
   ok(geom.tabs.every(t=>Math.abs((t.bottom-t.top)-32)<=1),
      `Category tabs share 32px height at ${width}px`);
   ok(geom.tabs.every(t=>Math.abs(t.top-geom.tabs[0].top)<=1),
      `Category tabs align vertically at ${width}px`);
   ok(geom.scrollInner<=geom.scrollView+1,`Market data grid does not horizontally scroll at ${width}px`);
   ok(geom.iconSize>=22&&geom.iconSize<=24,`Instrument icon remains 23px at ${width}px`);
   ok(geom.rowHeight>=60&&geom.rowHeight<=65,`Market row stays ~62px at ${width}px`);
   ok(geom.bid.l>=geom.title.r+2,`Bid does not collide with instrument at ${width}px`);
   ok(geom.ask.l>=geom.bid.r+3,`Ask column follows Bid at ${width}px`);
   ok(geom.change.l>=geom.ask.r+3,`Change column follows Ask at ${width}px`);
   ok(Math.abs(geom.headerBid.r-geom.bid.r)<=1,`Bid aligns to column header at ${width}px`);
   ok(geom.tabular.includes('tabular-nums'),`Quotes use tabular numerals at ${width}px`);
   ok(geom.font.startsWith('Inter'),`Bid/Ask use V4 Inter rather than legacy monospace at ${width}px`);
   ok(geom.percentFont.startsWith('Inter'),`Change % uses V4 Inter at ${width}px`);
   ok(geom.symbolFont.startsWith('Inter'),`Instrument labels use V4 Inter at ${width}px`);
   ok(Number(geom.priceFontWeight)>=650,`Quotes keep V4 execution emphasis at ${width}px`);
 };
 await compactGeometry(340);
 await compactGeometry(320);
 await markets.evaluate(el=>{el.style.width='340px';});
 await markets.getByRole('button',{name:'Forex',exact:true}).click();
 eq(await markets.locator('[data-market-symbol]').count(),2,'Forex filters correct symbols');
 eq(await markets.getByText('BID',{exact:true}).count(),1,'Forex category has explicit Bid header');
 eq(await markets.getByText('ASK',{exact:true}).count(),1,'Forex category has explicit Ask header');
 eq(await markets.locator('[data-market-symbol="AUDCAD"] .acg-v4-market-subtitle').innerText().then(s=>s.startsWith('Spread ')),true,
   'Forex subtitle shows spread, not duplicate currency-pair text');
 eq(await markets.locator('[data-market-symbol="AUDCAD"] [data-v4-change]').innerText(),'-0.30%',
   'Forex row shows signed daily change');
 await markets.getByRole('button',{name:'Search markets',exact:true}).click();
 eq(await markets.getByRole('textbox',{name:'Search markets input'}).isVisible(),true,'search opens only on demand');
 await markets.getByRole('textbox',{name:'Search markets input'}).fill('NIFTY');
 eq(await markets.locator('[data-market-symbol="NIFTY"]').count(),1,'Global search finds an index without All category');
 eq(await markets.locator('[data-v4-market-section="indices"]').count(),1,'Global search groups Indices in their own section');
 eq(await markets.locator('[data-v4-market-section="indices"] [data-v4-last]').count(),1,'Indices use Last Price rather than Forex quote columns');
 await markets.getByRole('textbox',{name:'Search markets input'}).fill('AUD/CAD');
 eq(await markets.locator('[data-market-symbol]').count(),1,'Search restores only matched currency pair');
 eq(await markets.locator('[data-market-symbol="AUDCAD"]').count(),1,'slash formatted cross-pair matches');
 await markets.getByRole('button',{name:'Open AUD/CAD chart'}).click();
 eq(await page.evaluate(()=>window.v4MarketsQA.selected),'AUDCAD','chart selection unchanged');
 await page.evaluate(()=>window.v4MarketsQA.setSaved(old=>[...old,'AUDCAD']));
 await page.waitForFunction(()=>window.v4MarketsQA.saved.includes('AUDCAD'));
 ok(await page.evaluate(()=>window.v4MarketsQA.saved.includes('AUDCAD')),'external chart-header favorite updates preserved in Markets');
 eq(await markets.locator('[data-market-symbol="AUDCAD"] [aria-label*="watchlist"]').count(),0,'row remains free of Favorite star');
 await markets.getByRole('button',{name:'Close search'}).click();
 eq(await markets.getByRole('textbox',{name:'Search markets input'}).isVisible(),false,'search closes after review');
 eq(await markets.locator('[data-market-symbol]').count(),2,'closing search clears hidden filter');
 await page.evaluate(()=>window.v4MarketsQA.setSaved(['EURUSD','AUDCAD','AAPL','BTCUSD','NIFTY']));
 await page.waitForFunction(()=>window.v4MarketsQA.saved.length===5);
 await markets.getByRole('button',{name:'Favorites',exact:true}).click();
 eq(await markets.locator('[data-market-symbol]').count(),5,'Favorites preserves saved instruments from multiple markets');
 eq(await markets.locator('[data-market-symbol="EURUSD"]').count(),1);
 eq(await markets.locator('[data-market-symbol="AUDCAD"]').count(),1);
 eq(await markets.locator('[data-v4-market-section="forex"]').count(),1,'Favorites includes Forex section');
 eq(await markets.locator('[data-v4-market-section="stocks"]').count(),1,'Favorites includes Stocks section');
 eq(await markets.locator('[data-v4-market-section="crypto"]').count(),1,'Favorites includes Crypto section');
 eq(await markets.locator('[data-v4-market-section="indices"]').count(),1,'Favorites includes Indices section');
 eq(await markets.locator('[data-v4-market-header]').count(),4,'Favorites has a distinct price header for each asset class');
 eq(await markets.locator('[data-v4-market-section="forex"] [data-v4-bid]').count(),2,'Forex favorites use Bid/Ask');
 eq(await markets.locator('[data-v4-market-section="stocks"] [data-v4-last]').count(),1,'Stock favorites use Last');
 eq(await markets.locator('[data-v4-market-section="indices"] [data-v4-last]').count(),1,'Index favorites use Last');
 await markets.getByRole('button',{name:'Market options'}).click();
 eq(await markets.getByRole('menu',{name:'Sort markets'}).count(),1,'three-dot sort menu opens');
 await markets.getByRole('menuitemradio',{name:'A–Z'}).click();
 eq(await markets.getByRole('menu',{name:'Sort markets'}).count(),0,'sort menu dismisses on selection');
 await markets.getByRole('button',{name:'Stocks',exact:true}).click();
 eq(await markets.getByRole('navigation',{name:'Stock markets'}).count(),1,'Stocks shows country submenu');
 eq(await markets.getByRole('button',{name:'US',exact:true}).count(),1);
 eq(await markets.getByRole('button',{name:'India',exact:true}).count(),1);
 eq(await markets.locator('[data-market-symbol="AAPL"]').count(),1,'US stocks shows US equities');
 eq(await markets.getByText('LAST',{exact:true}).count(),1,'Stocks use a single Last Price heading');
 eq(await markets.locator('[data-market-symbol="AAPL"] [data-v4-last]').count(),1,'stock row uses last price instead of fake bid and ask');
 eq(await markets.locator('[data-market-symbol="AAPL"] [data-v4-bid]').count(),0,'stock row does not manufacture bid');
 eq(await markets.locator('[data-market-symbol="AAPL"] [data-v4-change]').innerText(),'+1.25%',
   'stocks keep context-appropriate change percentage');
 eq(await markets.locator('[data-market-symbol="NIFTY"]').count(),0,'India index is not mislabeled a stock');
 ok((await markets.locator('[data-market-symbol="AAPL"]').innerText()).includes('+1.25%'),
   'equity row presentation unchanged');
 await markets.getByRole('button',{name:'India',exact:true}).click();
 eq(await markets.locator('[data-market-symbol="RELIANCE"]').count(),1,'India stocks shows Indian equities');
 eq(await markets.locator('[data-market-symbol="NIFTY"]').count(),0,'Stocks India excludes indices');
 await markets.getByRole('button',{name:'Forex',exact:true}).click();
 eq(await markets.locator('[data-market-symbol="NIFTY"]').count(),0,'Indices are not mixed into Forex rows');
 await page.evaluate(()=>window.v4MarketsQA.setMode('watchlist'));
 await page.waitForFunction(()=>document.querySelector('#v4-markets-fixture button[aria-label="Favorites"]')?.getAttribute('aria-pressed')==='true');
 eq(await markets.locator('[data-v4-markets-panel]').count(),1,'Watchlist route renders same unified Markets panel');
 eq(await markets.getByRole('button',{name:'Favorites',exact:true}).getAttribute('aria-pressed'),'true',
   'legacy Watchlist entry activates Favorites');
 eq(await markets.locator('[data-market-symbol]').count(),5,'legacy Watchlist entry preserves grouped saved symbols');
 await markets.getByRole('button',{name:'Forex',exact:true}).click();
 eq(await page.evaluate(()=>window.v4MarketsQA.mode),'markets','changing from Favorites to Forex restores Markets route');
 const marketsWidth=await markets.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
 ok(marketsWidth.scroll<=marketsWidth.client+1,'V4 Markets header and rows fit 340px dock');
 ok(!errors.length,'Markets header interactions create no JS errors');
 // All V4 Markets interactions use existing symbol/watchlist callbacks only; no orders submitted.
 const multi=readFileSync('src/components/trading-v2/desktop/DesktopMultiChart.jsx','utf8');
 const terminal=readFileSync('src/components/trading-v2/DesktopTerminal.jsx','utf8');
 const chartArea=readFileSync('src/components/trading-v2/ChartArea.jsx','utf8');
 ok(multi.includes('onSelectPending={onSelectPending}'),'DesktopMultiChart must forward pending selection to ChartArea');
 ok(multi.includes('onPendingOrderDraftChange={isActive ? onPendingOrderDraftChange'),'DesktopMultiChart must forward pending draft change');
 ok(multi.includes('pendingOrderDraft={isActive ? pendingOrderDraft : null}'),'DesktopMultiChart must forward pending draft state');
 ok(terminal.includes('onSelectPending={selectPending}'),'DesktopTerminal must connect exact pending selection');
 ok(terminal.includes("'ACCEPTED','TRIGGERED'"),'selection must recognize backend-active order statuses');
 ok(chartArea.includes('onSelectPosition={onSelectPosition} onSelectPending={onSelectPending}'),'ChartArea must forward selection to V4FullTerminalOrders');
 const entry=badge('pending:o1:entry');
 const tp=badge('pending:o1:tp');
 await entry.waitFor();
 eq(await badge('position:p1:entry').count(),0,'no second synthetic market position entry');
 eq(await page.locator('[data-v4-chart-badge]').count(),1,'original approved market badge present');
 eq(await page.locator('[data-v4-chart-badge] [data-v4-position-direction]').innerText(),'BUY');
 eq(await entry.locator('[data-v4-pending-type]').innerText(),'LIMIT');
 eq(await page.evaluate(()=>window.v4QA.orders[0].status),'ACCEPTED');
 eq(await page.evaluate(()=>window.v4QA.orders[1].status),'TRIGGERED');

 // Click selects an existing pending order; a click never arms an edit.
 await tp.locator('[data-v4-drag-handle]').click();
 await page.waitForFunction(()=>window.v4QA.selectedPendingId==='o1');
 eq(await page.locator('[data-v4-preview]').count(),0,'click does not create draft');
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'click does not create confirm buttons');
 eq(await page.locator('[data-v4-manage-pending="o1"]').count(),1,'correct Limit order is selected');
 eq(await page.locator('[data-v4-manage-position]').count(),0,'pending selection must not open position manager');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-exit-card').count(),2);
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-capsule').count(),0,
   'Pending manager does not repeat a New Order switch when Back and Close exist');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-session').count(),0,
   'Pending manager does not repeat the status row');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-quote-strip').count(),0,
   'Pending manager uses order details instead of repeating entry and status in a quote strip');
 eq(await page.locator('[data-v4-manage-pending="o1"] .v4-symbol .v4-manage-header-context').count(),1);

 // Press/release without crossing the drag threshold must preserve the order.
 const grip=tp.locator('[data-v4-drag-handle]');
 const rect=await grip.boundingBox();
 await page.mouse.move(rect.x+3,rect.y+12);
 await page.mouse.down();
 await page.mouse.move(rect.x+3,rect.y+14);
 await end();
 eq(await page.locator('[data-v4-preview]').count(),0,'2px motion is not an edit');
 eq(await page.evaluate(()=>window.v4QA.commands.length),0,'no command from click');

 // Pending TP: original full chip follows the pointer; solid accepted line stays.
 const tpOldY=await accepted('pending:o1:tp').evaluate(n=>n.style.top);
 const badgeOldY=(await tp.boundingBox()).y;
 await drag('[data-v4-drag-handle="qa-account:pending:o1:tp"]',-45);
 ok((await tp.boundingBox()).y!==badgeOldY,'accepted chip visually follows the drag');
 eq(await accepted('pending:o1:tp').evaluate(n=>n.style.top),tpOldY,'solid accepted price remains fixed');
 eq(await page.locator('[data-v4-draft-badge]').count(),0,'no second full draft chip');
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'no Confirm during drag');
 await end();
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),1,'Confirm after meaningful release');
 eq(await tp.count(),1,'original TP chip remains the only full chip');
 eq(await page.locator('[data-v4-preview]').count(),1,'one dotted preview line');
 eq(await page.evaluate(()=>window.v4QA.commands.length),0,'release does not submit');
 await page.getByRole('button',{name:'Discard chart edit'}).click();
 eq(await page.locator('[data-v4-preview]').count(),0,'Discard clears draft');
 eq(await page.evaluate(()=>window.v4QA.orders[0].tp),82100,'Discard preserves accepted TP');

 // Moving entry likewise edits only after release; Discard preserves entry.
 await drag('[data-v4-pending-grip="qa-account:pending:o1:entry"]',52);
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'entry actions hidden while dragging');
 await end();
 eq(await entry.count(),1,'entry chip not duplicated');
 eq(await page.locator('[data-v4-preview]').count(),1);
 await page.getByRole('button',{name:'Discard chart edit'}).click();
 eq(await page.evaluate(()=>window.v4QA.orders[0].entry),84400);

 // New order planning must never add extraneous chart confirmation controls.
 await page.getByRole('button',{name:'Start new limit plan'}).click();
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0);
 eq(await page.locator('[data-v4-preview]').count(),0);
 await page.getByRole('button',{name:'Finish planning'}).click();

 // Clicking a different pending order selects that order (not an open position).
 await badge('pending:o2:entry').locator('[data-v4-pending-grip]').click();
 await page.waitForFunction(()=>window.v4QA.selectedPendingId==='o2');
 eq(await page.locator('[data-v4-manage-pending="o2"]').count(),1);
 eq(await page.locator('[data-v4-manage-pending="o1"]').count(),0);
 eq(await page.locator('[data-v4-manage-position]').count(),0);
 eq(await page.locator('[data-v4-manage-pending="o2"] input[aria-label="Stop trigger price"]').count(),1);
 eq(await page.locator('[data-v4-manage-pending="o2"] input[aria-label="Limit boundary price"]').count(),1);
 eq(await page.locator('[data-v4-manage-pending="o2"] .v4-manage-pending-metrics > div').count(),2);

 // Drag Stop-Limit trigger. The accepted trigger and limit remain solid while
 // two dotted proposed levels move in lockstep; no command until Confirm.
 const stopBefore=await accepted('pending:o2:entry').evaluate(n=>n.style.top);
 const limitBefore=await accepted('pending:o2:limitPrice').evaluate(n=>n.style.top);
 await drag('[data-v4-pending-grip="qa-account:pending:o2:entry"]',-41);
 eq(await page.locator('[data-v4-secondary-preview]').count(),1,'linked limit preview while moving stop trigger');
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),0,'actions hidden until release');
 await end();
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),1);
 eq(await accepted('pending:o2:entry').evaluate(n=>n.style.top),stopBefore);
 eq(await accepted('pending:o2:limitPrice').evaluate(n=>n.style.top),limitBefore);
 eq(await page.evaluate(()=>window.v4QA.orders[1].entry),81600);
 eq(await page.evaluate(()=>window.v4QA.orders[1].limitPrice),81400);
 await page.getByRole('button',{name:'Confirm chart edit'}).click();
 await page.waitForFunction(()=>window.v4QA.orders[1].entry!==81600);
 await page.waitForFunction(()=>document.querySelectorAll('[data-v4-preview]').length===0);
 const changed=await page.evaluate(()=>window.v4QA.orders[1]);
 ok(Math.abs((changed.entry-81600)-(changed.limitPrice-81400))<.01,'Stop-Limit trigger delta keeps limit spacing');
 eq(await page.locator('[data-v4-secondary-preview]').count(),0,'linked preview cleared on ACK');

 // Stop-Limit limit boundary is independently amendable.
 const beforeLimit=await page.evaluate(()=>window.v4QA.orders[1].limitPrice);
 await drag('[data-v4-drag-handle="qa-account:pending:o2:limitPrice"]',32);
 eq(await page.locator('[data-v4-secondary-preview]').count(),0,'limit-only drag has no coupled trigger');
 await end();
 eq(await page.locator('[data-v4-pending-chart-actions]').count(),1);
 await page.getByRole('button',{name:'Confirm chart edit'}).click();
 await page.waitForFunction(price=>window.v4QA.orders[1].limitPrice!==price,beforeLimit);
 eq(await page.evaluate(()=>window.v4QA.orders[1].entry),changed.entry,'limit-only edit leaves trigger unchanged');

 // Pending-order panel can add/modify protections without Buy/Sell controls.
 const pending=page.locator('[data-v4-manage-pending="o2"]');
 eq(await pending.getByRole('button',{name:'New Order',exact:true}).count(),0,
  'Pending context relies on Back/Close rather than redundant mode switch');
 eq(await pending.getByRole('button',{name:/^(BUY|SELL) /}).count(),0);
 ok((await pending.innerText()).includes('Estimated margin on fill'));
 const pendingCancelStyle=await visual(pending.locator('.v4-manage-close'));
 eq(pendingCancelStyle.background,'rgb(23, 23, 26)','Pending Cancel Order uses the neutral black secondary style');
 eq(await pending.getByText('Order size',{exact:true}).count(),1,'pending size appears once');
 eq(await pending.getByText('Estimated margin on fill',{exact:true}).count(),1,'pending margin appears once');
 eq(await pending.getByText('Order status',{exact:true}).count(),0,'no duplicate status slab');
 eq(await pending.getByText('ORDER ACTIONS',{exact:true}).count(),0,'no duplicate metadata disclosure');
 eq(await pending.getByText('Order type',{exact:true}).count(),0,'order type is in header only');
 eq(await pending.locator('.v4-ratio-slab').count(),0,'no redundant slab');
 eq(await pending.locator('.v4-margin-summary').count(),0,'pending footer only shows actions');
 await pending.getByRole('button',{name:'Cancel Order'}).click();
 eq(await pending.getByRole('dialog',{name:'Confirm order cancellation'}).count(),1);
 eq(await pending.locator('.v4-manage-close-dialog').count(),0,'no oversized pending confirmation');
 eq((await visual(pending.getByRole('button',{name:'Keep Order'}))).background,'rgb(23, 23, 26)',
   'Keep Order uses black secondary button');
 eq((await visual(pending.getByRole('button',{name:'Cancel Order',exact:true}))).background,'rgb(242, 242, 244)',
   'explicit pending cancellation uses white primary button');
 await pending.getByRole('button',{name:'Keep Order'}).click();
 eq(await page.evaluate(()=>window.v4QA.orders.length),2,'cancel confirmation can be dismissed');

 // The pending-order manager owns its selected order's amendment draft.
 // Editing the Stop-Limit execution boundary via the manager cannot alter
 // another order, submit a new Buy/Sell, or move the accepted trigger.
 const beforePanelBoundary=await page.evaluate(()=>window.v4QA.orders[1].limitPrice);
 const beforePanelTrigger=await page.evaluate(()=>window.v4QA.orders[1].entry);
 await pending.getByRole('spinbutton',{name:'Limit boundary price'}).fill(String(beforePanelBoundary+25));
 await page.waitForFunction(()=>window.v4QA.pendingDraft?.kind==='limitPrice');
 eq(await page.evaluate(()=>window.v4QA.orders[1].limitPrice),beforePanelBoundary,
   'pending sidebar input may only create a preview before Confirm');
 eq(await page.locator('[data-v4-preview]').count(),1,'pending panel uses chart dotted preview');
 eq(await pending.locator('.v4-manage-confirm').count(),1);
 eq((await visual(pending.locator('.v4-manage-discard'))).background,'rgb(23, 23, 26)',
   'pending draft Discard uses black secondary treatment');
 eq((await visual(pending.locator('.v4-manage-confirm'))).background,'rgb(242, 242, 244)',
   'pending draft Confirm uses white primary treatment');
 await pending.locator('.v4-manage-discard').click();
 await page.waitForFunction(()=>window.v4QA.pendingDraft==null);
 eq(await page.locator('[data-v4-preview]').count(),0,'pending panel Discard clears chart draft');
 eq(await page.evaluate(()=>window.v4QA.orders[1].limitPrice),beforePanelBoundary);
 await pending.getByRole('spinbutton',{name:'Limit boundary price'}).fill(String(beforePanelBoundary+25));
 await pending.locator('.v4-manage-confirm').click();
 await page.waitForFunction(price=>window.v4QA.orders[1].limitPrice===price,beforePanelBoundary+25);
 await page.waitForFunction(()=>window.v4QA.pendingDraft==null);
 eq(await page.evaluate(()=>window.v4QA.orders[1].entry),beforePanelTrigger,
   'pending panel limit-boundary amendment leaves Stop-Limit trigger unchanged');

 // Open-position selection must override the pending manager.
 await page.getByRole('button',{name:'Select open position'}).click();
 const manage=page.locator('[data-v4-manage-position="p1"]');
 await manage.waitFor();
 eq(await page.locator('[data-v4-manage-pending]').count(),0);
 eq(await page.evaluate(()=>window.v4QA.selectedPositionId),'p1');
 ok((await manage.innerText()).includes('EXITS / PROTECTION'));
 ok((await manage.innerText()).includes('Estimated margin'));
 eq(await manage.locator('.v4-exit-card').count(),2);
 eq(await manage.locator('.v4-session').count(),0,'no duplicate position status row');
 eq(await manage.locator('.v4-capsule').count(),0,'no Open Position/New Order switch in manager');
 eq(await manage.locator('.v4-instrument .v4-manage-header-context').count(),1,'single contextual side/status line');
 eq(await manage.locator('.v4-quote-strip').count(),1,'retain compact prices and return');
 eq(await manage.locator('.v4-quote-strip > span').count(),3);
 eq(await manage.locator('.v4-section-heading').filter({hasText:/^POSITION$/}).count(),0,
   'no redundant position heading');
 eq(await manage.getByText('POSITION SIZE',{exact:true}).count(),1);
 eq(await manage.getByRole('button',{name:'Back to new order'}).count(),1);
 eq(await manage.locator('.v4-manage-new-order').count(),0,'no redundant bottom New Order');
 eq(await manage.locator('.v4-manage-close').count(),1,'idle footer is Close Position');
 const closeStyle=await visual(manage.locator('.v4-manage-close'));
 eq(closeStyle.background,'rgb(242, 242, 244)','Close Position uses white execution-style CTA');
 eq(closeStyle.color,'rgb(18, 18, 20)','Close Position uses dark text');
 ok(closeStyle.height>=52,'Close Position keeps execution CTA geometry');
 eq(await manage.getByRole('button',{name:'Confirm position protection'}).count(),0,'no Confirm without a draft');

 // Actions use existing position callbacks and close confirmation.
 await manage.getByRole('button',{name:/POSITION ACTIONS/}).click();
 eq(await manage.locator('[data-v4-manage-advanced]').count(),1);
 eq(await manage.getByRole('button',{name:'Break-even'}).count(),1);
 eq(await manage.getByRole('button',{name:'Trailing SL'}).count(),1);
 eq(await manage.getByRole('button',{name:'Partial close'}).count(),1);
 await manage.getByRole('button',{name:'Trailing SL'}).click();
 await manage.locator('[data-v4-trailing-options]').getByRole('button',{name:'10 pips'}).click();
 await page.waitForFunction(()=>window.v4QA.actionCommands.some(x=>x.kind==='trail'&&x.pips===10));
 eq(await manage.locator('[data-v4-partial-close-options]').count(),0,
   'percentage buttons hidden before partial close is requested');
 await manage.getByRole('button',{name:'Partial close'}).click();
 eq(await manage.getByRole('dialog',{name:'Confirm position close'}).count(),0,
   'Partial Close must not implicitly close 50%');
 eq(await manage.locator('[data-v4-partial-close-options] button').count(),3);
 eq(await page.evaluate(()=>window.v4QA.actionCommands.filter(x=>x.kind==='close').length),0);
 await manage.getByRole('button',{name:'Close 25%'}).click();
 eq(await manage.getByRole('dialog',{name:'Confirm position close'}).count(),1);
 ok((await manage.getByRole('dialog',{name:'Confirm position close'}).innerText()).includes('25%'),
   'confirm exact chosen percentage');
 await manage.getByRole('button',{name:'Cancel',exact:true}).click();
 eq(await page.evaluate(()=>window.v4QA.actionCommands.filter(x=>x.kind==='close').length),0);
 await manage.locator('.v4-manage-close').click();
 eq(await manage.getByRole('dialog',{name:'Confirm position close'}).count(),1);
 eq(await manage.locator('.v4-manage-close').count(),0,'Close Position CTA replaced during confirmation');
 eq(await manage.locator('.v4-manage-close-dialog').count(),0,'no oversized close confirmation card');
 eq((await visual(manage.getByRole('button',{name:'Cancel',exact:true}))).background,'rgb(23, 23, 26)',
   'Close confirmation Cancel stays black');
 eq((await visual(manage.getByRole('button',{name:'Confirm Close'}))).background,'rgb(242, 242, 244)',
   'Confirm Close uses white primary button');
 await manage.getByRole('button',{name:'Confirm Close'}).click();
 await page.waitForFunction(()=>window.v4QA.actionCommands.some(x=>x.kind==='close'&&x.percent===100));

 // Existing add-TP still creates a deliberate draft with Confirm/Discard;
 // panel and chart use the same object and submit only on Confirm.
 await page.locator('button[aria-label="Add TP to BUY position"]').click();
 await page.waitForFunction(()=>Boolean(window.v4QA.parentDraft));
 eq(await manage.getByRole('button',{name:'Confirm position protection'}).count(),1);
 eq((await visual(manage.locator('.v4-manage-discard'))).background,'rgb(23, 23, 26)',
   'Position protection Discard is black');
 eq((await visual(manage.locator('.v4-manage-confirm'))).background,'rgb(242, 242, 244)',
   'Position protection Confirm is white');
 eq(await page.locator('[data-v4-draft-badge]').count(),1);
 await manage.getByRole('button',{name:'Discard position protection'}).click();
 await page.waitForFunction(()=>window.v4QA.parentDraft==null);
 eq(await page.locator('[data-v4-preview]').count(),0);

 // Selecting another open position switches its exact manager, never stays
 // stuck on the first position. Shared currency avatar remains correct.
 await page.getByRole('button',{name:'Select EUR/USD position'}).click();
 const eur=page.locator('[data-v4-manage-position="p2"]');
 await eur.waitFor();
 eq(await manage.count(),0);
 eq(await eur.locator('.v4-symbol strong').innerText(),'EUR/USD');
 eq(await eur.locator('[data-v4-manage-instrument-avatar] > span > span').count(),2);
 eq(await eur.locator('.v4-manage-close').count(),1);
 // Click the *chart* position to switch directly from EUR/USD into the
 // BTC position's management panel; this must not leave EUR/USD selected.
 await page.locator('[data-v4-chart-badge]').click();
 await page.waitForFunction(()=>window.v4QA.selectedPositionId==='p1');
 eq(await page.locator('[data-v4-manage-position="p1"]').count(),1,
   'chart position selection switches to the exact clicked position');
 eq(await page.locator('[data-v4-manage-position="p2"]').count(),0);
 await page.locator('[data-v4-manage-position="p1"]').getByRole('button',{name:'Back to new order'}).click();
 eq(await page.locator('[data-v4-manage-position]').count(),0);
 eq(await page.locator('[data-v4-manage-pending]').count(),0);
 eq(await page.locator('[data-v4-preview]').count(),0);
 eq(await page.locator('[data-v4-draft-shade]').count(),0);
 eq(await page.locator('[data-v4-accepted-shade]').count(),0);

 // The mounted REAL desktop terminal, not a reconstructed screenshot fixture.
 await page.goto('http://127.0.0.1:5174/v4-header-audit.html?acg_v4_audit=1',{waitUntil:'domcontentloaded'});
 const header=page.locator('[data-v4-header="true"]');
 await header.waitFor({timeout:20000});
 eq(await header.locator('.acg-v4-header-monogram').innerText(),'£$','GBPUSD uses approved FX monogram');
 eq(await header.locator('[data-market-status]').getAttribute('data-market-status'),'open','only confirmed open sessions claim Market open');
 eq(await header.locator('[data-v4-header-account-name]').innerText(),'ACG · 598D2F','compact account name');
 eq(await header.locator('[data-v4-header-tool]').count(),3,'three icon-only chart tools');
 eq(await header.locator('.acg-v4-header-tool-label:visible').count(),0,'icon labels hidden');
 eq(await header.locator('.acg-v4-header-tool-chevron:visible').count(),0,'icon chevrons hidden');
 for(const width of [1440,1280,1024,800,768]){
   await page.setViewportSize({width,height:850});
   const g=await header.evaluate(el=>{
     const rect=x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right};};
     const separators=['.acg-v4-header-instrument','.acg-v4-header-timeframes','.acg-v4-header-tools','.acg-v4-header-right']
       .map((s,i)=>getComputedStyle(el.querySelector(s),i===3?'::before':'::after').height);
     const tools=[...el.querySelectorAll('[data-v4-header-tool]')].map(x=>({rect:rect(x),bg:getComputedStyle(x).backgroundColor}));
     const symbol=rect(el.querySelector('.acg-v4-header-primary strong'));
     const account=rect(el.querySelector('[data-v4-header-account-name]'));
     const active=el.querySelector('[data-v4-timeframe][aria-pressed="true"]');
     return {outer:rect(el),symbol,account,tools,separators,
       activeBg:getComputedStyle(active).backgroundColor,docWidth:document.documentElement.scrollWidth};
   });
   ok(Math.abs(g.outer.h-64)<=1,`Header is 64px at ${width}px`);
   ok(g.outer.right<=width+1&&g.docWidth<=width+1,`No horizontal overflow at ${width}px`);
   ok(Math.abs(g.symbol.y-g.account.y)<=6,`Names align on same baseline at ${width}px`);
   ok(g.tools.every(t=>t.rect.w>=32&&t.rect.h>=32),`32px+ tools at ${width}px`);
   ok(g.tools.every(t=>t.bg==='rgba(0, 0, 0, 0)'),`Icon tools are visually unboxed at ${width}px`);
   ok(g.separators.every(h=>h==='32px'),`Dividers are consistently 32px at ${width}px`);
   eq(g.activeBg,'rgb(242, 242, 244)',`White active timeframe at ${width}px`);
 }
 await page.setViewportSize({width:1440,height:850});
 await header.locator('[data-v4-timeframe="1H"]').click();
 await page.waitForFunction(()=>window.v4HeaderQA.timeframe==='1H');
 eq(await header.locator('[data-v4-timeframe="1H"]').getAttribute('aria-pressed'),'true','timeframe selection works');
 await header.getByRole('button',{name:'Chart type'}).click();
 eq(await header.getByRole('button',{name:'Candlesticks'}).count(),1,'Chart menu keeps Candlesticks');
 eq(await header.getByRole('button',{name:'Single chart'}).count(),0,'Chart grid is no longer under Chart type');
 await header.getByRole('button',{name:'Line'}).click();
 await page.waitForFunction(()=>window.v4HeaderQA.chartMode==='line');
 await header.getByRole('button',{name:'Layout'}).click();
 eq(await header.getByRole('button',{name:'Two charts'}).count(),1,'Layout exposes two-chart option');
 eq(await header.getByText('Scalper',{exact:true}).count(),1,'Layout retains saved workspace presets');
 await header.getByRole('button',{name:'Two charts'}).click();
 await header.getByRole('button',{name:'Layout'}).click();
 eq(await header.getByRole('button',{name:'Two charts'}).getAttribute('aria-pressed'),'true','Chart layout state connects to actual grid');
 await header.getByRole('button',{name:'Layout'}).click();
 await header.getByRole('button',{name:'Switch trading account'}).click();
 eq(await header.getByText('Trading accounts').count(),1,'account selector opens');
 await header.getByRole('button',{name:/ACG-33E47AD12A9C/}).click();
 await page.waitForFunction(()=>window.v4HeaderQA.account==='ACG-33E47AD12A9C');
 eq(await header.locator('[data-v4-header-account-name]').innerText(),'ACG · D12A9C','account selection updates name');
 await header.getByRole('button',{name:'Indicators'}).click();
 eq(await header.getByText('Indicators',{exact:true}).count()>=1,true,'fx icon still opens indicator panel');
 await header.getByRole('button',{name:'Indicators'}).click();
 await page.evaluate(()=>window.v4HeaderQA.setSession('CLOSED'));
 await page.waitForFunction(()=>document.querySelector('[data-v4-header] [data-market-status]')?.dataset.marketStatus==='closed');
 await page.evaluate(()=>window.v4HeaderQA.setSession('WAITING'));
 await page.waitForFunction(()=>document.querySelector('[data-v4-header] [data-market-status]')?.dataset.marketStatus==='unavailable');

 assert.deepEqual(errors,[],'no uncaught page errors');checks++;
 console.log('SIX_V4_REGRESSIONS_PASS',JSON.stringify({checks,commands:await page.evaluate(()=>window.v4QA.commands)}));
}catch(error){
 console.error('SIX_V4_REGRESSIONS_FAIL',error);
 process.exitCode=1;
}finally{await browser.close();}
