import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Built output acceptance: the authenticated terminal must never depend on
// an additional CSS request made by Vite when React.lazy resolves.
// Public cinematic landing styles under dist/*.css are unaffected.
const root='dist';
const assets=join(root,'assets');
const html=readFileSync(join(root,'index.html'),'utf8');
const cssFiles=readdirSync(assets).filter(name=>name.endsWith('.css'));
assert.equal(cssFiles.length,1,
  'Expected exactly one bundled CSS file for the terminal build: '+cssFiles.join(', '));

const cssName=cssFiles[0];
assert.match(cssName,/^[\w.-]+-[\w-]{8,}\.css$/,
  'Bundled CSS should have a cache-busting content-hashed filename');
const css=readFileSync(join(assets,cssName),'utf8');
assert.ok(css.length>25000,'The CSS bundle must contain the real terminal theme');
assert.ok(css.includes('--acg-canvas') || css.includes('--terminal-bg'),
  'The default stylesheet must contain the trading terminal theme');

const cssReferences=[...html.matchAll(/(?:href|src)=["']([^"']+\.css)["']/g)].map(x=>x[1]);
assert.equal(cssReferences.length,1,
  'The HTML entry should load the only bundled terminal stylesheet');
assert.equal(cssReferences[0],'/assets/'+cssName,
  'Terminal CSS must be loaded directly by the initial HTML');
assert.ok(!readdirSync(assets).some(name=>
  /^(TradingTerminalV2|MobileTraderShell|tradePlanNormalization)-.*\.css$/i.test(name)),
  'No lazy terminal CSS assets should be emitted');

console.log('TERMINAL_SINGLE_CSS_PASS',JSON.stringify({
  bundledCSS:cssName,bytes:css.length,entryStylesheets:cssReferences.length,
  nestedLazyCSS:0,
}));
