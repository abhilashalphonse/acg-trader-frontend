import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V4_POSITION_MIN_WIDTHS,validPositionView,finiteOrNull,money,pnlTone,
  positionMargin,positionExposure,positionOpened,positionExecutionSource,
  positionUnrealizedPnl,positionRiskAtStop,positionIdentity,
  positionUsdNotional,positionMarginUtilization,positionRecordedCosts,
  positionHoldingDuration,positionProtectionIntelligence,
} from '../src/utils/v4PositionsPresentation.js';

const account={currency:'USD'};
const forex={assetClass:'FOREX',baseCurrency:'EUR',quoteCurrency:'USD',contractSize:100000};
const position={id:'mongo-1',positionId:'public-pos-1',symbol:'EURUSD',side:'SELL',volume:0.01,
  entry:1.11652,closePrice:1.11735,pnl:-0.83,pnlCurrency:'USD',sl:null,tp:null,
  source:'live-account-currency',raw:{margin:'11.16',contractSize:'100000',openedAt:'2026-10-13T01:47:53.000Z'}};

test('V4 table has three exact modes and no guessed view',()=>{
  assert.deepEqual(V4_POSITION_MIN_WIDTHS,{compact:680,risk:960,execution:880});
  assert.equal(validPositionView('risk'),'risk');
  assert.equal(validPositionView('execution'),'execution');
  assert.equal(validPositionView('garbage'),'compact');
});
test('position-level reserved margin wins over changing instrument leverage',()=>{
  assert.equal(positionMargin(position),11.16);
  assert.equal(positionMargin({...position,margin:900}),11.16);
  assert.equal(positionMargin({...position,raw:{margin:null}}),null);
  assert.equal(positionMargin({...position,raw:undefined,margin:8.5}),8.5);
  assert.equal(finiteOrNull(null),null);
  assert.equal(finiteOrNull(''),null);
});
test('exposure is underlying instrument quantity and explicitly carries unit',()=>{
  assert.deepEqual(positionExposure(position,forex),{
    quantity:1000,unit:'EUR',
    description:'Underlying quantity (lots × contract size); not account-currency notional'
  });
  assert.equal(positionExposure(position,{...forex,contractSize:null,baseCurrency:null})?.quantity,1000);
  assert.equal(positionExposure({...position,raw:{},volume:0.01},{...forex,contractSize:null}),null);
});
test('same identity across views; opening timestamp comes from fill not displayed text',()=>{
  assert.equal(positionIdentity(position),'mongo-1');
  const opened=positionOpened({...position,openedAt:'yesterday'});
  assert.equal(opened?.iso,'2026-10-13T01:47:53.000Z');
  assert.ok(opened?.date.includes('13 Oct 2026'));
  assert.ok(opened?.offset.startsWith('UTC'));
  assert.equal(positionOpened({...position,raw:{openedAt:'not-a-date'}}),null);
});
test('execution source never uses valuation transport source',()=>{
  assert.equal(positionExecutionSource(position),'—');
  assert.equal(positionExecutionSource({...position,raw:{metadata:{executionSource:'Manual'}}}),'Manual');
  assert.equal(positionExecutionSource({...position,raw:{metadata:{orderSource:'EA'}}}),'EA');
});
test('unrealized profit/loss is accounted in matching account currency',()=>{
  assert.deepEqual(positionUnrealizedPnl(position,account),{value:-0.83,currency:'USD',verified:true});
  assert.equal(positionUnrealizedPnl({...position,pnlCurrency:'CAD'},account).value,null);
  assert.equal(money(-0.004,'USD',true),'$0.00');
  assert.equal(money(-0.83,'USD',true),'−$0.83');
  assert.equal(money(5,'USD',true),'+$5.00');
  assert.equal(pnlTone(-0.004),'neutral');
  assert.equal(pnlTone(0),'neutral');
  assert.equal(pnlTone(-0.83),'loss');
});
test('risk at stop is missing without SL and fails closed when FX conversion unavailable',()=>{
  const projected=()=>-12.6;
  assert.equal(positionRiskAtStop(position,forex,account,projected),null);
  assert.equal(positionRiskAtStop({...position,sl:1.12},forex,account,projected),12.6);
  assert.equal(positionRiskAtStop({...position,sl:1.12},{...forex,quoteCurrency:'CAD'},account,projected),null);
  assert.equal(positionRiskAtStop({...position,sl:1.12},forex,account,()=>4),0);
});


test('USD notional requires actual close quote and known USD denomination',()=>{
  assert.ok(Math.abs(positionUsdNotional(position,forex)-1117.35)<0.00001);
  assert.equal(positionUsdNotional(position,{...forex,quoteCurrency:'CAD'}),null);
  assert.equal(positionUsdNotional({...position,closePrice:null},forex),null);
  assert.equal(positionUsdNotional(position,{...forex,baseCurrency:'USD',quoteCurrency:'JPY'}),1000);
});
test('position costs are recorded-only and do not subtract from live P&L',()=>{
  assert.deepEqual(positionRecordedCosts(position),{commission:null,swap:null,realized:null});
  assert.deepEqual(positionRecordedCosts({...position,raw:{
    ...position.raw,commissionPaid:2.5,swapPaid:-0.45,realizedPnl:4
  }}),{commission:2.5,swap:-0.45,realized:4});
  assert.equal(positionMarginUtilization(position,{equity:100000}),0.01116);
  assert.equal(positionMarginUtilization(position,{equity:0}),null);
});
test('holding duration is actual elapsed time and absent for invalid timestamps',()=>{
  assert.equal(positionHoldingDuration(position,'2026-10-13T03:52:53.000Z'),'2h 5m');
  assert.equal(positionHoldingDuration(position,'2026-10-12T01:47:53.000Z'),null);
});
test('protection R:R uses account-currency-compatible projections; R stays unavailable',()=>{
  const setup={...position,sl:1.119,tp:1.115};
  const estimator=(p,target,instrument)=>
    (String(p.side).toUpperCase()==='SELL'?Number(p.entry)-target:target-Number(p.entry))*
    Number(instrument.contractSize)*Number(p.volume);
  const valid=positionProtectionIntelligence(setup,{...forex,pipSize:0.0001},account,estimator);
  assert.ok(valid.stopDistance>0);
  assert.ok(valid.targetDistance>0);
  assert.ok(valid.lossAtStop<0);
  assert.ok(valid.gainAtTarget>0);
  assert.ok(valid.rewardToRisk>0);
  assert.equal(valid.rMultiple,null);
  const unknownFx=positionProtectionIntelligence(setup,{...forex,quoteCurrency:'CAD'},account,estimator);
  assert.equal(unknownFx.rewardToRisk,null);
  assert.equal(unknownFx.currentToStop,null);
});
