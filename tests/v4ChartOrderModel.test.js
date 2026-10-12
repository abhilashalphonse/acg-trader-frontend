import test from 'node:test';
import assert from 'node:assert/strict';
import {
  v4AcceptedLevels, v4DraftLevels, v4ShowAcceptedBadge,
  v4LayoutBadges, v4ValidEditPrice, v4LevelKey,
} from '../src/components/trading-v2/v4/v4ChartOrderModel.js';

const position={id:'p-1',symbol:'BTCUSD',side:'SELL',entry:83700,sl:85500,tp:81600,volume:0.01};
const second={id:'p-2',symbol:'BTCUSD',side:'BUY',entry:83700,sl:null,tp:85000,volume:0.03};
const order={id:'o-1',symbol:'BTCUSD',side:'BUY',orderType:'stop-limit',entry:83900,limitPrice:83930,sl:83500,tp:84600,volume:0.02,status:'PENDING'};

test('v4 accepted levels expose separate original solid price anchors and identity',()=>{
 const levels=v4AcceptedLevels({positions:[position,second],pendingOrders:[order],symbol:'BTCUSD'});
 assert.equal(levels.length,9);
 assert.deepEqual(levels.filter(x=>x.owner==='position'&&x.ownerId==='p-1').map(x=>x.field),['entry','sl','tp']);
 assert.deepEqual(levels.filter(x=>x.owner==='pending').map(x=>x.field),['entry','limitPrice','sl','tp']);
 assert.equal(levels.find(x=>x.key==='pending:o-1:limitPrice').price,83930);
 assert.equal(levels.find(x=>x.key==='position:p-1:sl').price,85500);
 assert.equal(levels.find(x=>x.key==='position:p-1:sl').accepted,true);
 assert.equal(levels.find(x=>x.key==='pending:o-1:entry').color,'#12b996');
 assert.deepEqual(v4AcceptedLevels({positions:[position],symbol:'EURUSD'}),[]);
});

test('v4 draft only contains actively edited open-position protection',()=>{
 const draft={positionId:'p-1',source:'open-position',symbol:'BTCUSD',activeField:'tp',sl:85500,tp:81200,entry:83700};
 const lines=v4DraftLevels({positionProtectionDraft:draft,symbol:'BTCUSD'});
 assert.deepEqual(lines.map(x=>x.key),['protection-draft:p-1:tp']);
 assert.equal(lines[0].price,81200);
 assert.equal(lines[0].accepted,false);
 assert.equal(v4ValidEditPrice(null),null);
 assert.equal(v4ValidEditPrice(''),null);
 assert.equal(v4ValidEditPrice(-1),null);
 assert.equal(v4ValidEditPrice('83700'),83700);
});

test('draft editing hides only the accepted badge while retaining accepted line in model',()=>{
 const levels=v4AcceptedLevels({positions:[position],pendingOrders:[order],symbol:'BTCUSD'});
 const tp=levels.find(x=>x.key===v4LevelKey('position','p-1','tp'));
 const sl=levels.find(x=>x.key===v4LevelKey('position','p-1','sl'));
 assert.equal(v4ShowAcceptedBadge(tp,{edit:{owner:'position',ownerId:'p-1',field:'tp'}}),false);
 assert.equal(v4ShowAcceptedBadge(sl,{edit:{owner:'position',ownerId:'p-1',field:'tp'}}),true);
 assert.equal(v4ShowAcceptedBadge(tp,{positionProtectionDraft:{positionId:'p-1',activeField:'tp'}}),false);
 assert.equal(v4ShowAcceptedBadge(sl,{positionProtectionDraft:{positionId:'p-1',activeField:'tp'}}),true);
 assert.equal(v4ShowAcceptedBadge(levels.find(x=>x.owner==='pending'),{tradePlan:{editingOrderId:'o-1'}}),false);
 assert.equal(levels.find(x=>x.key==='position:p-1:tp').price,81600);
});

test('overlapping independent badges are spaced without mutating actual price Y',()=>{
 const levels=[
  {key:'p1',y:100}, {key:'p2',y:101},
  {key:'p3',y:102}, {key:'p4',y:180},
 ];
 const result=v4LayoutBadges(levels,400,{rowHeight:28,gap:6});
 assert.equal(result.length,4);
 for(let i=1;i<result.length;i++)assert.ok(result[i].badgeY-result[i-1].badgeY>=34);
 assert.deepEqual(levels.map(x=>x.y),[100,101,102,180]);
 assert.equal(result[0].y,100);
 assert.notEqual(result[1].deltaY,0);
 assert.deepEqual(v4LayoutBadges([],400),[]);
});

test('accepted pending lines preserve unrelated positions, reject nonpositive/invalid prices',()=>{
 const levels=v4AcceptedLevels({positions:[position,{...position,id:'bad',sl:0,tp:'NaN',entry:''}],pendingOrders:[
   {...order,id:'bad-order',status:'CANCELLED'},
 ],symbol:'BTCUSD'});
 assert.equal(levels.length,3);
 assert.deepEqual(levels.map(x=>x.field),['entry','sl','tp']);
 assert.equal(v4LevelKey('position','p-1','tp'),'position:p-1:tp');
});
