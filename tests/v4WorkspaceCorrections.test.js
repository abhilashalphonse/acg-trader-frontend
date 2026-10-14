import test from 'node:test';
import assert from 'node:assert/strict';
import {activityStart,activityTimestamp,filterActivity} from '../src/utils/v4ActivityRanges.js';
import {positionCurrentSpread} from '../src/utils/v4PositionsPresentation.js';

const now=new Date('2026-10-13T08:00:00Z');
const daysAgo=n=>new Date(now.getTime()-n*86400000).toISOString();
test('7D / 30D / 1M refuse older-than-month history and journal',()=>{
 const history=[{id:'three',raw:{closedAt:daysAgo(3)}},
   {id:'twentyfive',raw:{closedAt:daysAgo(25)}},
   {id:'fifty',raw:{closedAt:daysAgo(50)}}];
 assert.deepEqual(filterActivity(history,'7D','history',now).map(x=>x.id),['three']);
 assert.deepEqual(filterActivity(history,'30D','history',now).map(x=>x.id),['three','twentyfive']);
 assert.deepEqual(filterActivity(history,'1M','history',now).map(x=>x.id),['three','twentyfive']);
 const journal=[{id:'recent',timestamp:daysAgo(3)},{id:'old',timestamp:daysAgo(50)}];
 assert.deepEqual(filterActivity(journal,'1M','journal',now).map(x=>x.id),['recent']);
 assert.equal(activityTimestamp({time:'02:43:00'},'journal'),null);
 assert.equal(activityTimestamp({closedAt:'02:43:00'},'history'),null);
});
test('one-month calendar cutoff clamps month-end and never treats it as infinite',()=>{
 assert.equal(activityStart('1M',new Date('2026-03-31T08:00:00Z')).toISOString(),'2026-02-28T08:00:00.000Z');
 assert.equal(activityStart('7D',now).toISOString(),'2026-10-06T08:00:00.000Z');
});
test('spread is price difference from confirmed live bid/ask, never commission',()=>{
 const pos={valuationStatus:'LIVE'};
 const instr={bid:1.1010,ask:1.1012,pipSize:0.0001,quoteCurrency:'USD'};
 const value=positionCurrentSpread(pos,instr);
 assert.ok(Math.abs(value.amount-2)<0.001);
 assert.equal(value.unit,'pips');
 assert.equal(value.quoteCurrency,'USD');
 assert.equal(value.indicative,true);
 assert.equal(positionCurrentSpread(pos,{...instr,isStale:true}),null);
 assert.equal(positionCurrentSpread(pos,{...instr,bid:null}),null);
 assert.equal(positionCurrentSpread(pos,{...instr,ask:1.10}),null);
 assert.equal(positionCurrentSpread({valuationStatus:'WAITING'},instr),null);
});
