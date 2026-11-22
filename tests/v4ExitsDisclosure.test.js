import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ticket = readFileSync(
  new URL('../src/components/trading-v2/desktop/DesktopOrderTicketV4.jsx', import.meta.url),
  'utf8',
);

test('V4 Exits / Protection defaults closed and toggles like Advanced', () => {
  assert.match(ticket, /const \[exitsOpen,setExitsOpen\]=useState\(false\)/);
  assert.match(ticket, /<button type="button" className="v4-disclosure" aria-expanded=\{exitsOpen\} onClick=\{\(\)=>setExitsOpen\(x=>!x\)\}>/);
  assert.match(ticket, /EXITS \/ PROTECTION \{exitsOpen\?<ChevronUp size=\{15\}\/>:<ChevronDown size=\{15\}\/>\}/);
  assert.match(ticket, /<button type="button" className="v4-disclosure" aria-expanded=\{advanced\}/);
});

test('V4 stop loss, take profit, and ratio fields are disclosed together', () => {
  const disclosure = ticket.split('{exitsOpen&&<>')[1]?.split('</>}')[0];
  assert.ok(disclosure, 'Exits / Protection contents must be conditional');
  assert.match(disclosure, /<ProtectionCard field="sl"/);
  assert.match(disclosure, /<ProtectionCard field="tp"/);
  assert.match(disclosure, /<div className="v4-ratio-slab">/);
  assert.match(ticket, /const toggleProtection=field=>/);
  assert.match(ticket, /validateTradePlanForExecution/);
});
