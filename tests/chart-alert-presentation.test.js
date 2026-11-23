import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alertDefinition,chartAlertEntries,chartAlertLabel,chartAlertPrice,movedAlertCondition} from '../src/components/alerts/chartAlertPresentation.js';
const rule={id:'r',version:7,symbol:'EURUSD',status:'MONITORING',monitoring:'MONITORING',condition:{type:'crosses',level:'1.10000'},soundEnabled:false,pushEnabled:true,frequency:'repeat',cooldownMs:300000,note:'Keep this note',name:'',priceSource:'bid',expiresAt:null};
test('chart entries show active rules for this symbol, including both zone edges',()=>{
  const rows=chartAlertEntries([rule,{...rule,id:'zone',condition:{type:'enters_range',lower:'1.09',upper:'1.11'}},{...rule,id:'paused',status:'PAUSED'},{...rule,id:'other',symbol:'BTCUSD'}],'EURUSD');
  assert.deepEqual(rows.map(e=>e.key),['r:level','zone:lower','zone:upper']);
  assert.equal(chartAlertEntries([{...rule,status:'COMPLETED'}],'EURUSD').length,0);
});
test('pixel prices snap to the instrument tick and preserve zero/scientific precision',()=>{
  assert.equal(chartAlertPrice(1.100034,{digits:5,tickSize:0.00005}),'1.10005');
  assert.equal(chartAlertPrice(3513.58,{digits:2,tickSize:0.25}),'3513.50');
  assert.equal(chartAlertPrice(1.23456789,{digits:8,tickSize:1e-8}),'1.23456789');
  assert.equal(chartAlertPrice(3500,{digits:0,tickSize:1}),'3500');
  for(const n of [0,-1,Infinity,NaN])assert.equal(chartAlertPrice(n,{digits:2,tickSize:.01}),null);
});
test('drag changes only the selected threshold and rejects inverted zones',()=>{
  const zone={...rule,condition:{type:'enters_range',lower:'1.09',upper:'1.11'}},instrument={digits:5,tickSize:.00001};
  assert.deepEqual(movedAlertCondition(zone,'lower',1.095,instrument),{type:'enters_range',lower:'1.09500',upper:'1.11'});
  assert.equal(movedAlertCondition(zone,'lower',1.12,instrument),null);
  assert.equal(movedAlertCondition(zone,'upper',1.08,instrument),null);
  assert.equal(movedAlertCondition(rule,'upper',1.2,instrument),null);
});
test('moving an alert preserves notification settings and strips runtime metadata from strict API payloads',()=>{
  const body=alertDefinition({...rule,runtime:{token:'test-only'}},{type:'crosses',level:'1.12000'});
  assert.equal(body.soundEnabled,false);assert.equal(body.pushEnabled,true);assert.equal(body.priceSource,'bid');
  assert.equal(body.cooldownMs,300000);assert.equal(body.note,'Keep this note');
  assert.equal('id'in body,false);assert.equal('version'in body,false);assert.equal('runtime'in body,false);
  assert.equal(rule.condition.level,'1.10000');
});
test('labels identify the condition, candle timeframe and selected range edge',()=>{
  assert.match(chartAlertLabel({rule,field:'level',price:1.1},'1.10000'),/EURUSD · Crossing · 1.10000/);
  assert.match(chartAlertLabel({rule:{...rule,timeframe:'15m',condition:{type:'candle_close_above',level:'1.1'}},field:'level',price:1.1}),/15m · Candle close above/);
});
